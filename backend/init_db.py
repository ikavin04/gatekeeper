"""Initialise tables for the local demo. Use migrations for production systems."""
from app import create_app, db
from app.models import User  # noqa: F401 - model registration

app = create_app()
with app.app_context():
    db.create_all()
    print("Database tables are ready.")
