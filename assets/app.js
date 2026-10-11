/* Portfolio site — renders every page from the files in /content.
   You normally never need to edit this file: change content in /admin instead. */

const NAV = [
  ["index.html", "Home"],
  ["about.html", "About"],
  ["projects.html", "Projects"],
  ["resume.html", "Resume"],
  ["contact.html", "Contact"],
];

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* Small markdown renderer: paragraphs, bullet/numbered lists, ### headings, **bold**, *italic*, [links](url). */
function md(text) {
  const inline = (s) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const blocks = String(text || "").replace(/\r/g, "").split(/\n\s*\n/);
  return blocks
    .map((b) => {
      const lines = b.split("\n").filter((l) => l.trim());
      if (!lines.length) return "";
      if (lines.every((l) => /^\s*[-*•]\s+/.test(l)))
        return "<ul>" + lines.map((l) => "<li>" + inline(l.replace(/^\s*[-*•]\s+/, "")) + "</li>").join("") + "</ul>";
      if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l)))
        return "<ol>" + lines.map((l) => "<li>" + inline(l.replace(/^\s*\d+[.)]\s+/, "")) + "</li>").join("") + "</ol>";
      const h = lines[0].match(/^(#{1,4})\s+(.*)/);
      if (h && lines.length === 1) return `<h3>${inline(h[2])}</h3>`;
      return "<p>" + lines.map(inline).join("<br>") + "</p>";
    })
    .join("");
}

const slugify = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const telHref = (p) => "tel:" + String(p || "").replace(/[^\d+]/g, "");

async function load(name) {
  const res = await fetch(`content/${name}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Couldn't load content/${name}.json`);
  return res.json();
}

function projectList(data) {
  return (data.projects || [])
    .filter((p) => p && p.title && !p.hidden)
    .map((p) => {
      const gallery = (p.gallery || []).filter((g) => g && g.image);
      return { ...p, slug: p.slug || slugify(p.title), gallery, coverImg: p.cover || (gallery[0] && gallery[0].image) || "" };
    });
}

function card(p) {
  return `<a class="card" href="project.html?p=${encodeURIComponent(p.slug)}">
    <div class="thumb">${p.coverImg ? `<img src="${esc(p.coverImg)}" alt="" loading="lazy">` : ""}</div>
    <h3>${esc(p.title)}</h3>
    ${p.dates ? `<div class="dates">${esc(p.dates)}</div>` : ""}
    ${p.summary ? `<p>${esc(p.summary)}</p>` : ""}
  </a>`;
}

