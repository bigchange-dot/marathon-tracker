#!/usr/bin/env python3
"""애플 건강 '모든 건강 데이터 보내기'(export.zip)에서 특정 날짜의 심박수를 뽑아
러닝 구간을 자동 감지하고 평균·최대를 계산한다.

사용:
  python3 tools/hr_from_export.py docs/export.zip                # 오늘
  python3 tools/hr_from_export.py docs/export.zip --date 2026-09-04
  python3 tools/hr_from_export.py docs/export.zip --date 2026-09-04 --start 06:10 --end 07:05
  python3 tools/hr_from_export.py docs/export.zip --date 2026-09-04 --timeline   # 1분 단위 표

zip 그대로 넣어도 되고, 압축을 푼 export.xml / 내보내기.xml 경로를 넣어도 된다.
export.xml이 수백 MB~수 GB라도 스트리밍으로 읽으므로 메모리는 거의 안 쓴다.
"""
import argparse
import io
import statistics
import sys
import zipfile
from datetime import date, datetime, timedelta
from xml.etree import ElementTree as ET

HR_TYPE = "HKQuantityTypeIdentifierHeartRate"
DATE_FMT = "%Y-%m-%d %H:%M:%S %z"


class DoctypeStripper(io.RawIOBase):
    """애플 export.xml의 DOCTYPE 내부 DTD가 파서를 깨뜨리는 경우가 있어 앞부분에서 제거한다."""

    def __init__(self, raw):
        self.raw = raw
        self.buf = b""
        self.head_done = False

    def readable(self):
        return True

    def _fill_head(self):
        while True:
            chunk = self.raw.read(1 << 20)
            self.buf += chunk
            if not chunk:
                break
            start = self.buf.find(b"<!DOCTYPE")
            if start == -1:
                if len(self.buf) > (4 << 20):
                    break
                continue
            end = self.buf.find(b"]>", start)
            if end == -1:
                if len(self.buf) > (64 << 20):
                    break
                continue
            self.buf = self.buf[:start] + self.buf[end + 2:]
            break
        self.head_done = True

    def readinto(self, b):
        if not self.head_done:
            self._fill_head()
        if not self.buf:
            self.buf = self.raw.read(len(b))
        n = min(len(b), len(self.buf))
        b[:n] = self.buf[:n]
        self.buf = self.buf[n:]
        return n


def open_export(path):
    if path.lower().endswith(".zip"):
        zf = zipfile.ZipFile(path)
        cands = [i for i in zf.infolist()
                 if i.filename.lower().endswith(".xml") and "cda" not in i.filename.lower()]
        if not cands:
            sys.exit("zip 안에 export.xml이 없습니다")
        member = max(cands, key=lambda i: i.file_size)
        print(f"# 읽는 파일: {member.filename} ({member.file_size / 1e6:.0f} MB)")
        return zf.open(member)
    return open(path, "rb")


def parse_dt(s):
    return datetime.strptime(s, DATE_FMT)


def load_day(path, day):
    """해당 날짜의 심박 샘플 [(datetime, bpm, source)]과 워크아웃 목록을 스트리밍으로 수집."""
    samples, workouts = [], []
    stream = io.BufferedReader(DoctypeStripper(open_export(path)))
    n_seen = 0
    for _, el in ET.iterparse(stream, events=("end",)):
        tag = el.tag
        if tag == "Record":
            n_seen += 1
            if el.get("type") == HR_TYPE:
                sd = el.get("startDate", "")
                if sd[:10] == day:
                    try:
                        samples.append((parse_dt(sd), float(el.get("value")), el.get("sourceName", "")))
                    except (TypeError, ValueError):
                        pass
            el.clear()
        elif tag == "Workout":
            sd = el.get("startDate", "")
            if sd[:10] == day:
                workouts.append({
                    "type": el.get("workoutActivityType", "").replace("HKWorkoutActivityType", ""),
                    "start": sd, "end": el.get("endDate", ""),
                    "duration_min": float(el.get("duration") or 0),
                    "source": el.get("sourceName", ""),
                })
            el.clear()
        elif tag in ("ActivitySummary", "Correlation", "ClinicalRecord"):
            el.clear()
        if n_seen and n_seen % 1_000_000 == 0:
            print(f"#   ... {n_seen // 1_000_000}백만 레코드 통과", file=sys.stderr)
    samples.sort(key=lambda s: s[0])
    return samples, workouts


def stats(vals):
    return {"n": len(vals), "avg": statistics.fmean(vals), "max": max(vals), "min": min(vals)}


def fmt_stats(st):
    return f"샘플 {st['n']:>4}개  평균 {st['avg']:.1f}  최대 {st['max']:.0f}  최소 {st['min']:.0f}"


