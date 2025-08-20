
import { base64DecodeFlexible } from './util.js';

// External users list (CSV-like: user,pass)
const AUTH_URL = "https://github.com/udas1236/db/blob/main/users";

function toRaw(url){
  try{
    const u = new URL(url);
    if(u.hostname === 'github.com'){
      const parts = u.pathname.split('/').filter(Boolean); // owner repo blob branch ...path
      if(parts.length >= 5 && parts[2] === 'blob'){
        const owner = parts[0], repo = parts[1], branch = parts[3];
        const path = parts.slice(4).join('/');
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
      }
    }
    return url;
  }catch(_){ return url; }
}
function ghHeaders(token){
  return token ? { 'Authorization': `token ${token}`, 'Accept':'application/vnd.github+json','Cache-Control':'no-cache, no-store' }
               : { 'Accept':'application/vnd.github+json','Cache-Control':'no-cache, no-store' };
}
export async function decodeSetupToken(b64){
  const raw = base64DecodeFlexible(b64);
  const obj = JSON.parse(raw);
  if(!obj || !obj.gistId || !obj.token || !obj.secret) throw new Error('Invalid setup token');
  obj.filename = obj.filename || 'session.json';
  return obj;
}
export async function readGist(token, gistId){
  const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers: ghHeaders(token) });
  if(!res.ok) throw new Error('Gist fetch failed: '+res.status);
  return res.json();
}
export async function readGistFile(token, gistId, filename){
  const data = await readGist(token, gistId);
  const f = data.files && data.files[filename];
  if(!f) throw new Error(`File not found in gist: ${filename}`);
  if(!f.truncated && typeof f.content === 'string') return f.content;
  if(f.raw_url){
    const r = await fetch(f.raw_url, { headers: ghHeaders(token) });
    if(!r.ok) throw new Error('Raw fetch failed: '+r.status);
    return await r.text();
  }
  throw new Error('Unsupported gist file state');
}
export async function fetchUsersList(){
  const url = toRaw(AUTH_URL);
  const res = await fetch(url, { headers: ghHeaders() });
  if(!res.ok) throw new Error('Users fetch failed: '+res.status);
  return await res.text();
}
export function parseUsers(csv){
  const rows = csv.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const out = [];
  for(const line of rows){
    if(/^\s*(user\s*,\s*pass)\s*$/i.test(line)) continue;
    const parts = line.split(',');
    const user = (parts[0]||'').trim();
    const pass = (parts[1]||'').trim();
    if(!user && !pass) continue;
    out.push({ user, pass });
  }
  return out;
}
// Verify user/pass against external list. If username is empty, match by pass only.
export async function verifyAuthExternal(username, password){
  const text = await fetchUsersList();
  const entries = parseUsers(text);
  for(const e of entries){
    const revoked = e.pass.endsWith('x');
    if(username){
      if(e.user === username && e.pass === password && !revoked) return true;
    }else{
      if(e.pass === password && !revoked) return true;
    }
  }
  return false;
}
