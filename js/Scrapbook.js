import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { renderNav } from "./nav.js";

const firebaseConfig = {
  apiKey:"AIzaSyBDO_oFxGkj4rSr8l_DxKwB5IUpqe8FWhw",
  authDomain:"momonote-b26be.firebaseapp.com",
  projectId:"momonote-b26be",
  storageBucket:"momonote-b26be.firebasestorage.app",
  messagingSenderId:"220086826188",
  appId:"1:220086826188:web:e4e624488c63b61d76be69"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const COL = "scrapbook_posts";

let posts=[], tmplFilter="all", navFilter=null, currentTmpl=null, currentEditId=null;

/* ── PIN ── */
const PIN_KEY="scrp_pin";
let _pinUnlocked=false;
function getPin(){return localStorage.getItem(PIN_KEY)||"";}
function setPin(p){localStorage.setItem(PIN_KEY,p);}
function isPinSet(){return !!getPin();}

/* ── Firestore ── */
async function loadPosts(){const q=query(collection(db,COL),orderBy("ts","desc"));const snap=await getDocs(q);posts=snap.docs.map(d=>d.data());}
async function savePost(p){await setDoc(doc(db,COL,String(p.id)),p);}
async function deletePostDB(id){await deleteDoc(doc(db,COL,String(id)));}

/* ── Helpers ── */
function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escNl(s){return esc(s).replace(/\n/g,"<br>");}
function val(id){return document.getElementById(id)?.value||"";}
function keep(id,fb){const v=val(id);return v!==""?v:(fb??"");}
function today(){return new Date().toISOString().slice(0,10);}
function fmtTs(iso){const d=new Date(iso);return`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function getDateKey(iso){const d=new Date(iso);return{y:d.getFullYear(),m:d.getMonth()+1,day:d.getDate()};}
function daySuffix(d){if([11,12,13].includes(d%100))return"th";return d%10===1?"st":d%10===2?"nd":d%10===3?"rd":"th";}

const TMPL_LABELS={diary:"📔 Diary",drawing:"🎨 Drawing",idea:"💡 Idea",music:"🎵 Music",review:"🎬 Review",travel:"✈️ Travel",workout:"💪 Workout"};
const TMPL_COLORS={diary:"scrp-badge-diary",drawing:"scrp-badge-drawing",idea:"scrp-badge-idea",music:"scrp-badge-music",review:"scrp-badge-review",travel:"scrp-badge-travel",workout:"scrp-badge-workout"};
const TMPL_NAMES ={diary:"New Diary",drawing:"New Drawing",idea:"New Idea",music:"New Music",review:"New Review",travel:"New Travel",workout:"New Workout"};

const MOODS=["😊","😢","😡","😴","😰","🥳","😌","🤔","😑","🥹"];
const CONDS=["💪","😤","😅","😓","🥵","🙂","😐","😩"];
const WEATHERS=[{icon:"☀️",label:"Clear"},{icon:"⛅",label:"Partly cloudy"},{icon:"☁️",label:"Cloudy"},{icon:"🌧️",label:"Rain"},{icon:"❄️",label:"Snow"},{icon:"⛈️",label:"Storm"},{icon:"🌫️",label:"Foggy"},{icon:"🌬️",label:"Windy"}];
const REVIEW_TAGS=["📚 Book","🎬 Movie","📺 TV Show","🎮 Game","🎵 Album","🎙️ Podcast","▶️ YouTube","🎨 Art"];
const IDEA_PRIORITIES=["🔴 High","🟡 Mid","🟢 Low","💭 Just an idea"];
const DRAW_TAGS=["Sketch","Doodle","Lineart","Study","Watercolour","Digital","Portrait","Landscape"];
const DEFAULT_MUSIC_CAT="Favorite";

/* ── Filter ── */
function getNavPosts(){return tmplFilter==="all"?posts:posts.filter(p=>p.tmpl===tmplFilter);}
function getFilteredPosts(){
  let list=tmplFilter==="all"?[...posts]:posts.filter(p=>p.tmpl===tmplFilter);
  if(navFilter)list=list.filter(p=>{const k=getDateKey(p.ts);if(navFilter.y&&k.y!=navFilter.y)return false;if(navFilter.m&&k.m!=navFilter.m)return false;if(navFilter.day&&k.day!=navFilter.day)return false;return true;});
  return list;
}

/* ── Timeline ── */
function renderTimeline(){
  const filtered=getFilteredPosts();
  const tl=document.getElementById("timeline");
  if(!filtered.length){tl.innerHTML=`<div class="scrp-empty">No entries yet. Click <strong>+ New</strong> to add one!</div>`;return;}
  const groups={};
  filtered.forEach(p=>{const{y,m,day}=getDateKey(p.ts);const key=`${y}-${String(m).padStart(2,"0")}-${String(day).padStart(2,"0")}`;if(!groups[key])groups[key]={y,m,day,posts:[]};groups[key].posts.push(p);});
  let html="";
  Object.keys(groups).sort((a,b)=>b.localeCompare(a)).forEach(key=>{
    const{y,m,day,posts:gp}=groups[key];
    const mName=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1];
    html+=`<div class="scrp-date-anchor" id="anchor-${key}"><div class="scrp-date-label">${mName} ${day}${daySuffix(day)}, ${y}</div>`;
    gp.forEach(p=>{html+=renderCard(p);});
    html+=`</div>`;
  });
  tl.innerHTML=html;
}

const RATINGS=[
  {key:"love",    emoji:"😍", label:"Love",      cls:"scrp-rating-love"},
  {key:"like",    emoji:"🙂", label:"Like",      cls:"scrp-rating-like"},
  {key:"rec",     emoji:"👌", label:"Good",       cls:"scrp-rating-rec"},
  {key:"hmm",     emoji:"🤔", label:"Hmmm",      cls:"scrp-rating-hmm"},
  {key:"bad",     emoji:"👎", label:"Bad",       cls:"scrp-rating-bad"}
];
function ratingObj(key){return RATINGS.find(r=>r.key===key)||null;}
function renderRatingBadge(key){
  const r=ratingObj(key);if(!r)return"";
  return`<span class="scrp-rating-badge ${r.cls}">${r.emoji} ${r.label}</span>`;
}
function ratingPicker(selected){
  const btns=RATINGS.map(r=>`<button type="button" class="scrp-tag-btn scrp-rating-opt${selected===r.key?" scrp-tag-selected scrp-rating-opt-on":""}" data-key="${r.key}" onclick="pickRating('${r.key}',this)">${r.emoji} ${r.label}</button>`).join("");
  return`<div class="scrp-tag-picker scrp-rating-opts">${btns}</div><input type="hidden" id="f-rating" value="${selected||""}"/>`;
}
function ytEmbedUrl(url){if(!url)return"";const m=url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);return m?`https://www.youtube.com/embed/${m[1]}`:""; }

/* ── Card render ── */
function renderCard(p){
  const badge=TMPL_LABELS[p.tmpl]||p.tmpl;
  const cls=TMPL_COLORS[p.tmpl]||"";

  if(p.tmpl==="diary"&&p.isPrivate&&!_pinUnlocked){
    return`<div class="scrp-card" id="post-${p.id}">
      <div class="scrp-card-header"><span class="scrp-tmpl-badge ${cls}">${badge}</span><span class="scrp-card-ts">${fmtTs(p.ts)}</span><span class="scrp-private-badge">🔒 Private</span>
      <div class="scrp-card-actions"><button class="scrp-action-btn" onclick="unlockAndEdit(${p.id})">✎ Edit</button><button class="scrp-action-btn scrp-action-del" onclick="confirmDelete(${p.id})">✕ Delete</button></div></div>
      <div class="scrp-locked-msg" onclick="promptUnlock()"><span>🔒</span><span>Private entry — click to unlock</span></div>
      ${renderComments(p)}</div>`;}

  let content="";
  if(p.tmpl==="diary"){
    const weatherObj=WEATHERS.find(w=>w.icon===p.weather);
    const wChip=p.weather?`<span class="scrp-meta-chip">${p.weather}${weatherObj?" "+weatherObj.label:""}</span>`:"";
    const mChip=p.mood?`<span class="scrp-meta-chip scrp-mood-chip">${p.mood}</span>`:"";
    const meta=[wChip,mChip].filter(Boolean).join("");
    content=`${p.isPrivate?`<span class="scrp-private-badge">🔒 Private</span>`:""}${p.title?`<div class="scrp-card-title">${esc(p.title)}</div>`:""}${meta?`<div class="scrp-meta-row">${meta}</div>`:""}${p.body?`<div class="scrp-card-body">${escNl(p.body)}</div>`:""}`;
  } else if(p.tmpl==="drawing"){
    const tagBadges=(p.tags||[]).map(t=>`<span class="scrp-meta-chip">${esc(t)}</span>`).join("");
    content=`${p.title?`<div class="scrp-card-title">${esc(p.title)}</div>`:""}${tagBadges?`<div class="scrp-meta-row">${tagBadges}</div>`:""}${p.imageData?`<div class="scrp-drawing-img-wrap"><img src="${p.imageData}" class="scrp-drawing-img"/></div>`:""}${p.body?`<div class="scrp-card-body">${escNl(p.body)}</div>`:""}`;
  } else if(p.tmpl==="idea"){
    const priColor={"🔴 High":"#FAECE7","🟡 Mid":"#FEF9C3","🟢 Low":"#DCFCE7","💭 Just an idea":"#f5f2ed"};
    const priBg=priColor[p.priority]||"#f5f2ed";
    const imgs=p.images||[];
    content=`<div class="scrp-card-title">${esc(p.title||"")}</div><div class="scrp-meta-row">${p.category?`<span class="scrp-meta-chip">🏷 ${esc(p.category)}</span>`:""}${p.priority?`<span class="scrp-meta-chip" style="background:${priBg}">${p.priority}</span>`:""}</div>${p.body?`<div class="scrp-card-body">${escNl(p.body)}</div>`:""}${imgs.length?renderSlider(p.id,imgs):""}${p.nextAction?`<div class="scrp-next-action">→ ${esc(p.nextAction)}</div>`:""}`;
  } else if(p.tmpl==="music"){
    const cats=(p.categories||[]).map(c=>`<span class="scrp-meta-chip">${esc(c)}</span>`).join("");
    content=`<div class="scrp-card-title">${esc(p.title||"")}</div><div class="scrp-review-meta">${p.artist?`<span class="scrp-meta-chip">🎤 ${esc(p.artist)}</span>`:""}${renderRatingBadge(p.rating)}</div>${cats?`<div class="scrp-meta-row">${cats}</div>`:""}${ytEmbedUrl(p.ytLink)?`<div class="scrp-yt-wrap"><iframe src="${ytEmbedUrl(p.ytLink)}" frameborder="0" allowfullscreen class="scrp-yt-frame"></iframe></div>`:""}${p.body?`<div class="scrp-card-body">${escNl(p.body)}</div>`:""}`;
  } else if(p.tmpl==="review"){
    const dateRange=p.startDate&&p.endDate?`${esc(p.startDate)} → ${esc(p.endDate)}`:p.startDate?`Started ${esc(p.startDate)}`:"";
    const tagBadge=p.tag?`<span class="scrp-review-tag">${p.tag}</span>`:"";
    content=`<div class="scrp-card-title">${esc(p.title||"")}</div>${tagBadge}${p.source?`<div class="scrp-meta-row"><span class="scrp-meta-chip">✍️ ${esc(p.source)}</span></div>`:""}<div class="scrp-review-meta">${renderRatingBadge(p.rating)}${dateRange?`<span class="scrp-meta-chip">${dateRange}`:""}</span></div>${p.quote?`<div class="scrp-quote">"${escNl(p.quote)}"</div>`:""}${p.body?`<div class="scrp-card-body">${escNl(p.body)}</div>`:""}`;
  } else if(p.tmpl==="travel"){
    const imgs=p.images||[];
    const dateStr=p.startDate&&p.endDate&&p.startDate!==p.endDate?`${esc(p.startDate)} → ${esc(p.endDate)}`:p.startDate?esc(p.startDate):"";
    const mapLink=p.location?`<a class="scrp-map-link" href="https://www.google.com/maps/search/${encodeURIComponent(p.location)}" target="_blank" rel="noopener">📍 ${esc(p.location)}</a>`:"";
    const meta=[dateStr?`<span class="scrp-meta-chip">📅 ${dateStr}</span>`:"",p.cost?`<span class="scrp-meta-chip">💰 ${esc(p.cost)}</span>`:""].filter(Boolean).join("");
    content=`<div class="scrp-card-title">${esc(p.place||"")}</div>${mapLink}${meta?`<div class="scrp-meta-row">${meta}</div>`:""}${imgs.length?renderSlider(p.id,imgs):""}${p.body?`<div class="scrp-card-body">${escNl(p.body)}</div>`:""}`;
  } else if(p.tmpl==="workout"){
    const exList=(p.exercises||[]).map(ex=>`<div class="scrp-ex-row"><span class="scrp-ex-name">${esc(ex.name)}</span>${ex.sets?`<span class="scrp-ex-chip">${esc(ex.sets)} sets</span>`:""}${ex.reps?`<span class="scrp-ex-chip">${esc(ex.reps)} reps</span>`:""}${ex.weight?`<span class="scrp-ex-chip">${esc(ex.weight)}</span>`:""}</div>`).join("");
    const meta=[p.workoutType?`<span class="scrp-meta-chip">🏃 ${esc(p.workoutType)}</span>`:"",p.duration?`<span class="scrp-meta-chip">⏱ ${esc(p.duration)}</span>`:"",p.condition?`<span class="scrp-meta-chip scrp-mood-chip">${p.condition}</span>`:""].filter(Boolean).join("");
    content=`${meta?`<div class="scrp-meta-row">${meta}</div>`:""}${exList?`<div class="scrp-ex-list">${exList}</div>`:""}${p.body?`<div class="scrp-card-body">${escNl(p.body)}</div>`:""}`;
  }

  return`<div class="scrp-card" id="post-${p.id}">
    <div class="scrp-card-header"><span class="scrp-tmpl-badge ${cls}">${badge}</span><span class="scrp-card-ts">${fmtTs(p.ts)}</span>
    <div class="scrp-card-actions"><button class="scrp-action-btn" onclick="openScrpEdit(${p.id})">✎ Edit</button><button class="scrp-action-btn scrp-action-del" onclick="confirmDelete(${p.id})">✕ Delete</button></div></div>
    ${content}${renderComments(p)}</div>`;}

/* ── Slider ── */
function renderSlider(postId,images){
  if(!images.length)return"";
  const slides=images.map((img,i)=>`<div class="scrp-slide ${i===0?"active":""}" data-idx="${i}"><img src="${img.data}" alt="${esc(img.caption||"")}" class="scrp-slide-img"/>${img.caption?`<div class="scrp-slide-caption">${esc(img.caption)}</div>`:""}</div>`).join("");
  const dots=images.length>1?`<div class="scrp-slider-dots">${images.map((_,i)=>`<span class="scrp-dot ${i===0?"active":""}" onclick="goSlide('${postId}',${i})"></span>`).join("")}</div>`:"";
  const arrows=images.length>1?`<button class="scrp-arrow scrp-arrow-l" onclick="moveSlide('${postId}',-1)">‹</button><button class="scrp-arrow scrp-arrow-r" onclick="moveSlide('${postId}',1)">›</button>`:"";
  return`<div class="scrp-slider" id="slider-${postId}" data-cur="0" data-total="${images.length}" ontouchstart="scrpTouchStart(event,'${postId}')" ontouchend="scrpTouchEnd(event,'${postId}')"><div class="scrp-slides">${slides}</div>${arrows}${dots}</div>`;}
window.moveSlide=(postId,dir)=>{const s=document.getElementById("slider-"+postId);if(!s)return;goSlide(postId,(+s.dataset.cur+dir+ +s.dataset.total)% +s.dataset.total);};
window.goSlide=(postId,idx)=>{const s=document.getElementById("slider-"+postId);if(!s)return;s.dataset.cur=idx;s.querySelectorAll(".scrp-slide").forEach((el,i)=>el.classList.toggle("active",i===idx));s.querySelectorAll(".scrp-dot").forEach((el,i)=>el.classList.toggle("active",i===idx));};
let _touchX=0;
window.scrpTouchStart=(e)=>{_touchX=e.touches[0].clientX;};
window.scrpTouchEnd=(e,id)=>{const dx=e.changedTouches[0].clientX-_touchX;if(Math.abs(dx)>40)moveSlide(id,dx<0?1:-1);};

/* ── Comments ── */
function renderComments(p){
  const cmts=(p.comments||[]).map(c=>{
    const isEditing=false;
    return`<div class="scrp-comment" id="cmt-${p.id}-${c.cid}">
      <div class="scrp-comment-meta">
        <span class="scrp-comment-name">${esc(c.name)}</span>
        <span class="scrp-comment-ts">${c.ts?fmtTs(c.ts):""}</span>
        <button class="scrp-comment-edit-btn" onclick="startEditComment(${p.id},${c.cid})">Edit</button>
        <button class="scrp-comment-del" onclick="deleteComment(${p.id},${c.cid})">✕</button>
      </div>
      <div class="scrp-comment-text" id="cmttext-${p.id}-${c.cid}">${esc(c.text)}${c.edited?` <span class="scrp-edited">(edited)</span>`:""}</div>
    </div>`;}).join("");
  return`<div class="scrp-comments">${cmts}
    <div class="scrp-comment-form">
      <input class="scrp-comment-name-inp" id="cname-${p.id}" placeholder="Name"/>
      <input class="scrp-comment-text-inp" id="ctext-${p.id}" placeholder="Write a comment…" onkeydown="if(event.key==='Enter')postComment(${p.id})"/>
      <button class="scrp-comment-post-btn" onclick="postComment(${p.id})">Post</button>
    </div></div>`;}

window.postComment=async(postId)=>{
  const name=document.getElementById("cname-"+postId)?.value.trim();
  const text=document.getElementById("ctext-"+postId)?.value.trim();
  if(!text)return;
  const post=posts.find(p=>p.id===postId);if(!post)return;
  if(!post.comments)post.comments=[];
  post.comments.push({cid:Date.now(),name:name||"Anonymous",text,ts:new Date().toISOString()});
  await savePost(post);renderTimeline();};
window.deleteComment=async(postId,cid)=>{const post=posts.find(p=>p.id===postId);if(!post)return;post.comments=(post.comments||[]).filter(c=>c.cid!==cid);await savePost(post);renderTimeline();};
window.startEditComment=(postId,cid)=>{
  const post=posts.find(p=>p.id===postId);if(!post)return;
  const c=(post.comments||[]).find(c=>c.cid===cid);if(!c)return;
  const el=document.getElementById(`cmttext-${postId}-${cid}`);if(!el)return;
  el.innerHTML=`<input class="scrp-comment-text-inp" id="cedit-${postId}-${cid}" value="${esc(c.text)}" style="flex:1;margin-right:6px"/>
    <button class="scrp-comment-post-btn" onclick="saveEditComment(${postId},${cid})">Save</button>
    <button class="scrp-comment-edit-btn" onclick="renderTimeline()">Cancel</button>`;};
window.saveEditComment=async(postId,cid)=>{
  const post=posts.find(p=>p.id===postId);if(!post)return;
  const c=(post.comments||[]).find(c=>c.cid===cid);if(!c)return;
  const newText=document.getElementById(`cedit-${postId}-${cid}`)?.value.trim();
  if(!newText)return;
  c.text=newText;c.edited=true;
  await savePost(post);renderTimeline();};
window.confirmDelete=async(id)=>{if(!confirm("Delete this entry?"))return;posts=posts.filter(p=>p.id!==id);await deletePostDB(id);renderApp();};

/* ── PIN ── */
window.promptUnlock=()=>{const pin=getPin();if(!pin)return;const input=prompt("Enter PIN to view private entries:");if(input===pin){_pinUnlocked=true;renderTimeline();}else if(input!==null)alert("Wrong PIN.");};
window.unlockAndEdit=(id)=>{const pin=getPin();if(!pin||_pinUnlocked){openScrpEdit(id);return;}const input=prompt("Enter PIN to edit:");if(input===pin){_pinUnlocked=true;openScrpEdit(id);}else if(input!==null)alert("Wrong PIN.");};

/* ── Emoji picker (index-based) ── */
window.__emojiSets={MOODS,CONDS};
function emojiPicker(selected,hiddenId,pickerId,items){
  const btns=items.map((em,idx)=>`<button type="button" class="scrp-mood-btn${selected===em?" scrp-mood-selected":""}" data-picker="${pickerId}" data-idx="${idx}" onclick="pickEmoji('${pickerId}','${hiddenId}',${idx})">${em}</button>`).join("");
  return`<div class="scrp-mood-picker" id="${pickerId}">${btns}</div><input type="hidden" id="${hiddenId}" value="${esc(selected||"")}"/>`;}
window.pickEmoji=(pickerId,hiddenId,idx)=>{
  const setKey=pickerId==="scrp-mood-picker"?"MOODS":"CONDS";
  const em=window.__emojiSets[setKey][idx];
  document.getElementById(hiddenId).value=em;
  document.querySelectorAll(`#${pickerId} .scrp-mood-btn`).forEach((b,i)=>b.classList.toggle("scrp-mood-selected",i===idx));};

/* ── Weather picker (Fix 3 — edit 시에도 선택 표시됨) ── */
window.__weathers=WEATHERS;
function weatherPicker(selected){
  const btns=WEATHERS.map((w,idx)=>`<button type="button" class="scrp-weather-btn${selected===w.icon?" scrp-mood-selected":""}" onclick="pickWeather(${idx})" title="${w.label}">${w.icon}</button>`).join("");
  return`<div class="scrp-mood-picker" id="scrp-weather-picker">${btns}</div><input type="hidden" id="f-weather" value="${esc(selected||"")}"/>`;}
window.pickWeather=(idx)=>{const w=WEATHERS[idx];document.getElementById("f-weather").value=w.icon;document.querySelectorAll("#scrp-weather-picker .scrp-weather-btn").forEach((b,i)=>b.classList.toggle("scrp-mood-selected",i===idx));};

/* ── Music category multi-select ── */
let _musicCats=[];
function getAllMusicCategories(){
  const cats=new Set([DEFAULT_MUSIC_CAT]);
  posts.filter(p=>p.tmpl==="music").forEach(p=>(p.categories||[]).forEach(c=>cats.add(c)));
  return[...cats];
}
// Music category state — managed entirely in JS, no inline HTML events
function musicCatPicker(selected=[]){
  const allCats=getAllMusicCategories();
  const selLabel = selected.filter(c=>c!=="none").join(", ") || "Select";
  const items = allCats.map(c=>{
    const chk = selected.includes(c);
    return `<label class="cat-dd-item">
      <input type="checkbox" class="cat-dd-chk" data-cat="${esc(c)}" ${chk?"checked":""}/>${esc(c)}
    </label>`;
  }).join("");
  return `
    <div class="cat-dd-wrap" id="cat-dd-wrap">
      <button type="button" class="cat-dd-trigger" id="cat-dd-trigger">
        <span id="cat-dd-label">${selLabel}</span>
        <span class="cat-dd-arrow">&#8964;</span>
      </button>
      <div class="cat-dd-panel" id="cat-dd-panel">
        <div class="cat-dd-list" id="cat-dd-list">${items}</div>
        <div class="cat-dd-footer">
          <input type="text" id="new-music-cat" class="cat-dd-new-inp" placeholder="New playlist…"/>
          <button type="button" id="new-music-cat-add-btn" class="cat-dd-add-btn">＋</button>
        </div>
      </div>
    </div>
    <input type="hidden" id="f-categories" value="${esc(JSON.stringify(selected))}"/>`;
}

function bindMusicCatEvents(){
  const trigger = document.getElementById("cat-dd-trigger");
  const panel   = document.getElementById("cat-dd-panel");
  const addBtn  = document.getElementById("new-music-cat-add-btn");
  const addInp  = document.getElementById("new-music-cat");
  const fi      = document.getElementById("f-categories");
  if(!trigger||!panel||!fi) return;

  // toggle dropdown open/close
  trigger.addEventListener("click", e=>{
    e.stopPropagation();
    panel.classList.toggle("open");
  });
  // close on outside click
  document.addEventListener("click", function handler(e){
    if(!panel.contains(e.target)&&e.target!==trigger){
      panel.classList.remove("open");
    }
  });

  // sync checkboxes → hidden input → label
  function syncCats(){
    const checked=[...document.querySelectorAll(".cat-dd-chk:checked")].map(el=>el.dataset.cat);
    const cats = checked.length ? checked : ["none"];
    fi.value = JSON.stringify(cats);
    document.getElementById("cat-dd-label").textContent = checked.length ? checked.join(", ") : "Select";
  }

  document.querySelectorAll(".cat-dd-chk").forEach(chk=>{
    chk.addEventListener("change", syncCats);
  });

  // add new playlist
  function doAdd(){
    const cat = addInp.value.trim(); if(!cat) return;
    // check not duplicate
    if([...document.querySelectorAll(".cat-dd-chk")].some(el=>el.dataset.cat===cat)){
      addInp.value=""; return;
    }
    const list = document.getElementById("cat-dd-list");
    const lbl  = document.createElement("label");
    lbl.className = "cat-dd-item";
    lbl.innerHTML = `<input type="checkbox" class="cat-dd-chk" data-cat="${esc(cat)}" checked/>${esc(cat)}`;
    lbl.querySelector("input").addEventListener("change", syncCats);
    list.appendChild(lbl);
    addInp.value = "";
    syncCats();
  }

  addBtn.addEventListener("click", doAdd);
  addInp.addEventListener("keydown", e=>{ if(e.key==="Enter"){e.preventDefault();doAdd();} });
}




/* ── Drawing canvas ── */
let _drawTool="pen",_drawColor="#1a1a1a",_brushSize=3,_drawing=false,_lx=0,_ly=0;
window.setBrushSize=(v)=>{ _brushSize=+v; };
window.setDrawColor=(c,el)=>{_drawColor=c;document.querySelectorAll(".color-dot").forEach(d=>d.classList.remove("on"));el.classList.add("on");_drawTool="pen";};
window.setDrawTool=(t,btn)=>{_drawTool=t;document.querySelectorAll(".draw-tool-btn").forEach(b=>b.classList.toggle("on",b===btn));};
window.clearCanvas=()=>{const c=document.getElementById("draw-canvas");if(!c)return;c.getContext("2d").clearRect(0,0,c.width,c.height);_drawingImageData=null;};
let _drawingImageData=null;
function initCanvas(){
  const canvas=document.getElementById("draw-canvas");if(!canvas)return;
  const ctx=canvas.getContext("2d");ctx.lineCap="round";ctx.lineJoin="round";
  canvas.addEventListener("mousedown",e=>{_drawing=true;const r=canvas.getBoundingClientRect();_lx=e.clientX-r.left;_ly=e.clientY-r.top;});
  canvas.addEventListener("mousemove",e=>{if(!_drawing)return;const r=canvas.getBoundingClientRect();const x=e.clientX-r.left,y=e.clientY-r.top;ctx.globalCompositeOperation=_drawTool==="eraser"?"destination-out":"source-over";ctx.strokeStyle=_drawColor;ctx.lineWidth=_drawTool==="eraser"?_brushSize*3:_brushSize;ctx.beginPath();ctx.moveTo(_lx,_ly);ctx.lineTo(x,y);ctx.stroke();_lx=x;_ly=y;});
  canvas.addEventListener("mouseup",()=>{_drawing=false;_drawingImageData=canvas.toDataURL();});
  canvas.addEventListener("mouseleave",()=>{_drawing=false;});
  canvas.addEventListener("touchstart",e=>{e.preventDefault();_drawing=true;const r=canvas.getBoundingClientRect();_lx=e.touches[0].clientX-r.left;_ly=e.touches[0].clientY-r.top;},{passive:false});
  canvas.addEventListener("touchmove",e=>{e.preventDefault();if(!_drawing)return;const r=canvas.getBoundingClientRect();const x=e.touches[0].clientX-r.left,y=e.touches[0].clientY-r.top;ctx.globalCompositeOperation="source-over";ctx.strokeStyle=_drawColor;ctx.lineWidth=_brushSize;ctx.beginPath();ctx.moveTo(_lx,_ly);ctx.lineTo(x,y);ctx.stroke();_lx=x;_ly=y;_drawingImageData=canvas.toDataURL();},{passive:false});
  canvas.addEventListener("touchend",()=>{_drawing=false;});
}
window.loadImgToCanvas=(input)=>{const file=input.files[0];if(!file)return;const r=new FileReader();r.onload=e=>{const img=new Image();img.onload=()=>{const c=document.getElementById("draw-canvas");if(!c)return;const ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);const scale=Math.min(c.width/img.width,c.height/img.height);const w=img.width*scale,h=img.height*scale;ctx.drawImage(img,(c.width-w)/2,(c.height-h)/2,w,h);_drawingImageData=c.toDataURL();};img.src=e.target.result;};r.readAsDataURL(file);};
window.toggleDrawTag=(btn)=>{btn.classList.toggle("scrp-tag-selected");};

/* ── Exercise list ── */
let _exercises=[];
window.addExercise=()=>{_exercises.push({name:"",sets:"",reps:"",weight:""});renderExerciseList();};
window.removeExercise=(idx)=>{_exercises.splice(idx,1);renderExerciseList();};
window.updateEx=(idx,field,v)=>{if(_exercises[idx])_exercises[idx][field]=v;};
function renderExerciseList(){
  const wrap=document.getElementById("scrp-ex-wrap");if(!wrap)return;
  wrap.innerHTML=_exercises.map((ex,i)=>`<div class="scrp-ex-form-row"><input class="scrp-form-input scrp-ex-inp" placeholder="Exercise" value="${esc(ex.name)}" oninput="updateEx(${i},'name',this.value)"/><input class="scrp-form-input scrp-ex-inp-sm" placeholder="Sets" value="${esc(ex.sets)}" oninput="updateEx(${i},'sets',this.value)"/><input class="scrp-form-input scrp-ex-inp-sm" placeholder="Reps" value="${esc(ex.reps)}" oninput="updateEx(${i},'reps',this.value)"/><input class="scrp-form-input scrp-ex-inp-sm" placeholder="kg/lb" value="${esc(ex.weight)}" oninput="updateEx(${i},'weight',this.value)"/><button type="button" class="scrp-ex-del" onclick="removeExercise(${i})">✕</button></div>`).join("");}

/* ── Idea category dropdown ── */
window.updateIdeaCategory=(v)=>{const dd=document.getElementById("idea-cat-dropdown");if(!dd)return;const existing=[...new Set(posts.filter(p=>p.tmpl==="idea"&&p.category).map(p=>p.category))];const matches=existing.filter(c=>c.toLowerCase().includes(v.toLowerCase())&&c!==v);if(!v||!matches.length){dd.style.display="none";return;}dd.innerHTML=matches.map(c=>`<div class="src-dropdown-item" onmousedown="selectIdeaCat('${c.replace(/'/g,"\\'")}')"> ${esc(c)}</div>`).join("");dd.style.display="block";};
window.selectIdeaCat=(v)=>{const inp=document.getElementById("f-category");if(inp)inp.value=v;const dd=document.getElementById("idea-cat-dropdown");if(dd)dd.style.display="none";};

/* ── Image handling ── */
let _pendingImgs=[];
window.addImgs=(input)=>{
  const files=[...input.files].slice(0,5-_pendingImgs.length);
  Promise.all(files.map(f=>new Promise(res=>{const r=new FileReader();r.onload=e=>res({data:e.target.result,caption:""});r.readAsDataURL(f);}))).then(results=>{_pendingImgs.push(...results);refreshImgPreviews();});
  input.value="";};
window.removeImg=(idx)=>{_pendingImgs.splice(idx,1);refreshImgPreviews();};
window.updateCaption=(idx,v)=>{if(_pendingImgs[idx])_pendingImgs[idx].caption=v;};
function refreshImgPreviews(){const wrap=document.getElementById("scrp-img-previews");if(!wrap)return;wrap.innerHTML=_pendingImgs.map((img,i)=>`<div class="scrp-img-preview-item"><img src="${img.data}"/><input type="text" class="scrp-img-caption-inp" placeholder="Caption…" value="${esc(img.caption)}" oninput="updateCaption(${i},this.value)"/><button type="button" class="scrp-img-remove" onclick="removeImg(${i})">✕</button></div>`).join("");}

window.pickRating=(key,btn)=>{
  document.getElementById("f-rating").value=key;
  btn.closest(".scrp-rating-opts").querySelectorAll(".scrp-rating-opt").forEach(b=>{
    b.classList.toggle("scrp-tag-selected",b===btn);
    b.classList.toggle("scrp-rating-opt-on",b===btn);
  });
};

/* ── Review tag ── */
window.selectReviewTag=(btn,t,hiddenId)=>{document.getElementById(hiddenId).value=t;btn.closest(".scrp-tag-picker").querySelectorAll(".scrp-tag-btn").forEach(b=>b.classList.toggle("scrp-tag-selected",b===btn));};

/* ── Forms ── */
function diaryForm(data={}){
  return`<div class="scrp-form-row"><label class="scrp-form-label">Date</label><input type="date" id="f-date" class="scrp-form-input" value="${data.date||today()}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Weather</label>${weatherPicker(data.weather||"")}</div>
    <div class="scrp-form-row"><label class="scrp-form-label">Mood</label>${emojiPicker(data.mood||"","f-mood","scrp-mood-picker",MOODS)}</div>
    <div class="scrp-form-row"><label class="scrp-form-label">Title</label><input type="text" id="f-title" class="scrp-form-input" placeholder="Title" value="${esc(data.title||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Entry</label><textarea id="f-body" class="scrp-form-textarea" placeholder="Write about your day…">${esc(data.body||"")}</textarea></div>
    <div class="scrp-form-row scrp-private-row"><label class="scrp-private-label"><input type="checkbox" id="f-private" ${data.isPrivate?"checked":""}/>🔒 Private</label><div id="scrp-pin-wrap" style="${data.isPrivate?"":"display:none"}">${isPinSet()?`<span style="font-size:0.75rem;color:#aaa">PIN set</span><button type="button" class="scrp-pin-change-btn" onclick="changePinPrompt()">Change</button>`:`<input type="text" id="f-pin" class="scrp-form-input" placeholder="Set PIN" maxlength="8" style="width:7rem"/>`}</div></div>`;}
document.addEventListener("change",e=>{if(e.target.id==="f-private"){const wrap=document.getElementById("scrp-pin-wrap");if(wrap)wrap.style.display=e.target.checked?"":"none";}});
window.changePinPrompt=()=>{const p=prompt("New PIN:");if(p){setPin(p);alert("PIN updated!");}};

function drawingForm(data={}){
  _drawingImageData=data.imageData||null;
  setTimeout(()=>{initCanvas();if(data.imageData){const c=document.getElementById("draw-canvas");if(!c)return;const img=new Image();img.onload=()=>{const ctx=c.getContext("2d");const s=Math.min(c.width/img.width,c.height/img.height);const w=img.width*s,h=img.height*s;ctx.drawImage(img,(c.width-w)/2,(c.height-h)/2,w,h);};img.src=data.imageData;}},50);
  const tagBtns=DRAW_TAGS.map(t=>`<button type="button" class="scrp-tag-btn draw-tag-btn${(data.tags||[]).includes(t)?" scrp-tag-selected":""}" onclick="toggleDrawTag(this)">${t}</button>`).join("");
  return`<div class="scrp-form-row"><label class="scrp-form-label">Title</label><input type="text" id="f-title" class="scrp-form-input" placeholder="Title (optional)" value="${esc(data.title||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Canvas</label>
      <div class="draw-toolbar"><button type="button" class="draw-tool-btn on" onclick="setDrawTool('pen',this)">✏️ Pen</button><button type="button" class="draw-tool-btn" onclick="setDrawTool('eraser',this)">🧹 Erase</button><button type="button" class="draw-tool-btn" onclick="clearCanvas()">🗑 Clear</button>
        <div class="color-dot on" style="background:#1a1a1a" onclick="setDrawColor('#1a1a1a',this)"></div>
        <div class="color-dot" style="background:#D4621A" onclick="setDrawColor('#D4621A',this)"></div>
        <div class="color-dot" style="background:#3b82f6" onclick="setDrawColor('#3b82f6',this)"></div>
        <div class="color-dot" style="background:#22c55e" onclick="setDrawColor('#22c55e',this)"></div>
        <div class="color-dot" style="background:#ef4444" onclick="setDrawColor('#ef4444',this)"></div>
        <input type="range" min="1" max="20" value="3" id="brush-size-slider" style="width:5rem" oninput="setBrushSize(this.value);document.getElementById('brush-size-label').textContent=this.value+'px'"/>
        <span id="brush-size-label" style="font-size:11px;color:#aaa;min-width:2rem">3px</span>
      </div>
      <canvas id="draw-canvas" width="460" height="260" class="draw-canvas"></canvas>
      <div style="font-size:0.75rem;color:#aaa;margin-top:4px">Or upload an image:</div>
      <input type="file" accept="image/*" class="scrp-form-input" onchange="loadImgToCanvas(this)"/>
    </div>
    <div class="scrp-form-row"><label class="scrp-form-label">Tags</label><div class="scrp-tag-picker">${tagBtns}</div></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Notes</label><textarea id="f-body" class="scrp-form-textarea" placeholder="Notes…">${esc(data.body||"")}</textarea></div>`;}

function reviewForm(data={}){
  const tagBtns=REVIEW_TAGS.map(t=>`<button type="button" class="scrp-tag-btn${data.tag===t?" scrp-tag-selected":""}" onclick="selectReviewTag(this,'${t.replace(/'/g,"\\'")}','f-tag')">${t}</button>`).join("");
  return`<div class="scrp-form-row"><label class="scrp-form-label">Type</label><div class="scrp-tag-picker">${tagBtns}</div><input type="hidden" id="f-tag" value="${esc(data.tag||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Title</label><input type="text" id="f-title" class="scrp-form-input" placeholder="Title…" value="${esc(data.title||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Author / Source</label><input type="text" id="f-source" class="scrp-form-input" placeholder="Author, director…" value="${esc(data.source||"")}"/></div>
    <div class="scrp-form-2col"><div><label class="scrp-form-label">Start date</label><input type="date" id="f-startDate" class="scrp-form-input" value="${data.startDate||""}"/></div><div><label class="scrp-form-label">End date</label><input type="date" id="f-endDate" class="scrp-form-input" value="${data.endDate||""}"/></div></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Rating</label>${ratingPicker(data.rating||"")}</div>
    <div class="scrp-form-row"><label class="scrp-form-label">Favourite quote</label><textarea id="f-quote" class="scrp-form-textarea" style="min-height:3.5rem" placeholder='"A quote…"'>${esc(data.quote||"")}</textarea></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Review</label><textarea id="f-body" class="scrp-form-textarea" placeholder="Your thoughts…">${esc(data.body||"")}</textarea></div>`;}

function travelForm(data={}){
  const imgs=data.images||[];
  const previews=imgs.map((img,i)=>`<div class="scrp-img-preview-item"><img src="${img.data}"/><input type="text" class="scrp-img-caption-inp" placeholder="Caption…" value="${esc(img.caption||"")}" oninput="updateCaption(${i},this.value)"/><button type="button" class="scrp-img-remove" onclick="removeImg(${i})">✕</button></div>`).join("");
  return`<div class="scrp-form-row"><label class="scrp-form-label">Place</label><input type="text" id="f-place" class="scrp-form-input" placeholder="City, landmark…" value="${esc(data.place||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Location (map)</label><input type="text" id="f-location" class="scrp-form-input" placeholder="e.g. Granville Island, Vancouver" value="${esc(data.location||"")}"/></div>
    <div class="scrp-form-2col"><div><label class="scrp-form-label">Start date</label><input type="date" id="f-startDate" class="scrp-form-input" value="${data.startDate||""}"/></div><div><label class="scrp-form-label">End date</label><input type="date" id="f-endDate" class="scrp-form-input" value="${data.endDate||""}"/></div></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Cost</label><input type="text" id="f-cost" class="scrp-form-input" placeholder="e.g. $42" value="${esc(data.cost||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Photos <span style="color:#bbb;font-size:0.75rem">(up to 5)</span></label><div class="scrp-img-previews" id="scrp-img-previews">${previews}</div><input type="file" id="f-imgs" accept="image/*" multiple class="scrp-form-input" onchange="addImgs(this)"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Notes</label><textarea id="f-body" class="scrp-form-textarea" placeholder="How was it?">${esc(data.body||"")}</textarea></div>`;}

function musicForm(data={}){
  return`<div class="scrp-form-row"><label class="scrp-form-label">Album / Song</label><input type="text" id="f-title" class="scrp-form-input" placeholder="Title…" value="${esc(data.title||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Artist</label><input type="text" id="f-artist" class="scrp-form-input" placeholder="Artist…" value="${esc(data.artist||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Rating</label>${ratingPicker(data.rating||"")}</div>
    <div class="scrp-form-row"><label class="scrp-form-label">Categories <span style="color:#bbb;font-size:0.75rem">(multi-select)</span></label>${musicCatPicker(data.categories||[DEFAULT_MUSIC_CAT])}</div>
    <div class="scrp-form-row"><label class="scrp-form-label">YouTube link</label><input type="text" id="f-ytLink" class="scrp-form-input" placeholder="https://youtube.com/watch?v=…" value="${esc(data.ytLink||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Notes</label><textarea id="f-body" class="scrp-form-textarea" placeholder="Your thoughts…">${esc(data.body||"")}</textarea></div>`;}

function workoutForm(data={}){
  _exercises=(data.exercises||[]).map(e=>({...e}));
  const exHtml=_exercises.map((ex,i)=>`<div class="scrp-ex-form-row"><input class="scrp-form-input scrp-ex-inp" placeholder="Exercise" value="${esc(ex.name)}" oninput="updateEx(${i},'name',this.value)"/><input class="scrp-form-input scrp-ex-inp-sm" placeholder="Sets" value="${esc(ex.sets)}" oninput="updateEx(${i},'sets',this.value)"/><input class="scrp-form-input scrp-ex-inp-sm" placeholder="Reps" value="${esc(ex.reps)}" oninput="updateEx(${i},'reps',this.value)"/><input class="scrp-form-input scrp-ex-inp-sm" placeholder="kg/lb" value="${esc(ex.weight)}" oninput="updateEx(${i},'weight',this.value)"/><button type="button" class="scrp-ex-del" onclick="removeExercise(${i})">✕</button></div>`).join("");
  return`<div class="scrp-form-row"><label class="scrp-form-label">Date</label><input type="date" id="f-date" class="scrp-form-input" value="${data.date||today()}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Workout type</label><input type="text" id="f-workoutType" class="scrp-form-input" placeholder="e.g. Running, Yoga…" value="${esc(data.workoutType||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Duration</label><input type="text" id="f-duration" class="scrp-form-input" placeholder="e.g. 45 min" value="${esc(data.duration||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Exercises</label><div id="scrp-ex-wrap">${exHtml}</div><button type="button" class="scrp-ex-add-btn" onclick="addExercise()">＋ Add exercise</button></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Condition</label>${emojiPicker(data.condition||"","f-condition","scrp-cond-picker",CONDS)}</div>
    <div class="scrp-form-row"><label class="scrp-form-label">Notes</label><textarea id="f-body" class="scrp-form-textarea" placeholder="How was it?">${esc(data.body||"")}</textarea></div>`;}

function ideaForm(data={}){
  const priBtns=IDEA_PRIORITIES.map(pr=>`<button type="button" class="scrp-tag-btn${data.priority===pr?" scrp-tag-selected":""}" onclick="selectReviewTag(this,'${pr.replace(/'/g,"\\'")}','f-priority')">${pr}</button>`).join("");
  const imgs=data.images||[];
  const previews=imgs.map((img,i)=>`<div class="scrp-img-preview-item"><img src="${img.data}"/><input type="text" class="scrp-img-caption-inp" placeholder="Caption…" value="${esc(img.caption||"")}" oninput="updateCaption(${i},this.value)"/><button type="button" class="scrp-img-remove" onclick="removeImg(${i})">✕</button></div>`).join("");
  return`<div class="scrp-form-row"><label class="scrp-form-label">Title</label><input type="text" id="f-title" class="scrp-form-input" placeholder="Idea title…" value="${esc(data.title||"")}"/></div>
    <div class="scrp-form-row" style="position:relative"><label class="scrp-form-label">Category</label><input type="text" id="f-category" class="scrp-form-input" placeholder="e.g. App, Design…" value="${esc(data.category||"")}" oninput="updateIdeaCategory(this.value)" autocomplete="off"/><div class="src-dropdown" id="idea-cat-dropdown" style="display:none;position:absolute;top:100%;left:0;width:100%;z-index:50"></div></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Priority</label><div class="scrp-tag-picker">${priBtns}</div><input type="hidden" id="f-priority" value="${esc(data.priority||"")}"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Idea</label><textarea id="f-body" class="scrp-form-textarea" placeholder="Describe your idea…">${esc(data.body||"")}</textarea></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Images <span style="color:#bbb;font-size:0.75rem">(up to 5)</span></label><div class="scrp-img-previews" id="scrp-img-previews">${previews}</div><input type="file" id="f-imgs" accept="image/*" multiple class="scrp-form-input" onchange="addImgs(this)"/></div>
    <div class="scrp-form-row"><label class="scrp-form-label">Next action</label><input type="text" id="f-nextAction" class="scrp-form-input" placeholder="First step?" value="${esc(data.nextAction||"")}"/></div>`;}

const FORM_MAP={diary:diaryForm,drawing:drawingForm,idea:ideaForm,music:musicForm,review:reviewForm,travel:travelForm,workout:workoutForm};

/* ── Build post ── */
function buildPost(tmpl,existing={}){
  const base={id:existing.id||Date.now(),ts:existing.ts||new Date().toISOString(),tmpl,comments:existing.comments||[]};
  if(tmpl==="diary"){
    const isPrivate=document.getElementById("f-private")?.checked??existing.isPrivate??false;
    if(isPrivate&&!isPinSet()){const p=val("f-pin");if(p)setPin(p);}
    return{...base,date:keep("f-date",existing.date),weather:keep("f-weather",existing.weather),mood:keep("f-mood",existing.mood),title:keep("f-title",existing.title),body:keep("f-body",existing.body),isPrivate};}
  if(tmpl==="drawing"){
    const tags=[...document.querySelectorAll(".draw-tag-btn.scrp-tag-selected")].map(b=>b.textContent);
    const imgData=_drawingImageData||existing.imageData||null;
    return{...base,title:keep("f-title",existing.title),imageData:imgData,tags:tags.length?tags:(existing.tags||[]),body:keep("f-body",existing.body)};}
  if(tmpl==="review")return{...base,tag:keep("f-tag",existing.tag),title:keep("f-title",existing.title),source:keep("f-source",existing.source),startDate:keep("f-startDate",existing.startDate),endDate:keep("f-endDate",existing.endDate),rating:keep("f-rating",existing.rating),quote:keep("f-quote",existing.quote),body:keep("f-body",existing.body)};
  if(tmpl==="travel"){document.querySelectorAll(".scrp-img-caption-inp").forEach((inp,i)=>{if(_pendingImgs[i])_pendingImgs[i].caption=inp.value;});return{...base,place:keep("f-place",existing.place),location:keep("f-location",existing.location),startDate:keep("f-startDate",existing.startDate),endDate:keep("f-endDate",existing.endDate),cost:keep("f-cost",existing.cost),images:_pendingImgs.length?[..._pendingImgs]:(existing.images||[]),body:keep("f-body",existing.body)};}
  if(tmpl==="music"){let cats=[];try{cats=JSON.parse(val("f-categories")||"[]");}catch{}return{...base,title:keep("f-title",existing.title),artist:keep("f-artist",existing.artist),rating:keep("f-rating",existing.rating),categories:cats.length?cats:(existing.categories||[DEFAULT_MUSIC_CAT]),ytLink:keep("f-ytLink",existing.ytLink),body:keep("f-body",existing.body)};}
  if(tmpl==="workout")return{...base,date:keep("f-date",existing.date),workoutType:keep("f-workoutType",existing.workoutType),duration:keep("f-duration",existing.duration),exercises:_exercises.length?[..._exercises]:(existing.exercises||[]),condition:keep("f-condition",existing.condition),body:keep("f-body",existing.body)};
  if(tmpl==="idea"){document.querySelectorAll(".scrp-img-caption-inp").forEach((inp,i)=>{if(_pendingImgs[i])_pendingImgs[i].caption=inp.value;});return{...base,title:keep("f-title",existing.title),category:keep("f-category",existing.category),priority:keep("f-priority",existing.priority),body:keep("f-body",existing.body),images:_pendingImgs.length?[..._pendingImgs]:(existing.images||[]),nextAction:keep("f-nextAction",existing.nextAction)};}
  return base;}

/* ── Compose ── */
window.openScrpCompose=()=>{currentTmpl=null;currentEditId=null;_pendingImgs=[];_exercises=[];_drawingImageData=null;document.getElementById("scrp-step-tmpl").style.display="block";document.getElementById("scrp-step-form").style.display="none";document.getElementById("scrp-modal-footer").style.display="none";document.getElementById("scrp-modal-title").textContent="New Entry";document.getElementById("scrp-compose-modal").classList.add("open");};
window.closeScrpCompose=()=>document.getElementById("scrp-compose-modal").classList.remove("open");
window.selectTmpl=(tmpl)=>{
  currentTmpl=tmpl;_pendingImgs=[];_exercises=[];_drawingImageData=null;
  document.getElementById("scrp-step-tmpl").style.display="none";
  document.getElementById("scrp-step-form").innerHTML=(FORM_MAP[tmpl]||(() =>""))();
  document.getElementById("scrp-step-form").style.display="block";
  document.getElementById("scrp-modal-footer").style.display="flex";
  document.getElementById("scrp-modal-title").textContent=TMPL_NAMES[tmpl]||"New Entry";
  if(tmpl==="music")setTimeout(bindMusicCatEvents,0);
};
window.backToTmplStep=()=>{document.getElementById("scrp-step-tmpl").style.display="block";document.getElementById("scrp-step-form").style.display="none";document.getElementById("scrp-modal-footer").style.display="none";document.getElementById("scrp-modal-title").textContent="New Entry";};
document.getElementById("scrp-btn-post").addEventListener("click",async()=>{if(!currentTmpl)return;const post=buildPost(currentTmpl);posts.unshift(post);await savePost(post);closeScrpCompose();renderApp();initMiniPlayer();});

/* ── Edit ── */
window.openScrpEdit=(id)=>{
  const post=posts.find(p=>p.id===id);if(!post)return;
  currentTmpl=post.tmpl;currentEditId=id;
  _pendingImgs=[...(post.images||[])];
  _exercises=[...(post.exercises||[]).map(e=>({...e}))];
  _drawingImageData=post.imageData||null;
  document.getElementById("scrp-edit-id").value=id;
  document.getElementById("scrp-edit-body").innerHTML=(FORM_MAP[post.tmpl]||(() =>""))(post);
  document.getElementById("scrp-edit-modal").classList.add("open");
  if(post.tmpl==="music")setTimeout(bindMusicCatEvents,0);
};
window.closeScrpEdit=()=>{currentEditId=null;document.getElementById("scrp-edit-modal").classList.remove("open");};
document.getElementById("scrp-btn-edit-save").addEventListener("click",async()=>{const id=+document.getElementById("scrp-edit-id").value;const post=posts.find(p=>p.id===id);if(!post)return;Object.assign(post,buildPost(post.tmpl,post));await savePost(post);closeScrpEdit();renderApp();});

/* ── Filters ── */
window.setTmplFilter=(tmpl)=>{tmplFilter=tmpl;document.querySelectorAll(".scrp-filter-item").forEach(el=>el.classList.toggle("scrp-filter-active",el.dataset.tmpl===tmpl));navFilter=null;renderApp();};
window.setNavFilter=(f)=>{navFilter=f;renderApp();if(f?.day){setTimeout(()=>{const key=`${f.y}-${String(f.m).padStart(2,"0")}-${String(f.day).padStart(2,"0")}`;document.getElementById("anchor-"+key)?.scrollIntoView({behavior:"smooth",block:"start"});},50);}if(window.innerWidth<=768){document.getElementById("sidebar").classList.remove("open");document.getElementById("sidebar-overlay").classList.remove("open");}};
window.scrollToTop=()=>window.scrollTo({top:0,behavior:"smooth"});
window.openSidebar=()=>{document.getElementById("sidebar").classList.add("open");document.getElementById("sidebar-overlay").classList.add("open");};
window.closeSidebar=()=>{document.getElementById("sidebar").classList.remove("open");document.getElementById("sidebar-overlay").classList.remove("open");};

/* ═══════════════════════════════
   MINI PLAYER
═══════════════════════════════ */
let _mpTracks=[], _mpCur=-1, _mpPlaying=false, _mpModeIdx=0;
const MP_MODES=[
  {
    key:"repeat",
    svg:'<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>'
  },
  {
    key:"one",
    svg:'<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/><rect x="8" y="8" width="8" height="9" rx="1" fill="white" stroke="none"/><text x="12" y="16" font-size="8" font-weight="bold" text-anchor="middle" fill="currentColor" stroke="none">1</text>'
  },
  {
    key:"shuffle",
    svg:'<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>'
  }
];

const WP_KEY = "momonote_player";
function wpSaveState(cat){
  try {
    const allTracks = posts.filter(p=>p.tmpl==="music"&&p.ytLink)
      .map(p=>({title:p.title,artist:p.artist,ytLink:p.ytLink,rating:p.rating,categories:p.categories||[DEFAULT_MUSIC_CAT]}));
    localStorage.setItem(WP_KEY, JSON.stringify({
      tracks: allTracks,
      cur:    _mpCur,
      cat:    cat || document.getElementById("mp-cat-select")?.value || DEFAULT_MUSIC_CAT,
      modeIdx:_mpModeIdx
    }));
  } catch {}
}

function getMusicTracks(cat){
  return posts.filter(p=>p.tmpl==="music"&&p.ytLink&&
    (cat==="all"||(p.categories||[DEFAULT_MUSIC_CAT]).includes(cat)));
}
function getAllMusicCats(){
  const s=new Set(["all",DEFAULT_MUSIC_CAT]);
  posts.filter(p=>p.tmpl==="music").forEach(p=>(p.categories||[DEFAULT_MUSIC_CAT]).forEach(c=>s.add(c)));
  return[...s];
}

/* ── init ── */
function initMiniPlayer(){
  const sel=document.getElementById("mp-cat-select");
  const selMob=document.getElementById("mp-cat-select-mob");
  if(!sel)return;
  const cats=getAllMusicCats();
  const cur=sel.value||DEFAULT_MUSIC_CAT;
  const html=cats.map(c=>`<option value="${esc(c)}"${c===cur?" selected":""}>${c==="all"?"All":c}</option>`).join("");
  sel.innerHTML=html;
  if(selMob)selMob.innerHTML=html;
  _mpTracks=getMusicTracks(cur);
  if(_mpCur<0&&_mpTracks.length)_mpCur=0;
  mpUpdateBar();
  wpSaveState(cur);
}

/* ── bar text + marquee ── */
let _mpMarqueeRAF=null;
function mpUpdateBar(){
  const text=(_mpCur>=0&&_mpTracks.length)
    ?`${_mpTracks[_mpCur].title||"?"} — ${_mpTracks[_mpCur].artist||""}`
    :"No music";

  // desktop marquee
  const ta=document.getElementById("mp-title-a");
  const tb=document.getElementById("mp-title-b");
  const track=document.getElementById("mp-marquee-track");
  if(ta){ta.textContent=text;}
  if(tb){tb.textContent=text;}
  if(track){
    // only animate if text overflows
    requestAnimationFrame(()=>{
      const outer=track.parentElement;
      if(!outer)return;
      const overflows=track.scrollWidth/2>outer.clientWidth;
      track.style.animation=overflows?"mpScroll 12s linear infinite":"none";
    });
  }
  // mobile popup title
  const pop=document.getElementById("mp-pop-track");
  if(pop)pop.textContent=text;

  // sync mode svg
  const m=MP_MODES[_mpModeIdx];
  ["mp-mode-svg","mp-mode-svg-mob"].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.innerHTML=m.svg;
  });
  // refresh tracklist if open
  if(_tlOpen) mpRenderTracklist();
}

