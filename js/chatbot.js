// ============================================
// AI 챗봇 플로팅 버튼 & 채팅창
// ============================================

(function () {
  // 채팅 기록
  let chatHistory = [];
  let isOpen = false;
  let isLoading = false;

  // ── HTML 삽입 ──────────────────────────────
  const container = document.createElement('div');
  container.id = 'ai-chat-root';
  container.innerHTML = `
    <style>
      #ai-chat-root * { box-sizing: border-box; }

      /* 플로팅 버튼 */
      #ai-fab {
        position: fixed;
        bottom: 28px;
        right: 28px;
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 18px;
        background: var(--indigo, #6366f1);
        color: white;
        border: none;
        border-radius: 50px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(99,102,241,0.45);
        transition: transform 0.2s, box-shadow 0.2s;
        font-family: inherit;
      }
      #ai-fab:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 28px rgba(99,102,241,0.55);
      }
      #ai-fab:active { transform: translateY(0); }
      #ai-fab .fab-emoji { font-size: 20px; }

      /* 채팅창 */
      #ai-chatbox {
        position: fixed;
        bottom: 90px;
        right: 28px;
        z-index: 9998;
        width: 340px;
        max-height: 500px;
        background: var(--card, #fff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 20px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;

        /* 애니메이션 */
        opacity: 0;
        transform: translateY(16px) scale(0.97);
        pointer-events: none;
        transition: opacity 0.22s ease, transform 0.22s ease;
      }
      #ai-chatbox.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      /* 채팅창 헤더 */
      #ai-chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: var(--indigo, #6366f1);
        color: white;
      }
      #ai-chat-header .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 14px;
      }
      #ai-chat-header .header-dot {
        width: 8px; height: 8px;
        background: #4ade80;
        border-radius: 50%;
        animation: pulse-dot 2s infinite;
      }
      @keyframes pulse-dot {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }
      #ai-chat-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 26px; height: 26px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 14px;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s;
      }
      #ai-chat-close:hover { background: rgba(255,255,255,0.35); }

      /* 메시지 영역 */
      #ai-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
      }
      #ai-chat-messages::-webkit-scrollbar { width: 4px; }
      #ai-chat-messages::-webkit-scrollbar-thumb { background: var(--border, #e5e7eb); border-radius: 4px; }

      /* 말풍선 */
      .ai-msg {
        max-width: 82%;
        padding: 10px 13px;
        border-radius: 16px;
        font-size: 13.5px;
        line-height: 1.55;
        word-break: break-word;
        animation: msg-in 0.18s ease;
      }
      @keyframes msg-in {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .ai-msg.user {
        align-self: flex-end;
        background: var(--indigo, #6366f1);
        color: white;
        border-bottom-right-radius: 4px;
      }
      .ai-msg.bot {
        align-self: flex-start;
        background: var(--bg2, #f3f4f6);
        color: var(--text, #111);
        border-bottom-left-radius: 4px;
      }

      /* 로딩 점 */
      .ai-typing {
        align-self: flex-start;
        background: var(--bg2, #f3f4f6);
        padding: 12px 16px;
        border-radius: 16px;
        border-bottom-left-radius: 4px;
        display: flex; gap: 5px; align-items: center;
        animation: msg-in 0.18s ease;
      }
      .ai-typing span {
        width: 7px; height: 7px;
        background: var(--muted, #9ca3af);
        border-radius: 50%;
        animation: bounce-dot 1.2s infinite;
      }
      .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
      .ai-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes bounce-dot {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
      }

      /* 입력창 */
      #ai-chat-input-area {
        display: flex;
        gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid var(--border, #e5e7eb);
        background: var(--card, #fff);
      }
      #ai-chat-input {
        flex: 1;
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 20px;
        padding: 9px 14px;
        font-size: 13.5px;
        outline: none;
        resize: none;
        font-family: inherit;
        background: var(--bg, #f9fafb);
        color: var(--text, #111);
        transition: border-color 0.15s;
        line-height: 1.4;
        max-height: 80px;
        overflow-y: auto;
      }
      #ai-chat-input:focus { border-color: var(--indigo, #6366f1); }
      #ai-chat-input::placeholder { color: var(--muted, #9ca3af); }
      #ai-chat-send {
        width: 36px; height: 36px;
        background: var(--indigo, #6366f1);
        border: none;
        border-radius: 50%;
        color: white;
        font-size: 15px;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        align-self: flex-end;
        transition: background 0.15s, transform 0.15s;
      }
      #ai-chat-send:hover { background: #4f46e5; transform: scale(1.08); }
      #ai-chat-send:disabled { background: var(--border, #e5e7eb); cursor: not-allowed; transform: none; }

      /* 초기 안내 메시지 */
      #ai-chat-empty {
        text-align: center;
        color: var(--muted, #9ca3af);
        font-size: 13px;
        padding: 20px 10px;
        line-height: 1.6;
      }
      #ai-chat-empty .empty-emoji { font-size: 32px; margin-bottom: 8px; }
    </style>

    <!-- 플로팅 버튼 -->
    <button id="ai-fab" onclick="toggleChatbot()">
      <span class="fab-emoji">😵</span>
      <span>도움!</span>
    </button>

    <!-- 채팅창 -->
    <div id="ai-chatbox">
      <div id="ai-chat-header">
        <div class="header-left">
          <div class="header-dot"></div>
          AI 학습 도우미
        </div>
        <button id="ai-chat-close" onclick="toggleChatbot()">✕</button>
      </div>

      <div id="ai-chat-messages">
        <div id="ai-chat-empty">
          <div class="empty-emoji">🤖</div>
          모르는 문제나 개념을<br>자유롭게 질문해보세요!
        </div>
      </div>

      <div id="ai-chat-input-area">
        <textarea id="ai-chat-input" placeholder="질문을 입력하세요..." rows="1"></textarea>
        <button id="ai-chat-send" onclick="sendChatMessage()">➤</button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // ── 채팅창 열기/닫기 ──────────────────────
  window.toggleChatbot = function () {
    isOpen = !isOpen;
    document.getElementById('ai-chatbox').classList.toggle('open', isOpen);
    if (isOpen) {
      setTimeout(() => document.getElementById('ai-chat-input').focus(), 220);
    }
  };

  // ── 메시지 추가 ────────────────────────────
  function addMessage(role, text) {
    const messagesEl = document.getElementById('ai-chat-messages');
    const empty = document.getElementById('ai-chat-empty');
    if (empty) empty.remove();

    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const messagesEl = document.getElementById('ai-chat-messages');
    const empty = document.getElementById('ai-chat-empty');
    if (empty) empty.remove();

    const div = document.createElement('div');
    div.className = 'ai-typing';
    div.id = 'ai-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById('ai-typing-indicator');
    if (el) el.remove();
  }

  // ── 메시지 전송 ────────────────────────────
  window.sendChatMessage = async function () {
    const input = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-chat-send');
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = '';
    input.style.height = 'auto';
    addMessage('user', text);

    chatHistory.push({ role: 'user', content: text });

    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    try {
      const response = await fetch(
        `${SUPABASE_URL}functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ messages: chatHistory })
        }
      );

      if (!response.ok) throw new Error('응답 오류');

      const data = await response.json();
      const reply = data.content[0].text;

      chatHistory.push({ role: 'assistant', content: reply });
      removeTyping();
      addMessage('bot', reply);

    } catch (err) {
      removeTyping();
      addMessage('bot', '죄송해요, 오류가 발생했어요. 다시 시도해주세요.');
      chatHistory.pop();
    }

    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  };

  // ── 엔터키 전송 (Shift+Enter는 줄바꿈) ────
  document.getElementById('ai-chat-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // ── 입력창 자동 높이 ───────────────────────
  document.getElementById('ai-chat-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

})();
