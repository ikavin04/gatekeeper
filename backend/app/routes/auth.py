"""Registration and login endpoints."""
import re
from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from werkzeug.security import check_password_hash, generate_password_hash
from .. import db
from ..audit import record_event
from ..models import User

auth_bp = Blueprint("auth", __name__)
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")
    if not EMAIL_RE.match(email):
        return jsonify(error="Enter a valid email address."), 400
    if not isinstance(password, str) or len(password) < 12:
        return jsonify(error="Password must contain at least 12 characters."), 400
    if User.query.filter_by(email=email).first():
        return jsonify(error="An account with that email already exists."), 409
    # Public registration always creates a regular user; clients cannot self-assign admin.
    user = User(email=email, password_hash=generate_password_hash(password, method="scrypt"), role="user")
    db.session.add(user)
    db.session.flush()
    record_event(user.id, "user.registered", "user", user.id)
    db.session.commit()
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return jsonify(access_token=token, user=user.to_dict()), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")
    user = User.query.filter_by(email=email).first()
    if not user or not isinstance(password, str) or not check_password_hash(user.password_hash, password):
        return jsonify(error="Invalid email or password."), 401
    record_event(user.id, "user.logged_in", "user", user.id)
    db.session.commit()
    token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    return jsonify(access_token=token, user=user.to_dict()), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return jsonify(error="User account not found."), 404
    return jsonify(user=user.to_dict())
