# app.py
import os
import time
import requests   # <-- needed for Brevo API

from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from flask import (
  Flask,
  jsonify,
  request,
  send_from_directory,
  render_template_string,
)
from flask_cors import CORS
from flask_login import LoginManager
from flask_jwt_extended import (
  JWTManager,
  create_access_token,
  jwt_required,
  get_jwt_identity,
  get_jwt,
)
from werkzeug.utils import secure_filename
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from models import db, User, Product, StockRequest, Notification
from config import Config


EASTERN = ZoneInfo("America/New_York")
BASE_URL = os.getenv("FOGON_BASE_URL", "http://localhost:5001")


# ---------- Helpers ----------
def to_eastern_iso(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(EASTERN).isoformat()


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


def is_low_stock_product(p: Product) -> bool:
    threshold = getattr(p, "reorder_threshold", 0) or 0
    qty = p.quantity or 0
    if threshold > 0 and qty <= threshold:
        return True
    return qty < 2


# ---------- Low Stock Scan ----------
def run_low_stock_scan():
    managers = User.query.filter_by(role="manager").all()
    if not managers:
        return

    all_products = Product.query.all()
    low_ids = set(p.id for p in all_products if is_low_stock_product(p))

    existing = Notification.query.filter(
        Notification.type == "LOW_STOCK",
        Notification.user_id.in_([m.id for m in managers])
    ).all()

    existing_map = {}

    # Clean old notifications
    for n in existing:
        pid = None
        if isinstance(n.payload, dict):
            pid = n.payload.get("product_id")

        if pid not in low_ids:
            db.session.delete(n)
            continue

        existing_map.setdefault(n.user_id, set()).add(pid)

    # Add new notifications
    for p in all_products:
        if p.id not in low_ids:
            continue

        for m in managers:
            if p.id in existing_map.get(m.id, set()):
                continue

            msg = f"Low stock: {p.name} has only {p.quantity} left."
            db.session.add(Notification(
                user_id=m.id,
                type="LOW_STOCK",
                message=msg,
                payload={"product_id": p.id, "quantity": p.quantity},
                is_read=False
            ))
            existing_map.setdefault(m.id, set()).add(p.id)

    db.session.commit()


# ---------- Flask App Factory ----------
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])

    # ---------- BREVO EMAIL SENDER ----------
    def send_password_reset_email(email: str, token: str):
        reset_link = f"{BASE_URL}/reset-password?token={token}"

        api_key = os.getenv("BREVO_API_KEY")
        sender = os.getenv("MAIL_FROM", "fogonsystem@gmail.com")

        if not api_key:
            print("❌ BREVO_API_KEY missing — cannot send email.")
            print("Password reset link for debugging:", reset_link)
            return

        url = "https://api.brevo.com/v3/smtp/email"
        payload = {
            "sender": {"email": sender, "name": "FogonIMS"},
            "to": [{"email": email}],
            "subject": "FogonIMS – Reset Your Password",
            "htmlContent": f"""
            <p>Hello,</p>
            <p>Click below to reset your password:</p>
            <p><a href="{reset_link}">Reset Password</a></p>
            <p>If you didn’t request this, ignore this email.</p>
            """
        }
        headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": api_key
        }

        try:
            r = requests.post(url, json=payload, headers=headers)
            print("Brevo response:", r.status_code, r.text)
        except Exception as e:
            print("Error calling Brevo API:", e)
            print("Password reset link for debugging:", reset_link)

    # ---------- App Setup ----------
    upload_folder = os.path.join(app.root_path, "static", "uploads")
    ensure_dir(upload_folder)
    app.config["UPLOAD_FOLDER"] = upload_folder

    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)
    login_manager = LoginManager(app)

    @login_manager.user_loader
    def load_user(uid):
        return User.query.get(int(uid))

    # ---------- ROOT ----------
    @app.route("/")
    def root():
        return jsonify({"msg": "FogonIMS API"}), 200

    @app.route("/static/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)

    # ---------- LOGIN ----------
    @app.post("/api/login")
    def api_login():
        data = request.get_json() or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            token = create_access_token(
                identity=user.username,
                additional_claims={"id": user.id, "role": user.role, "name": user.name}
            )
            return jsonify({
                "access_token": token,
                "role": user.role,
                "username": user.username,
                "name": user.name
            }), 200

        return jsonify({"error": "Invalid credentials"}), 401

    # ---------- REQUEST RESET ----------
    @app.post("/api/password/forgot")
    def api_password_forgot():
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()

        if not email:
            return jsonify({"error": "Email required"}), 400

        user = User.query.filter(db.func.lower(User.email) == email).first()

        if user:
            token = serializer.dumps({"uid": user.id})
            send_password_reset_email(user.email, token)

        return jsonify({"ok": True}), 200

    # ---------- RESET PASSWORD SCREEN (iPhone style) ----------
    @app.route("/reset-password", methods=["GET", "POST"])
    def reset_password_page():
        token = request.args.get("token") or request.form.get("token")
        if not token:
            return "Missing token", 400

        try:
            data = serializer.loads(token, max_age=3600)
            uid = data.get("uid")
        except Exception:
            return "Invalid or expired token", 400

        user = User.query.get(uid)
        if not user:
            return "User not found", 404

        # POST: update password
        if request.method == "POST":
            pw = (request.form.get("password") or "").strip()
            confirm = (request.form.get("confirm") or "").strip()

            if not pw:
                return "Password required", 400
            if pw != confirm:
                return "Passwords do not match", 400

            user.set_password(pw)
            db.session.commit()
            return """
            <html>
              <body style="
                background:#f97316;
                display:flex;
                align-items:center;
                justify-content:center;
                height:100vh;
                font-family:-apple-system,system-ui;">
                <div style="background:white;padding:30px;border-radius:20px;
                    max-width:360px;text-align:center;">
                  <h2>Password Updated</h2>
                  <p>You may now return to the FogonIMS app and log in.</p>
                </div>
              </body>
            </html>
            """

        # GET: iPhone optimized screen
        html = """
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <title>Reset Password – FogonIMS</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body {
                margin: 0;
                font-family: -apple-system, system-ui, BlinkMacSystemFont;
                background: linear-gradient(145deg, #f97316, #fb923c);
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              .card {
                background: #fff;
                padding: 24px 20px;
                border-radius: 22px;
                max-width: 420px;
                width: 90%;
                box-shadow: 0 18px 40px rgba(0,0,0,0.18);
              }
              h1 {
                margin: 0;
                font-size: 22px;
                font-weight: 700;
                color: #111;
              }
              p {
                color: #555;
                font-size: 14px;
                margin-bottom: 20px;
              }
              label {
                font-size: 13px;
                font-weight: 600;
                color: #444;
              }
              input {
                width: 100%;
                margin-top: 4px;
                margin-bottom: 14px;
                padding: 10px 12px;
                border-radius: 12px;
                border: 1px solid #ddd;
                font-size: 15px;
                background: #fafafa;
              }
              button {
                width: 100%;
                padding: 12px;
                font-size: 15px;
                font-weight: 600;
                background: #f97316;
                color: white;
                border: none;
                border-radius: 999px;
                box-shadow: 0 10px 22px rgba(249,115,22,0.45);
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Reset your password</h1>
              <p>Enter a new password for your FogonIMS account.</p>
              <form method="POST">
                <input type="hidden" name="token" value="{{ token }}">
                <label>New password</label>
                <input type="password" name="password" required>

                <label>Confirm password</label>
                <input type="password" name="confirm" required>

                <button type="submit">Update Password</button>
              </form>
            </div>
          </body>
        </html>
        """
        return render_template_string(html, token=token)

    # ---------------------------------------------
    # THE REST OF YOUR API ROUTES (products, requests, notifications)
    # ARE **UNCHANGED** — you paste them EXACTLY as before
    # ---------------------------------------------

    # (For brevity I’m not pasting all the product/request/report routes again.
    # You keep everything you already had — only the email + reset HTML changed.)

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
