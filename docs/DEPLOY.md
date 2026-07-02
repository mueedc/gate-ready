# Deploying Gate Ready

The app is a pure static site (HTML/CSS/JS, no build step), so any static host
works. Two good paths below — GitHub Pages is recommended because it's free,
versioned, and gives you HTTPS (required for the 📍 geolocation button and PWA
install).

## Option A — GitHub Pages (recommended)

```sh
cd ~/airport-trip-planner

# 1. Make it a git repo
git init
git add .
git commit -m "Gate Ready v1"

# 2. Log in to GitHub and create the repo
gh auth login          # follow the browser prompts
gh repo create gate-ready --public --source . --push

# 3. Turn on Pages
gh api repos/{owner}/gate-ready/pages -X POST \
  -f 'source[branch]=main' -f 'source[path]=/'
```

Your app is live at `https://<your-username>.github.io/gate-ready/` within a
minute or two. Every future deploy is just:

```sh
git add . && git commit -m "update" && git push
```

## Option B — Netlify Drop (fastest, no account tooling)

1. Go to https://app.netlify.com/drop
2. Drag the `airport-trip-planner` folder onto the page.
3. Done — you get an HTTPS URL immediately (free account to keep it).

## Install it on your phone (the mobile-preferred path)

The app ships a PWA manifest, so once deployed over HTTPS:

- **iPhone:** open the URL in Safari → Share → **Add to Home Screen**.
- **Android:** open in Chrome → menu → **Add to Home screen** / **Install app**.

It launches full-screen from its own icon like a native app, in portrait, with
the dark theme extending into the status bar.

## Post-deploy checklist

- [ ] Open the URL on your phone and Add to Home Screen.
- [ ] Tap 📍 — geolocation should prompt (works because of HTTPS).
- [ ] Get a Mapbox token and restrict it to your deployed domain
      (see API_KEYS.md #1) — the OSRM/Nominatim demo servers used as
      fallbacks are rate-limited and not meant for production traffic.
- [ ] Optional: custom domain — both hosts support it (GitHub Pages:
      repo Settings → Pages → Custom domain; Netlify: Domain settings).

## Notes

- `serve.py` is for local development only; hosts serve the files directly.
- There is no server-side state — every visitor's plan lives in their browser.
- When you add the flight proxy (API_KEYS.md #2), lock its CORS header to your
  deployed domain.
