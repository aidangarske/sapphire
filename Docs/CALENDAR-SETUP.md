# Google Calendar setup

Sapphire reads your Google Calendar through your own Google OAuth **Desktop**
client. This is a one-time setup (~5 min). Nothing is shared; tokens stay on
your machine.

> If you have a **personal** calendar, you can skip all of this and paste its
> "Secret address in iCal format" into Settings → Google Calendar instead.
> Most **Workspace** accounts disable that secret URL, which is why the OAuth
> path below exists.

## 1. Create the OAuth client (Google Cloud Console)

1. Go to <https://console.cloud.google.com> and create or select a project.
2. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
3. **APIs & Services → OAuth consent screen / Google Auth Platform** → **Get
   started**:
   - App name: `Sapphire`, pick a support email.
   - Audience: **Internal** if your org offers it (no verification needed),
     otherwise **External**.
   - Finish and create.
4. If you chose **External**: open **Audience → Test users → Add users** and add
   the email you'll sign in with (your work address).
5. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   Application type **Desktop app** → **Create**.
6. Copy the **Client ID** and **Client secret**.

## 2. Connect in Sapphire

1. **Cmd+5 → Settings → Google Calendar** → paste the **Client ID** and
   **Client secret** → **Save**.
2. **Cmd+4 (Calendar) → Sign in with Google** → the browser opens → choose the
   account whose calendar you want → allow **Calendar (read-only)**.
3. Events load. The token refreshes automatically; you won't sign in again.

## Notes

- Loopback redirect on a random localhost port is used, so there's no redirect
  URI to register (that's why the client must be type **Desktop app**).
- "External" + "Testing" apps show an *"unverified app"* warning. Click
  **Advanced, then Continue**. That's expected for an internal tool.
- If you see **"Access blocked"** when choosing your work account, your
  Workspace admin restricts third-party apps and will need to allow it.
- Scope requested: `calendar.readonly` (plus `openid email`). Read-only.
