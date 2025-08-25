# ContentIQ Chat Widget

A lightweight, customizable chat widget for embedding ContentIQ AI assistants on your website.

## Usage

### Via jsDelivr CDN

```html
<!-- Option 1: Div-based embed (recommended) -->
<div class="contentiq_symplisticai_chat" data-agent="YOUR_AGENT_ID"></div>
<script src="https://cdn.jsdelivr.net/gh/symplisticai/contentiq-widget@v1.0.0/dist/widget.min.js" data-token="YOUR_SITE_TOKEN"></script>

<!-- Option 2: iframe-based embed -->
<iframe src="https://cdn.jsdelivr.net/gh/symplisticai/contentiq-widget@v1.0.0/widget.html?agent_id=YOUR_AGENT_ID&token=YOUR_SITE_TOKEN" 
  id="contentiq-chat" 
  style="width: 100%; height: 500px; border: none;" 
  title="ContentIQ Chat Widget" 
  allow="microphone">
</iframe>
```

Replace `YOUR_AGENT_ID` and `YOUR_SITE_TOKEN` with the values provided in your ContentIQ dashboard.

## Features

- Modern, responsive UI
- Markdown support
- Copy/feedback buttons
- Secure authentication with signed tokens
- Customizable backend URL

## Version History

- v1.0.0 - Initial release

## License

© 2023 symplistic.ai - All rights reserved