function chrome(site) {
  const page = document.body.dataset.page;
  const current = { home: "index.html", project: "projects.html" }[page] || page + ".html";
  const initials = esc(site.initials || "");
  $("#header").innerHTML = `<div class="wrap">
      <a class="mark" href="index.html">${initials}<span>.</span></a>
      <nav class="nav" aria-label="Main">${NAV.map(([href, label]) =>
        `<a href="${href}"${href === current ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
    </div>`;
  const items = [
    site.email && `<li><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>`,
    site.student_email && `<li><a href="mailto:${esc(site.student_email)}">${esc(site.student_email)}</a></li>`,
    site.phone && `<li><a href="${telHref(site.phone)}">${esc(site.phone)}</a></li>`,
    site.linkedin && `<li><a href="${esc(site.linkedin)}" target="_blank" rel="noopener">LinkedIn</a></li>`,
  ].filter(Boolean).join("");
  $("#footer").innerHTML = `<div class="wrap">
      <div><div class="who">${esc(site.name)}</div><small>© ${new Date().getFullYear()} ${esc(site.name)}</small></div>
      <ul>${items}</ul>
    </div>`;
}

/* ---------- Pages ---------- */

const pages = {
  async home(site) {
    const projects = projectList(await load("projects")).slice(0, 3);
    const hero = site.hero_image
      ? `<section class="hero"><img src="${esc(site.hero_image)}" alt="">
           <div class="hero-text"><div class="wrap"><h1>${esc(site.name)}</h1>${site.tagline ? `<p>${esc(site.tagline)}</p>` : ""}</div></div></section>`
      : `<section class="hero no-image"><div class="hero-text"><div class="wrap"><h1>${esc(site.name)}</h1><p>${esc(site.tagline)}</p></div></div></section>`;
    $("#main").innerHTML = `${hero}
      <div class="wrap">
        <div class="section-head"><h2>Recent projects</h2><a class="textlink" href="projects.html">All projects</a></div>
        <div class="grid">${projects.map(card).join("") || `<p class="empty">No projects yet.</p>`}</div>
      </div>`;
  },

  async projects() {
    const projects = projectList(await load("projects"));
    document.title = "Projects | " + document.title.split("|").pop().trim();
    $("#main").innerHTML = `<div class="wrap">
        <h1 class="page-title">Projects</h1>
        <p class="lede">Click a project for photos and details.</p>
        <div class="grid">${projects.map(card).join("") || `<p class="empty">No projects yet. Add one from the admin page.</p>`}</div>
      </div>`;
  },

  async project(site) {
    const projects = projectList(await load("projects"));
    const slug = new URLSearchParams(location.search).get("p");
    const i = projects.findIndex((p) => p.slug === slug);
    if (i < 0) {
      $("#main").innerHTML = `<div class="wrap"><h1 class="page-title">Project not found</h1>
        <p class="lede">This project may have been renamed or hidden. <a class="textlink" href="projects.html">See all projects</a></p></div>`;
      return;
    }
    const p = projects[i];
    document.title = `${p.title} | ${site.name}`;
    // Cover shows first; the rest of the gallery follows (cover isn't repeated).
    const coverCaption = (p.gallery.find((g) => g.image === p.coverImg) || {}).caption || "";
    const rest = p.gallery.filter((g) => g.image !== p.coverImg);
    const prev = projects[i - 1], next = projects[i + 1];
    $("#main").innerHTML = `<div class="wrap">
        <a class="back" href="projects.html">← All projects</a>
        <header class="project-head"><h1>${esc(p.title)}</h1>${p.dates ? `<div class="dates">${esc(p.dates)}</div>` : ""}</header>
        ${p.coverImg ? `<figure class="cover-figure"><img src="${esc(p.coverImg)}" alt="${esc(coverCaption || p.title)}">${coverCaption ? `<figcaption>${esc(coverCaption)}</figcaption>` : ""}</figure>` : ""}
        <div class="prose">${md(p.description)}</div>
        ${rest.length ? `<div class="gallery">${rest.map((g, n) => `<figure>
            <button type="button" data-n="${n}" aria-label="Enlarge image${g.caption ? ": " + esc(g.caption) : ""}"><img src="${esc(g.image)}" alt="${esc(g.caption)}" loading="lazy"></button>
            ${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ""}</figure>`).join("")}</div>` : ""}
        <nav class="pager" aria-label="More projects">
          ${prev ? `<a class="prev" href="project.html?p=${encodeURIComponent(prev.slug)}"><small>Previous project</small><strong>${esc(prev.title)}</strong></a>` : ""}
          ${next ? `<a class="next" href="project.html?p=${encodeURIComponent(next.slug)}"><small>Next project</small><strong>${esc(next.title)}</strong></a>` : ""}
        </nav>
      </div>
      <dialog class="lightbox" id="lb"><button class="lb-close" type="button">Close</button><img alt=""><p></p></dialog>`;
    const lb = $("#lb");
    document.querySelectorAll(".gallery button").forEach((b) =>
      b.addEventListener("click", () => {
        const g = rest[+b.dataset.n];
        lb.querySelector("img").src = g.image;
        lb.querySelector("img").alt = g.caption || "";
        lb.querySelector("p").textContent = g.caption || "";
        lb.showModal();
      }));
    lb.querySelector(".lb-close").addEventListener("click", () => lb.close());
    lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
  },

  async about(site) {
    document.title = `About | ${site.name}`;
    const photos = (site.about_images || []).filter((x) => x && x.image);
    const skills = (site.skills || []).filter((s) => s && s.category);
    $("#main").innerHTML = `<div class="wrap">
        <h1 class="page-title">About me</h1>
        <div class="about" style="margin-top:32px">
          <div class="prose">${md(site.about)}</div>
          ${photos.length ? `<div class="about-photos">${photos.map((x) => `<figure><img src="${esc(x.image)}" alt="${esc(x.caption)}">${x.caption ? `<figcaption>${esc(x.caption)}</figcaption>` : ""}</figure>`).join("")}</div>` : "<div></div>"}
        </div>
        ${skills.length ? `<div class="section-head"><h2>Skills</h2></div>
          <dl class="skills">${skills.map((s) => `<dt>${esc(s.category)}</dt><dd>${esc(s.items)}</dd>`).join("")}</dl>` : ""}
      </div>`;
  },

  async resume(site) {
    document.title = `Resume | ${site.name}`;
    const r = await load("resume");
    let body;
    if (r.pdf) {
      body = `<div class="actions">
          <a class="btn" href="${esc(r.pdf)}" download>Download PDF</a>
          <a class="btn secondary" href="${esc(r.pdf)}" target="_blank" rel="noopener">Open in new tab</a>
        </div>
        <iframe class="resume-frame" src="${esc(r.pdf)}#view=FitH" title="Resume"></iframe>`;
    } else if (r.image) {
      body = `<div class="resume-image"><img src="${esc(r.image)}" alt="Resume of ${esc(site.name)}"></div>`;
    } else {
      body = `<p class="empty">Resume coming soon.</p>`;
    }
    $("#main").innerHTML = `<div class="wrap">
        <h1 class="page-title">Resume</h1>
        <p class="lede">${r.updated ? "Last updated " + esc(r.updated) + "." : ""}</p>
        ${body}
      </div>`;
  },

  async contact(site) {
    document.title = `Contact | ${site.name}`;
    $("#main").innerHTML = `<div class="wrap">
        <h1 class="page-title">Contact</h1>
        <p class="lede">Send a message here and it goes straight to my inbox, or reach me directly.</p>
        <div class="contact">
          <form id="cf" novalidate>
            <div class="row">
              <label>First name<input name="first_name" autocomplete="given-name" required></label>
              <label>Last name<input name="last_name" autocomplete="family-name" required></label>
            </div>
            <div class="row">
              <label>Email<input name="email" type="email" autocomplete="email" required></label>
              <label>Phone <span>(optional)</span><input name="phone" type="tel" autocomplete="tel"></label>
            </div>
            <label>Message<textarea name="message" required></textarea></label>
            <input type="text" name="_honey" style="display:none" tabindex="-1" autocomplete="off">
            <button class="btn" type="submit">Send message</button>
            <div class="form-status" role="status" aria-live="polite"></div>
          </form>
          <aside class="direct">
            <h2>Reach me directly</h2>
            <dl>
              ${site.email ? `<dt>Preferred email</dt><dd><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></dd>` : ""}
              ${site.student_email ? `<dt>Student email</dt><dd><a href="mailto:${esc(site.student_email)}">${esc(site.student_email)}</a></dd>` : ""}
              ${site.phone ? `<dt>Phone</dt><dd><a href="${telHref(site.phone)}">${esc(site.phone)}</a></dd>` : ""}
              ${site.linkedin ? `<dt>LinkedIn</dt><dd><a href="${esc(site.linkedin)}" target="_blank" rel="noopener">View profile</a></dd>` : ""}
            </dl>
          </aside>
        </div>
      </div>`;
    const form = $("#cf"), status = form.querySelector(".form-status"), btn = form.querySelector("button");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.className = "form-status";
      const missing = [...form.querySelectorAll("[required]")].find((el) => !el.value.trim());
      if (missing) { status.textContent = "Fill in your name, email and a message."; status.classList.add("err"); missing.focus(); return; }
      if (!form.email.checkValidity()) { status.textContent = "Check the email address."; status.classList.add("err"); form.email.focus(); return; }
      btn.disabled = true; btn.textContent = "Sending…";
      const data = Object.fromEntries(new FormData(form));
      data._subject = `Portfolio message from ${data.first_name} ${data.last_name}`;
      data._template = "table";
      try {
        const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(site.form_email || site.email)}`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || String(out.success) === "false") throw new Error(out.message || "send failed");
        form.reset();
        status.textContent = "Message sent. Thanks — I'll get back to you soon.";
        status.classList.add("ok");
      } catch {
        status.textContent = `Message didn't send. Email me at ${site.email} instead.`;
        status.classList.add("err");
      } finally {
        btn.disabled = false; btn.textContent = "Send message";
      }
    });
  },
};

(async function init() {
  try {
    const site = await load("site");
    chrome(site);
    await pages[document.body.dataset.page](site);
  } catch (err) {
    $("#main").innerHTML = `<div class="wrap"><p class="empty">${esc(err.message)}</p></div>`;
    console.error(err);
  }
})();
