# app.py
import os
import time

from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

import requests as http_requests  # Brevo HTTP client
from email.message import EmailMessage   # still imported but not used; OK

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

BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.getenv("MAIL_FROM", "no-reply@fogonims.com")
BREVO_SENDER_NAME = os.getenv("MAIL_FROM_NAME", "FogonIMS")


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


# ---------- Low-stock helper ----------
def is_low_stock_product(p: Product) -> bool:
  """
  Same logic as the API:
  - If reorder_threshold > 0 and quantity <= threshold -> low
  - OR quantity < 2 as a fallback
  """
  threshold = getattr(p, "reorder_threshold", 0) or 0
  qty = p.quantity or 0
  if threshold > 0 and qty <= threshold:
    return True
  return qty < 2


# ---------- Low-stock scan ----------
def run_low_stock_scan():
  """
  Scan for low-stock products and manage LOW_STOCK notifications.

  Behavior:
  - When a product becomes low stock, each manager gets ONE notification.
  - While it stays low, no duplicate notifications are created.
  - If the product is restocked (no longer low), existing LOW_STOCK
    notifications for that product are removed.
  - If it later becomes low again, managers get a new notification.
  """
  managers = User.query.filter_by(role="manager").all()
  if not managers:
    return

  all_products = Product.query.all()
  if not all_products:
    return

  manager_ids = [m.id for m in managers]

  # Determine current low-stock products
  low_product_ids = set()
  for p in all_products:
    if is_low_stock_product(p):
      low_product_ids.add(p.id)

  # Load existing LOW_STOCK notifications for managers
  existing = (
    Notification.query
    .filter(Notification.type == "LOW_STOCK")
    .filter(Notification.user_id.in_(manager_ids))
    .all()
  )

  # Map manager_id -> set(product_id) that already has LOW_STOCK notif
  existing_map: dict[int, set[int]] = {}

  # 1) Clean up notifications for products that are no longer low
  for n in existing:
    pid = None
    if isinstance(n.payload, dict):
      pid = n.payload.get("product_id")

    if pid is None:
      # If payload is weird, just leave the notification
      continue

    if pid not in low_product_ids:
      # Product is no longer low -> remove old LOW_STOCK notification
      db.session.delete(n)
      continue

    # Product still low -> keep and register
    existing_map.setdefault(n.user_id, set()).add(pid)

  # 2) For each low product, create missing notifications
  for p in all_products:
    if p.id not in low_product_ids:
      continue  # only care about low products

    for m in managers:
      already_has = p.id in existing_map.get(m.id, set())
      if already_has:
        continue

      msg = f"Low stock: {p.name} has only {p.quantity} left in inventory."
      n = Notification(
        user_id=m.id,
        type="LOW_STOCK",
        message=msg,
        payload={"product_id": p.id, "quantity": p.quantity},
        is_read=False,
      )
      db.session.add(n)
      existing_map.setdefault(m.id, set()).add(p.id)

  db.session.commit()


