import {
  loadPosts,
  addPost,
  updatePost,
  deletePost,
  toggleStatus,
  addComment,
  deleteComment,
  getFilteredPosts,
  fmtTs,
  getDateKey,
  esc
} from "./posts.js";
import { renderNav } from "./nav.js";

let filter  = "all";
let imgData = null;

/* ══════════════════════════════
   등록
══════════════════════════════ */
document.getElementById("inp-img").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) { imgData = null; return; }
  const reader = new FileReader();
  reader.onload = ev => { imgData = ev.target.result; };
  reader.readAsDataURL(file);
});

document.getElementById("btn-post").addEventListener("click", async () => {
  const en  = document.getElementById("inp-en").value.trim();
  const ko  = document.getElementById("inp-ko").value.trim();
  const src = document.getElementById("inp-src").value.trim();
  if (!en || !ko) { alert("영어 표현과 한글 의미는 필수입니다."); return; }

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

/* ══════════════════════════════
   필터
══════════════════════════════ */
document.querySelectorAll(".filter-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach(b =>
      b.classList.toggle("active", b.dataset.filter === filter)
    );
    render();
  });
});

/* ══════════════════════════════
   수정 팝업
══════════════════════════════ */
let editImgData = undefined; // undefined = 변경없음, null = 삭제, string = 새이미지

window.openEditModal = (id) => {
  const { posts } = window.__state;
  const p = posts.find(x => x.id === id);
  if (!p) return;

  editImgData = undefined;

  document.getElementById("edit-id").value  = id;
  document.getElementById("edit-en").value  = p.en;
  document.getElementById("edit-ko").value  = p.ko;
  document.getElementById("edit-src").value = p.src || "";

  // 현재 이미지 미리보기
  const preview = document.getElementById("edit-img-preview");
  if (p.img) {
    preview.innerHTML = `<img src="${p.img}" alt="현재 이미지" /><button type="button" onclick="removeEditImg()">이미지 삭제</button>`;
  } else {
    preview.innerHTML = "";
  }

  document.getElementById("edit-modal").classList.add("open");
};

window.closeEditModal = () => {
  document.getElementById("edit-modal").classList.remove("open");
};

window.removeEditImg = () => {
  editImgData = null;
  document.getElementById("edit-img-preview").innerHTML = '<span style="color:#bbb;font-size:12px">이미지 삭제됨</span>';
};

document.getElementById("edit-img").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    editImgData = ev.target.result;
    document.getElementById("edit-img-preview").innerHTML =
      `<img src="${editImgData}" alt="새 이미지" />`;
  };
  reader.readAsDataURL(file);
});

document.getElementById("btn-edit-save").addEventListener("click", async () => {
  const id  = Number(document.getElementById("edit-id").value);
  const en  = document.getElementById("edit-en").value.trim();
  const ko  = document.getElementById("edit-ko").value.trim();
  const src = document.getElementById("edit-src").value.trim();
  if (!en || !ko) { alert("영어 표현과 한글 의미는 필수입니다."); return; }

  const btn = document.getElementById("btn-edit-save");
  btn.textContent = "저장 중...";
  btn.disabled = true;

  await updatePost(id, { en, ko, src, img: editImgData });

  btn.textContent = "저장";
  btn.disabled = false;
  closeEditModal();
  render();
});

// 모달 바깥 클릭 시 닫기
document.getElementById("edit-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("edit-modal")) closeEditModal();
});

/* ══════════════════════════════
   코멘트
══════════════════════════════ */
window.submitComment = async (postId) => {
  const nameEl = document.getElementById(`cmt-name-${postId}`);
  const textEl = document.getElementById(`cmt-text-${postId}`);
  const name   = nameEl.value.trim();
  const text   = textEl.value.trim();
  if (!name || !text) { alert("이름과 코멘트를 모두 입력해주세요."); return; }

  const btn = document.getElementById(`cmt-btn-${postId}`);
  btn.textContent = "저장 중...";
  btn.disabled = true;

  await addComment(postId, name, text);
  nameEl.value = "";
  textEl.value = "";
  btn.textContent = "등록";
  btn.disabled = false;
  render();
};

window.handleDeleteComment = async (postId, cid) => {
  if (!confirm("코멘트를 삭제할까요?")) return;
  await deleteComment(postId, cid);
  render();
};

/* ══════════════════════════════
   타임라인 렌더
══════════════════════════════ */
function renderComments(p) {
  const comments = p.comments || [];
  const items = comments.map(c => `
    <div class="comment-item">
      <div class="comment-header">
        <span class="comment-name">${esc(c.name)}</span>
        <span class="comment-time">${fmtTs(c.ts)}</span>
        <button class="comment-del" onclick="handleDeleteComment(${p.id}, ${c.cid})">✕</button>
      </div>
      <div class="comment-text">${esc(c.text)}</div>
    </div>
  `).join("");

  return `
    <div class="comments-section">
      ${items}
      <div class="comment-form">
        <input type="text" id="cmt-name-${p.id}" placeholder="이름" class="cmt-name-input" />
        <textarea id="cmt-text-${p.id}" placeholder="코멘트를 입력하세요…" class="cmt-text-input"></textarea>
        <button id="cmt-btn-${p.id}" class="cmt-submit-btn" onclick="submitComment(${p.id})">등록</button>
      </div>
    </div>
  `;
}

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
            <div class="card-actions-left">
              <button class="toggle-btn ${knownCls}"   onclick="handleToggle(${p.id}, 'known')">✓ <span class="btn-text">알겠다</span></button>
              <button class="toggle-btn ${unknownCls}" onclick="handleToggle(${p.id}, 'unknown')">? <span class="btn-text">모르겠다</span></button>
            </div>
            <span class="card-time">${fmtTs(p.ts)}</span>
            <div class="card-actions-right">
              <button class="edit-btn" onclick="openEditModal(${p.id})">✎ <span class="btn-text">수정</span></button>
              <button class="del-btn"  onclick="handleDelete(${p.id})">🗑 <span class="btn-text">삭제</span></button>
            </div>
          </div>
          ${renderComments(p)}
        </div>
      `;
    });
  });

  timeline.innerHTML = html;
}

/* ══════════════════════════════
   전역 핸들러
══════════════════════════════ */
window.handleDelete = async (id) => {
  if (!confirm("삭제하시겠어요?")) return;
  await deletePost(id);
  render();
};

window.handleToggle = async (id, status) => {
  await toggleStatus(id, status);
  render();
};

/* ══════════════════════════════
   전체 렌더
══════════════════════════════ */
function render() {
  const filtered = getFilteredPosts(filter);
  renderNav(filtered);
  renderTimeline(filtered);
}

/* ══════════════════════════════
   앱 시작
══════════════════════════════ */
import("./posts.js").then(m => {
  window.__state = { get posts() { return m.posts; } };
});

(async () => {
  document.getElementById("timeline").innerHTML =
    '<div class="empty">불러오는 중...</div>';
  await loadPosts();
  render();
})();

/* ══════════════════════════════
   모바일 사이드바
══════════════════════════════ */
window.openSidebar = () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("open");
};

window.closeSidebar = () => {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
};