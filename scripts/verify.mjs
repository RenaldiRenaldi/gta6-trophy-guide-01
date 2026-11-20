// Uses an existing Playwright module and cached Chromium; installs nothing.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, extname } from 'node:path';
import { once } from 'node:events';
import { gzipSync } from 'node:zlib';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=process.env.APP_URL??'http://127.0.0.1:8080';
const audit=JSON.parse(await readFile('app/data/trophies.json','utf8'));
const shots=JSON.parse(await readFile('shots.json','utf8'));
const keys=Object.keys(audit.sources),trophies=audit.trophies;
const steps=trophies.flatMap(t=>t.steps),markers=steps.reduce((n,s)=>n+new Set(s.cites).size,0);
const average=(markers/steps.length).toFixed(2),multiple=steps.filter(s=>new Set(s.cites).size>=2).length;
assert.equal(trophies.length,55);
assert(steps.length>=210&&steps.length<=240);
assert(markers/steps.length>=1.9&&markers/steps.length<=2.4);
assert(multiple/steps.length>=.6);
assert.equal(keys.length,36);
assert.equal(new Set(Object.values(audit.sources).map(s=>s.url)).size,36);
assert.equal(trophies.filter(t=>t.disagree).length,12);
assert.equal(trophies.filter(t=>t.hidden===true).length,28);
assert.equal(trophies.filter(t=>t.target).length,21);
assert.equal(trophies.filter(t=>/unconfirmed/i.test(t.risk)).length,3);
for(const t of trophies){
  assert.equal(typeof t.hidden,'boolean');
  assert(t.guide.trim()&&t.sources.length&&t.steps.length===4);
  for(const s of t.steps){assert(s.text.trim()&&s.cites.length);assert(s.cites.every(n=>Number.isInteger(n)&&t.sources.includes(keys[n-1])));}
  if(t.disagree)for(const v of t.disagree.versions)assert(v.text.trim()&&v.cites.every(n=>t.sources.includes(keys[n-1])));
}
// Same per-file gzip-9 convention as the kit's static first-load walk.
const initial=['index.html','style.css','app.js','store.js'];
let gzip=0;
for(const f of initial)gzip+=gzipSync(await readFile('app/'+f),{level:9}).length;
assert(gzip<=16384,`Static first load ${gzip} > 16384`);
const dataGzip=gzipSync(await readFile('app/data/trophies.json'),{level:9}).length;
assert(dataGzip<=16384);
assert((await stat('.makefun/owner.json')).isFile());
const readme=await readFile('README.md','utf8');
assert(readme.includes('https://make.fun/bounty/gta6-trophy-guide-01')&&readme.includes('/rank.svg')&&readme.includes('/reward.svg'));

// The CLI owns JPEG output. CDP imports an actual backup while a pending image
// holds the load event; releasing it lets headless Chromium capture the view.
async function capture(shot,index,sample){
  let release;
  const root=new URL('../app/',import.meta.url);
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/__hold.gif'){release=()=>{res.writeHead(200,{'Content-Type':'image/gif'});res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64'));};return;}
    try{
      const file=new URL('.'+(path==='/'?'/index.html':path),root);
      if(!file.href.startsWith(root.href))throw Error('Outside app');
      let body=await readFile(file);
      if(path==='/')body=Buffer.from(body.toString().replace('</body>','<img src="/__hold.gif" alt="" style="position:absolute;width:1px;height:1px;opacity:0"></body>'));
      res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[extname(file.pathname)]??'application/octet-stream')});res.end(body);
    }catch{res.writeHead(404).end();}
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const chrome=spawn(process.env.CHROME_PATH??chromium.executablePath(),['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-proxy-server','--hide-scrollbars','--remote-debugging-port=0','--force-device-scale-factor=1',`--user-data-dir=/tmp/vice-capture-${process.pid}-${index}`,`--window-size=${shot.viewport.width},${shot.viewport.height}`,`--screenshot=${resolve('screenshots',shot.file)}`,`http://127.0.0.1:${server.address().port}${shot.path}`],{stdio:['ignore','ignore','pipe']});
  const completed=once(chrome,'exit');let log='';
  const endpoint=await new Promise((done,reject)=>{
    const timer=setTimeout(()=>reject(Error('CDP startup timeout')),15000);
    chrome.once('error',reject);chrome.stderr.on('data',chunk=>{log+=chunk;const m=log.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);done(m[1]);}});
  });
  const browser=await chromium.connectOverCDP(endpoint).catch(error=>{console.error(log);throw error;});
  try{
    const context=browser.contexts()[0],page=context.pages()[0]??await context.waitForEvent('page');
    page.on('pageerror',error=>errors.push(error.message));
    await page.setViewportSize(shot.viewport);await page.waitForSelector('.audit-strip');
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#import-file').setInputFiles({name:'vice-fieldnotes-example.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...sample,spoilers:index!==1}))});
    if(index===1){await page.locator('[data-kind="disagree"]').click();assert((await page.locator('#toast').innerText()).startsWith('Imported '));}
    else await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('visible')&&getComputedStyle(document.querySelector('#toast')).opacity==='0');
    if(index===2)await page.waitForSelector('.route-card');
    if(index===3)await page.waitForSelector('.research-hold');
    await page.waitForTimeout(150);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.evaluate(()=>scrollTo(0,0));
    assert(release,'Load barrier missing');
    const written=new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Screenshot timeout')),15000);const check=()=>{if(/\d+ bytes written to file/.test(log)){clearTimeout(timer);done();}};chrome.stderr.on('data',check);check();});
    release();await written;await browser.close();if(chrome.exitCode===null)chrome.kill('SIGTERM');
    const [code,signal]=await completed;assert(code===0||signal==='SIGTERM',log);
  }finally{await browser.close().catch(()=>{});if(chrome.exitCode===null)chrome.kill();server.closeAllConnections();server.close();}
}

