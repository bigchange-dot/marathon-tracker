/* 가민 FIT 파일 읽기 — 가민 커넥트 웹의 "원본 내보내기"(.zip) 또는 .fit 그대로.
 * 외부 라이브러리 없이 브라우저 안에서만 해석한다 (서버로 아무것도 보내지 않음).
 * 쓰는 메시지: session(18) 요약 · record(20) 초 단위 샘플 · lap(19) 랩.
 * 런워크 판별은 케이던스로 한다 — 140spm 이상 = 달리기, 미만 = 걷기. */

const FIT = (() => {
  const FIT_EPOCH = 631065600; // 1989-12-31T00:00:00Z (유닉스 초)
  const RUN_SPM = 140;
  const MSG = { session: 18, lap: 19, record: 20 };

  // base type → [바이트 수, 읽기 함수 이름, 무효값]
  const BASE = {
    0x00: [1, 'getUint8', 0xFF], 0x01: [1, 'getInt8', 0x7F], 0x02: [1, 'getUint8', 0xFF],
    0x83: [2, 'getInt16', 0x7FFF], 0x84: [2, 'getUint16', 0xFFFF],
    0x85: [4, 'getInt32', 0x7FFFFFFF], 0x86: [4, 'getUint32', 0xFFFFFFFF],
    0x88: [4, 'getFloat32', null], 0x89: [8, 'getFloat64', null],
    0x0A: [1, 'getUint8', 0], 0x8B: [2, 'getUint16', 0], 0x8C: [4, 'getUint32', 0],
  };

  /* ---------- zip: 가민 커넥트 내보내기는 .fit 하나가 든 zip ---------- */

  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(buf);
  }

  async function fitFromZip(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('zip 파일을 읽을 수 없습니다');
    let p = dv.getUint32(eocd + 16, true);
    const count = dv.getUint16(eocd + 10, true);
    // 크기는 중앙 디렉터리 기준 (로컬 헤더는 data descriptor를 쓰면 0으로 비어 있다)
    for (let n = 0; n < count && dv.getUint32(p, true) === 0x02014b50; n++) {
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (!/\.fit$/i.test(name)) continue;
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = u8.subarray(start, start + compSize);
      if (method === 0) return data;
      if (method === 8) return inflateRaw(data);
      throw new Error('지원하지 않는 zip 압축 방식');
    }
    throw new Error('zip 안에 .fit 파일이 없습니다');
  }

  /* ---------- FIT 바이너리 해석 ---------- */

  function decode(u8) {
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const hdr = u8[0];
    if (u8.length < 12 || String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) !== '.FIT') throw new Error('FIT 파일이 아닙니다');
    const end = Math.min(u8.length, hdr + dv.getUint32(4, true));
    const defs = {};
    const out = { session: [], lap: [], record: [] };
    const want = { [MSG.session]: 'session', [MSG.lap]: 'lap', [MSG.record]: 'record' };
    let p = hdr, lastTs = 0;

    while (p < end) {
      const rh = u8[p++];
      let local, compressedTs = null;
      if (rh & 0x80) { // 압축 타임스탬프 헤더
        local = (rh >> 5) & 0x03;
        const off = rh & 0x1F;
        compressedTs = (lastTs & ~0x1F) + off + (off < (lastTs & 0x1F) ? 0x20 : 0);
      } else if (rh & 0x40) { // 정의 메시지
        local = rh & 0x0F;
        const le = u8[p + 1] === 0;
        const global = dv.getUint16(p + 2, le);
        const nf = u8[p + 4];
        p += 5;
        const fields = [];
        for (let i = 0; i < nf; i++, p += 3) fields.push({ num: u8[p], size: u8[p + 1], base: u8[p + 2] });
        let devSize = 0;
        if (rh & 0x20) { const nd = u8[p++]; for (let i = 0; i < nd; i++, p += 3) devSize += u8[p + 1]; }
        defs[local] = { le, global, fields, devSize };
        continue;
      } else {
        local = rh & 0x0F;
      }

      const def = defs[local];
      if (!def) throw new Error('FIT 해석 실패 (정의 없는 메시지)');
      const name = want[def.global];
      const msg = name ? {} : null;
      for (const f of def.fields) {
        const bt = BASE[f.base];
        if (bt && bt[0] === f.size) { // 배열·문자열 필드는 건너뛴다
          const v = dv[bt[1]](p, def.le);
          if (f.num === 253) lastTs = v;
          if (msg && v !== bt[2]) msg[f.num] = v;
        }
        p += f.size;
      }
      p += def.devSize;
      if (compressedTs != null) { lastTs = compressedTs; if (msg) msg[253] = compressedTs; }
      if (msg) out[name].push(msg);
    }
    return out;
  }

  /* ---------- 요약 ---------- */

  const toDate = ts => new Date((ts + FIT_EPOCH) * 1000);
  const localDateStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const spm = (cad, frac) => cad == null ? null : (cad + (frac || 0) / 128) * 2;
  const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

  /* 초 단위 샘플을 달리기/걷기 구간으로 나눈다. 20초 미만 구간은 앞 구간에 흡수 (신호 튐 제거) */
  function segments(records) {
    const segs = [];
    let run = { t: 0, d: 0, cadT: 0 }, walk = { t: 0, d: 0 };
    for (let i = 1; i < records.length; i++) {
      const a = records[i - 1], b = records[i];
      const dt = b[253] - a[253];
      if (!(dt > 0 && dt <= 10) || b[4] == null) continue; // 일시정지·결측
      const dd = a[5] != null && b[5] != null ? (b[5] - a[5]) / 100 : 0;
      const c = spm(b[4], b[53]);
      const isRun = c >= RUN_SPM;
      if (isRun) { run.t += dt; run.d += dd; run.cadT += c * dt; } else { walk.t += dt; walk.d += dd; }
      const last = segs[segs.length - 1];
      if (last && last.run === isRun) last.t += dt; else segs.push({ run: isRun, t: dt });
    }
    const merged = [];
    for (const s of segs) {
      const last = merged[merged.length - 1];
      if (last && (s.t < 20 || last.run === s.run)) last.t += s.t; else merged.push({ ...s });
    }
    return { run, walk, merged };
  }

  function summarize(fit) {
    const sessions = fit.session;
    if (!sessions.length) throw new Error('활동 요약(session)이 없는 FIT 파일입니다');
    const sum = (k, scale) => sessions.reduce((s, x) => s + (x[k] || 0), 0) / scale;
    const distanceKm = sum(9, 100) / 1000;
    const durationSec = Math.round(sum(8, 1000) || sum(7, 1000)); // 타이머 시간(일시정지 제외) 우선
    const hrW = sessions.filter(s => s[16]).reduce((a, s) => [a[0] + s[16] * (s[8] || 1), a[1] + (s[8] || 1)], [0, 0]);
    const maxHrs = sessions.map(s => s[17]).filter(Boolean);
    const s0 = sessions[0];
    const start = toDate(s0[2] ?? s0[253]);

    const r = { date: localDateStr(start), start, distanceKm, durationSec,
      avgHr: hrW[1] ? Math.round(hrW[0] / hrW[1]) : null,
      maxHr: maxHrs.length ? Math.max(...maxHrs) : null,
      cadence: s0[18] != null ? Math.round(spm(s0[18], s0[41])) : null,
      isRunning: sessions.some(s => s[5] === 1),
      laps: fit.lap.map(l => ({ distanceKm: (l[9] || 0) / 100000, sec: Math.round((l[8] ?? l[7] ?? 0) / 1000) })),
      hasCadence: fit.record.some(x => x[4] != null), runOnly: null, runWalk: null, walkCount: 0 };

    const { run, walk, merged } = segments(fit.record);
    const walks = merged.filter((s, i) => !s.run && s.t >= 30 && i > 0);
    // 걷기가 전체의 3% 이상일 때만 런워크로 본다 (신호 대기 한두 번은 무시)
    if (run.t > 0 && walks.length >= 2 && walk.t / (run.t + walk.t) >= 0.03) {
      r.walkCount = walks.length;
      r.runOnly = { paceSec: run.d > 0 ? run.t / (run.d / 1000) : null, cadence: Math.round(run.cadT / run.t) };
      const runMin = Math.round(median(merged.filter(s => s.run).map(s => s.t)) / 60);
      const walkMin = Math.round(median(walks.map(s => s.t)) / 30) / 2; // 30초 단위
      if (runMin > 0 && walkMin > 0) r.runWalk = `${runMin}분 / ${walkMin}분`;
    }
    return r;
  }

  async function readFile(file) {
    let u8 = new Uint8Array(await file.arrayBuffer());
    if (u8[0] === 0x50 && u8[1] === 0x4B) u8 = await fitFromZip(u8); // 'PK'
    return summarize(decode(u8));
  }

  return { readFile, decode, summarize };
})();
