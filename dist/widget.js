/* contentIQ Chat Widget – local dev version
 * -------------------------------------------------------------
 * Mounts a modern chat interface inside the placeholder div and
 * talks to the backend with signed site-token + replay-safe ts|sig.
 * 
 * Version: 2.1.0 - Custom styling integration with POST auth
 * 
 * Session Configuration:
 * To customize session expiry time, set window.contentIQConfig before loading the widget:
 * <script>
 *   window.contentIQConfig = { sessionExpiryHours: 48 }; // 48 hours instead of default 1
 * </script>
 */

// Load widget immediately - no async, no delays
(function() {
  // Capture script tag and dataset values immediately
  const SCRIPT_TAG = document.currentScript;
  if (!SCRIPT_TAG) {
    console.error('[contentIQ widget] Script tag not found');
    return;
  }
  const SITE_TOKEN = SCRIPT_TAG.dataset.token;
  
  // Locate elements & dataset values supplied by embed snippet
  const ROOT = document.querySelector('.contentiq_symplisticai_chat');
  if (!ROOT) {
    console.error('[contentIQ widget] Root DIV not found');
    return;
  }
  const AGENT_ID   = ROOT.dataset.agent;
  const BACKEND    = SCRIPT_TAG.dataset.backend || 'http://localhost:1234';

  // Session management for conversation continuity
  let sessionId = null;
  
  // Thread timeout configuration (5 minutes)
  const THREAD_TIMEOUT_MINUTES = window.contentIQConfig?.threadTimeoutMinutes || 5; // Default 5 minutes
  const THREAD_TIMEOUT_MS = THREAD_TIMEOUT_MINUTES * 60 * 1000;
  
  console.log(`[contentIQ widget] Thread timeout set to ${THREAD_TIMEOUT_MINUTES} minutes`);
  
  // Try to get existing session ID from localStorage
  const storageKey = `contentiq_session_${AGENT_ID}`;
  const sessionData = localStorage.getItem(storageKey);
  
  // Check if session exists
  if (sessionData) {
      try {
          const parsed = JSON.parse(sessionData);
          sessionId = parsed.sessionId;
          console.log('[contentIQ widget] Using existing session');
          
          // Update last activity
          parsed.lastActivity = Date.now();
          localStorage.setItem(storageKey, JSON.stringify(parsed));
      } catch (e) {
          console.log('[contentIQ widget] Invalid session data, creating new one');
          localStorage.removeItem(storageKey);
      }
  }
  
  // If no valid session exists, create a new unique one
  if (!sessionId) {
      // Generate a clean, unique session ID for this user
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 15);
      const uniqueId = `${timestamp}_${random}`;
      sessionId = `session_${uniqueId}`;
      
      // Store session data with timestamp
      const sessionData = {
          sessionId: sessionId,
          lastActivity: Date.now(),
          created: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
      console.log('[contentIQ widget] Created new session');
  }
  
  // Function to update session activity
  function updateSessionActivity() {
      const sessionData = localStorage.getItem(storageKey);
      if (sessionData) {
          try {
              const parsed = JSON.parse(sessionData);
              parsed.lastActivity = Date.now();
              localStorage.setItem(storageKey, JSON.stringify(parsed));
          } catch (e) {
              console.warn('[contentIQ widget] Failed to update session activity');
          }
      }
  }
  
  // Function to get session info for debugging
  function getSessionInfo() {
      const sessionData = localStorage.getItem(storageKey);
      if (sessionData) {
          try {
              const parsed = JSON.parse(sessionData);
              const now = Date.now();
              const lastActivity = parsed.lastActivity || 0;
              const timeSinceActivity = now - lastActivity;
              const hoursSinceActivity = Math.floor(timeSinceActivity / (1000 * 60 * 60));
              const minutesSinceActivity = Math.floor((timeSinceActivity % (1000 * 60 * 60)) / (1000 * 60));
              
              return {
                  sessionId: parsed.sessionId,
                  lastActivity: new Date(lastActivity).toISOString(),
                  timeSinceActivity: `${hoursSinceActivity}h ${minutesSinceActivity}m`,
                  threadTimedOut: timeSinceActivity >= THREAD_TIMEOUT_MS,
                  threadTimeoutMinutes: THREAD_TIMEOUT_MINUTES
              };
          } catch (e) {
              return { error: 'Invalid session data' };
          }
      }
      return { error: 'No session data' };
  }
  
  // Function to check if thread has timed out (5 minutes of inactivity)
  function checkThreadTimeout() {
      const sessionData = localStorage.getItem(storageKey);
      if (sessionData) {
          try {
              const parsed = JSON.parse(sessionData);
              const lastActivity = parsed.lastActivity || 0;
              const now = Date.now();
              
              // Check if thread has timed out (5 minutes)
              if (now - lastActivity >= THREAD_TIMEOUT_MS) {
                  console.log('[contentIQ widget] Thread timed out, will create new session');
                  return true;
              }
          } catch (e) {
              console.warn('[contentIQ widget] Error checking thread timeout:', e);
          }
      }
      return false;
  }
  
  // Function to manually expire session (for testing or user logout)
  function expireSession() {
      localStorage.removeItem(storageKey);
      console.log('[contentIQ widget] Session manually expired');
      // Reload page or recreate session as needed
      location.reload();
  }
  
  // Make expireSession available globally for testing
  window.contentIQExpireSession = expireSession;
  
  // Make thread timeout check available globally for testing
  window.contentIQCheckThreadTimeout = checkThreadTimeout;
  
  // Function to detect and clean up old session formats
  function isOldSessionFormat(sessionId) {
    return sessionId && sessionId.includes('Mozilla') || sessionId.includes('Chrome') || sessionId.includes('Safari');
  }
  
  // Clean up any old session formats
  if (sessionId && isOldSessionFormat(sessionId)) {
    console.log('[contentIQ widget] Detected old session format, cleaning up');
    localStorage.removeItem(storageKey);
    sessionId = null;
    // This will trigger creation of a new clean session ID
  }
  
  // Log session info for debugging
  // Session info logging removed for privacy

  /* ───── helpers ─────────────────────────────────────────────── */
  const encoder = new TextEncoder();
  function hex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function hmacSHA256(keyHex, message) {
    const keyBytes = Uint8Array.from(keyHex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    return hex(new Uint8Array(sig));
  }

  async function buildAuth() {
    const ts  = Math.floor(Date.now() / 1000).toString();
    const sig = await hmacSHA256(SITE_TOKEN, `${ts}|${AGENT_ID}`);
    return { agent_id: AGENT_ID, token: SITE_TOKEN, ts, sig };
  }

  /* ───── background validation (non-blocking) ────────────────── */
  (async () => {
    try {
      const { ts, sig } = await buildAuth();
      const url = new URL(BACKEND + '/api/deploy/validateToken');
      url.searchParams.set('agent_id', AGENT_ID);
      url.searchParams.set('token', SITE_TOKEN);
      url.searchParams.set('ts', ts);
      url.searchParams.set('sig', sig);
      const ok = await fetch(url).then(r => r.ok);
      if (!ok) console.warn('[contentIQ widget] Token validation failed');
    } catch (err) {
      console.warn('[contentIQ widget] Validation error', err);
    }
  })();

  /* ───── fetch and apply custom styling ────────────────── */
  // Default styling values extracted from actual widget CSS variables and styling
  const defaultStyling = {
    brandName: "symplistic.contentIQ",
    defaultMessage: "Welcome to symplistic.ai! Ask me anything!",
    backgroundColor: "linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #000000 100%)",
    accentColor: "#246BFD", // --ciq-blue
    accentColorDark: "#0F56E0", // --ciq-blue-dark
    textColor: "#111827", // --ink
    mutedColor: "#8E8E93", // --muted
    borderColor: "#E5E8F0", // --border
    agentName: "ContentIQ",
    headerColor: "#ffffff",
    agentBubbleColor: "#1a1a1a",
    agentTextColor: "#ffffff",
    userBubbleColor: "#246BFD", // var(--ciq-blue)
    userCircleColor: "#246BFD", // var(--ciq-blue)
    userTextColor: "#ffffff",
    inputBackgroundColor: "linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)",
    inputTextColor: "#ffffff",
    // Additional styling from ROOT.style.cssText
    rootBorder: "#ECEEF5",
    rootBoxShadow: "0 22px 48px rgba(17,24,39,0.18), 0 2px 8px rgba(17,24,39,0.06)",
    fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial"
  };

  let customStyling = { ...defaultStyling };

  // Function to fetch custom styling
  async function fetchCustomStyling() {
    try {
      console.log('[contentIQ widget] Fetching custom styling with GET method...');
      const { ts, sig } = await buildAuth();
      const url = new URL(BACKEND + '/api/deploy/getEmbedStyling');
      url.searchParams.set('agent_id', AGENT_ID);
      url.searchParams.set('token', SITE_TOKEN);
      url.searchParams.set('ts', ts);
      url.searchParams.set('sig', sig);
      
      const res = await fetch(url);
      
      if (res.ok) {
        const data = await res.json();
        console.log('[contentIQ widget] Fetched custom styling response:', data);
        
        // Handle nested response structure
        if (data.success && data.styling) {
          const styling = data.styling;
          console.log('[contentIQ widget] Using custom styling:', styling);
          return { ...defaultStyling, ...styling }; // Merge with defaults
        } else {
          console.log('[contentIQ widget] Invalid response structure, using defaults');
          return defaultStyling;
        }
      } else {
        console.log('[contentIQ widget] No custom styling found, using defaults');
        return defaultStyling;
      }
    } catch (err) {
      console.warn('[contentIQ widget] Error fetching custom styling:', err);
      return defaultStyling;
    }
  }



  /* ============ ============ ============ ============ 
      CSS & JS FOR STYLING THE WIDGET
  ============ ============ ============ =============== */

  // Fetch custom styling AFTER all helper functions and default styling are defined
  // Make it non-blocking so widget loads immediately
  fetchCustomStyling().then(styling => {
    customStyling = styling;
    // Apply the custom styling after it loads
    applyCustomStyling();
  }).catch(err => {
    console.warn('[contentIQ widget] Using default styling due to fetch error:', err);
  });
  
  // Function to apply custom styling
  function applyCustomStyling() {
    ROOT.style.setProperty('--ciq-blue', customStyling.accentColor);
    ROOT.style.setProperty('--ciq-blue-dark', customStyling.accentColorDark || customStyling.accentColor);
    ROOT.style.setProperty('--ink', customStyling.textColor);
    ROOT.style.setProperty('--muted', customStyling.mutedColor);
    ROOT.style.setProperty('--border', customStyling.borderColor);
  }
  
  // Apply CSS variables to ROOT element immediately with defaults
  applyCustomStyling();




  /* ====== CSS & JS FOR STYLING THE WIDGET ====== */
  ROOT.style.cssText = `
  --ciq-blue:#246BFD; --ciq-blue-dark:#0F56E0;
  --ink:#111827; --muted:#8E8E93; --border:#E5E8F0;

  position: fixed; bottom: 60px; right: 24px;
  width: 64px; height: 64px;             /* Start as small icon */
  display:flex; align-items:center; justify-content:center; z-index:9999;
  border-radius: 50%;
  border: 1px solid #ECEEF5;
  background: var(--ciq-blue);
  box-shadow: 0 22px 48px rgba(17,24,39,0.18), 0 2px 8px rgba(17,24,39,0.06);
  font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial;
  color: var(--ink);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

/* Header brand row */
const header = document.createElement('div');
header.style.cssText = `
background: transparent;
padding: 18px 22px 0;                    /* tighter top bar */
display:flex; align-items:center; gap:12px;
justify-content:center;                  /* ← centered like screenshot */
text-align:center;                       /* ensure text centers with logo */
position: relative;
`;

/* Close button */
const closeButton = document.createElement('button');
closeButton.style.cssText = `
position: absolute;
top: 18px;
right: 22px;
width: 24px;
height: 24px;
border: none;
background: transparent;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
color: #ffffff;
font-size: 18px;
font-weight: bold;
border-radius: 50%;
transition: background-color 0.2s ease;
`;
closeButton.innerHTML = '×';
closeButton.onmouseover = () => { closeButton.style.backgroundColor = 'rgba(0,0,0,0.1)'; };
closeButton.onmouseout = () => { closeButton.style.backgroundColor = 'transparent'; };
closeButton.onclick = (e) => {
e.stopPropagation();
toggleChat();
};

/* Resize button */
const resizeButton = document.createElement('button');
resizeButton.style.cssText = `
position: absolute;
top: 18px;
right: 50px;
width: 24px;
height: 24px;
border: none;
background: transparent;
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
color: #ffffff;
font-size: 16px;
font-weight: bold;
border-radius: 50%;
transition: background-color 0.2s ease;
`;
resizeButton.innerHTML = getIconSVG('expand');
resizeButton.title = 'Make larger';
resizeButton.onmouseover = () => { resizeButton.style.backgroundColor = 'rgba(0,0,0,0.1)'; };
resizeButton.onmouseout = () => { resizeButton.style.backgroundColor = 'transparent'; };
resizeButton.onclick = (e) => {
e.stopPropagation();
toggleResize();
};
const logo = document.createElement('div');
// logo.style.cssText = `
//   width: 36px; height: 36px; border-radius: 50%;
//   background: var(--ciq-blue); color:#fff; font-weight:700; font-size:14px;
//   display:flex; align-items:center; justify-content:center; flex-shrink:0;
//   box-shadow: 0 10px 22px rgba(36,107,253,.35); margin-top: 10px;
// `;
// logo.textContent = 'S';
const title = document.createElement('div');
title.innerHTML = `<span style="color:${customStyling.headerColor};">${customStyling.brandName}</span>`;
title.style.cssText = `
font-weight: 800; font-size: 18px; letter-spacing:.2px; margin-top: 10px;
margin-left: -18px;
`;
const timestamp = document.createElement('div');
timestamp.style.cssText = `display:none;`; /* hide in header per screenshot */
timestamp.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
header.append(logo, title, timestamp, resizeButton, closeButton);

/* Scroll area */
const chatArea = document.createElement('div');
chatArea.style.cssText = `
flex:1; overflow-y:auto;
padding: 60px 22px 10px 22px;            /* ↑ adds space under header */
background: transparent;
`;

/* First message layout */
const welcomeMsg = document.createElement('div');
welcomeMsg.style.cssText = `
display:flex; align-items:flex-start; gap:12px;
margin: 0 0 16px;                        /* increased spacing between messages */
`;
const botAvatar = document.createElement('div');
botAvatar.style.cssText = `
width: 40px; height: 40px; border-radius: 50%; flex-shrink:0;
background: var(--ciq-blue); color:#fff; font-weight:700; font-size:15px;
display:flex; align-items:center; justify-content:center;
box-shadow: 0 10px 22px rgba(36,107,253,.35);
`;
botAvatar.textContent = customStyling.agentName.charAt(0).toUpperCase();

const messageContent = document.createElement('div');
messageContent.style.cssText = `flex:1;`;

const botName = document.createElement('div');
botName.style.cssText = `
font-weight:700; font-size:15px; color:#ffffff; margin: 4px 0 8px; display:flex; align-items:center; gap:12px;
`;
botName.textContent = customStyling.agentName;

/* thin, rounded, airy bubble like screenshot */
const messageBubble = document.createElement('div');
messageBubble.style.cssText = `
background: ${customStyling.agentBubbleColor};
border: 1px solid #333333;
color: ${customStyling.agentTextColor};
padding: 14px 16px;
border-radius: 20px;
font-size: 15px; line-height: 1.45;
width: 96%;
max-width: 100%;
word-wrap: break-word;
overflow-wrap: break-word;
word-break: normal;
hyphens: none;
overflow: hidden;
box-shadow: 0 8px 22px rgba(0,0,0,.3);
margin-bottom: 16px;
`;
messageBubble.textContent = customStyling.defaultMessage;

/* action icon row under bubble */
const actionIcons = document.createElement('div');
actionIcons.style.cssText = `display:flex; gap:12px; align-items:center; margin-left:2px;`;
['copy','thumbs-up','thumbs-down'].forEach(icon=>{
const chip=document.createElement('div');
chip.style.cssText = `
  width:28px; height:28px;
  display:flex; align-items:center; justify-content:center;
  border-radius:10px; background:#1a1a1a; border:1px solid #333333;
  cursor:pointer; transition: background .15s ease, border-color .15s ease, transform .1s ease;
  box-shadow: 0 3px 8px rgba(0,0,0,.2);
  color: #ffffff;
`;
chip.innerHTML = getIconSVG(icon);
chip.onmouseover = ()=>{ chip.style.background='#333333'; chip.style.borderColor='var(--ciq-blue)'; chip.style.transform='translateY(-1px)'; };
chip.onmouseout  = ()=>{ chip.style.background='#1a1a1a'; chip.style.borderColor='#333333'; chip.style.transform='none'; };
actionIcons.appendChild(chip);
});

messageContent.append(botName, messageBubble, actionIcons);
welcomeMsg.append(botAvatar, messageContent);

/* Suggested cards – hide entirely per your request */
const suggestedActions = document.createElement('div');
suggestedActions.style.cssText = `display:none;`;

chatArea.append(welcomeMsg, suggestedActions);

/* Input row (rounded bar + mic inside + floating FAB send) */
const inputArea = document.createElement('div');
inputArea.style.cssText = `
position: relative;
background: transparent;
padding: 12px 22px 22px 22px;
border-top: 0;
display: flex; flex-direction: column; gap: 8px;
`;
const input = document.createElement('input');
input.type='text';
input.placeholder='Ask me anything...';
input.style.cssText = `
width: 100%;
height: 56px;
background: ${customStyling.inputBackgroundColor};
border: 1px solid #333333;
border-radius: 22px;
padding: 0 76px 0 50px;            /* room for mic + right breathing */
font-size: 16px; color: ${customStyling.inputTextColor}; outline: none;
box-shadow:
  inset 0 1px 0 rgba(255,255,255,.1),
  0 12px 28px rgba(0,0,0,.3);
`;
const micButton = document.createElement('button');
micButton.style.cssText = `
 position: absolute;
 left: 18px;
 top: 52%; transform: translateY(-50%);
 width: 22px; height: 22px;
 border: 0; background: transparent; padding: 0; margin: 0;
 display: flex; align-items: center; justify-content: center;
 color: #6B7280; opacity: .95; cursor: pointer;
`;
micButton.innerHTML = getIconSVG('mic');
micButton.style.zIndex = '2';     // above the input
micButton.onmouseover = ()=> micButton.style.opacity='1';
micButton.onmouseout  = ()=> micButton.style.opacity='.9';

const sendButton = document.createElement('button');
sendButton.classList.add('ciq-fab')
sendButton.style.cssText = `
 position: absolute;
 right: -2px; top: 50%; transform: translateY(-50%);
 width: 64px; height: 64px;
 border: none; border-radius: 50%;
 background: #246BFD;
 display: flex; align-items: center; justify-content: center; cursor: pointer;
 z-index: 1;                                         /* only above input, not disclaimer */
 filter: drop-shadow(0 6px 16px rgba(36,107,253,.35));
 transition: background .12s ease;
`;
sendButton.innerHTML = getIconSVG('send');
sendButton.style.zIndex = '3';    // above everything in the footer
sendButton.onmouseover = () => { sendButton.style.background = '#0F56E0'; };
sendButton.onmouseout  = () => { sendButton.style.background = '#246BFD'; };

const _ciqStyle = document.createElement('style');
_ciqStyle.textContent += `
.contentiq_symplisticai_chat input::placeholder { color:#666666; opacity:1; }

/* Markdown styling */
.contentiq_symplisticai_chat strong { font-weight: 700; }
.contentiq_symplisticai_chat em { font-style: italic; }
.contentiq_symplisticai_chat code { 
  background: rgba(0,0,0,0.1); 
  padding: 2px 4px; 
  border-radius: 4px; 
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
}
.contentiq_symplisticai_chat ul { 
  margin: 8px 0; 
  padding-left: 20px; 
}
.contentiq_symplisticai_chat li { 
  margin: 4px 0; 
  line-height: 1.4; 
}
.contentiq_symplisticai_chat pre {
  background: rgba(0,0,0,0.1);
  border: 1px solid rgba(0,0,0,0.2);
  border-radius: 6px;
  padding: 12px;
  margin: 8px 0;
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
}
.contentiq_symplisticai_chat pre code {
  background: none;
  padding: 0;
}
.contentiq_symplisticai_chat .list-item {
  margin: 8px 0;
  line-height: 1.4;
  padding-left: 0;
}
.contentiq_symplisticai_chat .list-item strong {
  color: #ffffff;
  font-weight: 600;
}
.contentiq_symplisticai_chat blockquote {
  border-left: 4px solid var(--ciq-blue);
  margin: 8px 0;
  padding: 8px 12px;
  background: rgba(36,107,253,0.1);
  border-radius: 0 6px 6px 0;
}
.contentiq_symplisticai_chat h1, .contentiq_symplisticai_chat h2, .contentiq_symplisticai_chat h3,
.contentiq_symplisticai_chat h4, .contentiq_symplisticai_chat h5, .contentiq_symplisticai_chat h6 {
  margin: 12px 0 6px 0;
  font-weight: 600;
  line-height: 1.3;
  color: #ffffff;
}
.contentiq_symplisticai_chat h1 { font-size: 20px; }
.contentiq_symplisticai_chat h2 { font-size: 18px; }
.contentiq_symplisticai_chat h3 { font-size: 16px; }
.contentiq_symplisticai_chat h4 { font-size: 15px; }
.contentiq_symplisticai_chat h5 { font-size: 14px; }
.contentiq_symplisticai_chat h6 { font-size: 13px; }
.contentiq_symplisticai_chat hr {
  border: none;
  border-top: 2px solid rgba(255,255,255,0.2);
  margin: 12px 0;
}
.contentiq_symplisticai_chat .table-wrapper {
  overflow-x: auto;
  margin: 8px 0;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
.contentiq_symplisticai_chat table {
  border-collapse: collapse;
  width: 250%;
  max-width: 250%;
  font-size: 13px;
  background: rgba(0,0,0,0.1);
  border-radius: 6px;
  overflow: hidden;
  table-layout: fixed;
}
.contentiq_symplisticai_chat th, .contentiq_symplisticai_chat td {
  border: 1px solid rgba(255,255,255,0.2);
  padding: 8px 10px;
  text-align: left;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  vertical-align: top;
  white-space: normal;
  min-width: fit-content;
}
.contentiq_symplisticai_chat th {
  background: rgba(36,107,253,0.2);
  font-weight: 600;
  color: #ffffff;
}
.contentiq_symplisticai_chat tr:nth-child(even) {
  background: rgba(255,255,255,0.05);
}
.contentiq_symplisticai_chat tr:hover {
  background: rgba(36,107,253,0.1);
}
.contentiq_symplisticai_chat a { 
  color: var(--ciq-blue); 
  text-decoration: underline; 
}
.contentiq_symplisticai_chat a:hover { 
  color: #0F56E0; 
}

/* Feedback button styling */
.contentiq_symplisticai_chat [data-feedback-button].selected-feedback {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.contentiq_symplisticai_chat [data-feedback-button="thumbs-up"].selected-feedback {
  animation: pulse-green 2s infinite;
}
.contentiq_symplisticai_chat [data-feedback-button="thumbs-down"].selected-feedback {
  animation: pulse-red 2s infinite;
}
@keyframes pulse-green {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
@keyframes pulse-red {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

/* double halo around the blue FAB */
.contentiq_symplisticai_chat .ciq-fab::before,
.contentiq_symplisticai_chat .ciq-fab::after{
  content:""; position:absolute; left:50%; top:50%;
  border-radius:50%; pointer-events:none; transform:translate(-50%,-50%);
}
/* outer soft ring */
.contentiq_symplisticai_chat .ciq-fab::before{
  width:112px; height:112px;
  background: radial-gradient(circle,
    rgba(36,107,253,.16) 0%, rgba(36,107,253,.10) 55%, rgba(36,107,253,0) 70%);
  filter: blur(2px);
}
/* inner tighter ring */
.contentiq_symplisticai_chat .ciq-fab::after{
  width:88px; height:88px;
  background: radial-gradient(circle,
    rgba(36,107,253,.22) 0%, rgba(36,107,253,.14) 55%, rgba(36,107,253,0) 72%);
}

/* Typing indicator animation */
@keyframes typing-dot {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}
`;


document.head.appendChild(_ciqStyle);

/* Source cards styling */
const sourceCardStyle = `
  background: #1a1a1a;
  border: 1px solid #333333;
  border-radius: 12px;
  padding: 16px 16px 32px 16px;
  margin: 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  transition: all 0.2s ease;
  overflow: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: normal;
  hyphens: none;
  box-sizing: border-box;
  min-height: 160px;
`;

const sourceLinkStyle = `
  color: #246BFD;
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
`;

const sourceLinkHoverStyle = `
  border-bottom-color: #246BFD;
`;

/* Disclaimer text */
const disclaimer = document.createElement('div');
disclaimer.style.cssText = `
font-size: 11px;
color: #999999;
text-align: center;
margin-top: 8px;
line-height: 1.3;
opacity: 0.8;
width: 100%;
position: relative;
z-index: 2;
`;
disclaimer.textContent = 'contentIQ can make mistakes. Check important info here.';

/* Input row container */
const inputRow = document.createElement('div');
inputRow.style.cssText = `
position: relative;
width: 100%;
display: flex;
align-items: center;
gap: 8px;
`;

inputRow.append(input, micButton, sendButton);
inputArea.append(inputRow, disclaimer);

/* Create initial icon */
const chatIcon = document.createElement('div');
chatIcon.style.cssText = `
width: 40px; height: 40px; border-radius: 50%;
background: var(--ciq-blue); color:#fff; font-weight:700; font-size:18px;
display:flex; align-items:center; justify-content:center;
box-shadow: 0 10px 22px rgba(36,107,253,.35);
cursor: grab;
`;
chatIcon.innerHTML = getIconSVG('chat');

/* Create full chat interface (initially hidden) */
const chatInterface = document.createElement('div');
chatInterface.style.cssText = `
width: 420px; height: 650px;
display: none; flex-direction: column; overflow: hidden;
border-radius: 22px;
border: 1px solid #333333;
background: ${customStyling.backgroundColor};
box-shadow: 0 22px 48px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2);
position: relative;
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
`;

/* Resize functionality */
let isExpanded = false;
let isResizing = false;

function toggleResize() {
  isExpanded = !isExpanded;
  
  if (isExpanded) {
    // Expand to larger size
    ROOT.style.width = '600px';
    ROOT.style.height = '800px';
    chatInterface.style.width = '600px';
    chatInterface.style.height = '800px';
    resizeButton.innerHTML = getIconSVG('shrink');
    resizeButton.title = 'Make smaller';
  } else {
    // Return to normal size
    ROOT.style.width = '420px';
    ROOT.style.height = '650px';
    chatInterface.style.width = '420px';
    chatInterface.style.height = '650px';
    resizeButton.innerHTML = getIconSVG('expand');
    resizeButton.title = 'Make larger';
  }
  
  // Update existing source cards to match new size
  updateSourceCardsSize();
}

function updateSourceCardsSize() {
  // Find all source card containers and update their size
  const sourceContainers = document.querySelectorAll('.source-cards-container');
  sourceContainers.forEach(container => {
    const cardsContainer = container.querySelector('.cards-container');
    const scrollableArea = container.querySelector('.scrollable-area');
    const sourceCards = container.querySelectorAll('.source-card');
    
    if (cardsContainer && scrollableArea && sourceCards.length > 0) {
      const newWidth = isExpanded ? '500px' : '300px';
      
      // Update container width
      cardsContainer.style.width = newWidth;
      cardsContainer.style.maxWidth = newWidth;
      
      // Update scrollable area width
      scrollableArea.style.width = newWidth;
      scrollableArea.style.maxWidth = newWidth;
      
      // Update each source card width
      sourceCards.forEach(card => {
        card.style.width = newWidth;
        card.style.minWidth = newWidth;
        card.style.maxWidth = newWidth;
      });
    }
  });
}

/* Toggle function */
let isOpen = false;
function toggleChat() {
isOpen = !isOpen;

if (isOpen) {
  // Expand to full chat
  ROOT.style.width = isExpanded ? '600px' : '420px';
  ROOT.style.height = isExpanded ? '800px' : '650px';
  ROOT.style.borderRadius = '22px';
  ROOT.style.flexDirection = 'column';
  ROOT.style.overflow = 'hidden';
  chatIcon.style.display = 'none';
  chatInterface.style.display = 'flex';
  
  // Update session activity when user opens chat
  updateSessionActivity();
} else {
  // Collapse to icon
  ROOT.style.width = '64px';
  ROOT.style.height = '64px';
  ROOT.style.borderRadius = '50%';
  ROOT.style.flexDirection = 'row';
  ROOT.style.overflow = 'visible';
  chatIcon.style.display = 'flex';
  chatInterface.style.display = 'none';
}
}

/* Add click handler only to the icon */
chatIcon.addEventListener('click', toggleChat);

/* Mount */
ROOT.append(chatIcon);
chatInterface.append(header, chatArea, inputArea);
ROOT.append(chatInterface);

/* ===== utility functions ===== */
function cleanResponse(response) {
try {
  // Try to parse as JSON first
  const parsed = JSON.parse(response);
  if (parsed.assistant) {
    return parsed.assistant;
  }
  // If no assistant field, return the whole response as string
  return JSON.stringify(parsed);
} catch (e) {
  // If it's not valid JSON, return as is
  return response;
}
}

function parseMarkdown(text) {
  if (!text) return '';
  
  // Escape HTML to prevent XSS
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Clean up Chinese bracket references - make them smaller and less intrusive
  html = html.replace(/【(\d+)】/g, '<sup style="color: #6b7280; font-size: 0.8em; font-weight: 500;">[$1]</sup>');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Horizontal rule
  html = html.replace(/^---$/gim, '<hr>');

  // Code blocks (fenced)
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Tables
  html = parseMarkdownTables(html);

  // Lists
  html = parseMarkdownLists(html);

  // Blockquotes
  html = html.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');
  
  // Clean up trailing <br> tags that create unwanted spacing
  html = html.replace(/(<br>\s*)+$/g, '');
  
  // Clean up any standalone asterisks at the end
  html = html.replace(/\s*\*\*\s*$/g, '');

  return html;
}

/* ───────────── Helper: Parse Markdown Tables ─────── */
function parseMarkdownTables(html) {
  // Match table pattern: header row with | separators, separator row, then data rows
  const tableRegex = /(\|.+\|[\r\n]+\|[\s\-\|]+\|[\r\n]+(?:\|.+\|[\r\n]*)+)/g;
  
  return html.replace(tableRegex, (match) => {
    const lines = match.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return match;

    const headerRow = lines[0];
    const separatorRow = lines[1];
    const dataRows = lines.slice(2);

    // Parse header
    const headers = headerRow.split('|').slice(1, -1).map(h => h.trim());
    const headerHtml = headers.map(h => `<th>${h}</th>`).join('');

    // Parse data rows
    const rowsHtml = dataRows.map(row => {
      const cells = row.split('|').slice(1, -1).map(c => c.trim());
      const cellsHtml = cells.map(c => `<td>${c}</td>`).join('');
      return `<tr>${cellsHtml}</tr>`;
    }).join('');

    return `<div class="table-wrapper" style="overflow-x: auto; width: 100%; max-width: 100%; box-sizing: border-box;"><table style="width: 250%; max-width: 250%; table-layout: fixed;"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
  });
}

/* ───────────── Helper: Parse Markdown Lists ─────── */
function parseMarkdownLists(html) {
  // Handle bold text with dashes (like "**Term life insurance** — description")
  html = html.replace(/\*\*(.+?)\*\* — (.+)/g, '<div class="list-item"><strong>$1</strong> — $2</div>');
  
  // Handle bold text with dashes (alternative format)
  html = html.replace(/\*\*(.+?)\*\* – (.+)/g, '<div class="list-item"><strong>$1</strong> – $2</div>');
  
  // Handle bold text with dashes (another alternative)
  html = html.replace(/\*\*(.+?)\*\* - (.+)/g, '<div class="list-item"><strong>$1</strong> - $2</div>');
  
  // Keep ordered lists for numbered lists
  html = html.replace(/^[\s]*\d+\. (.+)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>[\s]*)+/g, (match) => {
    return `<ol>${match}</ol>`;
  });

  return html;
}

function parseSources(text) {
  const sources = [];
  
  // Look for source patterns like 【1】, 【2】, etc.
  const sourcePattern = /【(\d+)】\s*([^【]+?)(?=【\d+】|$)/g;
  let match;
  
  while ((match = sourcePattern.exec(text)) !== null) {
    const sourceNumber = match[1];
    const sourceText = match[2].trim();
    
    // Extract URL and description
    const urlMatch = sourceText.match(/(https?:\/\/[^\s]+)/);
    const url = urlMatch ? urlMatch[1] : '';
    const description = sourceText.replace(url, '').replace(/^[–—]\s*/, '').trim();
    
    if (url && description) {
      sources.push({
        number: sourceNumber,
        url: url,
        description: description
      });
    }
  }
  
  return sources;
}

function createSourceCards(sources, expanded = false) {
  if (!sources || sources.length === 0) return null;
  
  // Create the main sources container
  const sourcesContainer = document.createElement('div');
  sourcesContainer.className = 'source-cards-container';
  sourcesContainer.style.cssText = `
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  `;
  
  // Create the dropdown header
  const sourcesHeader = document.createElement('div');
  sourcesHeader.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: #1a1a1a;
    border: 1px solid #333333;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  `;
  
  const sourcesTitle = document.createElement('span');
  sourcesTitle.style.cssText = `
    color: #ffffff;
    font-weight: 600;
    font-size: 14px;
  `;
  sourcesTitle.textContent = `Sources (${sources.length})`;
  
  const dropdownIcon = document.createElement('span');
  dropdownIcon.style.cssText = `
    color: var(--ciq-blue);
    font-size: 16px;
    transition: transform 0.2s ease;
    margin-left: auto;
  `;
  dropdownIcon.innerHTML = '▼';
  
  sourcesHeader.appendChild(sourcesTitle);
  sourcesHeader.appendChild(dropdownIcon);
  
  // Create the scrollable cards container (initially hidden)
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'cards-container';
  cardsContainer.style.cssText = `
    display: none;
    margin-top: 12px;
    position: relative;
    width: ${expanded ? '500px' : '300px'};
    max-width: ${expanded ? '500px' : '300px'};
    box-sizing: border-box;
    overflow: hidden;
    height: 180px;
    margin-left: auto;
    margin-right: auto;
  `;
  
  const scrollableArea = document.createElement('div');
  scrollableArea.className = 'scrollable-area';
  const scrollableWidth = expanded ? '500px' : '300px';
  scrollableArea.style.cssText = `
    display: flex;
    gap: 0;
    overflow: hidden;
    scroll-behavior: smooth;
    padding: 8px 0;
    scrollbar-width: none;
    -ms-overflow-style: none;
    width: ${scrollableWidth};
    max-width: ${scrollableWidth};
    flex-wrap: nowrap;
    position: relative;
    box-sizing: border-box;
    min-width: 0;
    height: 180px;
  `;
  
  // Hide scrollbar
  scrollableArea.style.cssText += `
    scrollbar-width: none;
    -ms-overflow-style: none;
  `;
  
  // Add scrollbar hiding for webkit browsers
  const style = document.createElement('style');
  style.textContent = `
    .source-scrollable::-webkit-scrollbar {
      display: none;
    }
  `;
  document.head.appendChild(style);
  scrollableArea.classList.add('source-scrollable');
  
  // Create scroll buttons
  const leftButton = document.createElement('button');
  leftButton.style.cssText = `
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(26,26,26,0.8);
    border: 1px solid #333333;
    color: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: all 0.2s ease;
    opacity: 0.7;
  `;
  leftButton.innerHTML = '‹';
  leftButton.onmouseover = () => { 
    leftButton.style.background = '#333333'; 
    leftButton.style.borderColor = 'var(--ciq-blue)'; 
  };
  leftButton.onmouseout = () => { 
    leftButton.style.background = '#1a1a1a'; 
    leftButton.style.borderColor = '#333333'; 
  };
  
  const rightButton = document.createElement('button');
  rightButton.style.cssText = `
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(26,26,26,0.8);
    border: 1px solid #333333;
    color: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: all 0.2s ease;
    opacity: 0.7;
  `;
  rightButton.innerHTML = '›';
  rightButton.onmouseover = () => { 
    rightButton.style.background = '#333333'; 
    rightButton.style.borderColor = 'var(--ciq-blue)'; 
  };
  rightButton.onmouseout = () => { 
    rightButton.style.background = '#1a1a1a'; 
    rightButton.style.borderColor = '#333333'; 
  };
  
  // Create individual source cards
  sources.forEach((source, index) => {
    const sourceCard = document.createElement('div');
    sourceCard.className = 'source-card';
    const cardWidth = expanded ? '500px' : '300px';
    sourceCard.style.cssText = `
      ${sourceCardStyle}
      width: ${cardWidth};
      min-width: ${cardWidth};
      max-width: ${cardWidth};
      flex-shrink: 0;
      flex-grow: 0;
      overflow: hidden;
      box-sizing: border-box;
    `;
    
    const sourceHeader = document.createElement('div');
    sourceHeader.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      overflow: hidden;
      width: 100%;
      box-sizing: border-box;
    `;
    
    const sourceNumber = document.createElement('span');
    sourceNumber.style.cssText = `
      background: #246BFD;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 6px;
      min-width: 20px;
      text-align: center;
    `;
    sourceNumber.textContent = `【${source.number}】`;
    
    const sourceLink = document.createElement('a');
    sourceLink.href = source.url;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.style.cssText = sourceLinkStyle;
    sourceLink.textContent = 'View source';
    sourceLink.onmouseover = () => { sourceLink.style.cssText = sourceLinkStyle + sourceLinkHoverStyle; };
    sourceLink.onmouseout = () => { sourceLink.style.cssText = sourceLinkStyle; };
    
    sourceHeader.appendChild(sourceNumber);
    sourceHeader.appendChild(sourceLink);
    
    const sourceDescription = document.createElement('div');
    sourceDescription.style.cssText = `
      color: #cccccc;
      font-size: 15px;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
      word-break: normal;
      hyphens: none;
      overflow: hidden;
      max-width: 100%;
      white-space: normal;
      min-height: 60px;
      box-sizing: border-box;
    `;
    sourceDescription.textContent = source.description;
    
    sourceCard.appendChild(sourceHeader);
    sourceCard.appendChild(sourceDescription);
    scrollableArea.appendChild(sourceCard);
  });
  
  // Add carousel navigation functionality
  let currentIndex = 0;
  
  // Function to update button visibility
  function updateButtonVisibility() {
    leftButton.style.display = currentIndex > 0 ? 'flex' : 'none';
    rightButton.style.display = currentIndex < sources.length - 1 ? 'flex' : 'none';
  }
  
  // Function to scroll to a specific index
  function scrollToIndex(index) {
    if (index >= 0 && index < sources.length) {
      currentIndex = index;
      const cardWidth = expanded ? 500 : 300; // Responsive card width
      scrollableArea.scrollTo({ left: index * cardWidth, behavior: 'smooth' });
      updateButtonVisibility();
    }
  }
  
  leftButton.onclick = () => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
  };
  
  rightButton.onclick = () => {
    if (currentIndex < sources.length - 1) {
      scrollToIndex(currentIndex + 1);
    }
  };
  
  // Initialize button visibility
  updateButtonVisibility();
  
  // Toggle dropdown functionality
  let isExpanded = false;
  sourcesHeader.onclick = () => {
    isExpanded = !isExpanded;
    if (isExpanded) {
      cardsContainer.style.display = 'block';
      dropdownIcon.style.transform = 'rotate(180deg)';
      sourcesHeader.style.borderBottomLeftRadius = '0';
      sourcesHeader.style.borderBottomRightRadius = '0';
      // Reset carousel to first card when opening
      currentIndex = 0;
      scrollableArea.scrollTo({ left: 0, behavior: 'smooth' });
      updateButtonVisibility();
    } else {
      cardsContainer.style.display = 'none';
      dropdownIcon.style.transform = 'rotate(0deg)';
      sourcesHeader.style.borderBottomLeftRadius = '12px';
      sourcesHeader.style.borderBottomRightRadius = '12px';
    }
  };
  
  // Hover effects for header
  sourcesHeader.onmouseover = () => {
    sourcesHeader.style.background = '#333333';
    sourcesHeader.style.borderColor = 'var(--ciq-blue)';
  };
  sourcesHeader.onmouseout = () => {
    sourcesHeader.style.background = '#1a1a1a';
    sourcesHeader.style.borderColor = '#333333';
  };
  
  cardsContainer.appendChild(leftButton);
  cardsContainer.appendChild(scrollableArea);
  cardsContainer.appendChild(rightButton);
  
  sourcesContainer.appendChild(sourcesHeader);
  sourcesContainer.appendChild(cardsContainer);
  
  return sourcesContainer;
}

/* ===== icons (unchanged) ===== */
function getIconSVG(type){
const icons = {
  copy:'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
  'thumbs-up':'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>',
  'thumbs-down':'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>',
  mic:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>',
  send:'<svg width="22" height="22" viewBox="0 0 24 24" fill="white" style="transform: translateX(1px);"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
  expand:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>',
  shrink:'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>',
  chat:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>'
};
return icons[type] || '';
}

/* ===== messaging logic (unchanged) ===== */
function createActionIcons(messageText, messageId) {
// Ensure we have a valid message ID
if (!messageId) {
  console.error('[contentIQ widget] Missing messageId in createActionIcons');
  return document.createElement('div'); // Return empty div if no message ID
}

const actionIcons = document.createElement('div');
actionIcons.style.cssText = `display:flex; gap:12px; align-items:center; margin-left:2px; margin-top:8px;`;
['copy','thumbs-up','thumbs-down'].forEach(icon=>{
  const chip=document.createElement('div');
  chip.style.cssText = `
    width:28px; height:28px;
    display:flex; align-items:center; justify-content:center;
    border-radius:10px; background:#1a1a1a; border:1px solid #333333;
    cursor:pointer; transition: background .15s ease, border-color .15s ease, transform .1s ease;
    box-shadow: 0 3px 8px rgba(0,0,0,.2);
    color: #ffffff;
  `;
  chip.innerHTML = getIconSVG(icon);
  chip.onmouseover = ()=>{ chip.style.background='#333333'; chip.style.borderColor='var(--ciq-blue)'; chip.style.transform='translateY(-1px)'; };
  chip.onmouseout  = ()=>{ chip.style.background='#1a1a1a'; chip.style.borderColor='#333333'; chip.style.transform='none'; };
  
  // Add click functionality for copy button
  if (icon === 'copy') {
    chip.onclick = async () => {
      try {
        await navigator.clipboard.writeText(messageText);
        // Visual feedback - briefly change the icon to a checkmark
        const originalHTML = chip.innerHTML;
        chip.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        chip.style.background = '#10B981';
        chip.style.borderColor = '#10B981';
        chip.style.color = '#fff';
        
        setTimeout(() => {
          chip.innerHTML = originalHTML;
          chip.style.background = '#1a1a1a';
          chip.style.borderColor = '#333333';
          chip.style.color = '#ffffff';
        }, 1500);
      } catch (err) {
        console.error('Failed to copy text: ', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = messageText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    };
  }
  
  // Add feedback functionality for thumbs-up and thumbs-down
  if (icon === 'thumbs-up' || icon === 'thumbs-down') {
    chip.dataset.feedbackType = icon === 'thumbs-up' ? 'helpful' : 'not_helpful';
    
    // Add a data attribute to identify this as a feedback button
    chip.dataset.feedbackButton = icon;
    
    // Add a title attribute for tooltip
    chip.title = icon === 'thumbs-up' ? 'This was helpful' : 'This was not helpful';
    
    chip.onclick = async () => {
      try {
        // First, reset all feedback buttons in this container to default state
        const allFeedbackButtons = chip.parentElement.querySelectorAll('[data-feedback-button]');
        allFeedbackButtons.forEach(btn => {
          btn.style.background = '#1a1a1a';
          btn.style.borderColor = '#333333';
          btn.style.transform = 'none';
          btn.style.color = '#ffffff';
          btn.classList.remove('selected-feedback');
        });
        
        // Show immediate visual feedback that the button was clicked
        chip.style.background = icon === 'thumbs-up' ? '#1a3d1a' : '#3d1a1a';
        chip.style.borderColor = icon === 'thumbs-up' ? '#10B981' : '#EF4444';
        chip.style.transform = 'translateY(-2px)';
        chip.classList.add('selected-feedback');
        
        await sendFeedback(messageId, chip.dataset.feedbackType);
        
        // Enhanced visual feedback - briefly change the icon to a checkmark
        const originalHTML = chip.innerHTML;
        
        chip.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
        chip.style.background = '#10B981';
        chip.style.borderColor = '#10B981';
        chip.style.color = '#fff';
        
        setTimeout(() => {
          // Return to the selected state, not the original state
          chip.innerHTML = originalHTML;
          chip.style.background = icon === 'thumbs-up' ? '#1a3d1a' : '#3d1a1a';
          chip.style.borderColor = icon === 'thumbs-up' ? '#10B981' : '#EF4444';
          chip.style.color = '#ffffff';
        }, 1500);
      } catch (err) {
        console.error('Failed to send feedback:', err);
      }
    };
  }
  
  actionIcons.appendChild(chip);
});
return actionIcons;
}

function addMessage(message, isUser=false, serverMessageId=null){
const row = document.createElement('div');
row.style.cssText = `
  display:flex; align-items:flex-start; gap:12px; margin: 0 0 20px;
  ${isUser ? 'flex-direction: row-reverse;' : ''}
`;
const av = document.createElement('div');
const avatarColor = isUser ? (customStyling.userCircleColor || 'var(--ciq-blue)') : (customStyling.accentColor || 'var(--ciq-blue)');
av.style.cssText = `
  width:40px; height:40px; border-radius:50%; flex-shrink:0;
  background: ${avatarColor}; color:#fff; font-weight:700; font-size:15px;
  display:flex; align-items:center; justify-content:center;
  box-shadow: 0 10px 22px rgba(36,107,253,.35);
`;
if (isUser) {
  av.textContent = 'U';
} else {
  const firstLetter = (customStyling.agentName || 'ContentIQ').charAt(0).toUpperCase();
  av.textContent = firstLetter;
}

const messageContainer = document.createElement('div');
messageContainer.style.cssText = `flex:1; display:flex; flex-direction:column; align-items:${isUser ? 'flex-end' : 'flex-start'};`;

// Parse sources from the message
const sources = !isUser ? parseSources(message) : [];
const messageWithoutSources = !isUser ? message.replace(/Sources[\s\S]*$/, '').trim() : message;

const bubble = document.createElement('div');
bubble.style.cssText = `
  background:${isUser ? (customStyling.userBubbleColor || 'var(--ciq-blue)') : (customStyling.agentBubbleColor || '#1a1a1a')};
  color:${isUser ? (customStyling.userTextColor || '#fff') : (customStyling.agentTextColor || '#ffffff')};
  padding: 12px 16px;
  border-radius: 20px;
  border: 1px solid ${isUser ? (customStyling.userBubbleColor || 'var(--ciq-blue)') : '#333333'};
  font-size:15px; line-height:1.45; 
  width:${isUser ? 'auto' : '96%'}; 
  max-width:${isUser ? 'none' : '100%'};
  overflow: hidden;
  word-wrap:break-word; 
  overflow-wrap:break-word;
  word-break: break-word;
  hyphens: auto;
  box-sizing: border-box;
  box-shadow:${isUser ? '0 12px 28px rgba(36,107,253,.30)' : '0 8px 22px rgba(0,0,0,.3)'};
`;
bubble.innerHTML = parseMarkdown(messageWithoutSources);

messageContainer.appendChild(bubble);

// Add source cards if sources exist
if (sources && sources.length > 0) {
  // Check current resize state when creating source cards
  const currentExpandedState = ROOT.style.width === '600px';
  const sourceCards = createSourceCards(sources, currentExpandedState);
  if (sourceCards) {
    messageContainer.appendChild(sourceCards);
  }
}

    // Add action icons only for agent messages (not user messages) that have valid message IDs
  if (!isUser && serverMessageId) {
    // Use the server-provided message ID
    const messageId = serverMessageId;
    console.log('[contentIQ widget] Using server message ID');
    
    bubble.dataset.messageId = messageId;
    
    const actionIcons = createActionIcons(message, messageId);
    messageContainer.appendChild(actionIcons);
  } else if (!isUser && !serverMessageId) {
    // For messages without server IDs (like error messages), don't create action icons
    console.log('[contentIQ widget] No message ID provided - skipping action icons');
  }

row.append(av, messageContainer);
chatArea.appendChild(row);
chatArea.scrollTop = chatArea.scrollHeight;
}

function addTypingIndicator() {
  const row = document.createElement('div'); 
  row.id = 'typing-indicator';
  row.style.cssText = `
    display:flex; align-items:flex-start; gap:12px; margin: 0 0 20px;
  `;
  
  const av = document.createElement('div');
  av.style.cssText = `
    width:40px; height:40px; border-radius:50%; flex-shrink:0;
    background: var(--ciq-blue); color:#fff; font-weight:700; font-size:15px;
    display:flex; align-items:center; justify-content:center;
    box-shadow: 0 10px 22px rgba(36,107,253,.35);
  `;
  av.textContent = 'S';

  const messageContainer = document.createElement('div');
  messageContainer.style.cssText = `flex:1; display:flex; flex-direction:column; align-items:flex-start;`;

  const bubble = document.createElement('div');
  bubble.style.cssText = `
    background: var(--bubble);
    color: #000;
    padding: 12px 16px;
    border-radius: 20px;
    border: 1px solid var(--border);
    font-size:15px; line-height:1.45; max-width:80%;
    box-shadow: 0 8px 22px rgba(17,24,39,.06);
    display: flex;
    align-items: center;
    gap: 4px;
  `;
  
  // Create typing dots
  const dots = document.createElement('div');
  dots.style.cssText = `
    display: flex;
    gap: 4px;
    align-items: center;
  `;
  
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.style.cssText = `
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #6B7280;
      animation: typing-dot 1.4s infinite ease-in-out;
      animation-delay: ${i * 0.16}s;
    `;
    dots.appendChild(dot);
  }
  
  bubble.appendChild(dots);
  messageContainer.appendChild(bubble);
  row.append(av, messageContainer);
  chatArea.appendChild(row);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function removeTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

async function sendFeedback(messageId, feedbackType) {
if (!messageId || !feedbackType) {
  console.error('[contentIQ widget] Missing messageId or feedbackType for feedback');
  return;
}

console.log('[contentIQ widget] Sending feedback');

// Check if thread has timed out before sending feedback
const threadTimedOut = checkThreadTimeout();
if (threadTimedOut) {
    console.log('[contentIQ widget] Thread timed out, skipping feedback');
    return;
}

// We need the thread_id which is in the format "widget_{agent_id}_{session_id}"
const threadId = `widget_${AGENT_ID}_${sessionId}`;

try {
  const auth = await buildAuth();
  const res = await fetch(BACKEND + '/api/widget/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Agent-Id': AGENT_ID,
      'X-Session-Id': sessionId || 'new'
    },
    body: JSON.stringify({
      ...auth,
      thread_id: threadId,
      message_id: messageId,
      feedback_type: feedbackType
    })
  });
  
  if (!res.ok) {
    console.error(`[contentIQ widget] Error sending feedback: ${res.status}`);
    return;
  }
  
  const responseData = await res.json();
  console.log('[contentIQ widget] Feedback sent successfully');
  
  // Update session activity
  updateSessionActivity();
  
  return responseData;
} catch (e) {
  console.error('[contentIQ widget] Error sending feedback:', e);
  throw e;
}
}

async function sendMessage(message){
if(!message.trim()) return;
addMessage(message, true);
input.value = '';

// Check if thread has timed out before sending message
const threadTimedOut = checkThreadTimeout();
if (threadTimedOut) {
    console.log('[contentIQ widget] Thread timed out, clearing session for new thread');
    localStorage.removeItem(storageKey);
    sessionId = null;
}

// Update session activity when user sends a message
updateSessionActivity();

// Show typing indicator
addTypingIndicator();

try{
  const auth = await buildAuth();
  const res = await fetch(BACKEND + '/api/widget/chat', {
    method:'POST', 
    headers:{
      'Content-Type':'application/json',
      'X-Agent-Id': AGENT_ID,  // Add agent_id in header for preflight
      'X-Session-Id': sessionId || 'new' // Add session_id in header
    },
    body: JSON.stringify({ ...auth, message })
  });
  
  // Remove typing indicator before processing response
  removeTypingIndicator();
  
  if(!res.ok){ 
    // Don't create message ID for server errors - just show error message
    addMessage(`Error: ${res.status}`, false, null); 
    return; 
  }
  
  // Parse response as JSON to get session_id and message
  const responseData = await res.json();
  const cleanedText = cleanResponse(responseData.assistant);
  
  // Get the message ID from the response if available
  const messageId = responseData.message_id;
  
  // Check if server sent a new session ID (thread timeout)
  const newSessionId = res.headers.get('X-New-Session-ID');
  if (newSessionId) {
      console.log('[contentIQ widget] Server provided new session ID due to thread timeout');
      sessionId = newSessionId;
      
      // Store new session data
      const sessionData = {
          sessionId: sessionId,
          lastActivity: Date.now(),
          created: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(sessionData));
      console.log('[contentIQ widget] New session stored after thread timeout');
  }
  
  // Log the message ID for debugging
  console.log('[contentIQ widget] Received server response');
  
  // Add the message to the UI with the server's message ID
  // If messageId is undefined, null, or empty, addMessage will generate a random UUID
  addMessage(cleanedText, false, messageId);
  
  // Store the message ID for later use - make sure it's the server's ID
  const finalMessageId = messageId;
  console.log('[contentIQ widget] Setting up delayed feedback');
  
  // Send neutral feedback after a delay if no feedback is given
  // Only send feedback for messages with valid server IDs
  if (finalMessageId) {
    setTimeout(() => {
    
    // Find the message bubble by ID
    const messageBubbles = document.querySelectorAll('[data-message-id]');
    let targetBubble = null;
    
    for (const bubble of messageBubbles) {
      if (bubble.dataset.messageId === finalMessageId) {
        targetBubble = bubble;
        break;
      }
    }
    
    // If we found the bubble and no feedback has been given yet
    if (targetBubble) {
      const parentContainer = targetBubble.parentElement;
      if (parentContainer) {
        const feedbackButtons = parentContainer.querySelectorAll('[data-feedback-button].selected-feedback');
        
        // If no feedback button is selected, send neutral feedback
        if (feedbackButtons.length === 0) {
          console.log('[contentIQ widget] No feedback given, sending neutral feedback');
          sendFeedback(finalMessageId, 'neutral').catch(err => {
            console.error('[contentIQ widget] Error sending neutral feedback:', err);
          });
        }
      }
    } else {
      console.warn('[contentIQ widget] Could not find message bubble for feedback');
    }
    }, 30000); // Wait 30 seconds before sending neutral feedback
  }
  
  // Store session ID for future requests (only if not already handled by X-New-Session-ID header)
  if (!newSessionId && responseData.session_id && responseData.session_id !== sessionId) {
    sessionId = responseData.session_id;
    const sessionData = {
      sessionId: sessionId,
      lastActivity: Date.now(),
      created: Date.now()
    };
    localStorage.setItem(storageKey, JSON.stringify(sessionData));
    console.log('[contentIQ widget] New session stored');
  } else {
    // Update activity even if session ID didn't change
    updateSessionActivity();
  }
}catch(e){
  // Remove typing indicator on error
  removeTypingIndicator();
  
  // Network errors or other exceptions - don't create message ID for these either
  addMessage('Sorry, I encountered an error. Please try again.', false, null);
  console.error('[contentIQ widget] Network or other error:', e);
}
}

/* events (unchanged) */
input.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && input.value.trim()) sendMessage(input.value.trim()); });
sendButton.addEventListener('click', ()=>{ if(input.value.trim()) sendMessage(input.value.trim()); });
micButton.addEventListener('click', ()=> console.log('Voice input clicked'));

})(); // End of immediate loading function
