# PC Setup

## Windows PowerShell

Install Node.js 20 LTS from nodejs.org first.

```powershell
cd $env:USERPROFILE\Downloads
Expand-Archive .\public-wire-index.zip -DestinationPath .\public-wire-index
cd .\public-wire-index
npm install
npm run check
npm run validate:feeds
npm run validate:news
npm run dev
```

Open:

```txt
http://127.0.0.1:5173
```

## macOS / Linux

```bash
cd ~/Downloads
unzip public-wire-index.zip -d public-wire-index
cd public-wire-index
npm install
npm run check
npm run validate:feeds
npm run validate:news
npm run dev
```

Open:

```txt
http://127.0.0.1:5173
```

## Source editing

Edit:

```txt
public/feeds.json
```

Then run:

```bash
npm run validate:feeds
npm run validate:news
```
