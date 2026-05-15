import {
  loadPosts,
  addPost,
  updatePost,
  deletePost,
  toggleStatus,
  addComment,
  deleteComment,
  editComment,
  heartComment,
  addReply,
  deleteReply,
  editReply,
  getFilteredPosts,
  fmtTs,
  getDateKey,
  esc
} from "./posts.js";
import { renderNav, getNavFilter } from "./nav.js";

let filter  = "all";
let imgData = null;

/* ══════════════════════════════
   이미지 압축 (PNG/JPEG 모두)
   최대 800px, JPEG quality 0.75
   → Firestore 1MB 제한 대응
══════════════════════════════ */
function compressImage(file, maxSize = 800, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // 긴 쪽을 maxSize에 맞게 비율 유지 축소
        if (width > height && width > maxSize) {
          height = Math.round(height * maxSize / width);
          width  = maxSize;
        } else if (height > width && height > maxSize) {
          width  = Math.round(width  * maxSize / height);
          height = maxSize;
        } else if (width > maxSize) {
          height = Math.round(height * maxSize / width);
          width  = maxSize;
        }

        canvas.width  = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);

        // PNG도 JPEG으로 변환해서 용량 대폭 감소
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ══════════════════════════════
   등록 (데스크탑)
══════════════════════════════ */
function setupCompose(imgInputId, enInputId, koInputId, srcInputId, btnId, onDone) {
  document.getElementById(imgInputId).addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) { imgData = null; return; }
    imgData = await compressImage(file);
  });

  document.getElementById(btnId).addEventListener("click", async () => {
    const en  = document.getElementById(enInputId).value.trim();
    const ko  = document.getElementById(koInputId).value.trim();
    const src = document.getElementById(srcInputId).value.trim();
    if (!en || !ko) { alert("영어 표현과 한글 의미는 필수입니다."); return; }

    const btn = document.getElementById(btnId);
    btn.textContent = "저장 중...";
    btn.disabled = true;

    await addPost(en, ko, src, imgData);

    document.getElementById(enInputId).value  = "";
    document.getElementById(koInputId).value  = "";
    document.getElementById(srcInputId).value = "";
    document.getElementById(imgInputId).value = "";
    imgData = null;
    btn.textContent = "등록";
    btn.disabled = false;
    if (onDone) onDone();
    render();
  });
}

setupCompose("inp-img", "inp-en", "inp-ko", "inp-src", "btn-post");

/* ══════════════════════════════
   모바일 FAB + 팝업
══════════════════════════════ */
setupCompose("mob-img", "mob-en", "mob-ko", "mob-src", "mob-btn-post", () => {
  document.getElementById("mob-compose-modal").classList.remove("open");
});

window.openMobCompose = () => {
  document.getElementById("mob-compose-modal").classList.add("open");
};
window.closeMobCompose = () => {
  document.getElementById("mob-compose-modal").classList.remove("open");
};
document.getElementById("mob-compose-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("mob-compose-modal")) closeMobCompose();
});

/* ══════════════════════════════
   필터 (알겠다/모르겠다/전체)
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
let editImgData = undefined;

window.openEditModal = (id) => {
  const { posts } = window.__state;
  const p = posts.find(x => x.id === id);
  if (!p) return;
  editImgData = undefined;
  document.getElementById("edit-id").value  = id;
  document.getElementById("edit-en").value  = p.en;
  document.getElementById("edit-ko").value  = p.ko;
  document.getElementById("edit-src").value = p.src || "";
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

document.getElementById("edit-img").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  editImgData = await compressImage(file);
  document.getElementById("edit-img-preview").innerHTML =
    `<img src="${editImgData}" alt="새 이미지" />`;
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

window.handleHeart = async (postId, cid) => {
  await heartComment(postId, cid);
  render();
};

window.toggleReplyForm = (cid) => {
  const form = document.getElementById(`reply-form-${cid}`);
  if (!form) return;
  form.style.display = form.style.display === "none" ? "flex" : "none";
};

window.submitReply = async (postId, cid) => {
  const nameEl = document.getElementById(`rpl-name-${cid}`);
  const textEl = document.getElementById(`rpl-text-${cid}`);
  const name   = nameEl.value.trim();
  const text   = textEl.value.trim();
  if (!name || !text) { alert("이름과 답글을 모두 입력해주세요."); return; }
  await addReply(postId, cid, name, text);
  render();
};

window.handleDeleteReply = async (postId, cid, rid) => {
  if (!confirm("답글을 삭제할까요?")) return;
  await deleteReply(postId, cid, rid);
  render();
};

/* ── 코멘트 인라인 수정 ── */
window.toggleEditComment = (postId, cid, currentText) => {
  const form    = document.getElementById(`edit-comment-form-${cid}`);
  const input   = document.getElementById(`edit-comment-input-${cid}`);
  const textDiv = document.getElementById(`comment-text-${cid}`);
  if (!form) return;
  const isOpen = form.style.display !== "none";
  form.style.display    = isOpen ? "none"  : "flex";
  textDiv.style.display = isOpen ? "block" : "none";
  if (!isOpen) { input.value = currentText; input.focus(); }
};

