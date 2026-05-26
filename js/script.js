// ============================================
// DB 및 기출문제 데이터
// ============================================

let DB = {
  jcs: { name: '정보처리기사 실기', badge: '정처기', prog: '#2D4A8A', parts: {} },
  toeic: { name: 'TOEIC', badge: 'TOEIC', prog: '#2E6B4F', parts: {} }
};

const PART_DESC = {
  '데이터베이스': 'SQL, 정규화, 트랜잭션',
  '알고리즘': '정렬, 탐색, 자료구조',
  '네트워크': 'OSI 7계층, 프로토콜',
  '보안': '암호화, 인증, 취약점',
  '소프트웨어공학': '개발 방법론, 디자인 패턴',
  'Part 5 — 어법': '품사, 시제, 가정법',
  'Part 5 — 어휘': '동사, 명사, 형용사 어휘',
  'Part 6 — 문맥': '접속사, 대명사, 문맥 추론',
  'Part 7 — 독해': '비즈니스 메일, 광고, 기사',
  '비즈니스 영어': '회의, 협상, 이메일'
};

let pastExams = {};

async function loadPastExamsFromDB() {
  console.log('📄 기출문제 데이터 로딩 중...');
  
  const { data, error } = await supabaseClient
    .from('past_exams')
    .select('*')
    .order('exam_key', { ascending: true })
    .order('q_num', { ascending: true });
    
  if (error) {
    console.error('기출문제 로딩 실패:', error);
    return false;
  }
  
  if (!data || data.length === 0) return false;
  
  pastExams = {};
  
  data.forEach(row => {
    const key = row.exam_key;
    if (!pastExams[key]) {
      pastExams[key] = [];
    }
    
    pastExams[key].push({
      qNum: row.q_num,
      q: row.question,
      code: row.code_snippet,
      image_desc: row.image_desc,
      table: row.table_html,
      o: row.options,
      a: row.answer
    });
  });
  
  console.log('✅ 기출문제 데이터 로딩 완료');
  return true;
}

// ============================================
// 🔊 사운드 시스템
// ============================================
const sfx = {
  isMuted: false,       
  lastVolume: 0.5,        
  button: new Audio('assets/snd/button_snd.mp3'),
  keyboard: new Audio('assets/snd/keyboard_snd.mp3'),
  page: new Audio('assets/snd/page.mp3'),
  over_bad: new Audio('assets/snd/game_over_q.mp3'),
  over_perfect: new Audio('assets/snd/game_over_b.mp3'),
  combo1: new Audio('assets/snd/combo_1.mp3'),
  combo2: new Audio('assets/snd/combo_2.mp3'),
  combo3: new Audio('assets/snd/combo_3.mp3'),
  combo4: new Audio('assets/snd/combo_4.mp3'),
  combo5: new Audio('assets/snd/combo_5.mp3')
};

for (let key in sfx) {
  if (sfx[key] instanceof Audio) sfx[key].volume = 0.5;
}

function changeVolume(val) {
  const volume = parseFloat(val);
  sfx.isMuted = (volume === 0);
  if (volume > 0) sfx.lastVolume = volume; 
  for (let key in sfx) {
    if (sfx[key] instanceof Audio) sfx[key].volume = volume;
  }
  document.querySelectorAll('.vol-slider').forEach(slider => slider.value = volume);
  document.querySelectorAll('.mute-icon').forEach(icon => icon.textContent = volume === 0 ? '🔇' : '🔊');
}

function toggleMuteIcon() {
  if (sfx.isMuted) {
    changeVolume(sfx.lastVolume > 0 ? sfx.lastVolume : 1);
    toast('소리가 켜졌습니다');
  } else {
    changeVolume(0);
    toast('음소거 되었습니다');
  }
}

function playSound(audio) {
  if (audio.volume === 0 || sfx.isMuted) return;
  audio.currentTime = 0; 
  audio.play().catch(e => console.log("재생 차단:", e));
}

// ============================================
// 상태 변수 및 공통 로직
// ============================================
let currentUser = null; 
let currentMode = null;
let currentExamKey = null;

let exam=null, partKey=null, words=[], idx=0, typed='';
let combo=0, bestCombo=0, totalWords=0, totalChars=0, totalErrors=0;
let startTime=null, sessionWrong=[], wpmTimer=null;
let wrongNote=[], customWords=[]; 
let examWrongNote=[], currentExamWrongItems=[];

let isComposing=false, isWordMasked=false, isMeanMasked=false;
let gameMode=null, mixMode=null, hintUsed=false; 
let timeLimit=0, remainingTime=0, timerInterval=null;
let rankingQuestionTime=15, rankingScore=0;
let rankingWrongAttempts=0; // 랭킹전 현재 문제 오답 횟수
let pendingItems=null, pendingLabel='', lastPlayedItems=null, lastPlayedLabel='';
let practiceQuestionCount = 40;

try{ examWrongNote = JSON.parse(localStorage.getItem('te_exam_wrong') || '[]'); }catch(e){}

function saveExamWrongLocal() {
  try { localStorage.setItem('te_exam_wrong', JSON.stringify(examWrongNote)); } catch(e) {}
}

function setMode(mode) { currentMode = mode; }
function goWrongNote() {
  if (currentMode === 'pastexam') showScreen('s-exam-wrong');
  else showScreen('s-wrong');
}

function toast(msg){
  const existing=document.querySelector('.toast');if(existing)existing.remove();
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  document.getElementById('root').appendChild(t);setTimeout(()=>t.remove(),2100);
}

function openModal(id) { playSound(sfx.button); document.getElementById(id).classList.add('active'); }
function closeModal(id) { playSound(sfx.button); document.getElementById(id).classList.remove('active'); }

// ============================================
// Supabase 데이터 로드 및 인증
// ============================================
async function loadWordsFromDB() {
  console.log('📚 단어 데이터 로딩 중...');
  const { data, error } = await supabaseClient.from('words').select('*').eq('is_custom', false).order('id');
  if (error) { toast('단어 데이터를 불러오지 못했어요'); return false; }
  if (!data || data.length === 0) return false;
  
  DB.jcs.parts = {}; DB.toeic.parts = {};
  data.forEach(row => {
    const examKey = row.exam, partKey = row.part;
    if (!DB[examKey]) return;
    if (!DB[examKey].parts[partKey]) DB[examKey].parts[partKey] = { desc: PART_DESC[partKey] || '', items: [] };
    DB[examKey].parts[partKey].items.push({ w: row.word, m: row.meaning, c: row.context || '' });
  });
  console.log(`✅ 단어 로딩 완료`);
  return true;
}

async function loadUserData() {
  if (!currentUser) return;
  const { data: wrongData } = await supabaseClient.from('wrong_notes').select('*').eq('user_id', currentUser.id).order('saved_at', { ascending: false });
  wrongNote = (wrongData || []).map(row => ({
    id: row.id, w: row.word, m: row.meaning, c: row.context || '', exam: row.exam, examLabel: row.exam_label, part: row.part, cnt: row.count, hinted: row.hinted, savedAt: new Date(row.saved_at).getTime()
  }));
  const { data: customData } = await supabaseClient.from('words').select('*').eq('is_custom', true).eq('created_by', currentUser.id).order('created_at', { ascending: false });
  customWords = (customData || []).map(row => ({ id: row.id, w: row.word, m: row.meaning, c: row.context || '', cat: row.part }));
}

function showAuthScreen(id) {
  playSound(sfx.button);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}


function startDemoMode() {
  // 로그인 없이 UI와 기능을 확인할 수 있는 체험 계정 상태
  currentUser = {
    id: 'demo-user',
    email: 'demo@typeexam.local',
    user_metadata: { username: 'Demo' }
  };
  const infoName = document.getElementById('info-name');
  if (infoName) infoName.textContent = 'Demo';
  const profileInput = document.getElementById('profile-username');
  if (profileInput) profileInput.value = 'Demo';
  const nav = document.getElementById('main-nav');
  if (nav) nav.style.display = 'flex';
  toast('데모 모드로 시작합니다');
  showScreen('s-main-choice', false);
}

async function handleSignup() {
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pw = document.getElementById('signup-pw').value.trim();
  const pw2 = document.getElementById('signup-pw2').value.trim();

  if (!username || !email || !pw || !pw2) { toast('모든 항목을 입력해주세요'); return; }
  if (pw !== pw2) { toast('비밀번호가 일치하지 않아요'); return; }

  toast('회원가입 처리 중...');
  const { data, error } = await supabaseClient.auth.signUp({ email, password: pw, options: { data: { username } } });
  
  if (error) { toast('회원가입 실패: ' + error.message); return; }
  playSound(sfx.button);
  document.getElementById('verify-email-text').textContent = email + ' 으로 인증 메일을 보냈어요';
  showAuthScreen('s-verify');
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-pw').value.trim();
  if (!email || !pw) { toast('이메일과 비밀번호를 입력해주세요'); return; }

  toast('로그인 중...');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });

  if (error) { toast('로그인 실패: ' + error.message); return; }
  
  currentUser = data.user;
  playSound(sfx.button);
  const { data: profile } = await supabaseClient.from('profiles').select('username').eq('id', data.user.id).single();
  const displayName = profile?.username || data.user.email.split('@')[0];
  
  toast('환영합니다, ' + displayName + '님!');
  document.getElementById('info-name').textContent = displayName;
  
  await loadUserData();
  document.getElementById('main-nav').style.display = 'flex';
  showScreen('s-main-choice', false);
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  toast('로그아웃 되었습니다');
  setTimeout(() => location.reload(), 500);
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    const { data: profile } = await supabaseClient.from('profiles').select('username').eq('id', session.user.id).single();
    const displayName = profile?.username || session.user.email.split('@')[0];
    document.getElementById('info-name').textContent = displayName;
    await loadUserData();
    document.getElementById('main-nav').style.display = 'flex';
    showScreen('s-main-choice', false);
  }
}

