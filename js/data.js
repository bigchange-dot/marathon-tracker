/* ============================================================
 * 마라톤 서바이벌 트래커 — 시드 데이터
 * 2026-11-15 풀코스 완주를 위한 14주(훈련 13주 + 대회주) 플랜.
 *
 * Gemini 초안 → 1차 검토(롱런 피크 32km→28km, 폭염 대응, 통증 신호등)
 *            → 2차 검토(2026-08-24, 3주차 시점) 반영:
 *  - 감량주 도입: 6·9주차 (기존엔 10주 연속 단조 증가 — 최대 결함)
 *  - 롱런 후반 20~25%를 대회 페이스로 (6주차~). 30km 미경험을 이걸로 보완
 *  - 목요일을 빌드업 / 지속주 / 크루즈 인터벌로 로테이션 (9월 중순~)
 *  - 주3회 → 4회: 토요일 보조 조깅을 6주차부터 필수로 전환 (빈도 = 경골 적응)
 *  - 화요일 8→10km 증량은 9주차 감량주에 얹음 (총부하 증가 없이 전환)
 *  - 대회주 완전휴식 4일 → 목 3km · 토 셰이크아웃으로 교체
 *  - 3주차 화요일 회복주 삭제 (8/23 롱런이 8/24로 이월된 데 따른 조정)
 * 3차 검토(2026-08-27): 10/18 리허설에 목표 하향 점검 기준 추가
 *  - 조건 충족(마지막 5km 쉬움 + 전체 6'40"대) 시 목표 4:45, 아니면 유지. 4:30은 차기 사이클.
 * 4차 검토(2026-09-07, 4주차 롱런 이월 시점): 롱런 월요일 고정
 *  - 주말 롱런이 어려워 9/6 롱런을 9/7(월)로 이월하고, 5주차부터 모든 세션을 +1일 이동
 *    화 회복 → 수 / 목 퀄리티 → 금 / 토 보조 → 일 / 일 롱런 → 월. 간격 구조는 그대로
 *    (보조→롱런 연속 배치, 나머지는 하루 휴식 사이). 주간 거리·롱런 진행도 변화 없음
 *  - 주 구분을 화→월로 (PLAN_START 8/11). 월요일 롱런이 그 주의 마지막 세션으로 집계된다
 *  - 대회주는 예외: 수 4 / 금 3 / 토 셰이크아웃 2 / 일 대회. 마지막 롱런은 11/9(월), 대회 6일 전
 *  - 10/19(월) 리허설은 대회 시작 시각 세팅이 관건 — 연차 등으로 오전 확보 못 하면 10/18(일)로
 * 5차 검토(2026-09-11): 목표 재검토 — 4:30 가능성 (3차 검토의 "4:30은 차기 사이클"을 대체)
 *  - 근거: 2025-11 10km 56:30(전력) → 풀코스 환산 상한 4:30~4:33.
 *    4월 하프 2:14:33은 목표 페이스 주행이라 하프 기반 4:48~4:55 추정은 보수적
 *  - 9/18(6주차 감량주) 빌드업 → 5km 기록 측정. TRIAL 판정표로 대회 목표 트랙(4:30 / 4:40 / 현행) 결정
 *  - 4:30·4:40 트랙이면 7주차부터 롱런 후반·지속주 페이스를 트랙 기준으로 올리고 수요일 회복주 +2km (측정 후 반영)
 *  - 10/19 리허설은 트랙의 최종 확정 자리 — 버거우면 한 단계 낮춘다
 *
 * 피크 주간 55km / 롱런 비중 51% / 최장 롱런 28km(상한 3:30 = 대회 시간의 72%)
 * ============================================================ */

const PLAN_START = '2026-08-11'; // 1주차 화요일 — 주 구분 화→월 (월요일 롱런이 주의 마지막 세션)
const TOTAL_WEEKS = 14;

