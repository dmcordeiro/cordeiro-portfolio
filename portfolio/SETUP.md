# Your portfolio site — setup and editing

When setup is done you'll have two bookmarks:

| Bookmark | Address | What it's for |
|---|---|---|
| **Portfolio** | `https://dmcordeiro.github.io/cordeiro-portfolio/` | Your public site |
| **Edit portfolio** | `https://dmcordeiro.github.io/cordeiro-portfolio/admin/` | Sign in with Google, edit, Save |

GitHub holds the site's files (with version history). Your Firebase project handles Google sign-in and stores your content. Free, nothing to install.

## One-time setup

### 1. Firebase project ✅ done
Your project `cordeiro-portfolio` exists, and its settings are already in `assets/firebase-config.js`.

### 2. Google sign-in and the database (skip anything you've already done)
1. console.firebase.google.com → **cordeiro-portfolio** → **Build → Authentication** → **Sign-in method** → **Google** → **Enable** → **Save**.
2. **Build → Firestore Database** → **Create database** → location **us-west2** → **Start in production mode** → **Create**.
3. In Firestore, open the **Rules** tab. Delete everything in the box, paste in the whole contents of `firestore.rules` from your folder (open it with Notepad), and click **Publish**. This lets anyone *view* the site but only your Google account *change* it.

### 3. Put the files on GitHub
1. On github.com, signed in as **dmcordeiro**: **+** → **New repository** → name it **cordeiro-portfolio** → **Public** → **Create repository**.
2. Click **uploading an existing file**. Open your unzipped **portfolio** folder, select everything inside it, and drag it in. (Or add the files with GitHub Desktop, like your planner.) **Commit changes**.
3. Repository **Settings → Pages** → Branch **main**, folder **/ (root)** → **Save**. After a minute or two the site is live at `https://dmcordeiro.github.io/cordeiro-portfolio/`.

### 4. Let Google sign-in work on that address
Firebase console → **Authentication** → **Settings** tab → **Authorized domains** → **Add domain** → `dmcordeiro.github.io` → **Add**.
### 5. Bring your content in
1. Open your **Edit portfolio** address → **Sign in with Google**.
2. Click **Import my content** (only shown the first time). Your six projects, About page, contact info and resume come over from the old site.
3. Bookmark both addresses from the table at the top.

### 6. Turn on the contact form
Send yourself one test message from the Contact page. FormSubmit emails you an activation link. Click it once, and from then on every message lands in your Gmail. (Check spam if you don't see it.)

---

## Editing day to day

Open your **Edit portfolio** bookmark on any device, sign in with Google, edit, and click **Save**. Changes are live right away. No GitHub needed for this.

- **Add a project:** Projects → **Add project** → fill it in → **Publish project**.
- **Reorder projects:** the ↑ ↓ arrows. Top of the list shows first; the home page shows the top three.
- **Pictures:** in a project, click **Add pictures** (or drag files onto it). Use ← → to reorder, **Make cover** to choose the cover, type a caption under each one. The cover shows first and isn't repeated in the gallery.
- **Draft a project:** tick **Hide this project from the site** until it's ready.
- **Resume:** Resume tab → **Upload PDF**. Keep as many versions as you like; pick which one is **Shown on site** and click **Save changes**. "Last updated" on the site is that file's upload date. PDFs up to 10 MB work.
- **Portfolio PDF:** click **Download portfolio PDF** (top of the editor). It builds a landscape PDF from your current content: cover, contents, About, then every visible project with its pictures.
- **About, skills, photos:** Home & About tab. The first About photo sits next to your text, the second next to Skills. Use ↑ ↓ to reorder skill groups.
- **Email, phone, LinkedIn:** Contact info tab. Leave a field empty to hide it.
- **Descriptions:** a blank line starts a new paragraph, `- ` at the start of a line makes a bullet, `**like this**` makes bold.

Pictures are shrunk to web size (about 1800 px wide) when you add them, so keep your originals somewhere.

## Changing the design later
Only needed when the site's code or look changes (for example, after Claude sends you updated files): replace the files in the repo (upload on github.com, or commit with GitHub Desktop). The site updates a minute or two later. Your content isn't affected; it lives in Firebase, not in the files. GitHub keeps every version, so you can always go back.

## Visitor stats
Firebase console → **Analytics** shows how many people visit, which pages and projects they look at, where they're from and what device they use. Stats take up to a day to start showing. It's counts and trends, not names.

## Move your pictures off Wix
Your imported pictures still load from Wix's servers. They'll keep working while your Wix account exists. When you have a few minutes, open each project in the editor, add the original picture files, and **Remove** the old ones.

## What's in the folder
- `index.html`, `about.html`, `projects.html`, `project.html`, `resume.html`, `contact.html` — the pages
- `assets/` — the site's design and code, plus your Firebase settings (`firebase-config.js`)
- `admin/` — the editor
- `content/` — starter content, used only by **Import my content**
- `firestore.rules` — the "only you can edit" rule you pasted in step 2
