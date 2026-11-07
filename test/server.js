// Fake backend + static site for clicking through the app: node test/server.js [port]
const http = require('http'), fs = require('fs'), path = require('path');
const { ctx, book, props, setScripts, ROOTS } = require('./gas');
const port = +process.argv[2] || 8770;
ctx.setup();
props.GITHUB_TOKEN = 'test';
const files = id => ctx.backendFiles_(ctx.rows_('Apps').filter(a => a.id === id)[0].backendFiles);
const ids = { 'finance-friend': '16vyFMo4eLLVVOELGyiq6XaNm4oDcHXWUG28VhPd_XcOmS53-yfjWYQYO' };
const S = {};
ctx.rows_('Apps').forEach(a => { S[a.id] = { id: a.scriptId, root: ROOTS[a.id], files: files(a.id), mode: 'match', version: 7 }; });
Object.assign(S['ska-lesson-planner'], { mode: 'behind', version: 8, deployedAt: '2026-10-30T14:12:00Z', liveRev: 'HEAD~6' });
Object.assign(S['karate-ka-companion'], { mode: 'saved', version: 7, liveRev: 'HEAD~4' });
Object.assign(S['finance-friend'], { mode: 'match', version: 20, deployedAt: '2026-11-06T14:55:00Z' });
S['flip-folio'].mode = 'noaccess'; S['flip-friend'].mode = 'noaccess';
S.__branches = { 'Dailuo-source/SKA-Lesson-Planner': ['atlas-rmw3tz9ghgr60'] };
setScripts(S);
const t0 = Date.now(); ctx.checkAll(); console.log('checked in', Date.now() - t0, 'ms');
// a tick and a note so the screens have them
ctx.tick_('karate-ka-companion', 'Set your class days and times', true, 'brief');
ctx.setNote_('ska-lesson-planner', 'Try the preview in Tuesday class, then merge and do the animation round.');
props.APP_KEY = 'k1';
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api') {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      const out = ctx.doPost({ postData: { contents: b } });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(out.text);
    }); return;
  }
  let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(__dirname, '..', 'web', p);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/json' }[path.extname(f)] || 'text/plain' }); res.end(d); });
}).listen(port, () => console.log('listening', port));
