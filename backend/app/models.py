"""Database models for users, access requests and audit events."""
from datetime import datetime, timezone
from . import db


def utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(254), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(16), nullable=False, default="user")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    def to_dict(self):
        return {"id": self.id, "email": self.email, "role": self.role, "created_at": self.created_at.isoformat()}


class AccessRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    system_name = db.Column(db.String(100), nullable=False)
    reason = db.Column(db.String(1000), nullable=False)
    duration_days = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(16), nullable=False, default="pending", index=True)
    decided_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    decision_note = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    requester = db.relationship("User", foreign_keys=[requester_id])
    decider = db.relationship("User", foreign_keys=[decided_by])

    def to_dict(self):
        return {
            "id": self.id,
            "requester_email": self.requester.email if self.requester else None,
            "system_name": self.system_name,
            "reason": self.reason,
            "duration_days": self.duration_days,
            "status": self.status,
            "decision_note": self.decision_note,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class AuditEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    action = db.Column(db.String(80), nullable=False, index=True)
    object_type = db.Column(db.String(80), nullable=False)
    object_id = db.Column(db.String(80), nullable=True)
    details = db.Column(db.String(1000), nullable=False, default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, index=True)
    actor = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "actor_email": self.actor.email if self.actor else None,
            "action": self.action,
            "object_type": self.object_type,
            "object_id": self.object_id,
            "details": self.details,
            "created_at": self.created_at.isoformat(),
        }
