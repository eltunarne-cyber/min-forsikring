// Eksport og import av alle data (deling mellom ektefellene og sikkerhetskopi).
//
// Filformat (JSON):
// {
//   app: 'min-forsikring', format: 1, exportedAt, appVersion,
//   policies: Policy[], settings, quoteChecks, inventoryUpdatedAt,
//   rooms: Room[], items: Item[],
//   files: { [blobKey]: { type, data: base64 } }   // bare når dokumenter/bilder er tatt med
// }
// Alt har `updatedAt`, slik at «Slå sammen» kan la nyeste versjon vinne,
// og slik at ekte synkronisering kan legges til senere.

import * as db from './db.js';
import { APP_VERSION, defaultRooms } from './model.js';

export const FORMAT = 1;

const pad = (n) => String(n).padStart(2, '0');
export function exportFileName(d = new Date()) {
  return `min-forsikring-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(data, type) {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: type || 'application/octet-stream' });
}

// Alle filnøkler (dokumenter, bilder, kvitteringer) som dataene viser til.
function fileRefs(policies, items) {
  const refs = [];
  for (const p of policies) for (const d of p.documents || []) refs.push({ key: d.blobKey, type: d.type });
  for (const i of items) {
    if (i.photoKey) refs.push({ key: i.photoKey, type: i.photoType });
    if (i.receiptKey) refs.push({ key: i.receiptKey, type: i.receiptType });
  }
  return refs;
}

// Omtrentlig størrelse på filene (for å vise brukeren før deling).
export async function filesSize(state) {
  let total = 0;
  for (const p of state.policies) for (const d of p.documents || []) total += d.size || 0;
  for (const i of state.inventory.items) {
    for (const key of [i.photoKey, i.receiptKey]) {
      if (!key) continue;
      const b = await db.get('files', key).catch(() => null);
      total += b?.size || 0;
    }
  }
  return total;
}

export async function buildExport(state, { includeFiles }) {
  const { lastExportAt, ...settings } = state.settings; // eksportdato er per enhet
  void lastExportAt;
  const data = {
    app: 'min-forsikring',
    format: FORMAT,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    policies: state.policies,
    settings,
    quoteChecks: state.quoteChecks,
    inventoryUpdatedAt: state.inventoryUpdatedAt,
    rooms: state.inventory.rooms,
    items: state.inventory.items,
    files: {},
  };
  if (includeFiles) {
    for (const ref of fileRefs(state.policies, state.inventory.items)) {
      const blob = await db.get('files', ref.key);
      if (blob) data.files[ref.key] = { type: blob.type || ref.type || '', data: await blobToBase64(blob) };
    }
  }
  const json = JSON.stringify(data);
  return new File([json], exportFileName(), { type: 'application/json' });
}

// Del filen (Meldinger, Mail, AirDrop), eller last den ned der deling ikke støttes.
// Gir 'shared', 'downloaded' eller 'cancelled'.
export async function shareOrDownload(file, { preferDownload = false } = {}) {
  if (!preferDownload && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Min Forsikring' });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // Deling feilet av en annen grunn – last ned i stedet.
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  return 'downloaded';
}

// Les og kontroller en eksportfil. Kaster Error med norsk melding ved feil.
export async function readImportFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Filen kunne ikke leses. Velg en fil som er laget med «Del med ektefelle».');
  }
  if (data?.app !== 'min-forsikring' || !Array.isArray(data.policies)) {
    throw new Error('Dette er ikke en fil fra Min Forsikring.');
  }
  if (data.format > FORMAT) {
    throw new Error('Filen er laget med en nyere versjon av appen. Oppdater appen og prøv igjen.');
  }
  data.rooms ??= [];
  data.items ??= [];
  data.files ??= {};
  return data;
}

const newer = (a, b) => (a?.updatedAt || '') > (b?.updatedAt || '');

// Hva er nytt eller endret i filen sammenlignet med denne enheten?
export function diffImport(state, data) {
  const local = new Map(state.policies.map((p) => [p.id, p]));
  const out = { newPolicies: [], newerPolicies: [], olderPolicies: [], same: 0 };
  for (const p of data.policies) {
    const l = local.get(p.id);
    if (!l) out.newPolicies.push(p);
    else if (newer(p, l)) out.newerPolicies.push(p);
    else if (newer(l, p)) out.olderPolicies.push(p);
    else out.same++;
  }
  const fileIds = new Set(data.policies.map((p) => p.id));
  out.onlyLocal = state.policies.filter((p) => !fileIds.has(p.id));
  const localItems = new Map(state.inventory.items.map((i) => [i.id, i]));
  out.newItems = data.items.filter((i) => !localItems.has(i.id)).length;
  out.newerItems = data.items.filter((i) => localItems.has(i.id) && newer(i, localItems.get(i.id))).length;
  out.fileCount = Object.keys(data.files).length;
  return out;
}

// Fjern henvisninger til filer som verken finnes i importfilen eller på enheten.
async function keepAvailable(key, files, store) {
  if (!key) return false;
  if (files[key]) return true;
  return Boolean(await db.req(store.count(key)));
}

// mode: 'merge' (nyeste updatedAt vinner per polise/rom/gjenstand) eller 'replace' (erstatt alt).
export async function applyImport(state, data, mode) {
  const replace = mode === 'replace';
  const winners = (incoming, localList) => {
    if (replace) return incoming;
    const local = new Map(localList.map((x) => [x.id, x]));
    return incoming.filter((x) => !local.has(x.id) || newer(x, local.get(x.id)));
  };
  const policies = winners(data.policies, state.policies);
  let rooms = winners(data.rooms, state.inventory.rooms);
  if (replace && !rooms.length) rooms = defaultRooms();
  const items = winners(data.items, state.inventory.items);

  let settings = state.settings;
  if (replace || newer(data.settings, state.settings)) settings = { ...state.settings, ...data.settings };

  let quoteChecks = { ...state.quoteChecks };
  if (replace) quoteChecks = { ...(data.quoteChecks || {}) };
  else {
    for (const [type, v] of Object.entries(data.quoteChecks || {})) {
      if (!quoteChecks[type] || (v.checkedAt || '') > (quoteChecks[type].checkedAt || '')) quoteChecks[type] = v;
    }
  }
  const inventoryUpdatedAt = replace
    ? data.inventoryUpdatedAt || null
    : [state.inventoryUpdatedAt, data.inventoryUpdatedAt].filter(Boolean).sort().at(-1) || null;

  await db.tx(['policies', 'rooms', 'items', 'files', 'kv'], 'readwrite', async (s) => {
    if (replace) {
      await Promise.all(['policies', 'rooms', 'items', 'files'].map((n) => db.req(s[n].clear())));
    }
    // Filer først, slik at henvisningene under kan kontrolleres.
    const neededKeys = new Set(fileRefs(policies, items).map((r) => r.key));
    await Promise.all(Object.entries(data.files)
      .filter(([key]) => neededKeys.has(key))
      .map(([key, f]) => db.req(s.files.put(base64ToBlob(f.data, f.type), key))));

    for (const p of policies) {
      const docs = [];
      for (const d of p.documents || []) if (await keepAvailable(d.blobKey, data.files, s.files)) docs.push(d);
      await db.req(s.policies.put({ ...p, documents: docs }));
    }
    for (const r of rooms) await db.req(s.rooms.put(r));
    for (const i of items) {
      const it = { ...i };
      if (!(await keepAvailable(it.photoKey, data.files, s.files))) { it.photoKey = ''; it.photoType = ''; }
      if (!(await keepAvailable(it.receiptKey, data.files, s.files))) { it.receiptKey = ''; it.receiptType = ''; }
      await db.req(s.items.put(it));
    }
    await db.req(s.kv.put({ key: 'settings', value: settings }));
    await db.req(s.kv.put({ key: 'quoteChecks', value: quoteChecks }));
    await db.req(s.kv.put({ key: 'inventoryUpdatedAt', value: inventoryUpdatedAt }));
    await db.req(s.kv.put({ key: 'initialized', value: new Date().toISOString() }));
    await db.req(s.kv.put({ key: 'roomsInitialized', value: true }));
  });
  return { policies: policies.length, rooms: rooms.length, items: items.length };
}
