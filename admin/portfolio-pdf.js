/* Builds a landscape, black portfolio PDF from the site's current content and downloads it.
   Cover → Contents → About (text, skills, contact) → each visible project (text + cover, then picture pages). */

import { getSite, getProjects, imageUrl } from "../assets/data.js";

const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const W = 792, H = 612, M = 48;            // US Letter landscape, in points
const C = {
  bg: [0, 0, 0], ink: [245, 246, 247], muted: [163, 169, 176],
  line: [52, 56, 60], accent: [224, 52, 79], tile: [22, 24, 26],
};

function loadJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = JSPDF_URL;
    s.onload = () => res(window.jspdf.jsPDF);
    s.onerror = () => rej(new Error("Couldn't load the PDF tool. Check your connection and try again."));
    document.head.appendChild(s);
  });
}

/* ---------- Pictures ---------- */

function imgFromUrl(url) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("image"));
    i.src = url;
  });
}

// Returns { data (JPEG data URL), w, h } or null if the picture can't be read (e.g. a blocked web address).
const picCache = new Map();
function loadPic(ref, maxSide = 2000) {
  if (!ref) return Promise.resolve(null);
  if (!picCache.has(ref)) {
    picCache.set(ref, (async () => {
      try {
        let url = await imageUrl(ref);
        if (!url) return null;
        let revoke = null;
        if (!url.startsWith("data:")) {
          const blob = await (await fetch(url, { mode: "cors" })).blob();
          url = revoke = URL.createObjectURL(blob);
        }
        const img = await imgFromUrl(url);
        const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        if (revoke) URL.revokeObjectURL(revoke);
        return { data: c.toDataURL("image/jpeg", 0.86), w: c.width, h: c.height, canvas: c };
      } catch { return null; }
    })());
  }
  return picCache.get(ref);
}

// Crop a picture to fill a w×h area (used for the cover).
function cropTo(pic, w, h) {
  const ar = w / h, par = pic.w / pic.h;
  let sw = pic.w, sh = pic.h, sx = 0, sy = 0;
  if (par > ar) { sw = pic.h * ar; sx = (pic.w - sw) / 2; } else { sh = pic.w / ar; sy = (pic.h - sh) / 2; }
  const c = document.createElement("canvas");
  c.width = Math.round(Math.min(sw, 2200)); c.height = Math.round(c.width / ar);
  c.getContext("2d").drawImage(pic.canvas, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.86);
}

/* ---------- Text ---------- */

const plain = (s) => String(s || "")
  .replace(/\*\*(.+?)\*\*/g, "$1").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1$2")
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1")
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/→/g, "->");

