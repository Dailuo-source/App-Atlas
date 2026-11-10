/**
 * App Atlas backend: the API the phone app calls, the sheet tabs, the menu.
 * The checks themselves (GitHub + Apps Script) are in Check.gs.
 *
 * Tabs (matched by header name):
 *   Apps     id | name | repo | site | pagesProject | scriptId | backendFiles | order | hidden
 *   Snapshot id | checkedAt | json            (written by the hourly check)
 *   Todos    id | app | text | done | doneAt | source | added
 *   Notes    app | note | updatedAt
 * Script properties: APP_KEY, GITHUB_TOKEN, WEB_APP_URL.
 */

var SITE = 'https://ourappatlas.pages.dev/';
var TABS = {
  Apps: ['id', 'name', 'repo', 'site', 'pagesProject', 'scriptId', 'backendFiles', 'order', 'hidden'],
  Snapshot: ['id', 'checkedAt', 'json'],
  Todos: ['id', 'app', 'text', 'done', 'doneAt', 'source', 'added'],
  Notes: ['app', 'note', 'updatedAt']
};

// ---------- API ----------
function doGet() {
  return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">App Atlas backend. Open the app instead.</p>');
}
function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad request' }); }
  try {
    var key = props_().getProperty('APP_KEY');
    if (!key || req.key !== key) throw new Error('Unauthorized');
    var fn = ACTIONS[req.action];
    if (!fn) throw new Error('Unknown action: ' + req.action);
    return json_({ ok: true, data: fn(req) });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}
var ACTIONS = {
  state: function () { return state_(); },
  check: function (r) { checkApps_(r.app ? [String(r.app)] : null); return state_(); },
  tick: function (r) { tick_(String(r.app), String(r.text), !!r.done, r.source === 'you' ? 'you' : 'brief'); return state_(); },
  addTodo: function (r) { addTodo_(String(r.app), String(r.text)); return state_(); },
  delTodo: function (r) { delRow_('Todos', 'id', String(r.id)); return state_(); },
  note: function (r) { setNote_(String(r.app), String(r.note || '')); return state_(); }
};
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function props_() { return PropertiesService.getScriptProperties(); }

function state_() {
  var snaps = {};
  rows_('Snapshot').forEach(function (r) { try { snaps[r.id] = JSON.parse(r.json); } catch (e) {} });
  var notes = {};
  rows_('Notes').forEach(function (r) { notes[r.app] = { note: r.note, updatedAt: iso_(r.updatedAt) }; });
  var apps = rows_('Apps').filter(function (a) { return a.id && !truthy_(a.hidden); }).map(function (a) {
    return { id: a.id, name: a.name, repo: a.repo, site: a.site, pagesProject: a.pagesProject,
      hasBackend: !!a.scriptId, order: Number(a.order) || 99, snap: snaps[a.id] || null, note: notes[a.id] || null };
  });
  var todos = rows_('Todos').map(function (t) {
    return { id: t.id, app: t.app, text: t.text, done: truthy_(t.done), doneAt: iso_(t.doneAt), source: t.source || 'brief', added: iso_(t.added) };
  });
  return { apps: apps, todos: todos, checkedAt: props_().getProperty('LAST_CHECK') || '', checking: false };
}

// ---------- to-dos and notes ----------
function normText_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function tick_(app, text, done, source) {
  var sh = tab_('Todos'), data = sh.getDataRange().getValues(), h = data[0];
  var c = cols_(h), key = normText_(text);
  for (var i = 1; i < data.length; i++) {
    if (data[i][c.app] === app && normText_(data[i][c.text]) === key) {
      sh.getRange(i + 1, c.done + 1, 1, 2).setValues([[done, done ? new Date() : '']]);
      return;
    }
  }
  var row = h.map(function () { return ''; });
  row[c.id] = 'td' + Date.now().toString(36); row[c.app] = app; row[c.text] = text;
  row[c.done] = done; row[c.doneAt] = done ? new Date() : ''; row[c.source] = source; row[c.added] = new Date();
  sh.appendRow(row);
}
function addTodo_(app, text) {
  text = text.trim(); if (!text) throw new Error('Type a to-do first');
  tick_(app, text, false, 'you');
}
function setNote_(app, note) {
  var sh = tab_('Notes'), data = sh.getDataRange().getValues(), c = cols_(data[0]);
  for (var i = 1; i < data.length; i++) {
    if (data[i][c.app] === app) { sh.getRange(i + 1, c.note + 1, 1, 2).setValues([[note, new Date()]]); return; }
  }
  var row = data[0].map(function () { return ''; });
  row[c.app] = app; row[c.note] = note; row[c.updatedAt] = new Date();
  sh.appendRow(row);
}

