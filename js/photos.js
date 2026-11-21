/* photos.js — pictures attached to transactions. They are too big for localStorage, so they live in the browser's
   IndexedDB, one record per picture: { id, type, data }. A transaction only keeps the id.
   Pictures are made smaller before saving (longest side 1280 px, JPEG), about 100–300 KB each. */
(function (g) {
  'use strict';
  const DB = 'inv-simple-photos', STORE = 'photos', MAX = 1280, QUALITY = 0.8;
  let opening = null;

  function open() {
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        if (!g.indexedDB) { reject(new Error('no-indexeddb')); return; }
        const req = g.indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      opening.catch(() => { opening = null; });
    }
    return opening;
  }
  /** Runs one request on the store and resolves with its result once the change is written. */
  function run(mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error || req.error);
    }));
  }
  const uid = () => ((g.crypto && g.crypto.randomUUID) ? g.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  const Photos = {
    /** Saves a picture and resolves with its id. The sample data gives the id it already put on its work reports. */
    put(blob, id = uid()) {
      return blob.arrayBuffer().then((data) => run('readwrite', (s) => s.put({ id, type: blob.type, data }))).then(() => id);
    },
    /** Resolves with the picture as a Blob, or null when it does not exist. */
    get(id) {
      return run('readonly', (s) => s.get(id)).then((r) => (r ? new Blob([r.data], { type: r.type }) : null));
    },
    remove(id) { return id ? run('readwrite', (s) => s.delete(id)).catch(() => {}) : Promise.resolve(); },
    clear() { return run('readwrite', (s) => s.clear()).catch(() => {}); },
    /** Turns a chosen file into a smaller JPEG. Rejects when the browser cannot read it as a picture. */
    shrink(file) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file), img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * k));
          c.height = Math.max(1, Math.round(img.naturalHeight * k));
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; // transparent pictures get a white background
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          c.toBlob((b) => (b ? resolve(b) : reject(new Error('not-an-image'))), 'image/jpeg', QUALITY);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not-an-image')); };
        img.src = url;
      });
    },
  };
  g.Photos = Photos;
})(typeof window !== 'undefined' ? window : globalThis);
