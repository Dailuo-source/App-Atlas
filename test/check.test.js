// Runs Check.gs's pure helpers against the real local clones of every app repo.
const fs = require('fs'), path = require('path'), assert = require('assert');
const C = require('../Check.gs');
const roots = JSON.parse(fs.readFileSync('/home/claude/atlas-sync/roots.json', 'utf8'));
const { execSync } = require('child_process');
for (const [id, r] of Object.entries(roots)) {
  const b = C.parseBrief_(fs.readFileSync(path.join(r, 'CLAUDE.md'), 'utf8'));
  const swp = path.join(r, 'web/sw.js');
  const v = fs.existsSync(swp) ? C.siteVersion_(fs.readFileSync(swp, 'utf8')) : '';
  const log = execSync('git log -100 --format=%cI%x1f%B%x1e', { cwd: r }).toString().split('\x1e').filter(s => s.trim())
    .map(s => { const [date, message] = s.trim().split('\x1f'); return { date, message }; });
  const ses = C.sessions_(log);
  assert(b.status.length > 0, id + ' has status');
  assert(b.changelog.length > 0 && b.changelog[0].date, id + ' changelog dated');
  console.log(id.padEnd(20), 'status', b.status.length, '| forGary', b.forGary.length, '| log', b.changelog.length, b.changelog[0].date, '| site', v || '-', '| sessions', ses.length, ses[0] ? ses[0].title.slice(0, 40) : '');
}
assert.equal(C.previewUrl_('atlas-rmw3tz9ghgr60', 'ska-lesson-planner'), 'https://atlas-rmw3tz9ghgr60.ska-lesson-planner.pages.dev/');
assert.deepEqual(C.sameCode_({ Code: 'a \r\nb\n\n' }, { Code: 'a\nb' }), { same: true, differs: [] });
assert.equal(C.sameCode_({ Code: 'a' }, { Code: 'b' }).same, false);
assert.equal(C.liveVersion_({ deployments: [{ deploymentConfig: {}, entryPoints: [{ entryPointType: 'WEB_APP' }] }, { deploymentConfig: { versionNumber: 18 }, entryPoints: [{ entryPointType: 'WEB_APP' }] }, { deploymentConfig: { versionNumber: 19 }, entryPoints: [{ entryPointType: 'WEB_APP' }] }] }), 19);
assert.deepEqual(C.backendFiles_('apps-script/Code.gs=Code; apps-script/Index.html=Index'), [{ path: 'apps-script/Code.gs', name: 'Code' }, { path: 'apps-script/Index.html', name: 'Index' }]);
console.log('all good');
