# Deploy to Netlify

Netlify mode gives you live `/api/news` through a Netlify Function. The included `netlify.toml` redirects `/api/news` to `/.netlify/functions/news`.

## GitHub path

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

Then:

1. Go to Netlify.
2. Add new site.
3. Import from GitHub.
4. Build command: `npm run build:cache`
5. Publish directory: `public`
6. Functions directory: `netlify/functions`
7. Deploy.

Open:

```txt
https://your-site.netlify.app
https://your-site.netlify.app/api/news
```

## CLI path

```bash
npm i -g netlify-cli
netlify login
netlify init
netlify deploy
netlify deploy --prod
```
