import {readSave,persist,storageStatus,validateSave,exampleSave,emptySave,SAVE_KEY} from './store.js';

const app=document.querySelector('#app');
const icons={
  trophy:'<path d="M8 3h8v5a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v6m-4 3h8m-6-3h4"/>',
  route:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v6a3 3 0 0 0 3 3h6a3 3 0 0 0 0-6h-3"/>',
  flag:'<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  save:'<path d="M4 3h13l3 3v15H4V3Zm4 0v6h8V3M8 21v-7h8v7"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  pin:'<path d="m8 3 8 0-1 6 3 4H6l3-4-1-6Zm4 10v8"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]??icons.trophy}</svg>`;
const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
const format=n=>Number(n).toLocaleString('en-US');
const $=selector=>document.querySelector(selector);
const stageTitles=['Chapter 1 first','Story & early unlocks','Finish the narrative','100% with less repetition','Side stories & final audit'];
const views={tracker:'TROPHY TRACKER',roadmap:'PLATINUM ROUTE',missables:'MISSABLE WATCH',settings:'SAVE & SOURCES'};
const headings={tracker:'The platinum starts here.',roadmap:'Take the long way. Once.',missables:'Leave nothing to chance.',settings:'Keep your fieldnotes.'};
let data,trophies,save,sourceOrder,toastTimer,secondary;
let view=location.hash.slice(1).split('/')[0]||'tracker';
let selected=Number(location.hash.split('/')[1])||28;
let kind='all',grade='all',earnedFilter='all',query='';

function notify(message){
  const toast=$('#toast');toast.textContent=message;toast.classList.add('visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),3500);
}
function store(message){if(!persist(save))notify('Browser storage unavailable. Export a backup before closing.');else if(message)notify(message);}
function hidden(t){return t.kind==='story'&&!save.spoilers&&!save.earned.includes(t.id);}
function displayName(t){return hidden(t)?'Hidden story trophy':t.name;}
function sourceNumber(key){return sourceOrder.indexOf(key)+1;}
function numberedCitations(numbers=[]){return [...new Set(numbers)].sort((a,b)=>a-b).map(n=>`[${n}]`).join(' ');}
function citations(keys=[]){return numberedCitations(keys.map(sourceNumber));}
// Never promote trophy-level sources into evidence for an individual step.
function stepCitations(t,step){return [...new Set(step.cites)].filter(n=>t.sources.includes(sourceOrder[n-1]));}
function guideSteps(t){return `<ol class="guide-steps">${t.steps.map(s=>`<li>${escape(s.text)} <span class="citation">${numberedCitations(stepCitations(t,s))}</span></li>`).join('')}</ol>`;}
function sourceDate(key){const s=data.sources[key];return `Read ${Number(s.checked.slice(8))} Nov 2026 · ${s.check}`;}
function sourceLink(key){
  const s=data.sources[key],date=`${Number(s.checked.slice(8))} November 2026`;
  return `<a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">[${sourceNumber(key)}] ${escape(s.name)} ↗</a><span>${escape(s.url)} · read ${date} WIB · ${escape(s.check)}</span>`;
}
function sourceEntries(keys){return [...keys].sort((a,b)=>sourceNumber(a)-sourceNumber(b)).map(key=>`<div class="source-entry">${sourceLink(key)}</div>`).join('');}
function disagreement(t){
  if(!t.disagree)return '';
  return `<div class="risk-note disagreement"><strong>SOURCES DISAGREE · both versions shown</strong><p><b>${escape(t.disagree.topic)}</b></p>${t.disagree.versions.map(v=>`<p>${escape(v.text)} <span class="citation">${numberedCitations(v.cites)}</span></p>`).join('')}<p><b>VERDICT ·</b> ${escape(t.disagree.note)}</p></div>`;
}
function blockedList(){return `<section class="blocked-list"><b>RECHECKS / UNAVAILABLE</b>${sourceOrder.filter(k=>data.sources[k].check!=='Read successfully').map(k=>`<p>${escape(data.sources[k].name)} · ${escape(data.sources[k].check)}. Earlier read retained: ${data.sources[k].checked}.</p>`).join('')}<p>Exophase: earlier HTTP 403; web-reader recheck now accessible.</p></section>`;}
function sourcesRail(){return `<aside class="sources-rail panel" aria-label="Sources and guide coverage"><div class="panel-heading"><h2>SOURCES / ${sourceOrder.length}</h2></div><p class="rail-intro">Every step cites its evidence.<br>Scroll for all ${sourceOrder.length} pages.</p><div class="rail-entries">${sourceOrder.map(k=>`<div>${sourceEntries([k])}<small>${escape(sourceDate(k))}</small><p>cited by ${trophies.filter(t=>t.sources.includes(k)).length} of 55 guides</p></div>`).join('')}${blockedList()}</div></aside>`;}
function auditStrip(){
  const grades=['platinum','gold','silver','bronze'].map(g=>trophies.filter(t=>t.grade===g).length);
  const steps=trophies.flatMap(t=>t.steps),markers=trophies.flatMap(t=>t.steps.map(s=>stepCitations(t,s)));
  const covered=trophies.filter(t=>t.guide?.trim()&&t.sources.length).length;
  const read=Object.values(data.sources).filter(s=>s.check==='Read successfully').length;
  const average=(markers.reduce((n,c)=>n+c.length,0)/steps.length).toFixed(2);
  return `<div class="audit-strip"><b>AUDIT</b> · 55 official trophies: ${grades[0]} P · ${grades[1]} G · ${grades[2]} S · ${grades[3]} B · ${trophies.filter(t=>t.hidden===true).length} hidden on PSN · ${covered}/55 guides cite a source · ${markers.filter(c=>c.length).length}/${steps.length} steps cited · ${average} cites/step · ${trophies.filter(t=>new Set(t.sources).size===1).length} single-source · ${trophies.filter(t=>t.disagree).length} disputes shown both ways · ${trophies.filter(t=>t.missable==='potential').length} possibly missable · ${trophies.filter(t=>/unconfirmed/i.test(t.risk)).length} risk notes say “unconfirmed” · ${read} pages read 20 Nov 2026 · ${sourceOrder.length-read} rechecks unavailable</div>`;
}
function stageTotals(){return [1,2,3,4,5].map(stage=>{const group=trophies.filter(t=>t.stage===stage);return `<span>S${stage} <b>${group.filter(t=>save.earned.includes(t.id)).length}/${group.length}</b></span>`;}).join('');}
function stageCounters(stage){return ({1:[28],2:[54,55],3:[26,34,52],4:[15,16,17,18,19,30,31,32,35,40,42,43],5:[25,48,53]})[stage].map(id=>{const t=trophies[id-1];return `${format(save.counts[id]??0)}/${format(t.target)} ${t.unit}`;}).join(' · ');}
function nextTrophy(){
  const ordered=[trophies[27],...trophies.filter(t=>t.id!==28).sort((a,b)=>a.stage-b.stage||a.id-b.id)];
  const trophy=ordered.find(t=>!save.earned.includes(t.id));
  return trophy?{trophy,stage:{title:stageTitles[trophy.stage-1]},reason:trophy.missable==='potential'?'Protect its Chapter 1 opportunity; necessity remains unconfirmed.':'Continue with the first unfinished trophy in this stage.'}:null;
}
function nextUp(){const next=nextTrophy();return next?`<div class="next-up compact"><b>NEXT UP</b> · ${escape(displayName(next.trophy))} <span>· S${next.trophy.stage} · ${next.trophy.missable==='potential'?'protect the Chapter 1 opportunity':escape(next.stage.title)}</span></div>`:'<div class="next-up">All 55 trophies marked earned.</div>';}
function trophyChips(stage){return trophies.filter(t=>t.stage===stage).map(t=>`<span class="trophy-chip ${t.grade} ${save.earned.includes(t.id)?'earned':''}" title="${escape(displayName(t))}"><i>${t.grade[0].toUpperCase()}</i>${save.earned.includes(t.id)?'<span class="chip-check">✓</span>':''}<b>${escape(displayName(t))}</b>${t.missable==='potential'?'<em class="chip-missable">MISSABLE</em>':''}</span>`).join('');}
function badge(t){return `<span class="medal ${t.grade}" title="${t.grade}">${icon('trophy')}</span>`;}
function tag(text,tone=''){return `<span class="tag ${tone}">${escape(text)}</span>`;}

// Secondary routes load only when opened; the tracker needs neither their templates nor their styles.
async function renderSecondary(){
  const requested=view;
  secondary??=import('./views.js');
  const module=await secondary;
  if(view!==requested||view==='tracker')return;
  module.render(view,{data,trophies,save,icon,escape,format,citations,sourceEntries,sourceLink,guideSteps,disagreement,trophyChips,stageCounters,nextTrophy,displayName,tag,blockedList});
}
function shell(){
  const progress=Math.round(save.earned.length/55*100);
  app.innerHTML=`<aside class="sidebar"><a class="brand" href="#tracker"><span class="brand-mark">V<span>F</span></span><span>VICE<br><b>FIELDNOTES</b></span></a><div class="edition">GTA VI / PS5<br>INDEPENDENT FIELD GUIDE</div><nav aria-label="Main navigation">${[['tracker','trophy','Trophy tracker'],['roadmap','route','Platinum route'],['missables','flag','Missable watch'],['settings','save','Save & sources']].map(([key,img,label])=>`<a href="#${key}" class="nav-link ${view===key?'active':''}" ${view===key?'aria-current="page"':''}>${icon(img)}<span>${label}</span>${key==='missables'?'<i>1</i>':''}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="mini-art" aria-hidden="true"><span class="sun"></span><span class="water"></span><span class="road"></span></div><p class="smallcaps">LEONIDA, AT YOUR PACE.</p><p>Your progress stays here.<br>Your next move is yours.</p><span class="offline"><span></span> OFFLINE READY</span><p class="version">Launch edition · 20 Nov 2026</p></div></aside>
  <div class="workspace"><header class="topbar"><span class="breadcrumb">FIELD GUIDE <span>/</span> ${views[view]}</span><div class="top-actions">${save.demo?'<span class="demo-label">DEMO SAVE</span>':''}<span class="save-status">${storageStatus()?'● Saved in this browser':'○ Export to keep progress'}</span><button class="icon-button" data-action="export" title="Export a progress backup">${icon('save')}<span>Export</span></button><button class="icon-button" data-action="import">Import</button></div></header><main id="content">${auditStrip()}<section class="page-heading"><div><p class="eyebrow">${view==='tracker'?'55 TROPHIES. A PLAN FOR EVERY ONE.':'YOUR RUN, ORGANIZED.'}</p><h1>${headings[view]}</h1></div><label class="spoiler-control"><input type="checkbox" id="spoilers" ${save.spoilers?'checked':''}><span class="switch"></span><span>Story spoilers <b>${save.spoilers?'on':'off'}</b></span></label></section>
  <section class="stats" aria-label="Trophy progress"><div class="progress-stat"><span class="progress-numeral">${save.earned.length}<small>/ 55</small></span><div><strong>${progress}% of the way</strong><div class="progress-track"><span style="width:${progress}%"></span></div><span class="muted">${55-save.earned.length} trophies to your platinum</span></div></div><div class="grade-stat">${['platinum','gold','silver','bronze'].map(g=>`<div>${badge({grade:g})}<span><b>${trophies.filter(t=>t.grade===g&&save.earned.includes(t.id)).length}<small> / ${trophies.filter(t=>t.grade===g).length}</small></b><span>${g}</span></span></div>`).join('')}</div><div class="offline-stat">55 offline <span>0 online</span><small>1 platinum · 2 gold · 6 silver · 46 bronze</small></div></section><div id="view"></div></main><footer><span>VICE FIELDNOTES <b> / </b> Original guidance. Evidence beside every trophy.</span><span>Independent fan project · No account needed</span></footer></div><input type="file" id="import-file" accept=".json,application/json" hidden>`;
  if(view==='tracker')renderTracker();else renderSecondary().catch(error=>{if(view!=='tracker')$('#view').textContent='Could not open this view. Reload to try again.';console.error(error);});
}
function renderTracker(){
  const filters=[['all','All 55'],['story','Story'],['missable','Missable'],['disagree',`Disagree ${trophies.filter(t=>t.disagree).length}`],['collectibles','Collectibles'],['activities','Activities'],['side stories','Side stories'],['robberies','Robberies'],['completion','Completion']];
  $('#view').innerHTML=`<div class="tracker-cover">${nextUp()}<div class="stage-chips" aria-label="Trophy totals by stage">${stageTotals()}</div></div><div class="warning"><span class="warning-symbol">!</span><div><strong>Before you leave Chapter 1</strong><span>Accept Lucia’s balcony meditation at Jason’s house. Its trophy requirement is still unconfirmed; keep a save.</span></div><button data-open="28">Read the warning ${icon('arrow')}</button></div><section class="filterbar" aria-label="Trophy filters"><div class="search-field">${icon('search')}<input id="search" type="search" placeholder="Search trophies…" aria-label="Search visible trophies" value="${escape(query)}"><kbd>/</kbd></div><label class="sr-only" for="grade">Grade</label><select id="grade"><option value="all">All grades</option>${['platinum','gold','silver','bronze'].map(g=>`<option value="${g}" ${grade===g?'selected':''}>${g}</option>`).join('')}</select><label class="sr-only" for="earned-filter">Earned status</label><select id="earned-filter">${[['all','Any status'],['remaining','Remaining'],['earned','Earned'],['pinned','Bookmarked']].map(([v,l])=>`<option value="${v}" ${earnedFilter===v?'selected':''}>${l}</option>`).join('')}</select><button class="text-button" data-action="clear">Clear</button></section><div class="kind-tabs" role="group" aria-label="Filter by kind">${filters.map(([key,label])=>`<button data-kind="${key}" class="${kind===key?'selected':''}" aria-pressed="${kind===key}">${label}</button>`).join('')}</div><div class="tracker-grid"><section class="checklist panel" aria-label="Trophy checklist"><div class="panel-heading"><h2>THE CHECKLIST</h2><span id="results-count"></span></div><div id="trophy-list" class="trophy-list"></div><div class="list-footer"><span>${icon('check')} Browser-saved checkboxes & counters</span><span>Choose a trophy →</span></div></section><section id="guide" class="guide panel" aria-label="Selected trophy guide"></section>${sourcesRail()}</div>`;
  renderList();renderGuide();
}
function filteredTrophies(){
  const priority=[28,14,17,15,18,30,40,31];
  return trophies.filter(t=>(kind==='all'||(kind==='missable'?t.missable==='potential':kind==='disagree'?!!t.disagree:t.kind===kind))&&(grade==='all'||grade===t.grade)&&(earnedFilter==='all'||(earnedFilter==='earned'?save.earned.includes(t.id):earnedFilter==='remaining'?!save.earned.includes(t.id):save.pinned.includes(t.id)))&&(!query||(hidden(t)?'hidden story trophy':`${t.name} ${t.description} ${t.kind}`).toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>(priority.includes(a.id)?priority.indexOf(a.id)-100:a.id)-(priority.includes(b.id)?priority.indexOf(b.id)-100:b.id));
}
function renderList(){
  const list=filteredTrophies();$('#results-count').textContent=`${list.length} / 55 shown`;
  $('#trophy-list').innerHTML=list.length?list.map(t=>`<article class="trophy-row ${selected===t.id?'current':''} ${save.earned.includes(t.id)?'earned':''}"><label class="check-wrap"><input type="checkbox" data-earned="${t.id}" ${save.earned.includes(t.id)?'checked':''} aria-label="Mark ${escape(displayName(t))} earned"></label><button class="row-main" data-open="${t.id}" aria-pressed="${selected===t.id}"><span class="row-title">${escape(displayName(t))}${save.pinned.includes(t.id)?'<span class="pin-marker" title="Bookmarked">⌑</span>':''}</span><span class="row-description">${escape(hidden(t)?'Earn this trophy to reveal its story details.':t.description)}</span><span class="row-meta">${t.missable==='potential'?'<span class="risk-dot">POTENTIAL MISSABLE</span>':escape(t.kind.toUpperCase())}${t.hidden?'<span class="hidden-tag">PSN HIDDEN</span>':''}${t.target?`<span>${format(save.counts[t.id]??0)} / ${format(t.target)} ${escape(t.unit)}</span>`:''}${t.status==='unconfirmed'?'<span class="unconfirmed">UNCONFIRMED</span>':''}${t.disagree?'<span class="disagree-tag">SOURCES DISAGREE</span>':''}</span></button>${badge(t)}</article>`).join(''):'<div class="empty"><h3>No matching trophies</h3><p>Try another filter, or clear your search.</p><button data-action="clear">Show all 55</button></div>';
}
function renderGuide(){
  const t=trophies.find(t=>t.id===selected)??trophies[27],pane=$('#guide');if(!pane)return;
  if(hidden(t)){pane.innerHTML=`<div class="guide-top"><span class="eyebrow">STORY / SPOILERS PROTECTED</span>${badge(t)}</div><div class="protected">${icon('lock')}<h2>Let the story unfold.</h2><p>This trophy’s name, description, guide and notes stay hidden until you earn it. Record a verified unlock or enable story spoilers when you’re ready.</p></div>`;return;}
  const count=save.counts[t.id]??0,refs=citations(t.sources),earned=save.earned.includes(t.id),pinned=save.pinned.includes(t.id);
  const counter=t.target?`<div class="counter"><label for="counter">Your count <span>/ ${format(t.target)} ${escape(t.unit)}</span></label><div><button data-count="-1" aria-label="Decrease counter">−</button><input id="counter" type="number" min="0" max="${t.target}" step="1" value="${count}" aria-label="${escape(t.unit)} completed"><button data-count="1" aria-label="Increase counter">+</button><span>${Math.round(count/t.target*100)}%</span></div></div>`:'';
  pane.innerHTML=`<div class="guide-top"><span class="eyebrow">FIELDNOTE ${String(t.id).padStart(2,'0')} / ${escape(t.kind.toUpperCase())}</span><button class="pin-button ${pinned?'is-pinned':''}" data-pin="${t.id}" aria-label="${pinned?'Remove bookmark':'Bookmark trophy'}" aria-pressed="${pinned}">${icon('pin')}</button></div><div class="guide-title">${badge(t)}<div><h2>${escape(t.name)}</h2><span class="grade-label">${t.grade} trophy ${earned?'· EARNED ✓':''}</span></div></div><p class="official-description">“${escape(t.description)}” <span class="citation">[1]</span></p><div class="guide-tags">${t.missable==='potential'?tag('Potential missable','danger'):tag(t.status??'Source-reported','sage')}${t.hidden?tag('PSN hidden'):''}${t.disagree?tag('SOURCES DISAGREE','disagree-tag'):''}${tag('Source recheck · 20 Nov 2026')}</div>${counter}<div class="guide-scroll">${guideSteps(t)}${disagreement(t)}<div class="risk-note"><strong>${t.missable==='potential'?'DON’T MISS THE OPPORTUNITY':'WHEN & MISSABILITY'}</strong><p>${escape(t.risk)} <span class="citation">${refs}</span></p></div><div class="source-block"><strong>EVIDENCE & SOURCES</strong>${sourceEntries(t.sources)}</div><details class="notes" ${save.notes[t.id]?'open':''}><summary>Personal notes ${save.notes[t.id]?'· saved':'+ add a note'}</summary><textarea id="notes" maxlength="4000" placeholder="Your route, discoveries or a reminder…" aria-label="Personal notes for ${escape(t.name)}">${escape(save.notes[t.id]??'')}</textarea></details><label class="complete-button"><input type="checkbox" data-earned="${t.id}" ${earned?'checked':''}>${earned?'Earned on PS5':'Mark earned on PS5'}</label></div>`;
}
function openTrophy(id){
  selected=Number(id);if(!trophies.some(t=>t.id===selected))selected=28;
  if(view!=='tracker'){location.hash=`tracker/${selected}`;window.scrollTo(0,0);return;}
  history.replaceState(null,'',`#tracker/${selected}`);renderList();renderGuide();
}
function exportSave(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)+'\n'],{type:'application/json'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='vice-fieldnotes-progress.json';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  try{localStorage.setItem('vice-fieldnotes.last-export',JSON.stringify({file:anchor.download,trophies:save.earned.length,at:new Date().toISOString()}));}catch{}
  if(view==='settings')renderSecondary();notify('Backup exported. Keep this JSON file for another browser.');
}
app.addEventListener('click',event=>{
  const open=event.target.closest('[data-open]');if(open){openTrophy(open.dataset.open);return;}
  const filter=event.target.closest('[data-kind]');if(filter){kind=filter.dataset.kind;renderTracker();return;}
  const pin=event.target.closest('[data-pin]');if(pin){const id=Number(pin.dataset.pin);save.pinned=save.pinned.includes(id)?save.pinned.filter(n=>n!==id):[...save.pinned,id];store();renderGuide();renderList();return;}
  const count=event.target.closest('[data-count]');if(count){const t=trophies[selected-1];save.counts[t.id]=Math.max(0,Math.min(t.target,(save.counts[t.id]??0)+Number(count.dataset.count)));store();renderGuide();renderList();return;}
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='export')exportSave();
  if(action==='import')$('#import-file').click();
  if(action==='clear'){kind=grade=earnedFilter='all';query='';renderTracker();}
  if(action==='demo'&&confirm('Replace current progress with a labelled demo save? Export first to keep a backup.')){save=exampleSave(trophies);store('Demo save loaded.');shell();}
  if(action==='reset'&&confirm('Clear trophies, counters and notes? Export first to keep a backup.')){save=emptySave();store('Fresh tracker ready.');shell();}
});
app.addEventListener('input',event=>{
  if(event.target.id==='search'){query=event.target.value;renderList();}
  if(event.target.id==='notes'){save.notes[selected]=event.target.value;store();}
});
app.addEventListener('change',async event=>{
  const el=event.target;
  if(el.dataset.earned){const id=Number(el.dataset.earned);save.earned=save.earned.filter(n=>n!==id);if(el.checked){save.earned.push(id);const t=trophies[id-1];if(t.target)save.counts[id]=t.target;}store();shell();}
  if(el.id==='spoilers'){save.spoilers=el.checked;store();shell();}
  if(el.id==='grade'){grade=el.value;renderList();}
  if(el.id==='earned-filter'){earnedFilter=el.value;renderList();}
  if(el.id==='chapter'){save.chapter=Number(el.value);store();}
  if(el.id==='counter'){
    const t=trophies[selected-1],value=Number(el.value);
    if(!Number.isInteger(value)||value<0||value>t.target){notify(`Enter a whole number from 0 to ${format(t.target)}.`);el.value=save.counts[t.id]??0;return;}
    save.counts[t.id]=value;store();renderGuide();renderList();
  }
  if(el.dataset.task){save.tasks=save.tasks.filter(t=>t!==el.dataset.task);if(el.checked)save.tasks.push(el.dataset.task);store();renderSecondary();}
  if(el.id==='import-file'&&el.files[0]){
    try{
      if(el.files[0].size>1000000)throw Error('Backup is too large (maximum 1 MB).');
      const candidate=validateSave(JSON.parse(await el.files[0].text()),trophies);
      if(confirm(`Import ${candidate.earned.length} earned trophies, ${Object.keys(candidate.notes).length} notes and ${Object.keys(candidate.counts).length} counters? This replaces current progress.`)){save=candidate;store(`Imported ${save.earned.length} earned · ${Object.keys(save.counts).length} counters`);shell();}
    }catch(error){notify(`Import rejected: ${error.message}`);}el.value='';
  }
});
window.addEventListener('hashchange',()=>{const [next,id]=location.hash.slice(1).split('/');view=views[next]?next:'tracker';if(id&&trophies.some(t=>t.id===Number(id)))selected=Number(id);shell();});
window.addEventListener('storage',event=>{if(event.key===SAVE_KEY){save=readSave(trophies);shell();notify('Tracker updated from another tab.');}});
window.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){const search=$('#search');if(search){event.preventDefault();search.focus();}}});
try{
  const response=await fetch('./data/trophies.json');if(!response.ok)throw Error(`Data file returned ${response.status}`);
  data=await response.json();trophies=data.trophies;sourceOrder=Object.keys(data.sources);save=readSave(trophies);
  if(!views[view])view='tracker';shell();
}catch(error){app.innerHTML='<main class="loading"><h1>Could not open the local guide.</h1><p>Serve app/ with a static server, then reload.</p></main>';console.error(error);}
