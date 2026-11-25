import { EXERCISES, metricDefs, analyzeSet } from './analysis.js';
import { listSessions, saveSession, deleteSession, clearAll } from './storage.js';

const VERSION = '1.0.0';
const $ = (s) => document.querySelector(s);
const EMOJI = { squat: '🏋️', deadlift: '⚡', row: '🚣', ohp: '🙌', curl: '💪', lateral: '🪽' };
const VIEW_LABEL = { side: '측면 촬영', front: '정면 촬영', any: '정면/측면' };
const SIGNAL_LABEL = { knee: '무릎 각도', hip: '엉덩이 각도', elbow: '팔꿈치 각도', abd: '어깨(팔 벌림) 각도' };

const state = { ex: 'squat', file: null, url: null, cancelled: false, frames: null, report: null, aspect: 1 };
const stack = ['home'];

// ---------- 화면 전환 ----------
const TITLES = { home: '렙체크 AI', analyze: '영상 분석', report: '분석 리포트', history: '운동 기록', help: '사용 방법' };
function show(name, push = true) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  if (push && stack[stack.length - 1] !== name) stack.push(name);
  $('#title').textContent = name === 'analyze' ? EXERCISES[state.ex].name + ' 분석' : TITLES[name];
  $('#backBtn').hidden = name === 'home';
  window.scrollTo(0, 0);
  if (name === 'history') renderHistory();
}
function back() {
  if (busy()) { state.cancelled = true; return true; }
  if (stack.length <= 1) return false;
  stack.pop();
  show(stack[stack.length - 1], false);
  return true;
}
$('#backBtn').onclick = back;
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) show(go.dataset.go);
});
// 안드로이드 뒤로가기 버튼 (Capacitor App 플러그인)
const capApp = window.Capacitor?.Plugins?.App;
if (capApp) capApp.addListener('backButton', () => { if (!back()) capApp.exitApp(); });

function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), ms);
}

// ---------- 홈 ----------
$('#version').textContent = 'v' + VERSION;
$('#exGrid').innerHTML = Object.entries(EXERCISES).map(([id, e]) => `
  <button class="ex-card" data-ex="${id}">
    <span class="emoji">${EMOJI[id]}</span><b>${e.name}</b><small>${e.pattern} · ${VIEW_LABEL[e.view]}</small>
  </button>`).join('');
$('#exGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ex]'); if (!b) return;
  state.ex = b.dataset.ex;
  const cfg = EXERCISES[state.ex];
  $('#exName').textContent = cfg.name;
  $('#viewBadge').textContent = VIEW_LABEL[cfg.view];
  $('#exGuide').textContent = cfg.guide;
  show('analyze');
});

// ---------- 영상 선택 ----------
const preview = $('#previewVideo');
$('#fileInput').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = f; state.url = URL.createObjectURL(f);
  preview.src = state.url;
  $('#previewWrap').hidden = false;
  $('#fileLabel').textContent = f.name.length > 28 ? f.name.slice(0, 25) + '…' : f.name;
  $('#startBtn').disabled = true;
  preview.onloadedmetadata = () => {
    $('#startBtn').disabled = false;
    if (preview.duration > 90) toast('영상이 길어요. 한 세트(1분 이내)만 잘라서 올리면 더 정확해요.', 4000);
  };
  preview.onerror = () => toast('이 영상 형식은 열 수 없어요. 휴대폰 기본 카메라로 찍은 MP4 영상을 써주세요.', 4000);
});

const busy = () => !$('#progressBox').hidden;

$('#cancelBtn').onclick = () => { state.cancelled = true; };
$('#startBtn').onclick = async () => {
  state.cancelled = false;
  $('#startBtn').hidden = true; $('#progressBox').hidden = false;
  const setP = (r, text) => {
    $('#progressBar').style.width = Math.round(r * 100) + '%';
    if (text) $('#progressText').textContent = text;
  };
  try {
    setP(0, 'AI 모델 불러오는 중… (처음 한 번은 조금 걸려요)');
    const { initPose, processVideo } = await import('./pose.js');
    await initPose();
    const t0 = performance.now();
    const { frames, aspect } = await processVideo(preview, {
      onProgress: (r) => setP(r, `관절 인식 중… ${Math.round(r * 100)}%`),
      isCancelled: () => state.cancelled,
    });
    setP(1, '반복 분석 중…');
    const report = analyzeSet(frames, state.ex);
    report.elapsed = (performance.now() - t0) / 1000;
    if (!report.ok) { toast(report.reason, 5000); return; }
    state.frames = frames; state.aspect = aspect; state.report = report;
    const w = parseFloat($('#weightInput').value);
    report.weight = Number.isFinite(w) ? w : null;
    if (report.reps.length) saveSession(report, report.weight, state.file?.name);
    renderReport(report);
    show('report');
  } catch (e) {
    if (e.message !== 'cancelled') { console.error(e); toast('분석 중 문제가 생겼어요: ' + e.message, 5000); }
    else toast('분석을 취소했어요.');
  } finally {
    $('#startBtn').hidden = false; $('#progressBox').hidden = true;
  }
};
$('#againBtn').onclick = () => { stack.pop(); show('analyze', false); };

