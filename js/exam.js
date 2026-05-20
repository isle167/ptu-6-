// ============================================
// 기출문제 OMR 및 유사문제 생성
// ============================================

let currentExamKey = null;
let examWrongNote = [], currentExamWrongItems = [];

// 기출 오답노트 로컬스토리지 (추후 Supabase 이전 예정)
try{ examWrongNote = JSON.parse(localStorage.getItem('te_exam_wrong') || '[]'); }catch(e){}
function saveExamWrongLocal() {
  try { localStorage.setItem('te_exam_wrong', JSON.stringify(examWrongNote)); } catch(e) {}
}

function startExam(title, imagePath, audioPath, qCount, type, examDataKey = null) {
  if (typeof playSound === 'function') playSound(sfx.button);
  currentExamKey = examDataKey;
  
  document.getElementById('exam-list-view').style.display = 'none';
  document.getElementById('exam-solve-view').style.display = 'flex';
  document.getElementById('past-exam-title').textContent = title;
  
  const audioCont = document.getElementById('exam-audio-container'), audioEl = document.getElementById('exam-audio');
  if (audioPath) { audioCont.style.display = 'block'; audioEl.src = audioPath; } else { audioCont.style.display = 'none'; audioEl.pause(); }

  if (examDataKey && pastExams[examDataKey]) {
    document.getElementById('exam-image-placeholder').style.display = 'none';
    document.getElementById('exam-image-view').style.display = 'none';
    const txtView = document.getElementById('exam-text-view');
    txtView.style.display = 'block';
    
    let textHtml = '';
    pastExams[examDataKey].forEach((item) => {
      textHtml += `<div style="margin-bottom:30px; padding-bottom:20px; border-bottom:1.5px dashed var(--border);">`;
      textHtml += `  <div style="font-weight:700; margin-bottom:12px; color:var(--text); font-size:16px;">${item.qNum}. ${item.q}</div>`;
      if (item.image_desc) {
        textHtml += `<div class="exam-image-desc" style="background:var(--bg2); padding:10px; border-radius:8px; margin-bottom:12px; font-size:14px; text-align:center;">${item.image_desc}</div>`;
      }
      if (item.code) {
        textHtml += `<pre style="background:#1e1e1e; color:#d4d4d4; padding:15px; border-radius:8px; overflow-x:auto; margin-bottom:12px; font-family:var(--f-mono); font-size:14px;"><code>${item.code}</code></pre>`;
      }
      if (item.table) {
        textHtml += `<div class="exam-table-wrap" style="margin-bottom:12px; overflow-x:auto;">${marked.parse(item.table)}</div>`;
      }
      item.o.forEach((opt, idx) => { textHtml += `  <div style="margin-bottom:8px; color:var(--muted); padding-left:20px;">${idx+1}) ${opt}</div>`; });
      textHtml += `</div>`;
    });
    txtView.innerHTML = textHtml;
    qCount = pastExams[examDataKey].length;
  } else {
    document.getElementById('exam-image-placeholder').style.display = 'none';
    document.getElementById('exam-text-view').style.display = 'none';
    const imgView = document.getElementById('exam-image-view');
    imgView.style.display = 'block'; imgView.src = imagePath || '';
  }

  const omr = document.getElementById('omr-card'); let omrHtml = '';
  const options = type === 'toeic' ? ['A', 'B', 'C', 'D'] : ['1', '2', '3', '4'];
  for(let i = 1; i <= qCount; i++) {
    let optsHtml = options.map(opt => `<input type="radio" name="q${i}" id="q${i}_${opt}" value="${opt}" class="omr-radio"><label for="q${i}_${opt}" class="omr-label">${opt}</label>`).join('');
    omrHtml += `<div class="omr-row"><div class="omr-num" style="width:50px;">${i}.</div><div class="omr-options">${optsHtml}</div></div>`;
  }
  omr.innerHTML = omrHtml;
}

