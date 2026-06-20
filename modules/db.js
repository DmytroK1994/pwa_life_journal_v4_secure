const DB_NAME = "opus-db";
const DB_VERSION = 1;

export function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      if (!db.objectStoreNames.contains("entries")) db.createObjectStore("entries", { keyPath: "id" });
      if (!db.objectStoreNames.contains("attachments")) db.createObjectStore("attachments", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(storeName, mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const result = action(store);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

export async function put(store, value) {
  return tx(store, "readwrite", s => s.put(value));
}

export async function get(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, "readonly");
    const req = t.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, "readonly");
    const req = t.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function del(store, key) {
  return tx(store, "readwrite", s => s.delete(key));
}

export async function clearAll() {
  const db = await openDB();
  const stores = ["meta", "entries", "attachments"];
  await Promise.all(stores.map(store => new Promise((resolve, reject) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).clear();
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  })));
}
