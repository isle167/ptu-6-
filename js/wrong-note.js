// ============================================
// 오답노트 (Supabase 연동)
// ============================================

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function jsArg(value) {
  return JSON.stringify(String(value ?? '')).replace(/"/g, '&quot;');
}

function formatSavedDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getWrongGroups() {
  const groups = {};
  wrongNote.forEach(item => {
    const label = item.examLabel || '기타';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });
  return Object.entries(groups)
    .map(([label, items]) => ({
      label,
      items: items.slice().sort((a, b) => (b.cnt || 1) - (a.cnt || 1) || (b.savedAt || 0) - (a.savedAt || 0))
    }))
    .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label, 'ko'));
}

const wrongFilterState = { query: '', sort: 'count', onlyRepeat: false, onlyHint: false };

function getFilteredWrongNotes(label) {
  const q = wrongFilterState.query.toLowerCase();
  let notes = wrongNote.filter(n => !label || (n.examLabel || '기타') === label);
  if (q) {
    notes = notes.filter(n => [n.w, n.m, n.c, n.part, n.examLabel]
      .some(v => String(v || '').toLowerCase().includes(q)));
  }
  if (wrongFilterState.onlyRepeat) notes = notes.filter(n => (n.cnt || 1) > 1);
  if (wrongFilterState.onlyHint) notes = notes.filter(n => n.hinted);
  return notes.sort((a, b) => {
    if (wrongFilterState.sort === 'recent') return (b.savedAt || 0) - (a.savedAt || 0);
    if (wrongFilterState.sort === 'word') return String(a.w || '').localeCompare(String(b.w || ''), 'ko');
    return (b.cnt || 1) - (a.cnt || 1) || (b.savedAt || 0) - (a.savedAt || 0);
  });
}

window.updateWrongFilter = function(key, value, label) {
  if (key === 'onlyRepeat' || key === 'onlyHint') wrongFilterState[key] = Boolean(value);
  else wrongFilterState[key] = value;
  if (label) showWrongWords(label);
  else showWrongParts();
};

async function saveWrong(){
  if(typeof playSound === 'function') playSound(sfx.button);
  if(sessionWrong.length===0){toast('저장할 오답이 없어요 🎉');return;}
  if(!currentUser){toast('로그인이 필요해요');return;}
  let added = 0, updated = 0;
  for (const item of sessionWrong) {
    const exists = wrongNote.find(n => n.w === item.w);
    if (exists) {
      const newCount = (exists.cnt || 1) + 1, newHinted = exists.hinted || item.hinted;
      const { error } = await supabaseClient.from('wrong_notes').update({ count: newCount, hinted: newHinted }).eq('id', exists.id);
      if (!error) { exists.cnt = newCount; exists.hinted = newHinted; updated++; }
    } else {
      const { data, error } = await supabaseClient.from('wrong_notes').insert({ user_id: currentUser.id, word: item.w, meaning: item.m, context: item.c || null, exam: item.exam, exam_label: item.examLabel, part: item.part || partKey, count: 1, hinted: item.hinted || false }).select().single();
      if (!error && data) { wrongNote.unshift({ id: data.id, w: data.word, m: data.meaning, c: data.context || '', exam: data.exam, examLabel: data.exam_label, part: data.part, cnt: data.count, hinted: data.hinted, savedAt: new Date(data.saved_at).getTime() }); added++; }
    }
  }
  toast(`오답노트에 ${added}개 추가, ${updated}개 업데이트!`); sessionWrong = [];
}

function renderWrong(){ showWrongParts(); }

