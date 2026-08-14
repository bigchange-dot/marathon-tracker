/* ============================================================
 * 마라톤 서바이벌 트래커 — 시드 데이터
 * 2026-11-15 풀코스 완주를 위한 14주(훈련 13주 + 대회주) 플랜.
 * Gemini 초안을 검토·수정한 버전:
 *  - 롱런 피크 32km → 28km (시간 상한 3:30)
 *  - 8~9월 롱런은 새벽 고정 (폭염 회피)
 *  - 5~10주차 토요일 보조 조깅/파워워킹 30~40분 (선택)
 *  - 타입별 페이스 가이드 / 보급 연습 / 통증 신호등 규칙 내장
 * ============================================================ */

const PLAN_START = '2026-08-10'; // 1주차 월요일
const TOTAL_WEEKS = 14;

const RACE = {
  date: '2026-11-15',
  name: '풀코스 마라톤',
  distanceKm: 42.195,
  // 하프 2:14:33(6'22"/km) 기준 예상 완주 4:48~4:55
  targetPaceSec: [410, 420],      // 6'50" ~ 7'00" /km
  targetFinish: '4:48 ~ 4:55',
  cutoffNote: '대회 컷오프(보통 5시간) 반드시 확인 — 예상 기록 대비 여유 10~20분',
};

// 훈련 타입별 목표 페이스 (초/km)
const TYPES = {
  recovery: { label: '회복 조깅',   short: '회복', pace: [450, 480], desc: '대화가 가능한 편안한 속도. 심박 존2.' },
  rhythm:   { label: '리듬 유지주', short: '리듬', pace: [400, 420], desc: '대회 페이스 감각 유지. 마지막 1~2km만 리듬 올리기.' },
  long:     { label: '장거리 (LSD)', short: '롱런', pace: [435, 465], desc: '런워크 병행(예: 4분 달리기/1분 걷기). 거리보다 시간 상한 우선.' },
  easy:     { label: '보조 조깅',   short: '보조', pace: [465, 495], desc: '선택 훈련. 파워워킹 혼합 가능. 통증 지수 3 이상이면 생략.' },
  race:     { label: '대회',        short: '대회', pace: [410, 420], desc: '초반부터 런워크 시작. 후반에 시작하면 늦다.' },
};

/* 14주 스케줄
 * capMin: 시간 상한(분) — 도달하면 거리가 남아도 종료
 * session: 권장 시간대 */
