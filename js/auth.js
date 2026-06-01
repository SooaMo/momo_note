/* ══════════════════════════════
   MomoNote — Admin auth
   Password stored as SHA-256 hash only
══════════════════════════════ */
const ADMIN_HASH  = "77a69419556ee1491778c9b1283b904fd2edbb7c17c2afffc946d808be073900";
const ADMIN_KEY   = "momonote_admin";
const ADMIN_TOKEN = "momo_ok_v1";

/* Check if currently logged in */
export function isAdmin() {
  return localStorage.getItem(ADMIN_KEY) === ADMIN_TOKEN;
}

/* Hash a string with SHA-256 */
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
}

/* Show password prompt, resolve true/false */
export function promptAdmin() {
  return new Promise(resolve => {
    if (isAdmin()) { resolve(true); return; }

    // Build modal
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9000;display:flex;align-items:center;justify-content:center";

    overlay.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:28px 28px 22px;width:300px;box-shadow:0 12px 32px rgba(0,0,0,0.18);font-family:inherit">
        <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-bottom:6px">Admin 확인</div>
        <div style="font-size:13px;color:#aaa;margin-bottom:16px">포스팅하려면 비밀번호를 입력하세요</div>
        <input id="admin-pw-input" type="password" placeholder="Password"
          style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid #ddd;font-size:14px;box-sizing:border-box;outline:none;margin-bottom:8px"/>
        <div id="admin-pw-err" style="font-size:12px;color:#e24b4a;min-height:16px;margin-bottom:12px"></div>
        <div style="display:flex;gap:8px">
          <button id="admin-cancel" style="flex:1;padding:9px;border-radius:8px;border:1px solid #e0ddd6;background:transparent;color:#888;cursor:pointer;font-size:13px">Cancel</button>
          <button id="admin-ok" style="flex:1;padding:9px;border-radius:8px;border:none;background:#D4621A;color:#fff;cursor:pointer;font-size:13px;font-weight:500">확인</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const inp  = overlay.querySelector("#admin-pw-input");
    const err  = overlay.querySelector("#admin-pw-err");
    const ok   = overlay.querySelector("#admin-ok");
    const cancel = overlay.querySelector("#admin-cancel");

    inp.focus();

    async function attempt() {
      const hash = await sha256(inp.value);
      if (hash === ADMIN_HASH) {
        localStorage.setItem(ADMIN_KEY, ADMIN_TOKEN);
        document.body.removeChild(overlay);
        resolve(true);
      } else {
        err.textContent = "비밀번호가 틀렸어요";
        inp.value = "";
        inp.focus();
      }
    }

    ok.addEventListener("click", attempt);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") attempt(); });
    cancel.addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(false);
    });
  });
}

/* Wrap any action with admin check */
export async function requireAdmin(action) {
  const ok = await promptAdmin();
  if (ok) action();
}

/* Logout (for dev use) */
export function adminLogout() {
  localStorage.removeItem(ADMIN_KEY);
}
window.adminLogout = adminLogout;