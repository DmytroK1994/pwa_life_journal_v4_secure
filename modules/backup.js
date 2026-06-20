import {all, clear, set} from './db.js';

export async function exportVault(){
  const payload = {
    format:'opus-vault-v1',
    exportedAt:new Date().toISOString(),
    meta:await all('meta'),
    categories:await all('categories'),
    settings:await all('settings'),
    entries:await all('entries'),
    attachments:await all('attachments')
  };
  const blob = new Blob([JSON.stringify(payload)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `opus-backup-${new Date().toISOString().slice(0,10)}.vault`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

export async function importVaultFile(file){
  const payload = JSON.parse(await file.text());
  if(payload.format !== 'opus-vault-v1') throw new Error('Неправильний формат резервної копії.');
  for(const store of ['meta','categories','settings','entries','attachments']) await clear(store);
  for(const item of payload.meta || []) await set('meta', item);
  for(const item of payload.categories || []) await set('categories', item);
  for(const item of payload.settings || []) await set('settings', item);
  for(const item of payload.entries || []) await set('entries', item);
  for(const item of payload.attachments || []) await set('attachments', item);
}
