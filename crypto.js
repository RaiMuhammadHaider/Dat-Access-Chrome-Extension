
import { textEncoder, textDecoder, b64ToBuf } from './util.js';
async function importKeyFromPass(pass){ return crypto.subtle.importKey('raw', textEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']); }
async function deriveAesKey(pass, salt, iter){ const base=await importKeyFromPass(pass); return crypto.subtle.deriveKey({ name:'PBKDF2', hash:'SHA-256', salt, iterations: iter||250000 }, base, { name:'AES-GCM', length:256 }, false, ['decrypt']); }
export async function decryptIfNeeded(content, secret){
  try{
    const obj = JSON.parse(content);
    const isEnc = obj && obj.kdf && obj.cipher && obj.payload;
    if(!isEnc) return obj;
    if(!secret) throw new Error('Missing secret for decryption');
    const salt = new Uint8Array(b64ToBuf(obj.kdf.salt));
    const iv = new Uint8Array(b64ToBuf(obj.cipher.iv));
    const key = await deriveAesKey(secret, salt, obj.kdf.iter || 250000);
    const cipher = new Uint8Array(b64ToBuf(obj.payload));
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, cipher);
    const txt = textDecoder().decode(plain);
    return JSON.parse(txt);
  }catch(e){
    try { return JSON.parse(content); } catch(_){ throw e; }
  }
}
