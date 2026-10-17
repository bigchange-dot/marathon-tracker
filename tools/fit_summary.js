#!/usr/bin/env node
/* 가민 원본 내보내기(.zip/.fit) → js/log.js에 넣을 기록 한 줄.
 * 앱의 js/fit.js(FIT.readFile)를 그대로 써서 폰 앱의 "가민 FIT 불러오기"와 같은 값이 나온다.
 * 사용: node tools/fit_summary.js <파일> [planId] [type]
 *   런워크가 감지되면 케이던스는 달리기 구간만 (앱과 같은 규칙). 메모·통증은 넣지 않는다 (공개 저장소). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const [file, planId = null, type = null] = process.argv.slice(2);
if (!file) { console.error('사용: node tools/fit_summary.js <파일.zip|.fit> [planId] [type]'); process.exit(1); }

const ctx = vm.createContext({ DecompressionStream, Blob, Response, Uint8Array, DataView, TextDecoder, Date, Math, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/fit.js'), 'utf8') + '\nthis.FIT = FIT;', ctx);

(async () => {
  const buf = fs.readFileSync(file);
  const r = await ctx.FIT.readFile({ arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
  const ro = r.runOnly;
  const entry = {
    id: 'log-' + r.date + (planId ? '-' + planId : ''),
    planId, date: r.date, type,
    distanceKm: Math.round(r.distanceKm * 100) / 100,
    durationSec: r.durationSec,
    paceSec: Math.round(r.durationSec / r.distanceKm),
    avgHr: r.avgHr, maxHr: r.maxHr,
    cadence: ro ? ro.cadence : r.cadence,
    runWalk: r.runWalk, shoes: null,
  };
  console.log(JSON.stringify(entry) + ',');
  if (ro) console.error(`런워크 감지: 걷기 ${r.walkCount}회, 달리기 구간 페이스 ${Math.round(ro.paceSec)}초/km, 전체 케이던스 ${r.cadence}`);
  console.error('시작', r.start.toString());
})().catch(e => { console.error(e.message); process.exit(1); });
