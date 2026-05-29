# Deploy to GitHub Pages

GitHub Pages is static-only. It cannot run `/api/news` on each request.

This repo handles that honestly by generating `public/cache/news.json` through GitHub Actions. The browser tries live serverless endpoints first, then falls back to the static cache.

## What this means

- Vercel/Netlify: request-time live news endpoint.
- GitHub Pages: scheduled/static cache news endpoint.

The included workflow builds the cache and deploys `public/`.

## Upload to GitHub

```bash
git init
git config user.name "Donald"
git config user.email "Donald@Harrow.Haus"
git add .
git commit -m "Ship public wire index"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/public-wire-index.git
git push -u origin main
```

## Turn on Pages

1. Open GitHub repo.
2. Settings.
3. Pages.
4. Source: GitHub Actions.
5. Go to Actions.
6. Run `Build cache and deploy GitHub Pages` manually once.

The workflow also includes a schedule.

## Open

```txt
https://YOUR_GITHUB_USERNAME.github.io/public-wire-index/
```
