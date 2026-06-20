export class SyncProvider{
  constructor(){ this.enabled = false; }
  async signIn(){ throw new Error('Підключіть Firebase або Supabase provider.'); }
  async pushChanges(){ return {ok:false, reason:'sync-not-configured'}; }
  async pullChanges(){ return {ok:false, reason:'sync-not-configured'}; }
  async shareEntry(){ return {ok:false, reason:'sharing-not-configured'}; }
}

export const syncProvider = new SyncProvider();
