/**
 * The hourly check: for each app, read its repo on GitHub and its live Apps Script deployment,
 * then write one Snapshot row. Pure parsing helpers (parseBrief_, siteVersion_, sessions_,
 * previewUrl_, sameCode_) have no Apps Script calls so test/check.test.js can run them in Node.
 */

function checkApps_(only) {
  var token = props_().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Set the GitHub token first (sheet menu App Atlas → Set GitHub token…)');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // a check is already running
  try {
    var apps = rows_('Apps').filter(function (a) { return a.id && !truthy_(a.hidden) && (!only || only.indexOf(a.id) >= 0); });
    // Stage 1: everything that doesn't depend on anything else.
    var reqs = [], at = [];
    apps.forEach(function (a, i) {
      var r = a.repo, files = backendFiles_(a.backendFiles);
      add(i, 'brief', gh_(token, r, 'contents/CLAUDE.md', true));
      add(i, 'sw', gh_(token, r, 'contents/web/sw.js', true));
      add(i, 'commits', gh_(token, r, 'commits?per_page=100'));
      add(i, 'branches', gh_(token, r, 'branches?per_page=50'));
      if (a.scriptId) {
        files.forEach(function (f, k) { add(i, 'src' + k, gh_(token, r, 'contents/' + f.path, true)); });
        add(i, 'srcCommit', gh_(token, r, 'commits?per_page=1&path=' + encodeURIComponent(files[0].path)));
        add(i, 'deps', gas_('projects/' + a.scriptId + '/deployments'));
        add(i, 'head', gas_('projects/' + a.scriptId + '/content'));
      }
    });
    function add(i, kind, req) { reqs.push(req); at.push([i, kind]); }
    var got = apps.map(function () { return {}; });
    fetchAllRetry_(reqs).forEach(function (res, n) { got[at[n][0]][at[n][1]] = res; });

    // Stage 2: the deployed version's code and date.
    var reqs2 = [], at2 = [];
    apps.forEach(function (a, i) {
      var d = got[i].deps; if (!d || d.getResponseCode() !== 200) return;
      var v = liveVersion_(JSON.parse(d.getContentText()));
      got[i].version = v;
      if (!v) return;
      reqs2.push(gas_('projects/' + a.scriptId + '/content?versionNumber=' + v)); at2.push([i, 'live']);
      reqs2.push(gas_('projects/' + a.scriptId + '/versions/' + v)); at2.push([i, 'ver']);
    });
    if (reqs2.length) fetchAllRetry_(reqs2).forEach(function (res, n) { got[at2[n][0]][at2[n][1]] = res; });

    apps.forEach(function (a, i) {
      var snap;
      try { snap = buildSnap_(a, got[i]); } catch (e) { snap = { checkedAt: new Date().toISOString(), error: String(e.message || e) }; }
      putSnapshot_(a.id, snap);
    });
    props_().setProperty('LAST_CHECK', new Date().toISOString());
  } finally { lock.releaseLock(); }
}

