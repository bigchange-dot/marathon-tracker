/* 가민 커넥트 개인 API(Garmin Connect Personal API) 공통 — 키 읽기 · 토큰 발급 · 요청.
 * 키: 프로젝트 루트 .env의 GARMIN_API_KEY (gitignore됨, 채팅·커밋 금지).
 * 키로 액세스 토큰(24시간 유효, 갱신 토큰 없음)을 매번 새로 받는다 — 토큰은 어디에도 저장하지 않는다.
 * 문서: https://developer.garmin.com/gc-developer-program/personal/ (Personal API · FAQ · Swagger Docs)
 * Node 18+ 필요 (내장 fetch). */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
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

/* 응답은 JWT 문자열 그대로 온다(2026-11-13 확인). JSON으로 바뀌어도 받게 해 둔다 */
async function getToken(key = readKey()) {
  if (typeof fetch !== 'function') die(`Node 18 이상이 필요합니다 (현재 ${process.version})`);
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

module.exports = { ROOT, BASE, redact, die, readKey, getToken, api };
