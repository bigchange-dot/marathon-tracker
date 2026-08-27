/* AI 코치 분석 — 기록 저장 직후 AI API로 즉시 피드백.
 * 키 접두사로 제공자 자동 판별: AIza… = Google Gemini(무료 한도), sk-ant-… = Anthropic Claude.
 * API 키는 이 브라우저의 localStorage에만 저장된다 (절대 커밋·서버 전송 없음).
 * 키가 없으면 프롬프트 복사 → AI 앱에 붙여넣는 경로로 대체. */

const AI = (() => {
  const KEY_STORE = 'mst.aiKey.v1';
  const AUTO_STORE = 'mst.aiAuto.v1'; // '0'이면 저장 후 자동 분석 끔

  const getKey = () => localStorage.getItem(KEY_STORE) || '';
  const setKey = k => k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE);
  const autoOn = () => localStorage.getItem(AUTO_STORE) !== '0';
  const setAuto = on => localStorage.setItem(AUTO_STORE, on ? '1' : '0');
  // Gemini 키는 형식이 여러 가지(AIza…, AQ.… 등) — Claude(sk-ant-)만 구분하고 나머지는 Gemini로 취급
  const isGemini = k => !k.startsWith('sk-ant-');

  const SYSTEM = '간결하고 실전적인 마라톤 코치. 과한 격려나 뻔한 조언 없이 데이터에 근거해 짚는다.';

  /* ---------- 프롬프트 구성 ---------- */

  function runLine(r) {
    const pace = r.paceSec != null ? r.paceSec : (r.durationSec && r.distanceKm ? r.durationSec / r.distanceKm : null);
    const t = TYPES[r.type];
    const parts = [
      r.date, t ? t.label : r.type, r.distanceKm.toFixed(1) + 'km',
      pace ? '페이스 ' + fmtPace(pace) + '/km' : null,
      r.durationSec ? '시간 ' + fmtDur(r.durationSec) : null,
      r.avgHr ? '평균심박 ' + r.avgHr : null,
      r.cadence ? '케이던스 ' + r.cadence : null,
      r.runWalk ? '런워크 ' + r.runWalk : null,
      r.shinPain != null ? '정강이통증 ' + r.shinPain + '/10' : null,
      r.notes ? '메모: ' + r.notes : null,
    ];
    return parts.filter(Boolean).join(' · ');
  }

  function buildPrompt(run) {
    const runs = Store.all();
    const plan = run.planId ? PLANS.find(p => p.id === run.planId) : null;
    const t = TYPES[run.type];
    const cw = currentWeek();
    const wk = cw > 0 ? weeklyStats(runs)[cw - 1] : null;
    const ad = adherence(runs);
    const np = nextPlan(runs);
    const recent = runs.filter(r => r.id !== run.id).slice(-8);
    const dday = daysBetween(todayStr(), RACE.date);

    const lines = [
      '너는 마라톤 코치다. 아래 러너의 방금 끝난 훈련을 분석해줘.',
      '',
      '## 러너 배경',
      '- 하프 마라톤 기록 2:14:33 (6\'22"/km, 2026년 4월) — 이후 3개월 공백, 7/27 재개',
      '- 정강이(신스프린트) 통증 이력 있음 — 통증 지수 4~5면 훈련 축소, 6+면 중단이 원칙',
      `- 목표 대회: ${RACE.name} (${RACE.date}, D-${dday}) 풀코스 첫 도전`,
      `- 목표 ${RACE.targetFinish} (런워크 포함 ${fmtPace(RACE.targetPaceSec[0])}~${fmtPace(RACE.targetPaceSec[1])}/km) · 컷오프 5:00 (한계 ${fmtPace(RACE.cutoffPaceSec)}/km)`,
      '- 14주 플랜(8/10~11/15): 주 3~4회, 피크 주간 55km, 최장 롱런 28km. 롱런은 런워크 병행.',
      '',
      '## 방금 끝난 훈련',
      '- ' + runLine(run),
    ];

    if (t) lines.push(`- 이 타입(${t.label})의 목표 페이스존: ${fmtPace(t.pace[0])}~${fmtPace(t.pace[1])}/km — ${t.desc}`);
    if (plan) {
      const target = plan.targetKm != null ? plan.targetKm + 'km' : (plan.targetMin ? plan.targetMin + '분' : '');
      lines.push(`- 계획된 세션: ${plan.week}주차 ${plan.date} ${target}` + (plan.note ? ` · 메모: ${plan.note}` : ''));
    }

    if (wk) {
      lines.push('', '## 이번 주 상황',
        `- ${cw}주차 (${WEEK_NOTES[cw] || ''}) · 실행 ${wk.actualKm.toFixed(1)}km / 계획 ${wk.planKm}km` + (ad ? ` · 전체 플랜 달성률 ${ad.pct}%` : ''));
    }
    if (recent.length) {
      lines.push('', '## 직전 기록 (오래된 순)');
      recent.forEach(r => lines.push('- ' + runLine(r)));
    }
    if (np) {
      const target = np.targetKm != null ? np.targetKm + 'km' : (np.targetMin ? np.targetMin + '분' : '');
      lines.push('', '## 다음 예정 훈련',
        `- ${fmtDate(np.date)} ${TYPES[np.type].label} ${target}` + (np.note ? ` · ${np.note}` : ''));
    }

    lines.push('', '## 요청',
      '다음 세 가지를 한국어 일반 텍스트로 답해줘. 마크다운 문법(#, **, 표) 금지, 아래 이모지 라벨만 사용, 전체 12문장 이내:',
      '✅ 세션 평가 — 목표 페이스존·계획 대비 어땠는지, 잘한 점과 아쉬운 점',
      '⚠️ 리스크 체크 — 통증·심박·주간 부하 급증 등 경고 신호가 있는지',
      '👉 다음 훈련 조언 — 다음 예정 세션을 어떻게 소화할지 구체적으로');
    return lines.join('\n');
  }

  /* ---------- AI API 호출 (Gemini / Claude 자동 판별) ---------- */

  function analyze(run) {
    const key = getKey();
    return isGemini(key) ? analyzeGemini(key, run) : analyzeClaude(key, run);
  }

  async function analyzeGemini(key, run) {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: buildPrompt(run) }] }],
        // 2.5-flash는 사고(thinking)가 기본 켜짐 — 끄지 않으면 사고 토큰이
        // maxOutputTokens를 소진해 빈 응답이 올 수 있다.
        generationConfig: { maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { msg = (await res.json()).error.message || msg; } catch {}
      if (res.status === 400 || res.status === 401 || res.status === 403) msg = 'Gemini API 키가 올바르지 않습니다. 가이드 탭에서 다시 설정하세요. (' + msg + ')';
      if (res.status === 429) msg = 'Gemini 무료 한도 초과 — 1분 뒤 🤖 버튼으로 다시 시도하세요.';
      throw new Error(msg);
    }
    const data = await res.json();
    if (data.promptFeedback && data.promptFeedback.blockReason) throw new Error('요청이 차단되었습니다: ' + data.promptFeedback.blockReason);
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const text = parts.map(p => p.text || '').join('').trim();
    if (!text) throw new Error('빈 응답 — 잠시 후 다시 시도하세요.');
    return text;
  }

  async function analyzeClaude(key, run) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'server-side-fallback-2026-07-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-5',
        max_tokens: 16000,
        output_config: { effort: 'low' },
        fallbacks: 'default',
        system: SYSTEM,
        messages: [{ role: 'user', content: buildPrompt(run) }],
      }),
    });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { msg = (await res.json()).error.message || msg; } catch {}
      if (res.status === 401) msg = 'API 키가 올바르지 않습니다. 가이드 탭에서 다시 설정하세요.';
      throw new Error(msg);
    }
    const data = await res.json();
    if (data.stop_reason === 'refusal') throw new Error('모델이 이 요청의 분석을 거부했습니다. 다시 시도해 보세요.');
    return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  }

  /* ---------- 다이얼로그 ---------- */

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  async function copyPrompt(run) {
    const text = buildPrompt(run);
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      // 클립보드 권한 실패 시 구식 방법
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      return ok;
    }
  }

  function open(run) {
    const dlg = document.getElementById('ai-dialog');
    const body = document.getElementById('ai-body');
    body.replaceChildren();

    const copyBtn = el('button', 'btn btn-ghost', '📋 분석 프롬프트 복사 (AI 앱에 붙여넣기)');
    copyBtn.type = 'button';
    copyBtn.addEventListener('click', async () => {
      copyBtn.textContent = (await copyPrompt(run)) ? '✓ 복사됨 — Gemini/Claude 앱에 붙여넣으세요' : '복사 실패';
    });

    if (!getKey()) {
      body.appendChild(el('div', 'muted-line', 'API 키가 없어도 아래 버튼으로 프롬프트를 복사해 Gemini·Claude 앱에서 바로 분석할 수 있습니다. 앱 안에서 자동 분석을 원하면 가이드 탭 → AI 코치 설정에 키를 등록하세요.'));
      body.appendChild(copyBtn);
      dlg.showModal();
      return;
    }

    const loading = el('div', 'ai-loading', isGemini(getKey()) ? '🤖 분석 중…' : '🤖 분석 중… (수십 초 걸릴 수 있어요)');
    body.appendChild(loading);
    dlg.showModal();

    analyze(run).then(text => {
      loading.remove();
      body.appendChild(el('div', 'ai-result', text || '(빈 응답)'));
    }).catch(err => {
      loading.remove();
      body.appendChild(el('div', 'ai-error', '분석 실패: ' + err.message));
      body.appendChild(copyBtn);
    });
  }

  function setupDialog() {
    document.getElementById('ai-close').addEventListener('click', () => document.getElementById('ai-dialog').close());
  }

  /* 기록 저장 직후 훅 — app.js의 submit 핸들러에서 호출 */
  function afterSave(run) {
    if (!autoOn()) return;
    open(run);
  }

  /* ---------- 가이드 탭 설정 카드 ---------- */

  function settingsCard() {
    const card = el('section', 'card');
    card.appendChild(el('div', 'card-title', '🤖 AI 코치 설정'));
    card.appendChild(el('div', 'muted-line', '기록을 저장하면 AI가 바로 세션을 분석합니다. Gemini 키(aistudio.google.com/apikey 에서 무료 발급 — AIza…, AQ.… 등 형식 무관)나 Claude 키(sk-ant-…)를 넣으면 자동 인식합니다. 키는 이 기기(브라우저)에만 저장되며 어디에도 업로드되지 않습니다. 키가 없으면 프롬프트 복사 방식으로 동작합니다.'));

    const row = el('div', 'ai-key-row');
    const input = document.createElement('input');
    input.type = 'password'; input.placeholder = 'Gemini 또는 Claude API 키'; input.autocomplete = 'off';
    input.value = getKey();
    const save = el('button', 'btn btn-primary', '저장');
    save.type = 'button';
    save.addEventListener('click', () => {
      const v = input.value.trim();
      setKey(v);
      save.textContent = v ? (isGemini(v) ? 'Gemini ✓' : 'Claude ✓') : '삭제됨';
      setTimeout(() => save.textContent = '저장', 1500);
    });
    row.append(input, save);
    card.appendChild(row);

    const toggle = el('label', 'ai-toggle');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = autoOn();
    cb.addEventListener('change', () => setAuto(cb.checked));
    toggle.append(cb, document.createTextNode(' 기록 저장 후 자동으로 분석 열기'));
    card.appendChild(toggle);

    return card;
  }

  return { open, afterSave, setupDialog, settingsCard };
})();
