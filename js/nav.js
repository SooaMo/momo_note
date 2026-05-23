import { getDateKey } from "./posts.js";

let navFilter = null;
let _calData = {};

export function getNavFilter() { return navFilter; }

export function renderNav(filteredPosts) {
  const tree = {};
  const countMap = {};

  filteredPosts.forEach(p => {
    const { y, m, day } = getDateKey(p.ts);
    if (!tree[y])    tree[y] = {};
    if (!tree[y][m]) tree[y][m] = new Set();
    tree[y][m].add(day);
    const key = `${y}-${m}-${day}`;
    countMap[key] = (countMap[key] || 0) + 1;
  });

  _calData = countMap;

  let html = "";

  const allActive = navFilter === null ? "nav-active" : "";
  html += `<div class="nav-all ${allActive}" onclick="setNavFilter(null);scrollToTop()">All</div>`;

  Object.keys(tree).sort((a, b) => b - a).forEach(y => {
    const yKey    = `y${y}`;
    const yActive = navFilter && navFilter.y == y && !navFilter.m ? "nav-active" : "";

    html += `
      <div class="nav-year">
        <div class="nav-year-label ${yActive}" onclick="setNavFilter({y:${y}})">
          <span class="nav-toggle open" id="tog-${yKey}" onclick="event.stopPropagation();toggleNav('${yKey}')">▶</span>
          ${y}
        </div>
        <div class="nav-children open" id="ch-${yKey}">
    `;

    Object.keys(tree[y]).sort((a, b) => b - a).forEach(m => {
      const mKey    = `m${y}-${m}`;
      const mName   = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m - 1];
      const mActive = navFilter && navFilter.y == y && navFilter.m == m && !navFilter.day ? "nav-active" : "";

      html += `
        <div class="nav-month">
          <div class="nav-month-label ${mActive}" onclick="openMiniCal(${y},${m},event)">
            <span class="nav-toggle open" id="tog-${mKey}" onclick="event.stopPropagation();toggleNav('${mKey}')">▶</span>
            ${mName}
          </div>
          <div class="nav-children open" id="ch-${mKey}">
      `;

      [...tree[y][m]].sort((a, b) => b - a).forEach(day => {
        const dActive = navFilter && navFilter.y == y && navFilter.m == m && navFilter.day == day ? "nav-active" : "";
        const cnt = countMap[`${y}-${m}-${day}`] || 0;
        const suffix = ([11,12,13].includes(day % 100)) ? "th"
          : day % 10 === 1 ? "st"
          : day % 10 === 2 ? "nd"
          : day % 10 === 3 ? "rd" : "th";
        html += `<div class="nav-day ${dActive}" onclick="setNavFilter({y:${y},m:${m},day:${day}})">
          ${day}${suffix}<span class="nav-day-cnt"> ·(${cnt})</span>
        </div>`;
      });

      html += `</div></div>`;
    });

    html += `</div></div>`;
  });

  if (!html) {
    html = '<div style="padding:8px 12px;font-size:12px;color:#bbb">No entries</div>';
  }

  document.getElementById("nav-tree").innerHTML = html;

  // Language switcher + Quiz button
  const currentPage = window.location.pathname;
  const isEng = !currentPage.includes("french");
  const basePath = currentPage.substring(0, currentPage.lastIndexOf("/") + 1);
  const switcher = document.getElementById("lang-switcher");
  if (switcher) {
    switcher.innerHTML = `
      <button class="quiz-nav-btn" onclick="openQuizModal()">🎯 Word Quiz</button>
      <div class="lang-switcher-divider"></div>
      <a href="${basePath}index.html"  class="${isEng  ? "lang-active" : ""}">🇬🇧 English</a>
      <a href="${basePath}french.html" class="${!isEng ? "lang-active" : ""}">🇫🇷 Français</a>
    `;
  }
}

export function toggleNav(key) {
  const ch  = document.getElementById("ch-"  + key);
  const tog = document.getElementById("tog-" + key);
  if (!ch) return;
  ch.classList.toggle("open");
  tog.classList.toggle("open");
}
window.toggleNav = toggleNav;

/* ── Mini calendar ── */
window.openMiniCal = (y, m, event) => {
  event.stopPropagation();

  const existing = document.getElementById("mini-cal-popup");
  if (existing) { existing.remove(); return; }

  const popup = document.createElement("div");
  popup.id = "mini-cal-popup";
  popup.className = "mini-cal-popup";

  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDay    = new Date(y, m - 1, 1).getDay();
  const mName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1];

  let grid = `
    <div class="mini-cal-header">
      <span>${y} ${mName}</span>
      <button onclick="document.getElementById('mini-cal-popup').remove()">✕</button>
    </div>
    <div class="mini-cal-grid">
      <div class="mini-cal-dow">Sun</div><div class="mini-cal-dow">Mon</div>
      <div class="mini-cal-dow">Tue</div><div class="mini-cal-dow">Wed</div>
      <div class="mini-cal-dow">Thu</div><div class="mini-cal-dow">Fri</div>
      <div class="mini-cal-dow">Sat</div>
  `;

  for (let i = 0; i < firstDay; i++) grid += `<div></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const key    = `${y}-${m}-${d}`;
    const cnt    = _calData[key] || 0;
    const hasPost = cnt > 0;
    const clickFn = hasPost
      ? `setNavFilter({y:${y},m:${m},day:${d}});document.getElementById('mini-cal-popup').remove()`
      : "";
    grid += `<div class="mini-cal-day ${hasPost ? "has-post" : ""}" onclick="${clickFn}">
      <span class="mini-cal-d">${d}</span>
      ${hasPost ? `<span class="mini-cal-cnt">${cnt}</span>` : ""}
    </div>`;
  }

  grid += `</div>`;
  popup.innerHTML = grid;

  // Fixed position to the right of the label
  const rect = event.currentTarget.getBoundingClientRect();
  popup.style.top  = rect.top + "px";
  popup.style.left = (rect.right + 8) + "px";

  // Flip left if overflowing right edge
  document.body.appendChild(popup);
  const popRect = popup.getBoundingClientRect();
  if (popRect.right > window.innerWidth - 8) {
    popup.style.left = (rect.left - popRect.width - 8) + "px";
  }
  // Flip up if overflowing bottom edge
  if (popRect.bottom > window.innerHeight - 8) {
    popup.style.top = (window.innerHeight - popRect.height - 8) + "px";
  }

  setTimeout(() => {
    document.addEventListener("click", function handler(e) {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener("click", handler);
      }
    });
  }, 0);
};

/* ── Nav filter ── */
window.setNavFilter = (f) => {
  navFilter = f;
  if (window.__renderApp) window.__renderApp();

  if (f && f.day) {
    setTimeout(() => {
      const key = `${f.y}-${String(f.m).padStart(2,"0")}-${String(f.day).padStart(2,"0")}`;
      const el  = document.getElementById("anchor-" + key);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-overlay").classList.remove("open");
  }
};