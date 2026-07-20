# SUSU Collection Portal

Branch-scoped SUSU customer and deposit management for Bawjiase Community Bank. The frontend is React/Vite and the API is Flask. Production deployments use PostgreSQL through `DATABASE_URL`.

## Requirements

- Node.js 20 or newer
- Python 3.12 (the deployed version is pinned in `runtime.txt`)
- PostgreSQL for production

## Local Setup

Install dependencies from the project root:

```powershell
npm install
python -m pip install -r mail-api/requirements.txt
```

Set local backend values in `mail-api/.env` or in the current shell. Never commit real passwords or mail credentials.

```text
PORT=4190
PORTAL_DEFAULT_INITIAL_PASSWORD=local-test-password
PORTAL_CONTROL_PASSWORD=local-portal-control-password
PORTAL_PUBLIC_URL=http://127.0.0.1:5173
ALLOWED_ORIGINS=http://127.0.0.1:5173
```

Start the backend:

```powershell
Set-Location mail-api
python app.py
```

Start the frontend in another terminal:

```powershell
npm run dev
```

The Vite proxy targets `http://127.0.0.1:4190` by default. To use another local backend port, set `VITE_DEV_API_TARGET` before running Vite.

## Checks

Run these before committing:

```powershell
npx eslint src/components src/pages --quiet
npm run build
python -m pytest mail-api/tests/test_security_hardening.py -q
python -m py_compile mail-api/app.py
```

## Render Deployment

The included `render.yaml` provisions the Flask web service and managed PostgreSQL database. Connect the GitHub repository in Render and apply the Blueprint.

Configure all required secrets in Render:

- `PORTAL_DEFAULT_INITIAL_PASSWORD`
- `PORTAL_CONTROL_PASSWORD`
- `PORTAL_PUBLIC_URL`
- `ALLOWED_ORIGINS`
- `MAIL_SERVER`
- `MAIL_PORT`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `MAIL_DEFAULT_SENDER`
- `SMS_WEBHOOK_URL`
- `SMS_WEBHOOK_API_KEY` when required by the SMS provider

`DATABASE_URL` is supplied by the managed PostgreSQL service in the Blueprint. Do not switch the portal to Live Mode until Portal Control reports PostgreSQL, public URL, portal password, mail, and SMS as ready.

## Production Checklist

1. Export a full Owner backup and store it outside Render.
2. Confirm automatic PostgreSQL backups are enabled and test one restore.
3. Test Owner Admin, Supervisor, and SUSU Agent accounts separately.
4. Confirm Supervisors see only their assigned branches.
5. Confirm Agents cannot add customers or view another Agent's deposits.
6. Import customers using `Account Name`, `Account Number`, and `Branch` columns.
7. Confirm every account number is exactly 13 digits.
8. Record a test deposit and verify duplicate/idempotency protection.
9. Verify Daily, Agent, Branch, Audit, PDF, and Excel exports.
10. Complete the 400px mobile pass for login, dashboard, collection, customers, directory, transactions, reports, profile, and Portal Control.
11. Switch from Test Mode to Live Mode only after every production check passes.

For a manual Render release, use **Manual Deploy > Deploy latest commit** after pushing to GitHub.