/* ── play/stop ── */
function mpPlay(){
  if(_mpCur<0||!_mpTracks.length)return;
  const ytId=_mpTracks[_mpCur].ytLink?.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1];
  if(!ytId)return;
  const vol=+(document.getElementById("mp-vol")?.value||20);
  const f=document.getElementById("mp-yt-frame");
  f.src=`https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1`;
  _mpPlaying=true;
  mpSyncBtns();
  mpUpdateBar();
  f.onload=()=>mpSendVol(vol);
}
function mpStop(){
  try{document.getElementById("mp-yt-frame").contentWindow
    .postMessage('{"event":"command","func":"pauseVideo","args":""}','*');}catch{}
  document.getElementById("mp-yt-frame").src="";
  _mpPlaying=false;
  mpSyncBtns();
}
function mpSyncBtns(){
  const playSvg  = '<svg class="mp-svg" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>';
  const pauseSvg = '<svg class="mp-svg" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="5" y="3" width="4" height="18" rx="1"/><rect x="15" y="3" width="4" height="18" rx="1"/></svg>';
  ["mp-play-btn","mp-play-btn-mob"].forEach(id=>{
    const b=document.getElementById(id);
    if(b){b.innerHTML=_mpPlaying?pauseSvg:playSvg;}
  });
  const mob=document.getElementById("mp-mob-btn");
  if(mob)mob.classList.toggle("playing",_mpPlaying);
}
function mpSendVol(v){
  try{document.getElementById("mp-yt-frame").contentWindow
    .postMessage(JSON.stringify({event:"command",func:"setVolume",args:[v]}),"*");}catch{}
}

