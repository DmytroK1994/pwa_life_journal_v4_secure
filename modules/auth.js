import { get, put } from "./db.js";
import { randomBytes, bytesToB64, deriveKey, encryptText, decryptText } from "./crypto.js";

export const session = {
  user: null,
  key: null,
  pinKey: null,
  unlocked: false
};

export async function getUserMeta() {
  return await get("meta", "user");
}

export async function registerUser(username, password, pin) {
  username = username.trim();
  if (!username) throw new Error("Вкажи логін.");
  if (password.length < 8) throw new Error("Пароль має бути мінімум 8 символів.");
  if (!/^\d{4}$|^\d{6}$/.test(pin)) throw new Error("PIN має бути 4 або 6 цифр.");

  const existing = await getUserMeta();
  if (existing) throw new Error("Користувач уже створений.");

  const passwordSalt = bytesToB64(randomBytes(16));
  const pinSalt = bytesToB64(randomBytes(16));
  const passwordKey = await deriveKey(password, passwordSalt);
  const pinKey = await deriveKey(pin, pinSalt);

  const passwordCheck = await encryptText(passwordKey, "opus-password-ok");
  const pinCheck = await encryptText(pinKey, "opus-pin-ok");

  const meta = {
    key: "user",
    username,
    createdAt: Date.now(),
    passwordSalt,
    pinSalt,
    passwordCheck,
    pinCheck,
    failedAttempts: 0,
    lockedUntil: 0,
    settings: { autoLockMinutes: 1, theme: "auto" }
  };

  await put("meta", meta);
  session.user = username;
  session.key = passwordKey;
  session.pinKey = pinKey;
  session.unlocked = true;
  return meta;
}

async function assertNotLocked(meta) {
  if (meta.lockedUntil && Date.now() < meta.lockedUntil) {
    const sec = Math.ceil((meta.lockedUntil - Date.now()) / 1000);
    throw new Error(`Заблоковано. Спробуй через ${sec} сек.`);
  }
}

async function fail(meta) {
  meta.failedAttempts = (meta.failedAttempts || 0) + 1;
  if (meta.failedAttempts >= 10) meta.lockedUntil = Date.now() + 15 * 60 * 1000;
  else if (meta.failedAttempts >= 5) meta.lockedUntil = Date.now() + 60 * 1000;
  await put("meta", meta);
}

async function success(meta, key, mode) {
  meta.failedAttempts = 0;
  meta.lockedUntil = 0;
  await put("meta", meta);
  session.user = meta.username;
  session.key = key;
  if (mode === "pin") session.pinKey = key;
  session.unlocked = true;
}

export async function loginPassword(username, password) {
  const meta = await getUserMeta();
  if (!meta) throw new Error("Спочатку створи користувача.");
  await assertNotLocked(meta);
  if (username.trim() !== meta.username) {
    await fail(meta);
    throw new Error("Невірний логін або пароль.");
  }
  const key = await deriveKey(password, meta.passwordSalt);
  try {
    const text = await decryptText(key, meta.passwordCheck);
    if (text !== "opus-password-ok") throw new Error();
    await success(meta, key, "password");
    return true;
  } catch {
    await fail(meta);
    throw new Error("Невірний логін або пароль.");
  }
}

export async function loginPin(pin) {
  const meta = await getUserMeta();
  if (!meta) throw new Error("Спочатку створи користувача.");
  await assertNotLocked(meta);
  const key = await deriveKey(pin, meta.pinSalt);
  try {
    const text = await decryptText(key, meta.pinCheck);
    if (text !== "opus-pin-ok") throw new Error();
    await success(meta, key, "pin");
    return true;
  } catch {
    await fail(meta);
    throw new Error("Невірний PIN.");
  }
}

export function lockSession() {
  session.user = null;
  session.key = null;
  session.pinKey = null;
  session.unlocked = false;
}
