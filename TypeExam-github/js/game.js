// ============================================
// 타이핑 게임 로직
// ============================================

let exam=null, partKey=null, words=[], idx=0, typed='';
let combo=0, bestCombo=0, totalWords=0, totalChars=0, totalErrors=0;
let startTime=null, sessionWrong=[], wpmTimer=null;
let isComposing=false, isWordMasked=false, isMeanMasked=false;
let gameMode=null, mixMode=null, hintUsed=false;
let timeLimit=0, remainingTime=0, timerInterval=null;
let lastRankScore=0;
let rankingScore=0, rankingQuestionTime=15, rankingWrongCount=0;
let pendingItems=null, pendingLabel='', lastPlayedItems=null, lastPlayedLabel='';

function isKorean(w){ return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(w); }
function wordsMatch(input, target){
  if(isKorean(target)) return input===target;
  return input.toLowerCase()===target.toLowerCase();
}

function goHome(){
  exam=null; currentExamKey = null;
  ['jcs','toeic'].forEach(k=>{ const el = document.getElementById('card-'+k); if(el) el.classList.remove('selected'); });
  document.getElementById('btn-go').disabled=true;
  if (typeof backToExamList === 'function' && currentMode === 'pastexam') backToExamList();
  showScreen('s-main-choice', false);
}

function selExam(key){
  exam=key;
  ['jcs','toeic'].forEach(k=>{ const el = document.getElementById('card-'+k); if(el) el.classList.remove('selected'); });
  document.getElementById('card-'+key).classList.add('selected');
  document.getElementById('btn-go').disabled=false;
}

function gopart(){
  if(!exam)return;
  const d=DB[exam]; document.getElementById('part-title').textContent=d.name;
  const pkeys=Object.keys(d.parts); document.getElementById('part-cnt').textContent=pkeys.length+'개 파트';
  
  const testBtn = document.getElementById('btn-combo-test');
  if (testBtn) testBtn.style.display = (exam === 'toeic') ? 'block' : 'none';

  const grid=document.getElementById('part-grid'); grid.innerHTML='';
  pkeys.forEach(k=>{
    const pt=d.parts[k]; const el=document.createElement('div'); el.className='part-card';
    el.innerHTML=`<div class="part-card-cnt">${pt.items.length}문항</div><div class="part-name">${k}</div><div class="part-desc">${pt.desc}</div>`;
    el.onclick=()=>{ playSound(sfx.button); openModeSelect(pt.items,k); }
    grid.appendChild(el);
  });
  if(customWords.length>0){
    const el=document.createElement('div'); el.className='part-card custom';
    el.innerHTML=`<div class="part-card-cnt">${customWords.length}문항</div><div class="part-name">✏ 추가한 문제</div><div class="part-desc">내가 추가한 문제 모음</div>`;
    el.onclick=()=>{ playSound(sfx.button); openModeSelect(customWords.map(c=>({w:c.w,m:c.m,c:c.c||''})),'추가한 문제'); }
    grid.appendChild(el);
  }
  showScreen('s-part', false);
}

function chooseMix(mode){
  mixMode = mode;
  ['en','ko','mix'].forEach(m => { const el = document.getElementById('mix-card-' + m); if(el) el.classList.toggle('selected', m === mode); });
  updateStartBtn();
}

function applyMixMode(items){
  if(mixMode === 'en') return items;
  return items.map(item => {
    const useKo = mixMode === 'ko' || (mixMode === 'mix' && Math.random() < 0.5);
    if(!useKo) return item;
    const hasMeaning = item.m && /[가-힣]/.test(item.m);
    if(!hasMeaning) return item;
    // 한글 모드: 뜻을 보여주고 단어를 타이핑
    const meaningWord = item.m.split('—')[0].trim();
    return { w: meaningWord, m: item.w, c: item.c };
  });
}

function updateTimerUI(){ document.getElementById('g-timer').textContent = (gameMode==='timeattack' || gameMode==='ranking') ? formatTime(remainingTime) : '∞'; }

function startTimer(){
  clearInterval(timerInterval); updateTimerUI();
  timerInterval=setInterval(()=>{
    remainingTime--;
    if(remainingTime<=0){
      remainingTime=0; updateTimerUI(); clearInterval(timerInterval);
      if(gameMode === 'ranking') { handleRankingTimeOver(); return; }
      endGame(); return;
    }
    updateTimerUI();
  },1000);
}

function resetRankingQuestionTimer(){
  remainingTime = rankingQuestionTime;
  rankingWrongCount = 0;
  startTimer();
}

