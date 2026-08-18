/* 화면 렌더링 + 입력 폼. 탭 전환 시마다 해당 뷰를 다시 그린다. */

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

let statsFilter = 'all'; // all | long | rhythm | easyrec | race

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------- 오늘 ---------- */

function renderToday() {
  const root = $('#view-today');
  root.replaceChildren();
  const runs = Store.all();
  const today = todayStr();
  const dday = daysBetween(today, RACE.date);

  // 경고 배너
  computeWarnings(runs).forEach(w => {
    const b = h('div', 'banner banner-' + w.level);
    b.append(h('span', 'banner-icon', w.icon), h('span', null, w.text));
    root.appendChild(b);
  });

  // D-day 히어로
  const hero = h('section', 'card hero-card');
  hero.appendChild(h('div', 'hero-label', RACE.name + ' · ' + fmtDate(RACE.date)));
  hero.appendChild(h('div', 'hero-num', dday > 0 ? 'D-' + dday : dday === 0 ? 'D-DAY' : '완주!'));
  hero.appendChild(h('div', 'hero-sub', `목표 ${RACE.targetFinish} (${fmtPace(RACE.targetPaceSec[0])}~${fmtPace(RACE.targetPaceSec[1])}/km) · 컷오프 5:00`));
  root.appendChild(hero);

  // 이번 주 진행
  const cw = currentWeek();
  const ad = adherence(runs);
  const wkCard = h('section', 'card');
  if (cw > 0) {
    const wk = weeklyStats(runs)[cw - 1];
    const title = h('div', 'card-title', `${cw}주차 / ${TOTAL_WEEKS}주` + (WEEK_NOTES[cw] ? ' · ' + WEEK_NOTES[cw] : ''));
    wkCard.appendChild(title);
    const duePlans = wk.plans.filter(p => p.targetKm != null);
    const doneCnt = duePlans.filter(p => runForPlan(p, runs)).length;
    const bar = h('div', 'progress');
    const fill = h('div', 'progress-fill');
    fill.style.width = (duePlans.length ? (doneCnt / duePlans.length) * 100 : 0) + '%';
    bar.appendChild(fill);
    wkCard.appendChild(bar);
    const line = h('div', 'muted-line', `이번 주 훈련 ${doneCnt}/${duePlans.length} · ${wk.actualKm.toFixed(1)}km / 계획 ${wk.planKm}km` + (ad ? ` · 전체 달성률 ${ad.pct}%` : ''));
    wkCard.appendChild(line);
  } else {
    wkCard.appendChild(h('div', 'muted-line', '플랜 기간(8/10~11/15) 밖입니다.'));
  }
  root.appendChild(wkCard);

  // 다음 훈련
  const np = nextPlan(runs);
  const nCard = h('section', 'card next-card');
  nCard.appendChild(h('div', 'card-title', np && np.date === today ? '오늘의 훈련' : '다음 훈련'));
  if (np) {
    const t = TYPES[np.type];
    const head = h('div', 'next-head');
    head.appendChild(h('span', 'chip chip-' + np.type, t.label));
    head.appendChild(h('span', 'next-date', fmtDate(np.date) + ' · ' + np.session));
    nCard.appendChild(head);
    const target = np.targetKm != null ? np.targetKm + 'km' : (np.targetMin ? np.targetMin + '분' : '');
    nCard.appendChild(h('div', 'next-target', target + (np.capMin ? ` (상한 ${Math.floor(np.capMin / 60)}:${String(np.capMin % 60).padStart(2, '0')})` : '')));
    nCard.appendChild(h('div', 'muted-line', '목표 페이스 ' + paceRange(np.type) + '/km — ' + t.desc));
    if (np.note) nCard.appendChild(h('div', 'note-line', '📌 ' + np.note));
    const btn = h('button', 'btn btn-primary', '이 훈련 기록하기');
    btn.addEventListener('click', () => openRecord({ planId: np.id }));
    nCard.appendChild(btn);
  } else {
    nCard.appendChild(h('div', 'muted-line', '남은 계획 훈련이 없습니다.'));
  }
  const freeBtn = h('button', 'btn btn-ghost', '+ 자유 기록 추가');
  freeBtn.addEventListener('click', () => openRecord({}));
  nCard.appendChild(freeBtn);
  root.appendChild(nCard);

  // 최근 기록 3개 — 앱으로 입력한 기록만 (시드 과거 기록 제외)
  const recent = runs.filter(isAppRun).slice(-3).reverse();
  if (recent.length) {
    const rc = h('section', 'card');
    rc.appendChild(h('div', 'card-title', '최근 기록'));
    recent.forEach(r => rc.appendChild(runRow(r)));
    root.appendChild(rc);
  }
}

