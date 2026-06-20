import {all,set,get,del} from './modules/db.js';
import {hasVault,unlockVault} from './modules/auth.js';
import {encryptJSON,decryptJSON,encryptBlob,decryptToBlob} from './modules/crypto.js';
import {detectKind,renderAttachment} from './modules/media.js';
import {exportVault,importVaultFile} from './modules/backup.js';
import {tryPasskeyUnlock} from './modules/webauthn.js';

const defaultCategories = ['Щоденник','Нотатки','Робота','Книги','Промпти ШІ','Ідеї','Документи','Родина','Фінанси'];
const $ = sel => document.querySelector(sel);
const state = {key:null, entries:[], attachments:[], categories:[], selectedCategory:'Головна', editing:null, draftFiles:[], mediaRecorder:null, chunks:[], autoLockMs:300000, timer:null};

const els = {
  lockScreen:$('#lockScreen'), appShell:$('#appShell'), pinForm:$('#pinForm'), pinInput:$('#pinInput'), lockSubtitle:$('#lockSubtitle'), lockHint:$('#lockHint'), faceButton:$('#faceButton'),
  categoryList:$('#categoryList'), viewTitle:$('#viewTitle'), viewSubtitle:$('#viewSubtitle'), homeView:$('#homeView'), listView:$('#listView'), entryList:$('#entryList'), recentList:$('#recentList'), pinnedList:$('#pinnedList'),
  statEntries:$('#statEntries'), statFav:$('#statFav'), statPinned:$('#statPinned'), statFiles:$('#statFiles'), searchInput:$('#searchInput'), newEntryButton:$('#newEntryButton'),
  editorPane:$('#editorPane'), closeEditor:$('#closeEditor'), entryTitle:$('#entryTitle'), entryCategory:$('#entryCategory'), entryTags:$('#entryTags'), entryBody:$('#entryBody'), attachmentsGrid:$('#attachmentsGrid'),
  fileInput:$('#fileInput'), saveEntry:$('#saveEntry'), deleteEntry:$('#deleteEntry'), duplicateEntry:$('#duplicateEntry'), archiveEntry:$('#archiveEntry'), pinEntry:$('#pinEntry'), favEntry:$('#favEntry'), recordButton:$('#recordButton'), recordingStatus:$('#recordingStatus'),
  backupButton:$('#backupButton'), importButton:$('#importButton'), vaultImportInput:$('#vaultImportInput'), settingsButton:$('#settingsButton'), settingsDialog:$('#settingsDialog'), autoLockSelect:$('#autoLockSelect'), newCategoryInput:$('#newCategoryInput'), addCategoryButton:$('#addCategoryButton'), themeToggle:$('#themeToggle'), lockButton:$('#lockButton'), privacyShield:$('#privacyShield')
};

boot();

