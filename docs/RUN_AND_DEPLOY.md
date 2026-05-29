# RUN AND DEPLOY

If you've been running an older version of this on `127.0.0.1:5173`, follow **section 1 — replace cleanly** first. The browser cache is almost certainly why the page is still showing the old UI.

---

## 1 — REPLACE CLEANLY (do this if anything looked wrong before)

In Termux:

```bash
# stop any running server (in the Termux window where it's running)
# press Ctrl + C

# delete the old project folder entirely
cd ~/projects
rm -rf public-wire-database

# unzip the fresh download
unzip /sdcard/Download/public-wire-database.zip
cd public-wire-database

# install and run
npm install
npm run dev
```

Now in Chrome on the same phone:

1. Open `http://127.0.0.1:5173`
2. Tap the three-dot menu (top right)
3. Tap the refresh icon → if there's no "hard reload", instead: Settings → Privacy and security → Clear browsing data → Cached images and files → for the **last hour**, then reload the page

**Verification:** the browser tab should say `wire` (lowercase, four letters). If it still says `PUBLIC WIRE DATABASE` you are still seeing cache — keep clearing.

---

## 2 — TERMUX FROM SCRATCH (first time)

Install Termux from F-Droid (not the Play Store version, which is abandoned):
https://f-droid.org/en/packages/com.termux/

Open Termux. Run these once:

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs git unzip nano -y
termux-setup-storage
```

Allow storage when Android asks.

Then follow section 1.

---

## 3 — VIEW FROM ANOTHER DEVICE ON THE SAME WI-FI

In Termux, run with `HOST=0.0.0.0` instead of the default:

```bash
HOST=0.0.0.0 npm run dev
```

Find your phone's IP:

```bash
ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1
```

Open `http://YOUR_PHONE_IP:5173` from your laptop or any device on the same Wi-Fi.

---

## 4 — DEPLOY TO VERCEL (always-live public URL)

One-time setup:

1. Make a GitHub account at https://github.com if you don't have one.
2. Make a Vercel account at https://vercel.com and sign in with GitHub.
3. On GitHub, create a new empty repo (no README, no gitignore).
4. On GitHub, make a Personal Access Token (Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → check `repo` → copy the token).

In Termux, inside the project folder:

```bash
git init
git config user.name "Donald"
git config user.email "donald@harrow.haus"
git add .
git commit -m "wire"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

When asked for a password, paste the **token**, not your account password.

Then on Vercel:

1. Go to https://vercel.com/new
2. Import the repo
3. Framework preset: Other
4. Build command: leave blank
5. Output directory: `public`
6. Deploy

You get a URL like `https://your-repo.vercel.app`. It fetches live news on every request.

To update later: edit files in Termux, then `git add . && git commit -m "what changed" && git push`. Vercel redeploys automatically in ~30 seconds.

---

## 5 — DEPLOY TO GITHUB PAGES (free forever, hourly snapshots)

Same `git push` as Vercel. Then on github.com:

1. Open your repo → Settings → Pages.
2. Source: GitHub Actions.
3. Top tabs → Actions → run "Build cache and deploy GitHub Pages" once manually.

Wait ~2 minutes. Open `https://YOUR_USERNAME.github.io/YOUR_REPO/`. The workflow refreshes the snapshot on its schedule (default hourly).

You can have Vercel and GitHub Pages on the same repo simultaneously.

---

## TROUBLESHOOTING

**Page still shows the old "PUBLIC WIRE DATABASE" headline.** Cache. See section 1. Make sure you deleted the old folder AND cleared browser cache.

**`npm install` fails.** Run `pkg upgrade -y && pkg install nodejs -y` again, then retry.

**Browser shows "site can't be reached".** Server isn't running. `cd ~/projects/public-wire-database && npm run dev`. Keep the Termux window open while you read.

**Page loads but says "unable to reach data source" in the footer.** All the RSS feeds are failing simultaneously, or your phone has no internet. Try `npm run validate:news` to see which feeds work.

**Vercel deploys but the page is blank.** Output Directory was set wrong. Vercel → project Settings → General → Build & Development → Output Directory → set to `public` → redeploy.

**Fonts look generic.** They are — this uses system fonts on purpose (Georgia or Roboto Serif for headlines, system mono for the meta line). No web font fetches, no FOIT, works offline. If you want Newsreader or another web font, edit `public/styles.css`.
