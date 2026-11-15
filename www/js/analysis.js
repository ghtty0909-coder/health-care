// 반복(rep) 분석 엔진 — 순수 함수만 사용 (브라우저/Node 공용)
// 입력: frames = [{ t: 초, p: [{x,y,v}] * 33 | null }], 좌표는 x가 화면비로 보정된 값(x*W/H)

export const L = {
  nose: 0,
  lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16,
  lHip: 23, rHip: 24, lKn: 25, rKn: 26, lAn: 27, rAn: 28,
};

const DEG = 180 / Math.PI;

export function angle(a, b, c) {
  // b 지점의 각도 (0~180)
  const v1x = a.x - b.x, v1y = a.y - b.y;
  const v2x = c.x - b.x, v2y = c.y - b.y;
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (!d) return NaN;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d));
  return Math.acos(cos) * DEG;
}

// 엉덩이→어깨 벡터가 수직에서 기울어진 각도 (0 = 꼿꼿, 90 = 수평)
export function leanFromVertical(sh, hip) {
  const dx = sh.x - hip.x, dy = hip.y - sh.y; // 위쪽이 +
  return Math.atan2(Math.abs(dx), dy) * DEG;
}

// 두 점을 잇는 선이 수평에서 기울어진 각도 (부호 있음)
export function tilt(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let deg = Math.atan2(dy, Math.abs(dx) || 1e-6) * DEG;
  if (dx < 0) deg = -deg;
  return deg;
}

export function percentile(arr, q) {
  const s = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export function mean(arr) {
  const s = arr.filter(Number.isFinite);
  return s.length ? s.reduce((a, b) => a + b, 0) / s.length : NaN;
}

// NaN 구간을 선형 보간
export function interpolate(arr) {
  const out = arr.slice();
  const n = out.length;
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(out[i])) {
      if (last === -1) for (let j = 0; j < i; j++) out[j] = out[i];
      else for (let j = last + 1; j < i; j++) out[j] = out[last] + (out[i] - out[last]) * (j - last) / (i - last);
      last = i;
    }
  }
  if (last === -1) return out;
  for (let j = last + 1; j < n; j++) out[j] = out[last];
  return out;
}

// 이동 평균 (가장자리는 가능한 범위만)
export function smooth(arr, half = 2) {
  const n = arr.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
      if (Number.isFinite(arr[j])) { s += arr[j]; c++; }
    }
    out[i] = c ? s / c : NaN;
  }
  return out;
}

// 랜드마크 좌표를 시간축으로 부드럽게 (흔들림 감소)
export function smoothFrames(frames, half = 1) {
  const n = frames.length;
  return frames.map((f, i) => {
    if (!f.p) return f;
    const p = f.p.map((pt, k) => {
      let sx = 0, sy = 0, sv = 0, c = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
        const q = frames[j].p && frames[j].p[k];
        if (q) { sx += q.x; sy += q.y; sv += q.v; c++; }
      }
      return { x: sx / c, y: sy / c, v: sv / c };
    });
    return { t: f.t, p };
  });
}

