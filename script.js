import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/+esm";

// --- ⚙️ CONFIGURAÇÃO DOS CLUSTERS ---
const CLUSTERS = { 
    "Cluster1": "Madras1/APIDOST",   // O Grandão (Google, Mistral, Groq)
    "Cluster2": "Madras1/APISMALL"   // O Rápido (DeepSeek, Qwen)
};

let clients = {};
let selectedFile = null; 
let soundEnabled = true;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- 🎵 SOUND ENGINE ---
function playSound(type) {
    if (!soundEnabled) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'message') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'error') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// --- 🎛️ UI CONTROLS ---

// Liga/Desliga Som
window.toggleSound = function() {
    soundEnabled = !soundEnabled;
    const icon = document.getElementById('sndIconUse');
    icon.setAttribute('href', soundEnabled ? '#icon-volume-2' : '#icon-volume-x');
    document.getElementById('soundBtn').style.opacity = soundEnabled ? '1' : '0.5';
}

// Lógica do Dropdown Customizado
window.toggleDropdown = function() {
    const menu = document.getElementById('dropdownMenu');
    menu.classList.toggle('active');
}

window.selectModel = function(value, label) {
    const select = document.getElementById('modelSelector');
    select.value = value;
    document.getElementById('selectedModelLabel').innerText = label;
    document.getElementById('dropdownMenu').classList.remove('active');
}

// Fecha o dropdown se clicar fora
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('customDropdown');
    const menu = document.getElementById('dropdownMenu');
    if (dropdown && !dropdown.contains(e.target)) {
        menu.classList.remove('active');
    }
});

