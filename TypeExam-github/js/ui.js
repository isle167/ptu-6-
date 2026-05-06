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
  const navTrend = document.getElementById('nav-trend');
  const navAdmin = document.getElementById('nav-admin');
  const navLogo = document.querySelector('.nav-logo');
  
  if (navWrong && navCustom && navStats) {
    if (id === 's-main-choice' || id === 's-login' || id === 's-signup' || id === 's-verify' || id === 's-forgot') {
      navWrong.style.display = 'none'; navCustom.style.display = 'none'; navStats.style.display = 'none';
      if(navRank) navRank.style.display = 'none';
      if(navTrend) navTrend.style.display = 'none';
      if(navAdmin) navAdmin.style.display = 'none';
    } else {
      navWrong.style.display = 'inline-block';
      navCustom.style.display = (currentMode === 'pastexam' || id.includes('exam')) ? 'none' : 'inline-block';
      navStats.style.display = (currentMode === 'pastexam' || id.includes('exam')) ? 'none' : 'inline-block';
      if(navRank) navRank.style.display = (currentMode === 'pastexam' || id.includes('exam')) ? 'none' : 'inline-block';
      if(navTrend) navTrend.style.display = 'inline-block';
      if(navAdmin && currentUser?._isAdmin) navAdmin.style.display = 'inline-block';
    }
  }

  if (navLogo) {
    if (id.includes('exam') && id !== 's-main-choice') navLogo.textContent = '기출문제 풀이';
    else if (id === 's-main-choice' || id === 's-login') navLogo.textContent = 'Untitled';
    else navLogo.textContent = 'TypeExam';
  }

  if(id==='s-wrong') renderWrong();
  if(id==='s-custom') renderCustom();
  if(id==='s-stats') loadStats();
  if(id==='s-ranking' && typeof renderRanking === 'function') renderRanking('all');
  if(id==='s-exam-wrong') renderExamWrong();
  if(id==='s-trend' && typeof loadTrend === 'function') loadTrend();
  if(id==='s-admin' && typeof loadAdminPanel === 'function') loadAdminPanel();
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