// 프레임별 특징값 계산
export function computeFeatures(p) {
  const g = (i) => p[i];
  const vis = (...ids) => Math.min(...ids.map((i) => p[i].v ?? 1));
  const f = {
    kneeL: angle(g(L.lHip), g(L.lKn), g(L.lAn)),
    kneeR: angle(g(L.rHip), g(L.rKn), g(L.rAn)),
    hipL: angle(g(L.lSh), g(L.lHip), g(L.lKn)),
    hipR: angle(g(L.rSh), g(L.rHip), g(L.rKn)),
    elbowL: angle(g(L.lSh), g(L.lEl), g(L.lWr)),
    elbowR: angle(g(L.rSh), g(L.rEl), g(L.rWr)),
    abdL: angle(g(L.lHip), g(L.lSh), g(L.lEl)),
    abdR: angle(g(L.rHip), g(L.rSh), g(L.rEl)),
    leanL: leanFromVertical(g(L.lSh), g(L.lHip)),
    leanR: leanFromVertical(g(L.rSh), g(L.rHip)),
    shTilt: tilt(g(L.lSh), g(L.rSh)),
    hipTilt: tilt(g(L.lHip), g(L.rHip)),
    hipYL: g(L.lHip).y, hipYR: g(L.rHip).y,
    shYL: g(L.lSh).y, shYR: g(L.rSh).y,
    knYL: g(L.lKn).y, knYR: g(L.rKn).y,
    wrYL: g(L.lWr).y, wrYR: g(L.rWr).y,
    shXL: g(L.lSh).x, shXR: g(L.rSh).x,
    hipXL: g(L.lHip).x, hipXR: g(L.rHip).x,
    torsoLen: (Math.hypot(g(L.lSh).x - g(L.lHip).x, g(L.lSh).y - g(L.lHip).y) +
      Math.hypot(g(L.rSh).x - g(L.rHip).x, g(L.rSh).y - g(L.rHip).y)) / 2,
    shWidth: Math.abs(g(L.lSh).x - g(L.rSh).x),
    visL: vis(L.lSh, L.lEl, L.lWr, L.lHip, L.lKn, L.lAn),
    visR: vis(L.rSh, L.rEl, L.rWr, L.rHip, L.rKn, L.rAn),
  };
  return f;
}

// 정면/측면 판단 + 측면이면 카메라 쪽 몸
export function detectView(feats) {
  const ratios = feats.filter(Boolean).map((f) => f.shWidth / (f.torsoLen || 1));
  const r = percentile(ratios, 0.5);
  const view = r > 0.38 ? 'front' : 'side';
  const vl = mean(feats.filter(Boolean).map((f) => f.visL));
  const vr = mean(feats.filter(Boolean).map((f) => f.visR));
  return { view, side: vl >= vr ? 'L' : 'R', shoulderRatio: r };
}

// 반복 구간 찾기: norm 0(휴식) → 1(최대 동작) → 0
export function segmentReps(times, signal, { activeIsMin, minRange, enter = 0.55, exit = 0.22, minDur = 0.5 }) {
  const hi = percentile(signal, 0.97), lo = percentile(signal, 0.03);
  const range = hi - lo;
  if (!Number.isFinite(range) || range < minRange) return { reps: [], range, hi, lo };
  const norm = signal.map((s) => (activeIsMin ? (hi - s) / range : (s - lo) / range));
  const reps = [];
  let state = norm[0] < exit ? 'rest' : 'wait';
  let lastRest = 0, start = 0, peak = 0;
  for (let i = 0; i < norm.length; i++) {
    const v = norm[i];
    if (state === 'wait') {
      if (v < exit) { state = 'rest'; lastRest = i; }
    } else if (state === 'rest') {
      if (v < exit) lastRest = i;
      if (v > enter) { state = 'active'; start = lastRest; peak = i; }
    } else {
      if (v > norm[peak]) peak = i;
      if (v < exit) {
        if (times[i] - times[start] >= minDur) reps.push({ start, peak, end: i });
        state = 'rest'; lastRest = i;
      }
    }
  }
  if (state === 'active' && norm[peak] > 0.7) {
    reps.push({ start, peak, end: norm.length - 1, partial: true });
  }
  return { reps, range, hi, lo, norm };
}

const pick = (f, side, key) => (side === 'avg' ? (f[key + 'L'] + f[key + 'R']) / 2 : f[key + side]);

