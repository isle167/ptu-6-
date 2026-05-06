// ============================================
// 오답노트 (Supabase 연동)
// ============================================

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
  const groups = {}; wrongNote.forEach(item => { const label = item.examLabel || '기타'; if(!groups[label]) groups[label] = []; groups[label].push(item); });
  partGrid.innerHTML = Object.keys(groups).map(label => {
    const items = groups[label], isJcs = label.includes('정처기') || label.includes('정보처리'), 
      color = isJcs ? 'var(--indigo)' : (label==='커스텀' || label==='추가한 문제' ? 'var(--amber)' : 'var(--green)'), 
      bgColor = isJcs ? 'var(--indigo-t)' : (label==='커스텀' || label==='추가한 문제' ? 'var(--amber-t)' : 'var(--green-t)');
    return `<div class="part-card" style="border-color:${color}; background:${bgColor}" onclick="showWrongWords('${label}')"><div class="part-card-cnt" style="background:white; color:${color}">${items.length}단어</div><div class="part-name" style="color:${color}; font-weight:700; font-size:16px;">${label}</div><div class="part-desc">클릭하여 오답 확인 및 복습</div></div>`;
  }).join('');
}

function showWrongWords(label) {
  if(typeof playSound === 'function') playSound(sfx.button);
  const filteredNotes = wrongNote.filter(n => (n.examLabel || '기타') === label);
  document.getElementById('wrong-main-title').textContent = '오답 노트'; 
  document.getElementById('wrong-cnt').textContent = '';
  document.getElementById('wrong-sub-title').textContent = label; 
  document.getElementById('wrong-part-view').style.display = 'none'; 
  document.getElementById('wrong-word-view').style.display = 'flex';
  const list = document.getElementById('wrong-list'); isWordMasked = false; isMeanMasked = false; list.className = 'note-list';
  list.innerHTML = filteredNotes.map((item) => {
    const originalIndex = wrongNote.findIndex(n => n.w === item.w);
    return `<div class="note-item"><div class="note-word" onclick="this.classList.toggle('revealed')">${item.w}</div><div class="note-info"><div class="note-mean" onclick="this.classList.toggle('revealed')">${item.m}</div><div class="note-meta">${(item.cnt||1)>1 ? `<span class="note-cnt">⚠ ${item.cnt}회 틀림</span>` : ''} ${item.hinted ? `<span class="hint-mark">△ 힌트</span>` : ''}</div></div><button class="note-del" onclick="delWrong(${originalIndex}, '${label}')">✕</button></div>`;
  }).join('');
  document.getElementById('wrong-list-count').innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"><div class="mask-toggles" style="display:flex; gap:8px;"><button id="btn-mask-word" class="mask-btn" onclick="toggleMask('word')">단어 가리기</button><button id="btn-mask-mean" class="mask-btn" onclick="toggleMask('mean')">뜻 가리기</button></div><span>${filteredNotes.length}개</span></div>`;
  document.getElementById('wrong-actions').innerHTML = `<button class="btn-amber" onclick="playWrongPart('${label}')" style="flex:1">이 파트 오답만 다시 풀기 →</button><button class="btn-gray" onclick="clearWrongPart('${label}')">전체 삭제</button>`;
}

function toggleMask(type) {
  playSound(sfx.button); const list = document.getElementById('wrong-list');
  if (type === 'word') { isWordMasked = !isWordMasked; document.getElementById('btn-mask-word').classList.toggle('active', isWordMasked); list.classList.toggle('mask-word', isWordMasked); } 
  else { isMeanMasked = !isMeanMasked; document.getElementById('btn-mask-mean').classList.toggle('active', isMeanMasked); list.classList.toggle('mask-mean', isMeanMasked); }
}

async function delWrong(i, currentLabel){
  playSound(sfx.button); 
  const filtered = currentLabel ? wrongNote.filter(w => w.examLabel === currentLabel) : wrongNote; 
  const target = filtered[i]; if (!target) return;
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
  const w = document.getElementById('f-word').value.trim(), m = document.getElementById('f-mean').value.trim(), c = document.getElementById('f-ctx').value.trim(), cat = document.getElementById('f-cat').value.trim() || '커스텀';
  if (!w || !m) { toast('단어와 의미는 필수예요'); return; }
  if (!currentUser) { toast('로그인이 필요해요'); return; }
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
