// Oppstart og hash-ruting mellom visningene.

import {
  createExampleData, DEFAULT_SETTINGS, uuid, reminderCount, quoteYearKey, defaultRooms, sortRooms,
} from './model.js';
import * as db from './db.js';
import { applyImport } from './backup.js';
import { toast } from './ui.js';
import * as home from './views/home.js';
import * as reminders from './views/reminders.js';
import * as assistant from './views/assistant.js';
import * as edit from './views/edit.js';
import * as inventory from './views/inventory.js';
import * as settings from './views/settings.js';

const state = {
  policies: [],
  settings: { ...DEFAULT_SETTINGS },
  openTypes: new Set(), // hvilke bokser på forsiden som er åpne i denne økten
  openDocs: new Set(),  // hvilke dokumentlister som er åpne (polise-id)
  quoteChecks: {},          // årlig tilbud: { type: { key, checkedAt } }
  inventoryUpdatedAt: null, // sist innboregisteret ble endret
  inventory: { rooms: [], items: [] },
  lastExportAt: null,        // sist denne enheten eksporterte (per enhet, ikke med i eksporten)
  openReminders: new Set(), // hvilke bokser på Påminnelser som er åpne
  storageOk: true,      // false hvis IndexedDB ikke kan brukes (data lagres da bare i minnet)
};

// ---------- Lagring ----------

async function load() {
  try {
    await readAll();
    db.requestPersistence();
  } catch (err) {
    console.error(err);
    state.storageOk = false;
    state.policies = createExampleData();
    state.inventory = { rooms: defaultRooms(), items: [] };
    toast('Kunne ikke åpne lagringen på denne enheten. Endringer blir ikke lagret.', { error: true, ms: 8000 });
  }
}

// Les alt fra IndexedDB inn i minnet (ved oppstart, og etter import/sletting).
async function readAll() {
  await db.openDb();
  if (!(await db.getValue('initialized'))) {
    await db.putMany('policies', createExampleData());
    await db.setValue('settings', { ...DEFAULT_SETTINGS, updatedAt: new Date().toISOString() });
    await db.setValue('initialized', new Date().toISOString());
  }
  state.policies = await db.getAll('policies');
  state.settings = { ...DEFAULT_SETTINGS, ...(await db.getValue('settings', {})) };
  state.quoteChecks = await db.getValue('quoteChecks', {});
  state.inventoryUpdatedAt = await db.getValue('inventoryUpdatedAt', null);
  if (!(await db.getValue('roomsInitialized'))) {
    await db.putMany('rooms', defaultRooms());
    await db.setValue('roomsInitialized', true);
  }
  state.inventory = {
    rooms: sortRooms(await db.getAll('rooms')),
    items: await db.getAll('items'),
  };
  state.lastExportAt = await db.getValue('lastExportAt', null);
}

// Innboregisteret er endret – brukes til «Sist oppdatert for x mnd siden».
async function touchInventory() {
  state.inventoryUpdatedAt = new Date().toISOString();
  if (state.storageOk) await db.setValue('inventoryUpdatedAt', state.inventoryUpdatedAt);
}

// Bytt ut polisen i minnet (eller legg den til).
function replaceInState(p) {
  const i = state.policies.findIndex((x) => x.id === p.id);
  if (i >= 0) state.policies[i] = p; else state.policies.push(p);
}

