const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomBytes(length=16){ return crypto.getRandomValues(new Uint8Array(length)); }
export function bytesToBase64(bytes){ return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
export function base64ToBytes(base64){ return Uint8Array.from(atob(base64), c => c.charCodeAt(0)); }
export async function sha256(text){ const hash = await crypto.subtle.digest('SHA-256', enc.encode(text)); return bytesToBase64(hash); }

export async function deriveKey(pin, saltBase64){
  const salt = base64ToBytes(saltBase64);
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:310000, hash:'SHA-256'},
    baseKey,
    {name:'AES-GCM', length:256},
    false,
    ['encrypt','decrypt']
  );
}

export async function encryptJSON(key, value){ return encryptBytes(key, enc.encode(JSON.stringify(value))); }
export async function decryptJSON(key, payload){ const bytes = await decryptBytes(key, payload); return JSON.parse(dec.decode(bytes)); }

export async function encryptBytes(key, bytes){
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, bytes);
  return {iv:bytesToBase64(iv), data:bytesToBase64(data)};
}

export async function decryptBytes(key, payload){
  const iv = base64ToBytes(payload.iv);
  const data = base64ToBytes(payload.data);
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, data);
  return new Uint8Array(plain);
}

export async function encryptBlob(key, blob){ return encryptBytes(key, new Uint8Array(await blob.arrayBuffer())); }
export async function decryptToBlob(key, payload, type='application/octet-stream'){
  const bytes = await decryptBytes(key, payload);
  return new Blob([bytes], {type});
}
