
import { activeTab, baseDomain, writeCookies, removeCookieByDesc, getAllCookiesForDomain } from './util.js';
import { decodeSetupToken, readGistFile, verifyAuthExternal } from './github.js';
import { decryptIfNeeded } from './crypto.js';

async function loadCfg() { return new Promise(r => chrome.storage.local.get({ locked: false, setupToken: '', cfg: null, auth: null, enabledBases: {}, lastMerged: [] }, r)); }
async function save(obj) { return new Promise(r => chrome.storage.local.set(obj, r)); }
function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }

function disabledView() {
  const root = document.getElementById('root'); root.innerHTML = '';
  const card = el(`<div class="card disabled-card center" style="min-height:380px;flex-direction:column">
    <div class="disabled-title">This account is disabled</div>
    <div class="disabled-text">Don’t worry—this can be re‑enabled. Please contact <span class="phone">ASH Dispatch</span> at <span class="phone">+92 339 0002665</span>.</div>
  </div>`);
  root.appendChild(card);
  const footer = el(`<div class="footer" style="margin-top:20px;text-align:center;font-size:12px;opacity:0.7">
    Developed by ASH Dispatch
  </div>`);
  root.appendChild(footer);
}

function setupView(onSave) {
  const root = document.getElementById('root'); root.innerHTML = '';
  const hdr = el(`<div class="header"><div class="brand">DAT Access</div><div class="badge">Setup</div></div>`);
  root.appendChild(hdr);
  const card = el(`<div class="card"></div>`);
  card.appendChild(el('<label>Setup Code (Base64)</label>'));
  const tokenInp = el('<textarea id="token" rows="4" placeholder="Paste Base64 token from DAT Sync"></textarea>'); card.appendChild(tokenInp);
  card.appendChild(el('<label>Username (optional)</label>'));
  const userInp = el('<input id="user" type="text" placeholder="username">'); card.appendChild(userInp);
  card.appendChild(el('<label>Password</label>'));
  const passInp = el('<input id="pass" type="password" placeholder="password">'); card.appendChild(passInp);
  const row = el('<div class="row controls"><button id="saveBtn" class="primary full">Save & Lock</button></div>');
  const status = el('<div class="status"></div>');
  card.appendChild(row); card.appendChild(status);
  root.appendChild(card);

  row.querySelector('#saveBtn').addEventListener('click', async () => {
    try {
      const token = tokenInp.value.trim(); const user = userInp.value.trim(); const pass = passInp.value;
      if (!token) throw new Error('Token required'); if (!pass) throw new Error('Password required');
      const cfg = await decodeSetupToken(token);
      const ok = await verifyAuthExternal(user || null, pass);
      if (!ok) throw new Error('Access denied (check user/pass or revocation)');
      await save({ locked: true, setupToken: token, cfg, auth: { user, pass } });
      onSave();
    } catch (e) { status.textContent = 'Error: ' + (e?.message || String(e)); status.className = 'status err'; }
  });
   const footer = el(`<div class="footer" style="margin-top:20px;text-align:center;font-size:12px;opacity:0.7">
    Developed by ASH Dispatch
  </div>`);
  root.appendChild(footer);
}

async function getEnabledFor(bd) { const s = await loadCfg(); return !!(s.enabledBases || {})[bd]; }
async function setEnabledFor(bd, on) { const s = await loadCfg(); const map = s.enabledBases || {}; map[bd] = !!on; await save({ enabledBases: map }); }

