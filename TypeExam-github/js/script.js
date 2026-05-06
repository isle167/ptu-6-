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
let currentUser = null;
let currentMode = null;
let wrongNote = [];
let customWords = [];

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
// Supabase 데이터 로드
// ============================================
async function loadWordsFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from('words')
      .select('*')
      .eq('is_custom', false)
      .order('id');

    if (error) {
      console.error('단어 로딩 오류:', error);
      toast('단어 데이터를 불러오지 못했어요: ' + error.message);
      return false;
    }
    if (!data || data.length === 0) {
      console.warn('words 테이블이 비어있어요');
      return false;
    }

    DB.jcs.parts = {}; DB.toeic.parts = {};
    data.forEach(row => {
      const examKey = row.exam, partKey = row.part;
      if (!DB[examKey]) return;
      if (!DB[examKey].parts[partKey]) DB[examKey].parts[partKey] = { desc: PART_DESC[partKey] || '', items: [] };
      DB[examKey].parts[partKey].items.push({ w: row.word, m: row.meaning, c: row.context || '' });
    });
    console.log('✅ 단어 로딩 완료:', data.length + '개');
    return true;
  } catch (e) {
    console.error('loadWordsFromDB 예외:', e);
    return false;
  }
}

async function loadPastExamsFromDB() {
  try {
    const { data, error } = await supabaseClient
      .from('past_exams')
      .select('*')
      .order('exam_key', { ascending: true })
      .order('q_num', { ascending: true });

    if (error) {
      console.error('기출문제 로딩 실패:', error);
      return false;
    }
    if (!data || data.length === 0) {
      console.warn('past_exams 테이블이 비어있어요');
      return false;
    }

    pastExams = {};
    data.forEach(row => {
      const key = row.exam_key;
      if (!pastExams[key]) pastExams[key] = [];
      pastExams[key].push({
        qNum: row.q_num, q: row.question, code: row.code_snippet,
        image_desc: row.image_desc, table: row.table_html, o: row.options, a: row.answer
      });
    });
    console.log('✅ 기출문제 로딩 완료:', data.length + '문제');
    return true;
  } catch (e) {
    console.error('loadPastExamsFromDB 예외:', e);
    return false;
  }
}

async function loadUserData() {
  if (!currentUser) return;
  try {
    const { data: wrongData } = await supabaseClient
      .from('wrong_notes')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('saved_at', { ascending: false });

    wrongNote = (wrongData || []).map(row => ({
      id: row.id, w: row.word, m: row.meaning, c: row.context || '',
      exam: row.exam, examLabel: row.exam_label, part: row.part,
      cnt: row.count, hinted: row.hinted, savedAt: new Date(row.saved_at).getTime()
    }));

    const { data: customData } = await supabaseClient
      .from('words')
      .select('*')
      .eq('is_custom', true)
      .eq('created_by', currentUser.id)
      .order('created_at', { ascending: false });

    customWords = (customData || []).map(row => ({
      id: row.id, w: row.word, m: row.meaning, c: row.context || '', cat: row.part
    }));
  } catch (e) {
    console.error('loadUserData 예외:', e);
  }
}

// ============================================
// 공통 이벤트
// ============================================
document.addEventListener('click', function(e) {
  const target = e.target;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
  const isClickable = target.tagName === 'BUTTON' || target.closest('button') ||
    target.hasAttribute('onclick') || target.closest('[onclick]') ||
    target.classList.contains('nav-tab') ||
    target.classList.contains('exam-card') ||
    target.classList.contains('part-card');
  if (isClickable) playSound(sfx.button);
});

// ============================================
// 앱 초기화
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
  // hash fragment 처리 (이메일 인증/비밀번호 재설정 리다이렉트)
  const hash = window.location.hash;
  if (hash.includes('error=access_denied') && hash.includes('otp_expired')) {
    toast('재설정 링크가 만료됐어요. 다시 요청해주세요.');
    history.replaceState(null, '', window.location.pathname);
    setTimeout(() => showAuthScreen('s-forgot'), 300);
    return;
  }
  if (hash.includes('access_token') || hash.includes('type=recovery')) {
    // 비밀번호 재설정 토큰 처리
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (session && hash.includes('type=recovery')) {
      // 비밀번호 변경 화면으로 이동
      history.replaceState(null, '', window.location.pathname);
      showPasswordResetScreen();
      return;
    }
    history.replaceState(null, '', window.location.pathname);
  }

  setTimeout(async () => {
    checkSession();
    await loadWordsFromDB();
    await loadPastExamsFromDB();
  }, 200);
});

function showPasswordResetScreen() {
  // 비밀번호 재설정 완료 화면 (간단 처리)
  const newPw = prompt('새 비밀번호를 입력하세요 (6자 이상):');
  if (!newPw || newPw.length < 6) { toast('비밀번호는 6자 이상이어야 해요'); return; }
  supabaseClient.auth.updateUser({ password: newPw }).then(({ error }) => {
    if (error) { toast('변경 실패: ' + error.message); return; }
    toast('✅ 비밀번호가 변경됐어요! 다시 로그인해주세요.');
    setTimeout(() => location.reload(), 1500);
  });
}
