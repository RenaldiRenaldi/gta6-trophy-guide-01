import { readSave, persist, storageStatus, validateSave, exampleSave, emptySave, SAVE_KEY } from './store.js';
import { routeStages, targetComparison } from './roadmap.js';

const app = document.querySelector('#app');
const icons = {
  trophy: '<path d="M8 3h8v5a4 4 0 0 1-8 0V3Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v6m-4 3h8m-6-3h4"/>',
  route: '<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v6a3 3 0 0 0 3 3h6a3 3 0 0 0 0-6h-3"/>',
  flag: '<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
  save: '<path d="M4 3h13l3 3v15H4V3Zm4 0v6h8V3M8 21v-7h8v7"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  pin: '<path d="m8 3 8 0-1 6 3 4H6l3-4-1-6Zm4 10v8"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] ?? icons.trophy}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const format = number => Number(number).toLocaleString('en-US');
// Route and selected trophy share a hash, so every fieldnote is directly linkable.
let data, trophies, save;
let view = location.hash.slice(1).split('/')[0] || 'tracker';
let selected = Number(location.hash.split('/')[1]) || 28;
let kind = 'all', grade = 'all', earnedFilter = 'all', query = '';
let toastTimer;
const sourceOrder = ['official','roadmap','completion','meditation','range','drone','races','cards','strangers','andy','andyFinal','billy','tyrone','bret','banks','garages','moses','landmarks'];

function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3500);
}

function store(message) {
  const okay = persist(save);
  if (!okay) notify('Browser storage unavailable. Export a backup before closing.');
  else if (message) notify(message);
}