const RACE = {
  date: '2026-11-15',
  name: '손기정마라톤',
  distanceKm: 42.195,
  // 하프 2:14:33(6'22"/km) 기준 예상 완주 4:48~4:55
  targetPaceSec: [410, 420],      // 6'50" ~ 7'00" /km
  targetFinish: '4:48 ~ 4:55',
  cutoffMin: 300,                 // 컷오프 5시간 (확정)
  cutoffPaceSec: 427,             // 7'07"/km — 완주 한계 페이스
  cutoffNote: '컷오프 5:00 확정 — 한계 페이스 7\'07"/km, 목표 대비 여유 5~12분. 화장실·급수 정지까지 이 여유 안에서.',
  // 구간별 통과 목표 (목표 6'55" 기준 / 컷오프 한계 7'07" 기준)
  splits: [
    { point: '10km',  target: '1:09', limit: '1:11' },
    { point: '하프',  target: '2:26', limit: '2:30' },
    { point: '30km',  target: '3:28', limit: '3:33' },
    { point: '40km',  target: '4:37', limit: '4:44' },
    { point: '피니시', target: '4:52', limit: '5:00' },
  ],
};

// 런워크 — 9분 런 / 1분 워크. 런워크 타입의 pace는 워크 포함 평균(기록 페이스와 같은 기준)이고,
// 런 구간 페이스는 워크를 walkPaceSec(빠르게 걷기)로 가정해 역산한다 (runSegPace)
const RUN_WALK = { runMin: 9, walkMin: 1, walkPaceSec: 600 };

// 훈련 타입별 목표 페이스 (초/km) — 느린 순
// runWalk: 런워크로 뛰는 타입 / progressive: 느린 쪽에서 빠른 쪽으로 점증
const TYPES = {
  easy:     { label: '보조 조깅',    short: '보조', pace: [465, 495], desc: '25~35분, 너무 쉽다 싶게.' },
  recovery: { label: '회복 조깅',    short: '회복', pace: [450, 480], desc: '대화 가능한 속도 · 심박 존2.' },
  long:     { label: '장거리 (LSD)', short: '롱런', pace: [435, 465], runWalk: true, desc: '거리보다 시간 상한 우선. 6주차부터 마지막 20~25%는 대회 페이스.' },
  buildup:  { label: '빌드업',       short: '빌드', pace: [390, 450], progressive: true, desc: '점증 · 케이던스 175spm.' },
  rhythm:   { label: '리듬 유지주',  short: '리듬', pace: [400, 420], desc: '대회 페이스 감각 유지.' },
  steady:   { label: '지속주',       short: '지속', pace: [390, 405], desc: '웜업 후 끊김 없이.' },
  tempo:    { label: '크루즈 인터벌', short: '템포', pace: [370, 385], desc: '4×6분 · 90초 조깅 회복. 연속 템포 금지.' },
  trial:    { label: '기록 측정',    short: '측정', pace: [330, 342], desc: '웜업 2km + 5km 전력 + 쿨다운 1km. 첫 1km를 억제하고 마지막 1km에 짜낸다.' },
  race:     { label: '대회',         short: '대회', pace: [410, 420], runWalk: true, desc: '1km부터 런워크 시작.' },
};

/* 5km 기록 측정 판정표 (9/18) — 풀코스 환산(Riegel +5%)에 대회까지 8주간 향상분 약 30초를 얹은 기준.
 * maxSec 이내면 해당 트랙. pace = 대회 평균 페이스(워크 포함) */
const TRIAL = {
  distanceKm: 5,
  tiers: [
    { maxSec: 1650,     goal: '4:30',      pace: [384, 384] }, // 27:30
    { maxSec: 1710,     goal: '4:40',      pace: [398, 398] }, // 28:30
    { maxSec: Infinity, goal: '4:48~4:55', pace: [410, 420] }, // 현행
  ],
  note: '4:30·4:40 트랙이면 7주차부터 롱런 후반·지속주 페이스를 트랙 기준으로 올리고 수요일 회복주 +2km. 최종 확정은 10/19 리허설.',
};

/* 14주 스케줄
 * capMin: 시간 상한(분) — 도달하면 거리가 남아도 종료 */
