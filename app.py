# app.py
from flask import Flask, redirect, url_for, request, jsonify
from flask_login import LoginManager, current_user
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)

from config import Config
from models import db, User, Product, StockRequest


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # --- Core extensions ---
    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})   # allow mobile app calls
    app.config["JWT_SECRET_KEY"] = app.config["SECRET_KEY"]
    JWTManager(app)

    # --- Login (web) ---
    login_manager = LoginManager(app)
    login_manager.login_view = "auth.login"

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # --- Blueprints (web) ---
    from auth.routes import auth_bp
    from inventory.routes import inventory_bp
    from requests.routes import requests_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(inventory_bp, url_prefix="/products")
    app.register_blueprint(requests_bp, url_prefix="/requests")

    # --- Root redirect (web) ---
    @app.route("/")
    def index():
        if current_user.is_authenticated:
            return redirect(url_for("inventory.list_products"))
        return redirect(url_for("auth.login"))

    # ===============================
    # ============  API  ============
    # ===============================

    # ---- Auth (mobile) ----
    @app.post("/api/login")
    def api_login():
        data = request.get_json() or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            token = create_access_token(identity={"id": user.id, "role": user.role})
            return jsonify({"access_token": token, "role": user.role}), 200

        return jsonify({"error": "Invalid credentials"}), 401

    # ---- Products (mobile) ----
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
                "description": p.description or ""
            } for p in items
        ])

    @app.post("/api/products")
    @jwt_required()
    def api_products_create():
        ident = get_jwt_identity() or {}
        if ident.get("role") != "manager":
            return jsonify({"error": "Manager role required"}), 403

        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Name is required"}), 400

        try:
            p = Product(
                name=name,
                quantity=int(data.get("quantity", 0) or 0),
                price=(data.get("price", 0) or 0),
                description=(data.get("description") or "").strip()
            )
            db.session.add(p)
            db.session.commit()
            return jsonify({"ok": True, "id": p.id}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "Failed to create product", "detail": str(e)}), 500

    # ---- Stock Requests (mobile) ----
    @app.post("/api/requests")
    @jwt_required()
    def api_stock_request():
        ident = get_jwt_identity() or {}
        user_id = ident.get("id")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json() or {}
        try:
            product_id = int(data.get("product_id"))
            quantity = int(data.get("quantity", 0))
        except Exception:
            return jsonify({"error": "product_id and quantity must be integers"}), 400

        if quantity <= 0:
            return jsonify({"error": "Quantity must be greater than 0"}), 400

        if not Product.query.get(product_id):
            return jsonify({"error": "Product not found"}), 404

        try:
            sr = StockRequest(
                product_id=product_id,
                requested_by=int(user_id),
                quantity=quantity
            )
            db.session.add(sr)
            db.session.commit()
            return jsonify({"ok": True, "id": sr.id, "status": sr.status}), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "Failed to submit request", "detail": str(e)}), 500

    # ---- Health (optional) ----
    @app.get("/api/health")
    def api_health():
        return jsonify({"ok": True}), 200

    return app


# Run the app
app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)