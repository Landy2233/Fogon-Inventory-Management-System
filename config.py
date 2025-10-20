# config.py
import os
from dotenv import load_dotenv, dotenv_values

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, ".env")

# 1) Load .env explicitly (works even if CWD changes)
if os.path.exists(ENV_PATH):
    load_dotenv(dotenv_path=ENV_PATH, override=True)
else:
    print(f"WARNING: .env not found at {ENV_PATH}")

# 2) Fallback: if vars still missing, read file directly and set them
if not os.getenv("MYSQL_USER") or not os.getenv("MYSQL_DB"):
    vals = dotenv_values(ENV_PATH) if os.path.exists(ENV_PATH) else {}
    for k, v in vals.items():
        if v is not None and not os.getenv(k):
            os.environ[k] = v

# Optional: uncomment to debug env loading once
# print("DEBUG MYSQL_USER =", os.getenv("MYSQL_USER"))
# print("DEBUG MYSQL_DB   =", os.getenv("MYSQL_DB"))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "devkey")
    SQLALCHEMY_DATABASE_URI = (
        "mysql+pymysql://"
        f"{os.getenv('MYSQL_USER')}:{os.getenv('MYSQL_PASSWORD')}"
        f"@{os.getenv('MYSQL_HOST','127.0.0.1')}:{os.getenv('MYSQL_PORT','3306')}/"
        f"{os.getenv('MYSQL_DB','fogonims_db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
