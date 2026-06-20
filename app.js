import { clearAll, get, put, getAll } from "./modules/db.js";
import { registerUser, loginPassword, loginPin, getUserMeta, lockSession, session } from "./modules/auth.js";
import { categories, saveEntry, listEntries, deleteEntry } from "./modules/entries.js";
import { saveAttachment, getAttachmentBlob, deleteAttachment } from "./modules/media.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = {
  entries: [],
  editingId: null,
  currentAttachments: [],
  mediaRecorder: null,
  chunks: [],
  lastActive: Date.now()
};

function msg(text = "") { $("#authMessage").textContent = text; }

function showAuth(mode = "login") {
  $("#mainView").classList.add("hidden");
  $("#authView").classList.remove("hidden");
  ["loginForm","registerForm","pinForm"].forEach(id => $("#" + id).classList.remove("active"));
  if (mode === "register") $("#registerForm").classList.add("active");
  else if (mode === "pin") $("#pinForm").classList.add("active");
  else $("#loginForm").classList.add("active");
  $("#loginTab").classList.toggle("active", mode !== "register");
  $("#registerTab").classList.toggle("active", mode === "register");
}

function showMain() {
  $("#authView").classList.add("hidden");
  $("#mainView").classList.remove("hidden");
  $("#helloLine").textContent = session.user ? `Сейф: ${session.user}` : "Ваш сейф";
  refreshAll();
}

function setScreen(id) {
  $$(".screen").forEach(s => s.classList.remove("active"));
  $("#" + id).classList.add("active");
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.screen === id));
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("uk-UA", { day:"2-digit", month:"2-digit", year:"numeric" });
}

async function refreshAll() {
  state.entries = await listEntries();
  $("#totalCount").textContent = state.entries.length;
  $("#favCount").textContent = state.entries.filter(e => e.favorite).length;
  $("#pinCount").textContent = state.entries.filter(e => e.pinned).length;
  renderList($("#recentList"), state.entries.slice(0, 20));
  renderList($("#searchList"), state.entries);
  renderCategories();
}

function renderList(container, entries) {
  if (!entries.length) {
    container.innerHTML = `<div class="entry-card"><h4>Поки пусто</h4><p>Створи перший запис. Це швидше, ніж шукати ідеальний додаток 😄</p></div>`;
    return;
  }
  container.innerHTML = entries.map(e => `
    <article class="entry-card" data-id="${e.id}">
      <h4>${e.pinned ? "📌 " : ""}${escapeHtml(e.title)}</h4>
      <p>${escapeHtml(e.body)}</p>
      <div class="entry-meta">
        <span>${escapeHtml(e.category)}</span>
        <span>${formatDate(e.updatedAt)}</span>
        ${e.attachments?.length ? `<span>📎 ${e.attachments.length}</span>` : ""}
      </div>
      <div class="card-actions">
        <button data-action="open">Відкрити</button>
        <button data-action="fav">${e.favorite ? "★" : "☆"}</button>
        <button data-action="pin">${e.pinned ? "Відкр." : "Закр."}</button>
        <button data-action="delete">Видалити</button>
      </div>
    </article>
  `).join("");
}

function renderCategories() {
  const counts = Object.fromEntries(categories.map(c => [c, 0]));
  state.entries.forEach(e => counts[e.category] = (counts[e.category] || 0) + 1);
  $("#categoryList").innerHTML = Object.keys(counts).map(c => `
    <button class="category-pill" data-cat="${escapeHtml(c)}">
      <span>${escapeHtml(c)}</span><strong>${counts[c]}</strong>
    </button>
  `).join("");
}

function fillCategories() {
  $("#entryCategory").innerHTML = categories.map(c => `<option>${escapeHtml(c)}</option>`).join("");
}

function newEntry(category = "Нотатки") {
  state.editingId = null;
  state.currentAttachments = [];
  $("#entryTitle").value = "";
  $("#entryCategory").value = category;
  $("#entryTags").value = "";
  $("#entryBody").value = "";
  $("#attachmentsPreview").innerHTML = "";
  setScreen("editorScreen");
  setTimeout(() => $("#entryTitle").focus(), 80);
}