// ---------- 리포트 ----------
const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const scoreClass = (s) => (s >= 90 ? 's-good' : s >= 60 ? 's-mid' : 's-bad');

function metricLine(ex, m, partial) {
  const defs = metricDefs(ex);
  let html = defs.filter((d) => Number.isFinite(m[d.key]))
    .map((d) => `<span>${d.label} <b>${fmt(m[d.key], d.digits ?? 0)}${d.unit}</b></span>`).join('');
  if (Number.isFinite(m.lrDiff)) html += `<span>좌우 차이 <b>${fmt(m.lrDiff)}°</b></span>`;
  if (ex === 'squat') html += `<span>깊이 <b>${m.shallow ? '얕음' : '충분'}</b></span>`;
  if (partial) html += '<span class="tag">영상 끝에서 잘림</span>';
  return html;
}

function renderReport(r) {
  const cfg = EXERCISES[r.exercise];
  const s = r.summary;
  $('#repExName').textContent = cfg.name;
  const when = new Date().toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  $('#repMeta').textContent = `${when}${r.weight ? ' · ' + r.weight + 'kg' : ''} · ${r.view === 'front' ? '정면' : '측면'} 영상 · 인식률 ${Math.round(r.detectRate * 100)}%`;
  const ring = $('#scoreRing');
  ring.style.setProperty('--p', s.avgScore);
  ring.style.setProperty('--ring', s.avgScore >= 90 ? 'var(--good)' : s.avgScore >= 60 ? 'var(--warn)' : 'var(--bad)');
  $('#scoreNum').textContent = r.reps.length ? s.avgScore : '–';
  const stats = [
    ['횟수', s.reps + '회'],
    [cfg.phases[cfg.lift === 0 ? 1 : 0] + ' 평균', fmt(s.avgLower, 1) + '초'],
    [cfg.phases[cfg.lift] + ' 평균', fmt(s.avgLift, 1) + '초'],
  ];
  if (s.breakdownRep) stats.push(['자세 붕괴', s.breakdownRep + '회째~']);
  if (r.exercise === 'squat') stats.push(['깊이 충족', `${s.depthOkCount}/${s.reps}`]);
  $('#statRow').innerHTML = stats.map(([k, v]) => `<div class="stat">${k}<b>${v}</b></div>`).join('');

  $('#msgCard').hidden = !r.message;
  $('#msgCard').textContent = r.message || '';
  $('#tipList').innerHTML = (r.tips.length ? r.tips : ['분석할 반복이 없어요.']).map((t) => `<li>${t}</li>`).join('');

  $('#repList').innerHTML = r.reps.map((rep) => `
    <div class="rep-item" data-t="${rep.start}">
      <div class="rep-top">
        <span class="rep-n">${rep.n}회</span>
        <span class="rep-score ${scoreClass(rep.score)}">${rep.score}점</span>
        ${rep.n <= 3 ? '<span class="tag base">기준</span>' : ''}
        <span class="muted small">${cfg.phases[0]} ${fmt(rep.phase1, 1)}초 · ${cfg.phases[1]} ${fmt(rep.phase2, 1)}초</span>
      </div>
      <div class="rep-metrics">${metricLine(r.exercise, rep.m, rep.partial)}</div>
      ${rep.warn.length || rep.breakdown.length ? `<ul class="rep-warn">${rep.warn.map((w) => `<li>${w}</li>`).join('')}${rep.breakdown.map((w) => `<li class="bd">첫 3회 대비 ${w}</li>`).join('')}</ul>` : ''}
    </div>`).join('') || '<p class="empty">찾은 반복이 없어요.</p>';
  $('#baselineNote').textContent = r.reps.length > 3
    ? '1~3회 평균을 기준으로 4회째부터 자세 변화를 비교했어요.'
    : '반복이 4회 이상이면 첫 3회를 기준으로 자세 붕괴를 찾아요.';

  $('#chartTitle').textContent = SIGNAL_LABEL[cfg.primary] + ' 변화';
  setupReplay();
  requestAnimationFrame(() => drawSignal(r));
}