// ---- 운동별 설정 ----
// primary: 반복 판단 신호, activeIsMin: 동작 최대점이 최소값인지
// phases: [시작→최대점 이름, 최대점→끝 이름], lift: 들어올리는(단축성) 구간 인덱스
export const EXERCISES = {
  squat: {
    name: '스쿼트', view: 'side', pattern: '스쿼트류',
    guide: '옆에서 촬영하세요. 머리부터 발끝까지 전신이 나오게, 휴대폰은 엉덩이 높이에 두면 좋아요.',
    primary: 'knee', activeIsMin: true, minRange: 35, phases: ['하강', '상승'], lift: 1,
  },
  deadlift: {
    name: '데드리프트', view: 'side', pattern: '힌지류',
    guide: '옆에서 촬영하세요. 바와 전신이 모두 보이게 2~3m 떨어져서 찍어주세요.',
    primary: 'hip', activeIsMin: false, minRange: 35, phases: ['당기기', '내리기'], lift: 0,
  },
  row: {
    name: '바벨 로우', view: 'side', pattern: '힌지류',
    guide: '옆에서 촬영하세요. 상체와 팔, 무릎까지 보이게 찍어주세요.',
    primary: 'elbow', activeIsMin: true, minRange: 30, phases: ['당기기', '내리기'], lift: 0,
  },
  ohp: {
    name: '오버헤드 프레스', view: 'any', pattern: '프레스류',
    guide: '정면에서 찍으면 좌우 균형을, 옆에서 찍으면 허리 젖힘을 볼 수 있어요. 머리 위로 뻗은 손까지 화면에 나오게 해주세요.',
    primary: 'elbow', activeIsMin: false, minRange: 35, phases: ['밀기', '내리기'], lift: 0,
  },
  curl: {
    name: '덤벨 컬', view: 'front', pattern: '팔·어깨',
    guide: '정면에서 촬영하세요. 허리 위 상체와 양팔 전체가 보이게 찍어주세요.',
    primary: 'elbow', activeIsMin: true, minRange: 40, phases: ['올리기', '내리기'], lift: 0,
  },
  lateral: {
    name: '사이드 레터럴 레이즈', view: 'front', pattern: '팔·어깨',
    guide: '정면에서 촬영하세요. 양팔을 벌렸을 때 손끝까지 화면에 들어오게 찍어주세요.',
    primary: 'abd', activeIsMin: false, minRange: 30, phases: ['올리기', '내리기'], lift: 0,
  },
};

// 운동별 지표 정의
// worse: 'up'이면 값이 커질수록 나쁨, 'down'이면 작아질수록 나쁨. tol: 기준(첫 3회) 대비 허용 오차
const METRICS = {
  squat: [
    { key: 'depth', label: '최저 무릎 각도', unit: '°', worse: 'up', tol: 12 },
    { key: 'lean', label: '최저점 상체 기울기', unit: '°', worse: 'up', tol: 10 },
  ],
  deadlift: [
    { key: 'lockout', label: '락아웃 엉덩이 각도', unit: '°', worse: 'down', tol: 10 },
    { key: 'hipShoot', label: '엉덩이 선상승 비율', unit: '', worse: 'up', tol: 0.6, digits: 2 },
  ],
  row: [
    { key: 'rom', label: '최대 수축 팔꿈치 각도', unit: '°', worse: 'up', tol: 15 },
    { key: 'torso', label: '상체 각도(수평 기준)', unit: '°', worse: 'up', tol: 10 },
    { key: 'sway', label: '상체 반동 폭', unit: '°', worse: 'up', tol: 8 },
  ],
  ohp: [
    { key: 'lockout', label: '락아웃 팔꿈치 각도', unit: '°', worse: 'down', tol: 12 },
    { key: 'lean', label: '상체 뒤로 젖힘', unit: '°', worse: 'up', tol: 7 },
  ],
  curl: [
    { key: 'rom', label: '최대 수축 팔꿈치 각도', unit: '°', worse: 'up', tol: 15 },
    { key: 'elbowDrift', label: '팔꿈치 들림', unit: '°', worse: 'up', tol: 10 },
    { key: 'sway', label: '상체 반동 폭', unit: '°', worse: 'up', tol: 6 },
  ],
  lateral: [
    { key: 'peak', label: '최고점 팔 각도', unit: '°', worse: 'down', tol: 15 },
    { key: 'sway', label: '상체 반동 폭', unit: '°', worse: 'up', tol: 6 },
  ],
};
export function metricDefs(ex) { return METRICS[ex]; }

