# app.py
import os
import time
from flask import Flask, jsonify, request, redirect, url_for, send_from_directory
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

from models import db, User, Product, StockRequest
from config import Config


# -------- Helpers --------
def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def allowed_image(filename: str):
    if not filename or "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in {"jpg", "jpeg", "png", "gif", "webp"}


def unique_filename(filename: str):
    name = secure_filename(filename)
    ts = int(time.time() * 1000)
    base, ext = os.path.splitext(name)
    return f"{base}-{ts}{ext}"


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Upload setup
    upload_folder = os.path.join(app.root_path, "static", "uploads")
    ensure_dir(upload_folder)
    app.config["UPLOAD_FOLDER"] = upload_folder
    app.config.setdefault("MAX_CONTENT_LENGTH", 16 * 1024 * 1024)  # 16MB

    # Extensions
    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)

    login_manager = LoginManager(app)

    @login_manager.user_loader
    def load_user(uid):
        return User.query.get(int(uid))

    # ----------------- Root -----------------
    @app.route("/")
    def index():
        if current_user.is_authenticated:
            return redirect(url_for("api_health"))
        return jsonify({"msg": "FogonIMS API"}), 200

    # Serve uploaded files
    @app.route("/static/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    # ----------------- Auth -----------------
    @app.post("/api/login")
    def api_login():
        """
        Accepts JSON: { "username": "...", "password": "..." }
        Returns: { "access_token": "...", "role": "...", "username": "..." }
        """
        data = request.get_json() or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            token = create_access_token(
                identity=user.username,  # sub must be a string
                additional_claims={"id": user.id, "role": user.role},
            )
            return jsonify(
                {"access_token": token, "role": user.role, "username": user.username}
            ), 200
        return jsonify({"error": "Invalid credentials"}), 401

    @app.get("/api/me")
    @jwt_required()
    def api_me():
        username = get_jwt_identity()
        claims = get_jwt()
        return jsonify({
            "id": claims.get("id"),
            "username": username,
            "role": claims.get("role")
        }), 200

    # ------------- Products (list) -------------
    @app.get("/api/products")
    @jwt_required()
    def api_products_list():
        items = Product.query.order_by(Product.name).all()
        return jsonify([
            {
                "id": p.id,
                "name": p.name,
                "quantity": p.quantity,
                "price": float(p.price or 0),
                "description": p.description or "",
                "image_url": getattr(p, "image_url", None),
            } for p in items
        ]), 200

    # ------------- Product (read one) -------------
    @app.get("/api/products/<int:pid>")
    @jwt_required()
    def api_products_read_one(pid: int):
        p = Product.query.get(pid)
        if not p:
            return jsonify({"error": "Product not found"}), 404
        return jsonify({
            "id": p.id,
            "name": p.name,
            "quantity": p.quantity,
            "price": float(p.price or 0),
            "description": p.description or "",
            "image_url": getattr(p, "image_url", None),
        }), 200

    # ------------- Products (create - manager only, with image) -------------
    @app.post("/api/products")
    @jwt_required()
    def api_products_create():
        username = (get_jwt_identity() or "").lower()
        role = (get_jwt().get("role") or "").lower()
        if not (username == "manager" or role == "manager"):
            return jsonify({"error": "Only 'manager' can add products"}), 403

        # Accept JSON or multipart; image requires multipart
        is_multipart = request.content_type and "multipart/form-data" in request.content_type
        data = request.form if is_multipart else (request.get_json() or {})

        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Name is required"}), 400

        try:
            quantity = int(data.get("quantity", 0) or 0)
            price = float(data.get("price", 0) or 0)
        except Exception:
            return jsonify({"error": "quantity and price must be numeric"}), 400

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
            image_url=image_url
        )
        db.session.add(p)
        db.session.commit()
        return jsonify({"ok": True, "id": p.id, "image_url": p.image_url}), 201

    # ------------- Products (update - manager only; JSON OR multipart, no image required) -------------
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

        is_multipart = request.content_type and "multipart/form-data" in request.content_type
        payload = request.form if is_multipart else (request.get_json() or {})

        try:
            p.name = (payload.get("name", p.name) or "").strip()
            p.description = (payload.get("description", p.description or "") or "").strip()
            p.quantity = int(payload.get("quantity", p.quantity))
            p.price = float(payload.get("price", p.price or 0))
        except Exception:
            return jsonify({"error": "quantity and price must be numeric"}), 400

        # (Optional in future) handle new image here if you re-enable picker in edit screen

        db.session.commit()
        return jsonify({"ok": True, "id": p.id}), 200

    # ------------- Products (delete - manager only) -------------
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

        # remove file if any
        if p.image_url:
            try:
                path = os.path.join(app.root_path, p.image_url.strip("/"))
                if os.path.isfile(path):
                    os.remove(path)
            except Exception:
                pass

        db.session.delete(p)
        db.session.commit()
        return jsonify({"ok": True, "id": pid}), 200

    # ------------- Stock Requests (non-managers) -------------
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

        if not Product.query.get(product_id):
            return jsonify({"error": "Product not found"}), 404

        sr = StockRequest(product_id=product_id, requested_by=uid, quantity=qty)
        db.session.add(sr)
        db.session.commit()
        return jsonify({"ok": True, "id": sr.id, "status": sr.status}), 201

    # ------------- Health -------------
    @app.get("/api/health")
    def api_health():
        return jsonify({"ok": True}), 200

    # ------------- CLI: init-db -------------
    @app.cli.command("init-db")
    def init_db():
        """
        Create tables and seed default users:
          - manager / Manager123!
          - cook    / Cook123!
        """
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