function backToExamList() {
  if (typeof playSound === 'function') playSound(sfx.button);
  document.getElementById('exam-audio').pause();
  document.getElementById('exam-solve-view').style.display = 'none';
  document.getElementById('exam-list-view').style.display = 'block';
  document.getElementById('past-exam-title').textContent = '기출문제 풀이';
  document.getElementById('exam-image-placeholder').style.display = 'block';
  document.getElementById('exam-image-view').style.display = 'none';
  document.getElementById('exam-text-view').style.display = 'none';
  currentExamKey = null;
  document.querySelectorAll('.omr-radio').forEach(r => r.checked = false);
}

function gradeExam() {
  if (typeof playSound === 'function') playSound(sfx.button);
  if (!currentExamKey || !pastExams[currentExamKey]) { toast('이 시험은 아직 자동 채점 데이터가 없습니다.'); return; }
  if (!confirm('정말로 답안을 제출하고 채점하시겠습니까?')) return;

  const examData = pastExams[currentExamKey]; let correctCount = 0;
  let resultItems = []; currentExamWrongItems = [];

  for (let i = 1; i <= examData.length; i++) {
    const correctAns = examData[i-1].a.toString();
    const checkedRadio = document.querySelector(`input[name="q${i}"]:checked`);
    const userAns = checkedRadio ? checkedRadio.value : '미입력';
    const isCorrect = (userAns === correctAns);

    if (isCorrect) correctCount++;
    else {
      currentExamWrongItems.push({ examKey: currentExamKey, examTitle: document.getElementById('past-exam-title').textContent, qNum: i, question: examData[i-1].q, options: examData[i-1].o, correctAns: correctAns, userAns: userAns });
    }
    resultItems.push({ qNum: i, userAns: userAns, correctAns: correctAns, isCorrect: isCorrect });
  }

  const finalScore = Math.round((correctCount / examData.length) * 100);
  const isPass = finalScore >= 60;

  document.getElementById('exam-res-sub').textContent = document.getElementById('past-exam-title').textContent;
  document.getElementById('exam-score').textContent = finalScore + '점';
  
  const passEl = document.getElementById('exam-pass');
  passEl.textContent = isPass ? '합격' : '불합격'; passEl.style.color = isPass ? 'var(--success)' : 'var(--error)';
  document.getElementById('exam-res-icon').textContent = isPass ? '🎉' : '🥲';

  const rwList = document.getElementById('exam-rw-list'); rwList.innerHTML = '';
  resultItems.forEach(w => {
    const numColor = w.isCorrect ? 'var(--success)' : 'var(--error)', ansColor = w.isCorrect ? 'var(--success)' : 'var(--error)';
    const d = document.createElement('div'); d.className = 'rw-item';
    d.innerHTML = `<span class="rw-word" style="min-width:60px; color:${numColor};">${w.qNum}번</span><span class="rw-mean">내 답안: <b style="color:${ansColor}">${w.userAns}</b> / 정답: <b style="color:var(--success)">${w.correctAns}</b></span>`;
    rwList.appendChild(d);
  });
  showScreen('s-exam-result');
}

function saveExamWrong() {
  if (typeof playSound === 'function') playSound(sfx.button);
  if (currentExamWrongItems.length === 0) { toast('저장할 오답이 없습니다. (100점!)'); return; }
  let added = 0;
  currentExamWrongItems.forEach(item => {
    const exists = examWrongNote.find(n => n.examKey === item.examKey && n.qNum === item.qNum);
    if (!exists) { examWrongNote.push(item); added++; }
  });
  saveExamWrongLocal();
  toast(`기출 오답노트에 ${added}문제 저장 완료!`); currentExamWrongItems = [];
}

function renderExamWrong() { showExamWrongParts(); }