async function boot(){
  document.documentElement.dataset.theme = localStorage.getItem('opus-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  els.lockSubtitle.textContent = await hasVault() ? 'Введіть PIN-код' : 'Створіть PIN-код: мінімум 6 цифр';
  bindEvents();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
}

function bindEvents(){
  els.pinForm.addEventListener('submit', async e => { e.preventDefault(); await unlock(); });
  els.faceButton.addEventListener('click', async()=>{ try{ await tryPasskeyUnlock(); }catch(e){ showLockHint(e.message); els.pinInput.focus(); }});
  els.newEntryButton.addEventListener('click',()=>openEditor());
  document.querySelectorAll('[data-quick]').forEach(btn => btn.addEventListener('click',()=>openEditor({category:btn.dataset.quick})));
  els.closeEditor.addEventListener('click',closeEditor);
  els.saveEntry.addEventListener('click',saveCurrentEntry);
  els.deleteEntry.addEventListener('click',deleteCurrentEntry);
  els.duplicateEntry.addEventListener('click',duplicateCurrentEntry);
  els.archiveEntry.addEventListener('click',archiveCurrentEntry);
  els.pinEntry.addEventListener('click',()=>toggleDraft('pinned'));
  els.favEntry.addEventListener('click',()=>toggleDraft('favorite'));
  els.fileInput.addEventListener('change',addFiles);
  els.searchInput.addEventListener('input',render);
  els.backupButton.addEventListener('click',exportVault);
  els.importButton.addEventListener('click',()=>els.vaultImportInput.click());
  els.vaultImportInput.addEventListener('change',async()=>{ if(els.vaultImportInput.files[0]){ await importVaultFile(els.vaultImportInput.files[0]); location.reload(); }});
  els.settingsButton.addEventListener('click',()=>els.settingsDialog.showModal());
  els.autoLockSelect.addEventListener('change',async()=>{ state.autoLockMs = Number(els.autoLockSelect.value); await set('settings',{key:'autoLockMs', value:state.autoLockMs}); resetAutoLock(); });
  els.addCategoryButton.addEventListener('click',addCategory);
  els.themeToggle.addEventListener('click',toggleTheme);
  els.lockButton.addEventListener('click',lock);
  els.recordButton.addEventListener('click',toggleRecording);
  ['click','keydown','pointermove','touchstart'].forEach(evt => document.addEventListener(evt, resetAutoLock, {passive:true}));
  document.addEventListener('visibilitychange',()=>{ els.privacyShield.classList.toggle('show', document.hidden); if(document.hidden) lock(false); });
}

async function unlock(){
  try{
    state.key = await unlockVault(els.pinInput.value.trim());
    els.pinInput.value = '';
    els.lockScreen.classList.add('hidden');
    els.appShell.classList.remove('hidden');
    await ensureDefaults();
    await loadData();
    resetAutoLock();
  }catch(err){ showLockHint(err.message); }
}
function showLockHint(msg){ els.lockHint.textContent = msg; }
function lock(showScreen=true){ state.key=null; closeEditor(); if(showScreen){ els.appShell.classList.add('hidden'); els.lockScreen.classList.remove('hidden'); els.lockSubtitle.textContent='Введіть PIN-код'; } }
function resetAutoLock(){ if(!state.key) return; clearTimeout(state.timer); state.timer=setTimeout(()=>lock(), state.autoLockMs); }

async function ensureDefaults(){
  const cats = await all('categories');
  if(!cats.length){ for(const name of defaultCategories) await set('categories',{id:crypto.randomUUID(), name, system:true}); }
  const setting = await get('settings','autoLockMs');
  if(!setting) await set('settings',{key:'autoLockMs', value:300000});
}

async function loadData(){
  state.categories = (await all('categories')).sort((a,b)=>a.name.localeCompare(b.name,'uk'));
  const setting = await get('settings','autoLockMs');
  state.autoLockMs = setting?.value || 300000; els.autoLockSelect.value = String(state.autoLockMs);
  const encryptedEntries = await all('entries');
  const encryptedAttachments = await all('attachments');
  state.entries = [];
  for(const item of encryptedEntries){ try{ state.entries.push(await decryptJSON(state.key,item.payload)); }catch{} }
  state.attachments = encryptedAttachments;
  render();
}

function render(){ renderCategories(); renderHome(); renderList(); fillCategorySelect(); }
function renderCategories(){
  const items = ['Головна','Обране','Закріплені','Архів',...state.categories.map(c=>c.name)];
  els.categoryList.innerHTML = '';
  for(const name of items){
    const btn = document.createElement('button'); btn.className = 'category-item' + (state.selectedCategory===name?' active':''); btn.textContent = name;
    btn.addEventListener('click',()=>{ state.selectedCategory=name; render(); }); els.categoryList.append(btn);
  }
}
function filteredEntries(){
  const q = els.searchInput.value.trim().toLowerCase();
  return state.entries.filter(e => {
    if(e.deleted) return false;
    if(state.selectedCategory==='Обране' && !e.favorite) return false;
    else if(state.selectedCategory==='Закріплені' && !e.pinned) return false;
    else if(state.selectedCategory==='Архів' && !e.archived) return false;
    else if(!['Головна','Обране','Закріплені','Архів'].includes(state.selectedCategory) && e.category !== state.selectedCategory) return false;
    if(state.selectedCategory !== 'Архів' && e.archived) return false;
    if(!q) return true;
    return [e.title,e.body,e.category,(e.tags||[]).join(' ')].join(' ').toLowerCase().includes(q);
  }).sort((a,b)=>(b.pinned-a.pinned) || b.updatedAt-a.updatedAt);
}
function renderHome(){
  const active = state.selectedCategory==='Головна' && !els.searchInput.value.trim();
  els.homeView.classList.toggle('active', active); els.listView.classList.toggle('active', !active);
  els.viewTitle.textContent = state.selectedCategory==='Головна' ? 'Головна' : state.selectedCategory;
  els.viewSubtitle.textContent = active ? 'Ваші записи, медіа та знання' : `${filteredEntries().length} записів`;
  els.statEntries.textContent = state.entries.filter(e=>!e.deleted && !e.archived).length;
  els.statFav.textContent = state.entries.filter(e=>e.favorite && !e.deleted).length;
  els.statPinned.textContent = state.entries.filter(e=>e.pinned && !e.deleted).length;
  els.statFiles.textContent = state.attachments.length;
  renderEntryList(els.recentList, state.entries.filter(e=>!e.deleted && !e.archived).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,6));
  renderEntryList(els.pinnedList, state.entries.filter(e=>e.pinned && !e.deleted && !e.archived).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,6));
}
function renderList(){ renderEntryList(els.entryList, filteredEntries()); }
function renderEntryList(container, entries){
  container.innerHTML = '';
  if(!entries.length){ container.innerHTML = '<p class="hint">Поки що пусто.</p>'; return; }
  for(const e of entries){
    const card = document.createElement('article'); card.className='entry-card';
    card.innerHTML = `<h3>${escapeHTML(e.title || 'Без назви')}</h3><p>${escapeHTML((e.body||'').slice(0,180))}</p><div class="entry-badges"><span class="badge">${escapeHTML(e.category)}</span>${e.pinned?'<span class="badge">Закріплено</span>':''}${e.favorite?'<span class="badge">Обране</span>':''}${(e.tags||[]).slice(0,4).map(t=>`<span class="badge">#${escapeHTML(t)}</span>`).join('')}</div>`;
    card.addEventListener('click',()=>openEditor(e)); container.append(card);
  }
}
function fillCategorySelect(){ els.entryCategory.innerHTML = state.categories.map(c=>`<option>${escapeHTML(c.name)}</option>`).join(''); }

