# Project Architecture Rules

- Keep phone installation metadata in `public/manifest.json`; use manifest-only home-screen support unless offline mode is explicitly requested.
- Keep the Capacitor Android shell pointed at the published site and in immersive full-screen mode so native launches never show browser chrome.