function gh_(token, repo, path, raw) {
  return { url: 'https://api.github.com/repos/' + repo + '/' + path, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } };
}
function gas_(path) {
  return { url: 'https://script.googleapis.com/v1/' + path, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
}
// Google's Apps Script API sometimes answers 429/5xx when many requests arrive at once:
// retry just those, twice, with a short pause.
function fetchAllRetry_(reqs) {
  var out = UrlFetchApp.fetchAll(reqs);
  for (var round = 0; round < 2; round++) {
    var redo = [];
    out.forEach(function (res, n) { var c = res.getResponseCode(); if (c === 429 || c >= 500) redo.push(n); });
    if (!redo.length) break;
    Utilities.sleep(1500 * (round + 1));
    UrlFetchApp.fetchAll(redo.map(function (n) { return reqs[n]; })).forEach(function (res, k) { out[redo[k]] = res; });
  }
  return out;
}
function text_(res) { return res && res.getResponseCode() === 200 ? res.getContentText() : null; }

function buildSnap_(a, g) {
  var snap = { checkedAt: new Date().toISOString(), problems: [] };
  var brief = text_(g.brief);
  if (brief === null) snap.problems.push(ghProblem_(g.brief, 'CLAUDE.md'));
  var b = parseBrief_(brief || '');
  snap.status = b.status; snap.forGary = b.forGary; snap.changelog = b.changelog;
  snap.site = { cache: '', version: siteVersion_(text_(g.sw) || '') };
  var commits = []; try { commits = JSON.parse(text_(g.commits) || '[]'); } catch (e) {}
  commits = commits.filter(function (c) { return !HOUSEKEEPING.test(c.commit.message.split('\n')[0]); });
  snap.lastCommit = commits[0] ? { date: commits[0].commit.committer.date, text: commits[0].commit.message.split('\n')[0], sha: commits[0].sha.slice(0, 7) } : null;
  snap.sessions = sessions_(commits.map(function (c) { return { date: c.commit.committer.date, message: c.commit.message }; }));
  snap.weekCommits = commits.filter(function (c) { return Date.now() - new Date(c.commit.committer.date).getTime() < 7 * 864e5; }).length;
  var br = []; try { br = JSON.parse(text_(g.branches) || '[]'); } catch (e) {}
  snap.branches = br.map(function (x) { return x.name; }).filter(function (n) { return !/^(main|master|gh-pages)$/.test(n); })
    .map(function (n) { return { name: n, preview: a.pagesProject ? previewUrl_(n, a.pagesProject) : '' }; });
  snap.backend = a.scriptId ? backendState_(a, g) : { state: 'none' };
  return snap;
}
function ghProblem_(res, what) {
  var c = res ? res.getResponseCode() : 0;
  return c === 401 ? 'GitHub token was refused' : c === 404 ? what + ' not found (or the token can\'t see this repo)' : 'GitHub said ' + c + ' for ' + what;
}

// ---------- Apps Script deploy status ----------
function liveVersion_(d) {
  var best = 0;
  (d.deployments || []).forEach(function (x) {
    var v = x.deploymentConfig && x.deploymentConfig.versionNumber;
    var web = (x.entryPoints || []).some(function (e) { return e.entryPointType === 'WEB_APP'; });
    if (v && web && v > best) best = v;
  });
  return best || null;
}
function backendState_(a, g) {
  var out = { state: 'unknown', version: g.version || null };
  var dc = g.deps ? g.deps.getResponseCode() : 0;
  if (dc !== 200) {
    var body = g.deps ? g.deps.getContentText() : '';
    if (/has not been used|is disabled|SERVICE_DISABLED|User has not enabled the Apps Script API/i.test(body)) out.state = 'apioff';
    else if (dc === 403 || dc === 404) out.state = 'noaccess';
    else out.state = 'error';
    out.detail = dc + ' ' + body.slice(0, 160);
    return out;
  }
  if (!g.version) { out.state = 'nodeploy'; return out; }
  if (g.ver && g.ver.getResponseCode() === 200) out.deployedAt = JSON.parse(g.ver.getContentText()).createTime || '';
  try { var sc = JSON.parse(text_(g.srcCommit) || '[]'); if (sc[0]) out.githubAt = sc[0].commit.committer.date; } catch (e) {}
  var files = backendFiles_(a.backendFiles), gh = {};
  for (var k = 0; k < files.length; k++) {
    var t = text_(g['src' + k]);
    if (t === null) { out.state = 'error'; out.detail = 'Couldn\'t read ' + files[k].path + ' from GitHub'; return out; }
    gh[files[k].name] = t;
  }
  // A failed read is "couldn't check", never "different".
  if (!g.live || g.live.getResponseCode() !== 200) { out.state = 'error'; out.detail = 'Google didn\'t send the live code (' + (g.live ? g.live.getResponseCode() : 'no answer') + '); next check will retry'; return out; }
  var live = filesOf_(g.live), head = filesOf_(g.head);
  var liveSame = sameCode_(gh, live), headSame = sameCode_(gh, head);
  out.differs = liveSame.differs;
  if (liveSame.same) out.state = 'match';
  else if (!head) { out.state = 'error'; out.detail = 'Google didn\'t send the editor code (' + (g.head ? g.head.getResponseCode() : 'no answer') + '); next check will retry'; }
  else if (headSame.same) out.state = 'saved';     // pushed to the editor, no new version yet
  else if (sameCode_(head, live).same && live) out.state = 'behind'; // GitHub has code that isn't in the editor
  else out.state = 'behind';
  return out;
}
function filesOf_(res) {
  if (!res || res.getResponseCode() !== 200) return null;
  var o = {}; (JSON.parse(res.getContentText()).files || []).forEach(function (f) { if (f.type !== 'JSON') o[f.name] = f.source || ''; });
  return o;
}
function backendFiles_(spec) {
  var s = String(spec || '').trim() || 'Code.gs=Code';
  return s.split(';').map(function (p) { var kv = p.split('='); return { path: kv[0].trim(), name: (kv[1] || kv[0].replace(/\.\w+$/, '')).trim() }; })
    .filter(function (f) { return f.path; });
}

// ---------- pure helpers (tested in Node) ----------
function normCode_(s) { return String(s || '').replace(/\r\n?/g, '\n').split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).join('\n').replace(/\n+$/, ''); }
function sameCode_(want, have) {
  if (!want || !have) return { same: false, differs: [] };
  var differs = Object.keys(want).filter(function (n) { return !(n in have) || normCode_(want[n]) !== normCode_(have[n]); });
  return { same: differs.length === 0, differs: differs };
}
function sections_(md) {
  var out = {}, cur = null;
  String(md).replace(/\r/g, '').split('\n').forEach(function (l) {
    var m = /^##\s+(.+?)\s*$/.exec(l);
    if (m) { cur = m[1]; out[cur] = []; return; }
    if (cur) out[cur].push(l);
  });
  return out;
}
function bullets_(lines) {
  var items = [], cur = null;
  (lines || []).forEach(function (l) {
    if (/^\s*[-*]\s+/.test(l) && !/^\s{2,}/.test(l)) { cur = l.replace(/^\s*[-*]\s+/, ''); items.push(cur); }
    else if (cur !== null && /^\s+\S/.test(l)) { items[items.length - 1] += ' ' + l.trim(); }
    else if (!l.trim()) cur = null;
  });
  return items;
}
function parseBrief_(md) {
  var s = sections_(md), get = function (re) { var k = Object.keys(s).filter(function (x) { return re.test(x); })[0]; return k ? s[k] : []; };
  // Status: undated lines first (in brief order), then dated lines newest first.
  var st = bullets_(get(/^Status\b/i)), dated = /^\**(\d{4}-\d{2}-\d{2})/;
  var status = st.filter(function (x) { return !dated.test(x); })
    .concat(st.filter(function (x) { return dated.test(x); }).sort(function (x, y) { return dated.exec(y)[1] < dated.exec(x)[1] ? -1 : dated.exec(y)[1] > dated.exec(x)[1] ? 1 : 0; }))
    .slice(0, 12);
  var forGary = bullets_(get(/^For Gary\b/i)).map(function (t) {
    var m = /^\[( |x|X)\]\s*(.*)$/.exec(t);
    return m ? { text: m[2], done: m[1] !== ' ' } : { text: t, done: false };
  }).filter(function (t) { return t.text && !/^nothing( right now)?\.?$/i.test(t.text); });
  var changelog = bullets_(get(/^Changelog\b/i)).map(function (t) {
    var m = /^(\d{4}-\d{2}-\d{2})\s*:?\s*(.*)$/.exec(t); return m ? { date: m[1], text: m[2] } : { date: '', text: t };
  }).slice(0, 12);
  return { status: status, forGary: forGary, changelog: changelog };
}
function siteVersion_(js) {
  var m = /CACHE\s*=\s*['"]([^'"]+)['"]/.exec(js || ''); if (!m) return '';
  var v = /v(\d+)$/.exec(m[1]); return v ? 'v' + v[1] : m[1];
}
var HOUSEKEEPING = /^(Brief: For Gary checklist|Merge (branch|pull request))/;
var MINOR = /^(Status|Brief|Note|Notes|Trim|Changelog)\b/i;
function realCommits_(commits) { return (commits || []).filter(function (c) { return !HOUSEKEEPING.test(String(c.message || '').split('\n')[0]); }); }
function sessions_(commits) {
  var by = {}, order = [];
  realCommits_(commits).forEach(function (c) {
    var m = /Claude-Session:\s*(https:\/\/claude\.ai\/\S+)/.exec(c.message || ''); if (!m) return;
    var u = m[1];
    var subj = c.message.split('\n')[0];
    if (!by[u]) { by[u] = { url: u, last: c.date, first: c.date, title: subj, count: 0 }; order.push(u); }
    var s = by[u]; s.count++;
    if (c.date <= s.first) { s.first = c.date; if (!MINOR.test(subj) || MINOR.test(s.title)) s.title = subj; }
  });
  return order.slice(0, 8).map(function (u) { return by[u]; });
}
function previewUrl_(branch, project) {
  var b = String(branch).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28).replace(/-+$/, '');
  return 'https://' + b + '.' + project + '.pages.dev/';
}
if (typeof module !== 'undefined') module.exports = { parseBrief_: parseBrief_, siteVersion_: siteVersion_, sessions_: sessions_, previewUrl_: previewUrl_, sameCode_: sameCode_, liveVersion_: liveVersion_, backendFiles_: backendFiles_ };
