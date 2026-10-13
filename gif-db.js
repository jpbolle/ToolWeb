// gif-db.js — Accès à IndexedDB (base de données du navigateur, propre à l'extension)
// pour stocker les captures vidéo et les GIF, trop lourds pour chrome.storage.
// Partagé par offscreen.js, background.js, sidepanel.js et gif-viewer.js.

const GIF_DB_NAME = 'toolweb-gif';
const GIF_DB_STORE = 'captures';

function openGifDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(GIF_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(GIF_DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function gifDbPut(key, value) {
  const db = await openGifDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GIF_DB_STORE, 'readwrite');
    tx.objectStore(GIF_DB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function gifDbGet(key) {
  const db = await openGifDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(GIF_DB_STORE, 'readonly').objectStore(GIF_DB_STORE).get(key);
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function gifDbDelete(key) {
  const db = await openGifDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(GIF_DB_STORE, 'readwrite');
    tx.objectStore(GIF_DB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function gifDbKeys() {
  const db = await openGifDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(GIF_DB_STORE, 'readonly').objectStore(GIF_DB_STORE).getAllKeys();
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

// ----- Historique des GIF : une entrée par GIF, clé « gif-<date de création> » -----

const GIF_HISTORY_MAX = 10;

function gifKey(createdAt) {
  return `gif-${createdAt}`;
}

// Clés des GIF, du plus récent au plus ancien
async function gifHistoryKeys() {
  const keys = await gifDbKeys();
  return keys
    .filter((key) => typeof key === 'string' && key.startsWith('gif-'))
    .sort((a, b) => Number(b.slice(4)) - Number(a.slice(4)));
}

// Garde les GIF_HISTORY_MAX plus récents. Reprend aussi les clés uniques des premières
// versions : « last-gif » rejoint l'historique, « last-raw » (vidéo d'essai) est effacée.
async function gifHistoryPrune() {
  const keys = await gifDbKeys();
  if (keys.includes('last-gif')) {
    const old = await gifDbGet('last-gif');
    if (old && old.blob) await gifDbPut(gifKey(old.createdAt), old);
    await gifDbDelete('last-gif');
  }
  if (keys.includes('last-raw')) await gifDbDelete('last-raw');
  const history = await gifHistoryKeys();
  for (const key of history.slice(GIF_HISTORY_MAX)) await gifDbDelete(key);
}