$('#repList').addEventListener('click', (e) => {
  const it = e.target.closest('[data-t]'); if (!it) return;
  const v = $('#replayVideo');
  v.currentTime = parseFloat(it.dataset.t);
  v.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function drawSignal(r) {
  const c = $('#signalChart');
  const dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth, H = c.clientHeight;
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  g.clearRect(0, 0, W, H);
  const ts = r.times, sig = r.signal;
  if (!ts.length) return;
  const pad = { l: 34, r: 8, t: 10, b: 20 };
  const vals = sig.filter(Number.isFinite);
  const lo = Math.floor(Math.min(...vals) / 10) * 10, hi = Math.ceil(Math.max(...vals) / 10) * 10;
  const tMax = ts[ts.length - 1] || 1;
  const X = (t) => pad.l + (W - pad.l - pad.r) * (t / tMax);
  const Y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo || 1));
  const css = getComputedStyle(document.documentElement);
  const col = (n) => css.getPropertyValue(n).trim();
  for (const rep of r.reps) {
    g.fillStyle = rep.score >= 90 ? 'rgba(61,220,132,.13)' : rep.score >= 60 ? 'rgba(255,181,71,.15)' : 'rgba(255,93,93,.16)';
    g.fillRect(X(rep.start), pad.t, X(rep.end) - X(rep.start), H - pad.t - pad.b);
    g.fillStyle = col('--muted'); g.font = '10px sans-serif'; g.textAlign = 'center';
    g.fillText(rep.n, X(rep.peak), pad.t + 10);
  }
  g.strokeStyle = col('--line'); g.lineWidth = 1; g.fillStyle = col('--muted'); g.font = '10px sans-serif'; g.textAlign = 'right';
  for (let k = 0; k <= 3; k++) {
    const v = lo + (hi - lo) * k / 3, y = Y(v);
    g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke();
    g.fillText(Math.round(v) + '°', pad.l - 4, y + 3);
  }
  g.textAlign = 'center';
  g.fillText('0초', pad.l, H - 5); g.fillText(tMax.toFixed(0) + '초', W - pad.r - 8, H - 5);
  g.strokeStyle = col('--accent'); g.lineWidth = 2; g.beginPath();
  ts.forEach((t, i) => (i ? g.lineTo(X(t), Y(sig[i])) : g.moveTo(X(t), Y(sig[i]))));
  g.stroke();
}