def detect_runs(samples, max_gap_s=90, min_samples=60, min_avg=115):
    """샘플 간격이 max_gap_s 이내로 이어지는 덩어리를 세션으로 보고, 러닝답게 밀도·강도가 있는 것만 남긴다."""
    segs, cur = [], []
    for s in samples:
        if cur and (s[0] - cur[-1][0]).total_seconds() > max_gap_s:
            segs.append(cur)
            cur = []
        cur.append(s)
    if cur:
        segs.append(cur)
    out = []
    for seg in segs:
        vals = [v for _, v, _ in seg]
        if len(seg) < min_samples:
            continue
        st = stats(vals)
        if st["avg"] < min_avg:
            continue
        gaps = [(b[0] - a[0]).total_seconds() for a, b in zip(seg, seg[1:])]
        out.append({
            "start": seg[0][0], "end": seg[-1][0],
            "dur_min": (seg[-1][0] - seg[0][0]).total_seconds() / 60,
            "interval_s": statistics.median(gaps) if gaps else 0,
            **st,
        })
    return out


def print_timeline(samples):
    print("\n## 1분 단위 타임라인 (샘플이 있는 분만)")
    print("시각   샘플  평균  최대")
    cur_key, bucket = None, []
    def flush():
        if bucket:
            st = stats(bucket)
            print(f"{cur_key}  {st['n']:>4}  {st['avg']:>5.0f}  {st['max']:>4.0f}")
    for t, v, _ in samples:
        key = t.strftime("%H:%M")
        if key != cur_key:
            flush()
            cur_key, bucket = key, []
        bucket.append(v)
    flush()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("path", help="export.zip 또는 export.xml")
    ap.add_argument("--date", default=date.today().isoformat(), help="YYYY-MM-DD (기본 오늘)")
    ap.add_argument("--start", help="HH:MM 구간 시작 (선택)")
    ap.add_argument("--end", help="HH:MM 구간 끝 (선택)")
    ap.add_argument("--timeline", action="store_true", help="1분 단위 표 출력")
    a = ap.parse_args()

    samples, workouts = load_day(a.path, a.date)
    print(f"\n# {a.date} 심박수 샘플 {len(samples)}개")
    if not samples:
        print("이 날짜에 심박 샘플이 없습니다. 날짜를 확인하세요.")
        return

    by_src = {}
    for _, v, src in samples:
        by_src[src] = by_src.get(src, 0) + 1
    print("## 소스별 샘플 수")
    for src, n in sorted(by_src.items(), key=lambda x: -x[1]):
        print(f"  {src}: {n}")

    print("\n## 건강 앱에 저장된 워크아웃")
    if workouts:
        for w in workouts:
            print(f"  {w['type']}  {w['start'][11:16]}~{w['end'][11:16]}  {w['duration_min']:.0f}분  ({w['source']})")
    else:
        print("  없음 — 나이키런이 운동을 건강 앱에 쓰지 못한 상태")

    print("\n## 하루 전체")
    print("  " + fmt_stats(stats([v for _, v, _ in samples])))

    runs = detect_runs(samples)
    print("\n## 자동 감지된 러닝 구간 (샘플이 촘촘히 이어지고 평균 115 이상)")
    if runs:
        for r in runs:
            print(f"  {r['start'].strftime('%H:%M:%S')} ~ {r['end'].strftime('%H:%M:%S')}  "
                  f"{r['dur_min']:.0f}분  측정간격 {r['interval_s']:.0f}초  →  "
                  f"평균 {r['avg']:.0f}  최대 {r['max']:.0f}  (샘플 {r['n']}개, 최소 {r['min']:.0f})")
        best = max(runs, key=lambda r: r["n"])
        print(f"\n  ▶ 앱 입력값: 평균 심박 {best['avg']:.0f} / 최대 심박 {best['max']:.0f}")
    else:
        print("  없음 — 워치가 운동 세션 없이 배경 측정만 한 것으로 보임 (촘촘한 샘플 덩어리가 없음)")

    if a.start and a.end:
        d = datetime.strptime(a.date, "%Y-%m-%d").date()
        tz = samples[0][0].tzinfo
        t0 = datetime.combine(d, datetime.strptime(a.start, "%H:%M").time(), tz)
        t1 = datetime.combine(d, datetime.strptime(a.end, "%H:%M").time(), tz)
        win = [v for t, v, _ in samples if t0 <= t <= t1]
        print(f"\n## 지정 구간 {a.start}~{a.end}")
        print("  " + (fmt_stats(stats(win)) if win else "샘플 없음"))

    if a.timeline:
        print_timeline(samples)


if __name__ == "__main__":
    main()