function showWrongParts() {
  const cnt = wrongNote.length; 
  document.getElementById('wrong-main-title').textContent = '오답 노트'; 
  document.getElementById('wrong-cnt').textContent = '총 ' + cnt + '개';
  const partView = document.getElementById('wrong-part-view'), wordView = document.getElementById('wrong-word-view'), partGrid = document.getElementById('wrong-part-grid');
  partView.style.display = 'block'; wordView.style.display = 'none';
  if(cnt === 0) { 
    partGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; padding-top:40px;"><div class="empty-icon">📋</div><div class="empty-text">아직 저장된 오답이 없어요</div></div>`; 
    return; 
  }
  partGrid.className = 'part-grid wrong-group-grid';
  const filtered = getFilteredWrongNotes();
  const groups = {};
  filtered.forEach(item => {
    const label = item.examLabel || '기타';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });
  const grouped = Object.entries(groups)
    .map(([label, items]) => ({ label, items }))
    .sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label, 'ko'));
  const controls = `<div class="wrong-filter-panel" style="grid-column:1/-1;">
    <input class="form-input" value="${escapeHtml(wrongFilterState.query)}" placeholder="단어, 뜻, 파트 검색" oninput="updateWrongFilter('query', this.value)">
    <select class="form-input" onchange="updateWrongFilter('sort', this.value)">
      <option value="count" ${wrongFilterState.sort === 'count' ? 'selected' : ''}>많이 틀린 순</option>
      <option value="recent" ${wrongFilterState.sort === 'recent' ? 'selected' : ''}>최근 저장 순</option>
      <option value="word" ${wrongFilterState.sort === 'word' ? 'selected' : ''}>가나다 순</option>
    </select>
    <label class="filter-check"><input type="checkbox" ${wrongFilterState.onlyRepeat ? 'checked' : ''} onchange="updateWrongFilter('onlyRepeat', this.checked)"> 반복 오답</label>
    <label class="filter-check"><input type="checkbox" ${wrongFilterState.onlyHint ? 'checked' : ''} onchange="updateWrongFilter('onlyHint', this.checked)"> 힌트 사용</label>
  </div>`;
  partGrid.innerHTML = controls + (grouped.length ? grouped.map(({ label, items }) => {
    const repeatCount = items.filter(item => (item.cnt || 1) > 1).length;
    const hintCount = items.filter(item => item.hinted).length;
    const isJcs = label.includes('정처기') || label.includes('정보처리'), 
      color = isJcs ? 'var(--indigo)' : (label==='커스텀' || label==='추가한 문제' ? 'var(--amber)' : 'var(--green)'), 
      bgColor = isJcs ? 'var(--indigo-t)' : (label==='커스텀' || label==='추가한 문제' ? 'var(--amber-t)' : 'var(--green-t)');
    return `<div class="part-card wrong-group-card" style="border-color:${color}; background:${bgColor}" onclick="showWrongWords(${jsArg(label)})">
      <div class="part-card-cnt" style="background:white; color:${color}">${items.length}개</div>
      <div class="part-name" style="color:${color}; font-weight:800; font-size:16px;">${escapeHtml(label)}</div>
      <div class="part-desc">많이 틀린 항목부터 정렬 · 바로 복습 가능</div>
      <div class="wrong-card-meta">
        <span>반복 ${repeatCount}</span>
        <span>힌트 ${hintCount}</span>
      </div>
    </div>`;
  }).join('') : `<div class="empty-state" style="grid-column:1/-1; padding-top:30px;"><div class="empty-icon">🔎</div><div class="empty-text">조건에 맞는 오답이 없어요</div></div>`);
}

function showWrongWords(label) {
  if(typeof playSound === 'function') playSound(sfx.button);
  const filteredNotes = getFilteredWrongNotes(label);
  document.getElementById('wrong-main-title').textContent = '오답 노트'; 
  document.getElementById('wrong-cnt').textContent = '';
  document.getElementById('wrong-sub-title').textContent = label; 
  document.getElementById('wrong-part-view').style.display = 'none'; 
  document.getElementById('wrong-word-view').style.display = 'flex';
  const list = document.getElementById('wrong-list'); isWordMasked = false; isMeanMasked = false; list.className = 'note-list';
  list.innerHTML = filteredNotes.map((item) => {
    const originalIndex = wrongNote.findIndex(n => n.w === item.w);
    return `<div class="note-item wrong-note-item">
      <div class="note-word" onclick="this.classList.toggle('revealed')">${escapeHtml(item.w)}</div>
      <div class="note-info">
        <div class="note-mean" onclick="this.classList.toggle('revealed')">${escapeHtml(item.m)}</div>
        ${item.c ? `<div class="note-context">${escapeHtml(item.c)}</div>` : ''}
        <div class="note-meta">
          <span class="note-chip strong">${item.cnt || 1}회</span>
          ${item.hinted ? `<span class="note-chip">힌트 사용</span>` : ''}
          ${item.part ? `<span class="note-chip">${escapeHtml(item.part)}</span>` : ''}
          ${item.savedAt ? `<span class="note-chip">${formatSavedDate(item.savedAt)}</span>` : ''}
        </div>
      </div>
      <button class="note-del" title="삭제" onclick="delWrong(${originalIndex}, ${jsArg(label)})">✕</button>
    </div>`;
  }).join('');
  document.getElementById('wrong-list-count').innerHTML = `<div class="wrong-toolbar"><div class="mask-toggles"><input class="form-input wrong-search-inline" value="${escapeHtml(wrongFilterState.query)}" placeholder="이 파트에서 검색" oninput="updateWrongFilter('query', this.value, ${jsArg(label)})"><button id="btn-mask-word" class="mask-btn" onclick="toggleMask('word')">단어 가리기</button><button id="btn-mask-mean" class="mask-btn" onclick="toggleMask('mean')">뜻 가리기</button></div><span>${filteredNotes.length}개</span></div>`;
  document.getElementById('wrong-actions').innerHTML = `<button class="btn-amber" onclick="playWrongPart(${jsArg(label)})" style="flex:1">이 파트 오답만 다시 풀기 →</button><button class="btn-gray" onclick="clearWrongPart(${jsArg(label)})">전체 삭제</button>`;
}

