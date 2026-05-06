// ============================================
// 관리자 패널
// ============================================

let adminAllWords = [];
let adminAllExamItems = [];
let adminCurrentTab = 'users';

async function loadAdminPanel() {
  // 관리자 권한 확인
  if (!currentUser?._isAdmin) {
    toast('관리자 권한이 없어요');
    showScreen('s-main-choice');
    return;
  }

  const infoEl = document.getElementById('admin-info-text');

  adminSwitchTab('users');

  // 유저 수 집계
  const { count, error } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true });
  if (!error && infoEl) infoEl.textContent = `총 ${count || 0}명`;

  // 단어 + 기출문제 미리 로드
  loadAdminWords();
  loadAdminExams();

  // 유저 목록 로드
  loadAdminUsers();
}

function adminSwitchTab(tab) {
  adminCurrentTab = tab;
  const tabs = ['users', 'words', 'exams'];
  tabs.forEach(t => {
    const panel = document.getElementById(`admin-panel-${t}`);
    const btn = document.getElementById(`admin-tab-${t}`);
    if (panel) panel.style.display = t === tab ? 'block' : 'none';
    if (btn) {
      btn.className = t === tab ? 'btn-indigo' : 'btn-gray';
      btn.style.padding = '8px 16px';
      btn.style.fontSize = '13px';
    }
  });
}

// ── 유저 관리 ──────────────────────────────

async function loadAdminUsers(query = '') {
  const list = document.getElementById('admin-user-list');
  const empty = document.getElementById('admin-user-empty');
  if (list) list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--muted);">불러오는 중...</div>';

  let req = supabaseClient.from('profiles').select('id, username, is_admin, created_at').order('created_at', { ascending: false }).limit(50);
  if (query) req = req.or(`username.ilike.%${query}%`);

  const { data, error } = await req;
  if (error || !data) {
    if (list) list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--muted);">불러오기 실패</div>';
    return;
  }

  if (data.length === 0) {
    if (list) list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  if (list) list.innerHTML = data.map(u => `
    <div style="background:var(--card); border:1.5px solid var(--border); border-radius:10px; padding:14px 16px; display:flex; align-items:center; gap:12px;">
      <div style="flex:1;">
        <div style="font-weight:700; font-size:14px;">${escapeHtml(u.username || '(이름 없음)')}</div>
        <div style="font-size:12px; color:var(--muted); font-family:var(--f-mono); margin-top:2px;">${u.id.slice(0,8)}... · ${u.created_at ? new Date(u.created_at).toLocaleDateString('ko') : '?'}</div>
      </div>
      ${u.is_admin ? '<span style="background:var(--indigo); color:#fff; font-size:11px; padding:2px 8px; border-radius:20px;">관리자</span>' : ''}
      <button class="btn-gray" style="padding:5px 12px; font-size:12px;" onclick="adminToggleAdmin('${u.id}', ${!u.is_admin}, '${escapeHtml(u.username || '')}')">
        ${u.is_admin ? '권한 해제' : '관리자 지정'}
      </button>
    </div>
  `).join('');
}

async function adminToggleAdmin(userId, makeAdmin, username) {
  if (!confirm(`"${username}"을(를) ${makeAdmin ? '관리자로 지정' : '관리자에서 해제'}하시겠어요?`)) return;
  const { error } = await supabaseClient.from('profiles').update({ is_admin: makeAdmin }).eq('id', userId);
  if (error) { toast('변경 실패: ' + error.message); return; }
  toast(makeAdmin ? '관리자로 지정했어요' : '권한을 해제했어요');
  loadAdminUsers(document.getElementById('admin-user-search')?.value || '');
}

function adminSearchUsers() {
  const q = document.getElementById('admin-user-search')?.value.trim() || '';
  clearTimeout(adminSearchUsers._t);
  adminSearchUsers._t = setTimeout(() => loadAdminUsers(q), 300);
}

// ── 단어 관리 ──────────────────────────────

async function loadAdminWords() {
  const { data, error } = await supabaseClient.from('words').select('*').eq('is_custom', false).order('id');
  adminAllWords = data || [];
  adminRenderWords(adminAllWords);
}

