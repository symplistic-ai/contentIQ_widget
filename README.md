# ContentIQ Chat Widget

A lightweight, customizable chat widget for embedding ContentIQ AI assistants on your website.

## Usage

### Via widget CDN

```html
<!-- Default iframe embed -->
<script defer src="https://contentiq-widget.pages.dev/loader.js"
  data-agent="YOUR_AGENT_ID"
  data-token="YOUR_SITE_TOKEN"
  data-backend="https://backend.contentiq.symplistic.ai"
  data-sso="true"></script>
```

> **Note:** The `data-backend` attribute (or `backend` URL parameter for iframe) lets you specify the backend API endpoint. Use:
> - `http://localhost:1234` for local development
> - `https://backend.contentiq.symplistic.ai` for production
> - Or any custom backend URL

Replace `YOUR_AGENT_ID` and `YOUR_SITE_TOKEN` with the values provided in your ContentIQ dashboard.

The backend-generated default snippet uses `loader.js`. The loader injects `embed.html`, which loads `widget.js` on the widget CDN origin. Legacy inline deployments may still load `widget.js` directly.

## Features

- Modern, responsive UI
- Markdown support
- Copy/feedback buttons
- Secure authentication with signed tokens
- Customizable backend URL

## Development

This widget uses a branch-based deployment model:

- `main` - Development branch with latest changes (may be unstable)
- `prod` - Production branch with stable, tested code

Cloudflare Pages should publish the `dist` directory so `dist/loader.js`, `dist/embed.html`, `dist/sso_callback.html`, and `dist/widget.js` are served from the same origin.

## License

© 2025 symplistic.ai - All rights reserved
