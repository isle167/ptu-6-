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
// 📦 샘플 데이터 (DB 연결 실패 시 fallback)
// ============================================
const SAMPLE_WORDS = {
  jcs: {
    '데이터베이스': [
      { w: 'SELECT',      m: '데이터 조회 SQL 명령어',          c: 'SELECT * FROM users WHERE id = 1' },
      { w: 'INSERT',      m: '데이터 삽입 SQL 명령어',          c: "INSERT INTO users (name) VALUES ('홍길동')" },
      { w: 'UPDATE',      m: '데이터 수정 SQL 명령어',          c: "UPDATE users SET name='김철수' WHERE id=1" },
      { w: 'DELETE',      m: '데이터 삭제 SQL 명령어',          c: 'DELETE FROM users WHERE id = 1' },
      { w: 'JOIN',        m: '두 테이블 연결 SQL 구문',          c: 'SELECT * FROM a JOIN b ON a.id = b.id' },
      { w: 'INDEX',       m: '검색 속도 향상을 위한 색인 구조',  c: 'CREATE INDEX idx_name ON users(name)' },
      { w: 'PRIMARY KEY', m: '테이블의 고유 식별자',            c: 'id INT PRIMARY KEY AUTO_INCREMENT' },
      { w: 'FOREIGN KEY', m: '다른 테이블 기본키 참조 키',       c: 'FOREIGN KEY (user_id) REFERENCES users(id)' },
      { w: 'TRANSACTION', m: '원자적으로 실행되는 SQL 작업 단위', c: 'BEGIN; UPDATE ...; COMMIT;' },
      { w: 'ROLLBACK',    m: '트랜잭션 작업 취소 및 원상 복구',  c: 'ROLLBACK TO SAVEPOINT sp1' },
    ],
    '알고리즘': [
      { w: 'O(n)',       m: '선형 시간 복잡도',         c: '입력 크기 n에 비례하는 연산 수' },
      { w: 'O(log n)',   m: '로그 시간 복잡도',         c: '이진 탐색의 시간 복잡도' },
      { w: 'O(n²)',      m: '이차 시간 복잡도',         c: '버블 정렬의 최악 시간 복잡도' },
      { w: 'BFS',        m: '너비 우선 탐색 알고리즘',  c: '큐(Queue) 자료구조를 사용한 탐색' },
      { w: 'DFS',        m: '깊이 우선 탐색 알고리즘',  c: '스택(Stack) 또는 재귀를 사용한 탐색' },
      { w: 'Heap',       m: '완전 이진 트리 기반 우선순위 큐', c: '최대 힙: 부모 노드가 항상 자식보다 큼' },
      { w: 'Quicksort',  m: '분할 정복 기반 정렬 알고리즘', c: '평균 O(n log n), 최악 O(n²)' },
      { w: 'Stack',      m: 'LIFO 방식의 선형 자료구조', c: 'push/pop 연산으로 접근' },
      { w: 'Queue',      m: 'FIFO 방식의 선형 자료구조', c: 'enqueue/dequeue 연산으로 접근' },
      { w: 'Hash',       m: '키를 해시 함수로 변환하는 자료구조', c: '평균 O(1) 탐색 시간' },
    ],
    '네트워크': [
      { w: 'TCP',     m: '신뢰성 있는 연결 지향 전송 프로토콜', c: '3-way handshake로 연결 수립' },
      { w: 'UDP',     m: '비연결형 빠른 전송 프로토콜',         c: '스트리밍, 게임에 주로 사용' },
      { w: 'IP',      m: '인터넷 프로토콜, 패킷 주소 지정',     c: 'IPv4: 32비트, IPv6: 128비트' },
      { w: 'HTTP',    m: '웹 데이터 전송 프로토콜',             c: 'GET, POST, PUT, DELETE 메서드' },
      { w: 'DNS',     m: '도메인 이름을 IP 주소로 변환',        c: 'www.example.com → 93.184.216.34' },
      { w: 'HTTPS',   m: 'SSL/TLS로 암호화된 HTTP',            c: '포트 443 사용' },
      { w: 'Router',  m: '네트워크 간 패킷 전달 장비',          c: '라우팅 테이블로 경로 결정' },
      { w: 'Subnet',  m: '네트워크를 나눈 하위 네트워크',       c: '서브넷 마스크로 구분' },
    ],
    '보안': [
      { w: 'SQL Injection', m: 'SQL 쿼리에 악성 코드를 삽입하는 공격', c: "WHERE id=1 OR '1'='1'" },
      { w: 'XSS',      m: '웹 페이지에 악성 스크립트 삽입 공격', c: '<script>document.cookie</script>' },
      { w: 'CSRF',     m: '사용자 의지와 무관한 요청 위조 공격', c: '인증된 사용자를 악용하는 공격' },
      { w: 'AES',      m: '대칭키 블록 암호화 알고리즘',         c: '128/192/256비트 키 길이 지원' },
      { w: 'RSA',      m: '공개키 기반 비대칭 암호화 알고리즘',  c: '키 교환, 전자 서명에 사용' },
      { w: 'Firewall', m: '네트워크 트래픽 제어 보안 장비',      c: '패킷 필터링, 상태 검사 방화벽' },
    ],
    '소프트웨어공학': [
      { w: 'Agile',     m: '반복적이고 유연한 소프트웨어 개발 방법론', c: '스프린트 단위 개발, 빠른 피드백' },
      { w: 'Scrum',     m: '애자일 기반 협업 프레임워크',          c: '스프린트, 백로그, 데일리 스탠드업' },
      { w: 'MVC',       m: '모델-뷰-컨트롤러 아키텍처 패턴',       c: 'Model: 데이터, View: UI, Controller: 로직' },
      { w: 'Git',       m: '분산 버전 관리 시스템',                c: 'commit, branch, merge, pull, push' },
      { w: 'CI/CD',     m: '지속적 통합 및 배포 자동화 파이프라인', c: 'GitHub Actions, Jenkins로 구현' },
      { w: 'Singleton', m: '인스턴스를 하나만 생성하는 디자인 패턴', c: '전역 상태 관리에 사용' },
    ],
  },
  toeic: {
    '비즈니스 영어': [
      { w: 'agenda',      m: '의제, 회의 안건',            c: 'Please review the agenda before the meeting.' },
      { w: 'deadline',    m: '마감일',                     c: 'The deadline for the project is Friday.' },
      { w: 'invoice',     m: '청구서, 송장',               c: 'Please send the invoice to our accounting department.' },
      { w: 'budget',      m: '예산',                       c: 'We need to stay within the allocated budget.' },
      { w: 'revenue',     m: '수익, 매출',                 c: 'The company revenue grew by 15% this quarter.' },
      { w: 'negotiate',   m: '협상하다',                   c: 'We need to negotiate the terms of the contract.' },
      { w: 'conference',  m: '회의, 컨퍼런스',             c: 'The annual conference will be held in Seoul.' },
      { w: 'collaborate', m: '협력하다, 공동 작업하다',    c: 'Teams will collaborate on the new project.' },
    ],
    'Part 5 — 어법': [
      { w: 'although',   m: '비록 ~이지만 (양보 접속사)',  c: 'Although it was raining, they continued.' },
      { w: 'however',    m: '그러나 (역접 접속 부사)',      c: 'The plan looks good. However, costs are high.' },
      { w: 'therefore',  m: '따라서 (인과 접속 부사)',      c: 'He studied hard; therefore, he passed.' },
      { w: 'whether',    m: '~인지 아닌지 (명사절 접속사)', c: 'I do not know whether she will come.' },
      { w: 'unless',     m: '~하지 않으면 (조건 접속사)',   c: 'Unless you hurry, you will miss the bus.' },
      { w: 'despite',    m: '~에도 불구하고 (전치사)',      c: 'Despite the rain, the event continued.' },
    ],
  }
};

