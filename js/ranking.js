// ============================================
// 랭킹전 시스템 — 티어 · 승패 · 연승보너스 · LP
// ============================================

const RANKING_KEY    = 'te_ranking_battle_v1';
const TIER_STATE_KEY = 'te_tier_state_v1';

// ── 티어 정의 ──────────────────────────────
const TIERS = [
  { name: 'BRONZE',   label: '브론즈',   emoji: '🥉', min: 0,    max: 999,  color: '#cd7f32', bg: 'rgba(205,127,50,0.12)',  winThreshold: 1200 },
  { name: 'SILVER',   label: '실버',     emoji: '🥈', min: 1000, max: 1999, color: '#a8a9ad', bg: 'rgba(168,169,173,0.12)', winThreshold: 1800 },
  { name: 'GOLD',     label: '골드',     emoji: '🥇', min: 2000, max: 3499, color: '#ffd700', bg: 'rgba(255,215,0,0.12)',   winThreshold: 2400 },
  { name: 'PLATINUM', label: '플래티넘', emoji: '💎', min: 3500, max: 4999, color: '#00c9ff', bg: 'rgba(0,201,255,0.12)',   winThreshold: 3000 },
  { name: 'DIAMOND',  label: '다이아',   emoji: '💠', min: 5000, max: 6999, color: '#6ec6f5', bg: 'rgba(110,198,245,0.14)', winThreshold: 3600 },
  { name: 'MASTER',   label: '마스터',   emoji: '👑', min: 7000, max: Infinity, color: '#a855f7', bg: 'rgba(168,85,247,0.13)', winThreshold: 4200 },
];

// ── 연승 보너스 배율 ────────────────────────
const STREAK_BONUS = { 1: 1.0, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.4 };

// ── 티어 상태 로드/저장 ──────────────────────
function getTierState() {
  try {
    const s = JSON.parse(localStorage.getItem(TIER_STATE_KEY) || '{}');
    return {
      lp:      typeof s.lp      === 'number' ? s.lp      : 0,
      streak:  typeof s.streak  === 'number' ? s.streak  : 0,
    };
  } catch(e) { return { lp: 0, streak: 0 }; }
}

function saveTierState(state) {
  localStorage.setItem(TIER_STATE_KEY, JSON.stringify(state));
}

// ── 현재 티어 계산 ──────────────────────────
function getTierByLP(lp) {
  return TIERS.find(t => lp >= t.min && lp <= t.max) || TIERS[0];
}

// ── 게임 점수 → 승패 판정 ────────────────────
// 최종 점수 = 남은 시간 점수 + (WPM × 2) + 정확도 + (베스트 콤보 × 5)
function calcFinalScore(wpm, accuracy, rankingScore, bestCombo) {
  return Math.round((rankingScore || 0) + ((wpm || 0) * 2) + (accuracy || 0) + ((bestCombo || 0) * 5));
}

function judgeWin(finalScore, lp) {
  const tier = getTierByLP(lp);
  return finalScore >= tier.winThreshold;
}

// ── LP 증감 계산 ──────────────────────────────
function calcLPChange(isWin, streak) {
  if (isWin) {
    const base = Math.floor(Math.random() * 16) + 15; // 15~30
    const mult = STREAK_BONUS[Math.min(streak, 5)] || 1.0;
    return Math.round(base * mult);
  } else {
    return -(Math.floor(Math.random() * 11) + 5); // -5~-15
  }
}

// ── 랭킹전 결과 처리 (endGame에서 호출) ────────
function processTierResult({ wpm, accuracy, rankingScore, bestCombo }) {
  const state = getTierState();
  const finalScore = calcFinalScore(wpm, accuracy, rankingScore, bestCombo);
  const isWin = judgeWin(finalScore, state.lp);

  const newStreak  = isWin ? Math.min((state.streak || 0) + 1, 5) : 0;
  const lpChange   = calcLPChange(isWin, isWin ? newStreak : 0);
  const prevLP     = state.lp;
  const newLP      = Math.max(0, prevLP + lpChange);
  const prevTier   = getTierByLP(prevLP);
  const newTier    = getTierByLP(newLP);
  const promoted   = newTier.min > prevTier.min;
  const demoted    = newTier.min < prevTier.min;
  const bonusMult  = isWin ? (STREAK_BONUS[Math.min(newStreak, 5)] || 1.0) : 1.0;

  saveTierState({ lp: newLP, streak: newStreak });

  return {
    isWin, finalScore,
    prevLP, newLP, lpChange,
    prevTier, newTier,
    promoted, demoted,
    streak: newStreak,
    bonusMult,
    threshold: getTierByLP(prevLP).winThreshold,
  };
}

