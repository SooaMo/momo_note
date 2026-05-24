import {
  loadPosts,
  addPost,
  updatePost,
  updateUnknownWords,
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

let filter      = "all";
let imgData     = null;
let searchQuery = "";

/* Auto-resize textarea */
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}
document.addEventListener("input", e => {
  if (e.target.classList.contains("compose-textarea")) autoResize(e.target);
});

/* ══════════════════════════════
   Image compression
══════════════════════════════ */
function compressImage(file, maxSize = 800, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round(height * maxSize / width); width = maxSize;
        } else if (height > width && height > maxSize) {
          width = Math.round(width * maxSize / height); height = maxSize;
        } else if (width > maxSize) {
          height = Math.round(height * maxSize / width); width = maxSize;
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ══════════════════════════════
   모르는 단어 하이라이트
══════════════════════════════ */
function highlightWords(text, words) {
  if (!words || !words.length) return esc(text);
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(w => w.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"));
  const pattern = escaped.join("|");
  if (!pattern) return esc(text);
  try {
    return esc(text).replace(
      new RegExp("(" + pattern + ")", "gi"),
      '<mark class="word-highlight">$1</mark>'
    );
  } catch(e) {
    return esc(text);
  }
}

/* ══════════════════════════════
   모르는 단어 태그 섹션
══════════════════════════════ */
function renderUnknownWords(p) {
  const words = p.unknownWords || [];
  const tags = words.map((w, i) =>
    `<span class="word-tag">
      <span class="word-tag-label" onclick="lookupWord(event,'${esc(w).replace(/'/g,"\\'")}',${p.id})">${esc(w)}</span>
      <button class="word-tag-del" onclick="removeWord(${p.id},${i})">✕</button>
    </span>`
  ).join("");

  return `
    <div class="unknown-words-section">
      <div class="unknown-words-header" onclick="toggleWordSection(${p.id})">
        <span>📝 Unknown words${words.length ? " (" + words.length + ")" : ""}</span>
        <span id="uw-tog-${p.id}">▼</span>
      </div>
      <div class="unknown-words-body" id="uw-body-${p.id}" style="display:none">
        <div class="word-tags">${tags}</div>
        <div id="def-panel-${p.id}" class="def-panel" style="display:none"></div>
        <div class="word-input-row">
          <input type="text" id="word-input-${p.id}" placeholder="Type a word and press Enter" class="word-input"
            onkeydown="if(event.key==='Enter'){event.preventDefault();addWord(${p.id})}" />
          <button class="word-add-btn" onclick="addWord(${p.id})">Add</button>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════
   단어 뜻 조회 (Free Dictionary API)
══════════════════════════════ */
window.lookupWord = async (e, word, postId) => {
  e.stopPropagation();
  const panel = document.getElementById("def-panel-" + postId);
  if (!panel) return;

  if (panel.dataset.word === word && panel.style.display !== "none") {
    panel.style.display = "none";
    panel.dataset.word  = "";
    document.querySelectorAll(".word-tag-label").forEach(el => el.classList.remove("word-tag-active"));
    return;
  }

  document.querySelectorAll(".word-tag-label").forEach(el => el.classList.remove("word-tag-active"));
  e.target.classList.add("word-tag-active");
  panel.dataset.word  = word;
  panel.style.display = "block";
  panel.innerHTML     = `<span class="def-loading">Looking up <em>${esc(word)}</em>…</span>`;

  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(word + " meaning")}`;

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) throw new Error("not found");
    const data     = await res.json();
    const entry    = data[0];
    const phonetic = entry.phonetics?.find(ph => ph.text)?.text || "";

    let html = `
      <div class="def-header">
        <span class="def-word">${esc(word)}</span>
        ${phonetic ? `<span class="def-phonetic">${esc(phonetic)}</span>` : ""}
        <a class="def-google-link" href="${googleUrl}" target="_blank" rel="noopener">Google ↗</a>
        <button class="def-close" onclick="closeDefPanel(${postId})">✕</button>
      </div>`;

    entry.meanings.slice(0, 3).forEach(m => {
      html += `<div class="def-pos">${esc(m.partOfSpeech)}</div>`;
      m.definitions.slice(0, 2).forEach((d, i) => {
        html += `<div class="def-item">
          <span class="def-num">${i + 1}.</span>
          <span class="def-text">${esc(d.definition)}</span>
          ${d.example ? `<div class="def-example">"${esc(d.example)}"</div>` : ""}
        </div>`;
      });
    });

    panel.innerHTML = html;
  } catch {
    panel.innerHTML = `
      <div class="def-header">
        <span class="def-word">${esc(word)}</span>
        <a class="def-google-link" href="${googleUrl}" target="_blank" rel="noopener">Google ↗</a>
        <button class="def-close" onclick="closeDefPanel(${postId})">✕</button>
      </div>
      <div class="def-item" style="color:#999;font-size:0.75rem">Definition not found. Try searching on Google.</div>`;
  }
};