const PLANS = [
  // 1주차 (8/10~8/16) — 엔진 깨우기
  { id: 'w01-sun', week: 1,  date: '2026-08-16', type: 'long',     targetKm: 8,  session: '새벽', note: '첫 롱런. 런워크 필수(3분 달리기/1분 걷기부터).' },
  // 2주차 (8/17~8/23) — 런워크 적응
  { id: 'w02-tue', week: 2,  date: '2026-08-18', type: 'recovery', targetKm: 5,  session: '새벽' },
  { id: 'w02-thu', week: 2,  date: '2026-08-20', type: 'rhythm',   targetKm: 7,  session: '새벽/오후' },
  { id: 'w02-sun', week: 2,  date: '2026-08-23', type: 'long',     targetKm: 10, session: '새벽' },
  // 3주차 (8/24~8/30)
  { id: 'w03-tue', week: 3,  date: '2026-08-25', type: 'recovery', targetKm: 5,  session: '새벽' },
  { id: 'w03-thu', week: 3,  date: '2026-08-27', type: 'rhythm',   targetKm: 7,  session: '새벽/오후' },
  { id: 'w03-sun', week: 3,  date: '2026-08-30', type: 'long',     targetKm: 13, session: '새벽' },
  // 4주차 (8/31~9/6) — 장거리 15km 돌파
  { id: 'w04-tue', week: 4,  date: '2026-09-01', type: 'recovery', targetKm: 6,  session: '새벽' },
  { id: 'w04-thu', week: 4,  date: '2026-09-03', type: 'rhythm',   targetKm: 8,  session: '새벽/오후' },
  { id: 'w04-sun', week: 4,  date: '2026-09-06', type: 'long',     targetKm: 15, session: '새벽' },
  // 5주차 (9/7~9/13) — 본격 LSD + 보급 연습 시작
  { id: 'w05-tue', week: 5,  date: '2026-09-08', type: 'recovery', targetKm: 6,  session: '새벽' },
  { id: 'w05-thu', week: 5,  date: '2026-09-10', type: 'rhythm',   targetKm: 8,  session: '새벽/오후' },
  { id: 'w05-sat', week: 5,  date: '2026-09-12', type: 'easy',     targetKm: null, targetMin: 30, session: '무관', note: '선택. 30분 가벼운 조깅/파워워킹.' },
  { id: 'w05-sun', week: 5,  date: '2026-09-13', type: 'long',     targetKm: 18, session: '새벽', note: '젤 보급 연습 시작(40~45분 간격).' },
  // 6주차 (9/14~9/20)
  { id: 'w06-tue', week: 6,  date: '2026-09-15', type: 'recovery', targetKm: 6,  session: '새벽' },
  { id: 'w06-thu', week: 6,  date: '2026-09-17', type: 'rhythm',   targetKm: 10, session: '새벽/오후' },
  { id: 'w06-sat', week: 6,  date: '2026-09-19', type: 'easy',     targetKm: null, targetMin: 30, session: '무관' },
  { id: 'w06-sun', week: 6,  date: '2026-09-20', type: 'long',     targetKm: 20, session: '새벽' },
  // 7주차 (9/21~9/27) — 하프 거리 초과
  { id: 'w07-tue', week: 7,  date: '2026-09-22', type: 'recovery', targetKm: 7,  session: '새벽' },
  { id: 'w07-thu', week: 7,  date: '2026-09-24', type: 'rhythm',   targetKm: 10, session: '새벽/오후' },
  { id: 'w07-sat', week: 7,  date: '2026-09-26', type: 'easy',     targetKm: null, targetMin: 40, session: '무관' },
  { id: 'w07-sun', week: 7,  date: '2026-09-27', type: 'long',     targetKm: 22, session: '새벽', note: '하프 거리 초과. 무리하면 다음 주가 무너진다.' },
  // 8주차 (9/28~10/4)
  { id: 'w08-tue', week: 8,  date: '2026-09-29', type: 'recovery', targetKm: 7,  session: '새벽' },
  { id: 'w08-thu', week: 8,  date: '2026-10-01', type: 'rhythm',   targetKm: 10, session: '새벽/오후' },
  { id: 'w08-sat', week: 8,  date: '2026-10-03', type: 'easy',     targetKm: null, targetMin: 40, session: '무관' },
  { id: 'w08-sun', week: 8,  date: '2026-10-04', type: 'long',     targetKm: 24, capMin: 180, session: '새벽/오전' },
  // 9주차 (10/5~10/11)
  { id: 'w09-tue', week: 9,  date: '2026-10-06', type: 'recovery', targetKm: 8,  session: '새벽' },
  { id: 'w09-thu', week: 9,  date: '2026-10-08', type: 'rhythm',   targetKm: 12, session: '새벽/오후' },
  { id: 'w09-sat', week: 9,  date: '2026-10-10', type: 'easy',     targetKm: null, targetMin: 40, session: '무관' },
  { id: 'w09-sun', week: 9,  date: '2026-10-11', type: 'long',     targetKm: 26, capMin: 195, session: '새벽/오전', note: '시간 상한 3:15 — 도달하면 거리 남아도 종료.' },
  // 10주차 (10/12~10/18) — 피크 주간
  { id: 'w10-tue', week: 10, date: '2026-10-13', type: 'recovery', targetKm: 8,  session: '새벽' },
  { id: 'w10-thu', week: 10, date: '2026-10-15', type: 'rhythm',   targetKm: 12, session: '새벽/오후' },
  { id: 'w10-sat', week: 10, date: '2026-10-17', type: 'easy',     targetKm: null, targetMin: 40, session: '무관' },
  { id: 'w10-sun', week: 10, date: '2026-10-18', type: 'long',     targetKm: 28, capMin: 210, session: '새벽/오전', note: '피크 롱런 = 대회 리허설. 장비·보급·런워크 전부 대회 세팅으로. 상한 3:30.' },
  // 11주차 (10/19~10/25) — 테이퍼링 시작
  { id: 'w11-tue', week: 11, date: '2026-10-20', type: 'recovery', targetKm: 7,  session: '새벽' },
  { id: 'w11-thu', week: 11, date: '2026-10-22', type: 'rhythm',   targetKm: 10, session: '새벽/오후' },
  { id: 'w11-sun', week: 11, date: '2026-10-25', type: 'long',     targetKm: 20, session: '오전', note: '테이퍼링 시작. 이제 체력은 은행에 있다 — 더 쌓으려 하지 말 것.' },
  // 12주차 (10/26~11/1) — 피로 회복 집중
  { id: 'w12-tue', week: 12, date: '2026-10-27', type: 'recovery', targetKm: 6,  session: '새벽' },
  { id: 'w12-thu', week: 12, date: '2026-10-29', type: 'rhythm',   targetKm: 8,  session: '새벽/오후' },
  { id: 'w12-sun', week: 12, date: '2026-11-01', type: 'long',     targetKm: 15, session: '오전' },
  // 13주차 (11/2~11/8)
  { id: 'w13-tue', week: 13, date: '2026-11-03', type: 'recovery', targetKm: 5,  session: '새벽' },
  { id: 'w13-thu', week: 13, date: '2026-11-05', type: 'rhythm',   targetKm: 5,  session: '새벽/오후' },
  { id: 'w13-sun', week: 13, date: '2026-11-08', type: 'long',     targetKm: 10, session: '오전', note: '마지막 롱런. 대회 페이스로 가볍게.' },
  // 대회주 (11/9~11/15)
  { id: 'w14-tue', week: 14, date: '2026-11-10', type: 'recovery', targetKm: 3,  session: '무관', note: '몸 풀기 수준. 목요일부터 완전 휴식.' },
  { id: 'w14-race', week: 14, date: '2026-11-15', type: 'race',    targetKm: 42.195, session: '오전', note: '풀코스 대회. 초반부터 런워크, 보급 40분 간격.' },
];

