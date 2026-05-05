// ============================================
// 통계 페이지 (Supabase + Chart.js)
// ============================================

let chartTrend = null, chartParts = null, chartExams = null;

async function loadStats() {
  if (!currentUser) { toast('로그인이 필요해요'); return; }
  document.getElementById('stats-loading').style.display = 'block'; 
  document.getElementById('stats-empty').style.display = 'none'; 
  document.getElementById('stats-content').style.display = 'none';

  const { data: records, error } = await supabaseClient
    .from('game_records')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('played_at', { ascending: false });

  document.getElementById('stats-loading').style.display = 'none';

  if (!records || records.length === 0) { 
    document.getElementById('stats-empty').style.display = 'block'; 
    document.getElementById('stats-total-games').textContent = '0판'; 
    return; 
  }

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

  const partGroup = {}; 
  records.forEach(r => { const key = r.part || '기타'; if (!partGroup[key]) partGroup[key] = []; partGroup[key].push(r.wpm || 0); });
  drawPartsChart(Object.keys(partGroup), Object.keys(partGroup).map(k => Math.round(partGroup[k].reduce((s, v) => s + v, 0) / partGroup[k].length)));

  const examGroup = {}; 
  records.forEach(r => { const key = r.exam === 'jcs' ? '정처기' : r.exam === 'toeic' ? '토익' : r.exam === 'custom' ? '커스텀' : (r.exam || '기타'); examGroup[key] = (examGroup[key] || 0) + 1; });
  drawExamsChart(Object.keys(examGroup), Object.values(examGroup));

  const recentList = document.getElementById('recent-records-list'); 
  recentList.innerHTML = '';
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
