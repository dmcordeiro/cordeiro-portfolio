# Your portfolio site — setup and editing

Free hosting on GitHub Pages, no ads or watermark. You edit everything at **yoursite/admin** with forms — no code.

## One-time setup (about 15 minutes)

Your GitHub account is **dmcordeiro**, and the repository is **cordeiro-portfolio**, so your site will be **https://dmcordeiro.github.io/cordeiro-portfolio**. The settings file already has this filled in.

### 1. Create the repository
1. Sign in to github.com, click **+** (top right) → **New repository**.
2. Make sure **Owner** shows `dmcordeiro`, and name it exactly **cordeiro-portfolio**.
3. Set it to **Public**, then click **Create repository**.

### 2. Upload the files
1. On the new repository page, click **uploading an existing file**.
2. Unzip the folder you got from Claude, open it, select **everything inside** (not the folder itself) and drag it in.
   - On a Mac, press Cmd+Shift+. in Finder first so the hidden `.nojekyll` file shows, and include it.
3. Click **Commit changes**.

### 3. Turn on the site
1. In the repository, go to **Settings → Pages**.
2. Under **Branch**, pick **main** and **/ (root)**, then **Save**.
3. Wait 1–2 minutes. Your site is live at **https://dmcordeiro.github.io/cordeiro-portfolio**.

### 4. Make your editor key (token)
1. Go to github.com/settings/personal-access-tokens → **Generate new token** (fine-grained).
2. Name: `portfolio editor`. Expiration: the longest it allows (you can make a new one later).
3. **Resource owner**: `dmcordeiro` (not the AER organization).
4. **Repository access** → Only select repositories → pick `cordeiro-portfolio`.
5. **Permissions → Repository permissions → Contents → Read and write**.
6. Generate it and copy it. Treat it like a password — don't share it or put it on the site.

### 5. Open the editor
Go to **https://dmcordeiro.github.io/cordeiro-portfolio/admin**, click **Sign In with Token**, and paste the token. Your browser remembers it, so you only do this once per device.

### 6. Turn on the contact form
Send yourself one test message from the Contact page. FormSubmit emails you an activation link — click it once, and from then on every message lands in your Gmail. (Check spam if you don't see it.)

---

## Editing day to day

Open **/admin** → choose a section → change things → **Save**. The live site updates about a minute later (refresh the page; a hard refresh with Ctrl+Shift+R if it looks stale).

- **Add a project:** Projects → All projects → **Add Project**. Fill in the title, dates, a one-line summary, the description, and add pictures.
- **Reorder projects:** drag them in the list. Top of the list = first on the site; the home page shows the top three.
- **Cover picture:** the first picture is the cover automatically. To use a different one, set **Cover picture**. The cover is shown first on the project page and isn't repeated in the gallery.
- **Draft a project:** turn on **Hide from site** until it's ready.
- **Update your resume:** Pages → Resume → upload the new PDF in **Resume PDF**, update the date, Save. Visitors get a viewer plus a download button.
- **Edit About, skills, photos, contact info:** Pages → Home, About & Contact.
- **Descriptions** support bold, italic, links and bullet lists from the editor toolbar.

## Important: move your pictures off Wix
Your current pictures are still loaded from Wix's servers. They'll keep working while your Wix account exists, but if you delete it they'll disappear. When you have a few minutes, open each project in /admin, re-upload the original image files (higher quality anyway), and delete the old ones.

## Folder guide (in case you're curious)
- `content/` — all your text and picture lists (the editor changes these)
- `uploads/` — pictures and PDFs you upload in the editor
- `assets/` — design and page code (`style.css` for colors and fonts)
- `admin/` — the editor
