import { getDateKey } from "./posts.js";

export function renderNav(filteredPosts) {
  const tree = {};

  filteredPosts.forEach(p => {
    const { y, m, day } = getDateKey(p.ts);
    if (!tree[y])    tree[y] = {};
    if (!tree[y][m]) tree[y][m] = new Set();
    tree[y][m].add(day);
  });

  let html = "";

  Object.keys(tree).sort((a, b) => b - a).forEach(y => {
    const yKey = `y${y}`;
    html += `
      <div class="nav-year">
        <div class="nav-year-label" onclick="toggleNav('${yKey}')">
          <span class="nav-toggle open" id="tog-${yKey}">▶</span>${y}년
        </div>
        <div class="nav-children open" id="ch-${yKey}">
    `;

    Object.keys(tree[y]).sort((a, b) => b - a).forEach(m => {
      const mKey  = `m${y}-${m}`;
      const mName = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"][+m - 1];

      html += `
        <div class="nav-month">
          <div class="nav-month-label" onclick="toggleNav('${mKey}')">
            <span class="nav-toggle open" id="tog-${mKey}">▶</span>${mName}
          </div>
          <div class="nav-children open" id="ch-${mKey}">
      `;

      [...tree[y][m]].sort((a, b) => b - a).forEach(day => {
        html += `<div class="nav-day" onclick="scrollToAnchor('${y}-${m}-${day}')">${String(day).padStart(2, "0")}일</div>`;
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

export function scrollToAnchor(dateKey) {
  const el = document.getElementById("anchor-" + dateKey);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  // 모바일에서 목차 클릭 후 자동으로 닫기
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-overlay").classList.remove("open");
  }
}

// onclick에서 전역 접근 가능하도록 window에 등록
window.toggleNav      = toggleNav;
window.scrollToAnchor = scrollToAnchor;