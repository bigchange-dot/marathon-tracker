#!/usr/bin/env node
/* 가민 커넥트 개인 API(Garmin Connect Personal API, 2026-10~)로 러닝 활동 원본(zip)을 받아 docs/garmin/에 저장한다.
 * 가민 커넥트 웹에서 직접 "원본 내보내기"를 받는 것과 같은 파일이다 (download-service, 원본 형식 zip).
 *
 * 키: 프로젝트 루트 .env의 GARMIN_API_KEY (gitignore됨, 채팅·커밋 금지).
 *     키로 액세스 토큰(24시간 유효, 갱신 토큰 없음)을 매번 새로 받아 쓴다 — 토큰은 어디에도 저장하지 않는다.
 *     키 만료(30일~1년)는 가민 커넥트 웹의 Personal API Key 페이지에서 확인·재발급.
 *
 * 사용:
 *   node tools/garmin_fetch.js                         최근 러닝 10개 목록
 *   node tools/garmin_fetch.js 2026-11-12               그 날짜 러닝 원본 받기 (여러 개면 전부)
 *   node tools/garmin_fetch.js 25054832642              활동 ID로 받기
 *   node tools/garmin_fetch.js 2026-11-12 w14-wed easy  받은 뒤 fit_summary.js로 LOG 한 줄까지 (그 날 활동이 하나일 때)
 *
 * 문서: https://developer.garmin.com/gc-developer-program/personal/ (Personal API · FAQ · Swagger Docs)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'garmin');
const BASE = 'https://personal.connectapi.garmin.com';
const SECRETS = [];

const redact = s => SECRETS.reduce((t, x) => (x ? t.split(x).join('***') : t), String(s));
function die(msg) { console.error(redact(msg)); process.exit(1); }

function readKey() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) die('.env가 없습니다 — .env.example을 .env로 복사하고 GARMIN_API_KEY를 넣으세요');
  const m = fs.readFileSync(f, 'utf8').match(/^GARMIN_API_KEY=(.*)$/m);
  const key = m ? m[1].trim().replace(/^(['"])(.*)\1$/, '$2') : '';
  if (!key) die('.env의 GARMIN_API_KEY가 비어 있습니다');
  SECRETS.push(key);
  return key;
}

async function getToken(key) {
  const r = await fetch(`${BASE}/personalapitoken-service/personal-api/personal-api-key/token`, {
    method: 'POST', headers: { Authorization: `ApiKey ${key}` },
  });
  const text = await r.text();
  if (!r.ok) die(`토큰 발급 실패 HTTP ${r.status}: ${text.slice(0, 300)}` +
    (r.status === 401 || r.status === 403 ? '\n키가 만료·삭제됐는지 가민 커넥트 웹 Personal API Key 페이지에서 확인하세요' : ''));
  let token = null;
  let json = null;
  try { json = JSON.parse(text); } catch { /* 문자열 그대로 */ }
  if (json && typeof json === 'object') {
    token = json.access_token || json.accessToken || json.token || null;
    if (!token) die(`토큰 응답 형식을 모릅니다 (필드: ${Object.keys(json).join(', ')})`);
  } else {
    token = (typeof json === 'string' ? json : text).trim();
  }
  SECRETS.push(token);
  return token;
}

async function api(token, p, accept = 'application/json') {
  const r = await fetch(BASE + p, { headers: { Authorization: `Bearer ${token}`, Accept: accept } });
  if (!r.ok) die(`${p} 실패 HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

const fmtDur = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const fmtPace = (sec, m) => (m > 0 ? fmtDur(sec / (m / 1000)).replace(':', "'") + '"' : '-');

async function listRuns(token, { startDate, endDate, limit = 10 } = {}) {
  const q = new URLSearchParams({ start: '0', limit: String(limit), activityType: 'running' });
  if (startDate) q.set('startDate', startDate);
  if (endDate) q.set('endDate', endDate);
  const r = await api(token, `/activitylist-service/activities/search/activities?${q}`);
  return r.json();
}

async function download(token, act) {
  const date = String(act.startTimeLocal || '').slice(0, 10) || 'unknown';
  const file = path.join(OUT_DIR, `${date}_${act.activityId}.zip`);
  if (fs.existsSync(file)) { console.error(`이미 있음: ${path.relative(ROOT, file)}`); return file; }
  const r = await api(token, `/download-service/files/activity/${act.activityId}`, 'application/x-zip-compressed, application/octet-stream');
  const buf = Buffer.from(await r.arrayBuffer());
  if (!(buf[0] === 0x50 && buf[1] === 0x4B)) die(`zip이 아닌 응답 (${buf.length}바이트, 앞부분 ${buf.slice(0, 4).toString('hex')})`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(file, buf);
  console.error(`저장: ${path.relative(ROOT, file)} (${buf.length}바이트)`);
  return file;
}

function printList(acts) {
  if (!acts.length) { console.log('러닝 활동이 없습니다'); return; }
  for (const a of acts) {
    console.log([a.startTimeLocal, a.activityId, `${(a.distance / 1000).toFixed(2)}km`, fmtDur(a.duration || 0),
      fmtPace(a.duration || 0, a.distance || 0), a.averageHR ? `HR ${Math.round(a.averageHR)}` : '', a.activityName || ''].join('  '));
  }
}

(async () => {
  const [target, planId, type] = process.argv.slice(2);
  const token = await getToken(readKey());

  if (!target) { printList(await listRuns(token)); return; }

  let acts;
  if (/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    acts = await listRuns(token, { startDate: target, endDate: target, limit: 20 });
    if (!acts.length) die(`${target}에 러닝 활동이 없습니다 (워치 동기화가 끝났는지 확인)`);
  } else if (/^\d{6,}$/.test(target)) {
    const r = await api(token, `/activity-service/activity/${target}`);
    const a = await r.json();
    acts = [{ activityId: a.activityId || Number(target), startTimeLocal: a.summaryDTO?.startTimeLocal || a.startTimeLocal || '',
      activityName: a.activityName, distance: a.summaryDTO?.distance, duration: a.summaryDTO?.duration }];
  } else {
    die('사용: node tools/garmin_fetch.js [YYYY-MM-DD | 활동ID] [planId] [type]');
  }

  printList(acts);
  const files = [];
  for (const a of acts) files.push(await download(token, a));

  if (planId) {
    if (files.length !== 1) die(`그 날 활동이 ${files.length}개라 LOG 한 줄은 만들지 않았습니다 — 활동 ID로 다시 실행하세요`);
    const res = spawnSync(process.execPath, [path.join(__dirname, 'fit_summary.js'), files[0], planId, ...(type ? [type] : [])], { stdio: 'inherit' });
    process.exit(res.status ?? 1);
  }
})().catch(e => die(e.message));