window.cancelEditComment = (cid) => {
  document.getElementById(`edit-comment-form-${cid}`).style.display = "none";
  document.getElementById(`comment-text-${cid}`).style.display = "block";
};

window.submitEditComment = async (postId, cid) => {
  const input = document.getElementById(`edit-comment-input-${cid}`);
  const text  = input.value.trim();
  if (!text) { alert("내용을 입력해주세요."); return; }
  await editComment(postId, cid, text);
  render();
};

/* ── 답글 인라인 수정 ── */
window.toggleEditReply = (postId, cid, rid, currentText) => {
  const form    = document.getElementById(`edit-reply-form-${rid}`);
  const input   = document.getElementById(`edit-reply-input-${rid}`);
  const textDiv = document.getElementById(`reply-text-${rid}`);
  if (!form) return;
  const isOpen = form.style.display !== "none";
  form.style.display    = isOpen ? "none"  : "flex";
  textDiv.style.display = isOpen ? "block" : "none";
  if (!isOpen) { input.value = currentText; input.focus(); }
};

window.cancelEditReply = (rid) => {
  document.getElementById(`edit-reply-form-${rid}`).style.display = "none";
  document.getElementById(`reply-text-${rid}`).style.display = "block";
};

window.submitEditReply = async (postId, cid, rid) => {
  const input = document.getElementById(`edit-reply-input-${rid}`);
  const text  = input.value.trim();
  if (!text) { alert("내용을 입력해주세요."); return; }
  await editReply(postId, cid, rid, text);
  render();
};

/* ══════════════════════════════
   타임라인 렌더
══════════════════════════════ */
function renderReplies(p, c) {
  const replies = c.replies || [];
  const items = replies.map(r => `
    <div class="reply-item" id="reply-${r.rid}">
      <div class="comment-header">
        <span class="comment-name">${esc(r.name)}</span>
        <span class="comment-time">${fmtTs(r.ts)}${r.edited ? ' <span class="edited-badge">수정됨</span>' : ''}</span>
        <button class="comment-edit-btn" onclick="toggleEditReply(${p.id}, ${c.cid}, ${r.rid}, \`${esc(r.text)}\`)">✎</button>
        <button class="comment-del" onclick="handleDeleteReply(${p.id}, ${c.cid}, ${r.rid})">✕</button>
      </div>
      <div class="comment-text" id="reply-text-${r.rid}">${esc(r.text)}</div>
      <div class="inline-edit-form" id="edit-reply-form-${r.rid}" style="display:none">
        <textarea class="cmt-text-input" id="edit-reply-input-${r.rid}"></textarea>
        <div class="inline-edit-actions">
          <button class="btn-cancel-sm" onclick="cancelEditReply(${r.rid})">취소</button>
          <button class="cmt-submit-btn" onclick="submitEditReply(${p.id}, ${c.cid}, ${r.rid})">저장</button>
        </div>
      </div>
    </div>
  `).join("");

  return `
    <div class="replies-wrap">
      ${items}
      <div class="reply-form" id="reply-form-${c.cid}" style="display:none">
        <input type="text" id="rpl-name-${c.cid}" placeholder="이름" class="cmt-name-input" />
        <textarea id="rpl-text-${c.cid}" placeholder="답글을 입력하세요…" class="cmt-text-input"></textarea>
        <button class="cmt-submit-btn" onclick="submitReply(${p.id}, ${c.cid})">등록</button>
      </div>
    </div>
  `;
}