// ============================================
// 화면 제어 및 타이핑 훈련 로직
// ============================================
function showScreen(id, pushHistory = true){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const target = document.getElementById(id);
  if(target) target.classList.add('active');
  
  const navWrong = document.getElementById('nav-wrong');
  const navCustom = document.getElementById('nav-custom');
  const navStats = document.getElementById('nav-stats');
  const navRank = document.getElementById('nav-rank');
  const navAttendance = document.getElementById('nav-attendance');
  const navLogo = document.querySelector('.nav-logo');

  // 디자인 개편 후 기능 버튼들이 로그인 후에도 숨겨져 있던 문제 수정
  // 로그인/회원가입/인증 화면에서는 숨기고, 로그인 이후 화면에서는 필요한 기능을 표시한다.
  const isAuthScreen = ['s-login', 's-signup', 's-verify'].includes(id);
  const isExamScreen = id.includes('exam');
  const isPastExamMode = currentMode === 'pastexam' || isExamScreen;

  if (navWrong) navWrong.style.display = isAuthScreen ? 'none' : 'inline-block';
  if (navStats) navStats.style.display = isAuthScreen ? 'none' : 'inline-block';
  if (navRank) navRank.style.display = isAuthScreen ? 'none' : 'inline-block';
  if (navAttendance) navAttendance.style.display = isAuthScreen ? 'none' : 'inline-block';
  if (navCustom) navCustom.style.display = (isAuthScreen || isPastExamMode) ? 'none' : 'inline-block';

  if (navLogo) {
    if (id.includes('exam') && id !== 's-main-choice') navLogo.textContent = '기출문제 풀이';
    else if (id === 's-main-choice' || id === 's-login') navLogo.textContent = 'Untitled';
    else navLogo.textContent = 'TypeExam';
  }

  if(id==='s-wrong') renderWrong();
  if(id==='s-custom') renderCustom();
  if(id==='s-stats') loadStats();
  if(id==='s-ranking' && typeof renderRanking === 'function') renderRanking(currentRankingFilter || 'all');
  if(id==='s-main-choice' || id==='s-home' || id==='s-result') renderDailyGoal();
  if(id==='s-exam-wrong') renderExamWrong();
}

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
  const pkeys=Object.keys(d.parts); document.getElementById('part-cnt').textContent=(pkeys.length + 1)+'개 파트';
  
  const testBtn = document.getElementById('btn-combo-test');
  if (testBtn) testBtn.style.display = (exam === 'toeic') ? 'block' : 'none';

  const grid=document.getElementById('part-grid'); grid.innerHTML='';

  // 전체파트: 현재 시험의 모든 파트를 섞어서 출제
  const allPartItems = pkeys.flatMap(k => (d.parts[k]?.items || []).map(item => ({...item, __part: k})));
  if (allPartItems.length > 0) {
    const allEl=document.createElement('div');
    allEl.className='part-card all-part';
    allEl.style.borderColor='var(--amber)';
    allEl.style.background='linear-gradient(135deg, rgba(245,158,11,.12), rgba(255,255,255,.92))';
    allEl.innerHTML=`<div class="part-card-cnt" style="background:var(--amber-t); color:var(--amber)">${allPartItems.length}문항</div><div class="part-name">👑 전체파트</div><div class="part-desc">${pkeys.length}개 파트 전체 랜덤 출제 · 실전 대비 추천</div>`;
    allEl.onclick=()=>{ playSound(sfx.button); openModeSelect(allPartItems,'전체파트'); }
    grid.appendChild(allEl);
  }

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

function applyTheme(theme, save=true){
  const root = document.getElementById('root');
  root.setAttribute('data-theme', theme); document.body.setAttribute('data-theme', theme);
  if(save) localStorage.setItem('te_theme', theme);
  document.querySelectorAll('.theme-btn').forEach(btn => btn.textContent = theme === 'dark' ? '☀️ 라이트' : '🌙 다크');
}
function toggleTheme(){
  const current = document.getElementById('root').getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
(function initTheme(){ applyTheme(localStorage.getItem('te_theme') || 'light', false); })();

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
    return { w: item.m.split('—')[0].split('—')[0].trim(), m: item.w, c: item.c };
  });
}
function formatTime(sec){
  if(!Number.isFinite(sec) || sec<=0) return '0:00';
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}
function updateTimerUI(){ document.getElementById('g-timer').textContent = (gameMode==='timeattack' || gameMode==='ranking') ? formatTime(remainingTime) : '∞'; }
function startTimer(){
  clearInterval(timerInterval);
  updateTimerUI();
  timerInterval=setInterval(()=>{
    remainingTime--;
    if(remainingTime<=0){
      remainingTime=0;
      updateTimerUI();
      if(gameMode === 'ranking') { handleRankingTimeout(); return; }
      clearInterval(timerInterval);
      endGame();
      return;
    }
    updateTimerUI();
  },1000);
}

function handleRankingTimeout(){
  if(gameMode !== 'ranking' || idx >= words.length) return;
  playSound(sfx.page);
  showPop('TIME OVER', 'var(--error)');
  sessionWrong.push({...words[idx], exam: exam, examLabel: DB[exam]?.badge || '커스텀'});
  totalErrors++;
  combo = 0;
  document.getElementById('g-combo').textContent = '0';
  document.getElementById('h-combo').style.display = 'none';
  idx++;
  document.getElementById('g-input').value = '';
  typed = '';
  document.getElementById('g-prog').style.width = (idx / words.length * 100).toFixed(0) + '%';
  document.getElementById('g-cnt').textContent = idx + ' / ' + words.length;
  loadWord();
  updateStats();
}

function openModeSelect(items,label){
  pendingItems=items; pendingLabel=label;
  document.getElementById('mode-part-label').textContent=label;
  document.getElementById('time-select-box').style.display='none';
  const practiceBox = document.getElementById('practice-count-box');
  if (practiceBox) practiceBox.style.display='none';
  mixMode = null; gameMode = null; timeLimit = 0;
  practiceQuestionCount = 40;
  
  ['en','ko','mix'].forEach(m => { const el = document.getElementById('mix-card-' + m); if(el) el.classList.remove('selected'); });
  ['normal','timeattack','ranking'].forEach(m => { const el = document.getElementById('mode-card-' + m); if(el) el.classList.remove('selected'); });
  document.querySelectorAll('#time-select-box .btn-indigo').forEach(btn => { btn.classList.remove('active-time'); btn.style.background = ''; btn.style.color = ''; });
  updateStartBtn(); showScreen('s-mode', false);
}
function chooseMode(mode){
  gameMode=mode;
  ['normal','timeattack','ranking'].forEach(m => { const el = document.getElementById('mode-card-' + m); if(el) el.classList.toggle('selected', m === mode); });
  const box=document.getElementById('time-select-box');
  const practiceBox=document.getElementById('practice-count-box');
  if(mode==='timeattack'){
    box.style.display='block'; timeLimit=0;
    if(practiceBox) practiceBox.style.display='none';
    document.querySelectorAll('#time-select-box .btn-indigo').forEach(btn => { btn.classList.remove('active-time'); btn.style.background = ''; btn.style.color = ''; });
  } else {
    box.style.display='none';
    if(mode==='ranking'){
      if(practiceBox) practiceBox.style.display='none';
      timeLimit=0; remainingTime=0;
      toast('🏆 랭킹전은 랜덤 30문제 · 문제당 15초로 진행돼요.');
    } else {
      timeLimit=0; remainingTime=0;
      if(practiceBox) {
        const isWholePart = pendingLabel === '전체파트';
        practiceBox.style.display = isWholePart ? 'block' : 'none';
        if(isWholePart) renderPracticeCountButtons();
      }
    }
  }
  updateStartBtn();
}

function renderPracticeCountButtons(){
  const wrap = document.getElementById('practice-count-buttons');
  if(!wrap) return;
  wrap.innerHTML='';
  const max = Math.min(200, Math.max(40, pendingItems ? pendingItems.length : 40));
  for(let n=40; n<=max; n+=10){
    const btn=document.createElement('button');
    btn.className='btn-indigo';
    btn.textContent=n+'문제';
    btn.onclick=()=>choosePracticeCount(n);
    if(n===practiceQuestionCount){ btn.classList.add('active-time'); btn.style.background='var(--indigo)'; btn.style.color='white'; }
    wrap.appendChild(btn);
  }
}

function choosePracticeCount(n){
  practiceQuestionCount=n;
  renderPracticeCountButtons();
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
  let selectedItems = pendingItems;
  if(gameMode === 'ranking') {
    selectedItems = [...pendingItems].sort(() => Math.random() - 0.5).slice(0, Math.min(30, pendingItems.length));
    timeLimit = rankingQuestionTime;
    remainingTime = rankingQuestionTime;
  } else if(gameMode === 'normal' && pendingLabel === '전체파트') {
    selectedItems = [...pendingItems].sort(() => Math.random() - 0.5).slice(0, Math.min(practiceQuestionCount, pendingItems.length));
  }
  const mixed = (pendingLabel === 'TEST') ? selectedItems : applyMixMode(selectedItems);
  startGame(mixed, pendingLabel);
}