// ── calculateRankScore (game.js 에서 사용) ────
function calculateRankScore(words, remain, combo) {
  return Math.max(0, (remain || 0) * 10 + (combo || 0) * 5);
}

// ── 기록 저장 ────────────────────────────────
function getRankingRecords() {
  try { return JSON.parse(localStorage.getItem(RANKING_KEY) || '[]'); }
  catch(e) { return []; }
}

function setRankingRecords(records) {
  localStorage.setItem(RANKING_KEY, JSON.stringify(records.slice(0, 100)));
}

function getRankUserName() {
  const infoName = document.getElementById('info-name')?.textContent?.trim();
  if (infoName && infoName !== 'ptu') return infoName;
  return currentUser?.email?.split('@')[0] || 'Guest';
}

function saveRankingRecord(record) {
  const records = getRankingRecords();
  const state = getTierState();
  const saved = {
    id: Date.now() + '-' + Math.random().toString(16).slice(2),
    user: getRankUserName(),
    exam: record.exam || 'custom',
    part: record.part || '—',
    score: record.score || 0,
    timeScore: record.timeScore || 0,
    wpm: record.wpm || 0,
    accuracy: record.accuracy || 0,
    totalWords: record.totalWords || 0,
    totalErrors: record.totalErrors || 0,
    bestCombo: record.bestCombo || 0,
    timeLimit: record.timeLimit || 0,
    remainingTime: record.remainingTime || 0,
    mixMode: record.mixMode || 'en',
    lp: state.lp,
    tier: getTierByLP(state.lp).name,
    playedAt: new Date().toISOString(),
  };
  records.push(saved);
  records.sort((a, b) => (b.score || 0) - (a.score || 0));
  setRankingRecords(records);
  return saved;
}

// ── 결과 화면에 티어 패널 삽입 ────────────────
function renderTierResultPanel(result) {
  const existing = document.getElementById('tier-result-panel');
  if (existing) existing.remove();

  const { isWin, finalScore, prevLP, newLP, lpChange, prevTier, newTier,
          promoted, demoted, streak, bonusMult, threshold } = result;

  const panel = document.createElement('div');
  panel.id = 'tier-result-panel';
  panel.className = 'tier-result-panel ' + (isWin ? 'tier-win' : 'tier-lose');

  // 연승 보너스 뱃지 텍스트
  const streakBadge = (isWin && streak >= 2)
    ? `<span class="tier-streak-badge">🔥 ${streak}연승 +${Math.round((bonusMult - 1) * 100)}%</span>`
    : '';

  // 티어 변동 화살표
  let tierChangeHTML = '';
  if (promoted) tierChangeHTML = `<div class="tier-change-msg tier-promote">⬆ 티어 승급! ${prevTier.emoji} ${prevTier.label} → ${newTier.emoji} ${newTier.label}</div>`;
  else if (demoted) tierChangeHTML = `<div class="tier-change-msg tier-demote">⬇ 티어 강등 ${prevTier.emoji} ${prevTier.label} → ${newTier.emoji} ${newTier.label}</div>`;

  // LP 진행 바 계산
  const tier = newTier;
  const tierRange = (tier.max === Infinity ? tier.min + 3000 : tier.max) - tier.min;
  const lpInTier  = Math.max(0, newLP - tier.min);
  const fillPct   = Math.min(100, Math.round(lpInTier / tierRange * 100));

  panel.innerHTML = `
    <div class="tier-verdict ${isWin ? 'verdict-win' : 'verdict-lose'}">
      ${isWin ? '🏆 승리' : '💀 패배'}
      ${streakBadge}
    </div>
    <div class="tier-score-row">
      <span class="tier-score-label">최종 점수</span>
      <span class="tier-score-val">${finalScore}<span class="tier-score-threshold"> / 기준 ${threshold}</span></span>
    </div>
    <div class="tier-lp-row">
      <span class="tier-lp-icon">${newTier.emoji}</span>
      <span class="tier-lp-name">${newTier.label}</span>
      <span class="tier-lp-val">${newLP} LP</span>
      <span class="tier-lp-delta ${isWin ? 'lp-plus' : 'lp-minus'}">${lpChange > 0 ? '+' : ''}${lpChange}</span>
    </div>
    <div class="tier-bar-wrap">
      <div class="tier-bar-fill" style="width:${fillPct}%; background:${newTier.color};"></div>
    </div>
    <div class="tier-bar-labels">
      <span>${newTier.label} ${newLP - tier.min} LP</span>
      <span>${tier.max === Infinity ? '∞' : tier.max - tier.min} LP</span>
    </div>
    ${tierChangeHTML}
  `;

  // 결과 화면 버튼 행 앞에 삽입
  const btnRow = document.querySelector('#s-result .btn-row');
  if (btnRow) btnRow.parentNode.insertBefore(panel, btnRow);
}

