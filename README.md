# Base44 Project

Use this repository to run and edit the app locally, then publish changes back through Base44.

Any change pushed to the repo will also be reflected in the Base44 Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the Base44 CLI: `npm install -g base44@latest`.

See the [Base44 CLI docs](https://docs.base44.com/developers/references/cli/get-started/overview) if you want to run Base44 commands directly.

## Run Locally

Run the full local development environment from the project root:

```bash
base44 dev
```

`base44 dev` starts the local Base44 development backend and, when this app is configured for it, also starts the frontend dev server for you. Use the frontend URL printed by the command.

For example, when the Base44 project config includes a `serveCommand`, `base44 dev` can launch the frontend too:

```json5
{
  "site": {
    "serveCommand": "npm run dev"
  }
}
```

In a Base44 project this lives in `base44/config.jsonc`.

## Run Only The Frontend

If you only want to work on the frontend against the hosted Base44 backend, run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## Use The Hosted Backend

For frontend-only development, create or update `.env.local` in the project root:

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

`VITE_BASE44_APP_ID` identifies the Base44 app.

`VITE_BASE44_APP_BASE_URL` tells the Base44 Vite plugin where to send local `/api` requests. Point it at your deployed Base44 app URL when you want the local frontend to use the hosted backend.

When you use `base44 dev`, the command injects the local Base44 values for you, so `.env.local` is mainly needed for frontend-only workflows.

## Publish Your Changes

After pushing your changes to git, open the Base44 dashboard and publish the app:

```bash
base44 dashboard open
```

## SUSU Portal Production Readiness

Before using the portal for real deposits:

1. Export a full backup from **Portal Control**.
2. Set `DATABASE_URL` to a managed PostgreSQL database. When present, portal stores are kept in the `portal_store` table and critical financial writes use a PostgreSQL advisory lock across workers.
3. Set `PORTAL_PUBLIC_URL` to the exact deployed HTTPS site URL. Password reset links are always generated from this trusted URL.
4. Set `PORTAL_CONTROL_PASSWORD` as a private backend environment variable. Portal Control, backup restore, and Live Mode changes depend on it.
5. Configure `MAIL_SERVER`, `MAIL_USERNAME`, `MAIL_PASSWORD`, and `MAIL_DEFAULT_SENDER` for verification/reset email.
6. Configure `SMS_WEBHOOK_URL` and optional `SMS_WEBHOOK_API_KEY` before Live Mode so agent setup tokens are delivered by SMS instead of displayed for testing.
7. Export and store backups outside the app host. For production, schedule daily PostgreSQL backups in Render/cPanel and test restoring one backup before launch.
8. Test these accounts separately: Owner Admin, Supervisor, and SUSU AGENT.
9. Test customer import with CSV/XLSX columns: `Account Name`, `Account Number`, `Branch`.
10. Confirm every customer account number is exactly 13 digits.
11. Confirm SUSU AGENT users can record deposits only by exact account number search and cannot add customers.
12. Confirm supervisors can see and manage only their branch agents/customers.
13. Switch **Test Mode** to **Live Mode** only after Portal Control production checks pass.

For Render deploys, push to GitHub and use **Manual Deploy -> Deploy latest commit** if automatic deploy does not start. The included `render.yaml` provisions a paid starter web service and a managed PostgreSQL database; review costs before applying it.

## Docs & Support

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Base44 CLI command reference: [https://docs.base44.com/developers/references/cli/commands/introduction](https://docs.base44.com/developers/references/cli/commands/introduction)

Support: [https://app.base44.com/support](https://app.base44.com/support)
