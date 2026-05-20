// ============================================
// AI 챗봇 플로팅 버튼 & 채팅창
// ============================================

(function () {
  // 채팅 기록
  let chatHistory = [];           // 현재 진행 중인 대화 (AI에게 전달)
  let previousHistory = [];       // 닫힐 때 저장된 이전 대화
  let isOpen = false;
  let isLoading = false;
  let suggestedLoaded = false;
  let lastContextHash = '';
  let previousExpanded = false;   // 이전 기록이 펼쳐져 있는지
  const QUICK_SUGGESTIONS = ['이 문제 쉽게 설명해줘', '핵심만 요약해줘', '암기 팁 알려줘', '비슷한 예시 보여줘'];
  const CHAT_TIMEOUT_MS = 18000;
  const SUGGEST_TIMEOUT_MS = 8000;
  const MAX_CONTEXT_MESSAGES = 8;
  const AI_DAILY_LIMIT = 40;
  const AI_COOLDOWN_MS = 2500;
  let lastChatSentAt = 0;

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
        top: 70px;
        bottom: 90px;
        right: 28px;
        z-index: 9998;
        width: 380px;
        background: var(--card, #fff);
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 20px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;

        opacity: 0;
        transform: translateY(16px) scale(0.97);
        pointer-events: none;
        transition: opacity 0.12s ease, transform 0.12s ease;
      }
      #ai-chatbox.open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      @media (max-height: 600px) {
        #ai-chatbox { top: 60px; bottom: 80px; }
      }
      @media (max-width: 480px) {
        #ai-fab {
          right: 14px;
          bottom: 14px;
          padding: 11px 14px;
        }
        #ai-chatbox {
          width: auto;
          top: 12px;
          bottom: 72px;
          left: 12px;
          right: 12px;
          border-radius: 16px;
        }
        #ai-suggest-area { padding: 10px; }
        .ai-suggest-chip, .ai-quick-chip { width: 100%; border-radius: 12px; }
        .ai-msg { max-width: 92%; }
      }

      /* 헤더 */
      #ai-chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: var(--indigo, #6366f1);
        color: white;
        flex-shrink: 0;
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

      /* 예상 질문 영역 */
      #ai-suggest-area {
        padding: 12px 14px 10px;
        border-bottom: 1px solid var(--border, #e5e7eb);
        background: var(--bg, #f9fafb);
        flex-shrink: 0;
      }
      #ai-suggest-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      #ai-suggest-title {
        font-size: 11px;
        letter-spacing: 1.5px;
        font-family: var(--f-mono, monospace);
        color: var(--muted, #9ca3af);
        font-weight: 600;
      }
      #ai-suggest-refresh {
        background: none;
        border: none;
        color: var(--muted, #9ca3af);
        cursor: pointer;
        font-size: 13px;
        padding: 2px 6px;
        border-radius: 6px;
        transition: all 0.15s;
        line-height: 1;
      }
      #ai-suggest-refresh:hover {
        background: var(--bg2, #f3f4f6);
        color: var(--indigo, #6366f1);
      }
      #ai-suggest-refresh:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      #ai-suggest-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      #ai-quick-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }
      .ai-suggest-chip, .ai-quick-chip {
        background: var(--card, #fff);
        border: 1px solid var(--border, #e5e7eb);
        color: var(--text, #111);
        padding: 7px 12px;
        border-radius: 20px;
        font-size: 12.5px;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
        line-height: 1.3;
        text-align: left;
      }
      .ai-quick-chip {
        background: var(--indigo-t, #eef2ff);
        color: var(--indigo, #6366f1);
        border-color: var(--indigo, #6366f1);
        font-weight: 700;
      }
      .ai-suggest-chip:hover, .ai-quick-chip:hover {
        background: var(--indigo, #6366f1);
        color: white;
        border-color: var(--indigo, #6366f1);
        transform: translateY(-1px);
      }
      .ai-suggest-chip:active, .ai-quick-chip:active { transform: translateY(0); }
      .ai-suggest-loading {
        font-size: 12px;
        color: var(--muted, #9ca3af);
        padding: 4px 0;
        font-family: var(--f-mono, monospace);
        letter-spacing: 0.5px;
      }
      .ai-suggest-empty {
        font-size: 12px;
        color: var(--muted, #9ca3af);
        padding: 4px 0;
      }

      /* 이전 기록 보기 버튼 */
      #ai-history-bar {
        flex-shrink: 0;
        display: none;
        padding: 8px 12px;
        background: var(--bg, #f9fafb);
        border-bottom: 1px solid var(--border, #e5e7eb);
      }
      #ai-history-bar.show { display: block; }
      #ai-history-toggle {
        width: 100%;
        background: var(--card, #fff);
        border: 1px solid var(--border, #e5e7eb);
        color: var(--muted, #9ca3af);
        padding: 7px 12px;
        border-radius: 8px;
        font-size: 12px;
        cursor: pointer;
        font-family: var(--f-mono, monospace);
        letter-spacing: 0.5px;
        transition: all 0.15s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      #ai-history-toggle:hover {
        border-color: var(--indigo, #6366f1);
        color: var(--indigo, #6366f1);
      }

      /* 이전 기록 영역 */
      #ai-history-messages {
        display: none;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
        background: var(--bg2, #f3f4f6);
        border-bottom: 1px dashed var(--border, #e5e7eb);
        max-height: 50%;
        overflow-y: auto;
        flex-shrink: 0;
      }
      #ai-history-messages.show { display: flex; }
      #ai-history-messages::-webkit-scrollbar { width: 4px; }
      #ai-history-messages::-webkit-scrollbar-thumb { background: var(--border, #e5e7eb); border-radius: 4px; }
      .ai-history-divider {
        font-size: 10px;
        color: var(--muted, #9ca3af);
        font-family: var(--f-mono, monospace);
        letter-spacing: 1px;
        text-align: center;
        padding: 4px 0;
      }
      .ai-msg.history { opacity: 0.7; }

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

      .ai-msg {
        max-width: 82%;
        padding: 10px 13px;
        border-radius: 16px;
        font-size: 13.5px;
        line-height: 1.55;
        word-break: break-word;
        animation: msg-in 0.1s ease;
        white-space: pre-wrap;
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
      .ai-msg .img-tag {
        display: inline-block;
        font-size: 11px;
        background: rgba(255,255,255,0.25);
        padding: 2px 7px;
        border-radius: 10px;
        margin-bottom: 4px;
        font-family: var(--f-mono, monospace);
      }
      .ai-msg.bot .img-tag {
        background: var(--border, #e5e7eb);
        color: var(--muted, #6b7280);
      }

      /* 로딩 점 */
      .ai-typing {
        align-self: flex-start;
        background: var(--bg2, #f3f4f6);
        padding: 12px 16px;
        border-radius: 16px;
        border-bottom-left-radius: 4px;
        display: flex; gap: 5px; align-items: center;
        animation: msg-in 0.1s ease;
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
        flex-shrink: 0;
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

      /* 초기 안내 */
      #ai-chat-empty {
        text-align: center;
        color: var(--muted, #9ca3af);
        font-size: 13px;
        padding: 20px 10px;
        line-height: 1.6;
      }
      #ai-chat-empty .empty-emoji { font-size: 32px; margin-bottom: 8px; }
    </style>

    <button id="ai-fab" onclick="toggleChatbot()">
      <span class="fab-emoji">😵</span>
      <span>도움!</span>
    </button>

    <div id="ai-chatbox">
      <div id="ai-chat-header">
        <div class="header-left">
          <div class="header-dot"></div>
          AI 학습 도우미
        </div>
        <button id="ai-chat-close" onclick="toggleChatbot()">✕</button>
      </div>

      <!-- 예상 질문 -->
      <div id="ai-suggest-area">
        <div id="ai-suggest-header">
          <div id="ai-suggest-title">💡 예상 질문</div>
          <button id="ai-suggest-refresh" onclick="refreshSuggestions()" title="다시 생성">↻</button>
        </div>
        <div id="ai-quick-actions"></div>
        <div id="ai-suggest-chips">
          <div class="ai-suggest-empty">화면을 분석할 준비가 되었어요.</div>
        </div>
      </div>

      <!-- 이전 기록 보기 토글 -->
      <div id="ai-history-bar">
        <button id="ai-history-toggle" onclick="toggleHistory()">
          <span id="ai-history-toggle-text">↶ 이전 기록 보기</span>
        </button>
      </div>

      <!-- 이전 기록 메시지 (펼칠 때만 보임) -->
      <div id="ai-history-messages"></div>

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

  // ── 에러 메시지를 사용자 친화적으로 변환 ──
  function humanizeError(err) {
    const msg = (err && err.message) ? String(err.message).toLowerCase() : '';

    if (msg.includes('credit') && msg.includes('low')) {
      return '⚠️ AI 크레딧이 부족합니다.\n관리자에게 문의해주세요.';
    }
    if (msg.includes('rate_limit') || msg.includes('rate limit')) {
      return '⚠️ 요청이 너무 많습니다.\n잠시 후 다시 시도해주세요.';
    }
    if (msg.includes('invalid') && msg.includes('api') && msg.includes('key')) {
      return '⚠️ API 키 설정에 문제가 있습니다.\n관리자에게 문의해주세요.';
    }
    if (msg.includes('overloaded') || msg.includes('502') || msg.includes('503')) {
      return '⚠️ AI 서버가 혼잡합니다.\n잠시 후 다시 시도해주세요.';
    }
    if (msg.includes('image') || msg.includes('media_type')) {
      return '⚠️ 이미지 처리 중 오류가 발생했습니다.\n다른 화면에서 시도해보세요.';
    }
    if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
      return '⚠️ 네트워크 연결을 확인해주세요.';
    }
    if (msg.includes('timeout') || msg.includes('aborted')) {
      return '⚠️ 응답이 지연되고 있어요.\n질문을 조금 짧게 다시 보내주세요.';
    }
    if (msg.includes('http 4')) {
      return '⚠️ 요청에 문제가 있어요.\n다시 시도해주세요.';
    }
    if (msg.includes('http 5')) {
      return '⚠️ 서버에 일시적 문제가 있어요.\n잠시 후 다시 시도해주세요.';
    }
    return '죄송해요, 오류가 발생했어요. 다시 시도해주세요.';
  }

  async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  function compactHistoryForRequest() {
    if (chatHistory.length <= MAX_CONTEXT_MESSAGES) return chatHistory;
    return chatHistory.slice(-MAX_CONTEXT_MESSAGES);
  }

  function getDailyUsageKey() {
    const day = new Date().toISOString().slice(0, 10);
    const userId = currentUser?.id || 'guest';
    return `te_ai_usage_${userId}_${day}`;
  }

  function getDailyUsage() {
    return Number(localStorage.getItem(getDailyUsageKey()) || '0');
  }

  function incrementDailyUsage() {
    localStorage.setItem(getDailyUsageKey(), String(getDailyUsage() + 1));
  }

  function canSendAiRequest() {
    const now = Date.now();
    if (now - lastChatSentAt < AI_COOLDOWN_MS) {
      return { ok: false, message: '잠시만요. AI 요청은 2초 정도 간격을 두고 보내주세요.' };
    }
    if (getDailyUsage() >= AI_DAILY_LIMIT) {
      return { ok: false, message: `오늘 AI 질문 ${AI_DAILY_LIMIT}회를 모두 사용했어요.\n내일 다시 이용해주세요.` };
    }
    return { ok: true };
  }

  // ── 채팅창 열기/닫기 ──────────────────────
  window.toggleChatbot = function () {
    isOpen = !isOpen;
    document.getElementById('ai-chatbox').classList.toggle('open', isOpen);

      if (isOpen) {
      // 열릴 때: 현재 대화는 비어있어야 함 (이미 닫힐 때 옮겨졌음)
      setTimeout(() => document.getElementById('ai-chat-input').focus(), 60);

      // 이전 기록 버튼 표시 여부
      updateHistoryBar();

      // 예상 질문 로드
      const ctx = collectScreenContext();
      renderQuickActions(ctx);
      const hash = (ctx.contextText + (ctx.imageSrc || '')).slice(0, 200);
      if (!suggestedLoaded || hash !== lastContextHash) {
        lastContextHash = hash;
        suggestedLoaded = true;
        renderSuggestions(fallbackSuggestions(ctx).slice(0, 4));
        loadSuggestions(ctx);
      }
    } else {
      // 닫힐 때: 현재 대화를 이전 기록으로 이관
      if (chatHistory.length > 0) {
        previousHistory = chatHistory.slice();
        chatHistory = [];
      }
      // 메시지 영역 비우기 (다음에 열면 깔끔하게)
      const msgs = document.getElementById('ai-chat-messages');
      msgs.innerHTML = `
        <div id="ai-chat-empty">
          <div class="empty-emoji">🤖</div>
          모르는 문제나 개념을<br>자유롭게 질문해보세요!
        </div>
      `;
      // 이전 기록 영역도 접기
      collapseHistory();
    }
  };

  // ── 이전 기록 바 표시/숨김 갱신 ───────────
  function updateHistoryBar() {
    const bar = document.getElementById('ai-history-bar');
    const toggleText = document.getElementById('ai-history-toggle-text');
    if (previousHistory.length > 0) {
      bar.classList.add('show');
      toggleText.textContent = `↶ 이전 기록 보기 (${previousHistory.length}개 메시지)`;
    } else {
      bar.classList.remove('show');
    }
  }

  // ── 이전 기록 펼치기/접기 ─────────────────
  window.toggleHistory = function () {
    if (previousExpanded) {
      collapseHistory();
    } else {
      expandHistory();
    }
  };

  function expandHistory() {
    const histEl = document.getElementById('ai-history-messages');
    const toggleText = document.getElementById('ai-history-toggle-text');
    histEl.innerHTML = '';

    previousHistory.forEach(msg => {
      const div = document.createElement('div');
      div.className = `ai-msg history ${msg.role === 'user' ? 'user' : 'bot'}`;

      // content가 배열(이미지 포함)인 경우와 문자열인 경우 처리
      if (Array.isArray(msg.content)) {
        let textPart = '';
        let hasImage = false;
        msg.content.forEach(c => {
          if (c.type === 'text') textPart += c.text;
          if (c.type === 'image') hasImage = true;
        });
        if (hasImage) {
          const tag = document.createElement('div');
          tag.className = 'img-tag';
          tag.textContent = '🖼 이미지 첨부';
          div.appendChild(tag);
        }
        const txt = document.createElement('div');
        txt.textContent = textPart;
        div.appendChild(txt);
      } else {
        div.textContent = msg.content;
      }
      histEl.appendChild(div);
    });

    const divider = document.createElement('div');
    divider.className = 'ai-history-divider';
    divider.textContent = '─── 이전 기록 끝 ───';
    histEl.appendChild(divider);

    histEl.classList.add('show');
    toggleText.textContent = '▲ 이전 기록 접기';
    previousExpanded = true;
  }

  function collapseHistory() {
    const histEl = document.getElementById('ai-history-messages');
    const toggleText = document.getElementById('ai-history-toggle-text');
    histEl.classList.remove('show');
    histEl.innerHTML = '';
    if (previousHistory.length > 0) {
      toggleText.textContent = `↶ 이전 기록 보기 (${previousHistory.length}개 메시지)`;
    }
    previousExpanded = false;
  }

  // ── 화면 컨텍스트 수집 ─────────────────────
  function collectScreenContext() {
    const screens = document.querySelectorAll('.screen');
    let activeScreen = null;
    for (const s of screens) {
      const cs = window.getComputedStyle(s);
      if (cs.display !== 'none' && s.offsetParent !== null) {
        activeScreen = s;
        break;
      }
    }

    let screenId = activeScreen ? activeScreen.id : 'unknown';
    let contextText = '';
    let screenLabel = '';
    let imageSrc = '';   // 이미지 형식 문제일 때 채워짐

    if (screenId === 's-game') {
      screenLabel = '타이핑 훈련';
      const partName = (document.getElementById('g-pname')?.textContent || '').trim();
      const wcLbl    = (document.getElementById('wc-lbl')?.textContent || '').trim();
      const wcMean   = (document.getElementById('wc-mean')?.textContent || '').trim();
      const wcCtx    = (document.getElementById('wc-ctx')?.textContent || '').trim();
      const hintAns  = (document.getElementById('hint-answer')?.textContent || '').trim();
      const hintDesc = (document.getElementById('hint-desc')?.textContent || '').trim();
      contextText = [
        partName && `파트: ${partName}`,
        wcLbl && wcMean && `${wcLbl}: ${wcMean}`,
        wcCtx && `예문/설명: ${wcCtx}`,
        hintAns && `정답: ${hintAns}`,
        hintDesc && `해설: ${hintDesc}`
      ].filter(Boolean).join('\n');
    } else if (screenId === 's-past-exam') {
      screenLabel = '기출문제 풀이';
      const title = (document.getElementById('past-exam-title')?.textContent || '').trim();
      const textView = document.getElementById('exam-text-view');
      const imgView = document.getElementById('exam-image-view');
      let body = '';
      if (textView && textView.style.display !== 'none') {
        body = (textView.innerText || textView.textContent || '').trim().slice(0, 2000);
      } else if (imgView && imgView.style.display !== 'none' && imgView.src) {
        body = '(이미지 형식 기출문제 - AI가 이미지를 직접 분석합니다)';
        imageSrc = imgView.src;
      }
      contextText = [
        title && `시험: ${title}`,
        body && `문제 내용:\n${body}`
      ].filter(Boolean).join('\n');
    } else if (screenId === 's-wrong' || screenId === 's-exam-wrong') {
      screenLabel = '오답 노트';
      const titleEl = activeScreen?.querySelector('.page-title');
      contextText = titleEl ? `현재 ${titleEl.textContent.trim()} 화면을 보고 있습니다.` : '';
    } else if (screenId === 's-result' || screenId === 's-exam-result') {
      screenLabel = '결과';
      const title = activeScreen?.querySelector('.res-title')?.textContent?.trim() || '';
      contextText = `${title} 결과 화면`;
    } else {
      screenLabel = activeScreen?.querySelector('.page-title, .home-title, .back-title')?.textContent?.trim() || '메인';
      contextText = '';
    }

    return { screenId, screenLabel, contextText, imageSrc };
  }

  // ── 이미지를 base64로 변환 ─────────────────
  async function imageUrlToBase64(url) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // "data:image/png;base64,iVBOR..." 에서 콤마 뒤만 추출
          const result = reader.result;
          const commaIdx = result.indexOf(',');
          const mediaType = result.substring(5, result.indexOf(';'));
          const data = result.substring(commaIdx + 1);
          resolve({ mediaType, data });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('[chatbot] 이미지 base64 변환 실패:', err);
      return null;
    }
  }

  // ── 예상 질문 렌더링 ───────────────────────
  function renderSuggestions(questions) {
    const chipsEl = document.getElementById('ai-suggest-chips');
    chipsEl.innerHTML = '';
    if (!questions || questions.length === 0) {
      chipsEl.innerHTML = '<div class="ai-suggest-empty">예상 질문을 불러오지 못했어요.</div>';
      return;
    }
    questions.forEach(q => {
      const btn = document.createElement('button');
      btn.className = 'ai-suggest-chip';
      btn.textContent = q;
      btn.onclick = () => {
        if (isLoading) return;
        const input = document.getElementById('ai-chat-input');
        input.value = q;
        sendChatMessage();
      };
      chipsEl.appendChild(btn);
    });
  }

  function quickActionsFor(ctx) {
    if (ctx.screenId === 's-game') return ['현재 문제 해설', '정답 암기 팁', '비슷한 개념'];
    if (ctx.screenId === 's-wrong' || ctx.screenId === 's-exam-wrong') return ['오답 복습 계획', '약점 요약', '퀴즈 내줘'];
    if (ctx.screenId === 's-stats') return ['내 약점 분석', '다음 학습 추천'];
    if (ctx.screenId === 's-past-exam') return ['이 기출 해설', '핵심 개념', '함정 포인트'];
    return ['오늘 학습 추천', '시험 전략', '암기 루틴'];
  }

  function renderQuickActions(ctx) {
    const wrap = document.getElementById('ai-quick-actions');
    if (!wrap) return;
    wrap.innerHTML = '';
    quickActionsFor(ctx).forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'ai-quick-chip';
      btn.textContent = label;
      btn.onclick = () => askAiQuick(label);
      wrap.appendChild(btn);
    });
  }

  function showSuggestionsLoading() {
    const chipsEl = document.getElementById('ai-suggest-chips');
    if (!chipsEl.children.length) chipsEl.innerHTML = '<div class="ai-suggest-loading">화면 분석 중...</div>';
  }

  function fallbackSuggestions(ctx) {
    const { screenId, contextText, imageSrc } = ctx;
    if (screenId === 's-game' && contextText) {
      const lines = contextText.split('\n');
      const meanLine = lines.find(l => l.includes(':'));
      const term = meanLine ? meanLine.split(':').slice(1).join(':').trim() : '';
      if (term && term.length < 50) {
        return [
          `${term}이(가) 무슨 뜻이에요?`,
          `${term} 더 쉽게 설명해주세요`,
          `${term} 예제 알려주세요`,
          `이거 외우는 팁 있나요?`
        ];
      }
      return ['이 문제 해설해주세요', '비슷한 개념 더 알려주세요', '쉽게 외우는 방법은?'];
    }
    if (screenId === 's-past-exam') {
      if (imageSrc) {
        return [
          '이 문제 풀이해주세요',
          '핵심 포인트가 뭔가요?',
          '답이 뭐예요?',
          '왜 이게 답이에요?'
        ];
      }
      return [
        '이 문제 풀이 방법을 알려주세요',
        '핵심 개념이 뭔가요?',
        '함정 포인트가 있나요?',
        '비슷한 유형 문제가 있나요?'
      ];
    }
    return QUICK_SUGGESTIONS;
  }

  // ── 예상 질문 로드 (AI 호출) ───────────────
  async function loadSuggestions(ctx) {
    if (!document.querySelector('.ai-suggest-chip')) showSuggestionsLoading();

    // 텍스트도 이미지도 없으면 fallback
    if (!ctx.contextText && !ctx.imageSrc) {
      renderSuggestions(fallbackSuggestions(ctx));
      return;
    }

    // 메시지 content 구성
    let userContent;

    if (ctx.imageSrc) {
      // 이미지가 있으면 이미지 포함 메시지
      const imgData = await imageUrlToBase64(ctx.imageSrc);
      if (!imgData) {
        renderSuggestions(fallbackSuggestions(ctx));
        return;
      }
      userContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: imgData.mediaType,
            data: imgData.data
          }
        },
        {
          type: 'text',
          text: `학생이 위 이미지 형식의 ${ctx.screenLabel} 화면을 보고 있어요. ${ctx.contextText ? '\n\n' + ctx.contextText : ''}\n\n이 학생이 궁금해할 만한 짧은 질문 4개를 생성해주세요.\n규칙:\n- 각 질문은 20자 이내로 짧게\n- 구체적이고 바로 클릭하고 싶은 질문\n- 번호나 불릿 없이, 한 줄에 하나씩\n- 질문만 출력하고 다른 설명은 절대 하지 마세요\n\n질문 4개:`
        }
      ];
    } else {
      // 텍스트만
      userContent = `당신은 학습 도우미입니다. 학생이 지금 다음 화면을 보고 있어요:\n\n[화면: ${ctx.screenLabel}]\n${ctx.contextText}\n\n이 학생이 궁금해할 만한 짧은 질문 4개를 생성해주세요. 규칙:\n- 각 질문은 20자 이내로 짧게\n- 구체적이고 바로 클릭하고 싶은 질문\n- 번호나 불릿 없이, 한 줄에 하나씩\n- 질문만 출력하고 다른 설명은 절대 하지 마세요\n\n질문 4개:`;
    }

    try {
      const response = await fetchWithTimeout(
        `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: userContent }]
          })
        },
        SUGGEST_TIMEOUT_MS
      );
      if (!response.ok) throw new Error('응답 오류');
      const data = await response.json();
      const text = (data.content && data.content[0] && data.content[0].text) || '';
      const questions = text
        .split('\n')
        .map(l => l.replace(/^[\d\.\-\*\)\s]+/, '').replace(/^["']|["']$/g, '').trim())
        .filter(l => l && l.length <= 50 && l.length >= 3)
        .slice(0, 4);

      renderSuggestions(questions.length > 0 ? questions : fallbackSuggestions(ctx));
    } catch (err) {
      console.warn('[chatbot] 예상 질문 생성 실패, fallback 사용:', err);
      renderSuggestions(fallbackSuggestions(ctx));
    }
  }

  window.refreshSuggestions = function () {
    const btn = document.getElementById('ai-suggest-refresh');
    if (btn.disabled) return;
    btn.disabled = true;
    const ctx = collectScreenContext();
    renderQuickActions(ctx);
    lastContextHash = (ctx.contextText + (ctx.imageSrc || '')).slice(0, 200);
    loadSuggestions(ctx).finally(() => {
      setTimeout(() => { btn.disabled = false; }, 1000);
    });
  };

  window.askAiQuick = function (text) {
    if (!isOpen) window.toggleChatbot();
    const input = document.getElementById('ai-chat-input');
    input.value = text;
    sendChatMessage();
  };

  // ── 메시지 추가 ────────────────────────────
  function addMessage(role, text, hasImage) {
    const messagesEl = document.getElementById('ai-chat-messages');
    const empty = document.getElementById('ai-chat-empty');
    if (empty) empty.remove();

    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    if (hasImage) {
      const tag = document.createElement('div');
      tag.className = 'img-tag';
      tag.textContent = '🖼 이미지 첨부';
      div.appendChild(tag);
      const txt = document.createElement('div');
      txt.textContent = text;
      div.appendChild(txt);
    } else {
      div.textContent = text;
    }
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
    const quota = canSendAiRequest();
    if (!quota.ok) {
      addMessage('bot', quota.message);
      return;
    }
    lastChatSentAt = Date.now();

    input.value = '';
    input.style.height = 'auto';

    // 새 대화 시작 시 펼쳐진 이전 기록은 자동으로 접기
    if (chatHistory.length === 0 && previousExpanded) {
      collapseHistory();
    }

    addMessage('user', text, false);
    isLoading = true;
    sendBtn.disabled = true;
    showTyping();

    // 첫 메시지면 화면 컨텍스트 첨부 (이미지 포함 가능)
    let userMessage;

    if (chatHistory.length === 0) {
      const ctx = collectScreenContext();

      if (ctx.imageSrc) {
        // 이미지 포함
        const imgData = await imageUrlToBase64(ctx.imageSrc);
        if (imgData) {
          userMessage = {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imgData.mediaType,
                  data: imgData.data
                }
              },
              {
                type: 'text',
                text: `[학생이 현재 "${ctx.screenLabel}" 화면을 보고 있고, 위 이미지가 그 문제입니다.${ctx.contextText ? '\n' + ctx.contextText : ''}]\n\n${text}`
              }
            ]
          };
        } else {
          // 이미지 변환 실패 시 텍스트로만
          userMessage = { role: 'user', content: text };
        }
      } else if (ctx.contextText) {
        userMessage = {
          role: 'user',
          content: `[참고: 학생이 현재 "${ctx.screenLabel}" 화면을 보고 있습니다.\n${ctx.contextText}]\n\n${text}`
        };
      } else {
        userMessage = { role: 'user', content: text };
      }
    } else {
      userMessage = { role: 'user', content: text };
    }

    chatHistory.push(userMessage);

    try {
      const response = await fetchWithTimeout(
        `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({ messages: compactHistoryForRequest() })
        },
        CHAT_TIMEOUT_MS
      );

      const data = await response.json();

      // 에러 응답 처리 (Anthropic API의 에러 본문을 그대로 받아서 분류)
      if (!response.ok) {
        const apiMsg = (data && data.error && data.error.message) || '';
        throw new Error(apiMsg || `HTTP ${response.status}`);
      }

      const reply = data.content && data.content[0] && data.content[0].text;
      if (!reply) throw new Error('응답 비어있음');

      incrementDailyUsage();
      chatHistory.push({ role: 'assistant', content: reply });
      removeTyping();
      addMessage('bot', reply);

    } catch (err) {
      removeTyping();
      addMessage('bot', humanizeError(err));
      chatHistory.pop();
    }

    isLoading = false;
    sendBtn.disabled = false;
    input.focus();
  };

  // ── 엔터키 전송 ────────────────────────────
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