function adminRenderWords(words) {
  const list = document.getElementById('admin-word-list');
  const empty = document.getElementById('admin-word-empty');

  if (!words.length) {
    if (list) list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  if (list) list.innerHTML = words.slice(0, 100).map(w => `
    <div style="background:var(--card); border:1.5px solid var(--border); border-radius:8px; padding:12px 14px; display:flex; align-items:flex-start; gap:10px;">
      <div style="flex:1; min-width:0;">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
          <span style="font-weight:700; font-size:13px;">${escapeHtml(w.word)}</span>
          <span style="font-size:11px; color:var(--muted); background:var(--bg); border:1px solid var(--border); padding:1px 7px; border-radius:10px;">${w.exam}/${w.part}</span>
        </div>
        <div style="font-size:12px; color:var(--text); line-height:1.5;">${escapeHtml(w.meaning || '')}</div>
        ${w.context ? `<div style="font-size:11px; color:var(--muted); margin-top:3px;">${escapeHtml(w.context)}</div>` : ''}
      </div>
      <div style="display:flex; gap:6px; flex-shrink:0;">
        <button class="btn-gray" style="padding:4px 10px; font-size:11px;" onclick="adminOpenWordEdit(${w.id})">편집</button>
        <button class="btn-gray" style="padding:4px 10px; font-size:11px; color:#ef4444;" onclick="adminDeleteWord(${w.id}, '${escapeHtml(w.word)}')">삭제</button>
      </div>
    </div>
  `).join('');

  if (words.length > 100) {
    list.innerHTML += `<div style="text-align:center; padding:12px; color:var(--muted); font-size:12px;">검색어를 입력하면 더 정확한 결과를 볼 수 있어요 (현재 100개 표시)</div>`;
  }
}

function adminSearchWords() {
  const q = (document.getElementById('admin-word-search')?.value || '').toLowerCase();
  const exam = document.getElementById('admin-word-exam-filter')?.value || '';
  let filtered = adminAllWords;
  if (exam) filtered = filtered.filter(w => w.exam === exam);
  if (q) filtered = filtered.filter(w => w.word.toLowerCase().includes(q) || (w.meaning || '').toLowerCase().includes(q));
  adminRenderWords(filtered);
}

function adminOpenWordEdit(wordId) {
  const w = adminAllWords.find(x => x.id === wordId);
  if (!w) return;
  document.getElementById('edit-word-id').value = wordId;
  document.getElementById('edit-word-word').value = w.word;
  document.getElementById('edit-word-meaning').value = w.meaning || '';
  document.getElementById('edit-word-context').value = w.context || '';
  openModal('m-admin-word-edit');
}

async function adminSaveWord() {
  const id = parseInt(document.getElementById('edit-word-id').value);
  const word = document.getElementById('edit-word-word').value.trim();
  const meaning = document.getElementById('edit-word-meaning').value.trim();
  const context = document.getElementById('edit-word-context').value.trim();
  if (!word || !meaning) { toast('단어와 의미를 입력해주세요'); return; }

  toast('저장 중...');
  const { error } = await supabaseClient.from('words').update({ word, meaning, context }).eq('id', id);
  if (error) { toast('저장 실패: ' + error.message); return; }

  // 로컬 캐시 업데이트
  const idx = adminAllWords.findIndex(x => x.id === id);
  if (idx >= 0) adminAllWords[idx] = { ...adminAllWords[idx], word, meaning, context };

  toast('✅ 저장되었어요');
  closeModal('m-admin-word-edit');
  adminSearchWords();

  // 전역 DB도 업데이트
  await loadWordsFromDB();
}

async function adminDeleteWord(wordId, wordText) {
  if (!confirm(`"${wordText}" 단어를 삭제하시겠어요? 이 작업은 되돌릴 수 없어요.`)) return;
  const { error } = await supabaseClient.from('words').delete().eq('id', wordId);
  if (error) { toast('삭제 실패: ' + error.message); return; }
  adminAllWords = adminAllWords.filter(x => x.id !== wordId);
  toast('삭제했어요');
  adminSearchWords();
  await loadWordsFromDB();
}

// ── 기출문제 관리 ──────────────────────────

async function loadAdminExams() {
  const { data, error } = await supabaseClient.from('past_exams').select('*').order('exam_key').order('q_num');
  adminAllExamItems = data || [];

  // 회차 필터 옵션 채우기
  const select = document.getElementById('admin-exam-key-filter');
  if (select) {
    const keys = [...new Set(adminAllExamItems.map(e => e.exam_key))].sort();
    keys.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      const p = k.split('_');
      opt.textContent = p.length >= 3 ? `${p[0]==='jcs'?'정처기':p[0]==='toeic'?'토익':p[0]} ${p[1]}년 ${p[2]}회` : k;
      select.appendChild(opt);
    });
  }

  adminRenderExams(adminAllExamItems);
}