function mainView(cfg, auth) {
  const root = document.getElementById('root'); root.innerHTML = '';
  const hdr = el(`<div class="header">
 
  <div class="brand">
    <div class="logo"></div>

  DAT Access</div>
  <div class="badge">Connected</div>
</div>`);
  root.appendChild(hdr);
  const card = el(`<div class="card"></div>`);
  const controls = el(`<div class="controls"></div>`);

  // Toggle only
  const loginBtn = el('<button id="loginBtn" class="primary full"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12h13m0 0-3.5-3.5M16 12l-3.5 3.5" stroke="#031313" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Login</button>');
  controls.appendChild(loginBtn);

  // Toggle below
  const toggleWrap = el(`<div style="display:flex;align-items:center;justify-content:space-between">
  <div>
    <div style="font-weight:700">Enable</div>
    <div class="status" style="margin:2px 0 0 0">Turn on to allow Login on this site</div>
  </div>
  
  <label class="switch">
  <input type="checkbox" id="enable">
  <span class="slider"></span>
</label>

</div>`);
  controls.appendChild(toggleWrap);
  // const toggleWrap = el(`<div style="display:flex;align-items:center;justify-content:space-between">
  //   <div>
  //     <div style="font-weight:700">Enable</div>
  //     <div class="status" style="margin:2px 0 0 0">Turn on to allow Login on this site</div>
  //   </div>
  //   <label class="switch"><input type="checkbox" id="enable"><span class="slider"></span></label>
  // </div>`);
  // controls.appendChild(toggleWrap);

  // Login button only
  // const loginBtn = el('<button id="loginBtn" class="primary full"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12h13m0 0-3.5-3.5M16 12l-3.5 3.5" stroke="#031313" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Login</button>');
  // controls.appendChild(loginBtn);


  const status = el('<div class="status">Verifying access…</div>');
  card.appendChild(controls); card.appendChild(status);
  root.appendChild(card);
  // Footer
  const footer = el(`<div class="footer" style="margin-top:20px;text-align:center;font-size:12px;opacity:0.7">
    Developed by ASH Dispatch
  </div>`);
  root.appendChild(footer);


  async function bindToggle() {
    const tab = await activeTab(); const url = new URL(tab.url || 'about:blank'); const bd = baseDomain(url.hostname || '');
    const enableEl = toggleWrap.querySelector('#enable');
    const initialOn = await getEnabledFor(bd); enableEl.checked = initialOn; loginBtn.disabled = !initialOn;
    enableEl.addEventListener('change', async () => { const on = enableEl.checked; await setEnabledFor(bd, on); loginBtn.disabled = !on; });
  }
  bindToggle();

  async function killSwitch() {
    try {
      const s = await loadCfg();
      // Remove exactly what we merged last time
      const merged = Array.isArray(s.lastMerged) ? s.lastMerged : [];
      for (const c of merged) { await removeCookieByDesc(c); }
      // Fallback: clear dat.com and one.dat.com
      for (const dom of ['dat.com', 'one.dat.com']) {
        const all = await getAllCookiesForDomain(dom);
        for (const c of all) { await removeCookieByDesc({ name: c.name, domain: c.domain, path: c.path || '/', secure: c.secure, storeId: c.storeId }); }
      }
      await save({ lastMerged: [] });
    } catch (e) { /* ignore */ }
  }

  async function verifyNow() {
    status.textContent = 'Verifying access…'; status.className = 'status';
    try {
      const ok = await verifyAuthExternal(auth?.user || null, auth?.pass || '');
      if (ok) { status.textContent = 'Access OK.'; status.className = 'status ok'; loginBtn.disabled = false; }
      else { await killSwitch(); disabledView(); }
    } catch (e) { status.textContent = 'Verify error: ' + (e?.message || String(e)); status.className = 'status err'; loginBtn.disabled = true; }
  }
  verifyNow();

  loginBtn.addEventListener('click', async () => {
    status.textContent = 'Fetching session…'; status.className = 'status';
    try {
      const raw = await readGistFile(cfg.token, cfg.gistId, cfg.filename);
      const state = await decryptIfNeeded(raw, cfg.secret);
      let cookieGroups = [];
      if (state && state.snapshots && state.latest) {
        const snap = state.snapshots.find(s => s.id === state.latest) || state.snapshots[state.snapshots.length - 1];
        cookieGroups = Object.values(snap.domains || {});
      } else if (state && state.domains) {
        cookieGroups = Object.values(state.domains);
      } else {
        throw new Error('Unsupported session format');
      }
      const all = cookieGroups.flat();
      const res = await writeCookies(all);
      // Track minimal descriptors for kill-switch
      const descriptors = all.map(c => ({ name: c.name, domain: c.domain || '', path: c.path || '/', secure: !!c.secure, storeId: c.storeId }));
      await save({ lastMerged: descriptors });
      status.textContent = `Merged ${res.ok}/${all.length} cookie(s)` + (res.fail ? `, ${res.fail} failed` : '');
      status.className = 'status ok';
    } catch (e) {
      status.textContent = 'Login error: ' + (e?.message || String(e));
      status.className = 'status err';
    }
  });
  
}

document.addEventListener('DOMContentLoaded', async () => {
  const s = await loadCfg();
  if (!s.locked) {
    setupView(async () => { const s2 = await loadCfg(); mainView(s2.cfg, s2.auth); });
  } else {
    mainView(s.cfg, s.auth);
  }

});
