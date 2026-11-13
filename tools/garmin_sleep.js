#!/usr/bin/env node
/* 가민 개인 API로 수면 · 야간 HRV를 받아 표로 보여 준다. 화면 출력만 하고 파일로 저장하지 않는다.
 * 수면·HRV는 건강 정보라 공개 저장소에 커밋하지 않는다 — 분석은 대화에서만 (CLAUDE.md).
 *
 * 사용:
 *   node tools/garmin_sleep.js                    최근 14일
 *   node tools/garmin_sleep.js 7                  최근 7일
 *   node tools/garmin_sleep.js 2026-11-01 2026-11-13   기간 (31일씩 나눠 받는다)
 * 날짜는 깬 날 아침 기준 (가민 calendarDate). 기록이 없는 날은 워치를 안 찼거나 동기화가 안 된 날. */
const { die, getToken, api } = require('./garmin_api');

const DAY = 86400000;
const ymd = d => new Date(d).toISOString().slice(0, 10);
const todayLocal = () => { const d = new Date(); return ymd(d.getTime() - d.getTimezoneOffset() * 60000); };
const hm = s => (s == null ? '-' : `${Math.floor(s / 3600)}:${String(Math.round((s % 3600) / 60)).padStart(2, '0')}`);
const clock = ms => (ms ? new Date(ms).toISOString().slice(11, 16) : '-'); // *TimestampLocal은 현지 시각이 박힌 ms

function range(args) {
  if (args.length >= 2) return [args[0], args[1]];
  const days = Number(args[0] || 14);
  if (!(days >= 1)) die('사용: node tools/garmin_sleep.js [일수 | 시작일 종료일]');
  const end = todayLocal();
  return [ymd(Date.parse(end) - (days - 1) * DAY), end];
}

(async () => {
  const [from, to] = range(process.argv.slice(2));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) die(`날짜 범위가 잘못됐습니다: ${from} ~ ${to}`);
  const token = await getToken();

  const sleep = {};
  const hrv = {};
  for (let s = Date.parse(from); s <= Date.parse(to); s += 31 * DAY) {
    const a = ymd(s);
    const b = ymd(Math.min(s + 30 * DAY, Date.parse(to)));
    const sl = await (await api(token, `/sleep-service/sleep/dailySleepSummariesByDate?startDate=${a}&endDate=${b}`)).json();
    (Array.isArray(sl) ? sl : []).forEach(d => { if (d && d.calendarDate) sleep[d.calendarDate] = d; });
    const hv = await (await api(token, `/hrv-service/hrv/daily/${a}/${b}`)).json();
    (hv.hrvSummaries || []).forEach(h => { hrv[h.calendarDate] = h; });
  }

  const rows = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += DAY) {
    const date = ymd(t);
    const d = sleep[date];
    const h = hrv[date] || {};
    if (!d) { rows.push({ 아침: date, 잠듦: '기록 없음' }); continue; }
    rows.push({
      아침: date, 잠듦: clock(d.sleepStartTimestampLocal), 깸: clock(d.sleepEndTimestampLocal),
      수면: hm(d.sleepTimeSeconds), 깊은: hm(d.deepSleepSeconds), 렘: hm(d.remSleepSeconds), 깬시간: hm(d.awakeSleepSeconds),
      점수: d.sleepScores?.overall?.value ?? '-', 수면심박: d.avgHeartRate != null ? Math.round(d.avgHeartRate) : '-',
      HRV: h.lastNightAvg ?? '-', HRV주평균: h.weeklyAvg ?? '-', HRV상태: h.status ?? '-',
    });
  }
  console.table(rows);
})().catch(e => die(e.message));
