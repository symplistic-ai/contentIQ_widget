/**
 * contentIQ widget loader — runs on the customer page origin.
 * Injects a cross-origin iframe and passes embed credentials via postMessage.
 */
(function () {
  var SCRIPT = document.currentScript || document.querySelector('script[src*="loader.js"]');
  if (!SCRIPT) {
    console.error('[contentIQ loader] Script tag not found');
    return;
  }

  var AGENT_ID = SCRIPT.dataset.agent || '';
  var SITE_TOKEN = SCRIPT.dataset.token || '';
  var BACKEND = SCRIPT.dataset.backend || 'http://localhost:1234';
  var SSO = SCRIPT.dataset.sso === 'true';

  if (!AGENT_ID || !SITE_TOKEN) {
    console.error('[contentIQ loader] Missing data-agent or data-token');
    return;
  }

  var scriptSrc = SCRIPT.src || '';
  var WIDGET_CDN_ORIGIN = 'https://contentiq-widget.pages.dev';
  try {
    WIDGET_CDN_ORIGIN = new URL(scriptSrc).origin;
  } catch (e) {}

  var EMBED_URL = WIDGET_CDN_ORIGIN + '/embed.html';
  var PARENT_ORIGIN = window.location.origin;

  var BUBBLE_SIZE = { width: '64px', height: '64px' };
  var OPEN_SIZE = { width: '420px', height: '650px' };
  var MOBILE_OPEN = { width: '100vw', height: '100vh' };
  var PANEL_RADIUS = '24px';

  var mount = document.createElement('div');
  mount.id = 'contentiq-widget-mount';
  mount.style.cssText =
    'position:fixed;bottom:24px;right:24px;z-index:9999;pointer-events:none;background:transparent;';
  document.body.appendChild(mount);

  var iframe = document.createElement('iframe');
  iframe.title = 'symplistic.contentIQ chat';
  iframe.setAttribute('allow', 'clipboard-write');
  iframe.setAttribute('allowtransparency', 'true');
  iframe.src = EMBED_URL;
  iframe.style.cssText =
    'border:none;background:transparent;color-scheme:none;width:' +
    BUBBLE_SIZE.width +
    ';height:' +
    BUBBLE_SIZE.height +
    ';border-radius:50%;overflow:hidden;pointer-events:auto;display:block;';
  mount.appendChild(iframe);

  var lastResizeData = { width: BUBBLE_SIZE.width, height: BUBBLE_SIZE.height, open: false };

  function sendInit() {
    if (!iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      {
        type: 'contentiq_embed_init',
        agent_id: AGENT_ID,
        token: SITE_TOKEN,
        backend: BACKEND,
        sso: SSO,
        parent_origin: PARENT_ORIGIN,
        parent_viewport_width: window.innerWidth,
        parent_viewport_height: window.innerHeight,
      },
      WIDGET_CDN_ORIGIN
    );
  }

  function applyResize(data) {
    lastResizeData = data;
    var mobile = window.innerWidth <= 640;
    var w = data.width;
    var h = data.height;
    if (mobile && data.open) {
      mount.style.bottom = '0';
      mount.style.right = '0';
      iframe.style.width = MOBILE_OPEN.width;
      iframe.style.height = MOBILE_OPEN.height;
      iframe.style.borderRadius = '0';
    } else {
      mount.style.bottom = '24px';
      mount.style.right = '24px';
      if (data.open && (w === '100vw' || h === '100vh')) {
        w = OPEN_SIZE.width;
        h = OPEN_SIZE.height;
      }
      iframe.style.width = typeof w === 'number' ? w + 'px' : w || BUBBLE_SIZE.width;
      iframe.style.height = typeof h === 'number' ? h + 'px' : h || BUBBLE_SIZE.height;
      iframe.style.borderRadius = data.open ? PANEL_RADIUS : '50%';
    }
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage(
        { type: 'contentiq_resize_applied', request_id: data.request_id || null },
        WIDGET_CDN_ORIGIN
      );
    }
  }

  function sendParentViewport() {
    if (!iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      {
        type: 'contentiq_parent_viewport',
        width: window.innerWidth,
        height: window.innerHeight,
      },
      WIDGET_CDN_ORIGIN
    );
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== WIDGET_CDN_ORIGIN) return;
    var data = event.data || {};
    if (data.type === 'contentiq-widget-ready') {
      sendInit();
      sendParentViewport();
    } else if (data.type === 'contentiq_resize') {
      applyResize(data);
    }
  });

  window.addEventListener('resize', function () {
    sendParentViewport();
    applyResize(lastResizeData);
  });
})();