// ---------- sheet helpers ----------
function tab_(name) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, TABS[name].length).setValues([TABS[name]]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function cols_(h) { var c = {}; h.forEach(function (x, i) { c[String(x).trim()] = i; }); return c; }
function rows_(name) {
  var v = tab_(name).getDataRange().getValues(), h = v.shift().map(function (x) { return String(x).trim(); });
  return v.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {}; h.forEach(function (k, i) { o[k] = r[i]; }); return o;
  });
}
function delRow_(name, field, value) {
  var sh = tab_(name), v = sh.getDataRange().getValues(), c = cols_(v[0]);
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][c[field]]) === value) sh.deleteRow(i + 1);
}
function putSnapshot_(id, snap) {
  var sh = tab_('Snapshot'), v = sh.getDataRange().getValues(), c = cols_(v[0]);
  var text = JSON.stringify(snap); if (text.length > 49000) text = JSON.stringify(trimSnap_(snap));
  for (var i = 1; i < v.length; i++) {
    if (v[i][c.id] === id) { sh.getRange(i + 1, c.checkedAt + 1, 1, 2).setValues([[new Date(), text]]); return; }
  }
  var row = v[0].map(function () { return ''; }); row[c.id] = id; row[c.checkedAt] = new Date(); row[c.json] = text;
  sh.appendRow(row);
}
function trimSnap_(s) {
  s.status = (s.status || []).slice(0, 6); s.changelog = (s.changelog || []).slice(0, 6); s.sessions = (s.sessions || []).slice(0, 4);
  return s;
}
function truthy_(v) { return v === true || String(v).toUpperCase() === 'TRUE' || v === 1 || v === '1'; }
function iso_(v) { return v instanceof Date ? v.toISOString() : (v ? String(v) : ''); }

// ---------- menu and setup ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('App Atlas')
    .addItem('Set up / repair sheets', 'setup')
    .addItem('Set GitHub token…', 'setGithubToken')
    .addItem('Set web app link…', 'setWebAppUrl')
    .addItem('Show phone link', 'showLink')
    .addSeparator()
    .addItem('Check all apps now', 'checkAll')
    .addItem('Turn on hourly checks', 'turnOnChecks')
    .addItem('Turn off hourly checks', 'turnOffChecks')
    .addSeparator()
    .addItem('Make a new key', 'resetKey')
    .addToUi();
}
function setup() {
  Object.keys(TABS).forEach(function (t) {
    var sh = tab_(t), h = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
    TABS[t].forEach(function (col) { if (h.indexOf(col) < 0) { sh.getRange(1, sh.getLastColumn() + 1).setValue(col).setFontWeight('bold'); } });
  });
  if (rows_('Apps').length === 0) seedApps_();
  if (!props_().getProperty('APP_KEY')) props_().setProperty('APP_KEY', newKey_());
  var s1 = SpreadsheetApp.getActive().getSheetByName('Sheet1'); if (s1 && s1.getLastRow() === 0) SpreadsheetApp.getActive().deleteSheet(s1);
  SpreadsheetApp.getUi().alert('App Atlas is set up. Next: App Atlas → Set GitHub token…');
}
function newKey_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 24); }
function resetKey() {
  props_().setProperty('APP_KEY', newKey_());
  SpreadsheetApp.getUi().alert('New key made. Open the new phone link (App Atlas → Show phone link) on each device.');
}
function setGithubToken() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('GitHub token', 'Paste a fine-grained GitHub token with read-only Contents access to the Dailuo-source repos.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || !r.getResponseText().trim()) return;
  props_().setProperty('GITHUB_TOKEN', r.getResponseText().trim());
  ui.alert('Saved. Next: Deploy → New deployment (Web app, Execute as Me, Anyone), then App Atlas → Set web app link…');
}
function setWebAppUrl() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Web app link', 'Paste the web app URL that ends in /exec.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var u = r.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u)) { ui.alert('That doesn\'t look like a /exec link.'); return; }
  props_().setProperty('WEB_APP_URL', u);
  showLink();
}
function showLink() {
  var u = props_().getProperty('WEB_APP_URL'), k = props_().getProperty('APP_KEY');
  if (!u) { SpreadsheetApp.getUi().alert('Set the web app link first.'); return; }
  var link = SITE + '#api=' + encodeURIComponent(u) + '&key=' + k;
  var html = HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Open this on your phone and your PC:</p><textarea style="width:100%;height:110px" onclick="this.select()">' + link + '</textarea>').setWidth(460).setHeight(200);
  SpreadsheetApp.getUi().showModalDialog(html, 'App Atlas phone link');
}
function turnOnChecks() {
  turnOffChecks();
  ScriptApp.newTrigger('checkAll').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert('App Atlas will check every app every hour.');
}
function turnOffChecks() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'checkAll') ScriptApp.deleteTrigger(t); });
}
function checkAll() { checkApps_(null); }