function showExamWrongParts() {
  const cnt = examWrongNote.length; 
  document.getElementById('exam-wrong-cnt').textContent = '총 ' + cnt + '문제';
  const partView = document.getElementById('exam-wrong-part-view'), wordView = document.getElementById('exam-wrong-word-view'), partGrid = document.getElementById('exam-wrong-part-grid');
  if(partView) partView.style.display = 'block'; if(wordView) wordView.style.display = 'none';
  if (cnt === 0) { 
    partGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; padding-top:40px;"><div class="empty-icon">📋</div><div class="empty-text">아직 저장된 기출 오답이 없어요</div></div>`; 
    return; 
  }
  const groups = {}; examWrongNote.forEach(item => { const label = item.examTitle || '기타'; if(!groups[label]) groups[label] = []; groups[label].push(item); });
  partGrid.className = 'part-grid wrong-group-grid';
  partGrid.innerHTML = Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'ko'))
    .map(([label, items]) => {
    const isJcs = label.includes('정처기') || label.includes('필기') || label.includes('기출');
    const color = isJcs ? 'var(--indigo)' : 'var(--amber)', bgColor = isJcs ? 'var(--indigo-t)' : 'var(--amber-t)';
    return `<div class="part-card wrong-group-card" style="border-color:${color}; background:${bgColor}" onclick="showExamWrongWords('${label}')"><div class="part-card-cnt" style="background:white; color:${color}">${items.length}문제</div><div class="part-name" style="color:${color}; font-weight:800; font-size:16px;">${label}</div><div class="part-desc">저장된 기출 오답을 문항 순서대로 확인</div><div class="wrong-card-meta"><span>기출</span><span>${items.length}문제</span></div></div>`;
  }).join('');
}

function showExamWrongWords(label) {
  if (typeof playSound === 'function') playSound(sfx.button);
  const filteredNotes = examWrongNote.filter(n => (n.examTitle || '기타') === label);
  document.getElementById('exam-wrong-cnt').textContent = '';
  document.getElementById('exam-wrong-sub-title').textContent = label;
  document.getElementById('exam-wrong-part-view').style.display = 'none';
  document.getElementById('exam-wrong-word-view').style.display = 'flex';
  
  const list = document.getElementById('exam-wrong-list');
  let listHtml = filteredNotes.map((item, index) => {
    const originalIndex = examWrongNote.findIndex(n => n.examKey === item.examKey && n.qNum === item.qNum);
    let optsHtml = '';
    if(item.options && item.options.length > 0) {
      optsHtml = item.options.map((opt, i) => {
        let isCorrect = (i + 1).toString() === item.correctAns, isUserAns = (i + 1).toString() === item.userAns;
        let color = isCorrect ? 'var(--success)' : (isUserAns ? 'var(--error)' : 'inherit'), weight = (isCorrect || isUserAns) ? 'bold' : 'normal';
        return `<div style="color:${color}; font-weight:${weight}; margin-bottom:6px; font-size:14px;">${i+1}) ${opt} <span style="color:var(--success);">${isCorrect ? ' ✅ (정답)' : ''}</span><span style="color:var(--error);">${isUserAns ? ' ❌ (내 답안)' : ''}</span></div>`;
      }).join('');
    } else {
      optsHtml = `<div style="color:var(--muted); font-size:14px;">정답: <b style="color:var(--success)">${item.correctAns}</b> / 내 답안: <b style="color:var(--error)">${item.userAns}</b></div>`;
    }
    return `
      <div class="note-item" style="flex-direction:column; align-items:stretch; gap:12px; margin-bottom:15px; padding:20px; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <div class="sim-check-wrap" style="display:none; margin-top:2px;">
              <input type="checkbox" class="sim-check" value="${index}" style="width:18px; height:18px; cursor:pointer;">
            </div>
            <div>
              <span style="font-size:12px; color:var(--indigo); font-weight:bold; margin-bottom:8px; display:inline-block;">[${item.examTitle}] - ${item.qNum}번</span>
              <div style="font-weight:600; font-size:16px; margin-bottom:4px;">${item.question || '이미지 문제'}</div>
            </div>
          </div>
          <button class="note-del" onclick="delExamWrong(${originalIndex}, '${label}')" style="font-size:18px;">✕</button>
        </div>
        <div style="background:var(--bg2); padding:16px; border-radius:8px; margin-top:8px;">${optsHtml}</div>
      </div>`;
  }).join('');

  const resultAreaHtml = `<div id="sim-result-area" style="margin-top:20px; margin-bottom:120px; display:flex; flex-direction:column; gap:15px;"></div>`;
  const fixedBottomUI = `
    <div style="position:fixed; bottom:20px; left:50%; transform:translateX(-50%); width:calc(100% - 40px); max-width:600px; z-index:100; pointer-events:none; display:flex; flex-direction:column; justify-content:flex-end;">
      <div id="sim-floating-btn" style="text-align:center; pointer-events:auto;">
        <button onclick="toggleSimMode(true)" style="padding:14px 28px; background:var(--indigo); color:white; border-radius:30px; font-weight:bold; font-size:15px; box-shadow:0 4px 15px rgba(0,0,0,0.2); border:none; cursor:pointer;">
          💡 유사문제 생성 모드
        </button>
      </div>
      <div id="sim-control-panel" style="display:none; background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:16px; box-shadow:0 4px 20px rgba(0,0,0,0.15); pointer-events:auto; margin-top:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-weight:bold; color:var(--indigo); font-size:15px;">참고할 문제를 체크해주세요</span>
          <button onclick="toggleSimMode(false)" style="background:none; border:none; color:var(--muted); cursor:pointer; font-size:14px; padding:4px;">취소</button>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:13px; color:var(--text);">개수:</span>
            <div style="display:flex; gap:4px;">
              ${[1, 2, 3, 4, 5].map(n => `<button class="sim-cnt-btn ${n===3?'active':''}" onclick="window.setSimCount(${n})" style="width:30px; height:30px; border-radius:6px; border:1px solid var(--indigo); background:${n===3?'var(--indigo)':'transparent'}; color:${n===3?'white':'var(--indigo)'}; font-size:14px; font-weight:bold; cursor:pointer;">${n}</button>`).join('')}
            </div>
          </div>
          <button onclick="generateSimilarQuestions('${label}')" style="padding:10px 20px; background:var(--indigo); color:white; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">생성하기</button>
        </div>
      </div>
    </div>`;

  list.innerHTML = listHtml + resultAreaHtml + fixedBottomUI;

  window.simCount = 3;
  window.setSimCount = function(n) {
    if (typeof playSound === 'function') playSound(sfx.button);
    window.simCount = n;
    document.querySelectorAll('.sim-cnt-btn').forEach(btn => {
      const isActive = parseInt(btn.textContent) === n;
      btn.style.background = isActive ? 'var(--indigo)' : 'transparent';
      btn.style.color = isActive ? 'white' : 'var(--indigo)';
    });
  };

  window.toggleSimMode = function(isActive) {
    if (typeof playSound === 'function') playSound(sfx.button);
    const floatingBtn = document.getElementById('sim-floating-btn');
    const controlPanel = document.getElementById('sim-control-panel');
    const checkWraps = document.querySelectorAll('.sim-check-wrap');
    const checkboxes = document.querySelectorAll('.sim-check');
    if (isActive) {
      floatingBtn.style.display = 'none'; controlPanel.style.display = 'block';
      checkWraps.forEach(wrap => wrap.style.display = 'block');
    } else {
      floatingBtn.style.display = 'block'; controlPanel.style.display = 'none';
      checkWraps.forEach(wrap => wrap.style.display = 'none');
      checkboxes.forEach(cb => cb.checked = false);
    }
  };
}