window.closeDefPanel = (postId) => {
  const panel = document.getElementById("def-panel-" + postId);
  if (!panel) return;
  panel.style.display = "none";
  panel.dataset.word  = "";
  document.querySelectorAll(".word-tag-label").forEach(el => el.classList.remove("word-tag-active"));
};

window.toggleWordSection = (id) => {
  const body = document.getElementById("uw-body-" + id);
  const tog  = document.getElementById("uw-tog-"  + id);
  if (!body) return;
  const isOpen = body.style.display !== "none";
  body.style.display = isOpen ? "none" : "block";
  if (tog) tog.textContent = isOpen ? "▼" : "▲";
};

window.addWord = async (id) => {
  const input = document.getElementById("word-input-" + id);
  if (!input) return;
  const word = input.value.trim();
  if (!word) return;
  const { posts: all } = window.__state || {};
  const post = all && all.find(p => p.id === id);
  if (!post) return;
  const words = [...(post.unknownWords || [])];
  if (!words.includes(word)) words.push(word);
  await updateUnknownWords(id, words);
  input.value = "";
  render();
  setTimeout(() => {
    const body = document.getElementById("uw-body-" + id);
    const tog  = document.getElementById("uw-tog-"  + id);
    if (body) body.style.display = "block";
    if (tog)  tog.textContent = "▲";
  }, 80);
};

window.removeWord = async (id, idx) => {
  const { posts: all } = window.__state || {};
  const post = all && all.find(p => p.id === id);
  if (!post) return;
  const words = [...(post.unknownWords || [])];
  words.splice(idx, 1);
  await updateUnknownWords(id, words);
  render();
};

/* ══════════════════════════════
   Post submission
══════════════════════════════ */
function setupCompose(imgInputId, enInputId, koInputId, srcInputId, btnId, wordsInputId, onDone) {
  document.getElementById(imgInputId).addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) { imgData = null; return; }
    imgData = await compressImage(file);
  });

  document.getElementById(btnId).addEventListener("click", async () => {
    const en  = document.getElementById(enInputId).value.trim();
    const ko  = document.getElementById(koInputId).value.trim();
    const src = document.getElementById(srcInputId).value.trim();
    if (!en || !ko) { alert("Expression and description are required."); return; }

    const btn = document.getElementById(btnId);
    btn.textContent = "Saving...";
    btn.disabled = true;

    const wordsEl      = wordsInputId ? document.getElementById(wordsInputId) : null;
    const unknownWords = wordsEl
      ? wordsEl.value.split(",").map(w => w.trim()).filter(Boolean)
      : [];

    await addPost(en, ko, src, imgData, unknownWords);

    document.getElementById(enInputId).value  = "";
    document.getElementById(koInputId).value  = "";
    document.getElementById(srcInputId).value = "";
    document.getElementById(imgInputId).value = "";
    if (wordsEl) wordsEl.value = "";
    imgData = null;
    btn.textContent = "Post";
    btn.disabled = false;
    if (onDone) onDone();
    render();
  });
}

