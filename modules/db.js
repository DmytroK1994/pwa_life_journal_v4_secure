export const DB_NAME = 'opus-vault-db';
export const DB_VERSION = 1;
export const STORES = ['meta','entries','attachments','categories','settings'];

export function openDB(){
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if(!db.objectStoreNames.contains('meta')) db.createObjectStore('meta',{keyPath:'key'});
      if(!db.objectStoreNames.contains('entries')){
        const store = db.createObjectStore('entries',{keyPath:'id'});
        store.createIndex('updatedAt','updatedAt');
        store.createIndex('category','category');
      }
      if(!db.objectStoreNames.contains('attachments')){
        const store = db.createObjectStore('attachments',{keyPath:'id'});
        store.createIndex('entryId','entryId');
      }
      if(!db.objectStoreNames.contains('categories')) db.createObjectStore('categories',{keyPath:'id'});
      if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings',{keyPath:'key'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function tx(storeName, mode, callback){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    result = callback(store);
  });
}

export async function get(store,key){ return tx(store,'readonly',s => requestToPromise(s.get(key))); }
export async function set(store,value){ return tx(store,'readwrite',s => requestToPromise(s.put(value))); }
export async function del(store,key){ return tx(store,'readwrite',s => requestToPromise(s.delete(key))); }
export async function all(store){ return tx(store,'readonly',s => requestToPromise(s.getAll())); }
export async function clear(store){ return tx(store,'readwrite',s => requestToPromise(s.clear())); }

export function requestToPromise(request){
  return new Promise((resolve,reject)=>{
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
