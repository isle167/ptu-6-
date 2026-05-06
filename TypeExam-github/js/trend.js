// ============================================
// 출제 경향 분석
// ============================================

let trendChartPart = null;
let trendChartYear = null;
let trendCurrentExamFilter = 'all';

async function loadTrend() {
  const loading = document.getElementById('trend-loading');
  const content = document.getElementById('trend-content');
  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';

  // pastExams가 비어있으면 DB에서 다시 로드
  if (Object.keys(pastExams).length === 0) {
    await loadPastExamsFromDB();
  }

  if (Object.keys(pastExams).length === 0) {
    if (loading) loading.textContent = '기출문제 데이터가 없어요';
    return;
  }

  renderTrend();
  if (loading) loading.style.display = 'none';
  if (content) content.style.display = 'block';
}

function renderTrend(examFilter = trendCurrentExamFilter) {
  trendCurrentExamFilter = examFilter;

  // 전체 exam_key 목록 추출
  const allKeys = Object.keys(pastExams).sort();

  // 필터 탭 렌더링
  const filterWrap = document.getElementById('trend-filter-tabs');
  if (filterWrap) {
    const groups = ['all', ...new Set(allKeys.map(k => k.split('_')[0]))]; // e.g. 'jcs', 'toeic'
    filterWrap.innerHTML = groups.map(g => {
      const label = g === 'all' ? '전체' : g === 'jcs' ? '정처기' : g === 'toeic' ? '토익' : g;
      const active = g === examFilter;
      return `<button class="${active ? 'btn-indigo' : 'btn-gray'}" onclick="renderTrend('${g}')" style="padding:6px 14px; font-size:12px;">${label}</button>`;
    }).join('');
  }

  // 필터링된 keys
  const filteredKeys = examFilter === 'all' ? allKeys : allKeys.filter(k => k.startsWith(examFilter + '_'));

  // 전체 문제 수
  const totalQ = filteredKeys.reduce((s, k) => s + pastExams[k].length, 0);
  const totalEl = document.getElementById('trend-total-cnt');
  if (totalEl) totalEl.textContent = totalQ + '문제';

  // 파트별 집계 (exam_key의 세 번째 파트 또는 그냥 key 기반)
  // exam_key 예: "jcs_2024_1" → 회차 데이터
  // 파트 정보는 past_exams에 없으므로 exam_key별로 집계
  const keyData = {}; // { examKey: count }
  filteredKeys.forEach(k => { keyData[k] = pastExams[k].length; });

  // 회차별 추이 차트
  renderTrendYearChart(filteredKeys, keyData);

  // 파트(exam별) 도넛 차트
  renderTrendPartChart(filteredKeys, keyData, examFilter);

  // 상세 테이블
  renderTrendTable(filteredKeys, keyData);
}

function renderTrendPartChart(keys, keyData, examFilter) {
  const ctx = document.getElementById('chart-trend-part');
  if (!ctx) return;

  if (trendChartPart) { trendChartPart.destroy(); trendChartPart = null; }

  // 시험 그룹별 합산 또는 키별
  let labels, data, bgColors;

  if (examFilter === 'all') {
    // 시험 종류별 합산
    const grouped = {};
    keys.forEach(k => {
      const grp = k.split('_')[0];
      const gLabel = grp === 'jcs' ? '정처기' : grp === 'toeic' ? '토익' : grp;
      grouped[gLabel] = (grouped[gLabel] || 0) + keyData[k];
    });
    labels = Object.keys(grouped);
    data = Object.values(grouped);
    bgColors = ['#6C63FF', '#F59E0B', '#10B981', '#EF4444', '#3B82F6', '#8B5CF6'];
  } else {
    // 회차별 문제 수 도넛
    labels = keys.map(k => {
      const parts = k.split('_');
      return parts.length >= 3 ? `${parts[1]}년 ${parts[2]}회` : k;
    });
    data = keys.map(k => keyData[k]);
    bgColors = generateColors(keys.length);
  }

  trendChartPart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors.slice(0, data.length),
        borderWidth: 2,
        borderColor: getComputedStyle(document.getElementById('root')).getPropertyValue('--bg').trim() || '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: getComputedStyle(document.getElementById('root')).getPropertyValue('--text').trim() || '#333', font: { size: 12 } }
        }
      }
    }
  });
}

function renderTrendYearChart(keys, keyData) {
  const ctx = document.getElementById('chart-trend-year');
  if (!ctx) return;

  if (trendChartYear) { trendChartYear.destroy(); trendChartYear = null; }

  const labels = keys.map(k => {
    const p = k.split('_');
    if (p.length >= 3) return `${p[0]==='jcs'?'정처기':p[0]==='toeic'?'토익':p[0]} ${p[1]}년 ${p[2]}회`;
    return k;
  });
  const data = keys.map(k => keyData[k]);

  const root = document.getElementById('root');
  const textColor = getComputedStyle(root).getPropertyValue('--text').trim() || '#333';
  const gridColor = getComputedStyle(root).getPropertyValue('--border').trim() || '#e0e0e0';

  trendChartYear = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '문제 수',
        data,
        backgroundColor: 'rgba(108, 99, 255, 0.7)',
        borderColor: '#6C63FF',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { ticks: { color: textColor, font: { size: 10 }, maxRotation: 45 }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }
      }
    }
  });
}

function renderTrendTable(keys, keyData) {
  const container = document.getElementById('trend-part-table');
  if (!container) return;

  const totalQ = keys.reduce((s, k) => s + keyData[k], 0);
  const sorted = [...keys].sort((a, b) => keyData[b] - keyData[a]);

  const rows = sorted.map((k, i) => {
    const p = k.split('_');
    const label = p.length >= 3 ? `${p[0]==='jcs'?'정처기':p[0]==='toeic'?'토익':p[0]} ${p[1]}년 ${p[2]}회` : k;
    const cnt = keyData[k];
    const pct = totalQ > 0 ? ((cnt / totalQ) * 100).toFixed(1) : 0;
    const barW = totalQ > 0 ? (cnt / Math.max(...Object.values(keyData)) * 100).toFixed(1) : 0;
    return `
      <div style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border);">
        <div style="width:20px; text-align:right; font-size:12px; color:var(--muted); font-family:var(--f-mono);">${i+1}</div>
        <div style="flex:1; font-size:14px; font-weight:600;">${label}</div>
        <div style="width:120px;">
          <div style="height:6px; background:var(--border); border-radius:3px; overflow:hidden;">
            <div style="height:100%; width:${barW}%; background:var(--indigo); border-radius:3px; transition:width .4s;"></div>
          </div>
        </div>
        <div style="width:40px; text-align:right; font-size:14px; font-weight:bold; font-family:var(--f-mono); color:var(--indigo);">${cnt}</div>
        <div style="width:46px; text-align:right; font-size:12px; color:var(--muted); font-family:var(--f-mono);">${pct}%</div>
      </div>`;
  }).join('');

  container.innerHTML = rows || '<div style="color:var(--muted); padding:20px; text-align:center;">데이터 없음</div>';
}

function generateColors(n) {
  const base = ['#6C63FF','#F59E0B','#10B981','#EF4444','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316','#84CC16'];
  const result = [];
  for (let i = 0; i < n; i++) result.push(base[i % base.length]);
  return result;
}
