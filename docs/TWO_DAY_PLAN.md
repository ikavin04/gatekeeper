# Two-day execution plan

This plan is for verifying and completing the starter project, not a guarantee that all production hardening or AWS deployment can be finished in two days.

## Day 1 — Run, understand and test

- Install Docker Desktop/Engine and start the project with `docker compose up --build`.
- Check `http://localhost:5000/api/health` and `http://localhost:5173`.
- Register a regular user, submit a sample access request, and confirm that user cannot approve it.
- Create a separate admin account using the README instructions, then approve/reject a request and inspect audit events.
- Run the backend test suite; resolve any failing tests.
- Build the frontend with `npm install` and `npm run build`.
- Read each model, route, auth guard and test; write your own notes explaining why each exists.

## Day 2 — Harden, document and present

- Test malformed input, duplicate registration, incorrect password, expired/invalid token, non-admin access, repeated decision and long input values.
- Review token storage and secret configuration. Change all local secrets. Do not publish secrets or real personal data.
- Add or fix tests for any bugs found; rerun the full suite from a clean checkout.
- Add a short demo GIF or screenshots, an architecture diagram and an API examples section.
- If using AWS, configure a real environment, managed secrets, HTTPS, restricted DB networking, logs, backups and a deployment procedure. Deploy and smoke-test it before claiming it is deployed.
- Update `PROJECT_STATUS.md` and the CV/cover letter only to reflect verified work.

## Evidence to save

- Test output from the environment where it was actually run.
- Successful frontend production-build output.
- Redacted Docker Compose health checks and screenshots.
- A real deployment URL only after it works; never put credentials in the repository or screenshots.