setupCompose("inp-img", "inp-en", "inp-ko", "inp-src", "btn-post", "inp-words");

/* ══════════════════════════════
   Mobile FAB + popup
══════════════════════════════ */
setupCompose("mob-img", "mob-en", "mob-ko", "mob-src", "mob-btn-post", "mob-words", () => {
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
   Filter tabs
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
   Edit modal
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
  // Load existing unknown words
  const editWords = document.getElementById("edit-words");
  if (editWords) {
    editWords.value = (p.unknownWords || []).join(", ");
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
  if (!en || !ko) { alert("Expression and description are required."); return; }
  const btn = document.getElementById("btn-edit-save");
  btn.textContent = "Saving...";
  btn.disabled = true;
  // Parse unknown words
  const editWordsEl  = document.getElementById("edit-words");
  const unknownWords = editWordsEl
    ? editWordsEl.value.split(",").map(w => w.trim()).filter(Boolean)
    : undefined;

  await updatePost(id, { en, ko, src, img: editImgData, unknownWords });
  btn.textContent = "Save";
  btn.disabled = false;
  closeEditModal();
  render();
});

document.getElementById("edit-modal").addEventListener("click", e => {
  if (e.target === document.getElementById("edit-modal")) closeEditModal();
});

/* ══════════════════════════════
   Comments
══════════════════════════════ */
window.submitComment = async (postId) => {
  const nameEl = document.getElementById("cmt-name-" + postId);
  const textEl = document.getElementById("cmt-text-" + postId);
  const name   = nameEl.value.trim();
  const text   = textEl.value.trim();
  if (!name || !text) { alert("Please enter both name and comment."); return; }
  const btn = document.getElementById("cmt-btn-" + postId);
  btn.textContent = "Saving..."; btn.disabled = true;
  await addComment(postId, name, text);
  nameEl.value = ""; textEl.value = "";
  btn.textContent = "Post"; btn.disabled = false;
  render();
};

window.handleDeleteComment = async (postId, cid) => {
  if (!confirm("Delete this comment?")) return;
  await deleteComment(postId, cid);
  render();
};

window.handleHeart = async (postId, cid) => {
  await heartComment(postId, cid);
  render();
};

window.toggleReplyForm = (cid) => {
  const form = document.getElementById("reply-form-" + cid);
  if (!form) return;
  form.style.display = form.style.display === "none" ? "flex" : "none";
};

window.submitReply = async (postId, cid) => {
  const nameEl = document.getElementById("rpl-name-" + cid);
  const textEl = document.getElementById("rpl-text-" + cid);
  const name   = nameEl.value.trim();
  const text   = textEl.value.trim();
  if (!name || !text) { alert("Please enter both name and reply."); return; }
  await addReply(postId, cid, name, text);
  render();
};

window.handleDeleteReply = async (postId, cid, rid) => {
  if (!confirm("Delete this reply?")) return;
  await deleteReply(postId, cid, rid);
  render();
};

window.toggleEditComment = (postId, cid, currentText) => {
  const form    = document.getElementById("edit-comment-form-" + cid);
  const input   = document.getElementById("edit-comment-input-" + cid);
  const textDiv = document.getElementById("comment-text-" + cid);
  if (!form) return;
  const isOpen = form.style.display !== "none";
  form.style.display    = isOpen ? "none"  : "flex";
  textDiv.style.display = isOpen ? "block" : "none";
  if (!isOpen) { input.value = currentText; input.focus(); }
};

window.cancelEditComment = (cid) => {
  document.getElementById("edit-comment-form-" + cid).style.display = "none";
  document.getElementById("comment-text-" + cid).style.display = "block";
};

window.submitEditComment = async (postId, cid) => {
  const input = document.getElementById("edit-comment-input-" + cid);
  const text  = input.value.trim();
  if (!text) { alert("Please enter some content."); return; }
  await editComment(postId, cid, text);
  render();
};

window.toggleEditReply = (postId, cid, rid, currentText) => {
  const form    = document.getElementById("edit-reply-form-" + rid);
  const input   = document.getElementById("edit-reply-input-" + rid);
  const textDiv = document.getElementById("reply-text-" + rid);
  if (!form) return;
  const isOpen = form.style.display !== "none";
  form.style.display    = isOpen ? "none"  : "flex";
  textDiv.style.display = isOpen ? "block" : "none";
  if (!isOpen) { input.value = currentText; input.focus(); }
};

window.cancelEditReply = (rid) => {
  document.getElementById("edit-reply-form-" + rid).style.display = "none";
  document.getElementById("reply-text-" + rid).style.display = "block";
};

window.submitEditReply = async (postId, cid, rid) => {
  const input = document.getElementById("edit-reply-input-" + rid);
  const text  = input.value.trim();
  if (!text) { alert("Please enter some content."); return; }
  await editReply(postId, cid, rid, text);
  render();
};

/* ══════════════════════════════
   Render helpers
══════════════════════════════ */
function renderReplies(p, c) {
  const replies = c.replies || [];
  const items = replies.map(r => `
    <div class="reply-item">
      <div class="comment-header">
        <span class="comment-name">${esc(r.name)}</span>
        <span class="comment-time">${fmtTs(r.ts)}${r.edited ? ' <span class="edited-badge">edited</span>' : ""}</span>
        <button class="comment-edit-btn" onclick="toggleEditReply(${p.id},${c.cid},${r.rid},\`${esc(r.text)}\`)">✎</button>
        <button class="comment-del" onclick="handleDeleteReply(${p.id},${c.cid},${r.rid})">✕</button>
      </div>
      <div class="comment-text" id="reply-text-${r.rid}">${esc(r.text)}</div>
      <div class="inline-edit-form" id="edit-reply-form-${r.rid}" style="display:none">
        <textarea class="cmt-text-input" id="edit-reply-input-${r.rid}"></textarea>
        <div class="inline-edit-actions">
          <button class="btn-cancel-sm" onclick="cancelEditReply(${r.rid})">취소</button>
          <button class="cmt-submit-btn" onclick="submitEditReply(${p.id},${c.cid},${r.rid})">저장</button>
        </div>
      </div>
    </div>`).join("");

  return `
    <div class="replies-wrap">
      ${items}
      <div class="reply-form" id="reply-form-${c.cid}" style="display:none">
        <input type="text" id="rpl-name-${c.cid}" placeholder="Name" class="cmt-name-input" />
        <textarea id="rpl-text-${c.cid}" placeholder="Write a reply…" class="cmt-text-input"></textarea>
        <button class="cmt-submit-btn" onclick="submitReply(${p.id},${c.cid})">Post</button>
      </div>
    </div>`;
}

function renderComments(p) {
  const comments = p.comments || [];
  const items = comments.map(c => `
    <div class="comment-item" id="comment-${c.cid}">
      <div class="comment-header">
        <span class="comment-name">${esc(c.name)}</span>
        <span class="comment-time">${fmtTs(c.ts)}${c.edited ? ' <span class="edited-badge">edited</span>' : ""}</span>
        <button class="comment-edit-btn" onclick="toggleEditComment(${p.id},${c.cid},\`${esc(c.text)}\`)">✎</button>
        <button class="comment-del" onclick="handleDeleteComment(${p.id},${c.cid})">✕</button>
      </div>
      <div class="comment-text" id="comment-text-${c.cid}">${esc(c.text)}</div>
      <div class="inline-edit-form" id="edit-comment-form-${c.cid}" style="display:none">
        <textarea class="cmt-text-input" id="edit-comment-input-${c.cid}"></textarea>
        <div class="inline-edit-actions">
          <button class="btn-cancel-sm" onclick="cancelEditComment(${c.cid})">취소</button>
          <button class="cmt-submit-btn" onclick="submitEditComment(${p.id},${c.cid})">저장</button>
        </div>
      </div>
      <div class="comment-actions">
        <button class="reply-toggle-btn" onclick="toggleReplyForm(${c.cid})">↩ Reply</button>
        <button class="heart-btn" onclick="handleHeart(${p.id},${c.cid})">
          ❤️ <span class="heart-count">${c.hearts || 0}</span>
        </button>
      </div>
      ${renderReplies(p, c)}
    </div>`).join("");

  return `
    <div class="comments-section">
      ${items}
      <div class="comment-form">
        <input type="text" id="cmt-name-${p.id}" placeholder="Name" class="cmt-name-input" />
        <textarea id="cmt-text-${p.id}" placeholder="Write a comment…" class="cmt-text-input"></textarea>
        <button id="cmt-btn-${p.id}" class="cmt-submit-btn" onclick="submitComment(${p.id})">Post</button>
      </div>
    </div>`;
}

/* ══════════════════════════════
   Search (based on unknownWords)
══════════════════════════════ */
function applySearch(posts) {
  if (!searchQuery) return posts;
  const q = searchQuery.toLowerCase();
  return posts.filter(p =>
    (p.unknownWords || []).some(w => w.toLowerCase().includes(q))
  );
}

window.clearSearch = () => {
  searchQuery = "";
  const input = document.getElementById("nav-search-input");
  const clear = document.getElementById("nav-search-clear");
  if (input) input.value = "";
  if (clear) clear.style.display = "none";
  render();
};

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("nav-search-input");
  const clear = document.getElementById("nav-search-clear");
  if (!input) return;
  input.addEventListener("input", () => {
    searchQuery = input.value.trim();
    if (clear) clear.style.display = searchQuery ? "flex" : "none";
    render();
  });
});

