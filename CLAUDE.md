# App Atlas — Brief

> **Claude: read this first.** Open only the files a change touches.
> At the end of a work session, update **Status** and add one line to **Changelog** (keep about 5). Keep **For Gary** current too: tick off (delete) what's done, add each step Gary must do himself (deploy, sheet menus, settings, checks).

App Atlas is Gary's tracker for all his personal apps: where each one was left, what's deployed, what's waiting on him, and the chats that changed it. It **never calls Claude** and creates nothing in Claude: an hourly Apps Script check reads GitHub and the Apps Script API, and the app just shows the result. Changes to apps are made in Claude Code chats; **Start a change** copies a ready prompt for one.

Replaces the earlier claude.ai page "App Atlas" (artifact Bzy6VjeagAtC6Afmzhq16r) and its scheduled task, which made sessions and notifications Gary didn't want (2026-11-06).

## Where things live

| Piece | Location |
| --- | --- |
| Live app | https://ourappatlas.pages.dev/ (Cloudflare Pages project `ourappatlas`; appatlas was taken; build output directory `web`) — change `SITE` in `Code.gs` if the project name differs |
| Repo | `Dailuo-source/App-Atlas` (private) |
| Database | Google Sheet **App Atlas** (garyluo.gs@gmail.com, in My AI Apps), id `1PJRxT0VjcPJJ2RTmhR9KxalxgxlXV7v19Rt33uICG_8` |
| Backend | Apps Script **App Atlas** bound to the sheet (script id `1wkhIYBgn25pW58EJhnveHzYfgJ97Eekh0ZSQaSyrvYoJ10qL6_9e9zWm`, in `.clasp.json`): `Code.gs` (API, tabs, menu, setup) + `Check.gs` (the hourly check). `appsscript.json` lists the scopes |
| Connecting | Sheet menu **App Atlas → Show phone link** → `https://ourappatlas.pages.dev/#api=<exec>&key=<key>` (stored on the device as `aa.api`, `aa.key`) |
| Secrets | Script properties `APP_KEY`, `GITHUB_TOKEN` (fine-grained, read-only Contents on Dailuo-source repos), `WEB_APP_URL`, `LAST_CHECK` |

## Where the information comes from (each app's repo)

- **CLAUDE.md** `## Status` → "Where you left off" (undated lines first, then dated lines newest first). `## For Gary` (`- [ ] step`) → that app's to-dos. `## Changelog` (`- YYYY-MM-DD: text`) → History. Every app's brief has these three sections; keeping them current is part of every session's wrap-up.
- `web/sw.js` `CACHE` → site version.
- Commits (last 100) → last change; `Claude-Session: https://claude.ai/…` trailers → "Chats that changed it". Housekeeping commits (`Brief: For Gary checklist…`, merges) are skipped.
- Branches other than main → "not merged" rows with a Cloudflare preview link (`https://<branch>.<pagesProject>.pages.dev/`).
- **Backend deploy status** (Apps Script API, Gary's own token): the web app deployment with the highest version is "live". Its code (`content?versionNumber=N`) and the editor's saved code (`content`) are compared with the repo files in the Apps tab's `backendFiles` (`path=name; …`, default `Code.gs=Code`). States: `match`, `saved` (editor = GitHub, no new version yet), `behind` (GitHub newer), `noaccess` (another account's script, e.g. Flip Friend/Flip Folio on the business account), `apioff` (Gary must switch on the Apps Script API at script.google.com/home/usersettings), `nodeploy`, `error`. `behind`/`saved` add an automatic "deploy" to-do unless an open to-do already mentions deploy.

## Sheet tabs (matched by header name)

- **Apps**: id, name, repo (`owner/name`), site, pagesProject, scriptId, backendFiles, order, hidden. Seeded by `setup` for the 11 apps. Add a row for a new app (and its icon at `web/icons/<id>.png`).
- **Snapshot**: id, checkedAt, json (the whole check result per app, ≤49k chars).
- **Todos**: id, app, text, done, doneAt, source (`brief` = tick on a For Gary line, matched by normalised text; `you` = Gary's own), added.
- **Notes**: app, note, updatedAt ("Your note" on the app page).

## API (POST, `Content-Type: text/plain`, body `{action, key, …}`)

`state` · `check {app?}` (runs the check now, all apps or one) · `tick {app, text, done, source}` · `addTodo {app, text}` · `delTodo {id}` · `note {app, note}`. Every action returns the full state.

## App (`web/index.html`, one file)

- Phone: Home (counts, **Needs you** across all apps, apps sorted by last change) → app page (Where you left off + Your note, Deploy status, To-dos, Chats that changed it, History) with **Start a change in Claude** fixed at the bottom. Desktop ≥1000px: list on the left, app page fills the rest, **no max-width**.
- Start a change: a sheet with "What do you want to change?" (draft saved per app in `localStorage aa.draft.<id>`), two include switches, the prompt preview, **Copy prompt**, links to Claude Code and Claude.
- Android back: the app page and the sheet are history entries, so back steps up a level.
- Never redraws a box while it has focus; notes save 0.9 s after typing and on leaving the box. Dark only, Fredoka + Nunito, tap feedback on every button, ≥44px targets, no auto-focus. Bump `CACHE` in `web/sw.js` on every front-end change.

## Changing things

- Front end: edit `web/`, bump `CACHE`, commit and push `main`.
- Backend: paste `Code.gs`, `Check.gs`, `appsscript.json` into the sheet's Apps Script project (or `clasp push` once a `.clasp.json` exists), then Deploy → Manage deployments → pencil → New version.
- Tests: `node test/check.test.js` (parsing, against the local clones listed in `/home/claude/atlas-sync/roots.json`); `node test/server.js` runs Code.gs + Check.gs in memory with a fake Apps Script API and serves `web/`; `python3 test/ui.py /tmp/aa` clicks through phone and desktop.
- Commits use author `Claude <noreply@anthropic.com>`.

## Status

- 2026-11-06: Built and tested against all 11 real repos with a fake Apps Script API; not set up yet (needs the repo, sheet, token, deployment and Cloudflare project; see SETUP.md). Not yet proven: that the Apps Script API answers from inside Apps Script with the default Cloud project.

## For Gary

- [ ] Create the empty private repo Dailuo-source/App-Atlas so Claude can push this code
- [ ] Follow SETUP.md (sheet, GitHub token, Apps Script API switch, deploy, Cloudflare Pages, phone link)

## Changelog (latest first, keep about 5 lines)

- 2026-11-06: First build: hourly GitHub + Apps Script deploy check, Needs you, app page, Start a change prompt, phone + desktop
