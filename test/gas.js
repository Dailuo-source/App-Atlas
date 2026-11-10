// A small in-memory Apps Script so Code.gs + Check.gs run in Node.
// GitHub answers come from the local clones in ROOTS; the Apps Script API is faked per app (see SCRIPTS).
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const ROOTS = JSON.parse(fs.readFileSync('/home/claude/atlas-sync/roots.json', 'utf8'));

function makeSheet(name) {
  const sh = { name, data: [] };
  const ensure = (r, c) => { while (sh.data.length < r) sh.data.push([]); sh.data.forEach(row => { while (row.length < c) row.push(''); }); };
  const width = () => Math.max(0, ...sh.data.map(r => r.length));
  sh.getDataRange = () => ({ getValues: () => (sh.data.length ? sh.data.map(r => { const o = r.slice(); while (o.length < width()) o.push(''); return o; }) : [['']]) });
  sh.getRange = (r, c, nr = 1, nc = 1) => {
    const rg = {
      setValues(v) { ensure(r + nr - 1, c + nc - 1); v.forEach((row, i) => row.forEach((x, j) => { sh.data[r - 1 + i][c - 1 + j] = x; })); return rg; },
      setValue(x) { ensure(r, c); sh.data[r - 1][c - 1] = x; return rg; },
      getValues() { ensure(r + nr - 1, c + nc - 1); return sh.data.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc)); },
      setFontWeight() { return rg; }
    };
    return rg;
  };
  sh.appendRow = row => { sh.data.push(row.slice()); };
  sh.deleteRow = i => { sh.data.splice(i - 1, 1); };
  sh.getLastColumn = () => width();
  sh.getLastRow = () => sh.data.length;
  sh.setFrozenRows = () => {};
  return sh;
}
const book = { sheets: {} };
const ss = {
  getSheetByName: n => book.sheets[n] || null,
  insertSheet: n => (book.sheets[n] = makeSheet(n)),
  deleteSheet: sh => { delete book.sheets[sh.name]; }
};
const props = {};
function res(code, body) { return { getResponseCode: () => code, getContentText: () => (typeof body === 'string' ? body : JSON.stringify(body)) }; }

// Fake Apps Script projects: what's "live" (deployed version) and "head" (saved in the editor).
// mode: match | behind (live = an older commit) | saved (head = GitHub, live older) | noaccess | apioff
const SCRIPTS = {};
function setScripts(map) { Object.assign(SCRIPTS, map); }
function git(root, cmd) { return execSync('git ' + cmd, { cwd: root, maxBuffer: 1 << 26 }).toString(); }
function repoRoot(repo) { const name = repo.split('/')[1]; return Object.values(ROOTS).find(r => path.basename(r).toLowerCase() === name.toLowerCase()); }
function fileAt(root, rev, p) { try { return git(root, `show ${rev}:${p}`); } catch (e) { return null; } }

function fetchOne(req) {
  const u = new URL(req.url);
  if (u.host === 'api.github.com') {
    const m = /^\/repos\/([^/]+\/[^/]+)\/(.*)$/.exec(u.pathname); const root = repoRoot(m[1]); if (!root) return res(404, { message: 'Not Found' });
    const rest = m[2];
    if (rest.startsWith('contents/')) { const t = fileAt(root, 'HEAD', decodeURIComponent(rest.slice(9))); return t === null ? res(404, { message: 'Not Found' }) : res(200, t); }
    if (rest === 'commits') {
      const n = u.searchParams.get('per_page') || 30, p = u.searchParams.get('path');
      const out = git(root, `log -${n} --format=%H%x1f%cI%x1f%B%x1e` + (p ? ' -- ' + p : '')).split('\x1e').filter(s => s.trim())
        .map(s => { const [sha, date, msg] = s.trim().split('\x1f'); return { sha, commit: { message: msg.trim(), committer: { date } } }; });
      return res(200, out);
    }
    if (rest === 'branches') {
      const names = git(root, "branch -r --format='%(refname:short)'").split('\n').filter(Boolean).map(s => s.replace(/^origin\//, '')).filter(s => s !== 'HEAD' && s !== 'origin');
      const extra = (SCRIPTS.__branches && SCRIPTS.__branches[m[1]]) || [];
      return res(200, [...new Set(['main', ...names, ...extra])].map(name => ({ name })));
    }
    return res(404, {});
  }
  if (u.host === 'script.googleapis.com') {
    const m = /^\/v1\/projects\/([^/]+)(\/.*)?$/.exec(u.pathname), id = m[1], tail = m[2] || '';
    const sc = Object.values(SCRIPTS).find(s => s && s.id === id);
    if (!sc) return res(404, { error: { message: 'Requested entity was not found.' } });
    if (sc.mode === 'apioff') return res(403, { error: { message: 'User has not enabled the Apps Script API. Enable it by visiting https://script.google.com/home/usersettings' } });
    if (sc.mode === 'noaccess') return res(403, { error: { message: 'The caller does not have permission' } });
    const ver = sc.version || 7;
    if (tail === '/deployments') return res(200, { deployments: [{ deploymentId: 'HEAD', deploymentConfig: {}, entryPoints: [] }, { deploymentId: 'AKfy', deploymentConfig: { versionNumber: ver }, entryPoints: [{ entryPointType: 'WEB_APP' }] }] });
    if (tail === '/versions/' + ver) return res(200, { versionNumber: ver, createTime: sc.deployedAt || '2026-11-01T14:00:00Z' });
    if (tail === '/content') {
      const isLive = u.searchParams.get('versionNumber');
      const rev = isLive ? (sc.mode === 'match' ? 'HEAD' : sc.liveRev || 'HEAD~3') : (sc.mode === 'behind' ? (sc.liveRev || 'HEAD~3') : 'HEAD');
      const files = sc.files.map(f => ({ name: f.name, type: f.path.endsWith('.html') ? 'HTML' : 'SERVER_JS', source: fileAt(sc.root, rev, f.path) || '' }));
      return res(200, { files: files.concat([{ name: 'appsscript', type: 'JSON', source: '{}' }]) });
    }
    return res(404, {});
  }
  return res(404, 'unknown host');
}

const ctx = {
  console, JSON, Date, Math, Object, String, Number, Array, Error, RegExp, encodeURIComponent, decodeURIComponent, isNaN,
  SpreadsheetApp: { getActive: () => ss, getUi: () => ({ alert() {}, createMenu() { const m = { addItem: () => m, addSeparator: () => m, addToUi() {} }; return m; } }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  ScriptApp: { getOAuthToken: () => 'fake-token' },
  UrlFetchApp: { fetchAll: reqs => reqs.map(fetchOne), fetch: (u, o) => fetchOne(Object.assign({ url: u }, o)) },
  Utilities: { getUuid: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', sleep: () => {} },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) },
  HtmlService: { createHtmlOutput: h => ({ h }) }
};
vm.createContext(ctx);
const root = path.join(__dirname, '..');
vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), ctx, { filename: 'Code.gs' });
vm.runInContext(fs.readFileSync(path.join(root, 'Check.gs'), 'utf8'), ctx, { filename: 'Check.gs' });
module.exports = { ctx, book, props, setScripts, ROOTS };