function startGame(items,label){
  const d=DB[exam||'jcs']; lastPlayedItems=[...items]; lastPlayedLabel=label;
  partKey=label; words=[...items].sort(()=>Math.random()-.5);
  idx=0; typed=''; combo=0; bestCombo=0; totalWords=0; totalChars=0; totalErrors=0; rankingScore=0; rankingWrongAttempts=0; sessionWrong=[]; startTime=null;
  clearInterval(wpmTimer); clearInterval(timerInterval);
  
  ['g-wpm','g-combo'].forEach(id=>document.getElementById(id).textContent='0'); document.getElementById('g-acc').textContent='0%';
  const chip = document.getElementById('h-combo'); if (chip) { chip.style.display = 'none'; chip.className = 'chip combo'; }

  if(gameMode==='timeattack') remainingTime=timeLimit||60;
  else if(gameMode==='ranking') remainingTime=rankingQuestionTime;
  else { timeLimit=0; remainingTime=0; }
  updateTimerUI();
  
  const badge=document.getElementById('g-badge'); badge.textContent=d.badge;
  const isJcs=exam==='jcs'; badge.style.cssText=`background:${isJcs?'var(--indigo-t)':'var(--green-t)'};color:${isJcs?'var(--indigo)':'var(--green)'};border:1px solid ${isJcs?'var(--indigo)':'var(--green)'}`;
  
  const mixLabels = {en:'EN', ko:'KO', mix:'EN/KO MIX'};
  document.getElementById('g-pname').innerHTML = `${label} <span class="mix-badge">${mixLabels[mixMode]||'EN'}</span>`;
  document.getElementById('g-prog').style.background=d.prog;
  document.getElementById('wc-lbl').textContent=exam==='toeic'?'MEANING':'DEFINITION';
  
  showScreen('s-game', false); if(gameMode==='timeattack' || gameMode==='ranking') startTimer(); loadWord();
}

function buildDots(){ document.getElementById('dot-row').innerHTML=words.map((_,i)=>{ let c='dot';if(i<idx)c+=' done';else if(i===idx)c+=' cur'; return `<div class="${c}"></div>`; }).join(''); }

function loadWord(){
  if(idx>=words.length){endGame();return;}
  rankingWrongAttempts = 0;
  if(gameMode === 'ranking') {
    remainingTime = rankingQuestionTime;
    updateTimerUI();
  }
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
    if(gameMode === 'ranking') {
      const earned = Math.max(0, remainingTime) * 10;
      rankingScore += earned;
      showPop('+' + earned, 'var(--amber)');
    }
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
        if (combo % 5 === 0) showPop('🔥 +' + combo, 'var(--amber)'); else showPop('✓','var(--success)');
      } else { chip.style.display = 'none'; showPop('✓','var(--success)'); }
    }
  } else {
    playSound(sfx.page);
    totalErrors++;
    combo=0;
    document.getElementById('g-combo').textContent='0';
    document.getElementById('h-combo').style.display='none';
    const tw=document.getElementById('tw');
    tw.classList.add('shake');
    setTimeout(()=>tw.classList.remove('shake'),200);

    if(gameMode === 'ranking') {
      // 랭킹전: 오답을 입력해도 바로 다음 문제로 넘어가지 않음.
      // 첫 오답은 감점 없음, 이후 3번까지 -1초씩 차감.
      rankingWrongAttempts++;
      if(rankingWrongAttempts === 1) {
        showPop('✗ 다시 입력!', 'var(--error)');
      } else if(rankingWrongAttempts <= 4) {
        remainingTime = Math.max(0, remainingTime - 1);
        updateTimerUI();
        showPop('-1초', 'var(--error)');
        if(remainingTime <= 0) {
          document.getElementById('g-input').value='';
          typed='';
          handleRankingTimeout();
          updateStats();
          return;
        }
      } else {
        showPop('✗', 'var(--error)');
      }
      document.getElementById('g-input').value='';
      typed='';
      renderWord();
      updateStats();
      return;
    }

    showPop('✗','var(--error)');
    sessionWrong.push({...words[idx],exam:exam,examLabel:DB[exam]?.badge||'커스텀'});
  }

  document.getElementById('g-input').value=''; typed=''; idx++;
  document.getElementById('g-prog').style.width=(idx/words.length*100).toFixed(0)+'%'; document.getElementById('g-cnt').textContent=idx+' / '+words.length;
  loadWord(); updateStats();
}

const gInput=document.getElementById('g-input');
gInput.addEventListener('compositionstart',()=>{ isComposing=true; });
gInput.addEventListener('compositionend',function(){ isComposing=false; typed=this.value; renderWord(); });
gInput.addEventListener('input',function(){ typed=this.value; renderWord(); playSound(sfx.keyboard); });
gInput.addEventListener('keydown', function(e) { if(e.key === 'Enter') { if(e.isComposing || isComposing) return; submitAnswer(this.value); }});

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