window.mpTogglePlay=()=>_mpPlaying?mpStop():mpPlay();
window.mpSetVol=(v)=>{mpSendVol(v);const m=document.getElementById("mp-vol-mob");if(m)m.value=v;};
window.changeMpCat=(cat)=>{
  _mpTracks=getMusicTracks(cat);_mpCur=_mpTracks.length?0:-1;
  if(_mpPlaying)mpStop();
  mpUpdateBar();
  // sync both selects
  ["mp-cat-select","mp-cat-select-mob"].forEach(id=>{const s=document.getElementById(id);if(s)s.value=cat;});
  if(_tlOpen) mpRenderTracklist();
  wpSaveState(cat);
};
window.mpCycleMode=()=>{
  _mpModeIdx=(_mpModeIdx+1)%MP_MODES.length;
  mpUpdateBar();
};
window.mpNext=()=>{
  if(!_mpTracks.length)return;
  const m=MP_MODES[_mpModeIdx].key;
  if(m==="shuffle")_mpCur=Math.floor(Math.random()*_mpTracks.length);
  else if(m==="one"){} // repeat same
  else _mpCur=(_mpCur+1)%_mpTracks.length;
  if(_mpPlaying)mpPlay();else mpUpdateBar();
};
window.mpPrev=()=>{
  if(!_mpTracks.length)return;
  _mpCur=(_mpCur-1+_mpTracks.length)%_mpTracks.length;
  if(_mpPlaying)mpPlay();else mpUpdateBar();
};

