# Lap

A desktop-style file explorer whose storage backend is GitHub private repos.
Each **volume** you mount is one private repo (~5GB comfort limit each — spin
up another volume when one fills up, same way you'd add a second disk).

Every action you take — create folder, upload, rename, move, delete — becomes
one git commit under the hood, using the Git Data API's tree/commit
primitives directly. Moving or renaming a file is a metadata-only commit: the
file's blob is never re-uploaded, so it's fast and cheap no matter the file
size.

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL.

### 1. Create a GitHub personal access token

Go to **GitHub → Settings → Developer settings → Personal access tokens**.

- **Fine-grained token (recommended):** scope it to the specific repos you'll
  use as volumes (or "All repositories" if you'll create new ones from
  inside the app), with **Contents: Read and write** permission.
- **Classic token:** just needs the `repo` scope.

### 2. Connect

Paste the token in. It's remembered in this browser's `localStorage` —
never sent anywhere, since Lap is a pure client-side app — and every time
you reopen Lap on this device it signs you in automatically, no re-entry.
On a different device, paste the token again there; a token isn't synced
between devices, only remembered per-browser. Settings → "Forget saved
token on this device" clears it.

### 3. Mount a volume

Click **+** in the sidebar — either create a brand-new private repo, or
attach one you already have.

### Everyday use

- **Copy / Cut / Paste** — select file(s)/folder(s), then Ctrl/Cmd+C, X, V
  (or right-click), same as any desktop file manager. Copy resolves name
  collisions automatically ("notes.md" → "notes copy.md").
- **Settings** (gear icon, bottom of sidebar) — accent color, wallpaper
  (curated presets, no image upload — kept out on purpose), font
  family/size, a warning toggle before uploading images/videos, custom
  file-extension → icon/preview mappings, and "forget saved token on this
  device".
- **Maximize** — green traffic-light dot, or double-click the title bar.

## Notes & limits (read before treating this as "unlimited")

- **100MB hard cap per file** on GitHub, files over 50MB draw a warning.
- **~5GB soft cap per repo** — GitHub may email/throttle past that. This is
  why volumes are one-repo-each: mount a second volume rather than
  overloading one repo.
- Every historical version of a file stays in git history even after
  deletion — that's a feature (nothing is really gone, `git log` on the repo
  is your undo history) but means repo size only grows unless you rewrite
  history separately.
- GitHub's Acceptable Use Policy discourages using repos purely as bulk
  cloud storage. Fine for personal study materials/scripts at normal
  volume; avoid using it to warehouse large binary/media libraries.

## Deploying

A GitHub Actions workflow (`.github/workflows/deploy.yml`) is included to
publish to GitHub Pages on every push to `main`. Enable **Pages → Source:
GitHub Actions** in the repo settings once you push this project to its own
repo (this is Lap's *own* source code repo — separate from the private
volume repos it manages for you).

## Architecture

- `src/lib/github.ts` — GitHub REST/Git Data API client + the tree-diffing
  commit primitive everything else builds on.
- `src/lib/crypto.ts` — local token encryption.
- `src/lib/zip.ts` — folder/selection → zip, for "send someone a file or
  folder".
- `src/state/store.tsx` — app state (auth, volumes, current tree, selection)
  and all filesystem actions.
- `src/components/Finder.tsx` — the Explorer-style UI: toolbar, breadcrumb,
  grid/list view, drag-and-drop, context menu.
- `src/components/PreviewModal.tsx` — Quick Look-style preview, tuned for
  code/Markdown/config files first (syntax highlighting via a trimmed
  highlight.js core), with image/PDF as a fallback.