function handleRankingTimeOver(){
  if(idx >= words.length) return endGame();
  playSound(sfx.page);
  sessionWrong.push({...words[idx],exam:exam,examLabel:DB[exam]?.badge||'커스텀'});
  totalErrors++;
  combo=0;
  document.getElementById('g-combo').textContent='0';
  document.getElementById('h-combo').style.display='none';
  idx++;
  document.getElementById('g-input').value=''; typed='';
  if(idx>=words.length) return endGame();
  loadWord();
}

function openModeSelect(items,label){
  pendingItems=items; pendingLabel=label;
  document.getElementById('mode-part-label').textContent=label;
  document.getElementById('time-select-box').style.display='none';
  mixMode = null; gameMode = null; timeLimit = 0;
  
  ['en','ko','mix'].forEach(m => { const el = document.getElementById('mix-card-' + m); if(el) el.classList.remove('selected'); });
  ['normal','timeattack','ranking'].forEach(m => { const el = document.getElementById('mode-card-' + m); if(el) el.classList.remove('selected'); });
  document.querySelectorAll('#time-select-box .btn-indigo').forEach(btn => { btn.classList.remove('active-time'); btn.style.background = ''; btn.style.color = ''; });
  updateStartBtn(); showScreen('s-mode', false);
}

function chooseMode(mode){
  gameMode=mode;
  ['normal','timeattack','ranking'].forEach(m => { const el = document.getElementById('mode-card-' + m); if(el) el.classList.toggle('selected', m === mode); });
  const box=document.getElementById('time-select-box');
  if(mode==='timeattack'){
    box.style.display='block'; timeLimit=0;
    document.querySelectorAll('#time-select-box .btn-indigo').forEach(btn => { btn.classList.remove('active-time'); btn.style.background = ''; btn.style.color = ''; });
  } else {
    box.style.display='none';
    if(mode === 'ranking') { timeLimit=rankingQuestionTime; remainingTime=rankingQuestionTime; }
    else { timeLimit=0; remainingTime=0; }
  }
  updateStartBtn();
}

function chooseTime(seconds){
  gameMode='timeattack'; timeLimit=seconds; remainingTime=seconds;
  document.querySelectorAll('#time-select-box .btn-indigo').forEach(btn => {
    btn.classList.toggle('active-time', btn.textContent === seconds+'초');
    btn.style.background = btn.textContent === seconds+'초' ? 'var(--indigo)' : 'transparent';
    btn.style.color = btn.textContent === seconds+'초' ? 'white' : 'var(--indigo)';
  });
  updateStartBtn();
}

function updateStartBtn() {
  const btn = document.getElementById('btn-start-game');
  btn.disabled = !(mixMode && (gameMode === 'normal' || gameMode === 'ranking' || (gameMode === 'timeattack' && timeLimit > 0)));
}

function beginSelectedGame(){
  if(!pendingItems || !pendingLabel) return;
  if(gameMode==='timeattack' && !timeLimit){ toast('⏱ 타임어택 시간을 선택해주세요!'); return; }
  const mixed = (pendingLabel === 'TEST') ? pendingItems : applyMixMode(pendingItems);
  startGame(mixed, pendingLabel);
}

function startGame(items,label){
  const d=DB[exam||'jcs']; lastPlayedItems=[...items]; lastPlayedLabel=label;
  partKey=label;
  // 랭킹전은 선택한 파트의 전체 문제 중 30개만 랜덤 출제
  // 파트 문항이 30개보다 적으면 있는 문항만 모두 출제
  const shuffledItems = [...items].sort(()=>Math.random()-.5);
  words = (gameMode === 'ranking') ? shuffledItems.slice(0, 30) : shuffledItems;
  idx=0; typed=''; combo=0; bestCombo=0; totalWords=0; totalChars=0; totalErrors=0; sessionWrong=[]; startTime=null;
  rankingScore=0; rankingWrongCount=0;
  clearInterval(wpmTimer); clearInterval(timerInterval);
  
  ['g-wpm','g-combo'].forEach(id=>document.getElementById(id).textContent='0'); document.getElementById('g-acc').textContent='0%';
  const chip = document.getElementById('h-combo'); if (chip) { chip.style.display = 'none'; chip.className = 'chip combo'; }

  if(gameMode==='timeattack') remainingTime=timeLimit||60;
  else if(gameMode==='ranking') { timeLimit=rankingQuestionTime; remainingTime=rankingQuestionTime; }
  else { timeLimit=0; remainingTime=0; }
  updateTimerUI();
  
  const badge=document.getElementById('g-badge'); badge.textContent=d.badge;
  const isJcs=exam==='jcs'; badge.style.cssText=`background:${isJcs?'var(--indigo-t)':'var(--green-t)'};color:${isJcs?'var(--indigo)':'var(--green)'};border:1px solid ${isJcs?'var(--indigo)':'var(--green)'}`;
  
  const mixLabels = {en:'EN', ko:'KO', mix:'EN/KO MIX'};
  const modeLabel = gameMode === 'ranking' ? 'RANKING' : (mixLabels[mixMode]||'EN');
  document.getElementById('g-pname').innerHTML = `${label} <span class="mix-badge">${modeLabel}</span>`;
  document.getElementById('g-prog').style.background=d.prog;
  document.getElementById('wc-lbl').textContent=exam==='toeic'?'MEANING':'DEFINITION';
  
  showScreen('s-game', false); if(gameMode==='timeattack') startTimer(); loadWord();
}

