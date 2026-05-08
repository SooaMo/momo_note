import {
  loadPosts,
  addPost,
  deletePost,
  toggleStatus,
  getFilteredPosts,
  fmtTs,
  getDateKey,
  esc
} from "./posts.js";
import { renderNav } from "./nav.js";

let filter  = "all";
let imgData = null;

/* ── 이미지 첨부 ── */
document.getElementById("inp-img").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) { imgData = null; return; }
  const reader = new FileReader();
  reader.onload = ev => { imgData = ev.target.result; };
  reader.readAsDataURL(file);
});

/* ── 등록 ── */
document.getElementById("btn-post").addEventListener("click", async () => {
  const en  = document.getElementById("inp-en").value.trim();
  const ko  = document.getElementById("inp-ko").value.trim();
  const src = document.getElementById("inp-src").value.trim();

  if (!en || !ko) {
    alert("영어 표현과 한글 의미는 필수입니다.");
    return;
  }

  const btn = document.getElementById("btn-post");
  btn.textContent = "저장 중...";
  btn.disabled = true;

  await addPost(en, ko, src, imgData);

  document.getElementById("inp-en").value  = "";
  document.getElementById("inp-ko").value  = "";
  document.getElementById("inp-src").value = "";
  document.getElementById("inp-img").value = "";
  imgData = null;

  btn.textContent = "등록";
  btn.disabled = false;

  render();
});

/* ── 필터 ── */
document.querySelectorAll(".filter-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach(b =>
      b.classList.toggle("active", b.dataset.filter === filter)
    );
    render();
  });
});

/* ── 타임라인 렌더 ── */
function renderTimeline(filteredPosts) {
  const timeline = document.getElementById("timeline");

  if (!filteredPosts.length) {
    timeline.innerHTML = '<div class="empty">등록된 표현이 없어요.<br>위에서 새 표현을 추가해보세요!</div>';
    return;
  }

  const groups = {};
  filteredPosts.forEach(p => {
    const { y, m, day } = getDateKey(p.ts);
    const key = `${y}-${m}-${day}`;
    if (!groups[key]) groups[key] = { y, m, day, items: [] };
    groups[key].items.push(p);
  });

  let html = "";

  Object.keys(groups).sort((a, b) => (b > a ? 1 : -1)).forEach(key => {
    const g     = groups[key];
    const label = `${g.y}년 ${g.m}월 ${String(g.day).padStart(2, "0")}일`;

    html += `<div class="date-anchor" id="anchor-${key}">${label}</div>`;

    g.items.forEach(p => {
      const knownCls   = p.status === "known"   ? "known-active"   : "";
      const unknownCls = p.status === "unknown" ? "unknown-active" : "";
      const cardCls    = p.status === "known"   ? "known"
                       : p.status === "unknown" ? "unknown" : "";

      html += `
        <div class="card ${cardCls}" id="card-${p.id}">
          ${p.img ? `<div class="card-img-wrap"><img class="card-img" src="${p.img}" alt="첨부 이미지" /></div>` : ""}
          <div class="card-body">
            <div class="card-en">${esc(p.en)}</div>
            <div class="card-ko">${esc(p.ko)}</div>
            ${p.src ? `<div class="card-source">📌 ${esc(p.src)}</div>` : ""}
          </div>
          <div class="card-footer">
            <span class="card-time">${fmtTs(p.ts)}</span>
            <div class="card-actions">
              <button class="toggle-btn ${knownCls}"   onclick="handleToggle(${p.id}, 'known')">✓ <span class="btn-text">알겠다</span></button>
              <button class="toggle-btn ${unknownCls}" onclick="handleToggle(${p.id}, 'unknown')">? <span class="btn-text">모르겠다</span></button>
              <button class="del-btn" onclick="handleDelete(${p.id})">✕</button>
            </div>
          </div>
        </div>
      `;
    });
  });

  timeline.innerHTML = html;
}

/* ── 삭제 (전역 등록) ── */
window.handleDelete = async (id) => {
  if (!confirm("삭제하시겠어요?")) return;
  await deletePost(id);
  render();
};

/* ── 토글 (전역 등록) ── */
window.handleToggle = async (id, status) => {
  await toggleStatus(id, status);
  render();
};

/* ── 전체 렌더 ── */
function render() {
  const filtered = getFilteredPosts(filter);
  renderNav(filtered);
  renderTimeline(filtered);
}

/* ── 앱 시작 ── */
(async () => {
  document.getElementById("timeline").innerHTML =
    '<div class="empty">불러오는 중...</div>';
  await loadPosts();
  render();
})();

/* ── 모바일 사이드바 열기/닫기 ── */
window.openSidebar = () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("open");
};

window.closeSidebar = () => {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
};