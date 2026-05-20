// ============================================
// UI 공통 함수 및 화면 전환
// ============================================

function toast(msg){
  const existing=document.querySelector('.toast');if(existing)existing.remove();
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  document.getElementById('root').appendChild(t);setTimeout(()=>t.remove(),2100);
}

function openModal(id) { playSound(sfx.button); document.getElementById(id).classList.add('active'); }
function closeModal(id) { playSound(sfx.button); document.getElementById(id).classList.remove('active'); }

function showScreen(id, pushHistory = true){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const target = document.getElementById(id);
  if(target) target.classList.add('active');
  
  const navWrong = document.getElementById('nav-wrong');
  const navCustom = document.getElementById('nav-custom');
  const navStats = document.getElementById('nav-stats');
  const navRank = document.getElementById('nav-rank');
  const navLogo = document.querySelector('.nav-logo');
  
  if (navWrong && navCustom && navStats) {
    if (id === 's-main-choice' || id === 's-login' || id === 's-signup' || id === 's-verify') {
      navWrong.style.display = 'none'; navCustom.style.display = 'none'; navStats.style.display = 'none'; if(navRank) navRank.style.display = 'none';
    } else {
      navWrong.style.display = 'inline-block';
      navCustom.style.display = (currentMode === 'pastexam' || id.includes('exam')) ? 'none' : 'inline-block';
      navStats.style.display = (currentMode === 'pastexam' || id.includes('exam')) ? 'none' : 'inline-block';
      if(navRank) navRank.style.display = (currentMode === 'pastexam' || id.includes('exam')) ? 'none' : 'inline-block';
    }
  }

  if (navLogo) {
    if (id.includes('exam') && id !== 's-main-choice') navLogo.textContent = '기출문제 풀이';
    else if (id === 's-main-choice' || id === 's-login') navLogo.textContent = 'TypeExam v2';
    else navLogo.textContent = 'TypeExam v2';
  }

  if(id==='s-wrong') renderWrong();
  if(id==='s-custom') renderCustom();
  if(id==='s-stats') loadStats();
  if(id==='s-ranking' && typeof renderRanking === 'function') renderRanking('all');
  if(id==='s-exam-wrong') renderExamWrong();
  if(id==='s-home' && typeof renderDailyGoal === 'function') renderDailyGoal();
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

function getCssVar(name) { 
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888'; 
}

function formatTime(sec){
  if(!Number.isFinite(sec) || sec<=0) return '0:00';
  return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;
}

function setMode(mode) { currentMode = mode; }

function goWrongNote() {
  if (currentMode === 'pastexam') showScreen('s-exam-wrong');
  else showScreen('s-wrong');
}

// 초기 테마 적용
(function initTheme(){ applyTheme(localStorage.getItem('te_theme') || 'light', false); })();

window.addEventListener('online', () => toast('네트워크가 다시 연결됐어요'));
window.addEventListener('offline', () => toast('네트워크가 끊겼어요. 저장/AI 기능이 제한될 수 있어요'));
window.addEventListener('unhandledrejection', (event) => {
  console.warn('[TypeExam] unhandled rejection:', event.reason);
  toast('일시적인 오류가 발생했어요. 다시 시도해주세요.');
});

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyGoalState() {
  const day = todayKey();
  const goal = Number(localStorage.getItem('te_daily_goal') || '30');
  const done = Number(localStorage.getItem(`te_daily_done_${day}`) || '0');
  return { day, goal: Math.max(10, goal || 30), done: Math.max(0, done || 0) };
}

function renderDailyGoal() {
  const input = document.getElementById('daily-goal-input');
  if (!input) return;
  const { day, goal, done } = getDailyGoalState();
  const percent = Math.min(100, Math.round(done / goal * 100));
  input.value = goal;
  document.getElementById('daily-goal-sub').textContent = `${done} / ${goal}문제 완료`;
  document.getElementById('daily-goal-fill').style.width = percent + '%';
  document.getElementById('daily-goal-remaining').textContent = done >= goal ? '오늘 목표 달성' : `${goal - done}문제 남음`;
  document.getElementById('daily-goal-date').textContent = day;
}

function saveDailyGoal() {
  const input = document.getElementById('daily-goal-input');
  const goal = Math.min(200, Math.max(10, Number(input.value || 30)));
  localStorage.setItem('te_daily_goal', String(goal));
  renderDailyGoal();
  toast('오늘 목표를 저장했어요');
}

function addDailyProgress(count) {
  const day = todayKey();
  const key = `te_daily_done_${day}`;
  localStorage.setItem(key, String(Number(localStorage.getItem(key) || '0') + Math.max(0, count || 0)));
}