function range(arr) {
  const s = arr.filter(Number.isFinite);
  return s.length ? Math.max(...s) - Math.min(...s) : NaN;
}

// 반복 하나의 지표 + 절대 기준 경고
function repMetrics(ex, feats, rep, ctx) {
  const { side, view } = ctx;
  const sl = feats.slice(rep.start, rep.end + 1).filter(Boolean);
  const pk = feats[rep.peak];
  const s = view === 'front' ? 'avg' : side;
  const lean = (f) => pick(f, s, 'lean');
  const m = {}, warn = [];
  if (ex === 'squat') {
    m.depth = pick(pk, s, 'knee');
    m.lean = lean(pk);
    if (view === 'side') {
      const hipY = pk['hipY' + side], knY = pk['knY' + side];
      m.hipBelowKnee = hipY >= knY - 0.02 * pk.torsoLen;
    } else {
      m.hipBelowKnee = m.depth <= 95;
    }
    if (!m.hipBelowKnee && m.depth > 110) warn.push('깊이 부족 (얕은 스쿼트)');
    if (view === 'side' && m.lean > 50) warn.push('상체가 많이 숙여짐');
  } else if (ex === 'deadlift') {
    m.lockout = pick(pk, s, 'hip');
    // 당기는 구간 앞 40%에서 엉덩이 상승량 / 어깨 상승량
    const a = feats[rep.start], cut = rep.start + Math.max(1, Math.round((rep.peak - rep.start) * 0.4));
    const b = feats[Math.min(cut, rep.peak)];
    const k = view === 'front' ? 'L' : side;
    const hipRise = a['hipY' + k] - b['hipY' + k];
    const shRise = a['shY' + k] - b['shY' + k];
    m.hipShoot = shRise > 0.01 * a.torsoLen ? hipRise / shRise : (hipRise > 0.05 * a.torsoLen ? 3 : 1);
    if (m.lockout < 160) warn.push('락아웃 불완전 (엉덩이를 끝까지 펴지 않음)');
    if (m.hipShoot > 1.8) warn.push('엉덩이가 먼저 올라감 (허리 부담)');
  } else if (ex === 'row') {
    m.rom = pick(pk, s, 'elbow');
    m.torso = 90 - mean(sl.map(lean));
    m.sway = range(sl.map(lean));
    if (view === 'side' && m.torso > 50) warn.push('상체가 너무 세워짐');
    if (m.sway > 15) warn.push('상체 반동 사용');
    if (m.rom > 110) warn.push('충분히 당기지 않음');
  } else if (ex === 'ohp') {
    m.lockout = pick(pk, s, 'elbow');
    m.lean = view === 'side' ? Math.max(...sl.map(lean)) : NaN;
    if (m.lockout < 155) warn.push('끝까지 밀지 않음');
    if (view === 'side' && m.lean > 15) warn.push('허리가 뒤로 젖혀짐');
  } else if (ex === 'curl') {
    m.rom = pick(pk, s, 'elbow');
    m.elbowDrift = Math.max(...sl.map((f) => pick(f, s, 'abd')));
    m.sway = range(sl.map(lean));
    if (m.elbowDrift > 35) warn.push('팔꿈치가 앞으로 들림');
    if (m.sway > 10) warn.push('상체 반동 사용');
    if (m.rom > 80) warn.push('끝까지 감아올리지 않음');
  } else if (ex === 'lateral') {
    m.peak = pick(pk, s, 'abd');
    m.sway = range(sl.map(lean));
    if (m.peak > 110) warn.push('너무 높이 올림 (승모근 개입)');
    if (m.peak < 60) warn.push('충분히 올리지 않음');
    if (m.sway > 10) warn.push('상체 반동 사용');
  }
  // 좌우 불균형 (정면 영상)
  if (view === 'front') {
    const key = EXERCISES[ex].primary;
    m.lrDiff = Math.abs(pk[key + 'L'] - pk[key + 'R']);
    // 동작 범위가 작은 쪽 (사용자 몸 기준 왼쪽/오른쪽)
    const lessL = EXERCISES[ex].activeIsMin ? pk[key + 'L'] > pk[key + 'R'] : pk[key + 'L'] < pk[key + 'R'];
    m.weakSide = lessL ? 'L' : 'R';
    m.shTilt = mean(sl.map((f) => Math.abs(f.shTilt)));
    m.hipTilt = mean(sl.map((f) => Math.abs(f.hipTilt)));
    if (m.lrDiff > 15) warn.push(`좌우 팔/다리 각도 차이 ${m.lrDiff.toFixed(0)}°`);
    if (m.shTilt > 6) warn.push('어깨 높이가 한쪽으로 기울어짐');
    if (m.hipTilt > 6) warn.push('골반이 한쪽으로 기울어짐');
    if (m.lrDiff > 15 || m.shTilt > 6 || m.hipTilt > 6) {
      const lowSide = mean(sl.map((f) => f.shTilt)) > 0 ? '오른쪽' : '왼쪽';
      m.lowSide = lowSide;
    }
  }
  return { m, warn };
}