// ============================================
// 유사문제 생성 (Supabase Edge Function 연동)
// ============================================
async function generateSimilarQuestions(label) {
  if (typeof playSound === 'function') playSound(sfx.button);
  const checkboxes = document.querySelectorAll('.sim-check:checked');
  if (checkboxes.length === 0) { toast('유사문제를 생성할 기준 문제를 하나 이상 선택해주세요.'); return; }

  const filteredNotes = examWrongNote.filter(n => (n.examTitle || '기타') === label);
  const selectedQuestions = Array.from(checkboxes).map(cb => filteredNotes[cb.value]);
  const resultArea = document.getElementById('sim-result-area');

  resultArea.innerHTML = '<div style="text-align:center; padding:30px; color:var(--indigo); font-weight:bold;">유사문제를 생성하는 중입니다... ⏳<br><span style="font-size:12px; font-weight:normal; color:var(--muted); margin-top:8px; display:inline-block;">AI가 문제를 출제하고 있습니다. 약 10~20초 정도 소요될 수 있습니다.</span></div>';

  const prompt = `다음 기출문제들을 참고하여, 비슷한 유형과 난이도의 객관식 문제를 ${window.simCount}개 만들어주세요.
응답은 반드시 아래 JSON 배열 형식으로만 반환해야 합니다. 마크다운 기호 없이 순수 JSON만 출력하세요.

[
  {
    "question": "새로운 문제 내용",
    "options": ["보기1", "보기2", "보기3", "보기4"],
    "answer": "정답 번호 (1~4)",
    "explanation": "이 문제에 대한 상세한 해설"
  }
]

[참고 문제]
${selectedQuestions.map(q => `문제: ${q.question}\n보기: ${q.options ? q.options.join(', ') : '없음'}\n정답: ${q.correctAns}`).join('\n\n')}`;

  try {
    // Edge Function 호출 (API 키 노출 없음)
    const response = await fetch(
  `${SUPABASE_URL}functions/v1/generate-questions`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify({ prompt: prompt })
  }
)

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || 'API 통신 중 에러가 발생했습니다.');
    }

    const data = await response.json();
    const textResponse = data.content[0].text;
    let cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const generatedItems = JSON.parse(cleanJson);
    renderGeneratedQuestions(generatedItems);

  } catch (error) {
    console.error('문제 생성 오류:', error);
    resultArea.innerHTML = `<div style="background:var(--error-t, #fee2e2); color:var(--error); padding:15px; border-radius:8px; font-size:14px;">⚠️ 생성 실패: ${error.message}</div>`;
  }
}

