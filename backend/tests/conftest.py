import pytest
from app import create_app, db
from app.models import User
from werkzeug.security import generate_password_hash


@pytest.fixture()
def app(tmp_path):
    database = tmp_path / "test.sqlite"
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database}",
        "JWT_SECRET_KEY": "test-secret-key-that-is-long-enough",
        "CORS_ORIGINS": "http://localhost:5173",
    })
    with app.app_context():
        db.create_all()
        db.session.add(User(email="admin@example.com", password_hash=generate_password_hash("AdminPassword123!", method="scrypt"), role="admin"))
        db.session.add(User(email="user@example.com", password_hash=generate_password_hash("UserPassword123!", method="scrypt"), role="user"))
        db.session.commit()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def tokens(client):
    user = client.post("/api/auth/login", json={"email": "user@example.com", "password": "UserPassword123!"}).get_json()["access_token"]
    admin = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "AdminPassword123!"}).get_json()["access_token"]
    return {"user": user, "admin": admin}