function adminRenderExams(exams) {
  const list = document.getElementById('admin-exam-list');
  const empty = document.getElementById('admin-exam-empty');

  if (!exams.length) {
    if (list) list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  if (list) list.innerHTML = exams.slice(0, 80).map(e => {
    const p = e.exam_key.split('_');
    const keyLabel = p.length >= 3 ? `${p[0]==='jcs'?'정처기':p[0]==='toeic'?'토익':p[0]} ${p[1]}년 ${p[2]}회` : e.exam_key;
    return `
      <div style="background:var(--card); border:1.5px solid var(--border); border-radius:8px; padding:12px 14px; display:flex; align-items:flex-start; gap:10px;">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:5px;">
            <span style="font-size:11px; color:var(--muted); background:var(--bg); border:1px solid var(--border); padding:1px 7px; border-radius:10px;">${keyLabel} · Q${e.q_num}</span>
          </div>
          <div style="font-size:13px; line-height:1.6; white-space:pre-wrap;">${escapeHtml((e.question || '').slice(0, 120))}${e.question?.length > 120 ? '...' : ''}</div>
          <div style="font-size:12px; color:var(--indigo); margin-top:4px; font-weight:600;">정답: ${escapeHtml(String(e.answer || ''))}</div>
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn-gray" style="padding:4px 10px; font-size:11px;" onclick="adminOpenExamEdit(${e.id})">편집</button>
          <button class="btn-gray" style="padding:4px 10px; font-size:11px; color:#ef4444;" onclick="adminDeleteExam(${e.id}, ${e.q_num})">삭제</button>
        </div>
      </div>`;
  }).join('');

  if (exams.length > 80) {
    list.innerHTML += `<div style="text-align:center; padding:12px; color:var(--muted); font-size:12px;">검색어를 입력하면 더 정확한 결과를 볼 수 있어요 (현재 80개 표시)</div>`;
  }
}

function adminSearchExams() {
  const q = (document.getElementById('admin-exam-search')?.value || '').toLowerCase();
  const key = document.getElementById('admin-exam-key-filter')?.value || '';
  let filtered = adminAllExamItems;
  if (key) filtered = filtered.filter(e => e.exam_key === key);
  if (q) filtered = filtered.filter(e => (e.question || '').toLowerCase().includes(q));
  adminRenderExams(filtered);
}

function adminOpenExamEdit(examId) {
  const e = adminAllExamItems.find(x => x.id === examId);
  if (!e) return;
  document.getElementById('edit-exam-id').value = examId;
  document.getElementById('edit-exam-question').value = e.question || '';
  document.getElementById('edit-exam-answer').value = e.answer != null ? String(e.answer) : '';
  document.getElementById('edit-exam-options').value = e.options ? JSON.stringify(e.options, null, 2) : '';
  openModal('m-admin-exam-edit');
}

async function adminSaveExam() {
  const id = parseInt(document.getElementById('edit-exam-id').value);
  const question = document.getElementById('edit-exam-question').value.trim();
  const answer = document.getElementById('edit-exam-answer').value.trim();
  const optionsRaw = document.getElementById('edit-exam-options').value.trim();

  if (!question) { toast('문제 내용을 입력해주세요'); return; }

  let options = null;
  if (optionsRaw) {
    try { options = JSON.parse(optionsRaw); }
    catch { toast('선택지 JSON 형식이 올바르지 않아요'); return; }
  }

  toast('저장 중...');
  const { error } = await supabaseClient.from('past_exams').update({ question, answer, options }).eq('id', id);
  if (error) { toast('저장 실패: ' + error.message); return; }

  const idx = adminAllExamItems.findIndex(x => x.id === id);
  if (idx >= 0) adminAllExamItems[idx] = { ...adminAllExamItems[idx], question, answer, options };

  toast('✅ 저장되었어요');
  closeModal('m-admin-exam-edit');
  adminSearchExams();

  await loadPastExamsFromDB();
}

async function adminDeleteExam(examId, qNum) {
  if (!confirm(`Q${qNum} 문제를 삭제하시겠어요? 이 작업은 되돌릴 수 없어요.`)) return;
  const { error } = await supabaseClient.from('past_exams').delete().eq('id', examId);
  if (error) { toast('삭제 실패: ' + error.message); return; }
  adminAllExamItems = adminAllExamItems.filter(x => x.id !== examId);
  toast('삭제했어요');
  adminSearchExams();
  await loadPastExamsFromDB();
}

// ── 유틸 ──────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