// ---- 전체 분석 ----
export function analyzeSet(rawFrames, ex, opts = {}) {
  const cfg = EXERCISES[ex];
  if (!cfg) throw new Error('알 수 없는 운동: ' + ex);
  const validCount = rawFrames.filter((f) => f.p).length;
  if (validCount < 10) {
    return { ok: false, reason: '사람을 거의 인식하지 못했어요. 전신이 보이게, 밝은 곳에서 다시 찍어주세요.' };
  }
  const frames = smoothFrames(rawFrames, 1);
  const times = frames.map((f) => f.t);
  const feats = frames.map((f) => (f.p ? computeFeatures(f.p) : null));
  const vd = detectView(feats);
  const view = opts.view || vd.view;
  const side = vd.side;
  const s = view === 'front' ? 'avg' : side;

  let sig = feats.map((f) => (f ? pick(f, s, cfg.primary) : NaN));
  sig = smooth(interpolate(sig), 2);
  // 보간용 피처도 채움 (지표 계산 시 null 방지)
  for (let i = 0; i < feats.length; i++) {
    if (!feats[i]) {
      let j = i - 1; while (j >= 0 && !feats[j]) j--;
      let k = i + 1; while (k < feats.length && !feats[k]) k++;
      feats[i] = feats[j] || feats[k];
    }
  }

  const seg = segmentReps(times, sig, cfg);
  const defs = METRICS[ex];
  const reps = seg.reps.map((r, idx) => {
    const { m, warn } = repMetrics(ex, feats, r, { side, view });
    const p1 = times[r.peak] - times[r.start];
    const p2 = times[r.end] - times[r.peak];
    return {
      n: idx + 1, start: times[r.start], peak: times[r.peak], end: times[r.end],
      iStart: r.start, iPeak: r.peak, iEnd: r.end, partial: !!r.partial,
      phase1: p1, phase2: p2, liftTime: cfg.lift === 0 ? p1 : p2, lowerTime: cfg.lift === 0 ? p2 : p1,
      m, warn, breakdown: [],
    };
  });

  // 템포 경고
  const baseN = Math.min(3, reps.length);
  const baseLift = mean(reps.slice(0, baseN).map((r) => r.liftTime));
  for (const r of reps) {
    if (r.lowerTime < 0.5) r.warn.push('너무 빠르게 내림 (통제 부족)');
    if (r.n > baseN && baseLift > 0 && r.liftTime > baseLift * 1.6) r.warn.push('들어올리는 속도 저하 (피로 신호)');
  }

  // 첫 3회 기준 자세 붕괴
  const baseline = {};
  for (const d of defs) baseline[d.key] = mean(reps.slice(0, baseN).map((r) => r.m[d.key]));
  let breakdownRep = null;
  if (reps.length > 3) {
    for (const r of reps.slice(3)) {
      for (const d of defs) {
        const b = baseline[d.key], v = r.m[d.key];
        if (!Number.isFinite(b) || !Number.isFinite(v)) continue;
        const dev = d.worse === 'up' ? v - b : b - v;
        if (dev > d.tol) r.breakdown.push(`${d.label} ${dev.toFixed(d.digits ?? 0)}${d.unit} 나빠짐`);
      }
      if (r.breakdown.length && breakdownRep === null) breakdownRep = r.n;
    }
  }

  // 반복 품질 점수
  for (const r of reps) {
    r.score = Math.max(0, 100 - 15 * r.warn.length - 10 * r.breakdown.length - (r.partial ? 20 : 0));
  }

  const summary = {
    reps: reps.length,
    avgScore: Math.round(mean(reps.map((r) => r.score))) || 0,
    avgLift: mean(reps.map((r) => r.liftTime)),
    avgLower: mean(reps.map((r) => r.lowerTime)),
    breakdownRep,
    baseline,
    metricsAvg: Object.fromEntries(defs.map((d) => [d.key, mean(reps.map((r) => r.m[d.key]))])),
    lrDiffAvg: view === 'front' ? mean(reps.map((r) => r.m.lrDiff)) : NaN,
    shTiltAvg: view === 'front' ? mean(reps.map((r) => r.m.shTilt)) : NaN,
  };
  if (ex === 'squat') {
    summary.depthOkCount = reps.filter((r) => r.m.hipBelowKnee || r.m.depth <= 100).length;
  }

  const tips = buildTips(ex, reps, summary, view);
  return {
    ok: true, exercise: ex, view, side, times, signal: sig, reps, summary, tips,
    detectRate: validCount / rawFrames.length, range: seg.range,
    message: reps.length ? null : '반복 동작을 찾지 못했어요. 전신(또는 해당 관절)이 화면 안에 다 나오는지, 촬영 방향이 맞는지 확인해주세요.',
  };
}

