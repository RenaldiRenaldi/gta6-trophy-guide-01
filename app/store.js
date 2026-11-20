// One versioned save: backups include settings, notes and all manual progress.
export const SAVE_KEY = 'vice-fieldnotes.v1';
export const emptySave = () => ({ version: 1, earned: [], counts: {}, notes: {}, pinned: [], tasks: [], spoilers: false, demo: false, chapter: 1 });
let writable = true;

export function validateSave(value, trophies) {
  if (!value || value.version !== 1 || typeof value !== 'object' || Array.isArray(value)) throw new Error('This is not a Vice Fieldnotes v1 backup.');
  const ids = new Set(trophies.map(t => t.id));
  const result = emptySave();
  for (const key of ['earned', 'pinned']) {
    if (!Array.isArray(value[key]) || value[key].some(id => !Number.isInteger(id) || !ids.has(id))) throw new Error(`Invalid ${key} trophy IDs.`);
    result[key] = [...new Set(value[key])];
  }
  for (const key of ['counts', 'notes']) {
    if (!value[key] || typeof value[key] !== 'object' || Array.isArray(value[key])) throw new Error(`Invalid ${key}.`);
    for (const [id, entry] of Object.entries(value[key])) {
      const trophy = trophies.find(t => String(t.id) === id);
      if (!trophy) throw new Error('Backup includes an unknown trophy.');
      if (key === 'counts' && (!trophy.target || !Number.isInteger(entry) || entry < 0 || entry > trophy.target)) throw new Error('A counter is outside its allowed range.');
      if (key === 'notes' && (typeof entry !== 'string' || entry.length > 4000)) throw new Error('Notes must be text under 4,001 characters.');
      result[key][id] = entry;
    }
  }
  if (!Array.isArray(value.tasks) || value.tasks.some(t => typeof t !== 'string' || !/^route-[1-5]$/.test(t))) throw new Error('Invalid roadmap tasks.');
  if (typeof value.spoilers !== 'boolean' || typeof value.demo !== 'boolean') throw new Error('Invalid settings.');
  if (!Number.isInteger(value.chapter) || value.chapter < 1 || value.chapter > 6) throw new Error('Invalid story position.');
  result.tasks = [...new Set(value.tasks)];
  result.spoilers = value.spoilers;
  result.demo = value.demo;
  result.chapter = value.chapter;
  return result;
}

export function readSave(trophies) {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    return text ? validateSave(JSON.parse(text), trophies) : emptySave();
  } catch {
    writable = false;
    return emptySave();
  }
}

export function persist(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); writable = true; }
  catch { writable = false; }
  return writable;
}

export function storageStatus() { return writable; }

export function exampleSave(trophies) {
  const save = emptySave();
  save.demo = true;
  save.spoilers = true;
  save.chapter = 3;
  save.earned = [2, 3, 4, 8, 16, 20, 21, 24, 35, 41, 42, 53, 55];
  save.pinned = [28, 17];
  save.tasks = ['route-1'];
  for (const trophy of trophies) if (trophy.target && save.earned.includes(trophy.id)) save.counts[trophy.id] = trophy.target;
  // Explicit sample progress, imported through the same validated backup flow as a real save.
  Object.assign(save.counts, { 15: 84, 17: 0, 18: 6, 25: 2, 28: 7, 30: 1, 31: 37, 32: 24, 40: 2, 43: 4, 52: 95000, 54: 3 });
  save.notes[28] = 'Chapter 1 balcony tutorial recorded. Continue both-character spots after Coffee Break.';
  return save;
}
