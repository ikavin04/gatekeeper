"""Small helper to record security-relevant events."""
from . import db
from .models import AuditEvent


def record_event(actor_id, action, object_type, object_id=None, details=""):
    db.session.add(AuditEvent(
        actor_id=actor_id,
        action=action,
        object_type=object_type,
        object_id=str(object_id) if object_id is not None else None,
        details=details[:1000],
    ))