function hidden(trophy) { return trophy.kind === 'story' && !save.spoilers && !save.earned.includes(trophy.id); }
function displayName(trophy) { return hidden(trophy) ? 'Hidden story trophy' : trophy.name; }
function sourceNumber(key) { return sourceOrder.indexOf(key) + 1; }
function citations(keys = []) { return [...keys].sort((a,b) => sourceNumber(a)-sourceNumber(b)).map(key => `[${sourceNumber(key)}]`).join(' '); }
function sourceLink(key) {
  const source = data.sources[key];
  const title = source.name.replace(' · ', ' — GTA 6 ');
  return `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">[${sourceNumber(key)}] ${escape(title)} ↗</a><span>${escape(source.url)} · ${key === 'official' ? 'checked 20 November 2026; HTTP 403, kit metadata retained' : 'read 20 November 2026'}</span>`;
}
function sourceEntries(keys) {
  return [...keys].sort((a,b) => sourceNumber(a)-sourceNumber(b)).map(key => `<div class="source-entry">${sourceLink(key)}</div>`).join('');
}
function numberedCitations(numbers = []) {
  return [...new Set(numbers)].sort((a,b) => a-b).map(n => `[${n}]`).join(' ');
}
function guideSteps(t) {
  return `<ol class="guide-steps">${t.steps.map(s => `<li>${escape(s.text)} <span class="citation">${numberedCitations(s.cites)}</span></li>`).join('')}</ol>`;
}
function disagreement(t) {
  if (!t.disagree) return '';
  return `<div class="risk-note disagreement"><strong>SOURCES DISAGREE · both versions shown</strong><p><b>${escape(t.disagree.topic)}</b></p>${t.disagree.versions.map(v => `<p>${escape(v.text)} <span class="citation">${numberedCitations(v.cites)}</span></p>`).join('')}<p>${escape(t.disagree.note)}</p></div>`;
}
function sourceCoverage(key) { return trophies.filter(t => t.sources.includes(key)).length; }
function sourcesRail() {
  return `<aside class="sources-rail panel" aria-label="Sources and guide coverage"><div class="panel-heading"><h2>SOURCES / ${sourceOrder.length}</h2></div><p class="rail-intro">Every step cites its evidence.<br>Scroll for all 18 pages.</p><div class="rail-entries">${sourceOrder.map(key => `<div>${sourceEntries([key])}<small>${key === 'official' ? 'Checked 20 Nov 2026 · HTTP 403' : 'Read 20 Nov 2026'}</small><p>cited by ${sourceCoverage(key)} of ${trophies.length} guides</p></div>`).join('')}</div></aside>`;
}
function auditStrip() {
  const grades = Object.fromEntries(['platinum','gold','silver','bronze'].map(g => [g, trophies.filter(t => t.grade === g).length]));
  const covered = trophies.filter(t => typeof t.guide === 'string' && t.guide.trim() && Array.isArray(t.sources) && t.sources.length > 0).length;
  const steps = trophies.flatMap(t => t.steps ?? []);
  const readSources = Object.values(data.sources).filter(s => s.check === 'Read successfully').length;
  const restrictedSources = sourceOrder.length - readSources;
  const citedSteps = trophies.reduce((total,t) => total + (t.steps ?? []).filter(s => s.cites?.length && s.cites.every(n => t.sources.includes(sourceOrder[n-1]))).length, 0);
  const singleSource = trophies.filter(t => new Set(t.sources).size === 1).length;
  const disagreements = trophies.filter(t => t.disagree).length;
  const potential = trophies.filter(t => t.missable === 'potential').length;
  const unconfirmed = trophies.filter(t => (t.risk ?? '').toLowerCase().includes('unconfirmed')).length;
  return `<div class="audit-strip"><b>AUDIT</b> · ${trophies.length} official trophies: ${grades.platinum} P · ${grades.gold} G · ${grades.silver} S · ${grades.bronze} B · 28 hidden on PSN · ${covered}/${trophies.length} guides cite a source · ${citedSteps}/${steps.length} steps cited · ${singleSource} single-source · ${disagreements} disagree · ${potential} possibly missable · ${unconfirmed} risk notes say “unconfirmed” · ${readSources} sources read 20 Nov 2026 · ${restrictedSources} access-restricted</div>`;
}
function stageTotals() {
  return [1, 2, 3, 4, 5].map(stage => {
    const group = trophies.filter(t => t.stage === stage);
    const earned = group.filter(t => save.earned.includes(t.id)).length;
    return `<span>S${stage} <b>${earned}/${group.length}</b></span>`;
  }).join('');
}
function routeOrderedTrophies() {
  const protect = trophies.find(t => t.id === 28);
  return [protect, ...trophies.filter(t => t.id !== 28).sort((a, b) => a.stage - b.stage || a.id - b.id)];
}
function nextTrophy() {
  const trophy = routeOrderedTrophies().find(t => !save.earned.includes(t.id));
  if (!trophy) return null;
  const stage = routeStages[trophy.stage - 1];
  const reason = trophy.missable === 'potential'
    ? 'Protect its Chapter 1 opportunity; necessity remains unconfirmed.'
    : 'Continue with the first unfinished trophy in this stage.';
  return { trophy, stage, reason };
}
function nextUp(compact = false) {
  const next = nextTrophy();
  if (!next) return '<div class="next-up"><b>NEXT UP</b> · All 55 trophies marked earned.</div>';
  return `<div class="next-up ${compact ? 'compact' : ''}"><b>NEXT UP</b> · ${escape(displayName(next.trophy))} <span>· S${next.trophy.stage} · ${compact ? (next.trophy.missable === 'potential' ? 'protect the Chapter 1 opportunity' : escape(next.stage.title)) : escape(next.stage.title)}</span>${compact ? '' : `<small>${escape(next.reason)}</small>`}</div>`;
}
function trophyChips(stage) {
  return trophies.filter(t => t.stage === stage).map(t => {
    const earned = save.earned.includes(t.id);
    return `<span class="trophy-chip ${t.grade} ${earned ? 'earned' : ''}" title="${escape(t.name)}"><i>${t.grade[0].toUpperCase()}</i>${earned ? '<span class="chip-check">✓</span>' : ''}<b>${escape(displayName(t))}</b></span>`;
  }).join('');
}
function badge(trophy) { return `<span class="medal ${trophy.grade}" title="${trophy.grade}">${icon('trophy')}</span>`; }
function tag(text, tone = '') { return `<span class="tag ${tone}">${escape(text)}</span>`; }