// ── 랭킹 화면에 내 티어 카드 렌더 ─────────────
function renderMyTierCard() {
  const state = getTierState();
  const tier  = getTierByLP(state.lp);
  const card  = document.getElementById('my-tier-card');
  if (!card) return;

  const tierRange = (tier.max === Infinity ? tier.min + 3000 : tier.max) - tier.min;
  const lpInTier  = Math.max(0, state.lp - tier.min);
  const fillPct   = Math.min(100, Math.round(lpInTier / tierRange * 100));

  const nextTier = TIERS[TIERS.indexOf(tier) + 1];
  const lpToNext = nextTier ? (nextTier.min - state.lp) : 0;

  card.innerHTML = `
    <div class="my-tier-header">
      <span class="my-tier-emoji">${tier.emoji}</span>
      <div>
        <div class="my-tier-name">${tier.label}</div>
        <div class="my-tier-lp">${state.lp} LP ${nextTier ? `· 다음 티어까지 ${lpToNext} LP` : '· 최고 티어'}</div>
      </div>
      <div class="my-tier-streak">${state.streak >= 1 ? `🔥 ${state.streak}연승` : ''}</div>
    </div>
    <div class="tier-bar-wrap">
      <div class="tier-bar-fill" style="width:${fillPct}%; background:${tier.color};"></div>
    </div>
    <div class="tier-bar-labels">
      <span>${tier.label} ${lpInTier} LP</span>
      <span>${tier.max === Infinity ? '∞' : tierRange} LP</span>
    </div>
  `;
}

// ── 기존 랭킹 목록 렌더 ──────────────────────
function examLabel(key) {
  if (key === 'jcs')    return '정처기';
  if (key === 'toeic')  return '토익';
  if (key === 'custom') return '커스텀';
  return key || '기타';
}

let currentRankingFilter = 'all';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function parseRankingFilter(filter) {
  if (!filter || filter === 'all') return { exam: 'all', part: null };
  const split = String(filter).split('::');
  return { exam: split[0], part: split[1] || null };
}

function getRankingCategory(filter) {
  return parseRankingFilter(filter).exam === 'all' ? 'all' : parseRankingFilter(filter).exam;
}

const RANKING_PART_ORDER = {
  jcs:   ['전체파트','데이터베이스','알고리즘','네트워크','보안','소프트웨어공학'],
  toeic: ['전체파트','비즈니스 영어','Part 5 — 어법','Part 5 — 어휘','Part 6 — 문맥','Part 7 — 독해'],
};

function getRankingParts(examKey) {
  const records = getRankingRecords();
  const fromDB  = (DB && DB[examKey] && DB[examKey].parts) ? Object.keys(DB[examKey].parts) : [];
  const fromRec = records.filter(r => r.exam === examKey).map(r => r.part).filter(Boolean);
  const base    = [...new Set(['전체파트', ...fromDB, ...fromRec])];
  const order   = RANKING_PART_ORDER[examKey] || [];
  return base.sort((a,b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    return a.localeCompare(b,'ko');
  });
}

function setRankingFilterButtonStyle(btn, active, type='normal') {
  btn.className = active ? 'btn-indigo' : 'btn-gray';
  if (type === 'main') btn.style.fontWeight = '800';
}