async function openEntry(id) {
  const e = state.entries.find(x => x.id === id);
  if (!e) return;
  state.editingId = e.id;
  state.currentAttachments = e.attachments || [];
  $("#entryTitle").value = e.title || "";
  $("#entryCategory").value = e.category || "Нотатки";
  $("#entryTags").value = (e.tags || []).join(", ");
  $("#entryBody").value = e.body || "";
  await renderAttachments();
  setScreen("editorScreen");
}

async function renderAttachments() {
  const box = $("#attachmentsPreview");
  box.innerHTML = "";
  for (const att of state.currentAttachments) {
    const blob = await getAttachmentBlob(att.id);
    if (!blob) continue;
    const url = URL.createObjectURL(blob);
    const div = document.createElement("div");
    div.className = "media-item";
    if ((att.mime || "").startsWith("image/")) {
      div.innerHTML = `<img loading="lazy" src="${url}" alt="">`;
    } else if ((att.mime || "").startsWith("video/")) {
      div.innerHTML = `<video controls playsinline src="${url}"></video>`;
    } else if ((att.mime || "").startsWith("audio/")) {
      div.innerHTML = `<audio controls src="${url}"></audio>`;
    } else {
      div.innerHTML = `<div style="padding:18px;font-weight:800">📄 Документ</div>`;
    }
    const btn = document.createElement("button");
    btn.textContent = "Видалити";
    btn.onclick = async () => {
      await deleteAttachment(att.id);
      state.currentAttachments = state.currentAttachments.filter(a => a.id !== att.id);
      await renderAttachments();
    };
    div.appendChild(btn);
    box.appendChild(div);
  }
}

async function saveCurrentEntry() {
  const entry = {
    id: state.editingId,
    title: $("#entryTitle").value.trim() || "Без назви",
    category: $("#entryCategory").value,
    tags: $("#entryTags").value.split(",").map(t => t.trim()).filter(Boolean),
    body: $("#entryBody").value,
    attachments: state.currentAttachments
  };
  await saveEntry(entry);
  await refreshAll();
  setScreen("homeScreen");
}

async function exportVault() {
  const meta = await get("meta", "user");
  const entries = await getAll("entries");
  const attachments = await getAll("attachments");
  const vault = { app: "Opus", version: 3, exportedAt: Date.now(), meta, entries, attachments };
  downloadBlob(new Blob([JSON.stringify(vault)], { type:"application/json" }), `opus-${Date.now()}.vault`);
}

