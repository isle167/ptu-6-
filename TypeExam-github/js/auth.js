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
  const email    = document.getElementById('signup-email').value.trim();
  const pw       = document.getElementById('signup-pw').value.trim();
  const pw2      = document.getElementById('signup-pw2').value.trim();

  if (!username || !email || !pw || !pw2) { toast('모든 항목을 입력해주세요'); return; }
  if (pw !== pw2) { toast('비밀번호가 일치하지 않아요'); return; }
  if (pw.length < 6) { toast('비밀번호는 6자 이상이어야 해요'); return; }

  toast('회원가입 처리 중...');
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password: pw,
    options: { data: { username } }
  });

  if (error) { toast('회원가입 실패: ' + error.message); return; }

  // profiles 테이블에 username 저장 (이메일 인증 전에도 upsert)
  if (data?.user) {
    await supabaseClient.from('profiles').upsert({
      id: data.user.id,
      username: username
    }, { onConflict: 'id' });
  }

  playSound(sfx.button);
  document.getElementById('verify-email-text').textContent = email + ' 으로 인증 메일을 보냈어요';
  showAuthScreen('s-verify');
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-pw').value.trim();
  if (!email || !pw) { toast('이메일과 비밀번호를 입력해주세요'); return; }

  toast('로그인 중...');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pw });

  if (error) { toast('로그인 실패: ' + error.message); return; }

  currentUser = data.user;
  playSound(sfx.button);

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('username, is_admin')
    .eq('id', data.user.id)
    .single();

  const displayName = profile?.username || data.user.email.split('@')[0];
  currentUser._isAdmin = profile?.is_admin || false;

  toast('환영합니다, ' + displayName + '님!');
  document.getElementById('info-name').textContent = displayName;

  const navAdmin = document.getElementById('nav-admin');
  if (navAdmin) navAdmin.style.display = currentUser._isAdmin ? 'inline-block' : 'none';

  await loadUserData();
  document.getElementById('main-nav').style.display = 'flex';
  showScreen('s-main-choice', false);
}

async function handleForgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { toast('이메일을 입력해주세요'); return; }

  toast('전송 중...');
  const redirectTo = window.location.href.split('#')[0]; // 현재 페이지 URL (hash 제외)
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) { toast('전송 실패: ' + error.message); return; }
  playSound(sfx.button);
  toast('✅ 재설정 링크를 이메일로 보냈어요!');
  setTimeout(() => showAuthScreen('s-login'), 2000);
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

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('username, is_admin')
      .eq('id', session.user.id)
      .single();

    const displayName = profile?.username || session.user.email.split('@')[0];
    currentUser._isAdmin = profile?.is_admin || false;
    document.getElementById('info-name').textContent = displayName;

    const navAdmin = document.getElementById('nav-admin');
    if (navAdmin) navAdmin.style.display = currentUser._isAdmin ? 'inline-block' : 'none';

    await loadUserData();
    document.getElementById('main-nav').style.display = 'flex';
    showScreen('s-main-choice', false);
  }
}

// 엔터키 로그인/회원가입
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const loginScreen  = document.getElementById('s-login');
  const signupScreen = document.getElementById('s-signup');
  const forgotScreen = document.getElementById('s-forgot');
  if (loginScreen && loginScreen.classList.contains('active')) {
    if (['login-email', 'login-pw'].includes(document.activeElement.id)) handleLogin();
  } else if (signupScreen && signupScreen.classList.contains('active')) {
    if (['signup-username','signup-email','signup-pw','signup-pw2'].includes(document.activeElement.id)) handleSignup();
  } else if (forgotScreen && forgotScreen.classList.contains('active')) {
    if (document.activeElement.id === 'forgot-email') handleForgotPassword();
  }
});