function seedApps_() {
  var A = [
    ['ska-lesson-planner', 'SKA Lesson Planner', 'SKA-Lesson-Planner', 'https://ska-lesson-planner.pages.dev/', 'ska-lesson-planner', '1drOnBX2EnUE5v4wU9l0Wy-ka2OLj70PSiESu9CPLja8DGYKhVd2xFvlF', ''],
    ['finance-friend', 'Finance Friend', 'finances', 'https://financefriend.pages.dev/', 'financefriend', '16vyFMo4eLLVVOELGyiq6XaNm4oDcHXWUG28VhPd_XcOmS53-yfjWYQYO', 'apps-script/Code.gs=Code; apps-script/Core.gs=Core; apps-script/SeedRules.gs=SeedRules; apps-script/Index.html=Index; apps-script/Desktop.html=Desktop'],
    ['karate-ka-companion', 'Karate-Ka Companion', 'Karate-Ka-Companion', 'https://karate-ka-companion.pages.dev/', 'karate-ka-companion', '1WfmbJ6fxnZvBEIUtkX7W_657SEZUHyKZ2-qqjlAKNS1z5VLRsG30vzUC', ''],
    ['ska-kata-tracker', 'SKA Kata Tracker', 'SKA-Kata-Tracker', 'https://dailuo-source.github.io/SKA-Kata-Tracker/', '', '111lCaHWu0gtPF8-jiEXuhYeEqizKrjg1Kh4eybj7NU7gigJ48_1eN8xD', ''],
    ['climb-buddy', 'Climb Buddy', 'Climb-Buddy', 'https://climbbuddy.pages.dev/', 'climbbuddy', '1Ug4862ZqazPOZaeeaGF8NTQ1KI2hTMViTXFDCNna8Kw8Bl5a82fpHwC1', ''],
    ['pantry-pal', 'Pantry Pal', 'Pantry-Pal', 'https://dailuo-source.github.io/Pantry-Pal/', '', '1b_-7nw5L7wFkHYclK_DMsKX1P3_k6bcqou4k0652eSAZz-m5Arvjk7ZA', 'Code.gs=Code; apps-script/index.html=apps-script/index'],
    ['home-hub', 'Home Hub', 'Home-Hub', 'https://ourhomehub.pages.dev/', 'ourhomehub', '1YfRVSMyh6HvYwE1LVWHFwHHsgnXpuAWbc0Du7AF1jt8bbX-TM7L67ldb', ''],
    ['getaway-guide', 'Getaway Guide', 'Getaway-Guide', 'https://getaway-guide.pages.dev/', 'getaway-guide', '1r52RMZOvnG42v7Y0_akdrCBysYfGf_jTGqbWJ3tVIz7NByh0luHyxZf7', ''],
    ['home-and-hobby', 'Home and Hobby', 'Home-and-Hobby', 'https://homeandhobby.pages.dev/', 'homeandhobby', '1lVlLQK4SE0eVMi3JXcY7N2mwv7OzwBHBp9YHR6gkaO1vt_BuluuEa4Ib', ''],
    ['flip-folio', 'Flip Folio', 'Flip-Folio', 'https://flip-folio.pages.dev/', 'flip-folio', '18X_Kx66oQWivzdhS05uTWed70zTtUgN1bavzQgoHEAFqfVKGzA8AT7_C', ''],
    ['flip-friend', 'Flip Friend', 'Flip-Friend', 'https://flip-friend.pages.dev/', 'flip-friend', '1IJM_uOLskm8FdL_SyJ-ktHj5s8J1YHTEySjQQTSZ5IiHlyx3lsXb4td6', '']
  ];
  var sh = tab_('Apps'), c = cols_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
  var rows = A.map(function (a, i) {
    var r = []; for (var k = 0; k < sh.getLastColumn(); k++) r.push('');
    r[c.id] = a[0]; r[c.name] = a[1]; r[c.repo] = 'Dailuo-source/' + a[2]; r[c.site] = a[3]; r[c.pagesProject] = a[4];
    r[c.scriptId] = a[5]; r[c.backendFiles] = a[6] || 'Code.gs=Code'; r[c.order] = i + 1; r[c.hidden] = false;
    return r;
  });
  sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}
