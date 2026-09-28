# TBS Dossier Builder – deployment package

AI-powered TBS food-supplement dossier builder. Upload documents, and the app reads, classifies, validates and packages them into a TBS dossier: DOCX form, folder structure, PENDING.txt files, reports and a final ZIP.

## What is in this folder

| File | Purpose |
|---|---|
| `index.html` | The complete web app (front end). Libraries load from cdnjs / jsDelivr. |
| `api/claude.js` | Vercel serverless function that calls the Anthropic API. Your API key stays on the server. |
| `vercel.json` | Function timeout (300 s) and security headers. |
| `.env.example` | Environment variables to set in Vercel. |

There is no build step and there are no npm dependencies.

## Deploy on Vercel – option A: dashboard (no command line)

1. Put this folder in a GitHub repository (upload the files through the GitHub web page if you like).
2. In Vercel, click **Add New → Project → Import** and choose the repository. Framework preset: **Other**. Leave the build settings empty.
3. Open **Environment Variables** and add:
   - `ANTHROPIC_API_KEY` – your key from console.anthropic.com (required)
   - `APP_PASSWORD` – a password users must enter before the AI runs (strongly recommended, because the site URL is public)
4. Click **Deploy**.

## Deploy on Vercel – option B: Windows PowerShell

```powershell
npm install -g vercel
cd tbs-dossier-builder
vercel login
vercel                      # first deploy, creates the project (answer the prompts)
vercel env add ANTHROPIC_API_KEY production
vercel env add APP_PASSWORD production
vercel --prod               # redeploy with the variables
```

To test on your own PC before deploying: `vercel dev`, then open http://localhost:3000. Put the variables in a `.env.local` file (copied from `.env.example`).

## Check that it works

- Open `https://<your-project>.vercel.app/api/claude`. You should see `"keyConfigured": true`.
- Open the site, create a dossier, upload files and click **Analyze documents**. On the first AI request you are asked for the app password; it is remembered in that browser. To change it, go to **Settings → Change app password**.

## Settings you may need

- **Timeout.** `vercel.json` sets `maxDuration` to 300 seconds, which needs Fluid compute (on by default for new Vercel projects). If a deploy fails with a duration error, change it to `60`. With 60 s, long documents such as a 30-page SMF may time out; if that happens, choose the **Quick** model or reduce **page images per document** in the app's Settings.
- **Request size.** Vercel accepts up to 4.5 MB per request. The app shrinks page images automatically and drops extra images if a request would be larger.
- **Models.** The defaults are `claude-haiku-4-5-20251001` (Quick), `claude-sonnet-5` (Balanced) and `claude-opus-5-5` (Most capable). Override them with `MODEL_QUICK`, `MODEL_DEFAULT` and `MODEL_COMPLEX` if needed.

## Data and security

- Uploaded documents, dossiers, versions and settings are stored **only in the user's browser** (IndexedDB). Nothing is stored on the server.
- Document text and page images pass through `/api/claude` to the Anthropic API only when an analysis runs.
- The API key never reaches the browser. `APP_PASSWORD` stops strangers from using your key.
- Not included: user accounts or roles, shared cloud storage, or virus scanning. For multi-user access with logins, the natural next step is to mount it inside the West-Coast AI Hub and use Supabase for auth and storage.
- API usage is billed to the Anthropic account that owns the key.

## Regulatory note

The app prepares and organises dossiers and flags gaps. It never claims regulatory approval; acceptance is decided by TBS.