function shell() {
  const progress = Math.round(save.earned.length / 55 * 100);
  app.innerHTML = `<aside class="sidebar">
    <a class="brand" href="#tracker"><span class="brand-mark">V<span>F</span></span><span>VICE<br><b>FIELDNOTES</b></span></a>
    <div class="edition">GTA VI / PS5<br>INDEPENDENT FIELD GUIDE</div>
    <nav aria-label="Main navigation">${[['tracker','trophy','Trophy tracker'],['roadmap','route','Platinum route'],['missables','flag','Missable watch'],['settings','save','Save & sources']].map(([key, img, label]) => `<a href="#${key}" class="nav-link ${view === key ? 'active' : ''}" ${view === key ? 'aria-current="page"' : ''}>${icon(img)}<span>${label}</span>${key === 'missables' ? '<i>1</i>' : ''}</a>`).join('')}</nav>
    <div class="sidebar-bottom"><div class="mini-art" aria-hidden="true"><span class="sun"></span><span class="water"></span><span class="road"></span></div><p class="smallcaps">LEONIDA, AT YOUR PACE.</p><p>Your progress stays here.<br>Your next move is yours.</p><span class="offline"><span></span> OFFLINE READY</span><p class="version">Launch edition · 20 Nov 2026</p></div>
  </aside>
  <div class="workspace"><header class="topbar"><span class="breadcrumb">FIELD GUIDE <span>/</span> ${escape({tracker:'TROPHY TRACKER',roadmap:'PLATINUM ROUTE',missables:'MISSABLE WATCH',settings:'SAVE & SOURCES'}[view])}</span><div class="top-actions">${save.demo ? '<span class="demo-label">DEMO SAVE</span>' : ''}<span class="save-status">${storageStatus() ? '● Saved in this browser' : '○ Export to keep progress'}</span><button class="icon-button" data-action="export" title="Export a progress backup">${icon('save')}<span>Export</span></button><button class="icon-button" data-action="import">Import</button></div></header>
    <main id="content">${auditStrip()}<section class="page-heading"><div><p class="eyebrow">${view === 'tracker' ? '55 TROPHIES. A PLAN FOR EVERY ONE.' : 'YOUR RUN, ORGANIZED.'}</p><h1>${{tracker:'The platinum starts here.',roadmap:'Take the long way. Once.',missables:'Leave nothing to chance.',settings:'Keep your fieldnotes.'}[view]}</h1></div><label class="spoiler-control"><input type="checkbox" id="spoilers" ${save.spoilers ? 'checked' : ''}><span class="switch"></span><span>Story spoilers <b>${save.spoilers ? 'on' : 'off'}</b></span></label></section>
    <section class="stats" aria-label="Trophy progress"><div class="progress-stat"><span class="progress-numeral">${save.earned.length}<small>/ 55</small></span><div><strong>${progress}% of the way</strong><div class="progress-track"><span style="width:${progress}%"></span></div><span class="muted">${55 - save.earned.length} trophies to your platinum</span></div></div><div class="grade-stat">${['platinum','gold','silver','bronze'].map(g => `<div>${badge({grade:g})}<span><b>${trophies.filter(t => t.grade === g && save.earned.includes(t.id)).length}<small> / ${trophies.filter(t => t.grade === g).length}</small></b><span>${g}</span></span></div>`).join('')}</div><div class="offline-stat">55 offline <span>0 online</span><small>1 platinum · 2 gold · 6 silver · 46 bronze</small></div></section>
    <div id="view"></div></main><footer><span>VICE FIELDNOTES <b> / </b> Original guidance. Evidence beside every trophy.</span><span>Independent fan project · No account needed</span></footer></div>
    <input type="file" id="import-file" accept=".json,application/json" hidden>`;
  if (view === 'tracker') renderTracker();
  if (view === 'roadmap') renderRoadmap();
  if (view === 'missables') renderMissables();
  if (view === 'settings') renderSettings();
}

function warning(compact = false) {
  return `<div class="warning"><span class="warning-symbol">!</span><div><strong>Before you leave Chapter 1</strong><span>${compact ? 'Positive Mental Attitude has one potential missable. Protect the balcony meditation.' : 'Accept Lucia’s balcony meditation at Jason’s house. Its trophy requirement is still unconfirmed; keep a save.'}</span></div><button data-open="28">Read the warning ${icon('arrow')}</button></div>`;
}