// Exportar conversa
window.exportChat = function() {
    let text = "";
    document.querySelectorAll('.message').forEach(msg => {
        const role = msg.classList.contains('user') ? "USER" : "NEXUS";
        const content = msg.querySelector('.message-bubble').innerText;
        text += `[${role}]: ${content}\n\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type: 'text/plain'}));
    a.download = `nexus_export_${Date.now()}.txt`;
    a.click();
}

// Limpar conversa
window.clearChat = function() {
    document.getElementById('chat-history').innerHTML = '';
    appendMessage('bot', 'Memory Core Purged. System Ready.');
}

// --- 📎 FILE HANDLING ---
window.handleFileSelect = function(e) {
    const file = e.target.files[0];
    if (!file) return;
    selectedFile = file;
    document.getElementById('imagePreview').src = URL.createObjectURL(file);
    document.getElementById('imageName').innerText = file.name;
    document.getElementById('imagePreviewContainer').style.display = 'flex';
    document.getElementById('imagePreviewContainer').classList.remove('hidden');
    userInput.focus();
}

window.clearImage = function() {
    selectedFile = null;
    document.getElementById('fileInput').value = "";
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('imagePreviewContainer').classList.add('hidden');
}

// --- 🎙️ VOICE INPUT ---
window.toggleVoice = function() {
    if (!('webkitSpeechRecognition' in window)) return alert("Voice input not supported in this browser.");
    const btn = document.getElementById('micBtn');
    if (window.recognition_active) {
        window.recognition.stop();
        return;
    }
    const r = new webkitSpeechRecognition();
    r.lang = 'pt-BR';
    r.onstart = () => { window.recognition_active = true; btn.classList.add('active'); };
    r.onend = () => { window.recognition_active = false; btn.classList.remove('active'); };
    r.onresult = (e) => {
        document.getElementById('userInput').value += " " + e.results[0][0].transcript;
        adjustTextarea();
    };
    r.start();
    window.recognition = r;
}

// Copiar código
window.copyCode = function(btn) {
    const code = btn.closest('.code-wrapper').querySelector('code').innerText;
    navigator.clipboard.writeText(code);
    const original = btn.innerHTML;
    btn.innerHTML = `<svg class="icon-sm"><use href="#icon-check"/></svg> COPIED`;
    setTimeout(() => btn.innerHTML = original, 2000);
}

// Enviar com Enter
window.handleEnter = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

// --- 🚀 CORE LOGIC ---
const userInput = document.getElementById('userInput');
const historyDiv = document.getElementById('chat-history');

function adjustTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
}
userInput.addEventListener('input', adjustTextarea);

// Inicialização: Conecta nos Clusters (SEM TOKEN)
async function init() {
    const welcomeMsgId = appendMessage('bot', 'Initializing Neural Clusters...', false);
    try {
        // Conexão direta pública
        clients['Cluster1'] = await Client.connect(CLUSTERS['Cluster1']);
        clients['Cluster2'] = await Client.connect(CLUSTERS['Cluster2']);
        
        const msgEl = document.getElementById(welcomeMsgId);
        if(msgEl) msgEl.remove();

        appendMessage('bot', '**NEXUS ONLINE.** All Systems Operational.');
    } catch(e) {
        appendMessage('bot', `❌ **Connection Failed:** ${e.message}`);
    }
}
init();

window.sendMessage = async function() {
    const text = userInput.value.trim();
    if (!text && !selectedFile) return;
    
    // Recupera cluster e modelo
    const [cluster, model] = document.getElementById('modelSelector').value.split('|');
    
    if (!clients[cluster]) return appendMessage('bot', '⚠️ Error: Cluster Offline or Connecting...');

    // Limpa UI
    userInput.value = '';
    userInput.style.height = 'auto';
    let displayHtml = text.replace(/\n/g, '<br>');
    if (selectedFile) displayHtml += `<br><small>📎 Attached: ${selectedFile.name}</small>`;
    
    appendMessage('user', displayHtml, true);
    playSound('message');

    // Indicador de "Digitando..."
    const loadingId = `loading-${Date.now()}`;
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message bot';
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML = `
        <div class="avatar"><svg class="icon-sm" style="width:20px;height:20px;"><use href="#icon-cpu"/></svg></div>
        <div class="message-content">
            <div class="typing-container">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    historyDiv.appendChild(loadingDiv);
    historyDiv.scrollTop = historyDiv.scrollHeight;
    
    // API Call
    try {
        const result = await clients[cluster].predict("/chat", [
            { text: text, files: selectedFile ? [selectedFile] : [] }, 
            [],     
            model   
        ]);
        
        document.getElementById(loadingId).remove();
        
        const response = result.data ? String(result.data[0]) : "No Response.";
        appendMessage('bot', response);
        playSound('message');
    } catch (e) {
        document.getElementById(loadingId).remove();
        appendMessage('bot', `**Error:** ${e.message}`);
        playSound('error');
    } finally {
        clearImage();
    }
}

// --- 🎨 RENDERIZADOR ---
marked.setOptions({
    highlight: (code, lang) => {
        const l = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, {language: l}).value;
    }
});

const renderer = new marked.Renderer();
renderer.code = (code, lang) => {
    const l = (lang || 'text').split(' ')[0];
    const valid = hljs.getLanguage(l) ? l : 'text';
    const highlighted = hljs.highlight(code, {language: valid}).value;
    return `
        <div class="code-wrapper">
            <div class="code-header">
                <span class="code-lang">${valid}</span>
                <button class="copy-btn" onclick="copyCode(this)">
                    <svg class="icon-sm"><use href="#icon-copy"/></svg> COPY
                </button>
            </div>
            <pre><code class="hljs language-${valid}">${highlighted}</code></pre>
        </div>
    `;
};
marked.use({renderer});

function appendMessage(role, text, isHtml=false) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.id = `msg-${Date.now()}`;
    
    const avatarHtml = role === 'bot' 
        ? `<div class="avatar"><svg class="icon-sm" style="width:20px;height:20px;"><use href="#icon-cpu"/></svg></div>`
        : ``;

    let content = text;
    if (role === 'bot' && !isHtml) {
        content = marked.parse(text);
    }

    div.innerHTML = `
        ${avatarHtml}
        <div class="message-content">
            <div class="message-bubble">${isHtml ? content : content}</div>
        </div>
    `;
    
    historyDiv.appendChild(div);
    historyDiv.scrollTop = historyDiv.scrollHeight;
    return div.id;
}
