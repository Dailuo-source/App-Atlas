# App Atlas — setup (once)

About 15 minutes. Use garyluo.gs@gmail.com for everything Google.

1. **Sheet and script.** In Drive, folder *My AI Apps*, make a new Google Sheet named **App Atlas**. Extensions → Apps Script. In the editor:
   - Replace `Code.gs` with this repo's `Code.gs`. Add a script file **Check** and paste `Check.gs`.
   - Project Settings → tick *Show "appsscript.json"*, then replace `appsscript.json` with this repo's copy. Save.
2. **Run setup.** Reload the sheet. Menu **App Atlas → Set up / repair sheets**, and allow the permissions it asks for. The Apps tab fills with your 11 apps.
3. **Apps Script API.** Open https://script.google.com/home/usersettings and switch **Google Apps Script API** on.
4. **GitHub token.** GitHub → Settings → Developer settings → Fine-grained tokens → Generate. Resource owner **Dailuo-source**, *All repositories*, Repository permissions → **Contents: Read-only** (Metadata is added automatically). No expiry, or a year. Copy it, then sheet menu **App Atlas → Set GitHub token…** and paste.
5. **Deploy.** In Apps Script: Deploy → New deployment → Web app, Execute as **Me**, Who has access **Anyone**. Copy the /exec link. Sheet menu **App Atlas → Set web app link…** and paste.
6. **First check.** Sheet menu **App Atlas → Check all apps now**. The Snapshot tab fills in. Then **App Atlas → Turn on hourly checks**.
7. **Cloudflare Pages.** Workers & Pages → Create → Pages → connect `Dailuo-source/App-Atlas`, project name **appatlas**, build command empty, **build output directory `web`**. (If that name is taken, pick another and tell Claude so `SITE` in Code.gs matches.)
8. **Phone and PC.** Sheet menu **App Atlas → Show phone link**. Open it on your phone (Chrome → ⋮ → Add to Home screen) and on your PC.

After that, nothing to do: it checks every hour, and opening the app always shows the latest.
