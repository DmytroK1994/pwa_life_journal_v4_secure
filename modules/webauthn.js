export async function isPasskeyAvailable(){
  return Boolean(window.PublicKeyCredential && navigator.credentials);
}

export async function tryPasskeyUnlock(){
  if(!(await isPasskeyAvailable())) throw new Error('Face ID / Passkey недоступний у цьому браузері.');
  throw new Error('Passkey-зв’язування потребує серверного challenge. Використайте PIN.');
}
