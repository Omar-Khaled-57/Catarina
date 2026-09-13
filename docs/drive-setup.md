# Google Drive storage setup (The Drawers)

The Drawers can back every section with a real Google Drive folder tree.
This is optional — without the variables below the page stays a fully
functional in-browser demo.

## How it works

- Each signed-in user connects their **own** Google account (free tier:
  15 GB per person). Scopes requested: `openid email` (identity) and
  `https://www.googleapis.com/auth/drive` (full access to that user's Drive —
  required because `drive.file` scopes break cross-user sharing).
- The first person to connect provisions a root folder named **“Catarina”**
  and shares it (`writer`) with every teammate who later connects.
- Inside it, one folder per section (`ART`, `TECHNICAL`, `MANAGEMENT`, …)
  holds the drawers: drawer → folder, envelope → folder, item → file.
- Item type/link metadata travels in the Drive `description` field.
- Deletes move files to the Drive trash (recoverable).

## 1. Google Cloud Console

1. Create/select a project at https://console.cloud.google.com/.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → set up an app
   (test mode is fine during development; add your Google account as a test user).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   type **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000` (dev) and your
     production origin.
   - Authorized redirect URI: `http://localhost:3000/api/drive/callback`
     and `https://<your-domain>/api/drive/callback`.
5. Copy the client ID and client secret.

## 2. Environment variables

```bash
GOOGLE_CLIENT_ID="....apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="...."
GOOGLE_REDIRECT_URI="http://localhost:3000/api/drive/callback"
DRIVE_TOKEN_KEY="any_long_random_string"   # encrypts OAuth tokens at rest
# Optional: pre-create a root folder and seed its id to skip auto-provisioning:
DRIVE_ROOT_FOLDER_ID="<folder id>"
```

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must be present for the drawers
page to offer connection (that is the `driveEnabled` flag).

## 3. Database migration

Run the pending migration to create the `DriveConnection` and `AppConfig`
tables:

```bash
npx prisma migrate deploy
```

## 4. Test flow

1. `/tools/drawers` → **Connect Google Drive**.
2. Grant access; you're redirected back with `?drive=connected`.
3. The shared **Catarina** root and section folders are created for you.
4. Open a chest → add drawers/envelopes/files; confirm they appear in Drive.

## Troubleshooting

- **401 on refresh** — the access token was revoked; reconnect (the refresh
  token is only stored the first time). If reconnecting doesn't help,
  `POST /api/drive/disconnect` first.
- **Items not shared with teammates** — the root folder share runs only when
  a new teammate connects. Each user sees the same shared folder via their
  own connection.
- **`DRIVE_TOKEN_KEY` change** — all stored tokens become undecryptable;
  every user must reconnect.