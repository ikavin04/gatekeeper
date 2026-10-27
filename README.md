# Gatekeeper — Access Request & Audit Hub

**Status: portfolio MVP / in progress.** This repository contains a local full-stack prototype. Do not describe it as production-ready or AWS-deployed until you have run the tests, reviewed the security choices, deployed it, and verified the live system.

Gatekeeper demonstrates a small internal access-governance workflow: users request temporary access to a system, authorised administrators approve or reject requests, and security-relevant actions are recorded in an audit log.

## Why this project

This project is designed to demonstrate full-stack development, API validation, authentication, role-based authorisation, database integration, testing, containers, CI and a path to cloud deployment. It is an educational portfolio project, not a production identity-management system.

## Tech stack

- Frontend: React + TypeScript + Vite
- Backend: Python + Flask REST API
- Data store: PostgreSQL in Docker Compose; SQLite can be used for tests
- Authentication: signed JWT access tokens; passwords hashed using Werkzeug's scrypt implementation
- Tests: pytest
- Containers: Docker and Docker Compose
- CI: GitHub Actions (backend tests and frontend build)

## Features

- Public registration creates only regular users; the client cannot assign itself the admin role.
- Login returns a short-lived JWT access token.
- Authenticated users can request access for 1–90 days and can view their own requests.
- Administrators can view all requests, approve/reject pending requests and read the audit feed.
- The API validates fields and request sizes, uses parameterised ORM queries and returns consistent JSON errors for common validation failures.
- Security-relevant account, request and decision events are written to an audit table.
- API responses include basic security headers; CORS is restricted to the local frontend origin by default.

## Run locally with Docker

Prerequisites: Docker Desktop / Docker Engine with Compose.

1. Copy `.env.example` to `.env` and replace both values with long random local secrets.
2. Run:

   ```bash
   docker compose up --build
   ```

3. Open the frontend at `http://localhost:5173`.
4. The API health check is at `http://localhost:5000/api/health`.
5. Create a normal account in the UI.
6. To create an administrator in a separate terminal, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the backend container environment and run `python create_admin.py`. Example for a local container (substitute your chosen values; don't reuse these examples as real credentials):

   ```bash
   docker compose exec backend sh
   export ADMIN_EMAIL='admin@example.test'
   export ADMIN_PASSWORD='replace-with-a-long-unique-password'
   python create_admin.py
   ```

7. Sign in using that admin account to review requests and inspect audit events.

`docker compose down` stops the services. `docker compose down -v` also deletes the local database volume.

## Run backend tests locally

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pytest -q
```

The tests cover health checks, headers, registration role restrictions, password validation, request creation, invalid fields, admin-only decisions and audit events. They use an isolated SQLite test database.

## API overview

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Create regular user account |
| POST | `/api/auth/login` | Public | Authenticate and obtain a JWT |
| GET | `/api/auth/me` | Authenticated | Return current account |
| GET | `/api/requests` | Authenticated | List own requests; admins can list all |
| POST | `/api/requests` | Authenticated | Create an access request |
| POST | `/api/admin/requests/{id}/decision` | Admin only | Approve or reject a pending request |
| GET | `/api/admin/audit-events` | Admin only | Read the latest audit events |

Pass the access token in `Authorization: Bearer <token>`.

## Security design and limitations

This is a learning MVP. Before production use, it requires a stronger deployment posture and review, including:

- Use a managed secret store and strong per-environment secrets; the default secret is for local development only.
- Use HTTPS, secure deployment CORS settings, rate limiting, account recovery and email verification.
- Consider refresh-token/session strategy, secure cookie/CSRF design and appropriate client-side token storage. The demo keeps its token in `sessionStorage`, which is exposed to JavaScript running in the page.
- Replace `db.create_all()` initialisation with versioned database migrations, configure database backups and operational monitoring.
- Make audit records append-only at the database/permissions layer and define retention, privacy and incident-response policies.
- Add concurrency tests for simultaneous decisions, stronger input schemas, dependency scanning and threat modelling.
- Configure an explicit deployment platform and test all cloud settings. No cloud deployment is included or claimed in this repository.

## Cloud deployment plan (not yet deployed)

A sensible next step is to deploy the frontend and API to AWS and use a managed PostgreSQL database. Before doing so, configure HTTPS, a production JWT secret in a secret manager, restricted network access to the database, environment-specific CORS, logging/monitoring and a migration workflow. Add the actual AWS architecture and live URL here only after deployment and smoke tests are complete.

## Personal contribution note

For an application or interview, accurately state which parts you personally designed, implemented, tested and deployed. Be ready to explain every endpoint, the role guard, password hashing, audit events, test cases, container configuration and trade-offs. Do not claim AWS deployment, user adoption or production readiness unless you have evidence.