const PLANS = [
  // 1주차 (8/11~8/17) — 엔진 깨우기
  { id: 'w01-sun', week: 1,  date: '2026-08-16', type: 'long',     targetKm: 8, note: '첫 롱런. 런워크 필수(3분 달리기/1분 걷기부터).' },
  // 2주차 (8/18~8/24) — 런워크 적응
  { id: 'w02-tue', week: 2,  date: '2026-08-18', type: 'recovery', targetKm: 5 },
  { id: 'w02-thu', week: 2,  date: '2026-08-20', type: 'rhythm',   targetKm: 7 },
  { id: 'w02-sun', week: 2,  date: '2026-08-23', type: 'long',     targetKm: 10, note: '8/24(월) 저녁으로 이월 — 기록 시 날짜만 바꿔서 저장할 것.' },
  // 3주차 (8/25~8/31) — 이월 조정: 화요일 회복주 삭제
  { id: 'w03-thu', week: 3,  date: '2026-08-27', type: 'rhythm',   targetKm: 7 },
  { id: 'w03-sun', week: 3,  date: '2026-08-30', type: 'long',     targetKm: 13, note: '8/24 롱런 이월로 이번 주 실부하 30km. 정강이 통증 3 이상이면 11km로 줄일 것.' },
  // 4주차 (9/1~9/7) — 빌드업 도입 · 롱런 월요일 전환
  { id: 'w04-tue', week: 4,  date: '2026-09-01', type: 'recovery', targetKm: 6 },
  { id: 'w04-thu', week: 4,  date: '2026-09-03', type: 'buildup',  targetKm: 8, note: '5km @7\'30" → 3km @6\'55". 후반에 올리는 감각만 익힌다.' },
  { id: 'w04-sun', week: 4,  date: '2026-09-07', type: 'long',     targetKm: 15, note: '9/6(일)에서 이월. 이번 주부터 롱런은 월요일 고정 — 화요일은 쉬고 수요일 회복주부터 재개.' },
  // 5주차 (9/8~9/14) — 본격 LSD + 보급 연습. 이하 수(회복)·금(퀄리티)·일(보조)·월(롱런)
  { id: 'w05-wed', week: 5,  date: '2026-09-09', type: 'recovery', targetKm: 6 },
  { id: 'w05-fri', week: 5,  date: '2026-09-11', type: 'steady',   targetKm: 8, note: '2km 웜업 + 5km @6\'40" + 1km 쿨다운.' },
  { id: 'w05-sun', week: 5,  date: '2026-09-13', type: 'easy',     targetKm: null, targetMin: 30, note: '선택. 6주차부터 필수로 전환된다.' },
  { id: 'w05-mon', week: 5,  date: '2026-09-14', type: 'long',     targetKm: 18, note: '젤 보급 연습 시작(40~45분 간격).' },
  // 6주차 (9/15~9/21) — 감량주 + 주4회 전환
  { id: 'w06-wed', week: 6,  date: '2026-09-16', type: 'recovery', targetKm: 6 },
  { id: 'w06-fri', week: 6,  date: '2026-09-18', type: 'trial',    targetKm: 8, note: '5km 기록 측정 → 대회 목표 결정. 워치 사용자 설정 운동(워밍업 2km / 작업 5km / 쿨다운 1km)으로 뛰면 구간 기록이 따로 남는다. 첫 1km는 5\'35"보다 빠르지 않게 — 11월 10km처럼 오버페이스하면 측정이 망가진다. 기록할 때 "5km 기록"에 작업 구간 시간 입력.' },
  { id: 'w06-sun', week: 6,  date: '2026-09-20', type: 'easy',     targetKm: null, targetMin: 30, note: '이번 주부터 필수. 월요일 롱런을 지친 다리로 시작하기 위한 세션 — 30분, 절대 힘들면 안 된다.' },
  { id: 'w06-mon', week: 6,  date: '2026-09-21', type: 'long',     targetKm: 14, note: '감량주. 마지막 3km만 대회 페이스(6\'55").' },
  // 7주차 (9/22~9/28) — 하프 거리 돌파
  { id: 'w07-wed', week: 7,  date: '2026-09-23', type: 'recovery', targetKm: 7 },
  { id: 'w07-fri', week: 7,  date: '2026-09-25', type: 'steady',   targetKm: 10, note: '2km 웜업 + 6km @6\'35" + 2km 쿨다운.' },
  { id: 'w07-sun', week: 7,  date: '2026-09-27', type: 'easy',     targetKm: null, targetMin: 40 },
  { id: 'w07-mon', week: 7,  date: '2026-09-28', type: 'long',     targetKm: 20, note: '마지막 4km 대회 페이스. 걷기 시간까지 포함해서 6\'55" — 걷기 빼고 계산하지 말 것.' },
  // 8주차 (9/29~10/5) — 유일한 역치 세션
  { id: 'w08-wed', week: 8,  date: '2026-09-30', type: 'recovery', targetKm: 7 },
  { id: 'w08-fri', week: 8,  date: '2026-10-02', type: 'tempo',    targetKm: 10, note: '2km 웜업 + 4×6분 @6\'15"(90초 조깅 회복) + 2km 쿨다운. 연속 템포 금지.' },
  { id: 'w08-sun', week: 8,  date: '2026-10-04', type: 'easy',     targetKm: null, targetMin: 40 },
  { id: 'w08-mon', week: 8,  date: '2026-10-05', type: 'long',     targetKm: 24, capMin: 180, note: '마지막 5km 대회 페이스. 상한 3:00.' },
  // 9주차 (10/6~10/12) — 감량주 + 수요일 증량
  { id: 'w09-wed', week: 9,  date: '2026-10-07', type: 'recovery', targetKm: 10, note: '수요일 증량(8→10km). 감량주에 얹어야 총부하가 늘지 않는다.' },
  { id: 'w09-fri', week: 9,  date: '2026-10-09', type: 'buildup',  targetKm: 6, note: '감량주 — 짧고 가볍게. 마지막 2km만 6\'40".' },
  { id: 'w09-sun', week: 9,  date: '2026-10-11', type: 'easy',     targetKm: null, targetMin: 40 },
  { id: 'w09-mon', week: 9,  date: '2026-10-12', type: 'long',     targetKm: 20, note: '감량주. 마지막 5km 대회 페이스.' },
  // 10주차 (10/13~10/19) — 피크 주간 · 대회 리허설
  { id: 'w10-wed', week: 10, date: '2026-10-14', type: 'recovery', targetKm: 10 },
  { id: 'w10-fri', week: 10, date: '2026-10-16', type: 'steady',   targetKm: 12, note: '3km 웜업 + 7km @6\'40" + 2km 쿨다운. 마지막 퀄리티 세션.' },
  { id: 'w10-sun', week: 10, date: '2026-10-18', type: 'easy',     targetKm: null, targetMin: 40, note: '리허설 전날. 40분을 넘기지 말 것.' },
  { id: 'w10-mon', week: 10, date: '2026-10-19', type: 'long',     targetKm: 28, capMin: 210, note: '피크 롱런 = 대회 리허설. 시작 시각·신발·젤·런워크 비율 전부 대회 세팅 — 월요일 오전을 확보 못 하면 10/18(일) 오전으로 당기고 일요일 보조 조깅은 생략. 마지막 5km 대회 페이스. 상한 3:30 — 도달하면 거리 남아도 종료. ★최종 목표 확정: 마지막 5km를 9/18 측정으로 정한 트랙의 대회 페이스로 — "쉽다"면 확정, 버거우면 한 단계 낮춘다(4:30 → 4:40 → 4:48~4:55).' },
  // 11주차 (10/20~10/26) — 테이퍼링 시작
  { id: 'w11-wed', week: 11, date: '2026-10-21', type: 'recovery', targetKm: 7 },
  { id: 'w11-fri', week: 11, date: '2026-10-23', type: 'rhythm',   targetKm: 10, note: '퀄리티 종료. 이제 대회 페이스 감각만 유지한다.' },
  { id: 'w11-sun', week: 11, date: '2026-10-25', type: 'easy',     targetKm: null, targetMin: 30 },
  { id: 'w11-mon', week: 11, date: '2026-10-26', type: 'long',     targetKm: 20, note: '테이퍼링 시작. 마지막 5km 대회 페이스. 체력은 이미 은행에 있다 — 더 쌓으려 하지 말 것.' },
  // 12주차 (10/27~11/2) — 피로 회복 집중
  { id: 'w12-wed', week: 12, date: '2026-10-28', type: 'recovery', targetKm: 6 },
  { id: 'w12-fri', week: 12, date: '2026-10-30', type: 'buildup',  targetKm: 8, note: '마지막 2km만 대회 페이스.' },
  { id: 'w12-mon', week: 12, date: '2026-11-02', type: 'long',     targetKm: 16, note: '마지막 4km 대회 페이스.' },
  // 13주차 (11/3~11/9) — 마지막 조율
  { id: 'w13-wed', week: 13, date: '2026-11-04', type: 'recovery', targetKm: 5 },
  { id: 'w13-fri', week: 13, date: '2026-11-06', type: 'rhythm',   targetKm: 6, note: '3km만 대회 페이스로. 나머지는 조깅.' },
  { id: 'w13-mon', week: 13, date: '2026-11-09', type: 'long',     targetKm: 12, note: '마지막 롱런, 대회 6일 전. 마지막 3km 대회 페이스로 가볍게.' },
  // 대회주 (11/10~11/16) — 월요일 롱런 없음. 수·금 짧은 조깅 + 토 셰이크아웃
  { id: 'w14-wed',  week: 14, date: '2026-11-11', type: 'recovery', targetKm: 4, note: '+ 3×20초 스트라이드. 다리를 깨우는 용도.' },
  { id: 'w14-fri',  week: 14, date: '2026-11-13', type: 'recovery', targetKm: 3, note: '완전 휴식보다 짧은 조깅이 낫다. 4일 쉬면 다리가 죽는다. 페이스 신경 쓰지 말 것.' },
  { id: 'w14-sat',  week: 14, date: '2026-11-14', type: 'easy',     targetKm: 2, note: '셰이크아웃 2km + 3×20초 스트라이드. 대회 신발로.' },
  { id: 'w14-race', week: 14, date: '2026-11-15', type: 'race',     targetKm: 42.195, note: '1km부터 런워크. 첫 10km는 목표보다 느리게 — 컷오프 여유는 후반에 쓸 돈이다. 보급 40분 간격.' },
];