/* ══════════════════════════════
   Nav date filter
══════════════════════════════ */
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

/* ══════════════════════════════
   Timeline render
══════════════════════════════ */
function renderTimeline(filteredPosts) {
  const timeline = document.getElementById("timeline");
  const posts    = applyNavFilter(filteredPosts);
  const sorted   = [...posts].sort((a, b) => new Date(b.ts) - new Date(a.ts));

  const groups = {};
  sorted.forEach(p => {
    const { y, m, day } = getDateKey(p.ts);
    const key = y + "-" + String(m).padStart(2,"0") + "-" + String(day).padStart(2,"0");
    if (!groups[key]) groups[key] = { y, m, day, items: [] };
    groups[key].items.push(p);
  });

  const numberMap = {};
  Object.values(groups).forEach(g => {
    const dayTotal = g.items.length;
    g.items.forEach((p, i) => { numberMap[p.id] = dayTotal - i; });
  });

  if (!Object.keys(groups).length) {
    timeline.innerHTML = '<div class="empty">No posts yet.</div>';
    return;
  }

  let html = "";
  Object.keys(groups).sort((a, b) => b > a ? 1 : -1).forEach(key => {
    const g     = groups[key];
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const label = months[g.m - 1] + " " + String(g.day).padStart(2,"0") + ", " + g.y;
    html += `<div class="date-anchor" id="anchor-${key}">${label}</div>`;

    g.items.forEach(p => {
      const knownCls   = p.status === "known"   ? "known-active"   : "";
      const unknownCls = p.status === "unknown" ? "unknown-active" : "";
      const cardCls    = p.status === "known"   ? "known"
                       : p.status === "unknown" ? "unknown" : "";

      html += `
        <div class="card ${cardCls}" id="card-${p.id}">
          <div class="card-footer">
            <div class="card-actions-left">
              <button class="toggle-btn ${knownCls}"   onclick="handleToggle(${p.id},'known')">✓ <span class="btn-text">Got it</span></button>
              <button class="toggle-btn ${unknownCls}" onclick="handleToggle(${p.id},'unknown')">? <span class="btn-text">Not sure</span></button>
            </div>
            <span class="card-time">${fmtTs(p.ts)}</span>
            <div class="card-actions-right">
              <button class="edit-btn" onclick="openEditModal(${p.id})">✎ <span class="btn-text">Edit</span></button>
              <button class="del-btn"  onclick="handleDelete(${p.id})">✕ <span class="btn-text">Delete</span></button>
            </div>
          </div>
          <div class="card-media-wrap">
            <div class="card-number-row">
              <span class="card-number">${numberMap[p.id]}</span>
            </div>
            ${p.img ? `<div class="card-img-wrap"><img class="card-img" src="${p.img}" alt="첨부 이미지" /></div>` : ""}
          </div>
          <div class="card-body">
            <div class="card-en">${highlightWords(p.en, p.unknownWords)}</div>
            <div class="card-ko">${esc(p.ko)}</div>
            ${p.src ? `<div class="card-source">📌 ${esc(p.src)}</div>` : ""}
          </div>
          ${renderUnknownWords(p)}
          ${renderComments(p)}
        </div>`;
    });
  });

  timeline.innerHTML = html;
}

