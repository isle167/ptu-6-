
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
  const profileInput = document.getElementById('profile-username');
  if (profileInput) profileInput.value = displayName;
  
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
    const profileInput = document.getElementById('profile-username');
    if (profileInput) profileInput.value = displayName;
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

async function updateProfileName() {
  if (!currentUser) return toast('로그인이 필요해요');
  const input = document.getElementById('profile-username');
  const username = input.value.trim();
  if (!username || username.length > 20) return toast('닉네임은 1~20자로 입력해주세요');
  const { error } = await supabaseClient.from('profiles').update({ username }).eq('id', currentUser.id);
  if (error) return toast('닉네임 변경 실패: ' + error.message);
  document.getElementById('info-name').textContent = username;
  toast('닉네임을 변경했어요');
}

async function sendPasswordReset() {
  const email = currentUser?.email;
  if (!email) return toast('로그인이 필요해요');
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
  if (error) return toast('메일 발송 실패: ' + error.message);
  toast('비밀번호 재설정 메일을 보냈어요');
}

function resetLocalStudyData() {
  if (!confirm('이 기기에 저장된 오늘 목표/진행률을 초기화할까요?')) return;
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('te_daily_')) localStorage.removeItem(key);
  });
  if (typeof renderDailyGoal === 'function') renderDailyGoal();
  toast('학습 목표를 초기화했어요');
}

function requestAccountDeletion() {
  toast('계정 탈퇴 기능은 현재 준비 중입니다. 문의: support@typeexam.kr');
}

function showForgotPassword() {
  document.getElementById('forgot-email').value = document.getElementById('login-email')?.value || '';
  openModal('m-forgot');
}

async function sendForgotPasswordEmail() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) return toast('이메일을 입력해주세요');
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });
  if (error) return toast('메일 발송 실패: ' + error.message);
  toast('✉️ 비밀번호 재설정 메일을 보냈어요. 스팸함도 확인해보세요!');
  closeModal('m-forgot');
}