function buildDots(){ document.getElementById('dot-row').innerHTML=words.map((_,i)=>{ let c='dot';if(i<idx)c+=' done';else if(i===idx)c+=' cur'; return `<div class="${c}"></div>`; }).join(''); }

function loadWord(){
  if(idx>=words.length){endGame();return;}
  const item=words[idx], ko=isKorean(item.w);
  document.getElementById('wc-mean').textContent=item.m; document.getElementById('wc-ctx').textContent=item.c?'→ '+item.c:'';
  
  const hLenBtn = document.getElementById('h-len'), answerHintBtn = document.getElementById('hint-btn');
  if (gameMode === 'timeattack' || gameMode === 'ranking') { hLenBtn.style.display = 'none'; answerHintBtn.style.display = 'none'; } 
  else { hLenBtn.style.display = 'inline-block'; hLenBtn.textContent = '💡 글자수 보기'; hLenBtn.disabled = false; answerHintBtn.style.display = 'inline-block'; answerHintBtn.classList.remove('active'); answerHintBtn.textContent = '💡 정답 힌트'; }
  
  document.getElementById('g-prog').style.width=(idx/words.length*100).toFixed(0)+'%'; document.getElementById('g-cnt').textContent=idx+' / '+words.length;
  
  const badge=document.getElementById('lang-badge');
  if(ko){badge.textContent='KO';badge.className='lang-badge ko';} else{badge.textContent='EN';badge.className='lang-badge en';}
  document.getElementById('g-input').placeholder=ko?'한글로 타이핑 후 엔터...':'Type then press Enter...';
  
  buildDots(); typed=''; hintUsed=false; document.getElementById('hint-panel').classList.remove('show');
  renderWord(); document.getElementById('g-input').value='';
  if(gameMode === 'ranking') resetRankingQuestionTimer();
  setTimeout(() => { const gInput = document.getElementById('g-input'); if(gInput) gInput.focus(); }, 100);
}

function renderWord(){
  let html=''; for(let i=0; i<typed.length; i++){ html+=`<span style="color: var(--text);">${typed[i]}</span>`; }
  document.getElementById('tw').innerHTML=html+`<span class="caret"></span>`;
}

