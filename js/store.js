/* 저장소 + 파생 데이터 계산. 데이터는 localStorage에만 존재한다 —
 * 백업은 가이드 탭의 JSON 내보내기가 유일한 안전망. */

const Store = (() => {
  const KEY = 'mst.runs.v1';
  const SEED_KEY = 'mst.seeded.v1';
  const BACKUP_KEY = 'mst.lastBackup.v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch { return []; }
  }
  function save(runs) { localStorage.setItem(KEY, JSON.stringify(runs)); }

  function seedIfNeeded() {
    if (localStorage.getItem(SEED_KEY)) return;
    const runs = load();
    if (runs.length === 0) {
      HISTORY.forEach((h, i) => runs.push({ id: 'hist-' + i, planId: null, runWalk: null, shoes: null, ...h }));
      save(runs);
    }
    localStorage.setItem(SEED_KEY, '1');
  }

  function all() { return load().slice().sort((a, b) => a.date.localeCompare(b.date)); }

  function upsert(run) {
    const runs = load();
    const i = runs.findIndex(r => r.id === run.id);
    if (i >= 0) runs[i] = run; else runs.push(run);
    save(runs);
  }
  function remove(id) { save(load().filter(r => r.id !== id)); }
  function byId(id) { return load().find(r => r.id === id) || null; }

  function exportJson() {
    localStorage.setItem(BACKUP_KEY, todayStr());
    return JSON.stringify({ app: 'marathon-survival-tracker', version: 1, exportedAt: new Date().toISOString(), runs: load() }, null, 2);
  }
  function importJson(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data.runs)) throw new Error('runs 배열이 없습니다');
    save(data.runs);
    localStorage.setItem(SEED_KEY, '1');
    return data.runs.length;
  }
  function lastBackup() { return localStorage.getItem(BACKUP_KEY); }

  return { seedIfNeeded, all, upsert, remove, byId, exportJson, importJson, lastBackup };
})();

/* ---------- 날짜/포맷 헬퍼 ---------- */

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) {
  const d = parseDate(s); d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function daysBetween(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function fmtDate(s) { const d = parseDate(s); return (d.getMonth() + 1) + '/' + d.getDate() + ' (' + DOW[d.getDay()] + ')'; }
function fmtDateShort(s) { const d = parseDate(s); return (d.getMonth() + 1) + '/' + d.getDate(); }

function fmtPace(sec) {
  if (sec == null || !isFinite(sec)) return '–';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return m + "'" + String(s).padStart(2, '0') + '"';
}
function fmtDur(sec) {
  if (sec == null || !isFinite(sec)) return '–';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
               : m + ':' + String(s).padStart(2, '0');
}
function paceRange(type) { const t = TYPES[type]; return t ? fmtPace(t.pace[0]) + '~' + fmtPace(t.pace[1]) : ''; }

/* ---------- 플랜 파생 ---------- */

function weekRange(week) { const start = addDays(PLAN_START, (week - 1) * 7); return [start, addDays(start, 6)]; }
function weekOfDate(dateStr) {
  const diff = daysBetween(PLAN_START, dateStr);
  if (diff < 0) return 0;
  const w = Math.floor(diff / 7) + 1;
  return w > TOTAL_WEEKS ? 0 : w;
}
function currentWeek() { return weekOfDate(todayStr()); }

function runForPlan(plan, runs) {
  return runs.find(r => r.planId === plan.id) || runs.find(r => !r.planId && r.date === plan.date) || null;
}
function planStatus(plan, runs) {
  if (runForPlan(plan, runs)) return 'done';
  const today = todayStr();
  if (plan.date < today) return 'missed';
  if (plan.date === today) return 'today';
  return 'upcoming';
}
function nextPlan(runs) {
  const today = todayStr();
  return PLANS.find(p => p.date >= today && !runForPlan(p, runs)) || null;
}

function weeklyStats(runs) {
  const weeks = [];
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const [start, end] = weekRange(w);
    const plans = PLANS.filter(p => p.week === w);
    const wRuns = runs.filter(r => r.date >= start && r.date <= end);
    weeks.push({
      week: w, start, end, plans,
      planKm: plans.reduce((s, p) => s + (p.targetKm || 0), 0),
      actualKm: wRuns.reduce((s, r) => s + (r.distanceKm || 0), 0),
      runs: wRuns,
    });
  }
  return weeks;
}

function adherence(runs) {
  const today = todayStr();
  const due = PLANS.filter(p => p.date <= today && p.targetKm != null);
  if (!due.length) return null;
  const done = due.filter(p => runForPlan(p, runs)).length;
  return { done, due: due.length, pct: Math.round((done / due.length) * 100) };
}

/* ---------- 경고 (통증 신호등 + 놓친 훈련 + 볼륨 급증) ---------- */

function computeWarnings(runs) {
  const out = [];
  const withPain = runs.filter(r => r.shinPain != null);
  const last = withPain[withPain.length - 1];
  if (last && last.shinPain >= 6) {
    out.push({ level: 'critical', icon: '⛔', text: `최근 통증 지수 ${last.shinPain} — 러닝 중단, 2~3일 완전 휴식. 지속되면 진료.` });
  } else if (last && last.shinPain >= 4) {
    out.push({ level: 'warning', icon: '⚠️', text: `최근 통증 지수 ${last.shinPain} — 내일 아침에도 통증이 남으면 다음 훈련은 휴식으로 대체.` });
  } else {
    const recent = withPain.slice(-3);
    if (recent.length === 3 && recent[0].shinPain < recent[1].shinPain && recent[1].shinPain < recent[2].shinPain && recent[2].shinPain >= 3) {
      out.push({ level: 'warning', icon: '⚠️', text: '통증 지수가 3회 연속 상승 중 — 이번 주 볼륨을 줄이는 것을 고려.' });
    }
  }
  const today = todayStr();
  const cw = currentWeek();
  if (cw > 0) {
    const [start] = weekRange(cw);
    const missed = PLANS.filter(p => p.week === cw && p.date >= start && p.date < today && p.targetKm != null && !runForPlan(p, runs));
    if (missed.length) {
      out.push({ level: 'info', icon: 'ℹ️', text: `이번 주 놓친 훈련 ${missed.length}회 — 몰아서 보충하지 말고 다음 훈련부터 계획대로.` });
    }
    const weeks = weeklyStats(runs);
    const prev = weeks[cw - 2], cur = weeks[cw - 1];
    if (prev && cur && prev.actualKm > 10 && cur.actualKm > prev.actualKm * 1.15) {
      out.push({ level: 'warning', icon: '⚠️', text: `이번 주 거리(${cur.actualKm.toFixed(1)}km)가 지난주보다 15% 이상 급증 — 신스프린트 위험 구간.` });
    }
  }
  // 백업 리마인드: 마지막 내보내기 후 14일 경과 시
  const lb = Store.lastBackup();
  const hasOwn = runs.some(r => !r.id.startsWith('hist-'));
  if (hasOwn && (!lb || daysBetween(lb, today) >= 14)) {
    out.push({ level: 'info', icon: '💾', text: '기록 백업(JSON 내보내기)을 한 지 2주가 넘었습니다 — 가이드 탭에서 백업하세요.' });
  }
  return out;
}
