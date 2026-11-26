// 합성 관절 데이터로 분석 엔진 검증: node test/synthetic.mjs
import { analyzeSet, L } from '../www/js/analysis.js';
import assert from 'node:assert/strict';

const R = Math.PI / 180;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);

function blank() { return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0.9 })); }
const at = (o, len, deg) => ({ x: o.x + len * Math.sin(deg * R), y: o.y - len * Math.cos(deg * R), v: 0.95 });

// 측면 스쿼트 프레임: knee = 무릎 각도, lean = 상체 기울기
function squatFrame(knee, lean, noise = 0.003) {
  const p = blank();
  const ankle = { x: 0.6, y: 0.9, v: 0.95 };
  const shinDeg = (180 - knee) * 0.45;          // 정강이는 앞으로(+)
  const kn = at(ankle, 0.22, shinDeg);
  const thighDeg = shinDeg - (180 - knee);       // 허벅지는 뒤로
  const hip = at(kn, 0.22, thighDeg);
  const sh = at(hip, 0.28, lean);
  const el = at(sh, 0.15, 160), wr = at(el, 0.14, 120);
  const pts = { lAn: ankle, lKn: kn, lHip: hip, lSh: sh, lEl: el, lWr: wr };
  for (const [k, v] of Object.entries(pts)) p[L[k]] = v;
  for (const k of ['rAn', 'rKn', 'rHip', 'rSh', 'rEl', 'rWr']) p[L[k]] = { ...pts['l' + k.slice(1)], x: pts['l' + k.slice(1)].x + 0.01, v: 0.4 };
  return p.map((q) => ({ x: q.x + rnd() * noise, y: q.y + rnd() * noise, v: q.v }));
}

function squatVideo() {
  const frames = [];
  const fps = 15;
  // 1초 대기, 6회 반복(각 2.4초), 마지막 2회는 얕고 상체가 숙여짐
  const reps = [[85, 30], [86, 31], [84, 30], [88, 33], [112, 48], [118, 52]];
  let t = 0;
  for (let i = 0; i < fps; i++, t += 1 / fps) frames.push({ t, p: squatFrame(175, 8) });
  for (const [bottom, lean] of reps) {
    const n = Math.round(2.4 * fps);
    for (let i = 0; i < n; i++, t += 1 / fps) {
      const ph = Math.sin(Math.PI * i / n);
      frames.push({ t, p: squatFrame(175 - (175 - bottom) * ph, 8 + (lean - 8) * ph) });
    }
    for (let i = 0; i < 6; i++, t += 1 / fps) frames.push({ t, p: squatFrame(175, 8) });
  }
  // 인식 실패 프레임 일부
  frames[40].p = null; frames[41].p = null;
  return frames;
}

const r = analyzeSet(squatVideo(), 'squat');
console.log('squat view', r.view, 'reps', r.summary.reps, 'breakdown', r.summary.breakdownRep);
console.log(r.reps.map((x) => `${x.n}: depth ${x.m.depth.toFixed(0)} lean ${x.m.lean.toFixed(0)} down ${x.phase1.toFixed(2)}s up ${x.phase2.toFixed(2)}s score ${x.score} ${x.warn.join('/')} ${x.breakdown.join('/')}`).join('\n'));
console.log(r.tips);
assert.equal(r.view, 'side');
assert.equal(r.summary.reps, 6);
assert.equal(r.summary.breakdownRep, 5);
assert.ok(Math.abs(r.reps[0].m.depth - 85) < 6);