# ---------- App factory ----------
def create_app():
  app = Flask(__name__)
  app.config.from_object(Config)

  # ----- password-reset token serializer -----
  serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])

  # ----- password-reset email sender (Brevo) -----
  def send_password_reset_email(email: str, token: str):
    reset_link = f"{BASE_URL}/reset-password?token={token}"

    # Always log link for debugging
    print("Password reset link for debugging:", reset_link)

    if not BREVO_API_KEY:
      print("BREVO_API_KEY is not set – skipping actual email send.")
      return

    try:
      url = "https://api.brevo.com/v3/smtp/email"
      headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      }
      payload = {
        "sender": {
          "name": BREVO_SENDER_NAME,
          "email": BREVO_SENDER_EMAIL,
        },
        "to": [{"email": email}],
        "subject": "FogonIMS – Password Reset",
        "textContent": (
          "Hi,\n\n"
          "We received a request to reset your FogonIMS password.\n\n"
          f"Click the link below to reset it:\n{reset_link}\n\n"
          "If you didn't request this, you can ignore this email.\n"
        ),
      }
      resp = http_requests.post(url, headers=headers, json=payload, timeout=10)
      if resp.status_code >= 400:
        print("Brevo error:", resp.status_code, resp.text)
      else:
        print("Password reset email sent via Brevo:", email)
    except Exception as e:
      print("Error calling Brevo API:", e)

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
        additional_claims={
          "id": user.id,
          "role": user.role,
          "name": user.name,
        },
      )
      return (
        jsonify(
          {
            "access_token": token,
            "role": user.role,
            "username": user.username,
            "name": user.name,
          }
        ),
        200,
      )
    return jsonify({"error": "Invalid credentials"}), 401

  @app.post("/api/register")
  def api_register():
    """
    Create a new user (cook or manager) and return a JWT so the app can
    log them in immediately.
    """
    data = request.get_json() or {}

    username = (data.get("username") or "").strip()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    role = (data.get("role") or "cook").strip().lower()

    if not username or not name or not password:
      return jsonify(
        {"error": "username, name, and password are required"}
      ), 400

    if role not in ("cook", "manager"):
      return jsonify({"error": "role must be 'cook' or 'manager'"}), 400

    if User.query.filter_by(username=username).first():
      return jsonify({"error": "Username already exists"}), 400

    if email and User.query.filter_by(email=email).first():
      return jsonify({"error": "Email already exists"}), 400

    u = User(
      username=username,
      name=name,
      email=email or None,
      role=role,
    )
    u.set_password(password)

    db.session.add(u)
    db.session.commit()

    token = create_access_token(
      identity=u.username,
      additional_claims={
        "id": u.id,
        "role": u.role,
        "name": u.name,
      },
    )

    return (
      jsonify(
        {
          "ok": True,
          "id": u.id,
          "username": u.username,
          "name": u.name,
          "role": u.role,
          "access_token": token,
        }
      ),
      201,
    )

  # ----- start password reset by email -----
  @app.post("/api/password/forgot")
  def api_password_forgot():
    """
    Start password reset by email.
    Always returns 200 (if email provided) so we don't leak which emails exist.
    """
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
      return jsonify({"error": "Email is required"}), 400

    user = (
      User.query.filter(db.func.lower(User.email) == email)
      .first()
    )

    if not user:
      return jsonify({"ok": True}), 200

    token = serializer.dumps({"uid": user.id})

    try:
      send_password_reset_email(user.email, token)
    except Exception as e:
      print("Error sending reset email:", e)

    return jsonify({"ok": True}), 200

  # ----- reset password page (from email link) -----
  @app.route("/reset-password", methods=["GET", "POST"])
  def reset_password_page():
    token = request.args.get("token") or request.form.get("token")

    if not token:
      return "Missing token.", 400

    try:
      data = serializer.loads(token, max_age=3600)  # 1 hour expiry
      uid = data.get("uid")
    except SignatureExpired:
      return "This password reset link has expired.", 400
    except BadSignature:
      return "Invalid password reset token.", 400

    user = User.query.get(uid)
    if not user:
      return "User not found.", 404

    if request.method == "POST":
      new_password = (request.form.get("password") or "").strip()
      confirm = (request.form.get("confirm") or "").strip()

      if not new_password:
        return "Password is required.", 400
      if new_password != confirm:
        return "Passwords do not match.", 400

      user.set_password(new_password)
      db.session.commit()
      return """
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset – FogonIMS</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: linear-gradient(135deg, #f97316, #facc15);
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .card {
              background: #ffffff;
              padding: 32px 28px;
              border-radius: 16px;
              box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
              max-width: 420px;
              width: 100%;
            }
            h1 {
              margin: 0 0 8px 0;
              font-size: 1.6rem;
              color: #111827;
            }
            .success {
              padding: 10px 12px;
              border-radius: 10px;
              background: #ecfdf5;
              color: #166534;
              font-size: 0.9rem;
              border: 1px solid #bbf7d0;
            }
            a.btn {
              display: inline-block;
              margin-top: 18px;
              padding: 10px 16px;
              border-radius: 999px;
              background: #f97316;
              color: #ffffff;
              text-decoration: none;
              font-size: 0.9rem;
              font-weight: 500;
            }
            a.btn:hover {
              filter: brightness(0.95);
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Password reset successful</h1>
            <div class="success">
              Your password has been updated. You can now log in with your new credentials in the FogonIMS app.
            </div>
            <a href="/" class="btn">Back to FogonIMS API</a>
          </div>
        </body>
      </html>
      """

    # GET: show reset form
    html = """
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Reset Password – FogonIMS</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: linear-gradient(135deg, #f97316, #facc15);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .card {
            background: #ffffff;
            padding: 32px 28px;
            border-radius: 16px;
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
            max-width: 420px;
            width: 100%;
          }
          h1 {
            margin: 0 0 6px 0;
            font-size: 1.6rem;
            color: #111827;
          }
          p.sub {
            margin: 0 0 20px 0;
            font-size: 0.9rem;
            color: #6b7280;
          }
          label {
            font-size: 0.82rem;
            color: #374151;
            display: block;
            margin-bottom: 4px;
          }
          input[type="password"] {
            width: 100%;
            padding: 9px 10px;
            border-radius: 10px;
            border: 1px solid #d1d5db;
            font-size: 0.9rem;
            box-sizing: border-box;
          }
          input[type="password"]:focus {
            outline: none;
            border-color: #f97316;
            box-shadow: 0 0 0 1px rgba(249,115,22,0.2);
          }
          .field {
            margin-bottom: 14px;
          }
          button {
            margin-top: 6px;
            width: 100%;
            padding: 10px 14px;
            border-radius: 999px;
            border: none;
            background: #f97316;
            color: white;
            font-size: 0.95rem;
            font-weight: 500;
          }
          button:hover {
            filter: brightness(0.95);
          }
          .hint {
            margin-top: 8px;
            font-size: 0.8rem;
            color: #9ca3af;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Reset your password</h1>
          <p class="sub">Choose a new password for your FogonIMS account.</p>
          <form method="POST">
            <input type="hidden" name="token" value="{{ token }}">
            <div class="field">
              <label>New password</label>
              <input type="password" name="password" required>
            </div>
            <div class="field">
              <label>Confirm password</label>
              <input type="password" name="confirm" required>
            </div>
            <button type="submit">Update password</button>
            <p class="hint">After resetting, return to the app and log in with your new password.</p>
          </form>
        </div>
      </body>
    </html>
    """
    return render_template_string(html, token=token)

  @app.get("/api/me")
  @jwt_required()
  def api_me():
    username = get_jwt_identity()
    claims = get_jwt()
    return (
      jsonify(
        {
          "id": claims.get("id"),
          "username": username,
          "role": claims.get("role"),
          "name": claims.get("name"),
        }
      ),
      200,
    )

  # ---------- Products ----------
  @app.get("/api/products")
  @jwt_required()
  def api_products_list():
    """
    Optional query param:
      ?filter=low   -> only items considered low stock
    """
    filter_param = (request.args.get("filter") or "").lower()

    q = Product.query

    if filter_param == "low":
      # Use same helper
      items = q.all()
      filtered = [p for p in items if is_low_stock_product(p)]
    else:
      filtered = q.all()

    filtered.sort(key=lambda p: (p.name or "").lower())

    result = []
    for p in filtered:
      threshold = getattr(p, "reorder_threshold", 0) or 0
      is_low = is_low_stock_product(p)
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
          "vendor_name": getattr(p, "vendor_name", None),
          "vendor_contact": getattr(p, "vendor_contact", None),
          "category": getattr(p, "category", None),
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
    is_low = is_low_stock_product(p)

    return (
      jsonify(
        {
          "id": p.id,
          "name": p.name,
          "quantity": p.quantity,
          "price": float(p.price or 0),
          "description": p.description or "",
          "image_url": getattr(p, "image_url", None),
          "reorder_threshold": threshold,
          "is_low_stock": is_low,
          "vendor_name": getattr(p, "vendor_name", None),
          "vendor_contact": getattr(p, "vendor_contact", None),
          "category": getattr(p, "category", None),
        }
      ),
      200,
    )

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
    vendor_name = (data.get("vendor_name") or "").strip() or None
    vendor_contact = (data.get("vendor_contact") or "").strip() or None
    category = (data.get("category") or "").strip() or None

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
      vendor_name=vendor_name,
      vendor_contact=vendor_contact,
      category=category,
    )
    db.session.add(p)
    db.session.commit()
    return jsonify({"ok": True, "id": p.id, "image_url": p.image_url}), 201

  @app.post("/api/products/bulk")
  @jwt_required()
  def api_products_bulk_import():
    """
    Bulk import many products at once.
    Expects JSON:
    {
      "items": [
        {
          "name": "...",
          "quantity": 10,
          "price": 4.50,
          "description": "...",
          "reorder_threshold": 2,
          "vendor_name": "...",
          "vendor_contact": "...",
          "category": "Produce"
        },
        ...
      ]
    }
    """
    username = (get_jwt_identity() or "").lower()
    role = (get_jwt().get("role") or "").lower()
    if not (username == "manager" or role == "manager"):
      return jsonify({"error": "Only 'manager' can bulk import products"}), 403

    payload = request.get_json() or {}
    items = payload.get("items") or []
    if not isinstance(items, list) or not items:
      return jsonify({"error": "items[] is required"}), 400

    created = []
    for row in items:
      name = (row.get("name") or "").strip()
      if not name:
        continue

      try:
        quantity = int(row.get("quantity", 0) or 0)
        price = float(row.get("price", 0) or 0)
        threshold = int(row.get("reorder_threshold", 0) or 0)
      except Exception:
        continue

      description = (row.get("description") or "").strip()
      vendor_name = (row.get("vendor_name") or "").strip() or None
      vendor_contact = (row.get("vendor_contact") or "").strip() or None
      category = (row.get("category") or "").strip() or None

      p = Product(
        name=name,
        quantity=quantity,
        price=price,
        description=description,
        reorder_threshold=threshold,
        vendor_name=vendor_name,
        vendor_contact=vendor_contact,
        category=category,
      )
      db.session.add(p)
      created.append(p)

    db.session.commit()

    return (
      jsonify(
        {
          "ok": True,
          "count": len(created),
          "ids": [p.id for p in created],
        }
      ),
      201,
    )

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

    if is_multipart:
      payload = request.form
      image_file = request.files.get("image")
    else:
      payload = request.get_json() or {}
      image_file = None

    new_image_url = getattr(p, "image_url", None)

    if image_file and image_file.filename:
      if not allowed_image(image_file.filename):
        return jsonify({"error": "Unsupported image type"}), 400

      fname = unique_filename(image_file.filename)
      save_path = os.path.join(app.config["UPLOAD_FOLDER"], fname)
      image_file.save(save_path)
      new_image_url = f"/static/uploads/{fname}"

      old_url = getattr(p, "image_url", None)
      if old_url:
        try:
          old_path = os.path.join(app.root_path, old_url.strip("/"))
          if os.path.isfile(old_path):
            os.remove(old_path)
        except Exception:
          pass

    try:
      p.name = (payload.get("name", p.name) or "").strip()
      p.description = (
        payload.get("description", p.description or "") or ""
      ).strip()
      p.quantity = int(payload.get("quantity", p.quantity))
      p.price = float(payload.get("price", p.price or 0))
      p.reorder_threshold = int(
        payload.get(
          "reorder_threshold",
          getattr(p, "reorder_threshold", 0) or 0,
        )
      )
      p.vendor_name = (
        (payload.get("vendor_name", getattr(p, "vendor_name", "") or "") or "")
        .strip()
        or None
      )
      p.vendor_contact = (
        (
          payload.get(
            "vendor_contact",
            getattr(p, "vendor_contact", "") or "",
          )
          or ""
        )
        .strip()
        or None
      )
      p.category = (
        (payload.get("category", getattr(p, "category", "") or "") or "")
        .strip()
        or None
      )
      p.image_url = new_image_url
    except Exception:
      return jsonify(
        {"error": "quantity, price and threshold must be numeric"}
      ), 400

    db.session.commit()
    return jsonify({"ok": True, "id": p.id, "image_url": p.image_url}), 200

  # ---------- NEW: cook consume endpoint ----------
  @app.post("/api/products/<int:pid>/consume")
  @jwt_required()
  def api_products_consume(pid: int):
    """
    Cook uses some quantity of a product.
    Decreases product.quantity by the given amount.
    """
    claims = get_jwt()
    role = (claims.get("role") or "").lower()

    # If you want managers to also use this, remove this check.
    if role == "manager":
      return jsonify(
        {"error": "Managers should edit quantity from the Edit Product screen."}
      ), 403

    p = Product.query.get(pid)
    if not p:
      return jsonify({"error": "Product not found"}), 404

    data = request.get_json() or {}
    try:
      qty = int(data.get("quantity", 0))
    except Exception:
      return jsonify({"error": "quantity must be an integer"}), 400

    if qty <= 0:
      return jsonify({"error": "Quantity must be > 0"}), 400

    current_qty = p.quantity or 0
    if qty > current_qty:
      return (
        jsonify(
          {
            "error": f"Not enough stock. Current quantity is {current_qty}."
          }
        ),
        400,
      )

    p.quantity = current_qty - qty
    db.session.commit()

    is_low = is_low_stock_product(p)

    return (
      jsonify(
        {
          "id": p.id,
          "quantity": p.quantity,
          "is_low_stock": is_low,
        }
      ),
      200,
    )

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
    """
    Cook creates a stock request.
    - Managers receive a notification for every new request.
    - Cook later receives APPROVED / DENIED notifications only.
    """
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
    db.session.flush()

    managers = User.query.filter_by(role="manager").all()
    requester = User.query.get(uid)
    requester_name = (requester.name or "").strip() if requester else None
    if not requester_name and requester:
      requester_name = requester.username
    if not requester_name:
      requester_name = "Unknown user"

    msg = f"New stock request from {requester_name}: {qty} × {product.name}."

    for m in managers:
      n = Notification(
        user_id=m.id,
        type="REQUEST_CREATED",
        message=msg,
        payload={
          "request_id": sr.id,
          "product_id": product.id,
          "quantity": qty,
        },
      )
      db.session.add(n)

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

    result = []
    for r in rows:
      requester = User.query.get(r.requested_by) if r.requested_by else None
      if requester:
        display_name = (requester.name or "").strip() or requester.username
      else:
        display_name = None

      result.append(
        {
          "id": r.id,
          "product_id": r.product_id,
          "product_name": r.product.name if r.product else None,
          "requested_qty": r.quantity,
          "status": r.status,
          "created_at": to_eastern_iso(r.created_at),
          "requested_by_name": display_name,
        }
      )

    return jsonify(result), 200

  @app.put("/api/requests/<int:rid>")
  @jwt_required()
  def api_request_update(rid: int):
    """
    Cook can edit their own PENDING request: change product and/or quantity.
    """
    claims = get_jwt()
    uid = claims.get("id")
    role = (claims.get("role") or "").lower()

    r = StockRequest.query.get(rid)
    if not r:
      return jsonify({"error": "Request not found"}), 404

    if r.requested_by != uid or role == "manager":
      return jsonify({"error": "You can only edit your own pending requests"}), 403
    if r.status != "Pending":
      return jsonify({"error": "Only pending requests can be edited"}), 400

    data = request.get_json() or {}
    try:
      new_product_id = int(data.get("product_id", r.product_id))
      new_qty = int(data.get("quantity", r.quantity))
    except Exception:
      return jsonify({"error": "product_id and quantity must be integers"}), 400

    if new_qty <= 0:
      return jsonify({"error": "Quantity must be > 0"}), 400

    product = Product.query.get(new_product_id)
    if not product:
      return jsonify({"error": "Product not found"}), 404

    r.product_id = new_product_id
    r.quantity = new_qty
    db.session.commit()

    return (
      jsonify(
        {
          "ok": True,
          "id": r.id,
          "product_id": r.product_id,
          "requested_qty": r.quantity,
          "status": r.status,
        }
      ),
      200,
    )

  @app.delete("/api/requests/<int:rid>")
  @jwt_required()
  def api_request_delete(rid: int):
    """
    Cook can delete their own PENDING request.
    """
    claims = get_jwt()
    uid = claims.get("id")
    role = (claims.get("role") or "").lower()

    r = StockRequest.query.get(rid)
    if not r:
      return jsonify({"error": "Request not found"}), 404

    if r.requested_by != uid or role == "manager":
      return jsonify({"error": "You can only delete your own pending requests"}), 403
    if r.status != "Pending":
      return jsonify({"error": "Only pending requests can be deleted"}), 400

    db.session.delete(r)
    db.session.commit()
    return jsonify({"ok": True, "id": rid}), 200

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

    msg = f"Request approved: {r.quantity} × {product.name}."
    n = Notification(
      user_id=r.requested_by,
      type="REQUEST_APPROVED",
      message=msg,
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

    msg = f"Request denied: {r.quantity} × {pname}."
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

    # Managers trigger low-stock scan when they check notifications
    if role == "manager":
      run_low_stock_scan()

    all_items = (
      Notification.query.filter_by(user_id=uid)
      .order_by(Notification.created_at.desc())
      .all()
    )

    # Extra dedupe guard for LOW_STOCK (should be unnecessary but safe)
    seen_low_stock = set()
    filtered_items = []

    for n in all_items:
      if n.type == "LOW_STOCK":
        product_id = None
        if isinstance(n.payload, dict):
          product_id = n.payload.get("product_id")

        if product_id is not None:
          key = ("LOW_STOCK", product_id)
        else:
          key = ("LOW_STOCK", (n.message or "").split(" has only")[0])

        if key in seen_low_stock:
          continue

        seen_low_stock.add(key)

      filtered_items.append(n)

    return (
      jsonify(
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
      ),
      200,
    )

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

  # ---------- Reports ----------
  @app.get("/api/reports/summary")
  @jwt_required()
  def api_reports_summary():
    claims = get_jwt()
    role = (claims.get("role") or "").lower()
    if role != "manager":
      return jsonify({"error": "Only manager can view reports"}), 403

    total_products = Product.query.count()
    low_stock_count = sum(
      1 for p in Product.query.all() if is_low_stock_product(p)
    )

    inventory_value = (
      db.session.query(
        db.func.coalesce(db.func.sum(Product.quantity * Product.price), 0)
      ).scalar()
      or 0
    )

    return (
      jsonify(
        {
          "total_products": total_products,
          "low_stock_count": low_stock_count,
          "inventory_value": float(inventory_value),
        }
      ),
      200,
    )

  @app.get("/api/reports/usage")
  @jwt_required()
  def api_reports_usage():
    """
    Usage / top requested items based on approved stock requests.

    Query param:
      ?range=weekly  (last 7 days)
      ?range=monthly (last 30 days)
    """
    claims = get_jwt()
    role = (claims.get("role") or "").lower()
    if role != "manager":
      return jsonify({"error": "Only manager can view reports"}), 403

    range_param = (request.args.get("range") or "weekly").lower()
    days = 7 if range_param == "weekly" else 30

    now_utc = datetime.now(timezone.utc)
    cutoff = now_utc - timedelta(days=days)

    q = (
      db.session.query(
        Product.id.label("product_id"),
        Product.name.label("product_name"),
        db.func.sum(StockRequest.quantity).label("total_requested"),
        db.func.coalesce(
          db.func.sum(StockRequest.quantity * Product.price), 0
        ).label("total_cost"),
      )
      .join(Product, StockRequest.product_id == Product.id)
      .filter(StockRequest.status == "Approved")
      .filter(StockRequest.created_at >= cutoff)
      .group_by(Product.id, Product.name)
      .order_by(db.func.sum(StockRequest.quantity).desc())
    )

    rows = q.all()
    data = [
      {
        "product_id": r.product_id,
        "product_name": r.product_name,
        "total_requested": int(r.total_requested or 0),
        "total_cost": float(r.total_cost or 0),
      }
      for r in rows
    ]

    return jsonify({"range": range_param, "items": data}), 200

  @app.get("/api/reports/cost-analysis")
  @jwt_required()
  def api_reports_cost_analysis():
    """
    Cost analysis for line chart + category breakdown.
    """
    claims = get_jwt()
    role = (claims.get("role") or "").lower()
    if role != "manager":
      return jsonify({"error": "Only manager can view reports"}), 403

    range_param = (request.args.get("range") or "weekly").lower()
    days = 7 if range_param == "weekly" else 30

    now_utc = datetime.now(timezone.utc)
    cutoff = now_utc - timedelta(days=days)

    day_expr = db.func.date(StockRequest.created_at)

    q_line = (
      db.session.query(
        day_expr.label("day"),
        db.func.coalesce(
          db.func.sum(StockRequest.quantity * Product.price), 0
        ).label("total_cost"),
      )
      .join(Product, StockRequest.product_id == Product.id)
      .filter(StockRequest.status == "Approved")
      .filter(StockRequest.created_at >= cutoff)
      .group_by(day_expr)
      .order_by(day_expr)
    )

    line_rows = q_line.all()
    points = []
    for r in line_rows:
      day = r.day
      if hasattr(day, "strftime"):
        label = day.strftime("%m/%d")
      else:
        label = str(day)
      points.append(
        {
          "label": label,
          "total_cost": float(r.total_cost or 0),
        }
      )

    q_breakdown = (
      db.session.query(
        Product.category.label("category"),
        db.func.coalesce(
          db.func.sum(StockRequest.quantity * Product.price), 0
        ).label("total_cost"),
      )
      .join(Product, StockRequest.product_id == Product.id)
      .filter(StockRequest.status == "Approved")
      .filter(StockRequest.created_at >= cutoff)
      .group_by(Product.category)
      .order_by(db.func.sum(StockRequest.quantity * Product.price).desc())
    )

    breakdown_rows = q_breakdown.all()
    breakdown = [
      {
        "category": r.category,
        "total_cost": float(r.total_cost or 0),
      }
      for r in breakdown_rows
    ]

    return (
      jsonify(
        {
          "range": range_param,
          "points": points,
          "breakdown": breakdown,
        }
      ),
      200,
    )

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
        m = User(
          username="manager",
          name="Default Manager",
          role="manager",
          email="manager@example.com",
        )
        m.set_password("Manager123!")
        db.session.add(m)
        created = True

      if not User.query.filter_by(username="cook").first():
        c = User(
          username="cook",
          name="Default Cook",
          role="cook",
          email="cook@example.com",
        )
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
  port = int(os.environ.get("PORT", 5001))
  app.run(host="0.0.0.0", port=port, debug=True)
