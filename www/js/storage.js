// 기기 내 저장 (localStorage). 서버 전송 없음.
const KEY = 'repcheck.sessions.v1';

function safeRead() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function safeWrite(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

export function listSessions(ex) {
  const all = safeRead().sort((a, b) => b.date - a.date);
  return ex ? all.filter((s) => s.exercise === ex) : all;
}

export function saveSession(report, weight, fileName) {
  const list = safeRead();
  const s = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: Date.now(),
    exercise: report.exercise,
    weight: Number.isFinite(weight) ? weight : null,
    view: report.view,
    fileName: fileName || '',
    summary: report.summary,
    tips: report.tips,
    reps: report.reps.map((r) => ({
      n: r.n, score: r.score, phase1: r.phase1, phase2: r.phase2, liftTime: r.liftTime, lowerTime: r.lowerTime,
      partial: r.partial, m: r.m, warn: r.warn, breakdown: r.breakdown,
    })),
  };
  list.push(s);
  safeWrite(list);
  return s;
}

export function deleteSession(id) { safeWrite(safeRead().filter((s) => s.id !== id)); }
export function clearAll() { try { localStorage.removeItem(KEY); } catch {} }
export function exportJson() { return JSON.stringify(safeRead(), null, 2); }