const WEEK_NOTES = {
  1: '엔진 깨우기', 2: '런워크 점진 적응', 3: '8/24 롱런 이월', 4: '빌드업 도입 · 롱런 월요일 전환',
  5: '본격 LSD + 보급 연습', 6: '감량주 · 5km 측정 · 주4회 전환', 7: '하프 거리 돌파', 8: '크루즈 인터벌',
  9: '감량주 · 수요일 증량', 10: '피크 주간 · 대회 리허설', 11: '테이퍼링 시작',
  12: '피로 회복 집중', 13: '마지막 조율', 14: '대회주',
};

// 과거 기록 (첫 실행 시 1회 시드)
const HISTORY = [
  { date: '2026-04-11', type: 'rhythm',   distanceKm: 10.04,   durationSec: 3923, paceSec: 391, avgHr: 166, maxHr: null, cadence: 167, shinPain: null, notes: '주말 점검 — 하프 대비 페이스 훈련' },
  { date: '2026-04-14', type: 'rhythm',   distanceKm: 6.32,    durationSec: null, paceSec: 360, avgHr: 164, maxHr: 183,  cadence: null, shinPain: null, notes: '야간 훈련. 4km 지점 스피드 제어 미스' },
  { date: '2026-04-16', type: 'easy',     distanceKm: 3.31,    durationSec: null, paceSec: 445, avgHr: 155, maxHr: 162,  cadence: 167, shinPain: null, notes: '테이퍼링 주간 리듬 조깅 — 완벽 제어' },
  { date: '2026-04-26', type: 'race',     distanceKm: 21.0975, durationSec: 8073, paceSec: 383, avgHr: null, maxHr: null, cadence: null, shinPain: null, notes: '서울 하프 마라톤 완주 2:14:33 (목표 시간 내)' },
  { date: '2026-07-27', type: 'recovery', distanceKm: 4.5,     durationSec: 1800, paceSec: 400, avgHr: null, maxHr: null, cadence: null, shinPain: 2, runWalk: '3km run / 1min walk', notes: '3개월 만의 러닝 재개' },
];

// 통증 신호등 (정강이 통증 지수 0~10)
const PAIN_RULES = [
  { max: 3,  level: 'good',     title: '0~3 · 진행',   desc: '훈련 계속. 러닝 후 아이싱과 종아리 스트레칭.' },
  { max: 5,  level: 'warning',  title: '4~5 · 주의',   desc: '달리는 중이면 중단·단축. 다음날 아침에도 통증이 남으면 다음 훈련은 휴식/자전거로 대체. 일요일 보조 조깅이 첫 번째 삭제 대상.' },
  { max: 10, level: 'critical', title: '6+ · 중단',    desc: '러닝 중단, 2~3일 완전 휴식. 통증 0~2로 내려간 뒤 재개. 지속되면 진료.' },
];