/* ══════════════════════════════
   Global handlers
══════════════════════════════ */
window.handleDelete = async (id) => {
  if (!confirm("Delete this post?")) return;
  await deletePost(id);
  render();
};

window.handleToggle = async (id, status) => {
  await toggleStatus(id, status);
  render();
};

/* ══════════════════════════════
   Full render
══════════════════════════════ */
function render() {
  const allFiltered    = getFilteredPosts(filter);
  const searchFiltered = applySearch(allFiltered);
  renderNav(allFiltered);
  renderTimeline(searchFiltered);
}

window.__renderApp = render;

/* ── Scroll to top ── */
function scrollToTop() {
  const tl = document.getElementById("timeline");
  if (tl) tl.scrollTo({ top: 0, behavior: "smooth" });
}
window.scrollToTop = scrollToTop;

/* ── Source autocomplete ── */
function setupSrcAutocomplete(inputId, dropdownId) {
  const input    = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  let activeIdx = -1;

  function positionDropdown() {
    const r = input.getBoundingClientRect();
    dropdown.style.position = "fixed";
    dropdown.style.top      = r.bottom + 2 + "px";
    dropdown.style.left     = r.left + "px";
    dropdown.style.width    = r.width + "px";
  }

  function setActive(idx) {
    const items = dropdown.querySelectorAll(".src-dropdown-item");
    items.forEach((el, i) => el.classList.toggle("src-dropdown-active", i === idx));
    activeIdx = idx;
  }

  input.addEventListener("input", () => {
    activeIdx = -1;
    const q = input.value.trim().toLowerCase();
    if (!q) { dropdown.style.display = "none"; return; }
    const { posts: all } = window.__state || {};
    if (!all) return;
    const sources = [...new Set(all.map(p => p.src).filter(Boolean))];
    const matches = sources.filter(s => s.toLowerCase().includes(q));
    if (!matches.length) { dropdown.style.display = "none"; return; }
    dropdown.innerHTML = matches.map(s =>
      `<div class="src-dropdown-item" onmousedown="selectSrc('${inputId}','${dropdownId}','${s.replace(/'/g,"\\'")}')">
        ${s.replace(new RegExp(q, "gi"), m => "<strong>" + m + "</strong>")}
      </div>`
    ).join("");
    positionDropdown();
    dropdown.style.display = "block";
  });

  input.addEventListener("keydown", (e) => {
    if (dropdown.style.display === "none") return;
    const items = dropdown.querySelectorAll(".src-dropdown-item");
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      items[activeIdx].dispatchEvent(new MouseEvent("mousedown"));
    } else if (e.key === "Escape") {
      dropdown.style.display = "none";
      activeIdx = -1;
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => { dropdown.style.display = "none"; activeIdx = -1; }, 150);
  });
}

