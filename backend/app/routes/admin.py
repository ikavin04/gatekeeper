"""Admin-only decisions and audit log endpoints."""
from functools import wraps
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from .. import db
from ..audit import record_event
from ..models import AccessRequest, AuditEvent, User

admin_bp = Blueprint("admin", __name__)


def admin_required(fn):
    @wraps(fn)
    @jwt_required()
    def wrapped(*args, **kwargs):
        user = db.session.get(User, int(get_jwt_identity()))
        if user is None or user.role != "admin":
            return jsonify(error="Administrator privileges are required."), 403
        return fn(*args, **kwargs)
    return wrapped


@admin_bp.post("/requests/<int:request_id>/decision")
@admin_required
def decide_request(request_id):
    user = db.session.get(User, int(get_jwt_identity()))
    item = db.session.get(AccessRequest, request_id)
    if item is None:
        return jsonify(error="Access request not found."), 404
    if item.status != "pending":
        return jsonify(error="Only pending requests can be decided."), 409
    data = request.get_json(silent=True) or {}
    decision = data.get("decision")
    note = str(data.get("note", "")).strip()
    if decision not in ("approved", "rejected"):
        return jsonify(error="Decision must be approved or rejected."), 400
    if len(note) > 500:
        return jsonify(error="Decision note must be at most 500 characters."), 400
    item.status = decision
    item.decided_by = user.id
    item.decision_note = note or None
    record_event(user.id, f"access_request.{decision}", "access_request", item.id, note)
    db.session.commit()
    return jsonify(access_request=item.to_dict())


@admin_bp.get("/audit-events")
@admin_required
def audit_events():
    events = AuditEvent.query.order_by(AuditEvent.created_at.desc()).limit(200).all()
    return jsonify(events=[event.to_dict() for event in events])