function renderGeneratedQuestions(items) {
  const resultArea = document.getElementById('sim-result-area');
  let html = '<div style="font-weight:bold; font-size:15px; margin-bottom:5px; color:var(--success);">✨ 성공적으로 유사문제가 생성되었습니다! 바로 풀어보세요.</div>';
  items.forEach((item, index) => {
    html += `
      <div style="background:white; padding:20px; border-radius:8px; border:1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <div style="font-weight:600; font-size:15px; margin-bottom:15px; color:var(--text);">Q${index + 1}. ${item.question}</div>
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
          ${item.options.map((opt, i) => `
            <label style="cursor:pointer; padding:10px 12px; background:var(--bg); border:1px solid var(--border); border-radius:6px; display:block;">
              <input type="radio" name="gq${index}" value="${i+1}" style="margin-right:8px;"> ${i+1}) ${opt}
            </label>
          `).join('')}
        </div>
        <button onclick="checkGeneratedAnswer(${index}, '${item.answer}', \`${item.explanation.replace(/`/g, '')}\`)" style="padding:10px 16px; background:var(--green); color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">정답 확인</button>
        <div id="gq-res-${index}" style="margin-top:15px; padding:15px; background:var(--bg2); border-radius:6px; border-left:4px solid var(--green); display:none;"></div>
      </div>`;
  });
  resultArea.innerHTML = html;
}

function checkGeneratedAnswer(index, correctAns, explanation) {
  if (typeof playSound === 'function') playSound(sfx.button);
  const checked = document.querySelector(`input[name="gq${index}"]:checked`);
  const resDiv = document.getElementById(`gq-res-${index}`);
  resDiv.style.display = 'block';
  if (!checked) { resDiv.style.borderLeftColor = 'var(--error)'; resDiv.innerHTML = '<span style="color:var(--error); font-weight:bold;">먼저 답을 선택해 주세요.</span>'; return; }
  const isCorrect = (checked.value === correctAns.toString());
  resDiv.style.borderLeftColor = isCorrect ? 'var(--success)' : 'var(--error)';
  resDiv.innerHTML = `
    <div style="font-weight:bold; font-size:15px; margin-bottom:8px; color:${isCorrect ? 'var(--success)' : 'var(--error)'};">
      ${isCorrect ? '⭕ 정답입니다!' : '❌ 틀렸습니다. (정답: ' + correctAns + '번)'}
    </div>
    <div style="font-size:14px; color:var(--text); line-height:1.5;">
      <span style="color:var(--indigo); font-weight:bold; font-size:12px; display:block; margin-bottom:4px;">[해설]</span>
      ${explanation}
    </div>`;
}

function delExamWrong(index, currentLabel) {
  if (typeof playSound === 'function') playSound(sfx.button);
  examWrongNote.splice(index, 1); saveExamWrongLocal();
  const remaining = examWrongNote.filter(n => (n.examTitle || '기타') === currentLabel);
  if(remaining.length === 0) showExamWrongParts(); else showExamWrongWords(currentLabel);
}
