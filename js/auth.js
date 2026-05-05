// ============================================
// 인증 (로그인 / 회원가입 / 세션)
// ============================================

function showAuthScreen(id) {
  playSound(sfx.button);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function handleSignup() {
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pw = document.getElementById('signup-pw').value.trim();
  const pw2 = document.getElementById('signup-pw2').value.trim();

  if (!username || !email || !pw || !pw2) { toast('모든 항목을 입력해주세요'); return; }
  if (pw !== pw2) { toast('비밀번호가 일치하지 않아요'); return; }

  toast('회원가입 처리 중...');
  const { data, error } = await supabaseClient.auth.signUp({ 
    email, 
    password: pw, 
    options: { data: { username } } 
  });
  
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

// 엔터키 로그인/회원가입
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const loginScreen = document.getElementById('s-login');
  const signupScreen = document.getElementById('s-signup');
  if (loginScreen && loginScreen.classList.contains('active')) {
    if (['login-email', 'login-pw'].includes(document.activeElement.id)) handleLogin();
  } else if (signupScreen && signupScreen.classList.contains('active')) {
    if (['signup-username','signup-email','signup-pw','signup-pw2'].includes(document.activeElement.id)) handleSignup();
  }
});
