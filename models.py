# models.py
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)  # <-- ADD THIS
    email = db.Column(db.String(120), unique=True)
    role = db.Column(db.String(20), default="cook")  # "cook" or "manager"
    password_hash = db.Column(db.String(255), nullable=False)

    def set_password(self, raw: str) -> None:
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw: str) -> bool:
        return check_password_hash(self.password_hash, raw)


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    quantity = db.Column(db.Integer, default=0)
    price = db.Column(db.Numeric(10, 2), default=0)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(255), nullable=True)
    # Sprint 2: threshold for low stock alerts
    reorder_threshold = db.Column(db.Integer, default=0)


class StockRequest(db.Model):
    __tablename__ = "stock_requests"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    requested_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    # DB enum is ('Pending','Approved','Denied'); store as text here
    status = db.Column(db.String(20), default="Pending")
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    product = db.relationship("Product", backref="stock_requests")
    requester = db.relationship("User", backref="stock_requests")


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    # e.g. "LOW_STOCK", "REQUEST_APPROVED", "REQUEST_DENIED"
    type = db.Column(db.String(32), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    payload = db.Column(db.JSON, nullable=True)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    user = db.relationship("User", backref="notifications")




