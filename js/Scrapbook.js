import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc,
  setDoc, deleteDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { renderNav } from "./nav.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBDO_oFxGkj4rSr8l_DxKwB5IUpqe8FWhw",
  authDomain:        "momonote-b26be.firebaseapp.com",
  projectId:         "momonote-b26be",
  storageBucket:     "momonote-b26be.firebasestorage.app",
  messagingSenderId: "220086826188",
  appId:             "1:220086826188:web:e4e624488c63b61d76be69"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const COL = "scrapbook_posts";

let posts       = [];
let tmplFilter  = "all";
let navFilter   = null;
let currentTmpl = null;
let currentEditId = null;  // 9. fix: track which post is being edited

/* ══ PIN session ══ */
const PIN_KEY = "scrp_pin";
let _pinUnlocked = false;
function getPin()    { return localStorage.getItem(PIN_KEY) || ""; }
function setPin(p)   { localStorage.setItem(PIN_KEY, p); }
function isPinSet()  { return !!getPin(); }

/* ══ Firestore ══ */
async function loadPosts() {
  const q    = query(collection(db, COL), orderBy("ts", "desc"));
  const snap = await getDocs(q);
  posts = snap.docs.map(d => d.data());
}
async function savePost(post)   { await setDoc(doc(db, COL, String(post.id)), post); }
async function deletePostDB(id) { await deleteDoc(doc(db, COL, String(id))); }