function openEditor(entry={}){
  state.editing = entry.id ? structuredClone(entry) : {id:crypto.randomUUID(), title:'', body:'', category:entry.category || 'Нотатки', tags:[], pinned:false, favorite:false, archived:false, createdAt:Date.now(), updatedAt:Date.now()};
  state.draftFiles = [];
  els.entryTitle.value = state.editing.title || '';
  fillCategorySelect(); els.entryCategory.value = state.editing.category || 'Нотатки';
  els.entryTags.value = (state.editing.tags || []).join(', ');
  els.entryBody.value = state.editing.body || '';
  updateToggleButtons(); renderAttachments(); els.editorPane.classList.remove('hidden');
}
function closeEditor(){ els.editorPane.classList.add('hidden'); state.editing=null; state.draftFiles=[]; }
function collectDraft(){
  Object.assign(state.editing,{title:els.entryTitle.value.trim(), body:els.entryBody.value, category:els.entryCategory.value, tags:els.entryTags.value.split(',').map(t=>t.trim()).filter(Boolean), updatedAt:Date.now()});
  return state.editing;
}
async function saveCurrentEntry(){
  const entry = collectDraft();
  await set('entries',{id:entry.id,payload:await encryptJSON(state.key,entry),updatedAt:entry.updatedAt,category:entry.category});
  for(const item of state.draftFiles){
    const payload = await encryptBlob(state.key,item.file);
    await set('attachments',{id:item.id,entryId:entry.id,kind:item.kind,type:item.file.type,name:item.file.name || item.name,payload,createdAt:Date.now()});
  }
  await loadData(); closeEditor();
}
async function deleteCurrentEntry(){ if(!state.editing) return; const entry=collectDraft(); entry.deleted=true; await set('entries',{id:entry.id,payload:await encryptJSON(state.key,entry),updatedAt:Date.now(),category:entry.category}); await loadData(); closeEditor(); }
async function archiveCurrentEntry(){ state.editing.archived = !state.editing.archived; await saveCurrentEntry(); }
function duplicateCurrentEntry(){ const src=collectDraft(); openEditor({...src,id:crypto.randomUUID(),title:`${src.title || 'Без назви'} копія`,createdAt:Date.now(),updatedAt:Date.now()}); }
function toggleDraft(field){ state.editing[field] = !state.editing[field]; updateToggleButtons(); }
function updateToggleButtons(){ els.pinEntry.textContent = state.editing?.pinned ? 'Відкріпити' : 'Закріпити'; els.favEntry.textContent = state.editing?.favorite ? 'Прибрати з обраного' : 'В обране'; }