function runRow(r) {
  const row = h('button', 'run-row');
  const t = TYPES[r.type];
  row.appendChild(h('span', 'chip chip-' + r.type, t ? t.short : r.type));
  const mid = h('span', 'run-mid');
  mid.appendChild(h('span', 'run-date', fmtDate(r.date)));
  const pace = r.paceSec != null ? r.paceSec : (r.durationSec && r.distanceKm ? r.durationSec / r.distanceKm : null);
  mid.appendChild(h('span', 'run-detail', r.distanceKm.toFixed(1) + 'km · ' + fmtPace(pace) + '/km' + (r.shinPain != null ? ' · 통증 ' + r.shinPain : '')));
  row.appendChild(mid);
  row.appendChild(h('span', 'run-arrow', '›'));
  row.addEventListener('click', () => openRecord({ runId: r.id }));
  return row;
}

/* ---------- 캘린더 ---------- */

function renderCalendar() {
  const root = $('#view-calendar');
  root.replaceChildren();
  const runs = Store.all();
  const cw = currentWeek();
  const weeks = weeklyStats(runs);

  // 전체 진척도 — 플랜 기간 내 실행 누적 vs 계획 누적
  const today = todayStr();
  const actualKm = runs.filter(r => r.date >= PLAN_START).reduce((s, r) => s + (r.distanceKm || 0), 0);
  const planToDateKm = PLANS.filter(p => p.targetKm != null && p.date <= today).reduce((s, p) => s + p.targetKm, 0);
  const planTotalKm = PLANS.reduce((s, p) => s + (p.targetKm || 0), 0);
  const pg = h('section', 'card');
  pg.appendChild(h('div', 'card-title', '전체 진척도'));
  const pgBar = h('div', 'progress');
  const pgFill = h('div', 'progress-fill');
  pgFill.style.width = Math.min(100, planTotalKm ? actualKm / planTotalKm * 100 : 0) + '%';
  pgBar.appendChild(pgFill);
  if (planTotalKm > 0 && planToDateKm > 0) {
    const mark = h('div', 'progress-marker');
    mark.style.left = Math.min(100, planToDateKm / planTotalKm * 100) + '%';
    pgBar.appendChild(mark);
  }
  pg.appendChild(pgBar);
  const pgRow = h('div', 'stat-row');
  [['누적 실행', actualKm.toFixed(1) + 'km'],
   ['오늘까지 계획', Math.round(planToDateKm) + 'km'],
   ['전체 계획', Math.round(planTotalKm) + 'km']].forEach(([label, value]) => {
    const tile = h('div', 'stat-tile');
    tile.append(h('div', 'stat-label', label), h('div', 'stat-value', value));
    pgRow.appendChild(tile);
  });
  pg.appendChild(pgRow);
  if (planToDateKm > 0) pg.appendChild(h('div', 'muted-line', `오늘까지 계획 대비 ${Math.round(actualKm / planToDateKm * 100)}% · 막대의 세로선 = 오늘 계획 지점`));
  root.appendChild(pg);

  root.appendChild(h('p', 'view-note', '월·수·금은 휴식 + 하체·종아리 보강(카프 레이즈 등). 놓친 훈련은 건너뛰고 다음 훈련부터 계획대로.'));

  weeks.forEach(wk => {
    const sec = h('section', 'card week-card' + (wk.week === cw ? ' week-now' : ''));
    const head = h('div', 'week-head');
    head.appendChild(h('span', 'week-title', `${wk.week}주차 · ${fmtDateShort(wk.start)}~${fmtDateShort(wk.end)}`));
    head.appendChild(h('span', 'week-km', (wk.actualKm ? wk.actualKm.toFixed(1) + ' / ' : '') + wk.planKm + 'km'));
    sec.appendChild(head);
    if (WEEK_NOTES[wk.week]) sec.appendChild(h('div', 'week-note', WEEK_NOTES[wk.week]));

    wk.plans.forEach(p => {
      const st = planStatus(p, runs);
      const run = runForPlan(p, runs);
      const row = h('button', 'plan-row plan-' + st);
      row.appendChild(h('span', 'plan-date', fmtDate(p.date)));
      row.appendChild(h('span', 'chip chip-' + p.type, TYPES[p.type].short));
      const target = p.targetKm != null ? p.targetKm + 'km' : p.targetMin + '분';
      row.appendChild(h('span', 'plan-target', target));
      let doneLabel = '완료';
      if (run) {
        const pace = run.paceSec != null ? run.paceSec : (run.durationSec && run.distanceKm ? run.durationSec / run.distanceKm : null);
        doneLabel = run.distanceKm.toFixed(1) + 'km' + (pace ? ' (' + fmtPace(pace) + ')' : '');
      }
      const badge = { done: '✓ ' + doneLabel, missed: '놓침', today: '오늘', upcoming: '' }[st];
      row.appendChild(h('span', 'plan-badge badge-' + st, badge));
      row.addEventListener('click', () => run ? openRecord({ runId: run.id }) : openRecord({ planId: p.id }));
      sec.appendChild(row);
    });
    root.appendChild(sec);
  });
  // 현재 주차로 스크롤
  const now = root.querySelector('.week-now');
  if (now) requestAnimationFrame(() => now.scrollIntoView({ block: 'start', behavior: 'instant' }));
}

