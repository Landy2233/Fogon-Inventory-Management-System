# app.py
import os
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from flask import (
    Flask,
    jsonify,
    request,
    send_from_directory,
)
from flask_cors import CORS
from flask_login import LoginManager, current_user
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from werkzeug.utils import secure_filename

from models import db, User, Product, StockRequest, Notification
from config import Config

EASTERN = ZoneInfo("America/New_York")


# ---------- Time helper ----------
def to_eastern_iso(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(EASTERN).isoformat()


# ---------- File helpers ----------
def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def allowed_image(filename: str) -> bool:
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in {"jpg", "jpeg", "png", "gif", "webp"}


def unique_filename(filename: str) -> str:
    name = secure_filename(filename)
    ts = int(time.time() * 1000)
    base, ext = os.path.splitext(name)
    return f"{base}-{ts}{ext}"


# ---------- Low-stock scan (may create many, UI will dedupe) ----------
def run_low_stock_scan():
    """
    Scan for low-stock products and create LOW_STOCK notifications
    for all managers.

    We keep this dumb + reliable (no dedupe here) and handle
    deduplication in the /api/notifications response so the UI only
    shows one card per product.
    """
    managers = User.query.filter_by(role="manager").all()
    if not managers:
        return

    low_products = Product.query.filter(Product.quantity < 2).all()
    if not low_products:
        return

    for p in low_products:
        msg = f"Low stock: {p.name} has only {p.quantity} left."

        for m in managers:
            n = Notification(
                user_id=m.id,
                type="LOW_STOCK",
                message=msg,
                payload={"product_id": p.id, "quantity": p.quantity},
                is_read=False,
            )
            db.session.add(n)

    db.session.commit()


# ---------- App factory ----------
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    upload_folder = os.path.join(app.root_path, "static", "uploads")
    ensure_dir(upload_folder)
    app.config["UPLOAD_FOLDER"] = upload_folder
    app.config.setdefault("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)

    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)

    login_manager = LoginManager(app)

    @login_manager.user_loader
    def load_user(uid):
        return User.query.get(int(uid))

    # ---------- Root / static ----------
    @app.route("/")
    def index():
        return jsonify({"msg": "FogonIMS API"}), 200

    @app.route("/static/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    # ---------- Auth ----------
    @app.post("/api/login")
    def api_login():
        data = request.get_json() or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            token = create_access_token(
                identity=user.username,
                additional_claims={"id": user.id, "role": user.role},
            )
            return jsonify(
                {
                    "access_token": token,
                    "role": user.role,
                    "username": user.username,
                }
            ), 200
        return jsonify({"error": "Invalid credentials"}), 401

    @app.get("/api/me")
    @jwt_required()
    def api_me():
        username = get_jwt_identity()
        claims = get_jwt()
        return jsonify(
            {
                "id": claims.get("id"),
                "username": username,
                "role": claims.get("role"),
            }
        ), 200

    # ---------- Products ----------
    @app.get("/api/products")
    @jwt_required()
    def api_products_list():
        items = Product.query.order_by(Product.name).all()
        result = []
        for p in items:
            threshold = getattr(p, "reorder_threshold", 0) or 0
            is_low = (threshold > 0 and p.quantity <= threshold) or (p.quantity < 2)
            result.append(
                {
                    "id": p.id,
                    "name": p.name,
                    "quantity": p.quantity,
                    "price": float(p.price or 0),
                    "description": p.description or "",
                    "image_url": getattr(p, "image_url", None),
                    "reorder_threshold": threshold,
                    "is_low_stock": is_low,
                }
            )
        return jsonify(result), 200

    @app.get("/api/products/<int:pid>")
    @jwt_required()
    def api_products_read_one(pid: int):
        p = Product.query.get(pid)
        if not p:
            return jsonify({"error": "Product not found"}), 404

        threshold = getattr(p, "reorder_threshold", 0) or 0
        is_low = (threshold > 0 and p.quantity <= threshold) or (p.quantity < 2)

        return jsonify(
            {
                "id": p.id,
                "name": p.name,
                "quantity": p.quantity,
                "price": float(p.price or 0),
                "description": p.description or "",
                "image_url": getattr(p, "image_url", None),
                "reorder_threshold": threshold,
                "is_low_stock": is_low,
            }
        ), 200

    @app.post("/api/products")
    @jwt_required()
    def api_products_create():
        username = (get_jwt_identity() or "").lower()
        role = (get_jwt().get("role") or "").lower()
        if not (username == "manager" or role == "manager"):
            return jsonify({"error": "Only 'manager' can add products"}), 403

        is_multipart = (
            request.content_type and "multipart/form-data" in request.content_type
        )
        data = request.form if is_multipart else (request.get_json() or {})

        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Name is required"}), 400

        try:
            quantity = int(data.get("quantity", 0) or 0)
            price = float(data.get("price", 0) or 0)
            threshold = int(data.get("reorder_threshold", 0) or 0)
        except Exception:
            return jsonify(
                {"error": "quantity, price and threshold must be numeric"}
            ), 400

        description = (data.get("description") or "").strip()

        image_url = None
        if is_multipart:
            image_file = request.files.get("image")
            if image_file and image_file.filename:
                if not allowed_image(image_file.filename):
                    return jsonify({"error": "Unsupported image type"}), 400
                fname = unique_filename(image_file.filename)
                save_path = os.path.join(app.config["UPLOAD_FOLDER"], fname)
                image_file.save(save_path)
                image_url = f"/static/uploads/{fname}"

        p = Product(
            name=name,
            quantity=quantity,
            price=price,
            description=description,
            image_url=image_url,
            reorder_threshold=threshold,
        )
        db.session.add(p)
        db.session.commit()
        return jsonify({"ok": True, "id": p.id, "image_url": p.image_url}), 201

    @app.put("/api/products/<int:pid>")
    @jwt_required()
    def api_products_update(pid: int):
        username = (get_jwt_identity() or "").lower()
        role = (get_jwt().get("role") or "").lower()
        if not (username == "manager" or role == "manager"):
            return jsonify({"error": "Only 'manager' can edit products"}), 403

        p = Product.query.get(pid)
        if not p:
            return jsonify({"error": "Product not found"}), 404

        is_multipart = (
            request.content_type and "multipart/form-data" in request.content_type
        )
        payload = request.form if is_multipart else (request.get_json() or {})

        try:
            p.name = (payload.get("name", p.name) or "").strip()
            p.description = (
                payload.get("description", p.description or "") or ""
            ).strip()
            p.quantity = int(payload.get("quantity", p.quantity))
            p.price = float(payload.get("price", p.price or 0))
            p.reorder_threshold = int(
                payload.get("reorder_threshold", getattr(p, "reorder_threshold", 0) or 0)
            )
        except Exception:
            return jsonify(
                {"error": "quantity, price and threshold must be numeric"}
            ), 400

        db.session.commit()
        return jsonify({"ok": True, "id": p.id}), 200

    @app.delete("/api/products/<int:pid>")
    @jwt_required()
    def api_products_delete(pid: int):
        username = (get_jwt_identity() or "").lower()
        role = (get_jwt().get("role") or "").lower()
        if not (username == "manager" or role == "manager"):
            return jsonify({"error": "Only 'manager' can delete products"}), 403

        p = Product.query.get(pid)
        if not p:
            return jsonify({"error": "Product not found"}), 404

        if getattr(p, "image_url", None):
            try:
                path = os.path.join(app.root_path, p.image_url.strip("/"))
                if os.path.isfile(path):
                    os.remove(path)
            except Exception:
                pass

        db.session.delete(p)
        db.session.commit()
        return jsonify({"ok": True, "id": pid}), 200

    # ---------- Stock Requests ----------
    @app.post("/api/requests")
    @jwt_required()
    def api_stock_request():
        claims = get_jwt()
        uid = claims.get("id")
        username = (get_jwt_identity() or "").lower()
        role = (claims.get("role") or "").lower()

        if username == "manager" or role == "manager":
            return jsonify({"error": "Managers cannot request products"}), 403

        data = request.get_json() or {}
        try:
            product_id = int(data.get("product_id"))
            qty = int(data.get("quantity", 0))
        except Exception:
            return jsonify({"error": "product_id and quantity must be integers"}), 400

        if qty <= 0:
            return jsonify({"error": "Quantity must be > 0"}), 400

        product = Product.query.get(product_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        sr = StockRequest(product_id=product_id, requested_by=uid, quantity=qty)
        db.session.add(sr)
        db.session.commit()
        return jsonify({"ok": True, "id": sr.id, "status": sr.status}), 201

    @app.get("/api/requests")
    @jwt_required()
    def api_requests_list():
        claims = get_jwt()
        uid = claims.get("id")
        role = (claims.get("role") or "").lower()

        q = StockRequest.query.join(Product, StockRequest.product_id == Product.id)

        if role != "manager":
            q = q.filter(StockRequest.requested_by == uid)

        rows = q.order_by(StockRequest.created_at.desc()).all()

        return jsonify(
            [
                {
                    "id": r.id,
                    "product_id": r.product_id,
                    "product_name": r.product.name if r.product else None,
                    "requested_qty": r.quantity,
                    "status": r.status,
                    "created_at": to_eastern_iso(r.created_at),
                }
                for r in rows
            ]
        ), 200

    @app.post("/api/requests/<int:rid>/approve")
    @jwt_required()
    def api_request_approve(rid: int):
        claims = get_jwt()
        role = (claims.get("role") or "").lower()
        if role != "manager":
            return jsonify({"error": "Only manager can approve requests"}), 403

        r = StockRequest.query.get(rid)
        if not r:
            return jsonify({"error": "Request not found"}), 404

        if r.status == "Approved":
            return jsonify({"ok": True, "status": r.status}), 200

        product = Product.query.get(r.product_id)
        if not product:
            return jsonify({"error": "Product not found"}), 404

        product.quantity = (product.quantity or 0) + r.quantity
        r.status = "Approved"

        n = Notification(
            user_id=r.requested_by,
            type="REQUEST_APPROVED",
            message=f"Your request for {r.quantity}x {product.name} was approved.",
            payload={"request_id": r.id, "product_id": product.id},
        )
        db.session.add(n)

        db.session.commit()
        return jsonify({"ok": True, "status": r.status}), 200

    @app.post("/api/requests/<int:rid>/deny")
    @jwt_required()
    def api_request_deny(rid: int):
        claims = get_jwt()
        role = (claims.get("role") or "").lower()
        if role != "manager":
            return jsonify({"error": "Only manager can deny requests"}), 403

        r = StockRequest.query.get(rid)
        if not r:
            return jsonify({"error": "Request not found"}), 404

        if r.status == "Denied":
            return jsonify({"ok": True, "status": r.status}), 200

        data = request.get_json() or {}
        reason = (data.get("reason") or "").strip()

        product = Product.query.get(r.product_id)
        pname = product.name if product else "product"

        r.status = "Denied"

        msg = f"Your request for {r.quantity}x {pname} was denied."
        if reason:
            msg += f" Reason: {reason}"

        n = Notification(
            user_id=r.requested_by,
            type="REQUEST_DENIED",
            message=msg,
            payload={"request_id": r.id, "product_id": r.product_id, "reason": reason},
        )
        db.session.add(n)

        db.session.commit()
        return jsonify({"ok": True, "status": r.status}), 200

    # ---------- Notifications ----------
    @app.get("/api/notifications")
    @jwt_required()
    def api_notifications_list():
        claims = get_jwt()
        uid = claims.get("id")
        role = (claims.get("role") or "").lower()

        # Manager opening notifications → run low-stock scan
        if role == "manager":
            run_low_stock_scan()

        # Fetch all notifications for this user (newest first)
        all_items = (
            Notification.query.filter_by(user_id=uid)
            .order_by(Notification.created_at.desc())
            .all()
        )

        # Deduplicate LOW_STOCK by product (using payload.product_id if present,
        # otherwise use the message prefix)
        seen_low_stock = set()
        filtered_items = []

        for n in all_items:
            if n.type == "LOW_STOCK":
                product_id = None
                if isinstance(n.payload, dict):
                    product_id = n.payload.get("product_id")

                # use product_id as key if present, else message prefix
                if product_id is not None:
                    key = ("LOW_STOCK", product_id)
                else:
                    key = ("LOW_STOCK", (n.message or "").split(" has only")[0])

                if key in seen_low_stock:
                    # Skip duplicate low-stock notifications for the same product
                    continue

                seen_low_stock.add(key)

            filtered_items.append(n)

        return jsonify(
            [
                {
                    "id": n.id,
                    "type": n.type,
                    "message": n.message,
                    "payload": n.payload,
                    "is_read": n.is_read,
                    "created_at": to_eastern_iso(n.created_at),
                }
                for n in filtered_items
            ]
        ), 200

    @app.post("/api/notifications/<int:nid>/read")
    @jwt_required()
    def api_notifications_mark_read(nid: int):
        claims = get_jwt()
        uid = claims.get("id")

        n = Notification.query.filter_by(id=nid, user_id=uid).first()
        if not n:
            return jsonify({"error": "Notification not found"}), 404

        n.is_read = True
        db.session.commit()
        return jsonify({"ok": True}), 200

    @app.post("/api/scan-low-stock")
    @jwt_required()
    def api_scan_low_stock():
        claims = get_jwt()
        role = (claims.get("role") or "").lower()
        if role != "manager":
            return jsonify({"error": "Only manager can trigger low stock scan"}), 403

        run_low_stock_scan()
        return jsonify({"ok": True}), 200

    # ---------- Health ----------
    @app.get("/api/health")
    def api_health():
        return jsonify({"ok": True}), 200

    # ---------- CLI: init-db ----------
    @app.cli.command("init-db")
    def init_db():
        with app.app_context():
            db.create_all()
            created = False
            if not User.query.filter_by(username="manager").first():
                m = User(username="manager", role="manager", email="manager@example.com")
                m.set_password("Manager123!")
                db.session.add(m)
                created = True

            if not User.query.filter_by(username="cook").first():
                c = User(username="cook", role="cook", email="cook@example.com")
                c.set_password("Cook123!")
                db.session.add(c)
                created = True

            if created:
                db.session.commit()
                print("Seeded users.")
            print("DB ready.")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
