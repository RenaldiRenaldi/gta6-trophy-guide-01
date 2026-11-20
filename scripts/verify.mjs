// Development browser verification; set PLAYWRIGHT_MODULE to a local module URL if needed.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, extname } from 'node:path';
import { once } from 'node:events';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

// Chromium CLI owns the final image. A pending, invisible image holds the load
// event while CDP imports the real demo backup and selects the recorded view.
// This capture-only server never modifies the delivered application or its data.
async function captureWithChromium(shot, index, sample) {
  let releaseLoad;
  const root = new URL('../app/', import.meta.url);
  const server = createServer(async (req,res) => {
    const pathname = new URL(req.url,'http://localhost').pathname;
    if (pathname === '/__capture_hold.gif') {
      releaseLoad = () => { res.writeHead(200,{'Content-Type':'image/gif'}); res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64')); };
      return;
    }
    try {
      const file = new URL('.'+(pathname === '/' ? '/index.html' : pathname),root);
      if (!file.href.startsWith(root.href)) throw Error('Outside app');
      let body = await readFile(file);
      if (pathname === '/') body = Buffer.from(body.toString().replace('</body>','<img src="/__capture_hold.gif" alt="" style="position:absolute;top:0;left:0;width:1px;height:1px;opacity:0"></body>'));
      res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[extname(file.pathname)] ?? 'application/octet-stream')});
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  const chrome = spawn(process.env.CHROME_PATH ?? chromium.executablePath(),[
    '--headless','--no-sandbox','--disable-gpu','--no-proxy-server','--hide-scrollbars',
    '--remote-debugging-port=0','--force-device-scale-factor=1',
    `--user-data-dir=${resolve('out',`capture-profile-${index}`)}`,
    `--window-size=${shot.viewport.width},${shot.viewport.height}`,
    `--screenshot=${resolve('screenshots',shot.file)}`,url+shot.path
  ],{stdio:['ignore','ignore','pipe']});
  const completed = once(chrome,'exit');
  let log = '';
  const endpoint = await new Promise((resolveEndpoint,reject) => {
    const timer = setTimeout(()=>reject(Error('Chromium CDP startup timeout')),15000);
    chrome.once('error',reject);
    chrome.stderr.on('data',chunk=>{
      log += chunk.toString();
      const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolveEndpoint(match[1]); }
    });
  });
  const captureBrowser = await chromium.connectOverCDP(endpoint);
  try {
    const captureContext = captureBrowser.contexts()[0];
    const capturePage = captureContext.pages()[0] ?? await captureContext.waitForEvent('page');
    capturePage.on('pageerror',error=>errors.push(error.message));
    await capturePage.setViewportSize(shot.viewport);
    await capturePage.waitForSelector('.audit-strip');
    const capturedSample = {...sample,spoilers:index!==1};
    capturePage.once('dialog',dialog=>dialog.accept());
    await capturePage.locator('#import-file').setInputFiles({name:'vice-fieldnotes-example.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(capturedSample))});
    if (index === 1) {
      await capturePage.locator('[data-kind="disagree"]').click();
      assert.equal(await capturePage.locator('#toast').innerText(),`Imported ${sample.earned.length} earned · ${Object.keys(sample.counts).length} counters`);
    } else {
      await capturePage.waitForFunction(()=>!document.querySelector('#toast').classList.contains('visible') && getComputedStyle(document.querySelector('#toast')).opacity==='0');
    }
    await capturePage.evaluate(()=>window.scrollTo(0,0));
    assert(await capturePage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if (!releaseLoad) throw Error('Capture load barrier missing');
    const captured = new Promise((resolveCapture,reject) => {
      const timer = setTimeout(()=>reject(Error('Chromium screenshot write timeout')),15000);
      const written = () => { if (/\d+ bytes written to file/.test(log)) { clearTimeout(timer); resolveCapture(); } };
      chrome.stderr.on('data',written);
      written();
    });
    releaseLoad();
    await captured;
    // Wait for the CLI's completed file write before disconnecting or stopping it.
    await captureBrowser.close();
    if (chrome.exitCode === null) chrome.kill('SIGTERM');
    const [code,signal] = await completed;
    assert(code===0 || signal==='SIGTERM',log);
    const jpeg = await readFile('screenshots/'+shot.file);
    assert.equal(jpeg[0],0xff);
    assert.equal(jpeg[1],0xd8);
  } finally {
    await captureBrowser.close().catch(()=>{});
    if (chrome.exitCode === null) chrome.kill();
    server.closeAllConnections();
    server.close();
  }
}

const base = process.env.APP_URL ?? 'http://127.0.0.1:8080';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const shots = JSON.parse(await readFile(new URL('../shots.json', import.meta.url), 'utf8'));
const context = await browser.newContext({ viewport: shots[0].viewport, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [], external = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/*', route => {
  const url = route.request().url();
  if (!url.startsWith(base + '/') && !url.startsWith('data:') && !url.startsWith('blob:')) { external.push(url); return route.abort(); }
  return route.continue();
});
await page.goto(base);
await page.waitForSelector('.trophy-row');
assert.equal(await page.locator('.trophy-row').count(), 55);
assert.equal(await page.locator('#spoilers').isChecked(), false);
await page.locator('[data-kind="story"]').click();
assert.equal(await page.locator('.trophy-row').count(), 12);
assert(!await page.locator('#trophy-list').innerText().then(t=>t.includes('Snow Storm')));
await page.locator('.row-main').first().click();
assert(await page.locator('#guide').innerText().then(t=>t.includes('Let the story unfold.')));
await page.locator('.trophy-row input').first().check();
assert(await page.locator('#trophy-list').innerText().then(t=>t.includes('Just Like Paradise')));
await page.reload();
await page.waitForSelector('.trophy-row');
assert(await page.locator('[data-earned="2"]').first().isChecked());
await page.locator('[data-kind="collectibles"]').click();
assert(await page.locator('.trophy-row').count() > 5);
await page.locator('#search').fill('not-a-real-trophy');
assert.equal(await page.locator('.trophy-row').count(), 0);
await page.locator('[data-action="clear"]').first().click();
await page.locator('[data-open="17"]').last().click();
await page.locator('#counter').fill('19');
await page.locator('#counter').dispatchEvent('change');
await page.locator('.notes summary').click();
await page.locator('#notes').fill('Browser test note <safe>');
await page.reload();
await page.waitForSelector('#counter');
assert.equal(await page.locator('#counter').inputValue(), '19');
assert.equal(await page.locator('#notes').inputValue(), 'Browser test note <safe>');
const downloadEvent = page.waitForEvent('download');
await page.locator('[data-action="export"]').click();
const backup = await downloadEvent;
const payload = await readFile(await backup.path(), 'utf8');
assert.equal(JSON.parse(payload).counts['17'], 19);
assert.equal(JSON.parse(payload).notes['17'], 'Browser test note <safe>');
page.once('dialog', dialog => dialog.accept());
await page.locator('#import-file').setInputFiles({ name:'progress.json', mimeType:'application/json', buffer:Buffer.from(payload) });
await page.waitForTimeout(100);
await page.locator('#import-file').setInputFiles({ name:'bad.json', mimeType:'application/json', buffer:Buffer.from('{"version":99}') });
await page.waitForTimeout(100);
assert(await page.locator('#toast').innerText().then(t=>t.includes('Import rejected')));
assert.equal(await page.locator('#counter').inputValue(), '19');
await page.goto(base+'/#settings');
await page.waitForSelector('[data-action="demo"]');
page.once('dialog', dialog => dialog.accept());
await page.locator('[data-action="demo"]').click();
await page.waitForSelector('.demo-label');
// Exercise a real browser download and validated file import before the captures.
const demoDownload = page.waitForEvent('download');
await page.locator('.backup-actions [data-action="export"]').click();
const demoPayload = await readFile(await (await demoDownload).path(), 'utf8');
const sample = JSON.parse(demoPayload);
assert.equal(sample.demo, true);
assert.equal(sample.counts['17'], 0);
assert(await page.locator('.export-receipt').innerText().then(t => t.includes(`${sample.earned.length} trophies`)));
page.once('dialog', dialog => dialog.accept());
await page.locator('#import-file').setInputFiles({ name:'vice-fieldnotes-example.json', mimeType:'application/json', buffer:Buffer.from(demoPayload) });
assert.equal(await page.locator('#toast').innerText(), `Imported ${sample.earned.length} earned · ${Object.keys(sample.counts).length} counters`);
const audit = JSON.parse(await readFile(new URL('../app/data/trophies.json', import.meta.url), 'utf8'));
const totals = [6,9,9,23,8];
assert.equal(audit.trophies.length,55);
assert.equal(audit.trophies.filter(t=>t.guide?.trim() && t.sources?.length).length,55);
const stepCount = audit.trophies.reduce((n,t)=>n+t.steps.length,0);
const sourceKeys = Object.keys(audit.sources);
assert.equal(audit.trophies.filter(t=>/unconfirmed/i.test(t.risk)).length,3);
assert.equal(audit.trophies.filter(t=>t.disagree).length,4);
assert.equal(audit.trophies.filter(t=>t.target).length,21);
for (const t of audit.trophies) {
  assert(t.steps.length>=2 && t.steps.length<=4);
  for (const s of t.steps) {
    assert(s.text.trim() && s.cites.length);
    assert(s.cites.every(n=>Number.isInteger(n) && t.sources.includes(sourceKeys[n-1])));
  }
}
await page.goto(base+'/#tracker/28');
await page.waitForSelector('.sources-rail');
assert.equal(await page.locator('.rail-entries>div').count(),18);
for (const [i,key] of sourceKeys.entries()) {
  const coverage = audit.trophies.filter(t=>t.sources.includes(key)).length;
  assert(await page.locator('.rail-entries>div').nth(i).innerText().then(text=>text.includes(`cited by ${coverage} of 55 guides`) && text.includes('20 Nov 2026')));
}
await page.locator('[data-kind="disagree"]').click();
assert.equal(await page.locator('.trophy-row').count(),4);
assert.equal(await page.locator('.trophy-row .disagree-tag').count(),4);
await page.locator('[data-action="clear"]').first().click();
// Every panel renders its own numbered, cited steps; inspect all four conflict boxes.
for (const t of audit.trophies) {
  await page.locator('.row-main[data-open="'+t.id+'"]').click();
  assert.equal(await page.locator('#guide .guide-steps>li').count(),t.steps.length);
  assert.equal(await page.locator('#guide .guide-steps .citation').count(),t.steps.length);
  assert.equal(await page.locator('#guide .disagreement').count(),t.disagree?1:0);
}
for (const [index, shot] of shots.entries()) {
  await page.setViewportSize(shot.viewport);
  await page.goto(base + shot.path);
  await page.waitForSelector('.audit-strip');
  assert(await page.locator('.audit-strip').innerText().then(t=>t.includes('55/55 guides cite a source') && t.includes('28 hidden on PSN') && t.includes(`${stepCount}/${stepCount} steps cited`) && t.includes('4 disagree') && t.includes('0 single-source') && t.includes('20 Nov 2026')));
  if (index === 0) {
    await page.waitForSelector('#counter');
    assert.equal(await page.locator('#counter').inputValue(),'7');
    assert.equal(await page.locator('.stage-chips>span').count(),5);
    const chips = await page.locator('.stage-chips>span').allTextContents();
    totals.forEach((n,i)=>assert(chips[i].endsWith('/'+n)));
    assert(await page.locator('.next-up').innerText().then(t=>t.includes('Positive Mental Attitude')));
    await page.locator('.trophy-list').evaluate(el=>el.scrollTop=0);
    const visibleRows = await page.locator('.trophy-row').evaluateAll((rows,height)=>rows.filter(row=>{const r=row.getBoundingClientRect(),list=row.parentElement.getBoundingClientRect();return r.top>=list.top && r.bottom<=Math.min(height,list.bottom);}).length,shot.viewport.height);
    assert(visibleRows>=8,`Cover needs 8 complete rows with the evidence rail; got ${visibleRows}`);
    await page.waitForTimeout(3600);
  } else if (index === 1) {
    await page.waitForSelector('#counter');
    await page.locator('.spoiler-control').click();
    assert.equal(await page.locator('#spoilers').isChecked(), false);
    await page.locator('[data-kind="disagree"]').click();
    assert(await page.locator('#trophy-list').innerText().then(t=>t.includes('Hidden story trophy')));
    assert.equal(await page.locator('#counter').inputValue(),'0');
    assert(await page.locator('.guide-steps').innerText().then(t=>t.includes('[5]')));
    assert(await page.locator('#guide .source-block').innerText().then(t=>t.includes('20 November 2026') && t.includes('https://')));
    page.once('dialog', dialog=>dialog.accept());
    // Import the downloaded file again with spoilers off, retaining this view.
    const concealedSample={...sample,spoilers:false};
    await page.locator('#import-file').setInputFiles({ name:'vice-fieldnotes-example.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(concealedSample)) });
    await page.waitForSelector('#toast.visible');
    assert.equal(await page.locator('#toast').innerText(),`Imported ${sample.earned.length} earned · ${Object.keys(sample.counts).length} counters`);
  } else if (index === 2) {
    await page.locator('.spoiler-control').click();
    assert.equal(await page.locator('.route-card').count(),5);
    assert.equal(await page.locator('.trophy-chip').count(),55);
    assert.equal(await page.locator('.route-hours').count(),5);
    assert.equal(await page.locator('.target-panel tbody tr').count(),9);
    const longChip = page.locator('.trophy-chip').filter({hasText:'Top Of The World, Ma'});
    assert.equal(await longChip.count(),1);
    assert(await longChip.locator('b').evaluate(el=>el.scrollWidth<=el.clientWidth && el.textContent==='Top Of The World, Ma'));
    assert(await page.locator('.route-card').last().evaluate((el,h)=>el.getBoundingClientRect().bottom<=h,shot.viewport.height));
    await page.waitForTimeout(3600);
  } else {
    assert.equal(await page.locator('.chapter-watch>div').count(),6);
    assert.equal(await page.locator('.research-hold>button').count(),3);
    assert(await page.locator('.research-hold').innerText().then(t=>t.includes('one method remains unknown') && t.includes('NEW METHOD [2]')));
    assert(await page.locator('.disagreement').innerText().then(t=>t.includes('18') && t.includes('15')));
    assert(await page.locator('.watch-cards').innerText().then(t=>t.includes('Yago timed race') && t.includes('A Long Road') && t.includes('not a confirmed trophy lockout')));
    assert(await page.locator('.research-hold').evaluate((el,h)=>el.getBoundingClientRect().bottom<=h,shot.viewport.height));
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  await captureWithChromium(shot,index,sample);
  console.log(`CAPTURE ${shot.file} ${shot.viewport.width}×${shot.viewport.height}`);
}
await page.setViewportSize({width:390,height:844});
await page.goto(base+'/#tracker/28');
await page.waitForSelector('.guide-title');
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
assert.deepEqual(errors, []);
assert.deepEqual(external, []);
for (const name of await readdir('screenshots')) assert((await stat('screenshots/'+name)).size <= 262144);
console.log('PASS: all 55 rows; spoiler conceal/reveal; filters; persistent checks/counters/escaped notes; export/import and rejection; roadmap; mobile fit; no external requests or page errors; screenshot caps.');
await browser.close();
