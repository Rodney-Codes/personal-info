# Portfolio Module

This file is intentionally minimal.

Use root `README.md` as the single human-facing source of truth.
Use root `AI_README.md` as the single AI-facing source of truth.

## Structure (quick reference)

```
portfolio/
├── public/           # static assets; generated site.*.json after npm run sync (often gitignored)
├── scripts/          # sync-site.mjs, validate-site-json.mjs
├── src/
│   ├── format2/      # Format2App.jsx, format2.css, upstream/ (App.tsx, components)
│   ├── lib/          # shared JS (e.g. profile handle from URL)
│   ├── styles/
│   └── main.js
├── index.html
├── package.json
└── vite.config.js
```

Full repository tree: root `README.md` section **Repository layout** → **Directory tree (quick reference)**.
