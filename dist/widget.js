/* contentIQ Chat Widget – local dev version
 * -------------------------------------------------------------
 * Mounts a modern chat interface inside the placeholder div and
 * talks to the backend with signed site-token + replay-safe ts|sig.
 */

(async () => {
    // Locate elements & dataset values supplied by embed snippet
    const ROOT = document.querySelector('.contentiq_symplisticai_chat');
    if (!ROOT) {
      console.error('[contentIQ widget] Root DIV not found');
      return;
    }
    const AGENT_ID   = ROOT.dataset.agent;
    const SCRIPT_TAG = document.currentScript;
    const SITE_TOKEN = SCRIPT_TAG.dataset.token;
    const BACKEND    = SCRIPT_TAG.dataset.backend || 'http://localhost:1234';
  
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
  


    /* ============ ============ ============ ============ 
        CSS & JS FOR STYLING THE WIDGET
    ============ ============ ============ =============== */




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
  color: #000;
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
const logo = document.createElement('div');
// logo.style.cssText = `
//   width: 36px; height: 36px; border-radius: 50%;
//   background: var(--ciq-blue); color:#fff; font-weight:700; font-size:14px;
//   display:flex; align-items:center; justify-content:center; flex-shrink:0;
//   box-shadow: 0 10px 22px rgba(36,107,253,.35); margin-top: 10px;
// `;
// logo.textContent = 'S';
const title = document.createElement('div');
title.innerHTML = '<span style="color:#000;">symplistic.</span><span style="color:var(--ciq-blue)">contentIQ</span>';
title.style.cssText = `
  font-weight: 800; font-size: 18px; letter-spacing:.2px; margin-top: 10px;
  margin-left: -18px;
`;
const timestamp = document.createElement('div');
timestamp.style.cssText = `display:none;`; /* hide in header per screenshot */
timestamp.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
header.append(logo, title, timestamp, closeButton);

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
botAvatar.textContent = 'S';

const messageContent = document.createElement('div');
messageContent.style.cssText = `flex:1;`;

const botName = document.createElement('div');
botName.style.cssText = `
  font-weight:700; font-size:15px; color:#000; margin: 4px 0 8px; display:flex; align-items:center; gap:12px;
`;
botName.textContent = 'ContentIQ';

/* thin, rounded, airy bubble like screenshot */
const messageBubble = document.createElement('div');
messageBubble.style.cssText = `
  background: var(--bubble);
  border: 1px solid var(--border);
  color:#000;
  padding: 14px 16px;
  border-radius: 20px;
  font-size: 15px; line-height: 1.45;
  max-width: 86%;
  box-shadow: 0 8px 22px rgba(17,24,39,.06);
  margin-bottom: 16px;
`;
messageBubble.textContent = "Welcome to symplistic.ai! Ask me anything!";

/* action icon row under bubble */
const actionIcons = document.createElement('div');
actionIcons.style.cssText = `display:flex; gap:12px; align-items:center; margin-left:2px;`;
['copy','thumbs-up','thumbs-down'].forEach(icon=>{
  const chip=document.createElement('div');
  chip.style.cssText = `
    width:28px; height:28px;
    display:flex; align-items:center; justify-content:center;
    border-radius:10px; background:#F3F5FA; border:1px solid var(--border);
    cursor:pointer; transition: background .15s ease, border-color .15s ease, transform .1s ease;
    box-shadow: 0 3px 8px rgba(17,24,39,.05);
  `;
  chip.innerHTML = getIconSVG(icon);
  chip.onmouseover = ()=>{ chip.style.background='#EEF2FF'; chip.style.borderColor='var(--ciq-blue)'; chip.style.transform='translateY(-1px)'; };
  chip.onmouseout  = ()=>{ chip.style.background='#F3F5FA'; chip.style.borderColor='var(--border)'; chip.style.transform='none'; };
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
  background: linear-gradient(180deg, #F6F8FC 0%, #F5F7FB 100%);
  border: 1px solid #E3E9F3;
  border-radius: 22px;
  padding: 0 76px 0 50px;            /* room for mic + right breathing */
  font-size: 16px; color: #111827; outline: none;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.75),
    0 12px 28px rgba(17,24,39,.06);
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
  .contentiq_symplisticai_chat input::placeholder { color:#9AA3AF; opacity:1; }

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
`;


document.head.appendChild(_ciqStyle);

/* Disclaimer text */
const disclaimer = document.createElement('div');
disclaimer.style.cssText = `
  font-size: 11px;
  color: #6B7280;
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
chatIcon.textContent = 'S';

/* Create full chat interface (initially hidden) */
const chatInterface = document.createElement('div');
chatInterface.style.cssText = `
  width: 420px; height: 650px;
  display: none; flex-direction: column; overflow: hidden;
  border-radius: 22px;
  border: 1px solid #ECEEF5;
  background: radial-gradient(circle at center, #FFFFFF 0%, #F0EEFF 30%, #E0D8FF 60%, #D0C8FF 80%);
  box-shadow: 0 22px 48px rgba(17,24,39,0.18), 0 2px 8px rgba(17,24,39,0.06);
`;

/* Toggle function */
let isOpen = false;
function toggleChat() {
  isOpen = !isOpen;
  
  if (isOpen) {
    // Expand to full chat
    ROOT.style.width = '420px';
    ROOT.style.height = '650px';
    ROOT.style.borderRadius = '22px';
    ROOT.style.flexDirection = 'column';
    ROOT.style.overflow = 'hidden';
    chatIcon.style.display = 'none';
    chatInterface.style.display = 'flex';
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
  
  let html = text
    // Bold text: **text** or __text__
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    
    // Italic text: *text* or _text_
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    
    // Code: `code`
    .replace(/`(.*?)`/g, '<code>$1</code>')
    
    // Line breaks
    .replace(/\n/g, '<br>')
    
    // Bullet points: * item or - item
    .replace(/^\s*[\*\-]\s+(.+)$/gm, '<li>$1</li>')
    
    // Numbered lists: 1. item
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');
  
  // Wrap lists in ul/ol tags
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  
  return html;
}

/* ===== icons (unchanged) ===== */
function getIconSVG(type){
  const icons = {
    copy:'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
    'thumbs-up':'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>',
    'thumbs-down':'<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>',
    mic:'<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/></svg>',
         send:'<svg width="22" height="22" viewBox="0 0 24 24" fill="white" style="transform: translateX(1px);"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>'
  };
  return icons[type] || '';
}

/* ===== messaging logic (unchanged) ===== */
function createActionIcons(messageText) {
  const actionIcons = document.createElement('div');
  actionIcons.style.cssText = `display:flex; gap:12px; align-items:center; margin-left:2px; margin-top:8px;`;
  ['copy','thumbs-up','thumbs-down'].forEach(icon=>{
    const chip=document.createElement('div');
    chip.style.cssText = `
      width:28px; height:28px;
      display:flex; align-items:center; justify-content:center;
      border-radius:10px; background:#F3F5FA; border:1px solid var(--border);
      cursor:pointer; transition: background .15s ease, border-color .15s ease, transform .1s ease;
      box-shadow: 0 3px 8px rgba(17,24,39,.05);
    `;
    chip.innerHTML = getIconSVG(icon);
    chip.onmouseover = ()=>{ chip.style.background='#EEF2FF'; chip.style.borderColor='var(--ciq-blue)'; chip.style.transform='translateY(-1px)'; };
    chip.onmouseout  = ()=>{ chip.style.background='#F3F5FA'; chip.style.borderColor='var(--border)'; chip.style.transform='none'; };
    
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
            chip.style.background = '#F3F5FA';
            chip.style.borderColor = 'var(--border)';
            chip.style.color = 'currentColor';
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
    
    actionIcons.appendChild(chip);
  });
  return actionIcons;
}

function addMessage(message, isUser=false){
  const row = document.createElement('div');
  row.style.cssText = `
    display:flex; align-items:flex-start; gap:12px; margin: 0 0 20px;
    ${isUser ? 'flex-direction: row-reverse;' : ''}
  `;
  const av = document.createElement('div');
  av.style.cssText = `
    width:40px; height:40px; border-radius:50%; flex-shrink:0;
    background: var(--ciq-blue); color:#fff; font-weight:700; font-size:15px;
    display:flex; align-items:center; justify-content:center;
    box-shadow: 0 10px 22px rgba(36,107,253,.35);
  `;
  av.textContent = isUser ? 'U' : 'S';

  const messageContainer = document.createElement('div');
  messageContainer.style.cssText = `flex:1; display:flex; flex-direction:column; align-items:${isUser ? 'flex-end' : 'flex-start'};`;

  const bubble = document.createElement('div');
  bubble.style.cssText = `
    background:${isUser ? 'var(--ciq-blue)' : 'var(--bubble)'};
    color:${isUser ? '#fff' : '#000'};
    padding: 12px 16px;
    border-radius: 20px;
    border: 1px solid ${isUser ? 'var(--ciq-blue)' : 'var(--border)'};
    font-size:15px; line-height:1.45; max-width:80%; word-wrap:break-word; overflow-wrap:break-word;
    box-shadow:${isUser ? '0 12px 28px rgba(36,107,253,.30)' : '0 8px 22px rgba(17,24,39,.06)'};
  `;
  bubble.innerHTML = parseMarkdown(message);

  messageContainer.appendChild(bubble);
  
  // Add action icons only for agent messages (not user messages)
  if (!isUser) {
    const actionIcons = createActionIcons(message);
    messageContainer.appendChild(actionIcons);
  }

  row.append(av, messageContainer);
  chatArea.appendChild(row);
  chatArea.scrollTop = chatArea.scrollHeight;
}

async function sendMessage(message){
  if(!message.trim()) return;
  addMessage(message, true);
  input.value = '';
  try{
    const auth = await buildAuth();
    const res = await fetch(BACKEND + '/api/widget/chat', {
      method:'POST', 
      headers:{
        'Content-Type':'application/json',
        'X-Agent-Id': AGENT_ID  // Add agent_id in header for preflight
      },
      body: JSON.stringify({ ...auth, message })
    });
    if(!res.ok){ addMessage(`Error: ${res.status}`, false); return; }
    const text = await res.text();
    const cleanedText = cleanResponse(text);
    addMessage(cleanedText, false);
  }catch(e){
    addMessage('Sorry, I encountered an error. Please try again.', false);
    console.error(e);
  }
}

/* events (unchanged) */
input.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && input.value.trim()) sendMessage(input.value.trim()); });
sendButton.addEventListener('click', ()=>{ if(input.value.trim()) sendMessage(input.value.trim()); });
micButton.addEventListener('click', ()=> console.log('Voice input clicked'));
})();