const WEEK_NOTES = {
  1: '엔진 깨우기', 2: '런워크 점진 적응', 4: '장거리 15km 돌파', 5: '본격 LSD + 보급 연습',
  7: '하프 거리 초과', 10: '피크 주간 · 대회 리허설', 11: '테이퍼링 시작', 12: '피로 회복 집중', 14: '대회주',
};

// 과거 기록 (첫 실행 시 1회 시드)
const HISTORY = [
  { date: '2026-04-11', type: 'rhythm',   distanceKm: 10.04,   durationSec: 3923, paceSec: 391, avgHr: 166, maxHr: null, cadence: 167, shinPain: null, notes: '주말 점검 — 하프 대비 페이스 훈련' },
  { date: '2026-04-14', type: 'rhythm',   distanceKm: 6.32,    durationSec: null, paceSec: 360, avgHr: 164, maxHr: 183,  cadence: null, shinPain: null, notes: '야간 훈련. 4km 지점 스피드 제어 미스' },
  { date: '2026-04-16', type: 'easy',     distanceKm: 3.31,    durationSec: null, paceSec: 445, avgHr: 155, maxHr: 162,  cadence: 167, shinPain: null, notes: '테이퍼링 주간 리듬 조깅 — 완벽 제어' },
  { date: '2026-04-26', type: 'race',     distanceKm: 21.0975, durationSec: 8073, paceSec: 383, avgHr: null, maxHr: null, cadence: null, shinPain: null, notes: '서울 하프 마라톤 완주 2:14:33 (목표 시간 내)' },
  { date: '2026-07-27', type: 'recovery', distanceKm: 4.5,     durationSec: 1800, paceSec: 400, avgHr: null, maxHr: null, cadence: null, shinPain: 2, runWalk: '3km run / 1min walk', notes: '3개월 만의 러닝 재개' },
];

const PERSONAL_BESTS = [
  { label: '하프',  value: '2:14:33', sub: "6'22\"/km · 2026-04" },
  { label: '10km', value: '59분대',  sub: 'Sub-1 달성' },
];

// 통증 신호등 (정강이 통증 지수 0~10)
const PAIN_RULES = [
  { max: 3,  level: 'good',     title: '0~3 · 진행',   desc: '훈련 계속. 러닝 후 아이싱과 종아리 스트레칭.' },
  { max: 5,  level: 'warning',  title: '4~5 · 주의',   desc: '달리는 중이면 중단·단축. 다음날 아침에도 통증이 남으면 다음 훈련은 휴식/자전거로 대체.' },
  { max: 10, level: 'critical', title: '6+ · 중단',    desc: '러닝 중단, 2~3일 완전 휴식. 통증 0~2로 내려간 뒤 재개. 지속되면 진료.' },
];