function renderTracker() {
  document.querySelector('#view').innerHTML = `<div class="tracker-cover">${nextUp(true)}<div class="stage-chips" aria-label="Trophy totals by stage">${stageTotals()}</div></div>${warning()}<section class="filterbar" aria-label="Trophy filters"><div class="search-field">${icon('search')}<input id="search" type="search" placeholder="Search trophies…" aria-label="Search visible trophies" value="${escape(query)}"><kbd>/</kbd></div><label class="sr-only" for="grade">Grade</label><select id="grade"><option value="all">All grades</option>${['platinum','gold','silver','bronze'].map(g => `<option value="${g}" ${grade === g ? 'selected' : ''}>${g[0].toUpperCase()+g.slice(1)}</option>`).join('')}</select><label class="sr-only" for="earned-filter">Earned status</label><select id="earned-filter">${[['all','Any status'],['remaining','Remaining'],['earned','Earned'],['pinned','Bookmarked']].map(([v,l]) => `<option value="${v}" ${earnedFilter === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="text-button" data-action="clear">Clear</button></section><div class="kind-tabs" role="group" aria-label="Filter by kind">${[['all','All 55'],['story','Story'],['missable','Missable'],['disagree',`Disagree ${trophies.filter(t => t.disagree).length}`],['collectibles','Collectibles'],['activities','Activities'],['side stories','Side stories'],['robberies','Robberies'],['completion','Completion']].map(([key,label]) => `<button data-kind="${key}" class="${kind === key ? 'selected' : ''}" aria-pressed="${kind === key}">${label}</button>`).join('')}</div><div class="tracker-grid"><section class="checklist panel" aria-label="Trophy checklist"><div class="panel-heading"><h2>THE CHECKLIST</h2><span id="results-count"></span></div><div id="trophy-list" class="trophy-list"></div><div class="list-footer"><span>${icon('check')} Browser-saved checkboxes & counters</span><span>Choose a trophy →</span></div></section><section id="guide" class="guide panel" aria-label="Selected trophy guide"></section>${sourcesRail()}</div>`;
  renderList();
  renderGuide();
}

function filteredTrophies() {
  const priority = [28, 14, 17, 15, 18, 30, 40, 31];
  return trophies.filter(t => (kind === 'all' || (kind === 'missable' ? t.missable === 'potential' : kind === 'disagree' ? !!t.disagree : t.kind === kind)) && (grade === 'all' || grade === t.grade) && (earnedFilter === 'all' || (earnedFilter === 'earned' ? save.earned.includes(t.id) : earnedFilter === 'remaining' ? !save.earned.includes(t.id) : save.pinned.includes(t.id))) && (!query || (hidden(t) ? 'hidden story trophy' : `${t.name} ${t.description} ${t.kind}`).toLowerCase().includes(query.toLowerCase()))).sort((a,b) => (priority.includes(a.id) ? priority.indexOf(a.id)-100 : a.id) - (priority.includes(b.id) ? priority.indexOf(b.id)-100 : b.id));
}

function renderList() {
  const list = filteredTrophies();
  document.querySelector('#results-count').textContent = `${list.length} / 55 shown`;
  document.querySelector('#trophy-list').innerHTML = list.length ? list.map(t => `<article class="trophy-row ${selected === t.id ? 'current' : ''} ${save.earned.includes(t.id) ? 'earned' : ''}"><label class="check-wrap"><input type="checkbox" data-earned="${t.id}" ${save.earned.includes(t.id) ? 'checked' : ''} aria-label="Mark ${escape(displayName(t))} earned"></label><button class="row-main" data-open="${t.id}" aria-pressed="${selected === t.id}"><span class="row-title">${escape(displayName(t))}${save.pinned.includes(t.id) ? '<span class="pin-marker" title="Bookmarked">⌑</span>' : ''}</span><span class="row-description">${escape(hidden(t) ? 'Earn this trophy to reveal its story details.' : t.description)}</span><span class="row-meta">${t.missable === 'potential' ? '<span class="risk-dot">POTENTIAL MISSABLE</span>' : escape(t.kind.toUpperCase())}${t.target ? `<span>${format(save.counts[t.id] ?? 0)} / ${format(t.target)} ${escape(t.unit)}</span>` : ''}${t.status === 'unconfirmed' ? '<span class="unconfirmed">UNCONFIRMED</span>' : ''}${t.disagree ? '<span class="disagree-tag">SOURCES DISAGREE</span>' : ''}</span></button>${badge(t)}</article>`).join('') : '<div class="empty"><h3>No matching trophies</h3><p>Try another filter, or clear your search.</p><button data-action="clear">Show all 55</button></div>';
}

function renderGuide() {
  const t = trophies.find(t => t.id === selected) ?? trophies[27];
  const pane = document.querySelector('#guide');
  if (!pane) return;
  if (hidden(t)) {
    pane.innerHTML = `<div class="guide-top"><span class="eyebrow">STORY / SPOILERS PROTECTED</span>${badge(t)}</div><div class="protected">${icon('lock')}<h2>Let the story unfold.</h2><p>This trophy’s name, description, guide and notes stay hidden until you earn it. Use the checklist to record a verified unlock, or enable story spoilers when you’re ready.</p></div>`;
    return;
  }
  const count = save.counts[t.id] ?? 0;
  const refs = citations(t.sources);
  const counter = t.target ? `<div class="counter"><label for="counter">Your count <span>/ ${format(t.target)} ${escape(t.unit)}</span></label><div><button data-count="-1" aria-label="Decrease counter">−</button><input id="counter" type="number" min="0" max="${t.target}" step="1" value="${count}" aria-label="${escape(t.unit)} completed"><button data-count="1" aria-label="Increase counter">+</button><span>${Math.round(count / t.target * 100)}%</span></div></div>` : '';
  const guideText = t.steps?.length ? guideSteps(t) : `<h3>THE APPROACH</h3><p class="guide-copy">${escape(t.guide)} <span class="citation">${refs}</span></p>`;
  pane.innerHTML = `<div class="guide-top"><span class="eyebrow">FIELDNOTE ${String(t.id).padStart(2,'0')} / ${escape(t.kind.toUpperCase())}</span><button class="pin-button ${save.pinned.includes(t.id) ? 'is-pinned' : ''}" data-pin="${t.id}" aria-label="${save.pinned.includes(t.id) ? 'Remove bookmark' : 'Bookmark trophy'}" aria-pressed="${save.pinned.includes(t.id)}">${icon('pin')}</button></div><div class="guide-title">${badge(t)}<div><h2>${escape(t.name)}</h2><span class="grade-label">${escape(t.grade)} trophy ${save.earned.includes(t.id) ? '· EARNED ✓' : ''}</span></div></div><p class="official-description">“${escape(t.description)}” <span class="citation">${citations(['official'])}</span></p><div class="guide-tags">${t.missable === 'potential' ? tag('Potential missable','danger') : tag(t.status ?? 'Source-reported','sage')}${t.disagree ? tag('SOURCES DISAGREE','disagree-tag') : ''}${tag('Source recheck · 20 Nov 2026')}</div>${counter}<div class="guide-scroll">${guideText}${disagreement(t)}<div class="risk-note"><strong>${t.missable === 'potential' ? 'DON’T MISS THE OPPORTUNITY' : 'WHEN & MISSABILITY'}</strong><p>${escape(t.risk)} <span class="citation">${refs}</span></p></div><div class="source-block"><strong>EVIDENCE & SOURCES</strong>${sourceEntries(t.sources)}</div><details class="notes" ${save.notes[t.id] ? 'open' : ''}><summary>Personal notes ${save.notes[t.id] ? '· saved' : '+ add a note'}</summary><textarea id="notes" maxlength="4000" placeholder="Your route, discoveries or a reminder…" aria-label="Personal notes for ${escape(t.name)}">${escape(save.notes[t.id] ?? '')}</textarea></details><label class="complete-button"><input type="checkbox" data-earned="${t.id}" ${save.earned.includes(t.id) ? 'checked' : ''}>${save.earned.includes(t.id) ? 'Earned on PS5' : 'Mark earned on PS5'}</label></div>`;
}

function renderRoadmap() {
  const done = save.tasks.length;
  const next = nextTrophy();
  document.querySelector('#view').innerHTML = `<div class="route-intro"><p><b>One playthrough planned.</b> Story first, overlap the grind, then clean up.<span>Overall route estimate: ~200 h · PowerPyx estimate, not a guarantee ${citations(['roadmap'])}</span></p><div><b>${done} / 5</b> stages checked</div></div>${next ? `<div class="route-next"><b>NEXT UP</b><span>${escape(displayName(next.trophy))} · Stage ${next.trophy.stage}: ${escape(next.stage.title)}</span><small>${escape(next.reason)}</small></div>` : '<div class="route-next"><b>ROUTE COMPLETE</b><span>All 55 trophies marked earned.</span></div>'}<div class="roadmap-grid"><section class="route-stages">${routeStages.map((stage,index) => { const stageNo=index+1, group=trophies.filter(t=>t.stage===stageNo), earned=group.filter(t=>save.earned.includes(t.id)).length; const watch=stageNo===1?'POTENTIAL MISSABLE':stageNo===2?'TIMED WATCH · CH 3 YAGO RACE':stageNo===4?'POST-STORY WATCH · A LONG ROAD':''; return `<article class="route-card ${save.tasks.includes(stage.id) ? 'done' : ''}"><label class="route-check"><input type="checkbox" data-task="${stage.id}" ${save.tasks.includes(stage.id) ? 'checked' : ''} aria-label="Complete ${escape(stage.title)}"></label><div><p class="eyebrow">${stage.label}<span>${stage.timing}</span></p><h2>${stage.title}<small>${earned}/${group.length} trophies</small></h2><p>${stage.spoiler && !save.spoilers ? 'Story mission details are hidden. Finish the main narrative, preserve chapter saves, then return for post-story cleanup. Enable spoilers to see the named mission route.' : escape(stage.body)} <span class="citation">${citations([stage.source])}</span></p><div class="trophy-chips">${trophyChips(stageNo)}</div><div class="route-meta">${watch ? `<span class="tag danger">${watch}</span>` : ''}<span class="route-hours">${stage.hours} · ${citations(['roadmap'])}</span></div><div class="route-links"><div class="source-entry">${sourceLink(stage.source)}</div><button data-open="${stage.link}">Open related guide →</button></div></div></article>`; }).join('')}</section><aside class="route-side"><section class="target-panel panel"><div class="panel-heading"><h2>TROPHY ≠ 100%</h2>${icon('route')}</div><p class="table-intro">Plan for the higher target to avoid a second sweep.</p><table><thead><tr><th>Objective</th><th>Trophy</th><th>100% route</th></tr></thead><tbody>${targetComparison.map(([label,a,b,id])=>`<tr><th><button data-open="${id}">${label}</button></th><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table><div class="table-source"><div class="source-entry">${sourceLink('completion')}</div><p>Plus: 100 optional tasks, 100 animals studied, all 39 gang operations and all 15 Bret Target Decks. Follow the in-game checklist for every category.</p></div></section><div class="mini-warning"><strong>! ONE POTENTIAL MISSABLE</strong><p>Chapter 1’s balcony meditation disappears. Whether it is necessary for the trophy is unconfirmed ${citations(['meditation'])}.</p><button data-open="28">Protect your run →</button></div></aside></div>`;
}

function renderMissables() {
  const watched=[{chapter:'Ch 1', item:'Positive Mental Attitude · balcony meditation', source:'meditation'}, {chapter:'Ch 2', item:'Kenton’s temporary absence · quest returns later', source:'strangers'}, {chapter:'Ch 3', item:'Yago’s timed Strangers & Freaks race · watch, no confirmed lockout', source:'strangers'}, {chapter:'Ch 4', item:'No trophy lockout confirmed in the checked sources', source:'roadmap'}, {chapter:'Finale', item:'Preserve a save before the ending · replay not reported', source:'roadmap'}, {chapter:'Post-story', item:'A Long Road optional missions · watch, no confirmed lockout', source:'completion'}];
  document.querySelector('#view').innerHTML = `<div class="missable-intro"><span class="big-number">01</span><div><h2>Potential trophy missable</h2><p>One disappearing opportunity. Its necessity is unconfirmed.</p></div><span class="tag danger">Evidence checked 20 Nov 2026</span></div><div class="chapter-watch"><b>CHAPTER WATCH</b>${watched.map(x=>`<div><span>${x.chapter}</span><p>${escape(x.item)} <span class="citation">${citations([x.source])}</span></p></div>`).join('')}</div><div class="missables-grid"><section class="panel missable-feature"><p class="eyebrow">CHAPTER 1 / PRECAUTION FIRST</p><h2>Positive Mental Attitude</h2><p class="official-description">“Meditate at every spot across Leonida.” ${citations(['official'])}</p>${guideSteps(trophies[27])}${disagreement(trophies[27])}<div class="risk-note"><strong>WHAT IS ACTUALLY KNOWN?</strong><p>The tutorial disappears after Chapter 1. PowerPyx has not confirmed that skipping it blocks the trophy. Keep an early save and accept it when offered. The 100% checklist only asks for 15 of 18. ${citations(['meditation','completion'])}</p></div><div class="source-block"><strong>EVIDENCE & SOURCES</strong>${sourceEntries(['meditation','completion'])}</div><button class="primary" data-open="28">Open guide & meditation counter ${icon('arrow')}</button></section><aside class="watchlist"><section class="panel watch-cards"><h3>NOT EVERY DISAPPEARING JOB IS A MISSABLE TROPHY.</h3><article><b>Yago timed race · Ch 3</b><p>Time-sensitive — watch. This is not a confirmed trophy lockout. ${citations(['strangers'])}</p></article><article><b>A Long Road · Post-story</b><p>Time-sensitive — watch optional jobs. This is not a confirmed trophy lockout; 100% remains available post-story. ${citations(['completion'])}</p></article><article><b>No mission replay</b><p>Reported by PowerPyx; preserve a manual save before chapter boundaries. ${citations(['roadmap'])}</p></article><article><b>Cheats disable trophies and saving</b><p>Keep cheats off during the trophy run. ${citations(['roadmap'])}</p></article><div class="source-block"><strong>WATCHLIST SOURCES</strong>${sourceEntries(['strangers','roadmap','completion'])}</div></section><section class="research-hold"><span class="eyebrow">RESEARCH HOLD / 3 METHODS RECHECKED</span><h3>No invented solutions.</h3><p>20 Nov recheck: one method remains unknown; two now have source-reported routes.</p>${[44,49,51].map(id=>`<button data-open="${id}">${escape(trophies[id-1].name)} · ${trophies[id-1].status === 'unconfirmed' ? 'UNCONFIRMED' : 'NEW METHOD [2]'} →</button>`).join('')}<p class="muted">Unconfirmed methods are not confirmed missables.</p></section></aside></div>`;
}

function renderSettings() {
  let receipt = null;
  try { receipt = JSON.parse(localStorage.getItem('vice-fieldnotes.last-export') ?? 'null'); } catch {}
  const receiptText = receipt ? `<div class="export-receipt"><b>LAST EXPORT</b> ${escape(receipt.file)} · ${format(receipt.trophies)} trophies · ${new Date(receipt.at).toISOString().slice(11,16)} UTC <span>File format · Vice Fieldnotes /v1</span></div>` : '<div class="export-receipt pending">No export recorded in this browser yet · File format · Vice Fieldnotes /v1</div>';
  document.querySelector('#view').innerHTML = `<div class="settings-grid"><section class="panel save-panel"><p class="eyebrow">YOUR SAVE / YOUR FILE</p><h2>A platinum travels better<br>with a backup.</h2><p>Your ${save.earned.length} earned trophies, counters, bookmarks, roadmap tasks, notes and spoiler preference are stored locally in this browser.</p><div class="backup-actions"><button class="primary" data-action="export">${icon('save')} Export progress.json</button><button data-action="import">Import backup</button></div><div class="save-preview"><span>VICE FIELDNOTES / BACKUP V1</span><div><b>${save.earned.length}</b> earned <b>${Object.keys(save.counts).length}</b> counters <b>${Object.keys(save.notes).length}</b> notes</div><p>Validated JSON · portable across browsers<br>No account · no cloud · no tracking</p></div><p class="muted">Import replaces this browser’s tracker after a preview and confirmation. Export first to keep both versions. A counter reaching its target never claims a PS5 unlock automatically.</p><label class="chapter-label" for="chapter">Where are you in the story?</label><select id="chapter">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${save.chapter === n ? 'selected' : ''}>${n === 6 ? 'Post-story free roam' : `Chapter ${n}`}</option>`).join('')}</select><div class="demo-tools"><h3>Explore without starting from zero</h3><p>Load an explicitly labelled example save to try counters, bookmarks and roadmap progress.</p><button data-action="demo">Load demo save</button><button class="danger-button" data-action="reset">Start a fresh tracker</button></div></section><section class="panel research-panel"><p class="eyebrow">THE EVIDENCE DESK</p><h2>Facts with a paper trail.</h2><p>${escape(data.policy)}</p><div class="research-summary">55 original trophy guides <span>18 named source pages</span><span>${trophies.filter(t=>t.status === 'unconfirmed').length} unconfirmed method</span></div><div class="source-directory">${Object.keys(data.sources).map(key=>`<div>${sourceEntries([key])}<p>${escape(data.sources[key].scope)}</p></div>`).join('')}</div><p class="muted">PSNProfiles and PlayStationTrophies guide pages returned access restrictions during research; we do not attribute unviewed methods to them. Source links open only when clicked. All app assets and guide text are local.</p></section></div>`;
  document.querySelector('.backup-actions')?.insertAdjacentHTML('afterend', receiptText);
}

function openTrophy(id) {
  selected = Number(id);
  if (!trophies.some(t => t.id === selected)) selected = 28;
  if (view !== 'tracker') { location.hash = `tracker/${selected}`; window.scrollTo(0,0); return; }
  history.replaceState(null, '', `#tracker/${selected}`);
  renderList(); renderGuide();
}

function exportSave() {
  const blob = new Blob([JSON.stringify(save, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'vice-fieldnotes-progress.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  try { localStorage.setItem('vice-fieldnotes.last-export', JSON.stringify({ file: anchor.download, trophies: save.earned.length, at: new Date().toISOString() })); } catch {}
  if (view === 'settings') renderSettings();
  notify('Backup exported. Keep this JSON file for another browser.');
}

app.addEventListener('click', event => {
  const open = event.target.closest('[data-open]');
  if (open) { openTrophy(open.dataset.open); return; }
  const filter = event.target.closest('[data-kind]');
  if (filter) { kind = filter.dataset.kind; renderTracker(); return; }
  const pin = event.target.closest('[data-pin]');
  if (pin) { const id = Number(pin.dataset.pin); save.pinned = save.pinned.includes(id) ? save.pinned.filter(n=>n!==id) : [...save.pinned,id]; store(); renderGuide(); renderList(); return; }
  const countButton = event.target.closest('[data-count]');
  if (countButton) { const t=trophies.find(t=>t.id===selected); save.counts[t.id]=Math.max(0,Math.min(t.target,(save.counts[t.id]??0)+Number(countButton.dataset.count))); store(); renderGuide(); renderList(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'export') exportSave();
  if (action === 'import') document.querySelector('#import-file').click();
  if (action === 'clear') { kind='all';grade='all';earnedFilter='all';query='';renderTracker(); }
  if (action === 'demo' && confirm('Replace this browser’s current progress with a labelled demo save? Export first if you need a backup.')) { save=exampleSave(trophies);store('Demo save loaded.');shell(); }
  if (action === 'reset' && confirm('Clear trophies, counters and notes in this browser? Export first if you need them.')) { save=emptySave();store('Fresh tracker ready.');shell(); }
});

app.addEventListener('input', event => {
  if (event.target.id === 'search') { query=event.target.value;renderList(); }
  if (event.target.id === 'notes') { save.notes[selected]=event.target.value;store(); }
});

app.addEventListener('change', async event => {
  const el = event.target;
  if (el.dataset.earned) {
    const id=Number(el.dataset.earned);
    save.earned=save.earned.filter(n=>n!==id);
    if(el.checked) { save.earned.push(id); const t=trophies.find(t=>t.id===id); if(t.target)save.counts[id]=t.target; }
    store();shell();
  }
  if (el.id === 'spoilers') { save.spoilers=el.checked;store();shell(); }
  if (el.id === 'grade') { grade=el.value;renderList(); }
  if (el.id === 'earned-filter') { earnedFilter=el.value;renderList(); }
  if (el.id === 'chapter') { save.chapter=Number(el.value);store(); }
  if (el.id === 'counter') {
    const t=trophies.find(t=>t.id===selected), value=Number(el.value);
    if (!Number.isInteger(value) || value<0 || value>t.target) { notify(`Enter a whole number from 0 to ${format(t.target)}.`);el.value=save.counts[t.id]??0;return; }
    save.counts[t.id]=value;store();renderGuide();renderList();
  }
  if (el.dataset.task) { save.tasks=save.tasks.filter(t=>t!==el.dataset.task);if(el.checked)save.tasks.push(el.dataset.task);store();renderRoadmap(); }
  if (el.id === 'import-file' && el.files[0]) {
    try {
      if(el.files[0].size>1000000)throw new Error('Backup is too large (maximum 1 MB).');
      const candidate=validateSave(JSON.parse(await el.files[0].text()),trophies);
      if(confirm(`Import ${candidate.earned.length} earned trophies, ${Object.keys(candidate.notes).length} notes and ${Object.keys(candidate.counts).length} counters? This replaces current progress.`)) { save=candidate;store(`Imported ${candidate.earned.length} earned · ${Object.keys(candidate.counts).length} counters`);shell(); }
    } catch(error) { notify(`Import rejected: ${error.message}`); }
    el.value='';
  }
});

window.addEventListener('hashchange', () => {
  const [next,id]=location.hash.slice(1).split('/');
  view=['tracker','roadmap','missables','settings'].includes(next)?next:'tracker';
  if(id && trophies.some(t=>t.id===Number(id)))selected=Number(id);
  shell();
});
window.addEventListener('storage', event => { if(event.key===SAVE_KEY) {save=readSave(trophies);shell();notify('Tracker updated from another tab.');} });
window.addEventListener('keydown', event => {
  if(event.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) { const search=document.querySelector('#search');if(search){event.preventDefault();search.focus();} }
});

try {
  const response=await fetch('./data/trophies.json');
  if(!response.ok)throw new Error(`Data file returned ${response.status}`);
  data=await response.json();trophies=data.trophies;save=readSave(trophies);
  if(!['tracker','roadmap','missables','settings'].includes(view))view='tracker';
  shell();
} catch(error) {
  app.innerHTML='<main class="loading"><h1>Could not open the local guide.</h1><p>Serve the app/ folder with a static server, then reload. No external connection is needed.</p></main>';
  console.error(error);
}
