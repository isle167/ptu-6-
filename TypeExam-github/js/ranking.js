// ============================================
// 로컬 랭킹전 랭킹
// ============================================

const RANKING_KEY = 'te_ranking_battle_v1';

function calculateRankScore(words, remain, combo){
  return Math.max(0, (words || 0) * 100 + (remain || 0) * 10 + (combo || 0) * 5);
}

function getRankingRecords(){
  try { return JSON.parse(localStorage.getItem(RANKING_KEY) || '[]'); }
  catch(e){ return []; }
}

function setRankingRecords(records){
  localStorage.setItem(RANKING_KEY, JSON.stringify(records.slice(0, 100)));
}

function getRankUserName(){
  const infoName = document.getElementById('info-name')?.textContent?.trim();
  if(infoName && infoName !== 'ptu') return infoName;
  return currentUser?.email?.split('@')[0] || 'Guest';
}

function saveRankingRecord(record){
  const records = getRankingRecords();
  const saved = {
    id: Date.now() + '-' + Math.random().toString(16).slice(2),
    user: getRankUserName(),
    exam: record.exam || 'custom',
    part: record.part || '—',
    score: record.score || 0,
    wpm: record.wpm || 0,
    accuracy: record.accuracy || 0,
    totalWords: record.totalWords || 0,
    totalErrors: record.totalErrors || 0,
    bestCombo: record.bestCombo || 0,
    timeLimit: record.timeLimit || 0,
    remainingTime: record.remainingTime || 0,
    mixMode: record.mixMode || 'en',
    playedAt: new Date().toISOString()
  };
  records.push(saved);
  records.sort((a,b)=> (b.score || 0) - (a.score || 0));
  setRankingRecords(records);
  return saved;
}

function examLabel(key){
  if(key === 'jcs') return '정처기';
  if(key === 'toeic') return '토익';
  if(key === 'custom') return '커스텀';
  return key || '기타';
}

let currentRankingFilter = 'all';

function escapeHtml(value){
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function parseRankingFilter(filter){
  if(!filter || filter === 'all') return { exam:'all', part:null };
  const split = String(filter).split('::');
  return { exam: split[0], part: split[1] || null };
}

function getRankingCategory(filter){
  const parsed = parseRankingFilter(filter);
  return parsed.exam === 'all' ? 'all' : parsed.exam;
}

function getRankingParts(examKey){
  const records = getRankingRecords();
  const fromDB = (DB && DB[examKey] && DB[examKey].parts) ? Object.keys(DB[examKey].parts) : [];
  const fromRecords = records.filter(r => r.exam === examKey).map(r => r.part).filter(Boolean);
  return [...new Set([...fromDB, ...fromRecords])].sort((a,b)=>a.localeCompare(b,'ko'));
}

function setRankingFilterButtonStyle(btn, active, type='normal'){
  btn.className = active ? 'btn-indigo' : 'btn-gray';
  if(type === 'main') btn.style.fontWeight = '800';
}

function renderRankingFilters(activeFilter='all'){
  currentRankingFilter = activeFilter;
  const wrap = document.getElementById('ranking-filter-wrap');
  if(!wrap) return;
  const parsed = parseRankingFilter(activeFilter);
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

  if(activeCategory !== 'all'){
    const subRow = document.createElement('div');
    subRow.style.cssText = 'display:flex; gap:8px; flex-wrap:wrap; width:100%; padding:10px; background:var(--bg2); border:1.5px solid var(--border); border-radius:12px;';
    subRow.appendChild(makeBtn(examLabel(activeCategory) + ' 전체', activeCategory));

    const parts = getRankingParts(activeCategory);
    parts.forEach(part => subRow.appendChild(makeBtn(part, activeCategory + '::' + part)));
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

function renderRanking(filter='all'){
  const list = document.getElementById('ranking-list');
  const empty = document.getElementById('ranking-empty');
  const cnt = document.getElementById('ranking-cnt');
  const title = document.getElementById('ranking-current-title');
  if(!list) return;

  renderRankingFilters(filter);

  const parsed = parseRankingFilter(filter);
  let records = getRankingRecords();

  // 전체는 정처기 + 토익 모든 파트 기록만 보여줌
  if(parsed.exam === 'all') records = records.filter(r => r.exam === 'jcs' || r.exam === 'toeic');
  else records = records.filter(r => r.exam === parsed.exam);

  if(parsed.part) records = records.filter(r => r.part === parsed.part);

  records = records.sort((a,b)=> (b.score || 0) - (a.score || 0)).slice(0, 30);
  cnt.textContent = records.length + '개';
  if(title){
    title.textContent = parsed.exam === 'all'
      ? '전체 랭킹 · 정처기 + 토익 모든 파트'
      : (parsed.part ? `${examLabel(parsed.exam)} · ${parsed.part}` : `${examLabel(parsed.exam)} 전체 랭킹`);
  }
  list.innerHTML = '';
  empty.style.display = records.length ? 'none' : 'block';

  records.forEach((r, i)=>{
    const date = new Date(r.playedAt);
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
    const item = document.createElement('div');
    item.style.cssText = 'display:grid; grid-template-columns:70px 1fr auto; gap:14px; align-items:center; padding:16px; background:var(--card); border:1.5px solid var(--border); border-radius:12px;';
    item.innerHTML = `
      <div style="font-size:24px; font-weight:bold; color:var(--amber); text-align:center;">${medal}</div>
      <div>
        <div style="font-size:15px; font-weight:700; color:var(--text); margin-bottom:4px;">${escapeHtml(r.user)} · ${examLabel(r.exam)} / ${escapeHtml(r.part)}</div>
        <div style="font-size:12px; color:var(--muted);">${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')} · ${r.timeLimit}초 · ${r.mixMode?.toUpperCase?.() || 'EN'}</div>
      </div>
      <div style="text-align:right; font-family:var(--f-mono);">
        <div style="font-size:24px; font-weight:800; color:var(--indigo);">${r.score}</div>
        <div style="font-size:12px; color:var(--muted);">${r.wpm} WPM · ${r.accuracy}% · 🔥${r.bestCombo}</div>
      </div>`;
    list.appendChild(item);
  });
}

function clearRanking(){
  if(!confirm('로컬에 저장된 랭킹 기록을 모두 삭제할까요?')) return;
  localStorage.removeItem(RANKING_KEY);
  renderRanking('all');
  toast('랭킹을 초기화했어요');
}