const actions = {
  async savePolicy(policy) {
    const p = { ...policy, isExample: false, updatedAt: new Date().toISOString() };
    if (state.storageOk) await db.put('policies', p);
    replaceInState(p);
    return p;
  },
  async deletePolicy(id) {
    const policy = state.policies.find((x) => x.id === id);
    if (state.storageOk) {
      await db.tx(['policies', 'files'], 'readwrite', (s) => Promise.all([
        db.req(s.policies.delete(id)),
        ...(policy?.documents || []).map((d) => db.req(s.files.delete(d.blobKey))),
      ]));
    }
    state.policies = state.policies.filter((x) => x.id !== id);
  },

  // Lagre en fil (PDF/bilde) som Blob og knytt den til polisen – i én transaksjon.
  async addDocument(policyId, file, { title, kind }) {
    if (!state.storageOk) throw new Error('Lagring er ikke tilgjengelig');
    const policy = state.policies.find((x) => x.id === policyId);
    const now = new Date().toISOString();
    const ref = {
      id: uuid(),
      policyId,
      title,
      kind,
      fileName: file.name || 'dokument',
      type: file.type || '',
      size: file.size,
      addedAt: now,
      blobKey: 'doc-' + uuid(),
    };
    const updated = { ...policy, documents: [...(policy.documents || []), ref], updatedAt: now };
    await db.tx(['policies', 'files'], 'readwrite', (s) => Promise.all([
      db.req(s.files.put(file, ref.blobKey)),
      db.req(s.policies.put(updated)),
    ]));
    replaceInState(updated);
    if (!state.settings.docHelpSeen) await actions.saveSettings({ docHelpSeen: true });
    return ref;
  },
  async deleteDocument(policyId, docId) {
    const policy = state.policies.find((x) => x.id === policyId);
    const ref = policy.documents.find((d) => d.id === docId);
    const updated = {
      ...policy,
      documents: policy.documents.filter((d) => d.id !== docId),
      updatedAt: new Date().toISOString(),
    };
    await db.tx(['policies', 'files'], 'readwrite', (s) => Promise.all([
      db.req(s.files.delete(ref.blobKey)),
      db.req(s.policies.put(updated)),
    ]));
    replaceInState(updated);
  },
  getFile: (blobKey) => db.get('files', blobKey),

  async setQuoteChecked(type, checked) {
    const next = { ...state.quoteChecks };
    if (checked) next[type] = { key: quoteYearKey(state.policies, type), checkedAt: new Date().toISOString() };
    else delete next[type];
    if (state.storageOk) await db.setValue('quoteChecks', next);
    state.quoteChecks = next;
    updateBadge();
  },
  // ---------- Innboregister ----------

  async saveRoom(room) {
    const r = { ...room, updatedAt: new Date().toISOString() };
    if (state.storageOk) await db.put('rooms', r);
    const list = state.inventory.rooms.filter((x) => x.id !== r.id);
    state.inventory.rooms = sortRooms([...list, r]);
    await touchInventory();
    return r;
  },
  // Sletter rommet og alle gjenstandene i det (med bilder og kvitteringer).
  async deleteRoom(roomId) {
    const items = state.inventory.items.filter((i) => i.roomId === roomId);
    if (state.storageOk) {
      await db.tx(['rooms', 'items', 'files'], 'readwrite', (s) => Promise.all([
        db.req(s.rooms.delete(roomId)),
        ...items.map((i) => db.req(s.items.delete(i.id))),
        ...items.flatMap((i) => [i.photoKey, i.receiptKey]).filter(Boolean).map((k) => db.req(s.files.delete(k))),
      ]));
    }
    state.inventory.rooms = state.inventory.rooms.filter((r) => r.id !== roomId);
    state.inventory.items = state.inventory.items.filter((i) => i.roomId !== roomId);
    await touchInventory();
  },
  // files: { photo, receipt } der undefined = uendret, null = fjern, Blob = ny fil.
  async saveItem(item, files = {}) {
    const old = state.inventory.items.find((x) => x.id === item.id);
    const it = { ...item, updatedAt: new Date().toISOString() };
    const puts = [];
    const dels = [];
    for (const [kind, keyField, typeField] of [['photo', 'photoKey', 'photoType'], ['receipt', 'receiptKey', 'receiptType']]) {
      const f = files[kind];
      if (f === undefined) continue;
      if (old?.[keyField]) dels.push(old[keyField]);
      if (f === null) { it[keyField] = ''; it[typeField] = ''; continue; }
      it[keyField] = `${kind}-${uuid()}`;
      it[typeField] = f.type || '';
      if (kind === 'receipt') it.receiptName = f.name || 'kvittering';
      puts.push([it[keyField], f]);
    }
    if (state.storageOk) {
      await db.tx(['items', 'files'], 'readwrite', (s) => Promise.all([
        ...puts.map(([k, f]) => db.req(s.files.put(f, k))),
        ...dels.map((k) => db.req(s.files.delete(k))),
        db.req(s.items.put(it)),
      ]));
    }
    state.inventory.items = [...state.inventory.items.filter((x) => x.id !== it.id), it];
    await touchInventory();
    return it;
  },
  async deleteItem(id) {
    const it = state.inventory.items.find((x) => x.id === id);
    if (state.storageOk && it) {
      await db.tx(['items', 'files'], 'readwrite', (s) => Promise.all([
        db.req(s.items.delete(id)),
        ...[it.photoKey, it.receiptKey].filter(Boolean).map((k) => db.req(s.files.delete(k))),
      ]));
    }
    state.inventory.items = state.inventory.items.filter((x) => x.id !== id);
    await touchInventory();
  },

  // ---------- Innstillinger, deling og sletting ----------

  async markExported() {
    state.lastExportAt = new Date().toISOString();
    if (state.storageOk) await db.setValue('lastExportAt', state.lastExportAt);
  },
  async importData(data, mode) {
    const result = await applyImport(state, data, mode);
    await readAll();
    return result;
  },
  // Sletter alle poliser merket «Eksempel» (med dokumentene deres).
  async clearExamples() {
    const ex = state.policies.filter((p) => p.isExample);
    for (const p of ex) await actions.deletePolicy(p.id);
    return ex.length;
  },
  async deleteAll() {
    await db.tx(['policies', 'rooms', 'items', 'files', 'kv'], 'readwrite', (s) => Promise.all([
      ...['policies', 'rooms', 'items', 'files', 'kv'].map((n) => db.req(s[n].clear())),
    ]));
    // Ikke legg inn eksempeldata på nytt – men gi tomme standardrom.
    await db.setValue('initialized', new Date().toISOString());
    state.openTypes.clear();
    state.openDocs.clear();
    state.assistant = null;
    await readAll();
  },

  async saveSettings(patch) {
    state.settings = { ...state.settings, ...patch, updatedAt: new Date().toISOString() };
    if (state.storageOk) await db.setValue('settings', state.settings);
  },
};