// Markdown-ish text → list of { text, bullet } paragraphs.
function paragraphs(md) {
  const out = [];
  String(md || "").replace(/\r/g, "").split(/\n\s*\n/).forEach((block) => {
    const lines = block.split("\n").filter((l) => l.trim());
    if (!lines.length) return;
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) lines.forEach((l) => out.push({ text: plain(l.replace(/^\s*[-*•]\s+/, "")), bullet: true }));
    else out.push({ text: plain(lines.join(" ").replace(/^#+\s*/, "")), bullet: false });
  });
  return out;
}

/* ---------- Builder ---------- */

export async function buildPortfolioPdf(onProgress = () => {}) {
  const jsPDF = await loadJsPDF();
  onProgress("Gathering your content…");
  const [site, all] = await Promise.all([getSite(), getProjects()]);
  const projects = all.filter((p) => p.title && !p.hidden).map((p) => {
    const gallery = (p.gallery || []).filter((g) => g && g.image);
    return { ...p, gallery, coverRef: p.cover || gallery[0]?.image || "" };
  });

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter", compress: true });
  const name = site.name || "Portfolio";
  const siteUrl = location.href.replace(/admin\/?(index\.html)?(\?.*)?(#.*)?$/, "");

  const fill = (rgb) => doc.setFillColor(...rgb);
  const color = (rgb) => doc.setTextColor(...rgb);
  const font = (size, style = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); };
  const bgPage = () => { fill(C.bg); doc.rect(0, 0, W, H, "F"); };
  const newPage = () => { doc.addPage("letter", "landscape"); bgPage(); return doc.getNumberOfPages(); };

  const drawContain = (pic, x, y, w, h, align = "center") => {
    const s = Math.min(w / pic.w, h / pic.h);
    const dw = pic.w * s, dh = pic.h * s;
    const dx = x + (w - dw) / 2, dy = align === "top" ? y : y + (h - dh) / 2;
    doc.addImage(pic.data, "JPEG", dx, dy, dw, dh, undefined, "FAST");
    return { dx, dy, dw, dh };
  };
  // "See full website: <link>" with the address clickable. align: "left" | "center".
  const siteShort = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const websiteLine = (x, y, size, align = "left") => {
    const label = "See full website: ";
    font(size); const lw = doc.getTextWidth(label), uw = doc.getTextWidth(siteShort);
    const sx = align === "center" ? x - (lw + uw) / 2 : x;
    color(C.muted); doc.text(label, sx, y);
    color(C.ink); doc.textWithLink(siteShort, sx + lw, y, { url: siteUrl });
    fill(C.muted); doc.rect(sx + lw, y + 1.5, uw, 0.5, "F");
  };
  const missing = (x, y, w, h) => {
    fill(C.tile); doc.rect(x, y, w, h, "F");
    font(9); color(C.muted); doc.text("Picture couldn't be added", x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
  };

  // Flow paragraphs into a column; returns the paragraphs that didn't fit (to continue on another page).
  const flow = (paras, x, y, w, maxY, size = 11) => {
    font(size); color(C.ink);
    const lh = size * 1.45;
    const rest = [...paras];
    while (rest.length) {
      const p = rest[0];
      const indent = p.bullet ? 14 : 0;
      const lines = doc.splitTextToSize(p.text, w - indent);
      const needed = lines.length * lh;
      if (y + needed > maxY) {
        const fit = Math.floor((maxY - y) / lh);
        if (fit < 2) break;
        // split this paragraph across pages
        if (p.bullet) doc.text("•", x, y);
        doc.text(lines.slice(0, fit), x + indent, y, { lineHeightFactor: 1.45 });
        rest[0] = { text: lines.slice(fit).join(" "), bullet: false, cont: true };
        return { y: maxY, rest };
      }
      if (p.bullet) doc.text("•", x, y);
      doc.text(lines, x + indent, y, { lineHeightFactor: 1.45 });
      y += needed + (p.bullet ? 4 : size * 0.7);
      rest.shift();
    }
    return { y, rest };
  };

  const footers = []; // pages that get a footer at the end

  /* Cover */
  onProgress("Making the cover…");
  bgPage();
  const hero = await loadPic(site.hero_image, 2400);
  if (hero) {
    doc.addImage(cropTo(hero, W, H), "JPEG", 0, 0, W, H, undefined, "FAST");
    doc.setGState(new doc.GState({ opacity: 0.55 })); fill(C.bg); doc.rect(0, 0, W, H, "F");
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
  font(54); color(C.ink); doc.text(name, M, H - 170);
  font(20); color(C.ink); doc.text("Engineering Portfolio", M, H - 132);
  fill(C.accent); doc.rect(M, H - 116, 48, 2, "F");
  if (site.tagline) { font(12); color(C.muted); doc.text(doc.splitTextToSize(plain(site.tagline), 460), M, H - 92); }
  websiteLine(M, H - M, 11);
  font(10); color(C.muted);
  doc.text(new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }), W - M, H - M, { align: "right" });

  /* Contents (filled in at the end, once page numbers are known) */
  const contentsPage = newPage(); footers.push(contentsPage);

  /* About */
  onProgress("Adding your About page…");
  const aboutPage = newPage(); footers.push(aboutPage);
  const portrait = await loadPic(site.about_images?.[0]?.image);
  const colW = portrait ? 400 : W - 2 * M;
  font(32); color(C.ink); doc.text("About Me", M, 92);
  let y = 128;
  ({ y } = flow(paragraphs(site.about), M, y, colW, 300, 10.5));
  const skills = (site.skills || []).filter((s) => s.category);
  if (skills.length) {
    y = Math.max(y + 10, 270);
    font(18); color(C.ink); doc.text("Skills", M, y); y += 22;
    skills.forEach((s) => {
      font(10, "bold"); color(C.ink);
      const label = plain(s.category) + ":  ";
      const lw = doc.getTextWidth(label);
      doc.text(label, M, y);
      font(10); const lines = doc.splitTextToSize(plain(s.items), colW - lw);
      doc.text(lines, M + lw, y, { lineHeightFactor: 1.4 });
      y += lines.length * 14 + 6;
    });
  }
  // contact strip
  const contact = [
    site.email && ["Email", site.email, "mailto:" + site.email],
    site.phone && ["Phone", site.phone, "tel:" + site.phone.replace(/[^\d+]/g, "")],
    site.linkedin && ["LinkedIn", site.linkedin.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), site.linkedin],
    ["Website", siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""), siteUrl],
  ].filter(Boolean);
  // contact: two columns, two rows
  fill(C.line); doc.rect(M, H - 128, colW, 0.75, "F");
  const cw = colW / 2;
  contact.forEach(([k, v, href], i) => {
    const cx = M + (i % 2) * cw, cy = H - 108 + Math.floor(i / 2) * 30;
    font(8); color(C.muted); doc.text(k.toUpperCase(), cx, cy);
    font(9.5); color(C.ink);
    doc.textWithLink(doc.splitTextToSize(v, cw - 12)[0], cx, cy + 12, { url: href });
  });
  if (portrait) drawContain(portrait, M + colW + 32, M, W - M - (M + colW + 32), H - 2 * M - 30);

  /* Projects */
  const toc = [["About Me", aboutPage]];
  for (let n = 0; n < projects.length; n++) {
    const p = projects[n];
    onProgress(`Adding project ${n + 1} of ${projects.length}…`);
    const start = newPage(); footers.push(start);
    toc.push([p.title, start]);
    const cover = await loadPic(p.coverRef);
    const textW = cover ? 300 : W - 2 * M;
    font(26); color(C.ink);
    const tl = doc.splitTextToSize(p.title, textW);
    doc.text(tl, M, 84, { lineHeightFactor: 1.15 });
    let ty = 84 + (tl.length - 1) * 30 + 24;
    if (p.dates) { font(11); color(C.muted); doc.text(p.dates, M, ty); ty += 16; }
    fill(C.accent); doc.rect(M, ty, 36, 2, "F");
    let { rest } = flow(paragraphs(p.description), M, ty + 30, textW, H - 70, 10.5);
    if (cover) {
      const capText = p.gallery.find((g) => g.image === p.coverRef)?.caption;
      const box = { x: M + textW + 36, y: M, w: W - M - (M + textW + 36), h: H - 2 * M - (capText ? 46 : 26) };
      const r = drawContain(cover, box.x, box.y, box.w, box.h);
      if (capText) { font(9); color(C.muted); doc.text(doc.splitTextToSize(plain(capText), box.w), r.dx, r.dy + r.dh + 14); }
    } else if (p.coverRef) missing(M + textW + 36, M, W - 2 * M - textW - 36, 300);

    // Description that didn't fit continues on its own page(s)
    while (rest.length) {
      const pg = newPage(); footers.push(pg);
      font(11); color(C.muted); doc.text(`${p.title} (continued)`, M, 64);
      ({ rest } = flow(rest, M, 100, W - 2 * M, H - 70, 10.5));
    }

    // Remaining pictures: 1 big, 2 side by side, or 4 in a grid per page
    const pics = p.gallery.filter((g) => g.image !== p.coverRef);
    for (let i = 0; i < pics.length;) {
      const left = pics.length - i;
      const per = left >= 3 ? 4 : left;
      const batch = pics.slice(i, i + per); i += per;
      const pg = newPage(); footers.push(pg);
      font(11); color(C.muted); doc.text(p.title, M, 64);
      const top = 84, gap = 22, bottom = H - 66;
      const cols = batch.length === 1 ? 1 : 2, rows = batch.length > 2 ? 2 : 1;
      const cellW = (W - 2 * M - (cols - 1) * gap) / cols;
      const cellH = (bottom - top - (rows - 1) * gap) / rows;
      for (let k = 0; k < batch.length; k++) {
        const g = batch[k];
        const x = M + (k % cols) * (cellW + gap), yy = top + Math.floor(k / cols) * (cellH + gap);
        const capH = g.caption ? 16 : 0;
        const pic = await loadPic(g.image);
        if (pic) {
          const r = drawContain(pic, x, yy, cellW, cellH - capH);
          if (g.caption) { font(9); color(C.muted); doc.text(doc.splitTextToSize(plain(g.caption), cellW)[0], r.dx, r.dy + r.dh + 12); }
        } else missing(x, yy, cellW, cellH - capH);
      }
    }
  }

  /* Contents page */
  doc.setPage(contentsPage);
  font(32); color(C.ink); doc.text("Contents", M, 92);
  let ry = 140;
  const rowH = Math.min(30, (H - 90 - ry) / Math.max(toc.length, 1));
  toc.forEach(([t, pg]) => {
    font(13); color(C.ink);
    const label = doc.splitTextToSize(t, W - 2 * M - 80)[0];
    doc.textWithLink(label, M, ry, { pageNumber: pg });
    const lw = doc.getTextWidth(label);
    color(C.muted);
    doc.text(String(pg), W - M, ry, { align: "right" });
    const nw = doc.getTextWidth(String(pg));
    fill(C.line);
    for (let dx = M + lw + 10; dx < W - M - nw - 10; dx += 5) doc.circle(dx, ry - 3.5, 0.6, "F");
    ry += rowH;
  });

  /* Footers */
  footers.forEach((pg) => {
    doc.setPage(pg);
    font(8.5); color(C.muted);
    doc.text(name, M, H - 26);
    doc.text(String(pg), W - M, H - 26, { align: "right" });
    websiteLine(W / 2, H - 26, 8.5, "center");
  });

  onProgress("Saving…");
  const file = `${name.trim().replace(/\s+/g, "-") || "My"}-Portfolio.pdf`;
  doc.save(file);
  return { pages: doc.getNumberOfPages(), file };
}