function renderComments(p) {
  const comments = p.comments || [];
  const items = comments.map(c => `
    <div class="comment-item" id="comment-${c.cid}">
      <div class="comment-header">
        <span class="comment-name">${esc(c.name)}</span>
        <span class="comment-time">${fmtTs(c.ts)}${c.edited ? ' <span class="edited-badge">수정됨</span>' : ''}</span>
        <button class="comment-edit-btn" onclick="toggleEditComment(${p.id}, ${c.cid}, \`${esc(c.text)}\`)">✎</button>
        <button class="comment-del" onclick="handleDeleteComment(${p.id}, ${c.cid})">✕</button>
      </div>
      <div class="comment-text" id="comment-text-${c.cid}">${esc(c.text)}</div>
      <div class="inline-edit-form" id="edit-comment-form-${c.cid}" style="display:none">
        <textarea class="cmt-text-input" id="edit-comment-input-${c.cid}"></textarea>
        <div class="inline-edit-actions">
          <button class="btn-cancel-sm" onclick="cancelEditComment(${c.cid})">취소</button>
          <button class="cmt-submit-btn" onclick="submitEditComment(${p.id}, ${c.cid})">저장</button>
        </div>
      </div>
      <div class="comment-actions">
        <button class="reply-toggle-btn" onclick="toggleReplyForm(${c.cid})">↩ 답글</button>
        <button class="heart-btn" onclick="handleHeart(${p.id}, ${c.cid})">
          ❤️ <span class="heart-count">${c.hearts || 0}</span>
        </button>
      </div>
      ${renderReplies(p, c)}
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

function applyNavFilter(posts) {
  const nf = getNavFilter();
  if (!nf) return posts;
  return posts.filter(p => {
    const { y, m, day } = getDateKey(p.ts);
    if (nf.day) return y == nf.y && m == nf.m && day == nf.day;
    if (nf.m)   return y == nf.y && m == nf.m;
    return y == nf.y;
  });
}

function renderTimeline(filteredPosts) {
  const timeline = document.getElementById("timeline");
  // nav 날짜 필터 적용
  const posts = applyNavFilter(filteredPosts);

  // 오래된 것이 아래, 최신이 위 → 내림차순
  // ts 기준 내림차순 (최신이 위)
  const sorted = [...posts].sort((a, b) => new Date(b.ts) - new Date(a.ts));

  // 날짜별 그룹 먼저 만들기
  const groups = {};
  sorted.forEach(p => {
    const { y, m, day } = getDateKey(p.ts);
    const key = `${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if (!groups[key]) groups[key] = { y, m, day, items: [] };
    groups[key].items.push(p);
  });

  // 번호: 날짜별로 오래된 것이 1번
  // groups 안의 items는 최신순 → 역순으로 번호 부여
  const numberMap = {};
  Object.values(groups).forEach(g => {
    const dayTotal = g.items.length;
    g.items.forEach((p, i) => {
      numberMap[p.id] = dayTotal - i; // 오래된 것 = 1번
    });
  });

  if (!Object.keys(groups).length) {
    timeline.innerHTML = '<div class="empty">등록된 표현이 없어요.</div>';
    return;
  }

  let html = "";
  // 날짜 그룹: 내림차순 문자열 정렬 (zero-padded라서 정확)
  Object.keys(groups).sort((a, b) => b > a ? 1 : -1).forEach(key => {
    const g     = groups[key];
    const label = `${g.y}년 ${g.m}월 ${String(g.day).padStart(2, "0")}일`;
    html += `<div class="date-anchor" id="anchor-${key}">${label}</div>`;

    // 날짜 내에서도 최신이 위
    g.items.forEach(p => {
      const knownCls   = p.status === "known"   ? "known-active"   : "";
      const unknownCls = p.status === "unknown" ? "unknown-active" : "";
      const cardCls    = p.status === "known"   ? "known"
                       : p.status === "unknown" ? "unknown" : "";

      html += `
        <div class="card ${cardCls}" id="card-${p.id}">
          <div class="card-footer">
            <div class="card-actions-left">
              <button class="toggle-btn ${knownCls}"   onclick="handleToggle(${p.id}, 'known')">✓ <span class="btn-text">알겠다</span></button>
              <button class="toggle-btn ${unknownCls}" onclick="handleToggle(${p.id}, 'unknown')">? <span class="btn-text">모르겠다</span></button>
            </div>
            <span class="card-time">${fmtTs(p.ts)}</span>
            <div class="card-actions-right">
              <button class="edit-btn" onclick="openEditModal(${p.id})">✎ <span class="btn-text">수정</span></button>
              <button class="del-btn"  onclick="handleDelete(${p.id})">✕ <span class="btn-text">삭제</span></button>
            </div>
          </div>
          <div class="card-media-wrap">
            ${p.img ? `<div class="card-img-wrap"><img class="card-img" src="${p.img}" alt="첨부 이미지" /></div>` : ""}
            <span class="card-number">${numberMap[p.id]}</span>
          </div>
          <div class="card-body">
            <div class="card-en">${esc(p.en)}</div>
            <div class="card-ko">${esc(p.ko)}</div>
            ${p.src ? `<div class="card-source">📌 ${esc(p.src)}</div>` : ""}
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
  const allFiltered = getFilteredPosts(filter);
  renderNav(allFiltered);          // nav는 항상 전체 포스트 기준
  renderTimeline(allFiltered);     // timeline은 nav필터 추가 적용
}

window.__renderApp = render;

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