function submitAnswer(val){
  if(idx>=words.length)return;
  const w=words[idx].w;
  if(!startTime){startTime=Date.now();wpmTimer=setInterval(updateStats,2000);}

  if(wordsMatch(val.trim(), w)){
    totalWords++; totalChars+=w.length;
    if(gameMode === 'ranking') rankingScore += Math.max(0, remainingTime) * 10;

    if(hintUsed){
      playSound(sfx.page); document.getElementById('g-combo').textContent='0'; document.getElementById('h-combo').style.display='none';
      showPop('△','var(--amber)'); sessionWrong.push({...words[idx],exam:exam,examLabel:DB[exam]?.badge||'커스텀',hinted:true});
    } else {
      combo++; bestCombo=Math.max(bestCombo,combo);
      playSound(sfx['combo' + (((combo - 1) % 5) + 1)]);
      document.getElementById('g-combo').textContent=combo;
      const chip=document.getElementById('h-combo');
      if (combo >= 5) {
        chip.style.display = 'inline-block'; let displayCombo = Math.floor(combo / 5) * 5;
        chip.textContent = '🔥 ' + displayCombo + ' COMBO!'; chip.className = 'chip combo';
        if (displayCombo >= 40) chip.classList.add('combo-fire-4'); else if (displayCombo >= 25) chip.classList.add('combo-fire-3'); else if (displayCombo >= 15) chip.classList.add('combo-fire-2'); else chip.classList.add('combo-fire-1');
        if (combo % 5 === 0) showPop(gameMode === 'ranking' ? `+${Math.max(0, remainingTime) * 10}` : '🔥 +' + combo, 'var(--amber)'); else showPop(gameMode === 'ranking' ? `+${Math.max(0, remainingTime) * 10}` : '✓','var(--success)');
      } else { chip.style.display = 'none'; showPop(gameMode === 'ranking' ? `+${Math.max(0, remainingTime) * 10}` : '✓','var(--success)'); }
    }
  } else {
    playSound(sfx.page); totalErrors++; combo=0; document.getElementById('g-combo').textContent='0'; document.getElementById('h-combo').style.display='none';
    showPop('✗','var(--error)');
    const tw=document.getElementById('tw'); tw.classList.add('shake'); setTimeout(()=>tw.classList.remove('shake'),200);
    sessionWrong.push({...words[idx],exam:exam,examLabel:DB[exam]?.badge||'커스텀'});

    if(gameMode === 'ranking'){
      rankingWrongCount++;
      // 랭킹전: 첫 오답은 패널티 없음, 2~4번째 오답은 남은 시간 1초씩 감소
      if(rankingWrongCount >= 2 && rankingWrongCount <= 4){
        remainingTime = Math.max(0, remainingTime - 1);
        updateTimerUI();
      }
      document.getElementById('g-input').value=''; typed=''; renderWord(); updateStats();
      if(remainingTime <= 0) handleRankingTimeOver();
      return;
    }
  }

  document.getElementById('g-input').value=''; typed=''; idx++;
  document.getElementById('g-prog').style.width=(idx/words.length*100).toFixed(0)+'%'; document.getElementById('g-cnt').textContent=idx+' / '+words.length;
  loadWord(); updateStats();
}

function updateStats(){
  if(!startTime) return;
  const m = Math.max((Date.now() - startTime) / 60000, 0.01);
  document.getElementById('g-wpm').textContent = Math.round((totalChars / 5) / m);
  const acc = (totalChars + totalErrors) > 0 ? Math.round(totalChars / (totalChars + totalErrors) * 100) : 0;
  document.getElementById('g-acc').textContent = acc + '%';
}

function showPop(text,color){
  const el=document.createElement('div');el.className='pop'; el.textContent=text;el.style.color=color||'var(--success)';
  el.style.left=(20+Math.random()*60)+'%';el.style.top='10%';
  document.getElementById('type-area').appendChild(el); setTimeout(()=>el.remove(),700);
}

function showLenHint() { if(gameMode==='timeattack' || gameMode==='ranking')return; playSound(sfx.button); const hLenBtn = document.getElementById('h-len'); hLenBtn.textContent = words[idx].w.length + ' 글자'; hLenBtn.disabled = true; }

function toggleHint(){
  if(idx>=words.length || gameMode==='timeattack' || gameMode==='ranking') return; playSound(sfx.button);
  const panel = document.getElementById('hint-panel'), btn = document.getElementById('hint-btn'), isOpen = panel.classList.contains('show');
  if(isOpen){ panel.classList.remove('show'); btn.classList.remove('active'); btn.textContent = '💡 정답 힌트'; } 
  else {
    const item = words[idx]; hintUsed = true; combo = 0; document.getElementById('g-combo').textContent = '0'; document.getElementById('h-combo').style.display = 'none';
    document.getElementById('hint-answer').textContent = item.w; document.getElementById('hint-desc').textContent = item.c ? `→ ${item.c}` : (item.m || '(추가 설명 없음)');
    panel.classList.add('show'); btn.classList.add('active'); btn.textContent = '💡 닫기'; setTimeout(() => document.getElementById('g-input').focus(), 50);
  }
}

function skip(){
  if(idx>=words.length)return; playSound(sfx.page);
  if(!startTime){startTime=Date.now();wpmTimer=setInterval(updateStats,2000);}
  sessionWrong.push({...words[idx],exam:exam,examLabel:DB[exam]?.badge||'커스텀'});
  totalErrors++; combo=0; document.getElementById('g-combo').textContent='0'; document.getElementById('h-combo').style.display='none';
  idx++; document.getElementById('g-input').value=''; typed=''; loadWord(); updateStats();
}

function exitGame(){ if(!confirm('게임을 중단하고 파트 선택 화면으로 돌아가시겠습니까?')) return; clearInterval(wpmTimer); clearInterval(timerInterval); gopart(); }