async function addFiles(){ for(const file of els.fileInput.files){ state.draftFiles.push({id:crypto.randomUUID(), file, kind:detectKind(file.type)}); } els.fileInput.value=''; await renderAttachments(); }
async function renderAttachments(){
  els.attachmentsGrid.innerHTML = '';
  if(!state.editing) return;
  const existing = state.attachments.filter(a=>a.entryId===state.editing.id);
  for(const a of existing){
    try{ const blob = await decryptToBlob(state.key, a.payload, a.type); const url = URL.createObjectURL(blob); els.attachmentsGrid.append(renderAttachment({...a,url}, deleteAttachment)); }
    catch{}
  }
  for(const item of state.draftFiles){ const url = URL.createObjectURL(item.file); els.attachmentsGrid.append(renderAttachment({id:item.id,kind:item.kind,type:item.file.type,url,name:item.file.name}, id=>{ state.draftFiles=state.draftFiles.filter(f=>f.id!==id); renderAttachments(); })); }
}
async function deleteAttachment(id){ await del('attachments',id); state.attachments = state.attachments.filter(a=>a.id!==id); renderAttachments(); render(); }

async function toggleRecording(){
  if(state.mediaRecorder?.state === 'recording'){ state.mediaRecorder.stop(); return; }
  const stream = await navigator.mediaDevices.getUserMedia({audio:true});
  state.chunks=[]; state.mediaRecorder = new MediaRecorder(stream);
  state.mediaRecorder.ondataavailable = e => state.chunks.push(e.data);
  state.mediaRecorder.onstop = () => { const blob = new Blob(state.chunks,{type:'audio/webm'}); state.draftFiles.push({id:crypto.randomUUID(), file:new File([blob],`voice-${Date.now()}.webm`,{type:'audio/webm'}), kind:'audio'}); stream.getTracks().forEach(t=>t.stop()); els.recordingStatus.textContent='Голосову нотатку додано.'; els.recordButton.textContent='🎙️ Запис голосу'; renderAttachments(); };
  state.mediaRecorder.start(); els.recordingStatus.textContent='Йде запис...'; els.recordButton.textContent='■ Зупинити запис';
}
async function addCategory(){ const name=els.newCategoryInput.value.trim(); if(!name) return; await set('categories',{id:crypto.randomUUID(),name,system:false}); els.newCategoryInput.value=''; await loadData(); }
function toggleTheme(){ const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme=next; localStorage.setItem('opus-theme',next); }
function escapeHTML(value=''){ return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