window.selectSrc = (inputId, dropdownId, value) => {
  document.getElementById(inputId).value = value;
  document.getElementById(dropdownId).style.display = "none";
};

/* ══════════════════════════════
   App initialization
══════════════════════════════ */
import("./posts.js").then(m => {
  window.__state = { get posts() { return m.posts; } };
});

(async () => {
  document.getElementById("timeline").innerHTML =
    '<div class="empty">Loading...</div>';
  await loadPosts();
  render();
  setupSrcAutocomplete("inp-src", "src-dropdown-main");
  setupSrcAutocomplete("mob-src", "src-dropdown-mob");
})();

/* ══════════════════════════════
   Mobile sidebar
══════════════════════════════ */
window.openSidebar = () => {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("open");
};

window.closeSidebar = () => {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
};
/* ══════════════════════════════
   Quiz Modal
══════════════════════════════ */
(function injectQuizModal() {
  const modal = document.createElement("div");
  modal.id = "quiz-modal";
  modal.innerHTML = `
    <div class="quiz-modal-box">
      <div class="quiz-modal-header">
        <span class="quiz-modal-title">🎯 Word Quiz</span>
        <button class="quiz-modal-close" onclick="closeQuizModal()">✕</button>
      </div>
      <div class="quiz-modal-body" id="quiz-body">
        <div class="quiz-start-screen" id="quiz-start">
          <div class="quiz-start-info" id="quiz-start-info"></div>
          <button class="quiz-start-btn" onclick="startQuiz()">Start Quiz</button>
        </div>
        <div id="quiz-game" style="display:none">
          <div class="quiz-prog-row">
            <div class="quiz-prog-wrap"><div class="quiz-prog-fill" id="q-prog-fill"></div></div>
            <span class="quiz-prog-text" id="q-prog-text"></span>
          </div>
          <div class="quiz-card" id="q-card" onclick="flipQuizCard()">
            <span class="quiz-card-hint" id="q-hint">tap to reveal</span>
            <div class="quiz-card-word" id="q-word"></div>
            <div class="quiz-card-src"  id="q-src"></div>
            <div class="quiz-card-def"  id="q-def"  style="display:none"></div>
            <div class="quiz-card-ex"   id="q-ex"   style="display:none"></div>
          </div>
          <div class="quiz-actions" id="q-actions">
            <button class="quiz-btn-reveal" onclick="flipQuizCard()">Reveal</button>
          </div>
        </div>
        <div id="quiz-result" style="display:none">
          <div class="quiz-result-score" id="q-score"></div>
          <div class="quiz-result-label" id="q-label"></div>
          <div class="quiz-result-stats" id="q-stats"></div>
          <button class="quiz-start-btn" onclick="startQuiz()">Shuffle &amp; Try Again</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) closeQuizModal(); });
})();

window.openQuizModal = () => {
  const { posts: all } = window.__state || {};
  const wordEntries = [];
  (all || []).forEach(p => {
    if (p.status === "known") return;
    (p.unknownWords || []).forEach(w => {
      if (w) wordEntries.push({ word: w, src: p.src || "" });
    });
  });
  const unique = [];
  const seen   = new Set();
  wordEntries.forEach(e => {
    const key = e.word.toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(e); }
  });
  window.__quizWords = unique;

  const info  = document.getElementById("quiz-start-info");
  const total = unique.length;
  info.textContent = total
    ? `${total} word${total > 1 ? "s" : ""} from unknown posts · ${Math.min(total, 10)} per round`
    : "No unknown words yet. Add words to your posts first!";

  document.getElementById("quiz-start").style.display  = "block";
  document.getElementById("quiz-game").style.display   = "none";
  document.getElementById("quiz-result").style.display = "none";
  document.getElementById("quiz-modal").classList.add("open");
};

window.closeQuizModal = () => {
  document.getElementById("quiz-modal").classList.remove("open");
};

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

window.startQuiz = () => {
  const words = window.__quizWords || [];
  if (!words.length) return;
  window.__quizDeck    = shuffleArr(words).slice(0, 10);
  window.__quizIdx     = 0;
  window.__quizKnew    = 0;
  window.__quizNope    = 0;
  window.__quizFlipped = false;

  document.getElementById("quiz-start").style.display  = "none";
  document.getElementById("quiz-result").style.display = "none";
  document.getElementById("quiz-game").style.display   = "block";
  showQuizCard();
};

function showQuizCard() {
  const deck = window.__quizDeck;
  const idx  = window.__quizIdx;
  const item = deck[idx];
  window.__quizFlipped = false;

  document.getElementById("q-word").textContent = item.word;
  document.getElementById("q-src").textContent  = item.src ? "from: " + item.src : "";
  document.getElementById("q-hint").style.display = "block";
  document.getElementById("q-def").style.display  = "none";
  document.getElementById("q-ex").style.display   = "none";
  document.getElementById("q-def").textContent    = "";
  document.getElementById("q-ex").textContent     = "";

  const pct = Math.round((idx + 1) / deck.length * 100);
  document.getElementById("q-prog-fill").style.width = pct + "%";
  document.getElementById("q-prog-text").textContent = (idx + 1) + " / " + deck.length;
  document.getElementById("q-actions").innerHTML =
    `<button class="quiz-btn-reveal" onclick="flipQuizCard()">Reveal</button>`;

  fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(item.word)}`)
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      const m = data[0]?.meanings?.[0];
      if (!m) return;
      const d = m.definitions?.[0];
      window.__quizDeck[idx]._def = (m.partOfSpeech ? "(" + m.partOfSpeech + ") " : "") + (d?.definition || "");
      window.__quizDeck[idx]._ex  = d?.example || "";
    })
    .catch(() => {});
}

