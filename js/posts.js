import Storage from "./storage.js";

export let posts = [];

export async function loadPosts() {
  posts = await Storage.load();
}

export async function addPost(en, ko, src, img) {
  const post = {
    id:     Date.now(),
    en,
    ko,
    src,
    img,
    ts:     new Date().toISOString(),
    status: "none"
  };
  posts.unshift(post);
  await Storage.saveOne(post);
  return post;
}

export async function deletePost(id) {
  posts = posts.filter(p => p.id !== id);
  await Storage.deleteOne(id);
}

export async function toggleStatus(id, status) {
  const post = posts.find(p => p.id === id);
  if (!post) return;
  post.status = post.status === status ? "none" : status;
  await Storage.saveOne(post);
}

export function getFilteredPosts(filter) {
  if (filter === "known")   return posts.filter(p => p.status === "known");
  if (filter === "unknown") return posts.filter(p => p.status === "unknown" || p.status === "none");
  return posts;
}

export function fmtTs(iso) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  const hh   = String(d.getHours()).padStart(2, "0");
  const min  = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

export function getDateKey(iso) {
  const d = new Date(iso);
  return { y: d.getFullYear(), m: d.getMonth() + 1, day: d.getDate() };
}

export function esc(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}