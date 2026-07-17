# Form 💗

A sparkly, seriously fast lifting log — built as an installable PWA for logging sets in under
five seconds between sets, with rule-based coaching on top.

**Live app:** https://jmaloy7039.github.io/form/ (open on the phone → Share → Add to Home Screen)
**Repo:** https://github.com/jmaloy7039/form

Design: "Powder & Punch" — hot pink `#FF2E93` + purple `#C79BFF` on white/blush, Fredoka + Nunito.

## What it does

- **Today** — streak + weekly count, the next-up planned workout with one-tap Start, an
  **Upcoming** queue of unlimited future dated plans (add/edit/delete any time — including
  while a workout is in progress), a daily recommendation card (reads the week's muscle
  balance), quick-start template chips, and the ⚙ gear to Settings.
- **Lift** — the between-sets screen. Weight/reps pre-fill from the last session of that
  exercise (an unchanged set is one tap), effort rating (🪶 easy / 💪 solid / 🥵 grind),
  auto-starting rest timer with chime, 📝 notes per exercise, ↻ Swap ("machine's taken" →
  3 same-muscle alternatives), + Add exercise mid-workout, Finish with PR detection + confetti.
- **Progress** — latest-PR banner, per-exercise top-set trend chart, weekly sets-by-muscle
  balance bars with LOW flags, PR wall.
- **Coach** — pick a muscle → top 5 exercises with plain-English "why" (personalized: lifts
  she already does rank first), plus insight cards (undertrained muscle, plateau alert,
  "felt easy twice — add weight" nudge).
- **Settings** — lb/kg (display-only conversion; data is stored in lb so switching is lossless),
  rest timer default (90 s, 30–300 s), timer sound toggle, custom exercises, templates,
  export/restore JSON backup.

## Architecture

Zero-dependency static PWA. No build step, no backend, no accounts.

```
index.html            app shell (4 tabs + sheet/confetti roots)
css/app.css           design system
js/data.js            ~95-exercise library tagged by muscle + equipment, default templates
js/app.js             all state & UI (localStorage key: form.v1)
sw.js                 offline cache (stale-while-revalidate), bump CACHE name on releases
manifest.webmanifest  PWA manifest
icons/                generated app icons
fonts/                bundled Fredoka + Nunito (offline-safe)
```

All data lives in `localStorage` on the device (single JSON blob, `form.v1`). Weights are
stored in **lb** internally. Backup = the whole state as a downloadable JSON file, restorable
from Settings.

## Run locally

```bash
python3 -m http.server 8901 --directory .
# open http://localhost:8901
```

(Or the `form-app` entry in the repo's `.claude/launch.json`.)

## Deploy (free static hosting)

Any static host works — the app is just files. Two easy options:

**Netlify Drop** (fastest): go to https://app.netlify.com/drop and drag the `form_app`
folder in. Done — you get an HTTPS URL immediately.

**GitHub Pages**: push this folder to a repo → Settings → Pages → deploy from branch.

HTTPS is required for the service worker (offline mode) and Add-to-Home-Screen.

## Install on her phone

1. Open the URL in Safari (iPhone) or Chrome (Android).
2. Share → **Add to Home Screen**.
3. It launches full-screen like a native app and works offline in the gym.

## Shipping updates

Edit files, redeploy, and **bump the `CACHE` name in `sw.js`** (`form-v1` → `form-v2` …).
Installed apps pick up changes on the second launch after a deploy (standard
stale-while-revalidate behavior).

## Data safety

- Settings → **Export backup** saves `form-backup-YYYY-MM-DD.json` (she can AirDrop/save it anywhere).
- Settings → **Restore from backup** replaces the app state from a backup file.
- Worth doing occasionally: iOS can evict website data for sites not used for months —
  the installed-app + occasional-export combo keeps her history safe.
