// Liten IndexedDB-wrapper. Alle hoveddata lagres her, ikke i localStorage.
//
// Stores:
//   policies – Policy-objekter (nøkkel: id)
//   kv       – innstillinger og annen metadata (nøkkel: key, verdi i `value`)
//   files    – Blob-er for dokumenter, bilder og kvitteringer (nøkkel: blobKey)
//   rooms    – rom i innboregisteret (nøkkel: id)
//   items    – gjenstander i innboregisteret (nøkkel: id)

const DB_NAME = 'min-forsikring';
const DB_VERSION = 1;

let dbPromise = null;

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB støttes ikke'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('policies')) {
        db.createObjectStore('policies', { keyPath: 'id' }).createIndex('type', 'type');
      }
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      if (!db.objectStoreNames.contains('rooms')) db.createObjectStore('rooms', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('items')) {
        db.createObjectStore('items', { keyPath: 'id' }).createIndex('roomId', 'roomId');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // En annen fane har oppgradert databasen – lukk slik at den ikke blokkeres.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Databasen er blokkert av en annen fane'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

// Kjør `fn(stores)` i én transaksjon og vent til den er fullført.
export async function tx(storeNames, mode, fn) {
  const db = await openDb();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  return new Promise((resolve, reject) => {
    const t = db.transaction(names, mode);
    const stores = Object.fromEntries(names.map((n) => [n, t.objectStore(n)]));
    let result;
    Promise.resolve(fn(stores)).then((r) => { result = r; }, (err) => {
      try { t.abort(); } catch { /* allerede avsluttet */ }
      reject(err);
    });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaksjonen ble avbrutt'));
  });
}

export const req = promisify;

export const getAll = (store) => tx(store, 'readonly', (s) => promisify(s[store].getAll()));
export const get = (store, key) => tx(store, 'readonly', (s) => promisify(s[store].get(key)));
export const put = (store, value, key) =>
  tx(store, 'readwrite', (s) => promisify(key === undefined ? s[store].put(value) : s[store].put(value, key)));
export const del = (store, key) => tx(store, 'readwrite', (s) => promisify(s[store].delete(key)));
export const clear = (store) => tx(store, 'readwrite', (s) => promisify(s[store].clear()));

export async function getValue(key, fallback = undefined) {
  const row = await get('kv', key);
  return row ? row.value : fallback;
}
export const setValue = (key, value) => put('kv', { key, value });

// Legg inn mange poliser i én transaksjon (brukes ved første oppstart og import).
export const putMany = (store, values) =>
  tx(store, 'readwrite', (s) => Promise.all(values.map((v) => promisify(s[store].put(v)))));

// Be nettleseren om varig lagring, slik at iOS ikke rydder bort dataene.
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* ikke støttet – ignorer */ }
  return false;
}
