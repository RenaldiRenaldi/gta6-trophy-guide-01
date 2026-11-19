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
let data, trophies, save;
let view = location.hash.slice(1).split('/')[0] || 'tracker';
let selected = Number(location.hash.split('/')[1]) || 28;
let kind = 'all', grade = 'all', earnedFilter = 'all', query = '';
let toastTimer;

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
function sourceLink(key, text) {
  const source = data.sources[key];
  return `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(text ?? source.name)} ↗</a>`;
}
function badge(trophy) { return `<span class="medal ${trophy.grade}" title="${trophy.grade}">${icon('trophy')}</span>`; }
function tag(text, tone = '') { return `<span class="tag ${tone}">${escape(text)}</span>`; }

function shell() {
  const progress = Math.round(save.earned.length / 55 * 100);
  app.innerHTML = `<aside class="sidebar">
    <a class="brand" href="#tracker"><span class="brand-mark">V<span>F</span></span><span>VICE<br><b>FIELDNOTES</b></span></a>
    <div class="edition">GTA VI / PS5<br>INDEPENDENT FIELD GUIDE</div>
    <nav aria-label="Main navigation">${[['tracker','trophy','Trophy tracker'],['roadmap','route','Platinum route'],['missables','flag','Missable watch'],['settings','save','Save & sources']].map(([key, img, label]) => `<a href="#${key}" class="nav-link ${view === key ? 'active' : ''}" ${view === key ? 'aria-current="page"' : ''}>${icon(img)}<span>${label}</span>${key === 'missables' ? '<i>1</i>' : ''}</a>`).join('')}</nav>
    <div class="sidebar-bottom"><div class="mini-art" aria-hidden="true"><span class="sun"></span><span class="water"></span><span class="road"></span></div><p class="smallcaps">LEONIDA, AT YOUR PACE.</p><p>Your progress stays here.<br>Your next move is yours.</p><span class="offline"><span></span> OFFLINE READY</span><p class="version">Launch edition · 19 Nov 2026</p></div>
  </aside>
  <div class="workspace"><header class="topbar"><span class="breadcrumb">FIELD GUIDE <span>/</span> ${escape({tracker:'TROPHY TRACKER',roadmap:'PLATINUM ROUTE',missables:'MISSABLE WATCH',settings:'SAVE & SOURCES'}[view])}</span><div class="top-actions">${save.demo ? '<span class="demo-label">DEMO SAVE</span>' : ''}<span class="save-status">${storageStatus() ? '● Saved in this browser' : '○ Export to keep progress'}</span><button class="icon-button" data-action="export" title="Export a progress backup">${icon('save')}<span>Export</span></button><button class="icon-button" data-action="import">Import</button></div></header>
    <main id="content"><section class="page-heading"><div><p class="eyebrow">${view === 'tracker' ? '55 TROPHIES. A PLAN FOR EVERY ONE.' : 'YOUR RUN, ORGANIZED.'}</p><h1>${{tracker:'The platinum starts here.',roadmap:'Take the long way. Once.',missables:'Leave nothing to chance.',settings:'Keep your fieldnotes.'}[view]}</h1></div><label class="spoiler-control"><input type="checkbox" id="spoilers" ${save.spoilers ? 'checked' : ''}><span class="switch"></span><span>Story spoilers <b>${save.spoilers ? 'on' : 'off'}</b></span></label></section>
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
  document.querySelector('#view').innerHTML = `${warning()}<section class="filterbar" aria-label="Trophy filters"><div class="search-field">${icon('search')}<input id="search" type="search" placeholder="Search trophies…" aria-label="Search visible trophies" value="${escape(query)}"><kbd>/</kbd></div><label class="sr-only" for="grade">Grade</label><select id="grade"><option value="all">All grades</option>${['platinum','gold','silver','bronze'].map(g => `<option value="${g}" ${grade === g ? 'selected' : ''}>${g[0].toUpperCase()+g.slice(1)}</option>`).join('')}</select><label class="sr-only" for="earned-filter">Earned status</label><select id="earned-filter">${[['all','Any status'],['remaining','Remaining'],['earned','Earned'],['pinned','Bookmarked']].map(([v,l]) => `<option value="${v}" ${earnedFilter === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="text-button" data-action="clear">Clear</button></section><div class="kind-tabs" role="group" aria-label="Filter by kind">${[['all','All 55'],['story','Story'],['missable','Missable'],['collectibles','Collectibles'],['activities','Activities'],['side stories','Side stories'],['robberies','Robberies'],['completion','Completion']].map(([key,label]) => `<button data-kind="${key}" class="${kind === key ? 'selected' : ''}" aria-pressed="${kind === key}">${label}</button>`).join('')}</div><div class="tracker-grid"><section class="checklist panel" aria-label="Trophy checklist"><div class="panel-heading"><h2>THE CHECKLIST</h2><span id="results-count"></span></div><div id="trophy-list" class="trophy-list"></div><div class="list-footer"><span>${icon('check')} Browser-saved checkboxes & counters</span><span>Choose a trophy →</span></div></section><section id="guide" class="guide panel" aria-label="Selected trophy guide"></section></div>`;
  renderList();
  renderGuide();
}

function filteredTrophies() {
  const priority = [28, 14, 17, 15, 18, 30, 40, 31];
  return trophies.filter(t => (kind === 'all' || (kind === 'missable' ? t.missable === 'potential' : t.kind === kind)) && (grade === 'all' || grade === t.grade) && (earnedFilter === 'all' || (earnedFilter === 'earned' ? save.earned.includes(t.id) : earnedFilter === 'remaining' ? !save.earned.includes(t.id) : save.pinned.includes(t.id))) && (!query || (hidden(t) ? 'hidden story trophy' : `${t.name} ${t.description} ${t.kind}`).toLowerCase().includes(query.toLowerCase()))).sort((a,b) => (priority.includes(a.id) ? priority.indexOf(a.id)-100 : a.id) - (priority.includes(b.id) ? priority.indexOf(b.id)-100 : b.id));
}

function renderList() {
  const list = filteredTrophies();
  document.querySelector('#results-count').textContent = `${list.length} / 55 shown`;
  document.querySelector('#trophy-list').innerHTML = list.length ? list.map(t => `<article class="trophy-row ${selected === t.id ? 'current' : ''} ${save.earned.includes(t.id) ? 'earned' : ''}"><label class="check-wrap"><input type="checkbox" data-earned="${t.id}" ${save.earned.includes(t.id) ? 'checked' : ''} aria-label="Mark ${escape(displayName(t))} earned"></label><button class="row-main" data-open="${t.id}" aria-pressed="${selected === t.id}"><span class="row-title">${escape(displayName(t))}${save.pinned.includes(t.id) ? '<span class="pin-marker" title="Bookmarked">⌑</span>' : ''}</span><span class="row-description">${escape(hidden(t) ? 'Earn this trophy to reveal its story details.' : t.description)}</span><span class="row-meta">${t.missable === 'potential' ? '<span class="risk-dot">POTENTIAL MISSABLE</span>' : escape(t.kind.toUpperCase())}${t.target ? `<span>${format(save.counts[t.id] ?? 0)} / ${format(t.target)} ${escape(t.unit)}</span>` : ''}${t.status === 'unconfirmed' ? '<span class="unconfirmed">UNCONFIRMED</span>' : ''}</span></button>${badge(t)}</article>`).join('') : '<div class="empty"><h3>No matching trophies</h3><p>Try another filter, or clear your search.</p><button data-action="clear">Show all 55</button></div>';
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
  pane.innerHTML = `<div class="guide-top"><span class="eyebrow">FIELDNOTE ${String(t.id).padStart(2,'0')} / ${escape(t.kind.toUpperCase())}</span><button class="pin-button ${save.pinned.includes(t.id) ? 'is-pinned' : ''}" data-pin="${t.id}" aria-label="${save.pinned.includes(t.id) ? 'Remove bookmark' : 'Bookmark trophy'}" aria-pressed="${save.pinned.includes(t.id)}">${icon('pin')}</button></div><div class="guide-title">${badge(t)}<div><h2>${escape(t.name)}</h2><span class="grade-label">${escape(t.grade)} trophy ${save.earned.includes(t.id) ? '· EARNED ✓' : ''}</span></div></div><p class="official-description">“${escape(t.description)}”</p><div class="guide-tags">${t.missable === 'potential' ? tag('Potential missable','danger') : tag(t.status ?? 'Source-reported','sage')}${tag('Original guide · 19 Nov 2026')}</div><div class="guide-scroll">${t.id === 28 ? `<ol class="guide-steps">${t.steps.map(s => `<li>${escape(s)}</li>`).join('')}</ol>` : `<h3>THE APPROACH</h3><p class="guide-copy">${escape(t.guide)}</p>`}<div class="risk-note"><strong>${t.missable === 'potential' ? 'DON’T MISS THE OPPORTUNITY' : 'WHEN & MISSABILITY'}</strong><p>${escape(t.risk)}</p></div><div class="source-block"><strong>EVIDENCE & SOURCES</strong>${t.sources.map(k => sourceLink(k)).join('')}<span>Launch-day reporting · source links need a connection.</span></div>${t.target ? `<div class="counter"><label for="counter">Your count <span>/ ${format(t.target)} ${escape(t.unit)}</span></label><div><button data-count="-1" aria-label="Decrease counter">−</button><input id="counter" type="number" min="0" max="${t.target}" step="1" value="${count}" aria-label="${escape(t.unit)} completed"><button data-count="1" aria-label="Increase counter">+</button><span>${Math.round(count / t.target * 100)}%</span></div></div>` : ''}<details class="notes" ${save.notes[t.id] ? 'open' : ''}><summary>Personal notes ${save.notes[t.id] ? '· saved' : '+ add a note'}</summary><textarea id="notes" maxlength="4000" placeholder="Your route, discoveries or a reminder…" aria-label="Personal notes for ${escape(t.name)}">${escape(save.notes[t.id] ?? '')}</textarea></details><label class="complete-button"><input type="checkbox" data-earned="${t.id}" ${save.earned.includes(t.id) ? 'checked' : ''}>${save.earned.includes(t.id) ? 'Earned on PS5' : 'Mark earned on PS5'}</label></div>`;
}

function renderRoadmap() {
  const done = save.tasks.length;
  document.querySelector('#view').innerHTML = `<div class="route-intro"><p><b>One playthrough planned.</b> Story first, overlap the grind, then clean up.<span>~200h / 4 of 10 difficulty — PowerPyx estimates, not guarantees.</span></p><div><b>${done} / 5</b> stages checked</div></div><div class="roadmap-grid"><section class="route-stages">${routeStages.map(stage => `<article class="route-card ${save.tasks.includes(stage.id) ? 'done' : ''}"><label class="route-check"><input type="checkbox" data-task="${stage.id}" ${save.tasks.includes(stage.id) ? 'checked' : ''} aria-label="Complete ${escape(stage.title)}"></label><div><p class="eyebrow">${stage.label}<span>${stage.timing}</span></p><h2>${stage.title}</h2><p>${stage.spoiler && !save.spoilers ? 'Story mission details are hidden. Finish the main narrative, preserve chapter saves, then return for post-story cleanup. Enable spoilers to see the named mission route.' : stage.body}</p><div class="route-links">${sourceLink(stage.source)}<button data-open="${stage.link}">Open related guide →</button></div></div></article>`).join('')}</section><aside class="route-side"><section class="target-panel panel"><div class="panel-heading"><h2>TROPHY ≠ 100%</h2>${icon('route')}</div><p class="table-intro">Plan for the higher target to avoid a second sweep.</p><table><thead><tr><th>Objective</th><th>Trophy</th><th>100% route</th></tr></thead><tbody>${targetComparison.map(([label,a,b,id])=>`<tr><th><button data-open="${id}">${label}</button></th><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table><div class="table-source">${sourceLink('completion')}<p>Plus: 100 optional tasks, 100 animals studied, all 39 gang operations and all 15 Bret Target Decks. Follow the in-game checklist for every category.</p></div></section><div class="mini-warning"><strong>! ONE POTENTIAL MISSABLE</strong><p>Chapter 1’s balcony meditation disappears. Whether it is necessary for the trophy is unconfirmed.</p><button data-open="28">Protect your run →</button></div></aside></div>`;
}

function renderMissables() {
  document.querySelector('#view').innerHTML = `<div class="missable-intro"><span class="big-number">01</span><div><h2>Potential trophy missable</h2><p>One disappearing opportunity. Its necessity is unconfirmed.</p></div><span class="tag danger">Evidence checked 19 Nov 2026</span></div><div class="missables-grid"><section class="panel missable-feature"><p class="eyebrow">CHAPTER 1 / PRECAUTION FIRST</p><h2>Positive Mental Attitude</h2><p class="official-description">“Meditate at every spot across Leonida.”</p><ol class="guide-steps">${trophies[27].steps.map(s=>`<li>${escape(s)}</li>`).join('')}</ol><div class="risk-note"><strong>WHAT IS ACTUALLY KNOWN?</strong><p>The tutorial disappears after Chapter 1. PowerPyx has not confirmed that skipping it blocks the trophy. Keep an early save and accept it when offered. The 100% checklist only asks for 15 of 18.</p></div><div class="source-block">${sourceLink('meditation')}${sourceLink('completion')}</div><button class="primary" data-open="28">Open guide & meditation counter ${icon('arrow')}</button></section><aside class="watchlist"><section class="panel"><h3>NOT EVERY DISAPPEARING JOB IS A MISSABLE TROPHY.</h3><p><b>Kenton’s absence is temporary.</b> His trophy quest returns later; the roadmap says trophy-related questlines survive into free roam.</p><p><b>Watch Yago’s timed race.</b> The side-mission guide flags it as time-sensitive, but does not establish a platinum lockout. Accept it promptly and preserve a save.</p><p><b>No mission replay reported.</b> Our precaution: keep separate saves near chapter boundaries.</p><div class="source-block">${sourceLink('strangers')}${sourceLink('roadmap')}</div></section><section class="research-hold"><span class="eyebrow">RESEARCH HOLD / 3 METHODS</span><h3>No invented solutions.</h3><p>The checked guide still labels these unlock methods unknown:</p>${[44,49,51].map(id=>`<button data-open="${id}">${escape(trophies[id-1].name)} →</button>`).join('')}<p class="muted">Unconfirmed methods are not confirmed missables.</p></section></aside></div>`;
}

function renderSettings() {
  document.querySelector('#view').innerHTML = `<div class="settings-grid"><section class="panel save-panel"><p class="eyebrow">YOUR SAVE / YOUR FILE</p><h2>A platinum travels better<br>with a backup.</h2><p>Your ${save.earned.length} earned trophies, counters, bookmarks, roadmap tasks, notes and spoiler preference are stored locally in this browser.</p><div class="backup-actions"><button class="primary" data-action="export">${icon('save')} Export progress.json</button><button data-action="import">Import backup</button></div><div class="save-preview"><span>VICE FIELDNOTES / BACKUP V1</span><div><b>${save.earned.length}</b> earned <b>${Object.keys(save.counts).length}</b> counters <b>${Object.keys(save.notes).length}</b> notes</div><p>Validated JSON · portable across browsers<br>No account · no cloud · no tracking</p></div><p class="muted">Import replaces this browser’s tracker after a preview and confirmation. Export first to keep both versions. A counter reaching its target never claims a PS5 unlock automatically.</p><label class="chapter-label" for="chapter">Where are you in the story?</label><select id="chapter">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${save.chapter === n ? 'selected' : ''}>${n === 6 ? 'Post-story free roam' : `Chapter ${n}`}</option>`).join('')}</select><div class="demo-tools"><h3>Explore without starting from zero</h3><p>Load an explicitly labelled example save to try counters, bookmarks and roadmap progress.</p><button data-action="demo">Load demo save</button><button class="danger-button" data-action="reset">Start a fresh tracker</button></div></section><section class="panel research-panel"><p class="eyebrow">THE EVIDENCE DESK</p><h2>Facts with a paper trail.</h2><p>${escape(data.policy)}</p><div class="research-summary">55 original trophy guides <span>18 named source pages</span><span>3 unconfirmed methods</span></div><div class="source-directory">${Object.entries(data.sources).map(([key,s])=>`<div>${sourceLink(key)}<p>${escape(s.scope)}</p></div>`).join('')}</div><p class="muted">PSNProfiles and PlayStationTrophies guide pages returned access restrictions during research; we do not attribute unviewed methods to them. Source links open only when clicked. All app assets and guide text are local.</p></section></div>`;
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
      if(confirm(`Import ${candidate.earned.length} earned trophies, ${Object.keys(candidate.notes).length} notes and ${Object.keys(candidate.counts).length} counters? This replaces current progress.`)) { save=candidate;store('Backup imported successfully.');shell(); }
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
