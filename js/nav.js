import { getDateKey } from "./posts.js";

// 현재 선택된 nav 필터 (null = 전체, {y} = 연도, {y,m} = 월, {y,m,day} = 일)
let navFilter = null;

export function getNavFilter() { return navFilter; }

export function renderNav(filteredPosts) {
  const tree = {};

  filteredPosts.forEach(p => {
    const { y, m, day } = getDateKey(p.ts);
    if (!tree[y])    tree[y] = {};
    if (!tree[y][m]) tree[y][m] = new Set();
    tree[y][m].add(day);
  });

  let html = "";

  // 전체보기 버튼
  const allActive = navFilter === null ? "nav-active" : "";
  html += `<div class="nav-all ${allActive}" onclick="setNavFilter(null)">전체보기</div>`;

  Object.keys(tree).sort((a, b) => b - a).forEach(y => {
    const yKey    = `y${y}`;
    const yActive = navFilter && navFilter.y == y && !navFilter.m ? "nav-active" : "";
    html += `
      <div class="nav-year">
        <div class="nav-year-label ${yActive}" onclick="setNavFilter({y:${y}})">
          <span class="nav-toggle open" id="tog-${yKey}" onclick="event.stopPropagation();toggleNav('${yKey}')">▶</span>
          ${y}년
        </div>
        <div class="nav-children open" id="ch-${yKey}">
    `;

    Object.keys(tree[y]).sort((a, b) => b - a).forEach(m => {
      const mKey    = `m${y}-${m}`;
      const mName   = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"][+m - 1];
      const mActive = navFilter && navFilter.y == y && navFilter.m == m && !navFilter.day ? "nav-active" : "";

      html += `
        <div class="nav-month">
          <div class="nav-month-label ${mActive}" onclick="setNavFilter({y:${y},m:${m}})">
            <span class="nav-toggle open" id="tog-${mKey}" onclick="event.stopPropagation();toggleNav('${mKey}')">▶</span>
            ${mName}
          </div>
          <div class="nav-children open" id="ch-${mKey}">
      `;

      [...tree[y][m]].sort((a, b) => b - a).forEach(day => {
        const dActive = navFilter && navFilter.y == y && navFilter.m == m && navFilter.day == day ? "nav-active" : "";
        html += `<div class="nav-day ${dActive}" onclick="setNavFilter({y:${y},m:${m},day:${day}})">${String(day).padStart(2, "0")}일</div>`;
      });

      html += `</div></div>`;
    });

    html += `</div></div>`;
  });

  if (!html) {
    html = '<div style="padding:8px 12px;font-size:12px;color:#bbb">항목 없음</div>';
  }

  document.getElementById("nav-tree").innerHTML = html;
}

export function toggleNav(key) {
  const ch  = document.getElementById("ch-"  + key);
  const tog = document.getElementById("tog-" + key);
  if (!ch) return;
  ch.classList.toggle("open");
  tog.classList.toggle("open");
}

window.toggleNav = toggleNav;

window.setNavFilter = (f) => {
  navFilter = f;
  // 모바일에서 선택 후 사이드바 닫기
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-overlay").classList.remove("open");
  }
  // app.js의 render 호출
  if (window.__renderApp) window.__renderApp();
};