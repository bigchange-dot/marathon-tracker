/* 인라인 SVG 차트. 외부 라이브러리 없음.
 * 색은 CSS 변수(라이트/다크 자동 전환)를 참조하고, 값은 툴팁+테이블로도
 * 항상 읽을 수 있다(툴팁은 보조 수단, 게이트가 아님). */

const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs = {}) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function makeTooltip(card) {
    let tip = card.querySelector('.chart-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; tip.hidden = true; card.appendChild(tip); }
    return tip;
  }
  function tipRow(tip, rows, title) {
    tip.replaceChildren();
    if (title) { const t = document.createElement('div'); t.className = 'tip-title'; t.textContent = title; tip.appendChild(t); }
    rows.forEach(([key, value, color]) => {
      const r = document.createElement('div'); r.className = 'tip-row';
      if (color) { const k = document.createElement('span'); k.className = 'tip-key'; k.style.background = color; r.appendChild(k); }
      const v = document.createElement('strong'); v.textContent = value; r.appendChild(v);
      const l = document.createElement('span'); l.className = 'tip-label'; l.textContent = key; r.appendChild(l);
      tip.appendChild(r);
    });
  }
  function moveTip(tip, card, x, y) {
    tip.hidden = false;
    const cw = card.clientWidth, tw = tip.offsetWidth;
    let left = x + 12;
    if (left + tw > cw - 4) left = x - tw - 12;
    tip.style.left = Math.max(4, left) + 'px';
    tip.style.top = Math.max(4, y - 8) + 'px';
  }

  function emptyNote(container, msg) {
    const d = document.createElement('div');
    d.className = 'chart-empty'; d.textContent = msg;
    container.appendChild(d);
  }

  function niceMax(v, step) { return Math.max(step, Math.ceil(v / step) * step); }

  // 위쪽만 4px 라운드, 베이스라인은 각진 바
  function barPath(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    if (h <= 0) return '';
    return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  }

  /* ---- 주간 거리: 계획(그레이) vs 실적(블루) — 이머시스 폼 ---- */
  function weekly(container, weeks) {
    container.replaceChildren();
    const card = container;
    const W = Math.max(300, card.clientWidth), H = 210;
    const m = { top: 10, right: 6, bottom: 24, left: 30 };
    const iw = W - m.left - m.right, ih = H - m.top - m.bottom;
    const maxV = niceMax(Math.max(...weeks.map(w => Math.max(w.planKm, w.actualKm)), 10), 10);
    const y = v => m.top + ih - (v / maxV) * ih;
    const band = iw / weeks.length;
    const barW = Math.min(12, (band - 8) / 2);
    const cw = currentWeek();

    // 범례 (2 시리즈 → 항상 표시)
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    [['계획', 'var(--plan-bar)'], ['실적', 'var(--series-1)']].forEach(([label, color]) => {
      const item = document.createElement('span'); item.className = 'legend-item';
      const sw = document.createElement('span'); sw.className = 'legend-swatch'; sw.style.background = color;
      item.append(sw, document.createTextNode(label));
      legend.appendChild(item);
    });
    card.appendChild(legend);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': '주간 계획 대비 실적 거리 차트' });

    for (let v = 0; v <= maxV; v += maxV / 2) {
      svg.appendChild(el('line', { x1: m.left, x2: W - m.right, y1: y(v), y2: y(v), class: v === 0 ? 'axis-base' : 'grid' }));
      const t = el('text', { x: m.left - 5, y: y(v) + 3.5, class: 'tick', 'text-anchor': 'end' });
      t.textContent = v; svg.appendChild(t);
    }

    const groups = [];
    weeks.forEach((wk, i) => {
      const cx = m.left + band * i + band / 2;
      const g = el('g');
      const pb = el('path', { d: barPath(cx - barW - 1, y(wk.planKm), barW, y(0) - y(wk.planKm), 4), fill: 'var(--plan-bar)' });
      const ab = el('path', { d: barPath(cx + 1, y(wk.actualKm), barW, y(0) - y(wk.actualKm), 4), fill: 'var(--series-1)' });
      g.append(pb, ab);
      const lbl = el('text', { x: cx, y: H - 8, class: 'tick' + (wk.week === cw ? ' tick-now' : ''), 'text-anchor': 'middle' });
      lbl.textContent = wk.week === TOTAL_WEEKS ? '🏁' : wk.week;
      g.appendChild(lbl);
      svg.appendChild(g);
      groups.push(g);
    });

    // 히트 타깃 = 주 전체 밴드(마크보다 크게)
    const tip = makeTooltip(card);
    weeks.forEach((wk, i) => {
      const hit = el('rect', { x: m.left + band * i, y: m.top, width: band, height: ih, fill: 'transparent', tabindex: '0' });
      const show = evt => {
        groups.forEach(g => g.classList.remove('lift'));
        groups[i].classList.add('lift');
        tipRow(tip, [
          ['계획', wk.planKm ? wk.planKm + 'km' : '–', css('--plan-bar') || '#c3c2b7'],
          ['실적', wk.actualKm ? wk.actualKm.toFixed(1) + 'km' : '0km', css('--series-1') || '#2a78d6'],
        ], `${wk.week}주차 · ${fmtDateShort(wk.start)}~${fmtDateShort(wk.end)}`);
        const rect = card.getBoundingClientRect();
        const px = evt && evt.clientX ? evt.clientX - rect.left : m.left + band * i + band / 2;
        moveTip(tip, card, px, m.top + 10);
      };
      hit.addEventListener('pointermove', show);
      hit.addEventListener('focus', () => show(null));
      hit.addEventListener('pointerleave', () => { tip.hidden = true; groups[i].classList.remove('lift'); });
      hit.addEventListener('blur', () => { tip.hidden = true; groups[i].classList.remove('lift'); });
      svg.appendChild(hit);
    });
    card.appendChild(svg);
  }

  /* ---- 라인 차트 공통 (페이스 / 통증) ---- */
  function lineChart(container, points, opt) {
    // points: [{x(label용 date), yVal, tipRows(fn), markColor?}]
    container.replaceChildren();
    const card = container;
    if (points.length < 2) { emptyNote(card, '기록이 2개 이상 쌓이면 차트가 나타납니다.'); return; }
    const W = Math.max(300, card.clientWidth), H = opt.height || 200;
    const m = { top: 12, right: 14, bottom: 22, left: 38 };
    const iw = W - m.left - m.right, ih = H - m.top - m.bottom;

    const ys = points.map(p => p.yVal);
    let yMin = opt.yMin != null ? opt.yMin : Math.min(...ys);
    let yMax = opt.yMax != null ? opt.yMax : Math.max(...ys);
    if (opt.pad) { const pad = Math.max((yMax - yMin) * 0.15, opt.pad); yMin -= pad; yMax += pad; }
    const yPos = v => opt.invert
      ? m.top + ((v - yMin) / (yMax - yMin)) * ih      // invert: 작은 값(빠른 페이스)이 위
      : m.top + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const xPos = i => points.length === 1 ? m.left + iw / 2 : m.left + (i / (points.length - 1)) * iw;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': opt.ariaLabel || '' });

    (opt.ticks || []).forEach(tv => {
      svg.appendChild(el('line', { x1: m.left, x2: W - m.right, y1: yPos(tv), y2: yPos(tv), class: 'grid' }));
      const t = el('text', { x: m.left - 5, y: yPos(tv) + 3.5, class: 'tick', 'text-anchor': 'end' });
      t.textContent = opt.fmtY ? opt.fmtY(tv) : tv; svg.appendChild(t);
    });
    svg.appendChild(el('line', { x1: m.left, x2: W - m.right, y1: m.top + ih, y2: m.top + ih, class: 'axis-base' }));

    if (opt.threshold != null) {
      svg.appendChild(el('line', { x1: m.left, x2: W - m.right, y1: yPos(opt.threshold), y2: yPos(opt.threshold), class: 'threshold' }));
      const t = el('text', { x: W - m.right, y: yPos(opt.threshold) - 4, class: 'tick threshold-label', 'text-anchor': 'end' });
      t.textContent = opt.thresholdLabel || opt.threshold; svg.appendChild(t);
    }

    // x 라벨: 처음/끝 + 중간 몇 개
    const nLbl = Math.min(5, points.length);
    const idxs = new Set();
    for (let k = 0; k < nLbl; k++) idxs.add(Math.round((k / (nLbl - 1)) * (points.length - 1)));
    idxs.forEach(i => {
      const t = el('text', { x: xPos(i), y: H - 6, class: 'tick', 'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle' });
      t.textContent = fmtDateShort(points[i].x); svg.appendChild(t);
    });

    const d = points.map((p, i) => (i ? 'L' : 'M') + xPos(i).toFixed(1) + ',' + yPos(p.yVal).toFixed(1)).join(' ');
    svg.appendChild(el('path', { d, class: 'series-line' }));
    points.forEach((p, i) => {
      svg.appendChild(el('circle', { cx: xPos(i), cy: yPos(p.yVal), r: 4.5, class: 'series-dot', fill: p.markColor || 'var(--series-1)' }));
    });

    // 크로스헤어 + 툴팁 (X에 스냅)
    const tip = makeTooltip(card);
    const cross = el('line', { y1: m.top, y2: m.top + ih, class: 'crosshair', visibility: 'hidden' });
    svg.appendChild(cross);
    const onMove = evt => {
      const rect = svg.getBoundingClientRect();
      const px = (evt.clientX - rect.left) * (W / rect.width);
      let best = 0, bd = Infinity;
      points.forEach((p, i) => { const dd = Math.abs(xPos(i) - px); if (dd < bd) { bd = dd; best = i; } });
      cross.setAttribute('x1', xPos(best)); cross.setAttribute('x2', xPos(best));
      cross.setAttribute('visibility', 'visible');
      tipRow(tip, points[best].tipRows(), fmtDate(points[best].x));
      moveTip(tip, card, (xPos(best) / W) * rect.width, (yPos(points[best].yVal) / H) * (rect.height));
    };
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
    card.appendChild(svg);
  }

  function pace(container, runs) {
    const pts = runs.filter(r => r.paceSec != null || (r.durationSec && r.distanceKm));
    const points = pts.map(r => {
      const p = r.paceSec != null ? r.paceSec : r.durationSec / r.distanceKm;
      return {
        x: r.date, yVal: p,
        tipRows: () => [
          [TYPES[r.type] ? TYPES[r.type].label : r.type, fmtPace(p) + '/km', css('--series-1')],
          ['거리', r.distanceKm.toFixed(1) + 'km'],
        ],
      };
    });
    if (points.length < 2) { container.replaceChildren(); emptyNote(container, '기록이 2개 이상 쌓이면 차트가 나타납니다.'); return; }
    const ys = points.map(p => p.yVal);
    const lo = Math.floor((Math.min(...ys) - 20) / 30) * 30, hi = Math.ceil((Math.max(...ys) + 20) / 30) * 30;
    const ticks = []; for (let v = lo; v <= hi; v += Math.max(30, Math.round((hi - lo) / 4 / 30) * 30)) ticks.push(v);
    lineChart(container, points, {
      height: 200, invert: true, yMin: lo, yMax: hi, ticks, fmtY: fmtPace,
      ariaLabel: '러닝 페이스 추이 (위쪽이 빠름)',
    });
  }

  function pain(container, runs) {
    const pts = runs.filter(r => r.shinPain != null);
    const points = pts.map(r => ({
      x: r.date, yVal: r.shinPain,
      markColor: r.shinPain >= 6 ? 'var(--critical)' : r.shinPain >= 4 ? 'var(--warning)' : 'var(--series-1)',
      tipRows: () => [
        ['통증 지수', String(r.shinPain), r.shinPain >= 6 ? css('--critical') : r.shinPain >= 4 ? css('--warning') : css('--series-1')],
        ['거리', r.distanceKm.toFixed(1) + 'km'],
      ],
    }));
    lineChart(container, points, {
      height: 170, yMin: 0, yMax: 10, ticks: [0, 5, 10],
      threshold: 4, thresholdLabel: '주의선 4',
      ariaLabel: '정강이 통증 지수 추이',
    });
  }

  return { weekly, pace, pain };
})();
