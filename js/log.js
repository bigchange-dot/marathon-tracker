/* ============================================================
 * 세션 기록 — Claude Code 세션에서 입력한 훈련 기록 (가민 FIT → tools/fit_summary.js)
 * 배포되면 폰 앱에 자동으로 합쳐진다 (Store.all). 폰에 같은 계획(planId)의 기록이 이미 있으면 폰 기록이 우선.
 * 공개 저장소 — 수치만 넣는다. 통증 지수·메모(증상)는 넣지 않는다.
 * ============================================================ */

const LOG = [
  // 10/6 신호 대기 2회가 걷기로 잡혀 런워크 오탐 → 계속 달리기로 정정
  {"id":"log-2026-10-06-w08-mon","planId":"w08-mon","date":"2026-10-06","type":"long","distanceKm":12.04,"durationSec":5245,"paceSec":436,"avgHr":150,"maxHr":163,"cadence":174,"runWalk":null,"shoes":null},
  {"id":"log-2026-10-09-w09-fri","planId":"w09-fri","date":"2026-10-09","type":"rhythm","distanceKm":7.27,"durationSec":2964,"paceSec":408,"avgHr":157,"maxHr":171,"cadence":172,"runWalk":null,"shoes":null},
  {"id":"log-2026-10-12-w09-mon","planId":"w09-mon","date":"2026-10-12","type":"long","distanceKm":16.02,"durationSec":6927,"paceSec":432,"avgHr":147,"maxHr":165,"cadence":179,"runWalk":"9분 / 1분","shoes":null},
  {"id":"log-2026-10-17-w10-fri","planId":"w10-fri","date":"2026-10-17","type":"recovery","distanceKm":3.67,"durationSec":1532,"paceSec":418,"avgHr":151,"maxHr":168,"cadence":168,"runWalk":null,"shoes":null},
  {"id":"log-2026-10-19-w10-sun","planId":"w10-sun","date":"2026-10-19","type":"steady","distanceKm":7.03,"durationSec":2746,"paceSec":391,"avgHr":156,"maxHr":170,"cadence":170,"runWalk":null,"shoes":null},
  {"id":"log-2026-10-21-w10-mon","planId":"w10-mon","date":"2026-10-21","type":"long","distanceKm":10.21,"durationSec":4199,"paceSec":411,"avgHr":153,"maxHr":164,"cadence":174,"runWalk":null,"shoes":null},
  {"id":"log-2026-10-23-w11-fri","planId":"w11-fri","date":"2026-10-23","type":"easy","distanceKm":8.02,"durationSec":3146,"paceSec":392,"avgHr":154,"maxHr":168,"cadence":178,"runWalk":null,"shoes":null},
];
