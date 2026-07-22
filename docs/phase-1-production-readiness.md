# Phase 1 Production Readiness

Use this checklist on the Render deployment before switching the portal to Live Mode. Never paste database URLs, passwords, verification codes, or webhook secrets into tickets or source control.

## 1. Deploy And Check Readiness

1. Wait for Render to deploy the latest `main` commit.
2. Open `https://susu-collection-portal.onrender.com/api/health`.
3. Confirm the response has `ok: true`, `storageBackend: "postgres"`, and `database.reachable: true`.
4. In Render, open the web service Events page and confirm the deploy is Live.

## 2. Configure Alerts

Set at least one secret environment variable on the Render web service:

- `MONITORING_ALERT_EMAIL`: an operations mailbox that can receive SMTP mail from the configured portal mail server.
- `MONITORING_ALERT_WEBHOOK_URL`: a private HTTPS endpoint that accepts JSON POST requests.

Set Render workspace or service notifications to at least **Only failure notifications**. Redeploy, then confirm Portal Control shows monitoring as Ready.

Alerts are throttled and never include passwords, verification codes, tokens, account numbers, email addresses, or phone numbers. Each failed API response includes an `X-Request-ID` header for tracing.

## 3. Test The Render Workflow

Keep the portal in Test Mode.

1. Owner: sign in, complete MFA, open Portal Control, export a backup, and load test staff and customers.
2. Owner: create or assign a Supervisor to one test branch.
3. Supervisor: sign in and confirm only the assigned branch is visible.
4. Supervisor: create a test Agent or reset an existing test Agent login.
5. Supervisor: import or add a test customer with a unique 13-digit account number.
6. Agent: sign in, search using the exact account number, and record one deposit.
7. Supervisor: review the Agent transaction and export the selected report to Excel and PDF.
8. Owner: confirm the audit log contains the user, customer, login, deposit, review, and export events.
9. Owner: remove test staff and customers before Live Mode.

## 4. PostgreSQL Integration Test

Create or restore a disposable PostgreSQL database. Set its connection string only in the current terminal, then run:

```powershell
$env:TEST_DATABASE_URL = "postgresql://..."
python -m pytest mail-api/tests/test_security_hardening.py -q
Remove-Item Env:TEST_DATABASE_URL
```

The result must have no skipped PostgreSQL integration test and no failures.

## 5. Backup And Restore Drill

The Blueprint uses a paid Render PostgreSQL instance. In the database Recovery page:

1. Confirm Point-in-Time Recovery is available.
2. Create a logical export and download it to secure storage.
3. Start a point-in-time recovery to a new disposable database from a time before the test deposit.
4. Connect only a temporary test service or local test process to the recovered database.
5. Confirm users and customers exist, and confirm the later test deposit is absent as expected.
6. Run the PostgreSQL integration test against the recovered database.
7. Delete the disposable recovery database after recording the successful drill.

Do not point the production web service at the recovered database during this drill.