async function endGame(){
  clearInterval(timerInterval); clearInterval(wpmTimer);
  const isTimeOver = (gameMode==='timeattack' && remainingTime<=0 && idx<words.length);
  const mins=startTime?(Date.now()-startTime)/60000:1;
  const wpm=Math.round((totalChars/5)/Math.max(0.01,mins));
  const acc = (totalChars + totalErrors) > 0 ? Math.round(totalChars / (totalChars + totalErrors) * 100) : 0;
  lastRankScore = gameMode === 'ranking' ? rankingScore : ((typeof calculateRankScore === 'function') ? calculateRankScore(totalWords, remainingTime, bestCombo) : Math.max(0, totalWords * 100 + remainingTime * 10 + bestCombo * 5));
  if (gameMode === 'ranking' && totalWords > 0 && typeof saveRankingRecord === 'function') {
    saveRankingRecord({ exam, part: partKey, score: lastRankScore, wpm, accuracy: acc, totalWords, totalErrors, bestCombo, timeLimit: rankingQuestionTime, remainingTime, mixMode, gameMode });
  }
  
  if (currentUser && totalWords > 0) {
    supabaseClient.from('game_records').insert({ user_id: currentUser.id, exam: exam, part: partKey, game_mode: gameMode, mix_mode: mixMode, time_limit: timeLimit || 0, wpm: wpm, accuracy: acc, total_words: totalWords, total_errors: totalErrors, best_combo: bestCombo }).then();
  }

  if (totalChars === 0) playSound(sfx.over_bad); else if (acc === 100) playSound(sfx.over_perfect); else if (acc <= 30) playSound(sfx.over_bad);

  document.getElementById('res-title').textContent=isTimeOver?'TIME OVER':'Result';
  document.getElementById('res-icon').textContent=isTimeOver?'⏰':acc>=90?'🎉':acc>=70?'👍':'💪';
  document.getElementById('res-sub').textContent=isTimeOver?`${partKey} — 시간이 종료되었어요`:`${partKey} — SESSION COMPLETE`;
  document.getElementById('r-wpm').textContent=wpm; document.getElementById('r-acc').textContent=acc+'%';
  document.getElementById('r-words').textContent=totalWords; document.getElementById('r-combo').textContent=bestCombo;
  const resSub = document.getElementById('res-sub');
  if (gameMode === 'ranking' && totalWords > 0) resSub.textContent += ` · 랭킹점수 ${lastRankScore}점`;
  else if (gameMode === 'timeattack' && totalWords > 0) resSub.textContent += ` · 타임어택점수 ${lastRankScore}점`; 
  document.querySelectorAll('.res-val').forEach(el=>el.style.color=DB[exam]?.prog||'var(--indigo)');
  
  const rw=document.getElementById('res-wrong'),rl=document.getElementById('rw-list'); rl.innerHTML='';
  if(sessionWrong.length>0){
    rw.style.display='block';
    sessionWrong.forEach(w=>{
      const d=document.createElement('div');d.className='rw-item';
      d.innerHTML=`<span class="rw-word">${w.w}${w.hinted ? `<span class="rw-hint">△ 힌트</span>` : ''}</span><span class="rw-mean">${w.m.slice(0,40)}…</span>`;
      rl.appendChild(d);
    });
  } else rw.style.display='none';
  showScreen('s-result', false);
}

function retry() {
  if (typeof playSound === 'function') playSound(sfx.button);
  if (partKey === '추가한 문제') return playCustom();
  if (partKey && partKey.includes('오답 복습')) return playWrongPart(partKey.replace(' 오답 복습', ''));
  const currentDB = DB[exam || 'jcs'];
  if (partKey && currentDB && currentDB.parts[partKey]) { pendingItems=currentDB.parts[partKey].items; pendingLabel=partKey; beginSelectedGame(); } else goHome();
}

function startComboTest() {
  if (typeof playSound === 'function') playSound(sfx.button);
  const testItems = []; for(let i=1; i<=40; i++) testItems.push({ w: 'a', m: '콤보 애니메이션 테스트 ' + i + '/40', c: "'a'만 치고 엔터를 누르세요!" });
  openModeSelect(testItems, 'TEST');
}

// 게임 입력 이벤트
const gInput=document.getElementById('g-input');
gInput.addEventListener('compositionstart',()=>{ isComposing=true; });
gInput.addEventListener('compositionend',function(){ isComposing=false; typed=this.value; renderWord(); });
gInput.addEventListener('input',function(){ typed=this.value; renderWord(); playSound(sfx.keyboard); });
gInput.addEventListener('keydown', function(e) { if(e.key === 'Enter') { if(e.isComposing || isComposing) return; submitAnswer(this.value); }});

document.getElementById('s-game').addEventListener('click', function() { 
  const gInput = document.getElementById('g-input'); if(gInput) gInput.focus(); 
});
