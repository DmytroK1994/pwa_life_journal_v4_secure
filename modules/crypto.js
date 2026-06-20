const enc = new TextEncoder();
const dec = new TextDecoder();

export function bytesToB64(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

export function b64ToBytes(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export function randomBytes(length = 16) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export async function deriveKey(secret, saltB64, usage = ["encrypt", "decrypt"]) {
  const salt = typeof saltB64 === "string" ? b64ToBytes(saltB64) : saltB64;
  const material = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usage
  );
}

export async function digestSecret(secret, saltB64) {
  const key = await deriveKey(secret, saltB64, ["encrypt"]);
  const check = await encryptText(key, "opus-check");
  return check;
}

export async function encryptText(key, text) {
  const iv = randomBytes(12);
  const data = enc.encode(text);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv: bytesToB64(iv), data: bytesToB64(encrypted), type: "text" };
}

export async function decryptText(key, payload) {
  const iv = b64ToBytes(payload.iv);
  const data = b64ToBytes(payload.data);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return dec.decode(plain);
}

export async function encryptBlob(key, blob) {
  const iv = randomBytes(12);
  const buffer = await blob.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buffer);
  return { iv: bytesToB64(iv), data: encrypted, mime: blob.type || "application/octet-stream", size: blob.size };
}

export async function decryptBlob(key, payload) {
  const iv = b64ToBytes(payload.iv);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, payload.data);
  return new Blob([plain], { type: payload.mime || "application/octet-stream" });
}