/* ══ Helpers ══ */
function esc(str) {
  return String(str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
// 4. newlines → <br>
function escNl(str) {
  return esc(str).replace(/\n/g,"<br>");
}
function val(id) { return document.getElementById(id)?.value || ""; }
function today() { return new Date().toISOString().slice(0,10); }
function fmtTs(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}
function getDateKey(iso) {
  const d = new Date(iso);
  return { y: d.getFullYear(), m: d.getMonth()+1, day: d.getDate() };
}
function daySuffix(d) {
  if ([11,12,13].includes(d%100)) return "th";
  return d%10===1?"st":d%10===2?"nd":d%10===3?"rd":"th";
}

const TMPL_LABELS = { diary:"📔 Diary", review:"🎬 Review", travel:"✈️ Travel", music:"🎵 Music", workout:"💪 Workout", idea:"💡 Idea" };
const TMPL_COLORS = { diary:"scrp-badge-diary", review:"scrp-badge-review", travel:"scrp-badge-travel", music:"scrp-badge-music", workout:"scrp-badge-workout", idea:"scrp-badge-idea" };
const TMPL_NAMES  = { diary:"New Diary", review:"New Review", travel:"New Travel", music:"New Music", workout:"New Workout", idea:"New Idea" };

const MOODS   = ["😊","😢","😡","😴","😰","🥳","😌","🤔","😑","🥹"];
const CONDS   = ["💪","😤","😅","😓","🥵","🙂","😐","😩"];
// 1. Weather icons
const WEATHERS = [
  { icon:"☀️", label:"Clear" },
  { icon:"⛅", label:"Partly cloudy" },
  { icon:"☁️", label:"Cloudy" },
  { icon:"🌧️", label:"Rain" },
  { icon:"❄️", label:"Snow" },
  { icon:"⛈️", label:"Storm" },
  { icon:"🌫️", label:"Foggy" },
  { icon:"🌬️", label:"Windy" }
];
// 7. Review tags
const REVIEW_TAGS = ["📚 Book","🎬 Movie","📺 TV Show","🎮 Game","🎵 Album","🎙️ Podcast","▶️ YouTube","🎨 Art"];
// 8. Idea priorities
const IDEA_PRIORITIES = ["🔴 High","🟡 Mid","🟢 Low","💭 Just an idea"];

/* ══ Filter ══ */
function getNavPosts() {
  return tmplFilter === "all" ? posts : posts.filter(p => p.tmpl === tmplFilter);
}
function getFilteredPosts() {
  let list = tmplFilter === "all" ? [...posts] : posts.filter(p => p.tmpl === tmplFilter);
  if (navFilter) {
    list = list.filter(p => {
      const k = getDateKey(p.ts);
      if (navFilter.y   && k.y   != navFilter.y)   return false;
      if (navFilter.m   && k.m   != navFilter.m)   return false;
      if (navFilter.day && k.day != navFilter.day) return false;
      return true;
    });
  }
  return list;
}

/* ══ Timeline ══ */
function renderTimeline() {
  const filtered = getFilteredPosts();
  const tl = document.getElementById("timeline");
  if (!filtered.length) {
    tl.innerHTML = `<div class="scrp-empty">No entries yet. Click <strong>+ New</strong> to add one!</div>`;
    return;
  }
  const groups = {};
  filtered.forEach(p => {
    const { y, m, day } = getDateKey(p.ts);
    const key = `${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    if (!groups[key]) groups[key] = { y, m, day, posts: [] };
    groups[key].posts.push(p);
  });
  let html = "";
  Object.keys(groups).sort((a,b) => b.localeCompare(a)).forEach(key => {
    const { y, m, day, posts: gp } = groups[key];
    const mName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1];
    html += `<div class="scrp-date-anchor" id="anchor-${key}">
      <div class="scrp-date-label">${mName} ${day}${daySuffix(day)}, ${y}</div>`;
    gp.forEach(p => { html += renderCard(p); });
    html += `</div>`;
  });
  tl.innerHTML = html;
}

/* ══ Stars display ══ */
function renderStarsDisplay(n) {
  return [1,2,3,4,5].map(i => `<span style="color:${i<=n?"#D4621A":"#ddd"}">★</span>`).join("");
}

/* ══ YouTube embed ══ */
function ytEmbedUrl(url) {
  if (!url) return "";
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : "";
}

/* ══ Card render ══ */
function renderCard(p) {
  const badge = TMPL_LABELS[p.tmpl] || p.tmpl;
  const cls   = TMPL_COLORS[p.tmpl] || "";

  // 2. Private diary lock
  if (p.tmpl === "diary" && p.isPrivate) {
    if (!_pinUnlocked) {
      return `<div class="scrp-card" id="post-${p.id}">
        <div class="scrp-card-header">
          <span class="scrp-tmpl-badge ${cls}">${badge}</span>
          <span class="scrp-card-ts">${fmtTs(p.ts)}</span>
          <span class="scrp-private-badge">🔒 Private</span>
          <div class="scrp-card-actions">
            <button class="scrp-action-btn" onclick="unlockAndEdit(${p.id})">✎ Edit</button>
            <button class="scrp-action-btn scrp-action-del" onclick="confirmDelete(${p.id})">✕ Delete</button>
          </div>
        </div>
        <div class="scrp-locked-msg" onclick="promptUnlock()">
          <span>🔒</span><span>Private entry — click to unlock</span>
        </div>
        ${renderComments(p)}
      </div>`;
    }
  }

  let content = "";
  if (p.tmpl === "diary") {
    const weatherObj = WEATHERS.find(w => w.icon === p.weather);
    const weatherChip = p.weather ? `<span class="scrp-meta-chip">${p.weather}${weatherObj?" "+weatherObj.label:""}</span>` : "";
    const moodChip    = p.mood    ? `<span class="scrp-meta-chip scrp-mood-chip">${p.mood}</span>` : "";
    const meta = [weatherChip, moodChip].filter(Boolean).join("");
    content = `
      ${p.isPrivate ? `<span class="scrp-private-badge">🔒 Private</span>` : ""}
      ${p.title ? `<div class="scrp-card-title">${esc(p.title)}</div>` : ""}
      ${meta    ? `<div class="scrp-meta-row">${meta}</div>` : ""}
      ${p.body  ? `<div class="scrp-card-body">${escNl(p.body)}</div>` : ""}`;

  } else if (p.tmpl === "review") {
    const dateRange = p.startDate && p.endDate ? `${esc(p.startDate)} → ${esc(p.endDate)}`
                    : p.startDate ? `Started ${esc(p.startDate)}` : "";
    // 7. tag badge
    const tagBadge = p.tag ? `<span class="scrp-review-tag">${p.tag}</span>` : "";
    content = `
      <div class="scrp-card-title">${esc(p.title||"")}</div>
      ${tagBadge}
      ${p.source ? `<div class="scrp-meta-row"><span class="scrp-meta-chip">✍️ ${esc(p.source)}</span></div>` : ""}
      <div class="scrp-review-meta">
        <span class="scrp-stars">${renderStarsDisplay(p.rating||0)}</span>
        ${dateRange ? `<span class="scrp-meta-chip">${dateRange}</span>` : ""}
      </div>
      ${p.quote ? `<div class="scrp-quote">"${escNl(p.quote)}"</div>` : ""}
      ${p.body  ? `<div class="scrp-card-body">${escNl(p.body)}</div>` : ""}`;

  } else if (p.tmpl === "travel") {
    const imgs = p.images || [];
    const dateStr = p.startDate && p.endDate && p.startDate !== p.endDate
      ? `${esc(p.startDate)} → ${esc(p.endDate)}`
      : p.startDate ? esc(p.startDate) : "";
    const mapLink = p.location
      ? `<a class="scrp-map-link" href="https://www.google.com/maps/search/${encodeURIComponent(p.location)}" target="_blank" rel="noopener">📍 ${esc(p.location)}</a>`
      : "";
    const meta = [
      dateStr ? `<span class="scrp-meta-chip">📅 ${dateStr}</span>` : "",
      p.cost  ? `<span class="scrp-meta-chip">💰 ${esc(p.cost)}</span>` : ""
    ].filter(Boolean).join("");
    content = `
      <div class="scrp-card-title">${esc(p.place||"")}</div>
      ${mapLink}
      ${meta ? `<div class="scrp-meta-row">${meta}</div>` : ""}
      ${imgs.length ? renderSlider(p.id, imgs) : ""}
      ${p.body ? `<div class="scrp-card-body">${escNl(p.body)}</div>` : ""}`;

  } else if (p.tmpl === "music") {
    const embedUrl = ytEmbedUrl(p.ytLink||"");
    content = `
      <div class="scrp-card-title">${esc(p.title||"")}</div>
      <div class="scrp-review-meta">
        ${p.artist ? `<span class="scrp-meta-chip">🎤 ${esc(p.artist)}</span>` : ""}
        <span class="scrp-stars">${renderStarsDisplay(p.rating||0)}</span>
      </div>
      ${embedUrl ? `<div class="scrp-yt-wrap"><iframe src="${embedUrl}" frameborder="0" allowfullscreen class="scrp-yt-frame"></iframe></div>` : ""}
      ${p.body ? `<div class="scrp-card-body">${escNl(p.body)}</div>` : ""}`;

  } else if (p.tmpl === "workout") {
    // 6. Exercise list
    const exList = (p.exercises||[]).map(ex => `
      <div class="scrp-ex-row">
        <span class="scrp-ex-name">${esc(ex.name)}</span>
        ${ex.sets  ? `<span class="scrp-ex-chip">${esc(ex.sets)} sets</span>` : ""}
        ${ex.reps  ? `<span class="scrp-ex-chip">${esc(ex.reps)} reps</span>` : ""}
        ${ex.weight? `<span class="scrp-ex-chip">${esc(ex.weight)}</span>` : ""}
      </div>`).join("");
    const meta = [
      p.workoutType ? `<span class="scrp-meta-chip">🏃 ${esc(p.workoutType)}</span>` : "",
      p.duration    ? `<span class="scrp-meta-chip">⏱ ${esc(p.duration)}</span>`    : "",
      p.condition   ? `<span class="scrp-meta-chip scrp-mood-chip">${p.condition}</span>` : ""
    ].filter(Boolean).join("");
    content = `
      ${meta ? `<div class="scrp-meta-row">${meta}</div>` : ""}
      ${exList ? `<div class="scrp-ex-list">${exList}</div>` : ""}
      ${p.body ? `<div class="scrp-card-body">${escNl(p.body)}</div>` : ""}`;

  } else if (p.tmpl === "idea") {
    const priColor = { "🔴 High":"#FAECE7","🟡 Mid":"#FEF9C3","🟢 Low":"#DCFCE7","💭 Just an idea":"#f5f2ed" };
    const priBg = priColor[p.priority] || "#f5f2ed";
    content = `
      <div class="scrp-card-title">${esc(p.title||"")}</div>
      <div class="scrp-meta-row">
        ${p.category ? `<span class="scrp-meta-chip">🏷 ${esc(p.category)}</span>` : ""}
        ${p.priority ? `<span class="scrp-meta-chip" style="background:${priBg}">${p.priority}</span>` : ""}
      </div>
      ${p.body       ? `<div class="scrp-card-body">${escNl(p.body)}</div>` : ""}
      ${p.nextAction ? `<div class="scrp-next-action">→ ${esc(p.nextAction)}</div>` : ""}`;
  }

  return `<div class="scrp-card" id="post-${p.id}">
    <div class="scrp-card-header">
      <span class="scrp-tmpl-badge ${cls}">${badge}</span>
      <span class="scrp-card-ts">${fmtTs(p.ts)}</span>
      <div class="scrp-card-actions">
        <button class="scrp-action-btn" onclick="openScrpEdit(${p.id})">✎ Edit</button>
        <button class="scrp-action-btn scrp-action-del" onclick="confirmDelete(${p.id})">✕ Delete</button>
      </div>
    </div>
    ${content}
    ${renderComments(p)}
  </div>`;
}

/* ══ Slider ══ */
function renderSlider(postId, images) {
  if (!images.length) return "";
  const slides = images.map((img,i) => `
    <div class="scrp-slide ${i===0?"active":""}" data-idx="${i}">
      <img src="${img.data}" alt="${esc(img.caption||"")}" class="scrp-slide-img" />
      ${img.caption?`<div class="scrp-slide-caption">${esc(img.caption)}</div>`:""}
    </div>`).join("");
  const dots = images.length>1
    ?`<div class="scrp-slider-dots">${images.map((_,i)=>`<span class="scrp-dot ${i===0?"active":""}" onclick="goSlide('${postId}',${i})"></span>`).join("")}</div>`:"";
  const arrows = images.length>1?`
    <button class="scrp-arrow scrp-arrow-l" onclick="moveSlide('${postId}',-1)">‹</button>
    <button class="scrp-arrow scrp-arrow-r" onclick="moveSlide('${postId}',1)">›</button>`:"";
  return `<div class="scrp-slider" id="slider-${postId}" data-cur="0" data-total="${images.length}"
    ontouchstart="scrpTouchStart(event,'${postId}')" ontouchend="scrpTouchEnd(event,'${postId}')">
    <div class="scrp-slides">${slides}</div>${arrows}${dots}</div>`;
}
window.moveSlide=(postId,dir)=>{const s=document.getElementById("slider-"+postId);if(!s)return;goSlide(postId,(+s.dataset.cur+dir+ +s.dataset.total)% +s.dataset.total);};
window.goSlide=(postId,idx)=>{const s=document.getElementById("slider-"+postId);if(!s)return;s.dataset.cur=idx;s.querySelectorAll(".scrp-slide").forEach((el,i)=>el.classList.toggle("active",i===idx));s.querySelectorAll(".scrp-dot").forEach((el,i)=>el.classList.toggle("active",i===idx));};
let _touchX=0;
window.scrpTouchStart=(e)=>{_touchX=e.touches[0].clientX;};
window.scrpTouchEnd=(e,id)=>{const dx=e.changedTouches[0].clientX-_touchX;if(Math.abs(dx)>40)moveSlide(id,dx<0?1:-1);};

/* ══ Comments ══ */
function renderComments(p) {
  const cmts=(p.comments||[]).map(c=>`
    <div class="scrp-comment">
      <span class="scrp-comment-name">${esc(c.name)}</span>
      <span class="scrp-comment-text">${esc(c.text)}</span>
      <button class="scrp-comment-del" onclick="deleteComment(${p.id},${c.cid})">✕</button>
    </div>`).join("");
  return `<div class="scrp-comments">${cmts}
    <div class="scrp-comment-form">
      <input class="scrp-comment-name-inp" id="cname-${p.id}" placeholder="Name"/>
      <input class="scrp-comment-text-inp" id="ctext-${p.id}" placeholder="Write a comment…"
        onkeydown="if(event.key==='Enter')postComment(${p.id})"/>
      <button class="scrp-comment-post-btn" onclick="postComment(${p.id})">Post</button>
    </div></div>`;
}
window.postComment=async(postId)=>{
  const name=document.getElementById("cname-"+postId)?.value.trim();
  const text=document.getElementById("ctext-"+postId)?.value.trim();
  if(!text)return;
  const post=posts.find(p=>p.id===postId);if(!post)return;
  if(!post.comments)post.comments=[];
  post.comments.push({cid:Date.now(),name:name||"Anonymous",text,ts:new Date().toISOString()});
  await savePost(post);renderTimeline();
};
window.deleteComment=async(postId,cid)=>{
  const post=posts.find(p=>p.id===postId);if(!post)return;
  post.comments=(post.comments||[]).filter(c=>c.cid!==cid);
  await savePost(post);renderTimeline();
};
window.confirmDelete=async(id)=>{
  if(!confirm("Delete this entry?"))return;
  posts=posts.filter(p=>p.id!==id);
  await deletePostDB(id);renderApp();
};

/* ══ 2. PIN / private ══ */
window.promptUnlock = () => {
  const pin = getPin();
  if (!pin) return;
  const input = prompt("Enter PIN to view private entries:");
  if (input === pin) { _pinUnlocked = true; renderTimeline(); }
  else if (input !== null) alert("Wrong PIN.");
};
window.unlockAndEdit = (id) => {
  const pin = getPin();
  if (!pin) { openScrpEdit(id); return; }
  if (_pinUnlocked) { openScrpEdit(id); return; }
  const input = prompt("Enter PIN to edit:");
  if (input === pin) { _pinUnlocked = true; openScrpEdit(id); }
  else if (input !== null) alert("Wrong PIN.");
};

/* ══ Emoji picker ══ */
window.__emojiSets = { MOODS, CONDS };
function emojiPicker(selected, hiddenId, pickerId, items) {
  const btns = items.map((em,idx) =>
    `<button type="button" class="scrp-mood-btn${selected===em?" scrp-mood-selected":""}"
      data-picker="${pickerId}" data-idx="${idx}"
      onclick="pickEmoji('${pickerId}','${hiddenId}',${idx})">${em}</button>`
  ).join("");
  return `<div class="scrp-mood-picker" id="${pickerId}">${btns}</div>
          <input type="hidden" id="${hiddenId}" value="${esc(selected||"")}"/>`;
}
window.pickEmoji=(pickerId,hiddenId,idx)=>{
  const setKey=pickerId==="scrp-mood-picker"?"MOODS":"CONDS";
  const em=window.__emojiSets[setKey][idx];
  document.getElementById(hiddenId).value=em;
  document.querySelectorAll(`#${pickerId} .scrp-mood-btn`).forEach((b,i)=>b.classList.toggle("scrp-mood-selected",i===idx));
};

// 1. Weather picker
window.__weathers = WEATHERS;
function weatherPicker(selected) {
  const btns = WEATHERS.map((w,idx) =>
    `<button type="button" class="scrp-weather-btn${selected===w.icon?" scrp-mood-selected":""}"
      onclick="pickWeather(${idx})" title="${w.label}">${w.icon}</button>`
  ).join("");
  return `<div class="scrp-mood-picker" id="scrp-weather-picker">${btns}</div>
          <input type="hidden" id="f-weather" value="${esc(selected||"")}"/>`;
}
window.pickWeather=(idx)=>{
  const w=window.__weathers[idx];
  document.getElementById("f-weather").value=w.icon;
  document.querySelectorAll("#scrp-weather-picker .scrp-weather-btn").forEach((b,i)=>b.classList.toggle("scrp-mood-selected",i===idx));
};

/* ══ 6. Exercise list ══ */
let _exercises = [];
window.addExercise = () => {
  _exercises.push({ name:"", sets:"", reps:"", weight:"" });
  renderExerciseList();
};
window.removeExercise = (idx) => { _exercises.splice(idx,1); renderExerciseList(); };
window.updateEx = (idx, field, v) => { if(_exercises[idx]) _exercises[idx][field]=v; };
function renderExerciseList() {
  const wrap = document.getElementById("scrp-ex-wrap"); if (!wrap) return;
  wrap.innerHTML = _exercises.map((ex,i) => `
    <div class="scrp-ex-form-row">
      <input class="scrp-form-input scrp-ex-inp" placeholder="Exercise" value="${esc(ex.name)}" oninput="updateEx(${i},'name',this.value)" />
      <input class="scrp-form-input scrp-ex-inp-sm" placeholder="Sets" value="${esc(ex.sets)}" oninput="updateEx(${i},'sets',this.value)" />
      <input class="scrp-form-input scrp-ex-inp-sm" placeholder="Reps" value="${esc(ex.reps)}" oninput="updateEx(${i},'reps',this.value)" />
      <input class="scrp-form-input scrp-ex-inp-sm" placeholder="kg/lb" value="${esc(ex.weight)}" oninput="updateEx(${i},'weight',this.value)" />
      <button type="button" class="scrp-ex-del" onclick="removeExercise(${i})">✕</button>
    </div>`).join("");
}

/* ══ 8. Idea category dropdown ══ */
window.updateIdeaCategory = (v) => {
  const dd = document.getElementById("idea-cat-dropdown");
  if (!dd) return;
  const existing = [...new Set(posts.filter(p=>p.tmpl==="idea"&&p.category).map(p=>p.category))];
  const matches  = existing.filter(c => c.toLowerCase().includes(v.toLowerCase()) && c !== v);
  if (!v || !matches.length) { dd.style.display="none"; return; }
  dd.innerHTML = matches.map(c=>`<div class="src-dropdown-item" onmousedown="selectIdeaCat('${c.replace(/'/g,"\\'")}')"> ${esc(c)}</div>`).join("");
  dd.style.display="block";
};
window.selectIdeaCat=(v)=>{
  const inp=document.getElementById("f-category"); if(inp) inp.value=v;
  const dd=document.getElementById("idea-cat-dropdown"); if(dd) dd.style.display="none";
};

/* ══ Forms ══ */
function diaryForm(data={}) {
  const isPrivate = data.isPrivate||false;
  return `
    <div class="scrp-form-row">
      <label class="scrp-form-label">Date</label>
      <input type="date" id="f-date" class="scrp-form-input" value="${data.date||today()}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Weather</label>
      ${weatherPicker(data.weather||"")}
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Mood</label>
      ${emojiPicker(data.mood||"","f-mood","scrp-mood-picker",MOODS)}
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Title</label>
      <input type="text" id="f-title" class="scrp-form-input" placeholder="Give your entry a title" value="${esc(data.title||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Entry</label>
      <textarea id="f-body" class="scrp-form-textarea"placeholder="Write about your day…">${esc(data.body||"")}</textarea>
    </div>
    <div class="scrp-form-row scrp-private-row">
      <label class="scrp-private-label">
        <input type="checkbox" id="f-private" ${isPrivate?"checked":""}/>
        🔒 Private entry
      </label>
      <div id="scrp-pin-wrap" style="${isPrivate?"":"display:none"}">
        ${isPinSet()
          ? `<span style="font-size:0.75rem;color:#aaa">PIN is set</span>
             <button type="button" class="scrp-pin-change-btn" onclick="changePinPrompt()">Change PIN</button>`
          : `<input type="text" id="f-pin" class="scrp-form-input" placeholder="Set a 4-digit PIN" maxlength="8" style="width:8rem"/>`
        }
      </div>
    </div>`;
}
// Show/hide PIN input when checkbox toggled
document.addEventListener("change", e => {
  if (e.target.id === "f-private") {
    const wrap = document.getElementById("scrp-pin-wrap");
    if (wrap) wrap.style.display = e.target.checked ? "" : "none";
  }
});

window.changePinPrompt = () => {
  const p = prompt("Enter a new PIN:");
  if (p) { setPin(p); alert("PIN updated!"); }
};

function reviewForm(data={}) {
  const stars = [1,2,3,4,5].map(n =>
    `<button type="button" class="scrp-star-btn ${(data.rating||0)>=n?"on":""}" data-n="${n}" onclick="setScrpStar(${n})">★</button>`
  ).join("");
  // 7. tag selector
  const tagBtns = REVIEW_TAGS.map(t =>
    `<button type="button" class="scrp-tag-btn${data.tag===t?" scrp-tag-selected":""}"
      onclick="selectReviewTag(this,'${t.replace(/'/g,"\\'")}','f-tag')">${t}</button>`
  ).join("");
  return `
    <div class="scrp-form-row">
      <label class="scrp-form-label">Type</label>
      <div class="scrp-tag-picker">${tagBtns}</div>
      <input type="hidden" id="f-tag" value="${esc(data.tag||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Title</label>
      <input type="text" id="f-title" class="scrp-form-input" placeholder="Title…" value="${esc(data.title||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Author / Source</label>
      <input type="text" id="f-source" class="scrp-form-input" placeholder="Author, director, studio…" value="${esc(data.source||"")}"/>
    </div>
    <div class="scrp-form-2col">
      <div>
        <label class="scrp-form-label">Start date</label>
        <input type="date" id="f-startDate" class="scrp-form-input" value="${data.startDate||""}"/>
      </div>
      <div>
        <label class="scrp-form-label">End date</label>
        <input type="date" id="f-endDate" class="scrp-form-input" value="${data.endDate||""}"/>
      </div>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Rating</label>
      <div class="scrp-star-row" id="scrp-stars">${stars}</div>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Favourite quote</label>
      <textarea id="f-quote" class="scrp-form-textarea" style="min-height:3.5rem" placeholder='"A quote that stood out…"'>${esc(data.quote||"")}</textarea>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Review</label>
      <textarea id="f-body" class="scrp-form-textarea" placeholder="Your thoughts…">${esc(data.body||"")}</textarea>
    </div>`;
}
window.selectReviewTag=(btn,t,hiddenId)=>{
  document.getElementById(hiddenId).value=t;
  btn.closest(".scrp-tag-picker").querySelectorAll(".scrp-tag-btn").forEach(b=>b.classList.toggle("scrp-tag-selected",b===btn));
};

function travelForm(data={}) {
  const imgs=data.images||[];
  const previews=imgs.map((img,i)=>`
    <div class="scrp-img-preview-item">
      <img src="${img.data}"/>
      <input type="text" class="scrp-img-caption-inp" placeholder="Caption…" value="${esc(img.caption||"")}" oninput="updateCaption(${i},this.value)"/>
      <button type="button" class="scrp-img-remove" onclick="removeImg(${i})">✕</button>
    </div>`).join("");
  return `
    <div class="scrp-form-row">
      <label class="scrp-form-label">Place</label>
      <input type="text" id="f-place" class="scrp-form-input" placeholder="City, landmark…" value="${esc(data.place||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Location <span style="color:#bbb;font-size:0.75rem">(for map link)</span></label>
      <input type="text" id="f-location" class="scrp-form-input" placeholder="e.g. Granville Island, Vancouver" value="${esc(data.location||"")}"/>
    </div>
    <div class="scrp-form-2col">
      <div>
        <label class="scrp-form-label">Start date</label>
        <input type="date" id="f-startDate" class="scrp-form-input" value="${data.startDate||""}"/>
      </div>
      <div>
        <label class="scrp-form-label">End date</label>
        <input type="date" id="f-endDate" class="scrp-form-input" value="${data.endDate||""}"/>
      </div>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Cost</label>
      <input type="text" id="f-cost" class="scrp-form-input" placeholder="e.g. $42" value="${esc(data.cost||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Photos <span style="color:#bbb;font-size:0.75rem">(up to 5)</span></label>
      <div class="scrp-img-previews" id="scrp-img-previews">${previews}</div>
      <input type="file" id="f-imgs" accept="image/*" multiple class="scrp-form-input" onchange="addImgs(this)"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Notes</label>
      <textarea id="f-body" class="scrp-form-textarea" placeholder="How was it?">${esc(data.body||"")}</textarea>
    </div>`;
}

function musicForm(data={}) {
  const stars=[1,2,3,4,5].map(n =>
    `<button type="button" class="scrp-star-btn ${(data.rating||0)>=n?"on":""}" data-n="${n}" onclick="setScrpStar(${n})">★</button>`
  ).join("");
  return `
    <div class="scrp-form-row">
      <label class="scrp-form-label">Album / Song</label>
      <input type="text" id="f-title" class="scrp-form-input" placeholder="Album or song title…" value="${esc(data.title||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Artist</label>
      <input type="text" id="f-artist" class="scrp-form-input" placeholder="Artist name…" value="${esc(data.artist||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Rating</label>
      <div class="scrp-star-row" id="scrp-stars">${stars}</div>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">YouTube link <span style="color:#bbb;font-size:0.75rem">(plays in card)</span></label>
      <input type="text" id="f-ytLink" class="scrp-form-input" placeholder="https://youtube.com/watch?v=…" value="${esc(data.ytLink||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Notes</label>
      <textarea id="f-body" class="scrp-form-textarea" placeholder="Your thoughts…">${esc(data.body||"")}</textarea>
    </div>`;
}

function workoutForm(data={}) {
  _exercises = (data.exercises||[]).map(e=>({...e}));
  const exHtml = _exercises.map((ex,i)=>`
    <div class="scrp-ex-form-row">
      <input class="scrp-form-input scrp-ex-inp" placeholder="Exercise" value="${esc(ex.name)}" oninput="updateEx(${i},'name',this.value)"/>
      <input class="scrp-form-input scrp-ex-inp-sm" placeholder="Sets" value="${esc(ex.sets)}" oninput="updateEx(${i},'sets',this.value)"/>
      <input class="scrp-form-input scrp-ex-inp-sm" placeholder="Reps" value="${esc(ex.reps)}" oninput="updateEx(${i},'reps',this.value)"/>
      <input class="scrp-form-input scrp-ex-inp-sm" placeholder="kg/lb" value="${esc(ex.weight)}" oninput="updateEx(${i},'weight',this.value)"/>
      <button type="button" class="scrp-ex-del" onclick="removeExercise(${i})">✕</button>
    </div>`).join("");
  return `
    <div class="scrp-form-row">
      <label class="scrp-form-label">Date</label>
      <input type="date" id="f-date" class="scrp-form-input" value="${data.date||today()}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Workout type</label>
      <input type="text" id="f-workoutType" class="scrp-form-input" placeholder="e.g. Running, Yoga, Weights…" value="${esc(data.workoutType||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Duration</label>
      <input type="text" id="f-duration" class="scrp-form-input" placeholder="e.g. 45 min" value="${esc(data.duration||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Exercises</label>
      <div id="scrp-ex-wrap">${exHtml}</div>
      <button type="button" class="scrp-ex-add-btn" onclick="addExercise()">＋ Add exercise</button>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Condition</label>
      ${emojiPicker(data.condition||"","f-condition","scrp-cond-picker",CONDS)}
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Notes</label>
      <textarea id="f-body" class="scrp-form-textarea" placeholder="How was it?">${esc(data.body||"")}</textarea>
    </div>`;
}

function ideaForm(data={}) {
  const priBtns = IDEA_PRIORITIES.map(pr =>
    `<button type="button" class="scrp-tag-btn${data.priority===pr?" scrp-tag-selected":""}"
      onclick="selectReviewTag(this,'${pr.replace(/'/g,"\\'")}','f-priority')">${pr}</button>`
  ).join("");
  return `
    <div class="scrp-form-row">
      <label class="scrp-form-label">Title</label>
      <input type="text" id="f-title" class="scrp-form-input" placeholder="Idea title…" value="${esc(data.title||"")}"/>
    </div>
    <div class="scrp-form-row" style="position:relative">
      <label class="scrp-form-label">Category</label>
      <input type="text" id="f-category" class="scrp-form-input" placeholder="e.g. App, Design, Writing…"
        value="${esc(data.category||"")}" oninput="updateIdeaCategory(this.value)" autocomplete="off"/>
      <div class="src-dropdown" id="idea-cat-dropdown" style="display:none;position:absolute;top:100%;left:0;width:100%;z-index:50"></div>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Priority</label>
      <div class="scrp-tag-picker">${priBtns}</div>
      <input type="hidden" id="f-priority" value="${esc(data.priority||"")}"/>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Idea</label>
      <textarea id="f-body" class="scrp-form-textarea" placeholder="Describe your idea…">${esc(data.body||"")}</textarea>
    </div>
    <div class="scrp-form-row">
      <label class="scrp-form-label">Next action</label>
      <input type="text" id="f-nextAction" class="scrp-form-input" placeholder="What's the first step?" value="${esc(data.nextAction||"")}"/>
    </div>`;
}

const FORM_MAP = { diary:diaryForm, review:reviewForm, travel:travelForm, music:musicForm, workout:workoutForm, idea:ideaForm };

/* ══ Image handling ══ */
let _pendingImgs=[];
window.addImgs=(input)=>{
  [...input.files].slice(0,5-_pendingImgs.length).forEach(file=>{
    const r=new FileReader();
    r.onload=e=>{_pendingImgs.push({data:e.target.result,caption:""});refreshImgPreviews();};
    r.readAsDataURL(file);
  });
  input.value="";
};
window.removeImg=(idx)=>{_pendingImgs.splice(idx,1);refreshImgPreviews();};
window.updateCaption=(idx,v)=>{if(_pendingImgs[idx])_pendingImgs[idx].caption=v;};
function refreshImgPreviews() {
  const wrap=document.getElementById("scrp-img-previews");if(!wrap)return;
  wrap.innerHTML=_pendingImgs.map((img,i)=>`
    <div class="scrp-img-preview-item">
      <img src="${img.data}"/>
      <input type="text" class="scrp-img-caption-inp" placeholder="Caption…" value="${esc(img.caption)}" oninput="updateCaption(${i},this.value)"/>
      <button type="button" class="scrp-img-remove" onclick="removeImg(${i})">✕</button>
    </div>`).join("");
}

/* ══ Star rating ══ */
let _scrpStarVal=0;
window.setScrpStar=(n)=>{
  _scrpStarVal=n;
  document.querySelectorAll(".scrp-star-btn").forEach(b=>b.classList.toggle("on",+b.dataset.n<=n));
};

/* ══ Build post — 9. uses currentEditId to prevent cross-post pollution ══ */
function buildPost(tmpl, existing={}) {
  const base={ id:existing.id||Date.now(), ts:existing.ts||new Date().toISOString(), tmpl, comments:existing.comments||[] };
  if (tmpl==="diary") {
    const isPrivate = document.getElementById("f-private")?.checked || false;
    if (isPrivate && !isPinSet()) {
      const pinInput = val("f-pin");
      if (pinInput) setPin(pinInput);
    }
    return { ...base, date:val("f-date"), weather:val("f-weather"), mood:val("f-mood"), title:val("f-title"), body:val("f-body"), isPrivate };
  }
  if (tmpl==="review")  return { ...base, tag:val("f-tag"), title:val("f-title"), source:val("f-source"), startDate:val("f-startDate"), endDate:val("f-endDate"), rating:_scrpStarVal, quote:val("f-quote"), body:val("f-body") };
  if (tmpl==="travel") {
    document.querySelectorAll(".scrp-img-caption-inp").forEach((inp,i)=>{if(_pendingImgs[i])_pendingImgs[i].caption=inp.value;});
    return { ...base, place:val("f-place"), location:val("f-location"), startDate:val("f-startDate"), endDate:val("f-endDate"), cost:val("f-cost"), images:[..._pendingImgs], body:val("f-body") };
  }
  if (tmpl==="music")   return { ...base, title:val("f-title"), artist:val("f-artist"), rating:_scrpStarVal, ytLink:val("f-ytLink"), body:val("f-body") };
  if (tmpl==="workout") return { ...base, date:val("f-date"), workoutType:val("f-workoutType"), duration:val("f-duration"), exercises:[..._exercises], condition:val("f-condition"), body:val("f-body") };
  if (tmpl==="idea")    return { ...base, title:val("f-title"), category:val("f-category"), priority:val("f-priority"), body:val("f-body"), nextAction:val("f-nextAction") };
  return base;
}

/* ══ Compose modal ══ */
window.openScrpCompose=()=>{
  currentTmpl=null; currentEditId=null; _pendingImgs=[]; _scrpStarVal=0; _exercises=[];
  document.getElementById("scrp-step-tmpl").style.display="block";
  document.getElementById("scrp-step-form").style.display="none";
  document.getElementById("scrp-modal-footer").style.display="none";
  document.getElementById("scrp-modal-title").textContent="New Entry";
  document.getElementById("scrp-compose-modal").classList.add("open");
};
window.closeScrpCompose=()=>document.getElementById("scrp-compose-modal").classList.remove("open");
window.selectTmpl=(tmpl)=>{
  currentTmpl=tmpl; _pendingImgs=[]; _scrpStarVal=0; _exercises=[];
  document.getElementById("scrp-step-tmpl").style.display="none";
  document.getElementById("scrp-step-form").innerHTML=(FORM_MAP[tmpl]||(() =>""))();
  document.getElementById("scrp-step-form").style.display="block";
  document.getElementById("scrp-modal-footer").style.display="flex";
  document.getElementById("scrp-modal-title").textContent=TMPL_NAMES[tmpl]||"New Entry";
};
window.backToTmplStep=()=>{
  document.getElementById("scrp-step-tmpl").style.display="block";
  document.getElementById("scrp-step-form").style.display="none";
  document.getElementById("scrp-modal-footer").style.display="none";
  document.getElementById("scrp-modal-title").textContent="New Entry";
};
document.getElementById("scrp-btn-post").addEventListener("click",async()=>{
  if(!currentTmpl)return;
  const post=buildPost(currentTmpl);
  posts.unshift(post);
  await savePost(post);
  closeScrpCompose();
  renderApp();
});

/* ══ Edit modal — 9. reset state before loading ══ */
window.openScrpEdit=(id)=>{
  const post=posts.find(p=>p.id===id);if(!post)return;
  // 9. reset all shared state before populating new form
  currentTmpl=post.tmpl; currentEditId=id;
  _scrpStarVal=post.rating||0;
  _pendingImgs=[...(post.images||[])];
  _exercises=[...(post.exercises||[]).map(e=>({...e}))];
  document.getElementById("scrp-edit-id").value=id;
  document.getElementById("scrp-edit-body").innerHTML=(FORM_MAP[post.tmpl]||(() =>""))(post);
  document.getElementById("scrp-edit-modal").classList.add("open");
};
window.closeScrpEdit=()=>{
  currentEditId=null;
  document.getElementById("scrp-edit-modal").classList.remove("open");
};
document.getElementById("scrp-btn-edit-save").addEventListener("click",async()=>{
  const id=+document.getElementById("scrp-edit-id").value;
  const post=posts.find(p=>p.id===id);if(!post)return;
  Object.assign(post,buildPost(post.tmpl,post));
  await savePost(post);closeScrpEdit();renderApp();
});

/* ══ Filters ══ */
window.setTmplFilter=(tmpl)=>{
  tmplFilter=tmpl;
  document.querySelectorAll(".scrp-filter-item").forEach(el=>el.classList.toggle("scrp-filter-active",el.dataset.tmpl===tmpl));
  navFilter=null; renderApp();
};
window.setNavFilter=(f)=>{
  navFilter=f;renderApp();
  if(f?.day){
    setTimeout(()=>{
      const key=`${f.y}-${String(f.m).padStart(2,"0")}-${String(f.day).padStart(2,"0")}`;
      document.getElementById("anchor-"+key)?.scrollIntoView({behavior:"smooth",block:"start"});
    },50);
  }
  if(window.innerWidth<=768){
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-overlay").classList.remove("open");
  }
};
window.scrollToTop=()=>window.scrollTo({top:0,behavior:"smooth"});
window.openSidebar=()=>{document.getElementById("sidebar").classList.add("open");document.getElementById("sidebar-overlay").classList.add("open");};
window.closeSidebar=()=>{document.getElementById("sidebar").classList.remove("open");document.getElementById("sidebar-overlay").classList.remove("open");};

/* ══ App ══ */
function renderApp(){renderNav(getNavPosts());renderTimeline();}
window.__renderApp=renderApp;
(async()=>{await loadPosts();renderApp();})();