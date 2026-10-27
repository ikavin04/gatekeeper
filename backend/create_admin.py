"""Create an admin account using ADMIN_EMAIL and ADMIN_PASSWORD environment variables."""
import os
from werkzeug.security import generate_password_hash
from app import create_app, db
from app.models import User

email = os.getenv("ADMIN_EMAIL", "").strip().lower()
password = os.getenv("ADMIN_PASSWORD", "")
if not email or not password or len(password) < 12:
    raise SystemExit("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in your environment.")
app = create_app()
with app.app_context():
    db.create_all()
    existing = User.query.filter_by(email=email).first()
    if existing:
        existing.role = "admin"
        existing.password_hash = generate_password_hash(password, method="scrypt")
    else:
        db.session.add(User(email=email, password_hash=generate_password_hash(password, method="scrypt"), role="admin"))
    db.session.commit()
    print(f"Administrator account configured for {email}.")
