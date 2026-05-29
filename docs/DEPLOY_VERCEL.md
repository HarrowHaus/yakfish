# Deploy to Vercel

Vercel mode gives you live `/api/news` serverless fetching.

## Important plan note

Vercel Hobby is for personal/non-commercial use. If the project becomes commercial, move to a commercial-allowed host or use Vercel Pro.

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

1. Go to Vercel.
2. New Project.
3. Import the GitHub repo.
4. Framework Preset: Other.
5. Build command: leave blank or use `npm run build:cache`.
6. Output directory: `public` if Vercel asks.
7. Deploy.

Open:

```txt
https://your-project.vercel.app
https://your-project.vercel.app/api/news
```

## CLI path

```bash
npm i -g vercel
vercel login
vercel
```

For production:

```bash
vercel --prod
```