// 정면 덤벨 컬: 오른팔이 덜 올라감
function curlFrame(elL, elR) {
  const p = blank();
  const lHip = { x: 0.42, y: 0.75, v: 0.95 }, rHip = { x: 0.58, y: 0.75, v: 0.95 };
  const lSh = { x: 0.38, y: 0.42, v: 0.95 }, rSh = { x: 0.62, y: 0.42, v: 0.95 };
  const lEl = at(lSh, 0.15, 180), rEl = at(rSh, 0.15, 180);
  const lWr = at(lEl, 0.14, 180 - (180 - elL)), rWr = at(rEl, 0.14, 180 - (180 - elR));
  Object.assign(p, { [L.lHip]: lHip, [L.rHip]: rHip, [L.lSh]: lSh, [L.rSh]: rSh, [L.lEl]: lEl, [L.rEl]: rEl, [L.lWr]: lWr, [L.rWr]: rWr,
    [L.lKn]: { x: 0.42, y: 0.88, v: 0.9 }, [L.rKn]: { x: 0.58, y: 0.88, v: 0.9 }, [L.lAn]: { x: 0.42, y: 0.98, v: 0.9 }, [L.rAn]: { x: 0.58, y: 0.98, v: 0.9 } });
  return p.map((q) => ({ x: q.x + rnd() * 0.002, y: q.y + rnd() * 0.002, v: q.v }));
}
const cf = []; let t = 0;
for (let k = 0; k < 8; k++) {
  for (let i = 0; i < 30; i++, t += 1 / 15) {
    const ph = Math.sin(Math.PI * i / 30);
    cf.push({ t, p: curlFrame(170 - 125 * ph, 170 - 95 * ph) });
  }
}
const c = analyzeSet(cf, 'curl');
console.log('curl view', c.view, 'reps', c.summary.reps, 'lrDiff', c.summary.lrDiffAvg.toFixed(1), c.tips);
assert.equal(c.view, 'front');
assert.equal(c.summary.reps, 8);
assert.ok(c.summary.lrDiffAvg > 20);
console.log('OK');

// 측면 푸쉬업: 마지막 2회는 얕게 내려가고 허리가 처짐
function pushFrame(elbow, sag, noise = 0.003) {
  const p = blank();
  const a = 0.15, b = 0.15; // 위팔, 아래팔
  const W = { x: 0.3, y: 0.85, v: 0.95 };
  const d = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(elbow * R));
  const S = { x: W.x, y: W.y - d, v: 0.95 };
  const phi = Math.acos((b * b + d * d - a * a) / (2 * b * d));
  const E = { x: W.x + b * Math.sin(phi), y: W.y - b * Math.cos(phi), v: 0.95 };
  const A = { x: 0.9, y: 0.83, v: 0.95 };
  const H = { x: S.x + (A.x - S.x) * 0.45, y: S.y + (A.y - S.y) * 0.45 + sag, v: 0.95 };
  const K = { x: S.x + (A.x - S.x) * 0.72, y: S.y + (A.y - S.y) * 0.72 + sag * 0.5, v: 0.95 };
  const pts = { lAn: A, lKn: K, lHip: H, lSh: S, lEl: E, lWr: W };
  for (const [k, v] of Object.entries(pts)) p[L[k]] = v;
  for (const k of ['rAn', 'rKn', 'rHip', 'rSh', 'rEl', 'rWr']) p[L[k]] = { ...pts['l' + k.slice(1)], x: pts['l' + k.slice(1)].x + 0.005, v: 0.4 };
  return p.map((q) => ({ x: q.x + rnd() * noise, y: q.y + rnd() * noise, v: q.v }));
}
{
  const frames = []; const fps = 15; let t = 0;
  const reps = [[75, 0], [78, 0], [76, 0], [80, 0.005], [118, 0.07], [122, 0.08]];
  for (let i = 0; i < fps; i++, t += 1 / fps) frames.push({ t, p: pushFrame(172, 0) });
  for (const [bottom, sag] of reps) {
    const n = Math.round(2 * fps);
    for (let i = 0; i < n; i++, t += 1 / fps) {
      const ph = Math.sin(Math.PI * i / n);
      frames.push({ t, p: pushFrame(172 - (172 - bottom) * ph, sag * ph) });
    }
    for (let i = 0; i < 5; i++, t += 1 / fps) frames.push({ t, p: pushFrame(172, 0) });
  }
  const r = analyzeSet(frames, 'pushup');
  console.log('pushup view', r.view, 'reps', r.summary.reps, 'breakdown', r.summary.breakdownRep);
  console.log(r.reps.map((x) => `${x.n}: depth ${x.m.depth.toFixed(0)} sag ${x.m.sag.toFixed(0)}% score ${x.score} ${x.warn.join('/')} ${x.breakdown.join('/')}`).join('\n'));
  assert.equal(r.view, 'side');
  assert.equal(r.summary.reps, 6);
  assert.equal(r.summary.breakdownRep, 5);
  assert.ok(r.reps[5].warn.includes('충분히 내려가지 않음'));
  assert.ok(r.reps[5].warn.includes('허리(엉덩이)가 처짐'));
  assert.ok(r.reps[0].warn.length === 0);
}
console.log('OK pushup');