const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const context=await browser.newContext({viewport:shots[0].viewport,deviceScaleFactor:1});
const page=await context.newPage(),errors=[],external=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));
await context.route('**/*',route=>{const url=route.request().url();requests.push(url);if(!url.startsWith(base+'/')&&!url.startsWith('data:')&&!url.startsWith('blob:')){external.push(url);return route.abort();}return route.continue();});
await page.goto(base);await page.waitForSelector('.trophy-row');
assert(!requests.some(url=>/views\.(js|css)|roadmap\.js/.test(url)),'Secondary routes must be deferred');
assert.equal(await page.locator('.trophy-row').count(),55);
assert.equal(await page.locator('#spoilers').isChecked(),false);
await page.locator('[data-kind="story"]').click();assert.equal(await page.locator('.trophy-row').count(),12);
assert(!(await page.locator('#trophy-list').innerText()).includes('Snow Storm'));
await page.locator('.row-main').first().click();assert((await page.locator('#guide').innerText()).includes('Let the story unfold.'));
await page.locator('.trophy-row input').first().check();
await page.reload();await page.waitForSelector('.trophy-row');assert(await page.locator('[data-earned="2"]').first().isChecked());
await page.locator('[data-kind="collectibles"]').click();assert(await page.locator('.trophy-row').count()>5);
await page.locator('#search').fill('not-a-real-trophy');assert.equal(await page.locator('.trophy-row').count(),0);
await page.locator('[data-action="clear"]').first().click();await page.locator('[data-open="17"]').last().click();
await page.locator('#counter').fill('19');await page.locator('#counter').dispatchEvent('change');
await page.locator('.notes summary').click();await page.locator('#notes').fill('Browser test note <safe>');
await page.reload();await page.waitForSelector('#counter');assert.equal(await page.locator('#counter').inputValue(),'19');assert.equal(await page.locator('#notes').inputValue(),'Browser test note <safe>');
let downloaded=page.waitForEvent('download');await page.locator('[data-action="export"]').click();
const payload=await readFile(await(await downloaded).path(),'utf8');assert.equal(JSON.parse(payload).counts['17'],19);assert.equal(JSON.parse(payload).notes['17'],'Browser test note <safe>');
page.once('dialog',d=>d.accept());await page.locator('#import-file').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(payload)});
await page.waitForFunction(()=>document.querySelector('#toast').textContent.startsWith('Imported'));
await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":99}')});
await page.waitForFunction(()=>document.querySelector('#toast').textContent.startsWith('Import rejected'));
assert.equal(await page.locator('#counter').inputValue(),'19');
await page.goto(base+'/#settings');await page.waitForSelector('[data-action="demo"]');
page.once('dialog',d=>d.accept());await page.locator('[data-action="demo"]').click();await page.waitForSelector('.demo-label');
downloaded=page.waitForEvent('download');await page.locator('.backup-actions [data-action="export"]').click();
const sample=JSON.parse(await readFile(await(await downloaded).path(),'utf8'));assert(sample.demo);assert.equal(sample.counts['17'],0);
await page.waitForFunction(n=>document.querySelector('.export-receipt')?.textContent.includes(`${n} trophies`),sample.earned.length);
await page.goto(base+'/#tracker/28');await page.waitForSelector('.sources-rail');
assert.equal(await page.locator('.rail-entries>div').count(),36);
for(const [i,key]of keys.entries()){
  const text=await page.locator('.rail-entries>div').nth(i).innerText();
  assert(text.includes(`cited by ${trophies.filter(t=>t.sources.includes(key)).length} of 55 guides`));
  assert(text.includes(`${Number(audit.sources[key].checked.slice(8))} Nov 2026`));
}
await page.locator('[data-kind="disagree"]').click();assert.equal(await page.locator('.trophy-row').count(),12);
await page.locator('[data-action="clear"]').first().click();
if(!await page.locator('#spoilers').isChecked())await page.locator('.spoiler-control').click();
let displayed=0,multiDisplayed=0;
for(const t of trophies){
  await page.locator(`.row-main[data-open="${t.id}"]`).click();
  const rendered=await page.locator('#guide .guide-steps .citation').allTextContents();
  assert.equal(rendered.length,t.steps.length);
  for(const [i,text]of rendered.entries()){
    const actual=[...text.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1]));
    assert.deepEqual(actual,[...new Set(t.steps[i].cites)].sort((a,b)=>a-b));
    displayed+=actual.length;if(actual.length>=2)multiDisplayed++;
  }
  assert.equal(await page.locator('#guide .disagreement').count(),t.disagree?1:0);
}
assert.equal(displayed,markers);assert.equal(multiDisplayed,multiple);
assert.equal(await page.locator('.hidden-tag').count(),28);
for(const [index,shot]of shots.entries()){
  const {width,height}=shot.viewport;assert(Math.max(width,height)<=1280&&Math.min(width,height)>=480);
  await page.setViewportSize(shot.viewport);await page.goto(base+shot.path);await page.waitForSelector('.audit-strip');
  const text=await page.locator('.audit-strip').innerText();
  for(const expected of ['55/55 guides cite a source','28 hidden on PSN',`${steps.length}/${steps.length} steps cited`,`${average} cites/step`,'12 disputes shown both ways','0 single-source','34 pages read'])assert(text.includes(expected),expected);
  if(index===0){
    await page.waitForSelector('#counter');assert.equal(await page.locator('#counter').inputValue(),'7');assert.equal(await page.locator('.stage-chips>span').count(),5);
    const totals=[6,9,9,23,8],chips=await page.locator('.stage-chips>span').allTextContents();totals.forEach((n,i)=>assert(chips[i].endsWith('/'+n)));
    const visible=await page.locator('.trophy-row').evaluateAll(rows=>rows.filter(row=>{const r=row.getBoundingClientRect(),p=row.parentElement.getBoundingClientRect();return r.top>=p.top&&r.bottom<=Math.min(innerHeight,p.bottom);}).length);assert(visible>=8,`Only ${visible} complete rows`);
  }else if(index===1){
    await page.waitForSelector('#counter');assert.equal(await page.locator('#counter').inputValue(),'0');
    assert((await page.locator('.guide-steps').innerText()).includes('[5]'));
    if(await page.locator('#spoilers').isChecked())await page.locator('.spoiler-control').click();
    await page.locator('[data-kind="disagree"]').click();assert((await page.locator('#trophy-list').innerText()).includes('Hidden story trophy'));
  }else if(index===2){
    if(!await page.locator('#spoilers').isChecked())await page.locator('.spoiler-control').click();
    await page.waitForSelector('.route-card');assert.equal(await page.locator('.route-card').count(),5);assert.equal(await page.locator('.trophy-chip').count(),55);assert.equal(await page.locator('.route-hours').count(),5);assert.equal(await page.locator('.target-panel tbody tr').count(),9);
    const chip=page.locator('.trophy-chip').filter({hasText:'Top Of The World, Ma'});assert.equal(await chip.count(),1);assert(await chip.locator('b').evaluate(el=>el.scrollWidth<=el.clientWidth));
  }else{
    await page.waitForSelector('.research-hold');assert.equal(await page.locator('.chapter-watch>div').count(),6);assert.equal(await page.locator('.research-hold>button').count(),3);
    const hold=await page.locator('.research-hold').innerText();assert(hold.includes('one method remains unknown')&&hold.includes('NEW METHOD [2]'));
    assert(await page.locator('.research-hold').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight));
  }
  if((process.env.CAPTURE_SHOTS??'').split(',').includes(String(index+1))){await capture(shot,index,sample);console.log(`CAPTURE ${shot.file}`);}
}
for(const route of ['tracker/28','roadmap','missables','settings']){
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/#'+route);
  await page.waitForSelector(route.startsWith('tracker')?'.guide-title':route==='roadmap'?'.route-card':route==='missables'?'.research-hold':'.save-panel');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Mobile overflow ${route}`);
}
for(const shot of shots){
  const jpeg=await readFile('screenshots/'+shot.file);assert(jpeg.length<=262144);assert.equal(jpeg[0],255);assert.equal(jpeg[1],216);
  let width,height;
  for(let p=2;p<jpeg.length;){assert.equal(jpeg[p],255);const marker=jpeg[p+1],length=jpeg.readUInt16BE(p+2);if([192,193,194].includes(marker)){height=jpeg.readUInt16BE(p+5);width=jpeg.readUInt16BE(p+7);break;}p+=length+2;}
  assert.equal(width,shot.viewport.width);assert.equal(height,shot.viewport.height);assert(Math.max(width,height)<=1280&&Math.min(width,height)>=480);
}
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
console.log(`PASS: 55 guides; ${steps.length} steps; ${displayed} displayed citations (${average}/step); ${multiDisplayed}/${steps.length} multi-cited; 28 hidden; 36 sources; 12 disputes; static gzip ${gzip} B; data gzip ${dataGzip} B. Browser persistence, import/export, spoilers, routes, mobile, requests and screenshot gates passed.`);
await browser.close();
