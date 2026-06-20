import { put, get, del } from "./db.js";
import { session } from "./auth.js";
import { encryptBlob, decryptBlob } from "./crypto.js";

export async function saveAttachment(file) {
  if (!session.key) throw new Error("Сейф заблокований.");
  const encrypted = await encryptBlob(session.key, file);
  const row = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    encrypted
  };
  await put("attachments", row);
  return { id: row.id, mime: row.mime, size: row.size, name: row.name };
}

export async function getAttachmentBlob(id) {
  const row = await get("attachments", id);
  if (!row || !session.key) return null;
  return await decryptBlob(session.key, row.encrypted);
}

export async function deleteAttachment(id) {
  await del("attachments", id);
}