async function exportJson() {
  const data = { exportedAt: Date.now(), entries: state.entries };
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type:"application/json" }), `opus-open-json-${Date.now()}.json`);
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function applyTheme() {
  const stored = localStorage.getItem("opus-theme") || "auto";
  const dark = stored === "dark" || (stored === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function lockNow() {
  lockSession();
  $("#privacyShield").classList.add("show");
  showAuth("pin");
  setTimeout(() => $("#privacyShield").classList.remove("show"), 250);
}

function markActive() { state.lastActive = Date.now(); }

async function init() {
  fillCategories();
  applyTheme();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  const meta = await getUserMeta();
  if (!meta) showAuth("register");
  else {
    $("#quickPinBtn").classList.remove("hidden");
    showAuth("login");
  }

  $("#loginTab").onclick = () => showAuth("login");
  $("#registerTab").onclick = () => showAuth("register");
  $("#quickPinBtn").onclick = () => showAuth("pin");
  $("#backToLoginBtn").onclick = () => showAuth("login");

  $("#registerForm").onsubmit = async e => {
    e.preventDefault(); msg("");
    try {
      const p1 = $("#registerPassword").value;
      const p2 = $("#registerPassword2").value;
      if (p1 !== p2) throw new Error("Паролі не співпадають.");
      await registerUser($("#registerName").value, p1, $("#registerPin").value);
      showMain();
    } catch (err) { msg(err.message); }
  };

  $("#loginForm").onsubmit = async e => {
    e.preventDefault(); msg("");
    try {
      await loginPassword($("#loginName").value, $("#loginPassword").value);
      showMain();
    } catch (err) { msg(err.message); }
  };

  $("#pinForm").onsubmit = async e => {
    e.preventDefault(); msg("");
    try {
      await loginPin($("#pinInput").value);
      $("#pinInput").value = "";
      showMain();
    } catch (err) { msg(err.message); }
  };

  $$(".nav-btn").forEach(btn => btn.onclick = () => setScreen(btn.dataset.screen));
  $("#newEntryBtn").onclick = () => newEntry();
  $$(".quick-btn").forEach(btn => btn.onclick = () => newEntry(btn.dataset.new));
  $("#closeEditorBtn").onclick = () => setScreen("homeScreen");
  $("#saveEntryBtn").onclick = saveCurrentEntry;
  $("#lockBtn").onclick = lockNow;

  $("#themeBtn").onclick = () => {
    const cur = localStorage.getItem("opus-theme") || "auto";
    localStorage.setItem("opus-theme", cur === "dark" ? "light" : "dark");
    applyTheme();
  };

  $("#fileInput").onchange = async e => {
    for (const file of e.target.files) {
      const saved = await saveAttachment(file);
      state.currentAttachments.push(saved);
    }
    e.target.value = "";
    await renderAttachments();
  };

  $("#recordBtn").onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.chunks = [];
      state.mediaRecorder = new MediaRecorder(stream);
      state.mediaRecorder.ondataavailable = e => state.chunks.push(e.data);
      state.mediaRecorder.onstop = async () => {
        const blob = new Blob(state.chunks, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        const saved = await saveAttachment(file);
        state.currentAttachments.push(saved);
        stream.getTracks().forEach(t => t.stop());
        await renderAttachments();
      };
      state.mediaRecorder.start();
      $("#recordBtn").classList.add("hidden");
      $("#stopRecordBtn").classList.remove("hidden");
    } catch {
      alert("Браузер не дав доступ до мікрофона.");
    }
  };

  $("#stopRecordBtn").onclick = () => {
    if (state.mediaRecorder) state.mediaRecorder.stop();
    $("#stopRecordBtn").classList.add("hidden");
    $("#recordBtn").classList.remove("hidden");
  };

  document.body.addEventListener("click", async e => {
    const card = e.target.closest(".entry-card");
    if (!card) return;
    const id = card.dataset.id;
    const action = e.target.dataset.action;
    const item = state.entries.find(x => x.id === id);
    if (!action || !item) return;
    if (action === "open") return openEntry(id);
    if (action === "delete") {
      if (confirm("Видалити запис?")) {
        for (const a of item.attachments || []) await deleteAttachment(a.id);
        await deleteEntry(id);
        await refreshAll();
      }
    }
    if (action === "fav") { item.favorite = !item.favorite; await saveEntry(item); await refreshAll(); }
    if (action === "pin") { item.pinned = !item.pinned; await saveEntry(item); await refreshAll(); }
  });

  $("#searchInput").oninput = () => {
    const q = $("#searchInput").value.toLowerCase().trim();
    const filtered = state.entries.filter(e =>
      [e.title, e.body, e.category, ...(e.tags || [])].join(" ").toLowerCase().includes(q)
    );
    renderList($("#searchList"), filtered);
  };

  $("#categoryList").onclick = e => {
    const btn = e.target.closest(".category-pill");
    if (!btn) return;
    const cat = btn.dataset.cat;
    setScreen("searchScreen");
    $("#searchInput").value = cat;
    renderList($("#searchList"), state.entries.filter(x => x.category === cat));
  };

  $("#exportVaultBtn").onclick = exportVault;
  $("#exportJsonBtn").onclick = exportJson;

  $("#importVaultInput").onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    alert("Імпорт .vault підготовлено як безпечний модуль. У цій версії краще не перезаписувати сейф без окремого підтвердження.");
    e.target.value = "";
  };

  $("#wipeBtn").onclick = async () => {
    if (confirm("Стерти весь локальний сейф? Назад дороги не буде.")) {
      await clearAll();
      location.reload();
    }
  };

  ["touchstart","mousedown","keydown","scroll"].forEach(evt => document.addEventListener(evt, markActive, { passive:true }));

  document.addEventListener("visibilitychange", async () => {
    if (document.hidden && session.unlocked) {
      const meta = await getUserMeta();
      const min = Number(meta?.settings?.autoLockMinutes ?? 1);
      if (min === 0) lockNow();
      else setTimeout(() => {
        if (document.hidden && session.unlocked && Date.now() - state.lastActive >= min * 60 * 1000) lockNow();
      }, min * 60 * 1000);
    }
  });
}

init();
