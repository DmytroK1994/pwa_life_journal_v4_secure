import {get,set} from './db.js';
import {randomBytes,bytesToBase64,deriveKey,sha256} from './crypto.js';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 60_000;

export async function getVaultMeta(){ return get('meta','vault'); }
export async function hasVault(){ return Boolean(await getVaultMeta()); }

export async function createVault(pin){
  validatePin(pin);
  const salt = bytesToBase64(randomBytes(16));
  const verifier = await sha256(pin + ':' + salt);
  const meta = {key:'vault', salt, verifier, attempts:0, lockedUntil:0, createdAt:Date.now()};
  await set('meta', meta);
  return deriveKey(pin, salt);
}

export async function unlockVault(pin){
  validatePin(pin);
  const meta = await getVaultMeta();
  if(!meta) return createVault(pin);
  if(meta.lockedUntil && Date.now() < meta.lockedUntil){
    throw new Error('Сейф тимчасово заблоковано після невдалих спроб.');
  }
  const verifier = await sha256(pin + ':' + meta.salt);
  if(verifier !== meta.verifier){
    const attempts = (meta.attempts || 0) + 1;
    await set('meta', {...meta, attempts, lockedUntil: attempts >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0});
    throw new Error(`Невірний PIN. Спроба ${attempts}/${MAX_ATTEMPTS}.`);
  }
  await set('meta', {...meta, attempts:0, lockedUntil:0, lastUnlock:Date.now()});
  return deriveKey(pin, meta.salt);
}

export function validatePin(pin){
  if(!/^\d{6,}$/.test(pin)) throw new Error('PIN має містити мінімум 6 цифр.');
}
