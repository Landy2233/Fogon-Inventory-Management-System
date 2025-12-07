# config.py
import os
from dotenv import load_dotenv, dotenv_values

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

# 1) Load .env explicitly
if os.path.exists(ENV_PATH):
    load_dotenv(dotenv_path=ENV_PATH, override=True)
else:
    print(f"WARNING: .env not found at {ENV_PATH}")

# 2) Fallback: read env manually if needed
if not os.getenv("MYSQL_USER") or not os.getenv("MYSQL_DB"):
    vals = dotenv_values(ENV_PATH) if os.path.exists(ENV_PATH) else {}
    for k, v in vals.items():
        if v is not None and not os.getenv(k):
            os.environ[k] = v


class Config:
    # ----- core secrets -----
    SECRET_KEY = os.getenv("SECRET_KEY", "devkey")

    # ----- database (existing) -----
    MYSQL_USER = os.getenv("MYSQL_USER")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD")
    MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
    MYSQL_PORT = os.getenv("MYSQL_PORT", "3306")
    MYSQL_DB = os.getenv("MYSQL_DB", "fogonims_db")

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}"
        f"@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ----- email (for password reset) -----
    # Configure these in your .env:
    # MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_DEFAULT_SENDER, MAIL_USE_TLS
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USERNAME = os.getenv("MAIL_USERNAME")  # e.g. your Gmail
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")  # e.g. app password
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", MAIL_USERNAME)