window.flipQuizCard = () => {
  if (window.__quizFlipped) return;
  window.__quizFlipped = true;
  const idx  = window.__quizIdx;
  const item = window.__quizDeck[idx];
  document.getElementById("q-hint").style.display = "none";
  document.getElementById("q-def").style.display  = "block";
  document.getElementById("q-def").textContent    = item._def || "(definition loading…)";
  if (item._ex) {
    document.getElementById("q-ex").style.display = "block";
    document.getElementById("q-ex").textContent   = '"' + item._ex + '"';
  }
  document.getElementById("q-actions").innerHTML = `
    <button class="quiz-btn-nope" onclick="quizAnswer(false)">Still learning</button>
    <button class="quiz-btn-knew" onclick="quizAnswer(true)">Got it!</button>`;
};

window.quizAnswer = (gotIt) => {
  if (gotIt) window.__quizKnew++; else window.__quizNope++;
  window.__quizIdx++;
  if (window.__quizIdx >= window.__quizDeck.length) {
    showQuizResult();
  } else {
    showQuizCard();
  }
};

function showQuizResult() {
  const knew  = window.__quizKnew;
  const total = window.__quizDeck.length;
  const pct   = Math.round(knew / total * 100);
  document.getElementById("quiz-game").style.display   = "none";
  document.getElementById("quiz-result").style.display = "block";
  document.getElementById("q-score").textContent       = pct + "%";
  document.getElementById("q-label").textContent       = `${knew} / ${total} words correct`;
  document.getElementById("q-stats").innerHTML =
    `<span class="quiz-stat-knew">Got it: ${knew}</span>
     <span class="quiz-stat-nope">Still learning: ${window.__quizNope}</span>`;
  document.getElementById("q-prog-fill").style.width  = "100%";
  document.getElementById("q-prog-text").textContent  = total + " / " + total;
}