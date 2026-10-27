def auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_health_and_security_headers(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json()["status"] == "ok"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_registration_cannot_assign_admin(client):
    response = client.post("/api/auth/register", json={
        "email": "new@example.com", "password": "VeryStrongPassword123!", "role": "admin"
    })
    assert response.status_code == 201
    assert response.get_json()["user"]["role"] == "user"


def test_register_rejects_short_password(client):
    response = client.post("/api/auth/register", json={"email": "new@example.com", "password": "short"})
    assert response.status_code == 400


def test_user_can_create_and_list_own_request(client, tokens):
    created = client.post("/api/requests", headers=auth(tokens["user"]), json={
        "system_name": "GitHub staging", "reason": "Need to review CI logs", "duration_days": 7
    })
    assert created.status_code == 201
    assert created.get_json()["access_request"]["status"] == "pending"
    listed = client.get("/api/requests", headers=auth(tokens["user"]))
    assert listed.status_code == 200
    assert len(listed.get_json()["requests"]) == 1


def test_invalid_request_is_rejected(client, tokens):
    response = client.post("/api/requests", headers=auth(tokens["user"]), json={
        "system_name": "", "reason": "Missing system", "duration_days": 7
    })
    assert response.status_code == 400


def test_non_admin_cannot_approve_request(client, tokens):
    created = client.post("/api/requests", headers=auth(tokens["user"]), json={
        "system_name": "Production logs", "reason": "Investigate incident", "duration_days": 1
    }).get_json()["access_request"]
    response = client.post(f"/api/admin/requests/{created['id']}/decision", headers=auth(tokens["user"]), json={"decision": "approved"})
    assert response.status_code == 403


def test_admin_can_decide_and_audit_is_written(client, tokens):
    created = client.post("/api/requests", headers=auth(tokens["user"]), json={
        "system_name": "Staging dashboard", "reason": "Release validation", "duration_days": 3
    }).get_json()["access_request"]
    response = client.post(f"/api/admin/requests/{created['id']}/decision", headers=auth(tokens["admin"]), json={"decision": "approved", "note": "Approved for release validation"})
    assert response.status_code == 200
    assert response.get_json()["access_request"]["status"] == "approved"
    events = client.get("/api/admin/audit-events", headers=auth(tokens["admin"]))
    assert events.status_code == 200
    assert any(e["action"] == "access_request.approved" for e in events.get_json()["events"])


def test_user_cannot_read_audit_log(client, tokens):
    response = client.get("/api/admin/audit-events", headers=auth(tokens["user"]))
    assert response.status_code == 403