/* ---------- 통계 ---------- */

function filterRuns(runs) {
  if (statsFilter === 'all') return runs;
  if (statsFilter === 'easyrec') return runs.filter(r => r.type === 'easy' || r.type === 'recovery');
  return runs.filter(r => r.type === statsFilter);
}
function filterPlansType(p) {
  if (statsFilter === 'all') return true;
  if (statsFilter === 'easyrec') return p.type === 'easy' || p.type === 'recovery';
  return p.type === statsFilter;
}

function renderStats() {
  const root = $('#view-stats');
  root.replaceChildren();
  const allRuns = Store.all().filter(isAppRun); // 시드된 과거 기록 제외
  const runs = filterRuns(allRuns);

  // 필터 행 — 아래 모든 차트/표를 스코프
  const fRow = h('div', 'filter-row');
  [['all', '전체'], ['long', '롱런'], ['rhythm', '리듬'], ['easyrec', '회복·보조'], ['race', '대회']].forEach(([key, label]) => {
    const b = h('button', 'filter-chip' + (statsFilter === key ? ' on' : ''), label);
    b.addEventListener('click', () => { statsFilter = key; renderStats(); });
    fRow.appendChild(b);
  });
  root.appendChild(fRow);

  // KPI 타일
  const totalKm = runs.reduce((s, r) => s + r.distanceKm, 0);
  const ad = adherence(allRuns);
  const cw = currentWeek();
  const wkKm = cw > 0 ? weeklyStats(runs)[cw - 1].actualKm : 0;
  const lastPain = [...allRuns].reverse().find(r => r.shinPain != null);
  const kpis = [
    ['총 거리', totalKm.toFixed(1) + 'km'],
    ['플랜 달성률', ad ? ad.pct + '%' : '–'],
    ['이번 주', wkKm.toFixed(1) + 'km'],
    ['최근 통증', lastPain ? lastPain.shinPain + '/10' : '–'],
  ];
  const kRow = h('div', 'kpi-row');
  kpis.forEach(([label, value]) => {
    const t = h('div', 'kpi-tile');
    t.append(h('div', 'kpi-label', label), h('div', 'kpi-value', value));
    kRow.appendChild(t);
  });
  root.appendChild(kRow);

  // 주간 거리 (계획 vs 실적)
  const c1 = h('section', 'card chart-card');
  c1.appendChild(h('div', 'card-title', '주간 거리 — 계획 vs 실적'));
  const cc1 = h('div', 'chart-box'); c1.appendChild(cc1); root.appendChild(c1);
  const weeks = weeklyStats(runs).map(w => ({ ...w, planKm: w.plans.filter(filterPlansType).reduce((s, p) => s + (p.targetKm || 0), 0) }));
  Charts.weekly(cc1, weeks);

  // 페이스 추이
  const c2 = h('section', 'card chart-card');
  c2.appendChild(h('div', 'card-title', '페이스 추이 (위쪽이 빠름)'));
  const cc2 = h('div', 'chart-box'); c2.appendChild(cc2); root.appendChild(c2);
  Charts.pace(cc2, runs);

  // 통증 추이
  const c3 = h('section', 'card chart-card');
  c3.appendChild(h('div', 'card-title', '정강이 통증 추이'));
  const cc3 = h('div', 'chart-box'); c3.appendChild(cc3); root.appendChild(c3);
  Charts.pain(cc3, runs);

  // 테이블 뷰 (차트의 접근성 트윈)
  const tCard = h('section', 'card');
  tCard.appendChild(h('div', 'card-title', '기록 목록'));
  if (!runs.length) tCard.appendChild(h('div', 'muted-line', '기록이 없습니다.'));
  else {
    const wrap = h('div', 'table-wrap');
    const table = h('table', 'run-table');
    const thead = h('thead'); const trh = h('tr');
    ['날짜', '타입', '거리', '시간', '페이스', '심박', '통증'].forEach(c => trh.appendChild(h('th', null, c)));
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = h('tbody');
    [...runs].reverse().forEach(r => {
      const tr = h('tr');
      tr.appendChild(h('td', null, fmtDateShort(r.date)));
      tr.appendChild(h('td', null, TYPES[r.type] ? TYPES[r.type].short : r.type));
      tr.appendChild(h('td', 'num', r.distanceKm.toFixed(1)));
      tr.appendChild(h('td', 'num', fmtDur(r.durationSec)));
      const pace = r.paceSec != null ? r.paceSec : (r.durationSec && r.distanceKm ? r.durationSec / r.distanceKm : null);
      tr.appendChild(h('td', 'num', fmtPace(pace)));
      tr.appendChild(h('td', 'num', r.avgHr != null ? String(r.avgHr) : '–'));
      tr.appendChild(h('td', 'num', r.shinPain != null ? String(r.shinPain) : '–'));
      tr.addEventListener('click', () => openRecord({ runId: r.id }));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    tCard.appendChild(wrap);
  }
  root.appendChild(tCard);
}

/* ---------- 가이드 ---------- */

function renderGuide() {
  const root = $('#view-guide');
  root.replaceChildren();

  const strat = h('section', 'card');
  strat.appendChild(h('div', 'card-title', '🏁 대회 전략'));
  [
    `목표: ${RACE.targetFinish} 완주 (${fmtPace(RACE.targetPaceSec[0])}~${fmtPace(RACE.targetPaceSec[1])}/km)`,
    RACE.cutoffNote,
    `초반 10km는 6'55" 고정 — 6'45"보다 빠르면 오버페이스.`,
    `30km를 3:28 이내에 통과하면 이후 7'30"대로 느려져도 완주 가능. 이 시계가 레이스의 전부.`,
    '컷오프가 건타임(출발 총성) 기준일 수 있음 — 출발 그룹 앞쪽에 서고, 구간 관문(중간 컷오프)은 대회 요강 확인.',
    '런워크는 초반 1km부터 시작. 지쳐서 시작하는 걷기는 회복이 아니라 후퇴.',
    '보급: 젤 40~45분 간격(레이스 중 4~5개), 급수는 매 급수대에서 소량.',
  ].forEach(s => strat.appendChild(h('div', 'guide-line', '· ' + s)));
  // 구간별 통과 목표 — 대회 중 시계 체크용
  const sWrap = h('div', 'table-wrap');
  const sTable = h('table', 'run-table');
  const sTrh = h('tr');
  ['구간', '목표 통과', '컷오프 한계'].forEach(c => sTrh.appendChild(h('th', null, c)));
  const sThead = h('thead'); sThead.appendChild(sTrh); sTable.appendChild(sThead);
  const sTbody = h('tbody');
  RACE.splits.forEach(s => {
    const tr = h('tr');
    tr.appendChild(h('td', null, s.point));
    tr.appendChild(h('td', 'num', s.target));
    tr.appendChild(h('td', 'num', s.limit));
    sTbody.appendChild(tr);
  });
  sTable.appendChild(sTbody); sWrap.appendChild(sTable);
  strat.appendChild(sWrap);
  strat.appendChild(h('div', 'muted-line', `목표는 6'55"/km, 한계는 7'07"/km 기준. 한계열보다 뒤면 걷기 구간을 줄여야 한다.`));
  root.appendChild(strat);

  const paceCard = h('section', 'card');
  paceCard.appendChild(h('div', 'card-title', '⏱ 타입별 페이스 가이드'));
  const wrap = h('div', 'table-wrap');
  const table = h('table', 'run-table');
  const trh = h('tr');
  ['타입', '페이스', '설명'].forEach(c => trh.appendChild(h('th', null, c)));
  const thead = h('thead'); thead.appendChild(trh); table.appendChild(thead);
  const tbody = h('tbody');
  Object.entries(TYPES).forEach(([, t]) => {
    const tr = h('tr');
    tr.appendChild(h('td', null, t.label));
    tr.appendChild(h('td', 'num', fmtPace(t.pace[0]) + '~' + fmtPace(t.pace[1])));
    tr.appendChild(h('td', null, t.desc));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); wrap.appendChild(table); paceCard.appendChild(wrap);
  root.appendChild(paceCard);

  const painCard = h('section', 'card');
  painCard.appendChild(h('div', 'card-title', '🚦 정강이 통증 신호등'));
  PAIN_RULES.forEach(r => {
    const row = h('div', 'pain-rule pain-' + r.level);
    row.append(h('div', 'pain-title', r.title), h('div', 'pain-desc', r.desc));
    painCard.appendChild(row);
  });
  painCard.appendChild(h('div', 'muted-line', '기록 입력 시 통증 지수를 남기면 앱이 자동으로 경고합니다.'));
  root.appendChild(painCard);

  const str = h('section', 'card');
  str.appendChild(h('div', 'card-title', '💪 휴식일 보강 (신스프린트 예방)'));
  ['카프 레이즈 3×15 (양발→한발 진행)', '티비알리스 레이즈(정강이 앞) 3×15', '한발 밸런스 30초×3', '힙 브릿지 3×12', '러닝 후 종아리 폼롤러 + 아이싱 10분']
    .forEach(s => str.appendChild(h('div', 'guide-line', '· ' + s)));
  root.appendChild(str);

  // 데이터 관리
  const data = h('section', 'card');
  data.appendChild(h('div', 'card-title', '💾 데이터 관리'));
  const lb = Store.lastBackup();
  data.appendChild(h('div', 'muted-line', '기록은 이 브라우저에만 저장됩니다. 주 1회 JSON 백업을 권장합니다.' + (lb ? ` (마지막 백업: ${lb})` : ' (아직 백업 없음)')));
  const btnRow = h('div', 'btn-row');
  const exp = h('button', 'btn btn-primary', 'JSON 내보내기');
  exp.addEventListener('click', () => {
    const blob = new Blob([Store.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'running-log-' + todayStr() + '.json';
    a.click(); URL.revokeObjectURL(a.href);
    toast('백업 파일을 내려받았습니다');
    renderGuide();
  });
  const impLabel = h('label', 'btn btn-ghost', 'JSON 가져오기');
  const impInput = document.createElement('input');
  impInput.type = 'file'; impInput.accept = '.json,application/json'; impInput.hidden = true;
  impInput.addEventListener('change', async () => {
    const f = impInput.files[0]; if (!f) return;
    try {
      const n = Store.importJson(await f.text());
      toast(n + '개 기록을 가져왔습니다'); renderAll();
    } catch (e) { toast('가져오기 실패: ' + e.message); }
    impInput.value = '';
  });
  impLabel.appendChild(impInput);
  btnRow.append(exp, impLabel);
  data.appendChild(btnRow);
  root.appendChild(data);

  const about = h('section', 'card');
  about.appendChild(h('div', 'card-title', 'ℹ️ 사용 팁'));
  ['폰 브라우저 메뉴에서 "홈 화면에 추가"하면 앱처럼 쓸 수 있습니다.',
   '캘린더에서 훈련을 누르면 바로 기록할 수 있고, 완료된 기록을 누르면 수정됩니다.',
   '통계 탭 상단 필터는 아래 모든 차트와 표에 동시에 적용됩니다.']
    .forEach(s => about.appendChild(h('div', 'guide-line', '· ' + s)));
  root.appendChild(about);
}

/* ---------- 기록 다이얼로그 ---------- */

function openRecord({ planId, runId }) {
  const dlg = $('#record-dialog');
  const form = $('#record-form');
  form.reset();
  $('#f-id').value = ''; $('#f-plan').value = '';
  $('#f-delete').hidden = true;
  $('#pain-out').textContent = '0';

  if (runId) {
    const r = Store.byId(runId);
    if (!r) return;
    $('#record-title').textContent = '기록 수정';
    $('#f-id').value = r.id;
    $('#f-plan').value = r.planId || '';
    $('#f-date').value = r.date;
    $('#f-type').value = r.type;
    $('#f-dist').value = r.distanceKm;
    if (r.durationSec != null) {
      $('#f-dh').value = Math.floor(r.durationSec / 3600) || '';
      $('#f-dm').value = Math.floor((r.durationSec % 3600) / 60);
      $('#f-ds').value = Math.round(r.durationSec % 60);
    }
    $('#f-hr').value = r.avgHr ?? ''; $('#f-maxhr').value = r.maxHr ?? '';
    $('#f-cad').value = r.cadence ?? '';
    $('#f-runwalk').value = r.runWalk ?? '';
    $('#f-pain').value = r.shinPain ?? 0; $('#pain-out').textContent = r.shinPain ?? 0;
    $('#f-shoes').value = r.shoes ?? ''; $('#f-notes').value = r.notes ?? '';
    $('#f-delete').hidden = false;
  } else {
    $('#record-title').textContent = '러닝 기록';
    const plan = planId ? PLANS.find(p => p.id === planId) : null;
    $('#f-date').value = plan ? plan.date : todayStr();
    $('#f-type').value = plan ? plan.type : 'recovery';
    if (plan) { $('#f-plan').value = plan.id; if (plan.targetKm) $('#f-dist').value = plan.targetKm; }
  }
  updatePacePreview();
  dlg.showModal();
}

function updatePacePreview() {
  const dist = parseFloat($('#f-dist').value);
  const sec = (parseInt($('#f-dh').value) || 0) * 3600 + (parseInt($('#f-dm').value) || 0) * 60 + (parseInt($('#f-ds').value) || 0);
  $('#pace-preview').textContent = dist > 0 && sec > 0 ? '평균 페이스 ' + fmtPace(sec / dist) + '/km' : '';
}

function setupDialog() {
  const dlg = $('#record-dialog');
  ['#f-dist', '#f-dh', '#f-dm', '#f-ds'].forEach(s => $(s).addEventListener('input', updatePacePreview));
  $('#f-pain').addEventListener('input', () => $('#pain-out').textContent = $('#f-pain').value);
  $('#f-cancel').addEventListener('click', () => dlg.close());
  $('#f-delete').addEventListener('click', () => {
    if (!confirm('이 기록을 삭제할까요?')) return;
    Store.remove($('#f-id').value);
    dlg.close(); renderAll(); toast('기록을 삭제했습니다');
  });
  $('#record-form').addEventListener('submit', e => {
    e.preventDefault();
    const dist = parseFloat($('#f-dist').value);
    if (!(dist > 0)) { toast('거리를 입력하세요'); return; }
    const sec = (parseInt($('#f-dh').value) || 0) * 3600 + (parseInt($('#f-dm').value) || 0) * 60 + (parseInt($('#f-ds').value) || 0);
    const run = {
      id: $('#f-id').value || 'r' + Date.now(),
      planId: $('#f-plan').value || null,
      date: $('#f-date').value,
      type: $('#f-type').value,
      distanceKm: dist,
      durationSec: sec > 0 ? sec : null,
      paceSec: sec > 0 ? Math.round(sec / dist) : null,
      avgHr: parseInt($('#f-hr').value) || null,
      maxHr: parseInt($('#f-maxhr').value) || null,
      cadence: parseInt($('#f-cad').value) || null,
      runWalk: $('#f-runwalk').value.trim() || null,
      shinPain: $('#f-pain').value === '' ? null : parseInt($('#f-pain').value),
      shoes: $('#f-shoes').value.trim() || null,
      notes: $('#f-notes').value.trim() || null,
    };
    Store.upsert(run);
    dlg.close(); renderAll();
    toast(run.shinPain >= 6 ? '기록 저장 — 통증 6+, 휴식이 훈련입니다' : '기록을 저장했습니다 🏃');
  });
}

/* ---------- 탭 / 초기화 ---------- */

const VIEWS = { today: renderToday, calendar: renderCalendar, stats: renderStats, guide: renderGuide };
let activeView = 'today';

function switchView(name) {
  activeView = name;
  $$('.view').forEach(v => v.hidden = v.id !== 'view-' + name);
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.view === name));
  VIEWS[name]();
  window.scrollTo(0, 0);
}
function renderAll() { VIEWS[activeView](); }

document.addEventListener('DOMContentLoaded', () => {
  Store.seedIfNeeded();
  setupDialog();
  $$('.tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
  switchView('today');
  let rT;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (activeView === 'stats') renderStats(); }, 200); });
  // SW 등록 + 자동 업데이트: 새 버전이 활성화되면 화면을 자동으로 다시 불러온다.
  // (설치형 PWA는 새로고침 버튼이 없어 이 처리가 없으면 옛 화면이 계속 남는다)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      // 백그라운드에 있다가 앱으로 돌아올 때마다 새 버전 확인
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) reg.update().catch(() => {});
      });
    }).catch(() => {});
    let hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; return; } // 최초 설치는 리로드 불필요
      if (reloaded) return;
      if ($('#record-dialog').open) { toast('새 버전 준비됨 — 다음 실행 시 적용됩니다'); return; }
      reloaded = true;
      location.reload();
    });
  }
});
