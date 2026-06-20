import { put, getAll, get, del } from "./db.js";
import { session } from "./auth.js";
import { encryptText, decryptText } from "./crypto.js";

export const categories = [
  "Щоденник", "Нотатки", "Робота", "Книги", "Промпти ШІ", "Ідеї",
  "Документи", "Родина", "Фінанси", "Інше"
];

export async function saveEntry(entry) {
  if (!session.key) throw new Error("Сейф заблокований.");
  const now = Date.now();
  const plain = {
    title: entry.title || "Без назви",
    body: entry.body || "",
    category: entry.category || "Нотатки",
    tags: entry.tags || [],
    favorite: !!entry.favorite,
    pinned: !!entry.pinned,
    archived: !!entry.archived,
    attachments: entry.attachments || []
  };
  const encrypted = await encryptText(session.key, JSON.stringify(plain));
  const row = {
    id: entry.id || crypto.randomUUID(),
    updatedAt: now,
    createdAt: entry.createdAt || now,
    encrypted
  };
  await put("entries", row);
  return row.id;
}

export async function listEntries() {
  if (!session.key) return [];
  const rows = await getAll("entries");
  const items = [];
  for (const row of rows) {
    try {
      const plain = JSON.parse(await decryptText(session.key, row.encrypted));
      items.push({ ...plain, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt });
    } catch {
      // неправильний ключ або пошкоджений запис
    }
  }
  return items.sort((a,b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt);
}

export async function getEntry(id) {
  const row = await get("entries", id);
  if (!row || !session.key) return null;
  const plain = JSON.parse(await decryptText(session.key, row.encrypted));
  return { ...plain, id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export async function deleteEntry(id) {
  await del("entries", id);
}
