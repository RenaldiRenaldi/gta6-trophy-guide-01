// Development browser verification; set PLAYWRIGHT_MODULE to a local module URL if needed.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

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
assert.equal(audit.trophies.filter(t=>/unconfirmed/i.test(t.risk)).length,5);
for (const [index, shot] of shots.entries()) {
  await page.setViewportSize(shot.viewport);
  await page.goto(base + shot.path);
  await page.waitForSelector('.audit-strip');
  assert(await page.locator('.audit-strip').innerText().then(t=>t.includes('55/55 guides cite a source') && t.includes('28 hidden on PSN') && t.includes('5 risk notes')));
  if (index === 0) {
    await page.waitForSelector('#counter');
    assert.equal(await page.locator('#counter').inputValue(),'7');
    assert.equal(await page.locator('.stage-chips>span').count(),5);
    const chips = await page.locator('.stage-chips>span').allTextContents();
    totals.forEach((n,i)=>assert(chips[i].endsWith('/'+n)));
    assert(await page.locator('.next-up').innerText().then(t=>t.includes('Positive Mental Attitude')));
    await page.locator('.trophy-list').evaluate(el=>el.scrollTop=0);
    const visibleRows = await page.locator('.trophy-row').evaluateAll((rows,height)=>rows.filter(row=>{const r=row.getBoundingClientRect(),list=row.parentElement.getBoundingClientRect();return r.top>=list.top && r.bottom<=Math.min(height,list.bottom);}).length,shot.viewport.height);
    assert(visibleRows>=8,`Cover needs 8 complete rows; got ${visibleRows}`);
    await page.waitForTimeout(3600);
  } else if (index === 1) {
    await page.waitForSelector('#counter');
    await page.locator('.spoiler-control').click();
    assert.equal(await page.locator('#spoilers').isChecked(), false);
    await page.locator('[data-kind="story"]').click();
    assert(await page.locator('#trophy-list').innerText().then(t=>t.includes('Hidden story trophy')));
    assert.equal(await page.locator('#counter').inputValue(),'0');
    assert(await page.locator('.guide-copy').innerText().then(t=>t.includes('[5]')));
    assert(await page.locator('#guide .source-block').innerText().then(t=>t.includes('retrieved 19 November 2026') && t.includes('https://')));
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
    assert(await page.locator('.route-card').last().evaluate((el,h)=>el.getBoundingClientRect().bottom<=h,shot.viewport.height));
    await page.waitForTimeout(3600);
  } else {
    assert.equal(await page.locator('.chapter-watch>div').count(),6);
    assert.equal(await page.locator('.research-hold>button').count(),3);
    assert(await page.locator('.watch-cards').innerText().then(t=>t.includes('Yago timed race') && t.includes('A Long Road') && t.includes('not a confirmed trophy lockout')));
    assert(await page.locator('.research-hold').evaluate((el,h)=>el.getBoundingClientRect().bottom<=h,shot.viewport.height));
  }
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'screenshots/'+shot.file,type:'jpeg',quality:85});
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
