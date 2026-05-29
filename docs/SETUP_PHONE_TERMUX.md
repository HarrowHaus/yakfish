# Phone Setup — Termux / Android

Target: open LIVE NEWS DATABASE on your phone locally.

## 1. Install Termux dependencies

Use F-Droid Termux if possible.

```bash
pkg update && pkg upgrade -y
pkg install nodejs git unzip nano -y
node -v
npm -v
```

Node must be 18 or newer.

## 2. Put the zip on your phone

Save `public-wire-index.zip` into Android Downloads.

In Termux:

```bash
mkdir -p ~/projects
cd ~/projects
unzip /sdcard/Download/public-wire-index.zip -d public-wire-index
cd public-wire-index
```

If your unzip creates a nested folder, run:

```bash
ls
```

Then `cd` into the folder that contains `package.json`.

## 3. Install and validate

```bash
npm install
npm run check
npm run validate:feeds
npm run validate:news
```

`validate:news` uses live internet. Broken feeds are allowed; zero total headlines is not.

## 4. Run locally on the phone

```bash
npm run dev
```

Open your Android browser:

```txt
http://127.0.0.1:5173
```

## 5. LAN mode from phone

Use this when you want another device on the same Wi-Fi to open the phone-hosted site.

```bash
HOST=0.0.0.0 npm run dev
```

Find your phone IP:

```bash
ip addr show wlan0 | grep 'inet '
```

Open from another device:

```txt
http://PHONE_IP:5173
```

## 6. Edit sources on phone

```bash
nano public/feeds.json
npm run validate:feeds
npm run validate:news
```

## 7. GitHub upload from phone

Replace `YOUR_GITHUB_USERNAME` and `YOUR_REPO_NAME`.

```bash
git init
git config user.name "Donald"
git config user.email "Donald@Harrow.Haus"
git add .
git commit -m "Ship public wire index"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

If GitHub asks for a password, use a GitHub personal access token instead of your account password.