// 관절 오버레이 다시보기
function setupReplay() {
  const v = $('#replayVideo');
  v.src = state.url;
  const canvas = $('#overlay');
  const frames = state.frames;
  const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
  const draw = () => {
    const W = v.clientWidth, H = v.clientHeight;
    if (!W) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // 화면 안 실제 영상 영역 (레터박스 고려)
    const va = v.videoWidth / v.videoHeight, ba = W / H;
    const vw = va > ba ? W : H * va, vh = va > ba ? W / va : H;
    const ox = (W - vw) / 2, oy = (H - vh) / 2;
    let lo = 0, hi = frames.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (frames[m].t < v.currentTime) lo = m + 1; else hi = m; }
    const f = frames[lo];
    if (!f || !f.p || Math.abs(f.t - v.currentTime) > 0.3) return;
    const P = (i) => [ox + (f.p[i].x / state.aspect) * vw, oy + f.p[i].y * vh];
    const rep = state.report.reps.find((r) => v.currentTime >= r.start && v.currentTime <= r.end);
    const color = rep ? (rep.score >= 90 ? '#3ddc84' : rep.score >= 60 ? '#ffb547' : '#ff5d5d') : '#c6f432';
    g.lineWidth = 3; g.strokeStyle = color; g.lineCap = 'round';
    for (const [a, b] of BONES) {
      if (f.p[a].v < 0.3 || f.p[b].v < 0.3) continue;
      const [x1, y1] = P(a), [x2, y2] = P(b);
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    g.fillStyle = '#fff';
    for (const i of [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
      if (f.p[i].v < 0.3) continue;
      const [x, y] = P(i); g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill();
    }
    if (rep) {
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(8, 8, 92, 26);
      g.fillStyle = color; g.font = 'bold 14px sans-serif'; g.textAlign = 'left';
      g.fillText(`${rep.n}회 · ${rep.score}점`, 14, 26);
    }
  };
  const loop = () => { draw(); if (!v.paused) requestAnimationFrame(loop); };
  v.onplay = loop; v.onseeked = draw; v.onloadeddata = draw;
  window.onresize = draw;
}

// ---------- 기록 ----------
$('#histFilter').innerHTML = '<option value="">전체 운동</option>' +
  Object.entries(EXERCISES).map(([id, e]) => `<option value="${id}">${e.name}</option>`).join('');
$('#histFilter').onchange = renderHistory;

function renderHistory() {
  const ex = $('#histFilter').value;
  const list = listSessions(ex);
  $('#histList').innerHTML = list.length ? list.map((s) => {
    const cfg = EXERCISES[s.exercise];
    const d = new Date(s.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const warnCount = s.reps.reduce((a, r) => a + r.warn.length, 0);
    return `<div class="hist-item">
      <div class="hist-top"><b>${cfg?.name ?? s.exercise}${s.weight ? ' · ' + s.weight + 'kg' : ''}</b>
        <span class="rep-score ${scoreClass(s.summary.avgScore)}">${s.summary.avgScore}점</span></div>
      <p class="muted small">${d} · ${s.summary.reps}회${s.summary.breakdownRep ? ` · ${s.summary.breakdownRep}회째 자세 붕괴` : ''} · 경고 ${warnCount}개</p>
      <ul class="tips small">${(s.tips || []).slice(0, 2).map((t) => `<li>${t}</li>`).join('')}</ul>
      <button class="del" data-del="${s.id}">삭제</button>
    </div>`;
  }).join('') : '<p class="empty">아직 기록이 없어요. 첫 세트를 분석해보세요!</p>';
  renderWeightChart(ex, list);
}

$('#histList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  deleteSession(b.dataset.del); renderHistory(); toast('기록을 삭제했어요.');
});
$('#clearBtn').onclick = () => {
  if ($('#clearBtn').dataset.confirm) { clearAll(); renderHistory(); toast('모든 기록을 삭제했어요.'); delete $('#clearBtn').dataset.confirm; $('#clearBtn').textContent = '모든 기록 삭제'; return; }
  $('#clearBtn').dataset.confirm = '1'; $('#clearBtn').textContent = '한 번 더 누르면 모두 삭제돼요';
  setTimeout(() => { delete $('#clearBtn').dataset.confirm; $('#clearBtn').textContent = '모든 기록 삭제'; }, 4000);
};

function renderWeightChart(ex, list) {
  const card = $('#weightCard');
  const pts = list.filter((s) => s.weight).map((s) => ({ w: s.weight, sc: s.summary.avgScore, bd: s.summary.breakdownRep, n: s.summary.reps }));
  if (!ex || pts.length < 2) {
    card.hidden = false;
    $('#weightChart').innerHTML = `<p class="empty small">${ex ? '무게를 입력한 기록이 2개 이상 있으면 그래프가 나와요.' : '운동을 하나 고르면 무게별 그래프가 나와요.'}</p>`;
    return;
  }
  const W = 320, H = 170, pl = 32, pr = 10, pt = 10, pb = 26;
  const wMin = Math.min(...pts.map((p) => p.w)), wMax = Math.max(...pts.map((p) => p.w));
  const X = (w) => pl + (W - pl - pr) * (wMax === wMin ? 0.5 : (w - wMin) / (wMax - wMin));
  const Y = (s) => pt + (H - pt - pb) * (1 - s / 100);
  // 무게별 평균
  const byW = {};
  pts.forEach((p) => (byW[p.w] ||= []).push(p.sc));
  const avg = Object.entries(byW).map(([w, a]) => [Number(w), a.reduce((x, y) => x + y, 0) / a.length]).sort((a, b) => a[0] - b[0]);
  const grid = [0, 50, 100].map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="#2c343e"/><text x="${pl - 6}" y="${Y(v) + 4}" fill="#94a0ad" font-size="10" text-anchor="end">${v}</text>`).join('');
  const line = avg.map(([w, s], i) => `${i ? 'L' : 'M'}${X(w)},${Y(s)}`).join('');
  const dots = pts.map((p) => `<circle cx="${X(p.w)}" cy="${Y(p.sc)}" r="4" fill="#c6f432" fill-opacity=".55"/>`).join('');
  const labels = avg.map(([w]) => `<text x="${X(w)}" y="${H - 8}" fill="#94a0ad" font-size="10" text-anchor="middle">${w}kg</text>`).join('');
  $('#weightChart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="무게별 품질 점수">${grid}<path d="${line}" fill="none" stroke="#c6f432" stroke-width="2"/>${dots}${labels}</svg>`;
}

// 테스트/디버그용
window.__repcheck = { state, analyzeSet };