function buildTips(ex, reps, s, view) {
  const tips = [];
  if (!reps.length) return tips;
  const count = {};
  for (const r of reps) for (const w of r.warn) { const k = w.replace(/ \d+°/, ''); count[k] = (count[k] || 0) + 1; }
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]);
  for (const [w, c] of top.slice(0, 3)) tips.push(`${reps.length}회 중 ${c}회: ${w}`);
  if (s.breakdownRep) tips.push(`${s.breakdownRep}번째 반복부터 자세가 무너지기 시작했어요. 이 무게에서는 ${s.breakdownRep - 1}회까지가 좋은 자세로 가능한 횟수예요.`);
  else if (reps.length > 3) tips.push('세트 끝까지 첫 3회와 비슷한 자세를 유지했어요.');
  if (view === 'front') {
    const bad = reps.filter((r) => r.m.lrDiff > 12);
    if (bad.length) {
      const nL = bad.filter((r) => r.m.weakSide === 'L').length;
      const sideName = nL >= bad.length / 2 ? '왼쪽' : '오른쪽';
      tips.push(`${bad.length}회에서 ${sideName}이 덜 움직였어요. ${sideName} 단측 운동으로 보완해보세요.`);
    }
  }
  if (s.avgLower < 0.8) tips.push('내리는 동작을 1~2초 정도로 천천히 하면 부상 위험이 줄어요.');
  if (!tips.length) tips.push('전반적으로 안정적인 세트였어요.');
  return tips;
}