/* ── mobile popup ── */
window.mpTogglePopup=()=>{
  const popup=document.getElementById("mp-mob-popup");
  const overlay=document.getElementById("mp-overlay");
  if(!popup)return;
  const opening=!popup.classList.contains("open");
  popup.classList.toggle("open",opening);
  if(overlay)overlay.classList.toggle("open",opening);
  if(opening){
    // sync selects
    const d=document.getElementById("mp-cat-select");
    const m=document.getElementById("mp-cat-select-mob");
    if(d&&m)m.value=d.value;
    // sync vol
    const vd=document.getElementById("mp-vol");
    const vm=document.getElementById("mp-vol-mob");
    if(vd&&vm)vm.value=vd.value;
  }
};

/* ── Tracklist panel ── */
let _tlOpen = false;
window.mpToggleTracklist = () => {
  _tlOpen = !_tlOpen;
  const panel = document.getElementById("mp-tracklist-panel");
  const btn   = document.getElementById("mp-list-btn");
  if (!panel) return;
  panel.classList.toggle("open", _tlOpen);
  if (btn) btn.classList.toggle("active", _tlOpen);
  if (_tlOpen) mpRenderTracklist();
};

function mpRenderTracklist() {
  const tracks = document.getElementById("mp-tl-tracks");
  const catEl  = document.getElementById("mp-tl-cat");
  const sel    = document.getElementById("mp-cat-select");
  if (!tracks) return;

  const curCat = sel?.value || DEFAULT_MUSIC_CAT;
  if (catEl) catEl.textContent = curCat === "all" ? "All" : curCat;

  if (!_mpTracks.length) {
    tracks.innerHTML = `<div class="mp-tl-empty">No tracks in this category</div>`;
    return;
  }

  const RATING_LABEL = { love:"😍 Love", like:"🙂 Like", rec:"👌 Good", hmm:"🤔 Hmmm", bad:"👎 Bad" };
  const RATING_CLS   = { love:"mp-tl-r-love", like:"mp-tl-r-like", rec:"mp-tl-r-rec", hmm:"mp-tl-r-hmm", bad:"mp-tl-r-bad" };

  tracks.innerHTML = _mpTracks.map((t, i) => {
    const isCur  = i === _mpCur;
    const rLabel = t.rating ? (RATING_LABEL[t.rating] || "") : "";
    const rCls   = t.rating ? (RATING_CLS[t.rating]  || "") : "";
    return `<div class="mp-tl-row${isCur ? " mp-tl-playing" : ""}" onclick="mpJumpTo(${i})">
      <span class="mp-tl-num">${isCur ? "▶" : (i + 1)}</span>
      <div class="mp-tl-info">
        <div class="mp-tl-song">${esc(t.title || "?")}</div>
        <div class="mp-tl-artist">${esc(t.artist || "")}</div>
      </div>
      ${rLabel ? `<span class="mp-tl-rating ${rCls}">${rLabel}</span>` : ""}
    </div>`;
  }).join("");
}

window.mpJumpTo = (idx) => {
  _mpCur = idx;
  mpPlay();
  mpRenderTracklist();
};

/* ── renderApp ── */
function renderApp(){renderNav(getNavPosts());renderTimeline();}
window.__renderApp=renderApp;
(async()=>{await loadPosts();renderApp();initMiniPlayer();})();