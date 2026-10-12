/* Data layer: everything the site shows lives in Firebase (Firestore).
   Pictures and PDFs are stored inside the database too (no paid file storage needed):
   pictures are shrunk to web size; PDFs are split into pieces. */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const configured = !String(firebaseConfig.apiKey || "").includes("PASTE");
export const app = configured ? initializeApp(firebaseConfig) : null;
export const db = configured ? getFirestore(app) : null;

// Visitor stats (Firebase console → Analytics). Public pages only, so your own editing isn't counted.
const mid = String(firebaseConfig.measurementId || "");
if (configured && mid.startsWith("G-") && !location.pathname.includes("/admin")) {
  import("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js")
    .then(({ getAnalytics }) => getAnalytics(app))
    .catch(() => {});
}

const seedUrl = (name) => new URL(`../content/${name}.json`, import.meta.url);
async function seed(name) {
  const r = await fetch(seedUrl(name), { cache: "no-cache" });
  if (!r.ok) throw new Error(`Couldn't load starter content (${name})`);
  return r.json();
}

export const slugify = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- Reading ---------- */

// Has the starter content been imported into Firebase yet?
export async function isEmpty() {
  if (!configured) return true;
  return !(await getDoc(doc(db, "site", "main"))).exists();
}

export async function getSite() {
  if (configured) {
    const s = await getDoc(doc(db, "site", "main"));
    if (s.exists()) return s.data();
  }
  return seed("site");
}

export async function getResume() {
  if (configured) {
    const s = await getDoc(doc(db, "site", "resume"));
    if (s.exists()) return s.data();
  }
  return seed("resume");
}

// All projects in display order (including hidden ones; callers filter).
export async function getProjects() {
  if (configured && !(await isEmpty())) {
    const snap = await getDocs(collection(db, "projects"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  const data = await seed("projects");
  return (data.projects || []).map((p, i) => ({ id: p.slug || slugify(p.title), order: i, ...p }));
}

/* Picture references: "img:<id>" = stored in Firebase, anything else = a normal web address. */
const imgCache = new Map();
export function imageUrl(ref) {
  if (!ref) return Promise.resolve("");
  if (!String(ref).startsWith("img:")) return Promise.resolve(ref);
  if (!imgCache.has(ref)) {
    imgCache.set(ref, getDoc(doc(db, "images", ref.slice(4))).then((s) => (s.exists() ? s.data().data : "")));
  }
  return imgCache.get(ref);
}

// Fill in every <img data-ref="..."> inside root.
export function hydrateImages(root = document) {
  root.querySelectorAll("img[data-ref]").forEach(async (img) => {
    const ref = img.dataset.ref;
    img.removeAttribute("data-ref");
    const url = await imageUrl(ref).catch(() => "");
    if (url) img.src = url;
  });
}

// PDF references: "file:<id>" = stored in Firebase in pieces. Returns a blob: URL.
export async function fileUrl(ref) {
  if (!ref) return "";
  if (!String(ref).startsWith("file:")) return ref;
  const id = ref.slice(5);
  const meta = await getDoc(doc(db, "files", id));
  if (!meta.exists()) return "";
  const { chunks, type } = meta.data();
  const parts = await Promise.all(
    Array.from({ length: chunks }, (_, i) => getDoc(doc(db, "files", id, "chunks", String(i))).then((s) => s.data().d)));
  const bin = atob(parts.join(""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: type || "application/pdf" }));
}

/* ---------- Writing (only works when signed in as the owner) ---------- */

const MAX_IMAGE_CHARS = 900_000; // Firestore documents max out at 1 MB

function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(`${file.name} isn't a picture this browser can read.`)); };
    img.src = url;
  });
}

// Shrink to web size and store. Returns "img:<id>".
export async function uploadImage(file) {
  const img = await loadImage(file);
  let maxSide = 1800, quality = 0.85, data = "";
  for (let tries = 0; tries < 8; tries++) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // transparent PNGs get a white background
    ctx.drawImage(img, 0, 0, w, h);
    data = c.toDataURL("image/jpeg", quality);
    if (data.length <= MAX_IMAGE_CHARS) break;
    if (quality > 0.65) quality -= 0.1; else maxSide = Math.round(maxSide * 0.8);
  }
  if (data.length > MAX_IMAGE_CHARS) throw new Error(`${file.name} is too large to store.`);
  const id = newId();
  await setDoc(doc(db, "images", id), { data, name: file.name, created: Date.now() });
  return "img:" + id;
}

const CHUNK = 800_000;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;

// Store a PDF in pieces. Returns "file:<id>".
export async function uploadFile(file) {
  if (file.size > MAX_PDF_BYTES) throw new Error("That PDF is over 10 MB. Export a smaller one and try again.");
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  const parts = [];
  for (let i = 0; i < b64.length; i += CHUNK) parts.push(b64.slice(i, i + CHUNK));
  const id = newId();
  // Pieces first, then the record that points at them.
  for (let i = 0; i < parts.length; i++) await setDoc(doc(db, "files", id, "chunks", String(i)), { d: parts[i] });
  await setDoc(doc(db, "files", id), { name: file.name, type: file.type || "application/pdf", size: file.size, chunks: parts.length, created: Date.now() });
  return "file:" + id;
}

export async function deleteRef(ref) {
  if (!ref) return;
  if (ref.startsWith("img:")) {
    imgCache.delete(ref);
    await deleteDoc(doc(db, "images", ref.slice(4)));
  } else if (ref.startsWith("file:")) {
    const id = ref.slice(5);
    const meta = await getDoc(doc(db, "files", id));
    const n = meta.exists() ? meta.data().chunks : 0;
    for (let i = 0; i < n; i++) await deleteDoc(doc(db, "files", id, "chunks", String(i)));
    await deleteDoc(doc(db, "files", id));
  }
}

// Every stored picture/file referenced anywhere inside an object.
export function refsIn(obj, out = new Set()) {
  if (typeof obj === "string") { if (/^(img|file):/.test(obj)) out.add(obj); }
  else if (Array.isArray(obj)) obj.forEach((v) => refsIn(v, out));
  else if (obj && typeof obj === "object") Object.values(obj).forEach((v) => refsIn(v, out));
  return out;
}
// Delete stored pictures/files that were in `before` but not in `after`.
export async function cleanup(before, after) {
  const keep = refsIn(after);
  for (const r of refsIn(before)) if (!keep.has(r)) await deleteRef(r).catch(() => {});
}

export const saveSite = (data) => setDoc(doc(db, "site", "main"), data);
export const saveResume = (data) => setDoc(doc(db, "site", "resume"), data);

export async function saveProject(p) {
  const { id, ...data } = p;
  const pid = id || newId();
  await setDoc(doc(db, "projects", pid), data);
  return pid;
}
export const deleteProject = (id) => deleteDoc(doc(db, "projects", id));

export async function saveOrder(ids) {
  const b = writeBatch(db);
  ids.forEach((id, i) => b.update(doc(db, "projects", id), { order: i }));
  await b.commit();
}

// One-time: copy the starter content (from the old site) into Firebase.
export async function importStarter() {
  const [site, resume, projects] = await Promise.all([seed("site"), seed("resume"), seed("projects")]);
  const b = writeBatch(db);
  b.set(doc(db, "site", "main"), site);
  b.set(doc(db, "site", "resume"), resume);
  (projects.projects || []).forEach((p, i) => b.set(doc(db, "projects", newId() + i), { ...p, order: i }));
  await b.commit();
}