function loadSampleWords() {
  DB.jcs.parts = {};
  DB.toeic.parts = {};
  Object.entries(SAMPLE_WORDS).forEach(([exam, parts]) => {
    Object.entries(parts).forEach(([partKey, items]) => {
      DB[exam].parts[partKey] = { desc: PART_DESC[partKey] || '', items };
    });
  });
}

let isDemoMode = false;

function startDemoMode() {
  isDemoMode = true;
  currentUser = null;
  loadSampleWords();
  document.getElementById('info-name').textContent = '데모 체험중';
  document.getElementById('main-nav').style.display = 'flex';
  // 데모에선 필요 없는 탭 숨김
  const navRank = document.getElementById('nav-rank');
  if (navRank) navRank.style.display = 'none';
  toast('🎮 데모 모드로 시작합니다. 일부 기능은 로그인 후 사용 가능해요.');
  showScreen('s-main-choice', false);
}


function normalizeStudyText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
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
// Supabase 데이터 로드
// ============================================
async function loadWordsFromDB() {
  try {
    const { data, error } = await supabaseClient.from('words').select('*').eq('is_custom', false).order('id');
    if (error || !data || data.length === 0) throw new Error('DB 응답 없음');
    DB.jcs.parts = {}; DB.toeic.parts = {};
    const seen = new Set();
    data.forEach(row => {
      const examKey = row.exam, partKey = normalizeStudyText(row.part);
      const word = normalizeStudyText(row.word);
      const meaning = normalizeStudyText(row.meaning);
      const context = normalizeStudyText(row.context);
      if (!DB[examKey]) return;
      if (!partKey || !word || !meaning) return;
      const dedupeKey = `${examKey}::${partKey}::${word.toLowerCase()}::${meaning.toLowerCase()}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      if (!DB[examKey].parts[partKey]) DB[examKey].parts[partKey] = { desc: PART_DESC[partKey] || '', items: [] };
      DB[examKey].parts[partKey].items.push({ w: word, m: meaning, c: context });
    });
    return true;
  } catch(e) {
    console.warn('[TypeExam] 단어 DB 로딩 실패 → 샘플 데이터 사용:', e.message);
    loadSampleWords();
    if (!isDemoMode) toast('📦 샘플 데이터로 동작 중입니다 (DB 연결 확인 필요)');
    return false;
  }
}

async function loadPastExamsFromDB() {
  try {
    const { data, error } = await supabaseClient.from('past_exams').select('*').order('exam_key', { ascending: true }).order('q_num', { ascending: true });
    if (error || !data || data.length === 0) throw new Error('DB 응답 없음');
    pastExams = {};
    data.forEach(row => {
      const key = row.exam_key;
      if (!pastExams[key]) pastExams[key] = [];
      pastExams[key].push({ qNum: row.q_num, q: row.question, code: row.code_snippet, image_desc: row.image_desc, table: row.table_html, o: row.options, a: row.answer });
    });
    return true;
  } catch(e) {
    console.warn('[TypeExam] 기출문제 DB 로딩 실패:', e.message);
    return false;
  }
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

// ============================================
// 공통 이벤트
// ============================================
document.addEventListener('click', function(e) {
  const target = e.target; if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
  const isClickable = target.tagName === 'BUTTON' || target.closest('button') || target.hasAttribute('onclick') || target.closest('[onclick]') || target.classList.contains('nav-tab') || target.classList.contains('exam-card') || target.classList.contains('part-card');
  if (isClickable) playSound(sfx.button);
});

// ============================================
// 앱 초기화
// ============================================
window.addEventListener('DOMContentLoaded', async () => {
  setTimeout(async () => {
    checkSession();
    await loadWordsFromDB();
    await loadPastExamsFromDB();
  }, 200);
});
