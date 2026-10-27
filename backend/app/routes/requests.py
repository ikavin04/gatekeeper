"""Access-request endpoints."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from .. import db
from ..audit import record_event
from ..models import AccessRequest, User

requests_bp = Blueprint("requests", __name__)


@requests_bp.get("")
@jwt_required()
def list_requests():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return jsonify(error="User account not found."), 404
    query = AccessRequest.query.order_by(AccessRequest.created_at.desc())
    if user.role != "admin":
        query = query.filter_by(requester_id=user.id)
    return jsonify(requests=[item.to_dict() for item in query.limit(200).all()])


@requests_bp.post("")
@jwt_required()
def create_request():
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return jsonify(error="User account not found."), 404
    data = request.get_json(silent=True) or {}
    system_name = str(data.get("system_name", "")).strip()
    reason = str(data.get("reason", "")).strip()
    duration_days = data.get("duration_days")
    if not system_name or len(system_name) > 100:
        return jsonify(error="System name is required and must be at most 100 characters."), 400
    if not reason or len(reason) > 1000:
        return jsonify(error="Reason is required and must be at most 1000 characters."), 400
    if isinstance(duration_days, bool) or not isinstance(duration_days, int) or not 1 <= duration_days <= 90:
        return jsonify(error="Duration must be a whole number between 1 and 90 days."), 400
    item = AccessRequest(requester_id=user.id, system_name=system_name, reason=reason, duration_days=duration_days)
    db.session.add(item)
    db.session.flush()
    record_event(user.id, "access_request.created", "access_request", item.id, f"system={system_name}; duration_days={duration_days}")
    db.session.commit()
    return jsonify(access_request=item.to_dict()), 201
