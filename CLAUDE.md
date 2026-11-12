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
| Cloud project | Google Cloud project **App Atlas** (`app-atlas-514318`, number 329079759782): Apps Script API on, sign-in screen External + **In production** (so the hourly trigger's sign-in doesn't expire every 7 days), home page and `web/privacy.html` as its links. The script is linked to it (Project Settings → GCP project). The default hidden project can't have the API turned on |
| Web app | Deployment `AKfycbxpeL5vrLATFtr0eEarAeMcx3ONRLw_EAiuix9NThLf2X3KOVv5dxJpk6HxltqZ1y-XRg` (Execute as Me, Anyone). Always update this one (Manage deployments → pencil → New version) |
| Database | Google Sheet **App Atlas** (garyluo.gs@gmail.com, in My AI Apps), id `1PJRxT0VjcPJJ2RTmhR9KxalxgxlXV7v19Rt33uICG_8` |
| Backend | Apps Script **App Atlas** bound to the sheet (script id `1wkhIYBgn25pW58EJhnveHzYfgJ97Eekh0ZSQaSyrvYoJ10qL6_9e9zWm`, in `.clasp.json`): `Code.gs` (API, tabs, menu, setup) + `Check.gs` (the hourly check). `appsscript.json` lists the scopes |
| Connecting | Sheet menu **App Atlas → Show phone link** → `https://ourappatlas.pages.dev/#api=<exec>&key=<key>` (stored on the device as `aa.api`, `aa.key`) |
| Secrets | Script properties `APP_KEY`, `GITHUB_TOKEN` (fine-grained, read-only Contents on Dailuo-source repos), `WEB_APP_URL`, `LAST_CHECK` |

## Where the information comes from (each app's repo)

- **CLAUDE.md** `## Status` → "Where you left off" (undated lines first, then dated lines newest first). `## For Gary` (`- [ ] step`) → that app's to-dos. `## Motion

- **Motion pack** (`window.MP`, same copy in every app; Climb Buddy is the model): the `<script>` block before `</body>` in `web/index.html`, set up by the `MP.init({...})` line under it. Panels rise from the bottom and slip back down, toasts rise and slip away (setting `.hidden = true` plays the slip-away first, then hides; the app still reads `.hidden` as true at once), a new screen's pieces rise in one after another, and a new row on the same screen rises in. Unhurried (Gary wants animations easy to see); off under reduced motion. If a close function empties or removes the panel, do it after `MP.ms` (or use `MP.out(el, done)`), or the panel slides away empty.

## Changelog` (`- YYYY-MM-DD: text`) → History. Every app's brief has these three sections; keeping them current is part of every session's wrap-up.
- 2026-11-12: Motion pack: panels and toasts rise and slip away, new screens rise in, new rows rise in. sw v3
- `web/sw.js` `CACHE` → site version.
- Commits (last 100) → last change; `Claude-Session: https://claude.ai/…` trailers → "Chats that changed it". Housekeeping commits (`Brief: For Gary checklist…`, merges) are skipped.
- Branches other than main → "not merged" rows with a Cloudflare preview link (`https://<branch>.<pagesProject>.pages.dev/`).
- **Backend deploy status** (Apps Script API, Gary's own token, through the App Atlas Cloud project): the web app deployment with the highest version is "live". Its code (`content?versionNumber=N`) and the editor's saved code (`content`) are compared with the repo files in the Apps tab's `backendFiles` (`path=name; …`, default `Code.gs=Code`). States: `match`, `saved` (editor = GitHub, no new version yet), `behind` (GitHub newer), `noaccess` (another account's script, e.g. Flip Friend/Flip Folio on the business account), `apioff` (Apps Script API off: user setting at script.google.com/home/usersettings, or in the linked Cloud project), `nodeploy`, `error` (also when Google answers 429/5xx after two retries: a failed read is never reported as a difference). `behind`/`saved` add an automatic "deploy" to-do unless an open to-do already mentions deploy.

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

- 2026-11-10: **Live.** Sheet set up, GitHub token in, web app v2, App Atlas Cloud project linked, hourly checks on, site https://ourappatlas.pages.dev/ answering. First clean check: match = SKA Lesson Planner, Climb Buddy, Home Hub, Getaway Guide, Home and Hobby, Flip Friend; behind = Finance Friend, Karate-Ka Companion, SKA Kata Tracker, Pantry Pal; saved = Flip Folio. The business-account scripts (Flip Friend, Flip Folio) are readable too.
- The Apps Script API allows only a few dozen reads a minute: several manual checks in a row get 429s (shown as "couldn't check", fixed by the next hourly run).
- Idea not built: when a read fails, keep the previous snapshot's deploy state instead of showing an error.

## For Gary

- [ ] Open the phone link (sheet menu App Atlas → Show phone link) on your phone and PC, then Add to Home screen
- [ ] Turn off the old "App Atlas" scheduled task in Claude and delete the old check reminders

## Changelog (latest first, keep about 5 lines)

- 2026-11-10: Live: own Cloud project (In production), web app v2, hourly checks on; deploy check retries Google's busy answers and never reports a failed read as a difference; privacy page
- 2026-11-06: First build: hourly GitHub + Apps Script deploy check, Needs you, app page, Start a change prompt, phone + desktop