function toggleMask(type) {
  playSound(sfx.button); const list = document.getElementById('wrong-list');
  if (type === 'word') { isWordMasked = !isWordMasked; document.getElementById('btn-mask-word').classList.toggle('active', isWordMasked); list.classList.toggle('mask-word', isWordMasked); } 
  else { isMeanMasked = !isMeanMasked; document.getElementById('btn-mask-mean').classList.toggle('active', isMeanMasked); list.classList.toggle('mask-mean', isMeanMasked); }
}

async function delWrong(i, currentLabel){
  playSound(sfx.button); 
  const target = wrongNote[i]; if (!target) return;
  const { error } = await supabaseClient.from('wrong_notes').delete().eq('id', target.id);
  if (!error) { wrongNote = wrongNote.filter(w => w.id !== target.id); if (currentLabel) showWrongWords(currentLabel); else showWrongParts(); }
}

async function clearWrongPart(label){
  playSound(sfx.button); if (!confirm(`"${label}" 파트의 오답을 모두 삭제할까요?`)) return;
  const { error } = await supabaseClient.from('wrong_notes').delete().eq('user_id', currentUser.id).eq('exam_label', label);
  if (!error) { wrongNote = wrongNote.filter(w => w.examLabel !== label); toast('삭제됐어요'); showWrongParts(); }
}

function playWrongPart(label){
  playSound(sfx.button); 
  const filteredNotes = wrongNote.filter(n => (n.examLabel || '기타') === label); 
  if(filteredNotes.length === 0) return;
  exam = label.includes('TOEIC') ? 'toeic' : 'jcs'; 
  openModeSelect(filteredNotes.map(n=>({w:n.w, m:n.m, c:n.c||''})), `${label} 오답 복습`);
}

// 커스텀 단어 (Supabase)
async function addCustom(){
  playSound(sfx.button);
  const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
  const w = clean(document.getElementById('f-word').value), m = clean(document.getElementById('f-mean').value), c = clean(document.getElementById('f-ctx').value), cat = clean(document.getElementById('f-cat').value) || '커스텀';
  if (!w || !m) { toast('단어와 의미는 필수예요'); return; }
  if (!currentUser) { toast('로그인이 필요해요'); return; }
  const exists = customWords.some(item => item.w.toLowerCase() === w.toLowerCase() && (item.cat || '커스텀') === cat);
  if (exists) { toast('이미 추가한 문제예요'); return; }
  const { data, error } = await supabaseClient.from('words').insert({ exam: 'custom', part: cat, word: w, meaning: m, context: c || null, is_custom: true, created_by: currentUser.id }).select().single();
  if (!error && data) { customWords.unshift({ id: data.id, w: data.word, m: data.meaning, c: data.context || '', cat: data.part }); ['f-word','f-mean','f-ctx','f-cat'].forEach(id=>document.getElementById(id).value=''); toast('문제 추가됨!'); renderCustom(); }
}

function renderCustom(){
  const list=document.getElementById('custom-list'), empty=document.getElementById('custom-empty'), playBtn=document.getElementById('play-custom-btn');
  if(customWords.length===0){list.style.display='none';empty.style.display='block';playBtn.disabled=true;return;}
  list.style.display='flex';empty.style.display='none';playBtn.disabled=false;
  list.innerHTML=customWords.map((item,i)=>`<div class="custom-item"><div class="ci-word">${item.w}</div><div class="ci-info"><div class="ci-mean">${item.m}</div>${item.c?`<div class="ci-ctx">${item.c}</div>`:''}${item.cat?`<span class="ci-cat">#${item.cat}</span>`:''}</div><button class="ci-del" onclick="delCustom(${i})">✕</button></div>`).join('');
}

async function delCustom(i){
  playSound(sfx.button); const target = customWords[i]; if (!target) return;
  const { error } = await supabaseClient.from('words').delete().eq('id', target.id);
  if (!error) { customWords.splice(i, 1); renderCustom(); }
}

function playCustom(){
  playSound(sfx.button); if(customWords.length===0){toast('추가된 문제가 없어요');return;}
  exam=exam||'jcs'; openModeSelect(customWords.map(c=>({w:c.w,m:c.m,c:c.c||''})),'추가한 문제');
}

document.getElementById('f-word').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('f-mean').focus();});