// ---------- Ruting ----------

const ROUTES = [
  { re: /^\/?$/, view: home, tab: null },
  { re: /^\/paminnelser$/, view: reminders, tab: 'rem' },
  { re: /^\/ki$/, view: assistant, tab: 'ai' },
  { re: /^\/rediger\/([^/]+)$/, view: edit, tab: null },
  { re: /^\/innbo$/, view: inventory, tab: null },
  { re: /^\/innbo\/([^/]+)$/, view: inventory, tab: null },
  { re: /^\/innstillinger$/, view: settings, tab: null },
];

const app = document.getElementById('app');
const badge = document.getElementById('badge');

// Tellemerket på «Påminnelser» viser antall ting som krever handling.
function updateBadge() {
  const n = reminderCount(state);
  badge.hidden = n === 0;
  badge.textContent = String(n);
  tabs.rem.setAttribute('aria-label', n ? `Påminnelser, ${n} krever handling` : 'Påminnelser');
}
const tabs = { rem: document.getElementById('tab-rem'), ai: document.getElementById('tab-ai') };

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, query: new URLSearchParams(qs) };
}

export function navigate(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// Hver historikkoppføring får en dybde i history.state. Dybde 0 er den første
// siden appen ble åpnet på. «Tilbake» i appen bruker nettleserens historikk når
// det finnes en tidligere side i appen, ellers går den til oversikten.
let depth = 0;
let firstRender = true;
function trackDepth() {
  const d = history.state?.depth;
  if (typeof d === 'number') depth = d;
  else {
    depth = firstRender ? 0 : depth + 1;
    history.replaceState({ depth }, '');
  }
}
function back() {
  if (depth > 0) history.back();
  else {
    depth = -1; // den erstattede oppføringen blir dybde 0
    location.replace('#/');
  }
}

function render() {
  const { path, query } = parseHash();
  let route = null;
  let params = [];
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) { route = r; params = m.slice(1); break; }
  }
  if (!route) { navigate('#/'); return; }
  trackDepth();

  for (const [key, el] of Object.entries(tabs)) {
    const on = route.tab === key;
    el.classList.toggle('on', on);
    if (on) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  }

  updateBadge();
  const ctx = { state, actions, params, query, navigate, back, toast, rerender: render, home, updateBadge };
  try {
    app.innerHTML = '';
    route.view.render(app, ctx);
  } catch (err) {
    console.error(err);
    app.innerHTML = '<main class="content"><div class="panel"><h3>Noe gikk galt</h3><p class="small">Siden kunne ikke vises. Prøv å gå tilbake til oversikten.</p></div></main>';
  }

  window.scrollTo(0, 0);
  // Flytt fokus til sidens overskrift ved bytte av visning (for skjermleser og tastatur).
  const focusEl = app.querySelector('[data-focus]');
  if (focusEl && !firstRender) focusEl.focus({ preventScroll: true });
  firstRender = false;
}

// Trykk på aktiv bunnknapp en gang til → tilbake til oversikten.
for (const el of Object.values(tabs)) {
  el.addEventListener('click', (e) => {
    if (el.classList.contains('on')) {
      e.preventDefault();
      navigate('#/');
    }
  });
}

window.addEventListener('hashchange', render);
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  toast('Noe gikk galt. Prøv igjen.', { error: true });
});

// Service worker: gjør at appen virker uten nett etter første besøk.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('En ny versjon av appen er klar. Lukk og åpne appen for å bruke den.', { ms: 8000 });
  });
  navigator.serviceWorker.register('service-worker.js').then((reg) => {
    // Se etter ny versjon når appen åpnes igjen fra bakgrunnen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Service worker ble ikke registrert', err));
}

await load();
render();
registerServiceWorker();
