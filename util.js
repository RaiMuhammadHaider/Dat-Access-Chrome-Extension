
export function base64DecodeFlexible(input){
  if(!input || typeof input !== 'string') throw new Error('Empty token');
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4; if(pad === 2) input += '=='; else if(pad === 3) input += '=';
  input = input.replace(/[^A-Za-z0-9+/=]/g, '');
  return atob(input);
}
export function textEncoder(){ return new TextEncoder(); }
export function textDecoder(){ return new TextDecoder(); }
export function b64ToBuf(b64){ b64=b64.replace(/-/g,'+').replace(/_/g,'/'); const pad=b64.length%4; if(pad===2)b64+='=='; else if(pad===3)b64+='='; const bin=atob(b64); const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i); return bytes.buffer; }
export function baseDomain(host){ const parts=(host||'').split('.').filter(Boolean); if(parts.length<=2) return host||''; return parts.slice(-2).join('.'); }
export async function activeTab(){ const tabs=await chrome.tabs.query({active:true,currentWindow:true}); return tabs[0]; }
export function buildURL(secure,domain,path){ if(domain && domain.startsWith('.')) domain = domain.slice(1); return `http${secure?'s':''}://${domain}${path||'/'}`; }
export function cookieToSetPayload(c){ const p={name:c.name,value:c.value,path:c.path,secure:c.secure,httpOnly:c.httpOnly,storeId:c.storeId,url:buildURL(c.secure,c.domain||'',c.path||'/')}; if(!c.hostOnly&&c.domain)p.domain=c.domain; if(!c.session&&typeof c.expirationDate==='number')p.expirationDate=c.expirationDate; if(c.sameSite)p.sameSite=c.sameSite; if(c.priority)p.priority=c.priority; if(typeof c.sameParty==='boolean')p.sameParty=c.sameParty; if(c.partitionKey&&typeof c.partitionKey==='object')p.partitionKey=c.partitionKey; return p; }
export async function writeCookies(cookies){ let ok=0,fail=0; for(const c of cookies){ try{ await chrome.cookies.set(cookieToSetPayload(c)); ok++; } catch(e){ console.warn('[DAT Access] cookies.set failed', e, c); fail++; } } return {ok,fail}; }
export async function removeCookieByDesc(c){ try{ const url=buildURL(c.secure, c.domain||'', c.path||'/'); await chrome.cookies.remove({ url, name: c.name, storeId: c.storeId }); } catch(e){ /* ignore */ } }
export async function getAllCookiesForDomain(domain){ return new Promise(r=>chrome.cookies.getAll({domain},r)); }