function showLenHint() { if(gameMode==='timeattack')return; playSound(sfx.button); const hLenBtn = document.getElementById('h-len'); hLenBtn.textContent = words[idx].w.length + ' 글자'; hLenBtn.disabled = true; }
function toggleHint(){
  if(idx>=words.length || gameMode==='timeattack') return; playSound(sfx.button);
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
  const isTimeOver = gameMode==='timeattack' && remainingTime<=0 && idx<words.length;
  const mins=startTime?(Date.now()-startTime)/60000:1;
  const wpm=Math.round((totalChars/5)/Math.max(0.01,mins));
  const acc = (totalChars + totalErrors) > 0 ? Math.round(totalChars / (totalChars + totalErrors) * 100) : 0;
  
  if (currentUser && totalWords > 0) {
    supabaseClient.from('game_records').insert({ user_id: currentUser.id, exam: exam, part: partKey, game_mode: gameMode, mix_mode: mixMode, time_limit: timeLimit || 0, wpm: wpm, accuracy: acc, total_words: totalWords, total_errors: totalErrors, best_combo: bestCombo }).then();
  }

  if (totalChars === 0) playSound(sfx.over_bad); else if (acc === 100) playSound(sfx.over_perfect); else if (acc <= 30) playSound(sfx.over_bad);

  document.getElementById('res-title').textContent=isTimeOver?'TIME OVER':'Result';
  document.getElementById('res-icon').textContent=isTimeOver?'⏰':acc>=90?'🎉':acc>=70?'👍':'💪';
  document.getElementById('res-sub').textContent=isTimeOver?`${partKey} — 시간이 종료되었어요`:`${partKey} — SESSION COMPLETE`;
  document.getElementById('r-wpm').textContent=wpm; document.getElementById('r-acc').textContent=acc+'%';
  document.getElementById('r-words').textContent=totalWords; document.getElementById('r-combo').textContent=bestCombo;
  recordDailyGoalProgress(totalWords);
  document.querySelectorAll('.res-val').forEach(el=>el.style.color=DB[exam]?.prog||'var(--indigo)');

  // 랭킹전: 점수 저장 + 티어/LP 결과 반영
  if (gameMode === 'ranking' && totalWords > 0) {
    const finalRankingScore = rankingScore;
    let tierResult = null;
    if (typeof processTierResult === 'function') {
      tierResult = processTierResult({ wpm, accuracy: acc, rankingScore: finalRankingScore, bestCombo });
    }
    if (typeof saveRankingRecord === 'function') {
      saveRankingRecord({
        exam, part: partKey, score: tierResult?.finalScore ?? finalRankingScore, timeScore: finalRankingScore, wpm, accuracy: acc,
        totalWords, totalErrors, bestCombo,
        timeLimit: rankingQuestionTime || 15, remainingTime: remainingTime || 0,
        mixMode: mixMode || 'en'
      });
    }
    if (tierResult && typeof renderTierResultPanel === 'function') renderTierResultPanel(tierResult);
  }
  
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
  const cnt = wrongNote.length; document.getElementById('wrong-main-title').textContent = '오답 노트'; document.getElementById('wrong-cnt').textContent = '총 ' + cnt + '개';
  const partView = document.getElementById('wrong-part-view'), wordView = document.getElementById('wrong-word-view'), partGrid = document.getElementById('wrong-part-grid');
  partView.style.display = 'block'; wordView.style.display = 'none';
  if(cnt === 0) { partGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; padding-top:40px;"><div class="empty-icon">📋</div><div class="empty-text">아직 저장된 오답이 없어요</div></div>`; return; }
  const groups = {}; wrongNote.forEach(item => { const label = item.examLabel || '기타'; if(!groups[label]) groups[label] = []; groups[label].push(item); });
  partGrid.innerHTML = Object.keys(groups).map(label => {
    const items = groups[label], isJcs = label.includes('정처기') || label.includes('정보처리'), color = isJcs ? 'var(--indigo)' : (label==='커스텀' || label==='추가한 문제' ? 'var(--amber)' : 'var(--green)'), bgColor = isJcs ? 'var(--indigo-t)' : (label==='커스텀' || label==='추가한 문제' ? 'var(--amber-t)' : 'var(--green-t)');
    return `<div class="part-card" style="border-color:${color}; background:${bgColor}" onclick="showWrongWords('${label}')"><div class="part-card-cnt" style="background:white; color:${color}">${items.length}단어</div><div class="part-name" style="color:${color}; font-weight:700; font-size:16px;">${label}</div><div class="part-desc">클릭하여 오답 확인 및 복습</div></div>`;
  }).join('');
}
function showWrongWords(label) {
  if(typeof playSound === 'function') playSound(sfx.button); 
  const filteredNotes = wrongNote.filter(n => (n.examLabel || '기타') === label);
  document.getElementById('wrong-main-title').textContent = '오답 노트'; document.getElementById('wrong-cnt').textContent = ''; 
  document.getElementById('wrong-sub-title').textContent = label; document.getElementById('wrong-part-view').style.display = 'none'; document.getElementById('wrong-word-view').style.display = 'flex';
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
  playSound(sfx.button); const filtered = currentLabel ? wrongNote.filter(w => w.examLabel === currentLabel) : wrongNote; const target = filtered[i]; if (!target) return;
  const { error } = await supabaseClient.from('wrong_notes').delete().eq('id', target.id);
  if (!error) { wrongNote = wrongNote.filter(w => w.id !== target.id); if (currentLabel) showWrongWords(currentLabel); else showWrongParts(); }
}
async function clearWrongPart(label){
  playSound(sfx.button); if (!confirm(`"${label}" 파트의 오답을 모두 삭제할까요?`)) return;
  const { error } = await supabaseClient.from('wrong_notes').delete().eq('user_id', currentUser.id).eq('exam_label', label);
  if (!error) { wrongNote = wrongNote.filter(w => w.examLabel !== label); toast('삭제됐어요'); showWrongParts(); }
}
function playWrongPart(label){
  playSound(sfx.button); const filteredNotes = wrongNote.filter(n => (n.examLabel || '기타') === label); if(filteredNotes.length === 0) return;
  exam = label.includes('TOEIC') ? 'toeic' : 'jcs'; openModeSelect(filteredNotes.map(n=>({w:n.w, m:n.m, c:n.c||''})), `${label} 오답 복습`);
}

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

// ============================================
// 기출문제(OMR) 전용 함수들
// ============================================
function loadExamImage(imagePath) {
  if (typeof playSound === 'function') playSound(sfx.button);
  document.getElementById('exam-image-placeholder').style.display = 'none';
  document.getElementById('exam-text-view').style.display = 'none';
  const imgView = document.getElementById('exam-image-view');
  imgView.style.display = 'block'; imgView.src = imagePath;
}

function startExam(title, imagePath, audioPath, qCount, type, examDataKey = null) {
  if (typeof playSound === 'function') playSound(sfx.button);
  currentExamKey = examDataKey;
  
  document.getElementById('exam-list-view').style.display = 'none';
  document.getElementById('exam-solve-view').style.display = 'flex';
  document.getElementById('past-exam-title').textContent = title;
  
  const audioCont = document.getElementById('exam-audio-container'), audioEl = document.getElementById('exam-audio');
  if (audioPath) { audioCont.style.display = 'block'; audioEl.src = audioPath; } else { audioCont.style.display = 'none'; audioEl.pause(); }

  if (examDataKey && pastExams[examDataKey]) {
    document.getElementById('exam-image-placeholder').style.display = 'none';
    document.getElementById('exam-image-view').style.display = 'none';
    const txtView = document.getElementById('exam-text-view');
    txtView.style.display = 'block';
    
    let textHtml = '';
    pastExams[examDataKey].forEach((item) => {
      textHtml += `<div style="margin-bottom:30px; padding-bottom:20px; border-bottom:1.5px dashed var(--border);">`;
      textHtml += `  <div style="font-weight:700; margin-bottom:12px; color:var(--text); font-size:16px;">${item.qNum}. ${item.q}</div>`;
      
      if (item.image_desc) {
         textHtml += `<div class="exam-image-desc" style="background:var(--bg2); padding:10px; border-radius:8px; margin-bottom:12px; font-size:14px; text-align:center;">${item.image_desc}</div>`;
      }
      if (item.code) {
         textHtml += `<pre style="background:#ffffff; color:#000000; padding:8px 12px; border-radius:8px; overflow-x:auto; font-family:var(--f-mono); font-size:14px; line-height:1.6; white-space:pre; border:1.5px solid var(--border);">${item.code}</pre>`;
      }
      if (item.table) {
         textHtml += `<div class="exam-table-wrap" style="margin-bottom:12px; overflow-x:auto;">${marked.parse(item.table)}</div>`; 
      }

      item.o.forEach((opt, idx) => { textHtml += `  <div style="margin-bottom:8px; color:var(--muted); padding-left:20px;">${idx+1}) ${opt}</div>`; });
      textHtml += `</div>`;
    });
    txtView.innerHTML = textHtml;
    qCount = pastExams[examDataKey].length;
  } else {
    document.getElementById('exam-image-placeholder').style.display = 'none';
    document.getElementById('exam-text-view').style.display = 'none';
    const imgView = document.getElementById('exam-image-view');
    imgView.style.display = 'block'; imgView.src = imagePath || '';
  }

  const omr = document.getElementById('omr-card'); let omrHtml = '';
  const options = type === 'toeic' ? ['A', 'B', 'C', 'D'] : ['1', '2', '3', '4'];
  for(let i = 1; i <= qCount; i++) {
    let optsHtml = options.map(opt => `<input type="radio" name="q${i}" id="q${i}_${opt}" value="${opt}" class="omr-radio"><label for="q${i}_${opt}" class="omr-label">${opt}</label>`).join('');
    omrHtml += `<div class="omr-row"><div class="omr-num" style="width:50px;">${i}.</div><div class="omr-options">${optsHtml}</div></div>`;
  }
  omr.innerHTML = omrHtml;
}

function backToExamList() {
  if (typeof playSound === 'function') playSound(sfx.button);
  document.getElementById('exam-audio').pause();
  document.getElementById('exam-solve-view').style.display = 'none';
  document.getElementById('exam-list-view').style.display = 'block';
  document.getElementById('past-exam-title').textContent = '기출문제 풀이';
  
  document.getElementById('exam-image-placeholder').style.display = 'block';
  document.getElementById('exam-image-view').style.display = 'none';
  document.getElementById('exam-text-view').style.display = 'none';
  currentExamKey = null;
  document.querySelectorAll('.omr-radio').forEach(r => r.checked = false);
}

function gradeExam() {
  if (typeof playSound === 'function') playSound(sfx.button);
  if (!currentExamKey || !pastExams[currentExamKey]) { toast('이 시험은 아직 자동 채점 데이터가 없습니다.'); return; }
  if (!confirm('정말로 답안을 제출하고 채점하시겠습니까?')) return;

  const examData = pastExams[currentExamKey]; let correctCount = 0;
  let resultItems = []; currentExamWrongItems = []; 

  for (let i = 1; i <= examData.length; i++) {
    const correctAns = examData[i-1].a.toString(); 
    const checkedRadio = document.querySelector(`input[name="q${i}"]:checked`);
    const userAns = checkedRadio ? checkedRadio.value : '미입력';
    const isCorrect = (userAns === correctAns);

    if (isCorrect) correctCount++;
    else {
      currentExamWrongItems.push({ examKey: currentExamKey, examTitle: document.getElementById('past-exam-title').textContent, qNum: i, question: examData[i-1].q, options: examData[i-1].o, correctAns: correctAns, userAns: userAns });
    }
    resultItems.push({ qNum: i, userAns: userAns, correctAns: correctAns, isCorrect: isCorrect });
  }

  const finalScore = Math.round((correctCount / examData.length) * 100);
  const isPass = finalScore >= 60;

  document.getElementById('exam-res-sub').textContent = document.getElementById('past-exam-title').textContent;
  document.getElementById('exam-score').textContent = finalScore + '점';
  
  const passEl = document.getElementById('exam-pass');
  passEl.textContent = isPass ? '합격' : '불합격'; passEl.style.color = isPass ? 'var(--success)' : 'var(--error)';
  document.getElementById('exam-res-icon').textContent = isPass ? '🎉' : '🥲';

  const rwList = document.getElementById('exam-rw-list'); rwList.innerHTML = '';
  resultItems.forEach(w => {
    const numColor = w.isCorrect ? 'var(--success)' : 'var(--error)', ansColor = w.isCorrect ? 'var(--success)' : 'var(--error)';
    const d = document.createElement('div'); d.className = 'rw-item';
    d.innerHTML = `<span class="rw-word" style="min-width:60px; color:${numColor};">${w.qNum}번</span><span class="rw-mean">내 답안: <b style="color:${ansColor}">${w.userAns}</b> / 정답: <b style="color:var(--success)">${w.correctAns}</b></span>`;
    rwList.appendChild(d);
  });
  showScreen('s-exam-result');
}

function saveExamWrong() {
  if (typeof playSound === 'function') playSound(sfx.button);
  if (currentExamWrongItems.length === 0) { toast('저장할 오답이 없습니다. (100점!)'); return; }
  
  let added = 0;
  currentExamWrongItems.forEach(item => {
      const exists = examWrongNote.find(n => n.examKey === item.examKey && n.qNum === item.qNum);
      if (!exists) { examWrongNote.push(item); added++; }
  });
  saveExamWrongLocal();
  toast(`기출 오답노트에 ${added}문제 저장 완료!`); currentExamWrongItems = []; 
}

function renderExamWrong() { showExamWrongParts(); }
function showExamWrongParts() {
  const cnt = examWrongNote.length; document.getElementById('exam-wrong-cnt').textContent = '총 ' + cnt + '문제';
  const partView = document.getElementById('exam-wrong-part-view'), wordView = document.getElementById('exam-wrong-word-view'), partGrid = document.getElementById('exam-wrong-part-grid');
  if(partView) partView.style.display = 'block'; if(wordView) wordView.style.display = 'none';
  if (cnt === 0) { partGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; padding-top:40px;"><div class="empty-icon">📋</div><div class="empty-text">아직 저장된 기출 오답이 없어요</div></div>`; return; }

  const groups = {}; examWrongNote.forEach(item => { const label = item.examTitle || '기타'; if(!groups[label]) groups[label] = []; groups[label].push(item); });
  partGrid.innerHTML = Object.keys(groups).map(label => {
    const items = groups[label], isJcs = label.includes('정처기') || label.includes('필기') || label.includes('기출');
    const color = isJcs ? 'var(--indigo)' : 'var(--amber)', bgColor = isJcs ? 'var(--indigo-t)' : 'var(--amber-t)';
    return `<div class="part-card" style="border-color:${color}; background:${bgColor}" onclick="showExamWrongWords('${label}')"><div class="part-card-cnt" style="background:white; color:${color}">${items.length}문제</div><div class="part-name" style="color:${color}; font-weight:700; font-size:16px;">${label}</div><div class="part-desc">클릭하여 오답 확인 및 복습</div></div>`;
  }).join('');
}

function showExamWrongWords(label) {
  if (typeof playSound === 'function') playSound(sfx.button); 
  const filteredNotes = examWrongNote.filter(n => (n.examTitle || '기타') === label);
  document.getElementById('exam-wrong-cnt').textContent = ''; 
  document.getElementById('exam-wrong-sub-title').textContent = label;
  document.getElementById('exam-wrong-part-view').style.display = 'none'; 
  document.getElementById('exam-wrong-word-view').style.display = 'flex';
  
  const list = document.getElementById('exam-wrong-list');

  let listHtml = filteredNotes.map((item, index) => {
    const originalIndex = examWrongNote.findIndex(n => n.examKey === item.examKey && n.qNum === item.qNum);
    let optsHtml = '';
    
    if(item.options && item.options.length > 0) {
      optsHtml = item.options.map((opt, i) => {
          let isCorrect = (i + 1).toString() === item.correctAns, isUserAns = (i + 1).toString() === item.userAns;
          let color = isCorrect ? 'var(--success)' : (isUserAns ? 'var(--error)' : 'inherit'), weight = (isCorrect || isUserAns) ? 'bold' : 'normal';
          return `<div style="color:${color}; font-weight:${weight}; margin-bottom:6px; font-size:14px;">${i+1}) ${opt} <span style="color:var(--success);">${isCorrect ? ' ✅ (정답)' : ''}</span><span style="color:var(--error);">${isUserAns ? ' ❌ (내 답안)' : ''}</span></div>`;
      }).join('');
    } else {
      optsHtml = `<div style="color:var(--muted); font-size:14px;">정답: <b style="color:var(--success)">${item.correctAns}</b> / 내 답안: <b style="color:var(--error)">${item.userAns}</b></div>`;
    }
    
    return `
      <div class="note-item" style="flex-direction:column; align-items:stretch; gap:12px; margin-bottom:15px; padding:20px; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <div class="sim-check-wrap" style="display:none; margin-top:2px;">
              <input type="checkbox" class="sim-check" value="${index}" style="width:18px; height:18px; cursor:pointer;">
            </div>
            <div>
              <span style="font-size:12px; color:var(--indigo); font-weight:bold; margin-bottom:8px; display:inline-block;">[${item.examTitle}] - ${item.qNum}번</span>
              <div style="font-weight:600; font-size:16px; margin-bottom:4px;">${item.question || '이미지 문제'}</div>
            </div>
          </div>
          <button class="note-del" onclick="delExamWrong(${originalIndex}, '${label}')" style="font-size:18px;">✕</button>
        </div>
        <div style="background:var(--bg2); padding:16px; border-radius:8px; margin-top:8px;">${optsHtml}</div>
      </div>`;
  }).join('');

  const resultAreaHtml = `<div id="sim-result-area" style="margin-top:20px; margin-bottom:120px; display:flex; flex-direction:column; gap:15px;"></div>`;

  const fixedBottomUI = `
    <div style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); width:calc(100% - 40px); max-width:600px; z-index:100; pointer-events:none; display:flex; flex-direction:column; justify-content:flex-end;">
      <div id="sim-floating-btn" style="text-align:center; pointer-events:auto;">
        <button onclick="toggleSimMode(true)" style="padding:14px 28px; background:var(--indigo); color:white; border-radius:30px; font-weight:bold; font-size:15px; box-shadow:0 4px 15px rgba(0,0,0,0.2); border:none; cursor:pointer;">
          💡 유사문제 생성 모드
        </button>
      </div>
      <div id="sim-control-panel" style="display:none; background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:16px; box-shadow:0 4px 20px rgba(0,0,0,0.15); pointer-events:auto; margin-top:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-weight:bold; color:var(--indigo); font-size:15px;">참고할 문제를 체크해주세요</span>
          <button onclick="toggleSimMode(false)" style="background:none; border:none; color:var(--muted); cursor:pointer; font-size:14px; padding:4px;">취소</button>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:13px; color:var(--text);">개수:</span>
            <div style="display:flex; gap:4px;">
              ${[1, 2, 3, 4, 5].map(n => `<button class="sim-cnt-btn ${n===3?'active':''}" onclick="window.setSimCount(${n})" style="width:30px; height:30px; border-radius:6px; border:1px solid var(--indigo); background:${n===3?'var(--indigo)':'transparent'}; color:${n===3?'white':'var(--indigo)'}; font-size:14px; font-weight:bold; cursor:pointer;">${n}</button>`).join('')}
            </div>
          </div>
          <button onclick="generateSimilarQuestions('${label}')" style="padding:10px 20px; background:var(--indigo); color:white; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">생성하기</button>
        </div>
      </div>
    </div>
  `;

  list.innerHTML = listHtml + resultAreaHtml + fixedBottomUI;

  window.simCount = 3;
  
  window.setSimCount = function(n) {
    if (typeof playSound === 'function') playSound(sfx.button);
    window.simCount = n;
    document.querySelectorAll('.sim-cnt-btn').forEach(btn => {
      btn.style.background = parseInt(btn.textContent) === n ? 'var(--indigo)' : 'transparent';
      btn.style.color = parseInt(btn.textContent) === n ? 'white' : 'var(--indigo)';
    });
  };

  window.toggleSimMode = function(isActive) {
    if (typeof playSound === 'function') playSound(sfx.button);
    const floatingBtn = document.getElementById('sim-floating-btn');
    const controlPanel = document.getElementById('sim-control-panel');
    const checkWraps = document.querySelectorAll('.sim-check-wrap');
    const checkboxes = document.querySelectorAll('.sim-check');

    if (isActive) {
      floatingBtn.style.display = 'none';
      controlPanel.style.display = 'block';
      checkWraps.forEach(wrap => wrap.style.display = 'block');
    } else {
      floatingBtn.style.display = 'block';
      controlPanel.style.display = 'none';
      checkWraps.forEach(wrap => wrap.style.display = 'none');
      checkboxes.forEach(cb => cb.checked = false);
    }
  };
}

async function generateSimilarQuestions(label) {
  if (typeof playSound === 'function') playSound(sfx.button);
  const checkboxes = document.querySelectorAll('.sim-check:checked');
  if (checkboxes.length === 0) { toast('유사문제를 생성할 기준 문제를 하나 이상 선택해주세요.'); return; }

  const filteredNotes = examWrongNote.filter(n => (n.examTitle || '기타') === label);
  const selectedQuestions = Array.from(checkboxes).map(cb => filteredNotes[cb.value]);
  const resultArea = document.getElementById('sim-result-area');

  resultArea.innerHTML = '<div style="text-align:center; padding:30px; color:var(--indigo); font-weight:bold;">유사문제를 생성하는 중입니다... ⏳</div>';

  const prompt = `다음 기출문제들을 참고하여, 비슷한 유형과 난이도의 객관식 문제를 ${window.simCount}개 만들어주세요.
응답은 반드시 아래 JSON 배열 형식으로만 반환해야 합니다. 마크다운 기호 없이 순수 JSON만 출력하세요.

[
  {
    "question": "새로운 문제 내용",
    "options": ["보기1", "보기2", "보기3", "보기4"],
    "answer": "정답 번호 (1~4)",
    "explanation": "이 문제에 대한 상세한 해설"
  }
]

[참고 문제]
${selectedQuestions.map(q => `문제: ${q.question}\n보기: ${q.options ? q.options.join(', ') : '없음'}\n정답: ${q.correctAns}`).join('\n\n')}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'a_key',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'API 통신 중 에러가 발생했습니다.');
    }

    const data = await response.json();
    const textResponse = data.content[0].text;
    let cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const generatedItems = JSON.parse(cleanJson);
    renderGeneratedQuestions(generatedItems);

  } catch (error) {
    console.error('문제 생성 오류:', error);
    resultArea.innerHTML = `<div style="background:var(--error-t, #fee2e2); color:var(--error); padding:15px; border-radius:8px; font-size:14px;">⚠️ 생성 실패: ${error.message}</div>`;
  }
}

function renderGeneratedQuestions(items) {
  const resultArea = document.getElementById('sim-result-area');
  let html = '<div style="font-weight:bold; font-size:15px; margin-bottom:5px; color:var(--success);">✨ 유사문제가 생성되었습니다!</div>';
  
  items.forEach((item, index) => {
    html += `
      <div style="background:white; padding:20px; border-radius:8px; border:1px solid var(--border);">
        <div style="font-weight:600; font-size:15px; margin-bottom:15px;">Q${index + 1}. ${item.question}</div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
          ${item.options.map((opt, i) => `
            <label style="cursor:pointer; padding:10px 12px; background:var(--bg); border:1px solid var(--border); border-radius:6px; display:block;">
              <input type="radio" name="gq${index}" value="${i+1}" style="margin-right:8px;"> ${i+1}) ${opt}
            </label>
          `).join('')}
        </div>
        <button onclick="checkGeneratedAnswer(${index}, '${item.answer}', \`${item.explanation.replace(/`/g, '')}\`)" style="padding:10px 16px; background:var(--green); color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">정답 확인</button>
        <div id="gq-res-${index}" style="margin-top:15px; padding:15px; background:var(--bg2); border-radius:6px; border-left:4px solid var(--green); display:none;"></div>
      </div>
    `;
  });
  
  resultArea.innerHTML = html;
}

function checkGeneratedAnswer(index, correctAns, explanation) {
  if (typeof playSound === 'function') playSound(sfx.button);
  const checked = document.querySelector(`input[name="gq${index}"]:checked`);
  const resDiv = document.getElementById(`gq-res-${index}`);
  resDiv.style.display = 'block';
  
  if (!checked) {
    resDiv.style.borderLeftColor = 'var(--error)';
    resDiv.innerHTML = '<span style="color:var(--error); font-weight:bold;">먼저 답을 선택해 주세요.</span>';
    return;
  }

  const isCorrect = (checked.value === correctAns.toString());
  resDiv.style.borderLeftColor = isCorrect ? 'var(--success)' : 'var(--error)';
  resDiv.innerHTML = `
    <div style="font-weight:bold; font-size:15px; margin-bottom:8px; color:${isCorrect ? 'var(--success)' : 'var(--error)'};">
      ${isCorrect ? '⭕ 정답입니다!' : '❌ 틀렸습니다. (정답: ' + correctAns + '번)'}
    </div>
    <div style="font-size:14px; color:var(--text); line-height:1.5;">
      <span style="color:var(--indigo); font-weight:bold; font-size:12px; display:block; margin-bottom:4px;">[해설]</span>
      ${explanation}
    </div>
  `;
}

function delExamWrong(index, currentLabel) {
  if (typeof playSound === 'function') playSound(sfx.button);
  examWrongNote.splice(index, 1); saveExamWrongLocal();
  const remaining = examWrongNote.filter(n => (n.examTitle || '기타') === currentLabel);
  if(remaining.length === 0) showExamWrongParts(); else showExamWrongWords(currentLabel);
}

function startComboTest() {
  if (typeof playSound === 'function') playSound(sfx.button);
  const testItems = []; for(let i=1; i<=40; i++) testItems.push({ w: 'a', m: '콤보 애니메이션 테스트 ' + i + '/40', c: "'a'만 치고 엔터를 누르세요!" });
  openModeSelect(testItems, 'TEST');
}

// 아코디언 토글
function togglePracticalList() {
  const list = document.getElementById('practical-list');
  const icon = document.getElementById('practical-toggle-icon');
  const isHidden = list.style.display === 'none';
  list.style.display = isHidden ? 'block' : 'none';
  icon.textContent = isHidden ? '▲' : '▼';
}

// 이벤트 리스너
document.getElementById('f-word').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('f-mean').focus();});
document.getElementById('s-game').addEventListener('click', function() { const gInput = document.getElementById('g-input'); if(gInput) gInput.focus(); });
document.addEventListener('click', function(e) {
  const target = e.target; if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
  const isClickable = target.tagName === 'BUTTON' || target.closest('button') || target.hasAttribute('onclick') || target.closest('[onclick]') || target.classList.contains('nav-tab') || target.classList.contains('exam-card') || target.classList.contains('part-card');
  if (isClickable) playSound(sfx.button);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const loginScreen = document.getElementById('s-login'), signupScreen = document.getElementById('s-signup');
  if (loginScreen && loginScreen.classList.contains('active')) { if (['login-email', 'login-pw'].includes(document.activeElement.id)) handleLogin(); } 
  else if (signupScreen && signupScreen.classList.contains('active')) { if (['signup-username','signup-email','signup-pw','signup-pw2'].includes(document.activeElement.id)) handleSignup(); }
});

// 초기화
window.addEventListener('DOMContentLoaded', async () => {
  setTimeout(async () => { 
    checkSession(); 
    await loadWordsFromDB(); 
    await loadPastExamsFromDB();
    renderDailyGoal();
  }, 200);
});



// ============================================
// 오늘 학습 목표 시스템
// ============================================
const DAILY_GOAL_DEFAULT = 30;
const DAILY_GOAL_REWARD_LP = 5;

function dailyGoalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function getDailyGoalKey() {
  const userId = currentUser?.id || 'guest';
  return `te_daily_goal_v1_${userId}`;
}
function getDefaultDailyGoalState() {
  return { date: dailyGoalDateKey(), target: DAILY_GOAL_DEFAULT, completed: 0, rewardClaimed: false, streak: 0, lastCompletedDate: null };
}
function getDailyGoalState() {
  const today = dailyGoalDateKey();
  try {
    const raw = localStorage.getItem(getDailyGoalKey());
    if (!raw) return getDefaultDailyGoalState();
    const state = { ...getDefaultDailyGoalState(), ...JSON.parse(raw) };
    if (state.date !== today) {
      return { ...state, date: today, completed: 0, rewardClaimed: false };
    }
    state.target = Math.max(10, Math.min(200, Number(state.target) || DAILY_GOAL_DEFAULT));
    state.completed = Math.max(0, Number(state.completed) || 0);
    return state;
  } catch (e) {
    return getDefaultDailyGoalState();
  }
}
function saveDailyGoalState(state) {
  localStorage.setItem(getDailyGoalKey(), JSON.stringify(state));
}
function grantDailyGoalLP(lp) {
  if (!lp) return;
  if (typeof grantAttendanceLP === 'function') {
    grantAttendanceLP(lp);
  } else if (typeof getTierState === 'function' && typeof saveTierState === 'function') {
    const st = getTierState();
    st.lp = Math.max(0, (st.lp || 0) + lp);
    saveTierState(st);
  }
}
function renderDailyGoal() {
  const state = getDailyGoalState();
  const target = Math.max(10, Math.min(200, Number(state.target) || DAILY_GOAL_DEFAULT));
  const completed = Math.min(Number(state.completed) || 0, target);
  const remain = Math.max(0, target - completed);
  const percent = target > 0 ? Math.min(100, Math.round(completed / target * 100)) : 0;

  const sub = document.getElementById('daily-goal-sub');
  const fill = document.getElementById('daily-goal-fill');
  const remaining = document.getElementById('daily-goal-remaining');
  const date = document.getElementById('daily-goal-date');
  const input = document.getElementById('daily-goal-input');

  if (sub) sub.textContent = `${completed} / ${target}문제 완료`;
  if (fill) fill.style.width = `${percent}%`;
  if (remaining) remaining.textContent = remain > 0 ? `${remain}문제 남음` : `목표 달성! +${DAILY_GOAL_REWARD_LP} LP`;
  if (date) date.textContent = '오늘';
  if (input && document.activeElement !== input) input.value = target;
}
function saveDailyGoal() {
  const input = document.getElementById('daily-goal-input');
  const nextTarget = Math.max(10, Math.min(200, Number(input?.value) || DAILY_GOAL_DEFAULT));
  const state = getDailyGoalState();
  state.target = nextTarget;
  saveDailyGoalState(state);
  renderDailyGoal();
  toast(`오늘 목표를 ${nextTarget}문제로 저장했어요`);
}
function recordDailyGoalProgress(count) {
  const add = Math.max(0, Number(count) || 0);
  if (!add) { renderDailyGoal(); return; }
  const state = getDailyGoalState();
  const before = Number(state.completed) || 0;
  state.completed = Math.min((Number(state.target) || DAILY_GOAL_DEFAULT), before + add);

  const reachedNow = before < state.target && state.completed >= state.target;
  if (reachedNow && !state.rewardClaimed) {
    state.rewardClaimed = true;
    const yesterday = dailyGoalDateKey(addDays(new Date(), -1));
    state.streak = state.lastCompletedDate === yesterday ? (state.streak || 0) + 1 : 1;
    state.lastCompletedDate = state.date;
    grantDailyGoalLP(DAILY_GOAL_REWARD_LP);
    toast(`오늘 학습 목표 달성! +${DAILY_GOAL_REWARD_LP} LP`);
  }

  saveDailyGoalState(state);
  renderDailyGoal();
}


// ============================================
// 28일 출석체크 시스템
// ============================================
const ATTENDANCE_MAX_DAYS = 28;
const ATTENDANCE_REWARDS = Array.from({ length: ATTENDANCE_MAX_DAYS }, (_, i) => {
  const day = i + 1;
  if (day === 7) return 15;
  if (day === 14) return 30;
  if (day === 21) return 50;
  if (day === 28) return 85;
  return 5;
}); // 28일 총합 300 LP

function pad2(n){ return String(n).padStart(2, '0'); }
function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function getCurrentSeasonInfo(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (m >= 3 && m <= 5) return { id: `${y}_SPRING`, name: `${y} Spring Season`, desc: '3~5월 · 정처기 필기 시즌' };
  if (m >= 6 && m <= 8) return { id: `${y}_SUMMER`, name: `${y} Summer Season`, desc: '6~8월 · 정처기/방학 집중 시즌' };
  if (m >= 9 && m <= 11) return { id: `${y}_FALL`, name: `${y} Fall Season`, desc: '9~11월 · 졸업시험 시즌' };
  const winterYear = m === 12 ? y : y - 1;
  return { id: `${winterYear}_WINTER`, name: `${winterYear} Winter Season`, desc: '12~2월 · 겨울방학 준비 시즌' };
}
function getAttendanceKey() {
  const userId = currentUser?.id || 'guest';
  const season = getCurrentSeasonInfo();
  return `te_attendance_v1_${userId}_${season.id}`;
}
function getDefaultAttendanceState() {
  const season = getCurrentSeasonInfo();
  return {
    seasonId: season.id,
    checkedDates: [],
    count: 0,
    streak: 0,
    lastDate: null,
    totalLP: 0
  };
}
function getAttendanceState() {
  try {
    const raw = localStorage.getItem(getAttendanceKey());
    if (!raw) return getDefaultAttendanceState();
    const s = JSON.parse(raw);
    return {
      ...getDefaultAttendanceState(),
      ...s,
      checkedDates: Array.isArray(s.checkedDates) ? s.checkedDates : []
    };
  } catch (e) {
    return getDefaultAttendanceState();
  }
}
function saveAttendanceState(state) {
  localStorage.setItem(getAttendanceKey(), JSON.stringify(state));
}
function getAttendanceReward(day) {
  return ATTENDANCE_REWARDS[Math.max(0, Math.min(day - 1, ATTENDANCE_REWARDS.length - 1))] || 0;
}
function grantAttendanceLP(lp) {
  if (typeof getTierState === 'function' && typeof saveTierState === 'function') {
    const state = getTierState();
    state.lp = Math.max(0, (state.lp || 0) + lp);
    saveTierState(state);
    if (typeof renderMyTierCard === 'function') renderMyTierCard();
    return state.lp;
  }
  // 랭킹 시스템이 아직 로드되지 않은 경우를 대비한 예비 저장
  const fallbackKey = 'te_attendance_lp_pending';
  const pending = Number(localStorage.getItem(fallbackKey) || 0) + lp;
  localStorage.setItem(fallbackKey, String(pending));
  return pending;
}
function openAttendanceModal() {
  playSound(sfx.button);
  renderAttendance();
  openModal('m-attendance');
}
function renderAttendance() {
  const season = getCurrentSeasonInfo();
  const state = getAttendanceState();
  const today = getLocalDateKey();
  const checkedSet = new Set(state.checkedDates || []);
  const checkedToday = checkedSet.has(today);
  const count = Math.min(state.count || checkedSet.size || 0, ATTENDANCE_MAX_DAYS);

  const seasonName = document.getElementById('att-season-name');
  const seasonDesc = document.getElementById('att-season-desc');
  const streak = document.getElementById('att-streak');
  const countText = document.getElementById('att-count-text');
  const lpText = document.getElementById('att-lp-text');
  const fill = document.getElementById('att-progress-fill');
  const btn = document.getElementById('attendance-check-btn');
  const grid = document.getElementById('attendance-calendar');

  if (seasonName) seasonName.textContent = season.name;
  if (seasonDesc) seasonDesc.textContent = season.desc;
  if (streak) streak.textContent = `🔥 ${state.streak || 0}일 연속`;
  if (countText) countText.textContent = `${count} / ${ATTENDANCE_MAX_DAYS}일 출석`;
  if (lpText) lpText.textContent = `총 ${state.totalLP || 0} LP 획득`;
  if (fill) fill.style.width = `${Math.round(count / ATTENDANCE_MAX_DAYS * 100)}%`;

  if (grid) {
    grid.innerHTML = '';
    for (let day = 1; day <= ATTENDANCE_MAX_DAYS; day++) {
      const cell = document.createElement('div');
      cell.className = 'att-day' + (day <= count ? ' checked' : '') + (day === count + 1 && !checkedToday ? ' today' : '');
      cell.innerHTML = `<div>${day}</div><div class="att-reward">+${getAttendanceReward(day)} LP</div>`;
      grid.appendChild(cell);
    }
  }

  if (btn) {
    if (count >= ATTENDANCE_MAX_DAYS) {
      btn.disabled = true;
      btn.textContent = '28일 출석 완료';
      btn.style.opacity = '0.65';
    } else if (checkedToday) {
      btn.disabled = true;
      btn.textContent = '오늘 출석 완료';
      btn.style.opacity = '0.65';
    } else {
      btn.disabled = false;
      btn.textContent = `오늘 출석하기 (+${getAttendanceReward(count + 1)} LP)`;
      btn.style.opacity = '1';
    }
  }
}
function checkAttendance() {
  const state = getAttendanceState();
  const today = getLocalDateKey();
  if ((state.checkedDates || []).includes(today)) {
    toast('오늘은 이미 출석했어요');
    renderAttendance();
    return;
  }
  if ((state.count || 0) >= ATTENDANCE_MAX_DAYS) {
    toast('이번 28일 출석을 모두 완료했어요');
    renderAttendance();
    return;
  }

  const yesterday = getLocalDateKey(addDays(new Date(), -1));
  state.streak = state.lastDate === yesterday ? (state.streak || 0) + 1 : 1;
  state.lastDate = today;
  state.checkedDates = [...(state.checkedDates || []), today];
  state.count = Math.min((state.count || 0) + 1, ATTENDANCE_MAX_DAYS);

  const reward = getAttendanceReward(state.count);
  state.totalLP = (state.totalLP || 0) + reward;
  grantAttendanceLP(reward);
  saveAttendanceState(state);

  playSound(sfx.button);
  toast(`출석 완료! +${reward} LP` + (state.count === ATTENDANCE_MAX_DAYS ? ' · 28일 완주!' : ''));
  renderAttendance();
}

// ============================================
// 통계 페이지 로직
// ============================================
let chartTrend = null, chartParts = null, chartExams = null;
async function loadStats() {
  if (!currentUser) { toast('로그인이 필요해요'); return; }
  document.getElementById('stats-loading').style.display = 'block'; document.getElementById('stats-empty').style.display = 'none'; document.getElementById('stats-content').style.display = 'none';
  const { data: records, error } = await supabaseClient.from('game_records').select('*').eq('user_id', currentUser.id).order('played_at', { ascending: false });
  document.getElementById('stats-loading').style.display = 'none';
  if (!records || records.length === 0) { document.getElementById('stats-empty').style.display = 'block'; document.getElementById('stats-total-games').textContent = '0판'; return; }
  document.getElementById('stats-content').style.display = 'block';

  const totalGames = records.length;
  document.getElementById('stats-total-games').textContent = totalGames + '판';
  document.getElementById('stat-avg-wpm').textContent = Math.round(records.reduce((s, r) => s + (r.wpm || 0), 0) / totalGames);
  document.getElementById('stat-best-wpm').textContent = '최고 ' + Math.max(...records.map(r => r.wpm || 0));
  document.getElementById('stat-avg-acc').textContent = Math.round(records.reduce((s, r) => s + (r.accuracy || 0), 0) / totalGames) + '%';
  document.getElementById('stat-best-acc').textContent = '최고 ' + Math.max(...records.map(r => r.accuracy || 0)) + '%';
  document.getElementById('stat-total-words').textContent = records.reduce((s, r) => s + (r.total_words || 0), 0).toLocaleString();
  document.getElementById('stat-best-combo').textContent = Math.max(...records.map(r => r.best_combo || 0));

  const recent20 = records.slice(0, 20).reverse();
  drawTrendChart(recent20.map((r, i) => '#' + (i + 1)), recent20.map(r => r.wpm || 0), recent20.map(r => r.accuracy || 0));

  const partGroup = {}; records.forEach(r => { const key = r.part || '기타'; if (!partGroup[key]) partGroup[key] = []; partGroup[key].push(r.wpm || 0); });
  drawPartsChart(Object.keys(partGroup), Object.keys(partGroup).map(k => Math.round(partGroup[k].reduce((s, v) => s + v, 0) / partGroup[k].length)));

  const examGroup = {}; records.forEach(r => { const key = r.exam === 'jcs' ? '정처기' : r.exam === 'toeic' ? '토익' : r.exam === 'custom' ? '커스텀' : (r.exam || '기타'); examGroup[key] = (examGroup[key] || 0) + 1; });
  drawExamsChart(Object.keys(examGroup), Object.values(examGroup));

  const recentList = document.getElementById('recent-records-list'); recentList.innerHTML = '';
  records.slice(0, 10).forEach(r => {
    const date = new Date(r.played_at);
    const item = document.createElement('div');
    item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:var(--bg2); border-radius:8px; font-size:13px;';
    item.innerHTML = `<div style="flex:1; display:flex; gap:12px; align-items:center;"><span style="color:var(--muted); font-family:var(--f-mono); min-width:80px;">${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}</span><span style="color:var(--text); font-weight:500;">${r.exam === 'jcs' ? '정처기' : r.exam === 'toeic' ? '토익' : r.exam === 'custom' ? '커스텀' : (r.exam || '')} · ${r.part || '—'}</span><span style="color:var(--muted); font-size:11px;">${r.game_mode === 'timeattack' ? `⏱️ ${r.time_limit}초` : '♾️ 연습'}</span></div><div style="display:flex; gap:14px; font-family:var(--f-mono);"><span style="color:var(--indigo);">${r.wpm} WPM</span><span style="color:var(--green);">${r.accuracy}%</span><span style="color:var(--amber);">🔥${r.best_combo}</span></div>`;
    recentList.appendChild(item);
  });
}

function drawTrendChart(labels, wpmData, accData) {
  const ctx = document.getElementById('chart-trend').getContext('2d'); if (chartTrend) chartTrend.destroy();
  chartTrend = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [ { label: 'WPM', data: wpmData, borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.3, yAxisID: 'y', fill: true }, { label: '정확도 (%)', data: accData, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.3, yAxisID: 'y1', fill: true } ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: getCssVar('--text') } } }, scales: { y: { type: 'linear', position: 'left', title: { display: true, text: 'WPM', color: '#6366f1' }, ticks: { color: getCssVar('--muted') }, grid: { color: getCssVar('--border') } }, y1: { type: 'linear', position: 'right', min: 0, max: 100, title: { display: true, text: 'ACC %', color: '#10b981' }, ticks: { color: getCssVar('--muted') }, grid: { drawOnChartArea: false } }, x: { ticks: { color: getCssVar('--muted') }, grid: { color: getCssVar('--border') } } } } });
}
function drawPartsChart(labels, data) {
  const ctx = document.getElementById('chart-parts').getContext('2d'); if (chartParts) chartParts.destroy();
  chartParts = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: '평균 WPM', data: data, backgroundColor: 'rgba(99, 102, 241, 0.6)', borderColor: '#6366f1', borderWidth: 1.5, borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { color: getCssVar('--muted') }, grid: { color: getCssVar('--border') } }, y: { ticks: { color: getCssVar('--text'), font: { size: 11 } }, grid: { display: false } } } } });
}
function drawExamsChart(labels, data) {
  const ctx = document.getElementById('chart-exams').getContext('2d'); if (chartExams) chartExams.destroy();
  chartExams = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444'], borderWidth: 2, borderColor: getCssVar('--card') }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: getCssVar('--text'), padding: 15 } } } } });
}
function getCssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; }

// ============================================
// 실기 기출문제 관련
// ============================================
let practicalState = {
  examId: null,
  title: null,
  questions: [],
  current: 0,
  answers: [],
  startTime: null
};

async function startPracticalExam(title, examId) {
  practicalState.examId = examId;
  practicalState.title = title;
  practicalState.questions = [];
  practicalState.current = 0;
  practicalState.answers = [];
  practicalState.startTime = Date.now();

  document.getElementById('exam-image-placeholder').style.display = 'none';
  document.getElementById('exam-text-view').style.display = 'flex';
  document.getElementById('exam-text-view').innerHTML = '<div style="margin:auto; color:var(--muted);">문제를 불러오는 중...</div>';

  try {
    const { data, error } = await supabaseClientPractical
      .from('practical_questions')
      .select('*')
      .eq('exam_id', examId)
      .order('q_no', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      document.getElementById('exam-text-view').innerHTML = '<div style="margin:auto; color:var(--muted);">문제가 없습니다.</div>';
      return;
    }

    practicalState.questions = data;
    practicalState.answers = new Array(data.length).fill('');

    document.getElementById('exam-list-view').style.display = 'none';
    document.getElementById('exam-solve-view').style.display = 'flex';
    document.getElementById('exam-audio-container').style.display = 'none';

    renderPracticalNav();
    showPracticalQuestion(0);

  } catch (e) {
    console.error('실기 문제 로딩 실패:', e);
    document.getElementById('exam-text-view').innerHTML = `<div style="margin:auto; color:red;">오류: ${e.message}</div>`;
  }
}

function renderPracticalNav() {
  const omr = document.getElementById('omr-card');
  omr.innerHTML = '';
  practicalState.questions.forEach((q, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn-gray';
    btn.id = `pnav-${i}`;
    btn.style.cssText = 'width:100%; margin-bottom:6px; padding:8px 10px; text-align:left; font-size:13px;';
    btn.textContent = `Q${q.q_no}. ${q.question.slice(0, 20)}${q.question.length > 20 ? '…' : ''}`;
    btn.onclick = () => showPracticalQuestion(i);
    omr.appendChild(btn);
  });
}

function showPracticalQuestion(index) {
  practicalState.current = index;
  const q = practicalState.questions[index];
  const total = practicalState.questions.length;

  practicalState.questions.forEach((_, i) => {
    const btn = document.getElementById(`pnav-${i}`);
    if (!btn) return;
    btn.style.background = i === index ? 'var(--indigo-t)' : '';
    btn.style.color = i === index ? 'var(--indigo)' : '';
    btn.style.border = i === index ? '1.5px solid var(--indigo)' : '';
  });

  const view = document.getElementById('exam-text-view');
  view.style.display = 'flex';
  view.style.flexDirection = 'column';
  view.style.padding = '30px 40px';
  view.style.gap = '12px';
  view.innerHTML = `
  <div style="font-size:12px; color:var(--muted); font-family:var(--f-mono);">
    ${practicalState.title} &nbsp;·&nbsp; Q ${index + 1} / ${total}
  </div>
  <div style="font-size:18px; font-weight:600; line-height:1.7; color:var(--text);">
    Q${q.q_no}. ${q.question}
  </div>

  ${q.sub_text ? `<div style="border:1.5px solid var(--border); border-radius:10px; padding:6px 12px; font-size:15px; line-height:1.9; color:var(--text); white-space:pre-line;">${q.sub_text.trim()}</div>` : ''}

  ${q.code_text ? `<pre style="background:#ffffff; color:#000000; padding:8px 12px; border-radius:8px; overflow-x:auto; font-family:var(--f-mono); font-size:14px; line-height:1.6; white-space:pre; border:1.5px solid var(--border);">${q.code_text}</pre>` : ''}

  ${q.image_url ? `<img src="${q.image_url}" style="max-width:30%; border-radius:10px; border:1.5px solid var(--border);"/>` : ''}

  <div style="display:flex; flex-direction:column; gap:8px;">
    <label style="font-size:12px; color:var(--muted); font-family:var(--f-mono); letter-spacing:1px;">답안 입력</label>
    <input
      id="practical-input"
      class="form-input"
      type="text"
      placeholder="정답을 입력하세요"
      value="${practicalState.answers[index] || ''}"
      autocomplete="off"
      spellcheck="false"
      style="font-size:16px; padding:14px;"
      onkeydown="if(event.key==='Enter') savePracticalAnswer(${index})"
    />
  </div>
  <div style="display:flex; gap:10px;">
    ${index > 0 ? `<button class="btn-gray" onclick="savePracticalAnswer(${index}); showPracticalQuestion(${index - 1})">← 이전</button>` : ''}
    ${index < total - 1
      ? `<button class="btn-indigo" onclick="savePracticalAnswer(${index}); showPracticalQuestion(${index + 1})">다음 →</button>`
      : `<button class="btn-start" onclick="savePracticalAnswer(${index}); gradePracticalExam()">제출 및 채점 →</button>`
    }
  </div>
`;

  setTimeout(() => {
    const input = document.getElementById('practical-input');
    if (input) input.focus();
  }, 50);
}

function savePracticalAnswer(index) {
  const input = document.getElementById('practical-input');
  if (input) practicalState.answers[index] = input.value.trim();
}

function gradePracticalExam() {
  const questions = practicalState.questions;
  const answers = practicalState.answers;
  let correct = 0;
  const results = [];

  questions.forEach((q, i) => {
    const userAns = (answers[i] || '').trim().toLowerCase();
    const correctAns = (q.answer || '').trim().toLowerCase();
    const isCorrect = userAns === correctAns;
    if (isCorrect) correct++;
    results.push({ q, userAns: answers[i] || '', isCorrect });
  });

  showPracticalResult(correct, results);
}

function showPracticalResult(correct, results) {
  const total = results.length;
  const scoreText = `${correct} / ${total}`;

  document.getElementById('exam-res-icon').textContent = correct >= total * 0.6 ? '🎉' : '😢';
  document.getElementById('exam-res-title').textContent = '실기 채점 결과';
  document.getElementById('exam-res-sub').textContent = practicalState.title;
  document.getElementById('exam-score').textContent = scoreText;
  document.getElementById('exam-pass').textContent = correct >= total * 0.6 ? 'PASS' : 'FAIL';
  document.getElementById('exam-pass').style.color = correct >= total * 0.6 ? 'var(--success)' : 'var(--red, #e53e3e)';

  const list = document.getElementById('exam-rw-list');
  list.innerHTML = '';
  results.forEach((r, i) => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:12px; border-bottom:1px solid var(--border); font-size:14px; line-height:1.8;';
    div.innerHTML = `
      <div style="font-weight:600; color:${r.isCorrect ? 'var(--success)' : 'var(--red, #e53e3e)'};">
        ${r.isCorrect ? '✅' : '❌'} Q${r.q.q_no}. ${r.q.question}
      </div>
      <div style="color:var(--muted);">내 답: <span style="color:var(--text);">${r.userAns || '(미입력)'}</span></div>
      <div style="color:var(--muted);">정답: <span style="color:var(--indigo); font-weight:600;">${r.q.answer}</span></div>
      ${r.q.explanation ? `<div style="color:var(--muted); font-size:13px; margin-top:4px;">💡 ${r.q.explanation}</div>` : ''}
    `;
    list.appendChild(div);
  });

  showScreen('s-exam-result');
}