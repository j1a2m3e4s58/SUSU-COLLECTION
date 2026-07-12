# Render Deployment

This project should be deployed on Render as a single Python web service for the first test deployment. The service builds the Vite frontend into `mail-api/public`, then Flask serves both the frontend and `/api/*` backend from the same HTTPS domain.

## Deploy From Blueprint

1. Push the latest code to GitHub.
2. Open Render Dashboard.
3. Click **New +**.
4. Choose **Blueprint**.
5. Connect `https://github.com/j1a2m3e4s58/SUSU-COLLECTION`.
6. Select branch `main`.
7. Render will read `render.yaml`.
8. Create the service.

## Required Values During Creation

Render will ask for the `sync: false` environment variables.

Use these for testing:

```txt
PORTAL_PUBLIC_URL=https://YOUR-RENDER-SERVICE.onrender.com
ALLOWED_ORIGINS=https://YOUR-RENDER-SERVICE.onrender.com
PORTAL_DEFAULT_INITIAL_PASSWORD=Choose-A-Temporary-Test-Password
```

Email variables can be filled now if you want real registration/reset emails:

```txt
MAIL_SERVER=mail.bawjiasecommunitybank.com
MAIL_PORT=465
MAIL_USERNAME=noreply@bawjiasecommunitybank.com
MAIL_PASSWORD=your-real-mail-password
MAIL_DEFAULT_SENDER=noreply@bawjiasecommunitybank.com
```

If you do not fill the email variables, registration and password reset email delivery will not work correctly.

## Important Data Note

This Render setup is for testing. It uses JSON files inside the Render service filesystem. On free Render services, this is not the right permanent database for real banking records. Before serious testing and before moving to cPanel, use **Portal Control > Export Backup**.

## Install As App On Phone

After Render deploys with HTTPS:

1. Open the Render URL on Android Chrome or Edge.
2. Open the browser menu.
3. Press **Install app** or **Add to Home screen**.

The app includes `manifest.json` and `sw.js`, so it is installable once hosted over HTTPS.