function renderRankingFilters(activeFilter='all') {
  currentRankingFilter = activeFilter;
  const wrap = document.getElementById('ranking-filter-wrap');
  if (!wrap) return;
  const activeCategory = getRankingCategory(activeFilter);

  const makeBtn = (label, filter, type='normal') => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    setRankingFilterButtonStyle(btn, filter === activeFilter, type);
    btn.onclick = () => renderRanking(filter);
    return btn;
  };

  wrap.innerHTML = '';
  const mainRow = document.createElement('div');
  mainRow.style.cssText = 'display:flex; gap:10px; flex-wrap:wrap; width:100%; margin-bottom:4px;';
  mainRow.appendChild(makeBtn('전체', 'all', 'main'));
  mainRow.appendChild(makeBtn('정처기', 'jcs', 'main'));
  mainRow.appendChild(makeBtn('토익', 'toeic', 'main'));
  wrap.appendChild(mainRow);

  if (activeCategory !== 'all') {
    const subRow = document.createElement('div');
    subRow.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; width:100%; padding:10px; background:var(--bg2); border:1.5px solid var(--border); border-radius:12px;';
    subRow.appendChild(makeBtn(examLabel(activeCategory), activeCategory, 'main'));
    getRankingParts(activeCategory).forEach(part =>
      subRow.appendChild(makeBtn(part, activeCategory + '::' + part, part === '전체파트' ? 'main' : 'normal')));
    wrap.appendChild(subRow);
  }

  const clearRow = document.createElement('div');
  clearRow.style.cssText = 'display:flex; justify-content:flex-end; width:100%; margin-top:2px;';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn-gray';
  clearBtn.textContent = '랭킹 초기화';
  clearBtn.onclick = clearRanking;
  clearRow.appendChild(clearBtn);
  wrap.appendChild(clearRow);
}

function renderRanking(filter='all') {
  const list  = document.getElementById('ranking-list');
  const empty = document.getElementById('ranking-empty');
  const cnt   = document.getElementById('ranking-cnt');
  const title = document.getElementById('ranking-current-title');
  if (!list) return;

  renderMyTierCard();
  renderRankingFilters(filter);

  const parsed = parseRankingFilter(filter);
  let records  = getRankingRecords();

  if (parsed.exam === 'all') records = records.filter(r => r.exam === 'jcs' || r.exam === 'toeic');
  else records = records.filter(r => r.exam === parsed.exam);
  if (parsed.part) records = records.filter(r => r.part === parsed.part);
  records = records.sort((a,b) => (b.score||0) - (a.score||0)).slice(0, 30);

  cnt.textContent = records.length + '개';
  if (title) {
    title.textContent = parsed.exam === 'all'
      ? '전체 랭킹 · 정처기 + 토익 모든 기록'
      : (parsed.part ? `${examLabel(parsed.exam)} · ${parsed.part} 랭킹` : `${examLabel(parsed.exam)} 랭킹 · 모든 파트 기록 합산`);
  }

  list.innerHTML = '';
  empty.style.display = records.length ? 'none' : 'block';

  records.forEach((r, i) => {
    const date   = new Date(r.playedAt);
    const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
    const recTier = r.tier ? TIERS.find(t => t.name === r.tier) : null;
    const tierBadge = recTier
      ? `<span style="font-size:11px; background:${recTier.bg}; color:${recTier.color}; border:1px solid ${recTier.color}; border-radius:6px; padding:1px 7px; font-weight:700; margin-left:4px;">${recTier.emoji} ${recTier.label}</span>`
      : '';
    const item = document.createElement('div');
    item.style.cssText = 'display:grid; grid-template-columns:70px 1fr auto; gap:14px; align-items:center; padding:16px; background:var(--card); border:1.5px solid var(--border); border-radius:12px;';
    item.innerHTML = `
      <div style="font-size:24px; font-weight:bold; color:var(--amber); text-align:center;">${medal}</div>
      <div>
        <div style="font-size:15px; font-weight:700; color:var(--text); margin-bottom:4px;">${escapeHtml(r.user)}${tierBadge} · ${examLabel(r.exam)} / ${escapeHtml(r.part)}</div>
        <div style="font-size:12px; color:var(--muted);">${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')} · ${r.timeLimit}초 · ${r.mixMode?.toUpperCase?.() || 'EN'}</div>
      </div>
      <div style="text-align:right; font-family:var(--f-mono);">
        <div style="font-size:24px; font-weight:800; color:var(--indigo);">${r.score}</div>
        <div style="font-size:12px; color:var(--muted);">${r.wpm} WPM · ${r.accuracy}% · 🔥${r.bestCombo}</div>
      </div>`;
    list.appendChild(item);
  });
}

function clearRanking() {
  if (!confirm('로컬에 저장된 랭킹 기록을 모두 삭제할까요?')) return;
  localStorage.removeItem(RANKING_KEY);
  renderRanking('all');
  toast('랭킹을 초기화했어요');
}
