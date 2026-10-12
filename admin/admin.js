/* The editor at /admin. Sign in with Google (owner account only), edit, save. */

import {
  configured, app, getSite, getResume, getProjects, isEmpty, hydrateImages, fileUrl,
  uploadImage, uploadFile, deleteRef, cleanup, saveSite, saveResume, saveProject, deleteProject,
  saveOrder, importStarter, slugify, refsIn,
} from "../assets/data.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { OWNER_EMAIL } from "../assets/firebase-config.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o ?? null));
const main = $("#main");

const S = {
  tab: "projects",
  site: null, siteSaved: null,
  resume: null, resumeSaved: null,
  projects: [],
  editing: null, editingSaved: null,
  dirty: false,
  uploads: new Set(), // pictures/files uploaded since the last save (deleted again if discarded)
};

function toast(msg, err = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (err ? " err" : "");
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = "toast"), err ? 6000 : 2600);
}
const fail = (e) => { console.error(e); toast(e?.code === "permission-denied" ? "Save blocked: you're not signed in as the site owner." : (e?.message || "Something went wrong."), true); };

function markDirty() { S.dirty = true; }
window.addEventListener("beforeunload", (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });

async function discardUnsaved() {
  for (const r of S.uploads) await deleteRef(r).catch(() => {});
  S.uploads.clear();
  S.dirty = false;
}
// After a save: drop pictures/files uploaded this session that didn't end up being used.
async function finishSave(saved) {
  const used = refsIn(saved);
  for (const r of S.uploads) if (!used.has(r)) await deleteRef(r).catch(() => {});
  S.uploads.clear(); S.dirty = false;
}

async function leaveOk() {
  if (!S.dirty) return true;
  if (!confirm("You have unsaved changes. Discard them?")) return false;
  await discardUnsaved();
  S.site = clone(S.siteSaved); S.resume = clone(S.resumeSaved);
  return true;
}

// Inputs with data-k="field" write straight into obj.
function bind(root, obj) {
  root.querySelectorAll("[data-k]").forEach((el) => {
    el.addEventListener("input", () => {
      obj[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value;
      markDirty();
    });
  });
}

async function withBusy(btn, label, fn) {
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = label;
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = old; }
}

// Clicking "Editor" (top left) returns to the editor's first screen.
document.querySelector(".mark").addEventListener("click", async (e) => {
  if (!S.site) return; // not signed in yet: normal link
  e.preventDefault();
  if (!(await leaveOk())) return;
  S.editing = null; S.tab = "projects"; render();
  window.scrollTo(0, 0);
});

/* ---------- Gates ---------- */

function gate(html) { main.innerHTML = `<div class="wrap"><div class="panel gate">${html}</div></div>`; }

if (!configured) {
  gate(`<h1>Finish setup</h1><p>Paste your Firebase config into <code>assets/firebase-config.js</code> and publish again. Step 4 of SETUP.md shows how.</p>`);
} else {
  const auth = getAuth(app);
  onAuthStateChanged(auth, async (user) => {
    const acct = $("#account");
    if (!user) {
      acct.innerHTML = `<a href="../index.html">View site</a>`;
      gate(`<h1>Edit your portfolio</h1><p>Sign in with the Google account that owns this site.</p>
        <button class="btn" id="signin" type="button">Sign in with Google</button><p class="err" id="err" role="alert"></p>`);
      $("#signin").onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => {
        if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") $("#err").textContent = e.message;
      });
      return;
    }
    acct.innerHTML = `<span>${esc(user.email)}</span><a href="../index.html" target="_blank" rel="noopener">View site</a><button class="linkbtn" id="out" type="button">Sign out</button>`;
    $("#out").onclick = async () => { if (await leaveOk()) signOut(auth); };
    if (user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      gate(`<h1>Wrong account</h1><p>${esc(user.email)} can't edit this site. Sign out and use ${esc(OWNER_EMAIL)}.</p>`);
      return;
    }
    try {
      if (await isEmpty()) return importGate();
      await loadAll();
      render();
    } catch (e) { fail(e); gate(`<h1>Couldn't load your content</h1><p>${esc(e.message)}</p>`); }
  });
}

function importGate() {
  gate(`<h1>Bring in your content</h1><p>Your editor is connected but empty. This copies your current projects, About page, contact info and resume into it. You only do this once.</p>
    <button class="btn" id="imp" type="button">Import my content</button>`);
  $("#imp").onclick = (e) => withBusy(e.target, "Importing…", async () => {
    await importStarter();
    await loadAll();
    render();
    toast("Content imported");
  }).catch(fail);
}

