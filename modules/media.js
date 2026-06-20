export function detectKind(type){
  if(type.startsWith('image/')) return 'image';
  if(type.startsWith('video/')) return 'video';
  if(type.startsWith('audio/')) return 'audio';
  return 'file';
}

export function renderAttachment({id, kind, type, url, name}, onDelete){
  const box = document.createElement('article');
  box.className = 'attachment';
  box.dataset.id = id;
  if(kind === 'image') box.innerHTML = `<img loading="lazy" src="${url}" alt="Вкладення" />`;
  else if(kind === 'video') box.innerHTML = `<video controls preload="metadata" src="${url}"></video>`;
  else if(kind === 'audio') box.innerHTML = `<audio controls src="${url}"></audio>`;
  else box.innerHTML = `<div class="file-preview">📄 ${escapeHTML(type || name || 'Файл')}</div>`;
  const actions = document.createElement('div');
  actions.className = 'attachment-actions';
  const del = document.createElement('button');
  del.className = 'danger-button';
  del.textContent = 'Видалити';
  del.addEventListener('click', () => onDelete(id));
  actions.append(del);
  box.append(actions);
  return box;
}

export function escapeHTML(value=''){
  return value.replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
}