async function loadAll() {
  const [site, resume, projects] = await Promise.all([getSite(), getResume(), getProjects()]);
  S.site = site; S.siteSaved = clone(site);
  S.resume = resume; S.resumeSaved = clone(resume);
  S.projects = projects;
}

/* ---------- Layout ---------- */

const TABS = [["projects", "Projects"], ["home", "Home & About"], ["contact", "Contact info"], ["resume", "Resume"]];

function render() {
  main.innerHTML = `<div class="wrap">
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${S.tab === k}">${l}</button>`).join("")}</div>
    <div id="view"></div></div>`;
  main.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = async () => {
    if (!(await leaveOk())) return;
    S.editing = null; S.tab = b.dataset.tab; render();
  }));
  const view = $("#view");
  if (S.editing) projectEditor(view);
  else ({ projects: projectsView, home: homeView, contact: contactView, resume: resumeView })[S.tab](view);
  hydrateImages(view);
}

/* ---------- Projects ---------- */

function projectsView(view) {
  const ps = S.projects;
  view.innerHTML = `<div class="bar"><h2>Projects</h2><button class="btn small" id="add" type="button">Add project</button></div>
    <p class="muted" style="margin:-8px 0 18px">Top of the list shows first on the site. The home page shows the top three.</p>
    ${ps.length ? `<ul class="plist">${ps.map((p, i) => {
      const cover = p.cover || p.gallery?.[0]?.image || "";
      return `<li>
        <div class="thumb">${cover ? `<img data-ref="${esc(cover)}" alt="">` : ""}</div>
        <div><strong>${esc(p.title || "Untitled")}${p.hidden ? `<span class="tag">Hidden</span>` : ""}</strong><small>${esc(p.dates || "")}</small></div>
        <div class="row-actions">
          <button class="icon" type="button" data-up="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move ${esc(p.title)} up">↑</button>
          <button class="icon" type="button" data-down="${i}" ${i === ps.length - 1 ? "disabled" : ""} aria-label="Move ${esc(p.title)} down">↓</button>
          <button class="btn small secondary" type="button" data-edit="${i}">Edit</button>
        </div></li>`;
    }).join("")}</ul>` : `<p class="empty">No projects yet. Add your first one.</p>`}`;

  $("#add", view).onclick = () => {
    S.editing = { id: null, title: "", dates: "", summary: "", description: "", gallery: [], cover: "", hidden: false, slug: "",
      order: ps.length ? Math.min(...ps.map((p) => p.order ?? 0)) - 1 : 0 };
    S.editingSaved = clone(S.editing);
    render();
  };
  view.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => {
    S.editing = clone(ps[+b.dataset.edit]);
    S.editing.gallery ||= [];
    S.editingSaved = clone(S.editing);
    render();
  }));
  const move = async (i, j) => {
    [ps[i], ps[j]] = [ps[j], ps[i]];
    ps.forEach((p, n) => (p.order = n));
    render();
    try { await saveOrder(ps.map((p) => p.id)); toast("Order saved"); } catch (e) { fail(e); }
  };
  view.querySelectorAll("[data-up]").forEach((b) => (b.onclick = () => move(+b.dataset.up, +b.dataset.up - 1)));
  view.querySelectorAll("[data-down]").forEach((b) => (b.onclick = () => move(+b.dataset.down, +b.dataset.down + 1)));
}

function projectEditor(view) {
  const p = S.editing, isNew = !p.id;
  view.innerHTML = `<div class="bar"><h2>${isNew ? "New project" : "Edit project"}</h2><button class="linkbtn" id="back" type="button">← Back to projects</button></div>
    <div class="form">
      <div class="field"><label for="f-title">Title</label><input id="f-title" data-k="title" value="${esc(p.title)}"></div>
      <div class="two">
        <div class="field"><label for="f-dates">Dates</label><input id="f-dates" data-k="dates" value="${esc(p.dates)}"><div class="hint">e.g. Sep 2026 – Current</div></div>
        <div class="field"><label for="f-slug">Link name <span class="muted">(optional)</span></label><input id="f-slug" data-k="slug" value="${esc(p.slug)}"><div class="hint">Leave empty to make it from the title.</div></div>
      </div>
      <div class="field"><label for="f-sum">Short summary</label><input id="f-sum" data-k="summary" value="${esc(p.summary)}"><div class="hint">One line shown under the project on the Projects page.</div></div>
      <div class="field"><label for="f-desc">Description</label><textarea id="f-desc" data-k="description">${esc(p.description)}</textarea>
        <div class="hint">Blank line = new paragraph. Start a line with "- " for a bullet. **double stars** for bold.</div></div>
      <div class="field"><span class="label">Pictures</span><div id="pics"></div>
        <div class="hint">The cover shows first on the project page and on its card. Pictures are shrunk to web size when you add them.</div></div>
      <label class="check"><input type="checkbox" data-k="hidden" ${p.hidden ? "checked" : ""}> Hide this project from the site</label>
      <div class="form-actions">
        <button class="btn" id="save" type="button">${isNew ? "Publish project" : "Save changes"}</button>
        <button class="btn secondary" id="cancel" type="button">Cancel</button>
        <span class="spacer"></span>
        ${isNew ? "" : `<button class="btn danger" id="del" type="button">Delete project</button>`}
      </div>
    </div>`;
  bind(view, p);
  mountPics($("#pics", view), p.gallery, { get: () => p.cover, set: (r) => { p.cover = r; } });

  const back = async () => { if (await leaveOk()) { S.editing = null; render(); } };
  $("#back", view).onclick = back;
  $("#cancel", view).onclick = back;

  $("#save", view).onclick = (e) => {
    if (!p.title.trim()) { toast("Give the project a title first.", true); $("#f-title").focus(); return; }
    withBusy(e.target, "Saving…", async () => {
      p.title = p.title.trim();
      p.slug = slugify(p.slug) || slugify(p.title);
      const id = await saveProject(p);
      await cleanup(S.editingSaved, p);
      await finishSave(p);
      S.projects = await getProjects();
      S.editing = null;
      render();
      toast(isNew ? "Project published" : "Project saved");
      return id;
    }).catch(fail);
  };
  const del = $("#del", view);
  if (del) del.onclick = (e) => {
    if (!confirm(`Delete "${p.title}"? This removes it and its pictures for good.`)) return;
    withBusy(e.target, "Deleting…", async () => {
      await deleteProject(p.id);
      await cleanup(S.editingSaved, {});
      await discardUnsaved();
      S.projects = await getProjects();
      S.editing = null;
      render();
      toast("Project deleted");
    }).catch(fail);
  };
}

/* ---------- Picture editors ---------- */

// A list of {image, caption}. With `cover`, one picture can be marked as the cover.
function mountPics(host, list, cover, opts = {}) {
  const draw = () => {
    const coverRef = cover?.get() || "";
    const isCover = (g, i) => (coverRef ? g.image === coverRef : i === 0);
    host.innerHTML = `<div class="pics">${list.map((g, i) => `
      <div class="pic">
        <div class="img"><img data-ref="${esc(g.image)}" alt="">${cover && isCover(g, i) ? `<span class="badge">Cover</span>` : ""}</div>
        ${opts.noCaptions ? "" : `<input data-cap="${i}" value="${esc(g.caption)}" placeholder="Caption (optional)" aria-label="Caption for picture ${i + 1}">`}
        <div class="tools">
          <button class="icon" type="button" data-l="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move picture ${i + 1} earlier">←</button>
          <button class="icon" type="button" data-r="${i}" ${i === list.length - 1 ? "disabled" : ""} aria-label="Move picture ${i + 1} later">→</button>
          <span class="grow"></span>
          ${cover && !isCover(g, i) ? `<button class="textbtn" type="button" data-cover="${i}">Make cover</button>` : ""}
          <button class="textbtn" type="button" data-rm="${i}">Remove</button>
        </div>
      </div>`).join("")}
      <label class="adder"><input type="file" accept="image/*" multiple><span>Add pictures</span><small>Click or drop files here</small></label>
    </div>`;
    hydrateImages(host);

    host.querySelectorAll("[data-cap]").forEach((el) => (el.oninput = () => { list[+el.dataset.cap].caption = el.value; markDirty(); }));
    const swap = (i, j) => { [list[i], list[j]] = [list[j], list[i]]; markDirty(); draw(); };
    host.querySelectorAll("[data-l]").forEach((b) => (b.onclick = () => swap(+b.dataset.l, +b.dataset.l - 1)));
    host.querySelectorAll("[data-r]").forEach((b) => (b.onclick = () => swap(+b.dataset.r, +b.dataset.r + 1)));
    host.querySelectorAll("[data-cover]").forEach((b) => (b.onclick = () => { cover.set(list[+b.dataset.cover].image); markDirty(); draw(); }));
    host.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => {
      const [g] = list.splice(+b.dataset.rm, 1);
      if (cover && cover.get() === g.image) cover.set("");
      markDirty(); draw();
    }));

    const adder = $(".adder", host), input = $("input[type=file]", adder), label = $("span", adder);
    const add = async (files) => {
      files = [...files].filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      for (let n = 0; n < files.length; n++) {
        label.textContent = `Adding ${n + 1} of ${files.length}…`;
        try {
          const ref = await uploadImage(files[n]);
          S.uploads.add(ref);
          list.push(opts.noCaptions ? { image: ref } : { image: ref, caption: "" });
          markDirty();
        } catch (e) { fail(e); }
      }
      draw();
    };
    input.onchange = () => add(input.files);
    adder.ondragover = (e) => { e.preventDefault(); adder.classList.add("drag"); };
    adder.ondragleave = () => adder.classList.remove("drag");
    adder.ondrop = (e) => { e.preventDefault(); adder.classList.remove("drag"); add(e.dataTransfer.files); };
  };
  draw();
}

// One picture field (e.g. the home page photo).
function mountSingle(host, obj, key) {
  const draw = () => {
    const ref = obj[key];
    host.innerHTML = `<div class="single">
      <div class="preview">${ref ? `<img data-ref="${esc(ref)}" alt="">` : ""}</div>
      <span class="btn small secondary filebtn">${ref ? "Replace picture" : "Add picture"}<input type="file" accept="image/*" aria-label="Choose picture"></span>
      ${ref ? `<button class="linkbtn" type="button">Remove</button>` : ""}
    </div>`;
    hydrateImages(host);
    const input = $("input", host);
    input.onchange = async () => {
      const f = input.files[0]; if (!f) return;
      $(".filebtn", host).firstChild.textContent = "Adding…";
      try { const r = await uploadImage(f); S.uploads.add(r); obj[key] = r; markDirty(); } catch (e) { fail(e); }
      draw();
    };
    const rm = $(".linkbtn", host);
    if (rm) rm.onclick = () => { obj[key] = ""; markDirty(); draw(); };
  };
  draw();
}

/* ---------- Site pages ---------- */

async function saveSiteNow(btn) {
  await withBusy(btn, "Saving…", async () => {
    S.site.skills = (S.site.skills || []).filter((s) => s.category?.trim() || s.items?.trim());
    await saveSite(S.site);
    await cleanup(S.siteSaved, S.site);
    await finishSave(S.site);
    S.siteSaved = clone(S.site);
    toast("Saved");
    render();
  }).catch(fail);
}

function homeView(view) {
  const s = S.site;
  s.about_images ||= []; s.skills ||= [];
  view.innerHTML = `<div class="form">
    <div class="two">
      <div class="field"><label for="h-name">Your name</label><input id="h-name" data-k="name" value="${esc(s.name)}"></div>
      <div class="field"><label for="h-ini">Logo initials</label><input id="h-ini" data-k="initials" value="${esc(s.initials)}"><div class="hint">Shown top left of every page.</div></div>
    </div>
    <div class="field"><label for="h-tag">Home page intro line</label><input id="h-tag" data-k="tagline" value="${esc(s.tagline)}"></div>
    <div class="field"><span class="label">Home page photo</span><div id="hero"></div></div>
    <div class="field"><label for="h-about">About me</label><textarea id="h-about" data-k="about">${esc(s.about)}</textarea>
      <div class="hint">Blank line = new paragraph. "- " for bullets. **double stars** for bold.</div></div>
    <div class="field"><span class="label">About page photos</span><div id="aboutpics"></div>
      <div class="hint">The first photo goes next to your About text, the second next to Skills. Any more show below.</div></div>
    <div class="field"><span class="label">Skills</span><div id="skills"></div></div>
    <div class="form-actions"><button class="btn" id="save" type="button">Save changes</button></div>
  </div>`;
  bind(view, s);
  mountSingle($("#hero", view), s, "hero_image");
  mountPics($("#aboutpics", view), s.about_images, null, { noCaptions: true });
  mountSkills($("#skills", view), s.skills);
  $("#save", view).onclick = (e) => saveSiteNow(e.target);
}

function mountSkills(host, list) {
  const draw = () => {
    host.innerHTML = `<div class="skills-ed">${list.map((k, i) => `<div class="srow">
        <input data-c="${i}" value="${esc(k.category)}" placeholder="Category, e.g. Software" aria-label="Skill category ${i + 1}">
        <input data-it="${i}" value="${esc(k.items)}" placeholder="Skills, separated by commas" aria-label="Skills in group ${i + 1}">
        <div class="row-actions">
          <button class="icon" type="button" data-u="${i}" ${i === 0 ? "disabled" : ""} aria-label="Move group up">↑</button>
          <button class="icon" type="button" data-x="${i}" aria-label="Remove group">✕</button>
        </div></div>`).join("")}
      <div><button class="btn small secondary" type="button" id="addskill">Add skill group</button></div></div>`;
    host.querySelectorAll("[data-c]").forEach((el) => (el.oninput = () => { list[+el.dataset.c].category = el.value; markDirty(); }));
    host.querySelectorAll("[data-it]").forEach((el) => (el.oninput = () => { list[+el.dataset.it].items = el.value; markDirty(); }));
    host.querySelectorAll("[data-u]").forEach((b) => (b.onclick = () => { const i = +b.dataset.u; [list[i - 1], list[i]] = [list[i], list[i - 1]]; markDirty(); draw(); }));
    host.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => { list.splice(+b.dataset.x, 1); markDirty(); draw(); }));
    $("#addskill", host).onclick = () => { list.push({ category: "", items: "" }); draw(); host.querySelector(`[data-c="${list.length - 1}"]`).focus(); };
  };
  draw();
}

function contactView(view) {
  const s = S.site;
  view.innerHTML = `<div class="form">
    <div class="two">
      <div class="field"><label for="c-em">Preferred email</label><input id="c-em" type="email" data-k="email" value="${esc(s.email)}"></div>
      <div class="field"><label for="c-se">Student email</label><input id="c-se" type="email" data-k="student_email" value="${esc(s.student_email)}"></div>
      <div class="field"><label for="c-ph">Phone</label><input id="c-ph" data-k="phone" value="${esc(s.phone)}"></div>
      <div class="field"><label for="c-li">LinkedIn URL</label><input id="c-li" data-k="linkedin" value="${esc(s.linkedin)}"></div>
    </div>
    <div class="field"><label for="c-fe">Contact form sends to</label><input id="c-fe" type="email" data-k="form_email" value="${esc(s.form_email)}">
      <div class="hint">Messages from the Contact page form are emailed here. If you change it, send yourself a test message to activate the new address.</div></div>
    <p class="muted" style="margin:0">Leave a field empty to hide it from the site.</p>
    <div class="form-actions"><button class="btn" id="save" type="button">Save changes</button></div>
  </div>`;
  bind(view, s);
  $("#save", view).onclick = (e) => saveSiteNow(e.target);
}

function resumeView(view) {
  const r = S.resume;
  view.innerHTML = `<div class="form">
    <div class="field"><span class="label">Resume PDF</span>
      <div class="pdfbox">
        <div><div class="name">${r.pdf ? (S.uploads.has(r.pdf) ? "New PDF ready — save to publish it" : "Resume PDF is on your site") : "No PDF uploaded yet"}</div>
          <div class="muted" style="font-size:14px">${r.pdf ? "Visitors can view and download it." : "Until you add one, the Resume page shows the picture below."}</div></div>
        <span class="spacer" style="flex:1"></span>
        ${r.pdf ? `<button class="btn small secondary" id="view" type="button">View</button>` : ""}
        <span class="btn small filebtn">${r.pdf ? "Upload new PDF" : "Upload PDF"}<input type="file" accept="application/pdf" aria-label="Choose resume PDF"></span>
      </div></div>
    <div class="field"><label for="r-up">Last updated</label><input id="r-up" data-k="updated" value="${esc(r.updated)}"><div class="hint">Shown on the Resume page, e.g. October 2026.</div></div>
    <div class="field"><span class="label">Fallback picture</span><div id="rimg"></div><div class="hint">Only shown when there's no PDF.</div></div>
    <div class="form-actions"><button class="btn" id="save" type="button">Save changes</button></div>
  </div>`;
  bind(view, r);
  mountSingle($("#rimg", view), r, "image");
  const v = $("#view", view);
  if (v) v.onclick = (e) => withBusy(e.target, "Opening…", async () => { const u = await fileUrl(r.pdf); if (u) window.open(u, "_blank"); }).catch(fail);
  const input = $(".filebtn input", view);
  input.onchange = () => {
    const f = input.files[0]; if (!f) return;
    if (f.type && f.type !== "application/pdf") { toast("Choose a PDF file.", true); return; }
    $(".filebtn", view).firstChild.textContent = "Uploading…";
    input.disabled = true;
    (async () => {
      try {
        const ref = await uploadFile(f);
        S.uploads.add(ref); r.pdf = ref; markDirty();
        r.updated = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
      } catch (e) { fail(e); }
      render();
    })();
  };
  $("#save", view).onclick = (e) => withBusy(e.target, "Saving…", async () => {
    await saveResume(r);
    await cleanup(S.resumeSaved, r);
    await finishSave(r);
    S.resumeSaved = clone(r);
    toast("Saved");
    render();
  }).catch(fail);
}
