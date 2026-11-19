/* LLM-демо: токенизация, внимание (учебные матрицы), генерация с настоящим softmax. */
import { setupCanvas, createLoop, autoPause, bindRange, C, PALETTE, clamp } from '../lib/util.js';

/* ---------- токенизатор ---------- */
const WHOLE = new Set(['и', 'в', 'на', 'не', 'что', 'я', 'ты', 'он', 'она', 'мы', 'вы', 'с', 'по', 'но', 'а', 'как', 'это', 'нейросети', 'нейросеть', 'учатся', 'обучение', 'данные', 'модель', 'сеть', 'примерах', 'правилах']);
function tokenize(text) {
  const out = [];
  const parts = text.match(/[а-яёa-z0-9]+|[^\sа-яёa-z0-9]/gi) || [];
  for (const p of parts) {
    const low = p.toLowerCase();
    if (p.length <= 4 || WHOLE.has(low) || !/[а-яёa-z]/i.test(p)) out.push({ t: p, cont: false });
    else {
      out.push({ t: p.slice(0, 4), cont: false });
      for (let i = 4; i < p.length; i += 3) out.push({ t: p.slice(i, i + 3), cont: true });
    }
  }
  return out;
}
const tokId = s => { let h = 7; for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h % 50000; };

function initTokens() {
  const input = document.getElementById('tok-input');
  const render = () => {
    const toks = tokenize(input.value);
    document.getElementById('tok-chips').innerHTML = toks.map((tk, i) => {
      const col = PALETTE[i % PALETTE.length];
      return `<span class="tok-chip${tk.cont ? ' cont' : ''}" style="color:${col};border-color:${col}55;background:${col}12">${tk.cont ? '##' : ''}${tk.t.replace(/</g, '&lt;')}<small>id ${tokId(tk.t.toLowerCase())}</small></span>`;
    }).join('') || '<span class="muted sm">введи текст…</span>';
    const chars = input.value.replace(/\s/g, '').length;
    document.getElementById('tok-stats').innerHTML =
      `<div class="stat"><b>${input.value.length}</b><span>символов</span></div>
       <div class="stat"><b>${toks.length}</b><span>токенов</span></div>
       <div class="stat"><b>${toks.length ? (chars / toks.length).toFixed(1) : '—'}</b><span>симв/токен</span></div>`;
  };
  input.addEventListener('input', render);
  render();
}

/* ---------- внимание ---------- */
const ATT = [
  {
    tokens: ['Кот', 'сел', 'на', 'коврик', 'потому', 'что', 'он', 'устал'], sel: 6,
    rows: [[1], [.75, .25], [.15, .6, .25], [.2, .35, .15, .3], [.15, .4, .05, .2, .2], [.05, .15, .05, .15, .45, .15], [.55, .08, .02, .12, .06, .02, .15], [.38, .2, .02, .05, .05, .02, .18, .1]],
    note: '«он» сильнее всего смотрит на «Кот» (≈55%) — так модель понимает, КТО устал. Это кореференция, которую attention решает без всяких правил грамматики.'
  },
  {
    tokens: ['Маша', 'взяла', 'зонт', 'потому', 'что', 'шёл', 'дождь'], sel: 6,
    rows: [[1], [.6, .4], [.3, .45, .25], [.15, .25, .4, .2], [.05, .1, .2, .4, .25], [.05, .1, .3, .15, .1, .3], [.1, .05, .35, .1, .05, .25, .1]],
    note: '«дождь» подтягивает контекст у «зонт» и «шёл» — внимание собирает причину события через всю фразу, минуя промежуточные слова. RNN пришлось бы нести это в памяти.'
  },
  {
    tokens: ['Робот', 'поднял', 'мяч', 'и', 'бросил', 'его'], sel: 5,
    rows: [[1], [.55, .45], [.25, .4, .35], [.1, .2, .3, .4], [.3, .15, .2, .1, .25], [.1, .15, .45, .05, .15, .1]],
    note: '«его» смотрит на «мяч», а не на «Робот»: внимание различает роли объектов. В реальной модели таких карт внимания десятки голов × десятки слоёв, и каждая ловит свои связи.'
  }
];

function initAttention() {
  const heat = setupCanvas(document.getElementById('att-heat'));
  let cur = 0, sel = ATT[0].sel;
  const norm = rows => rows.map(r => { const s = r.reduce((a, b) => a + b, 0); return r.map(v => v / s); });

  function render() {
    const data = ATT[cur], rows = norm(data.rows);
    const chips = document.getElementById('att-chips');
    chips.innerHTML = data.tokens.map((t, i) => {
      const w = i <= sel ? rows[sel][i] : 0;
      return `<button class="att-chip${i === sel ? ' sel' : i > sel ? ' dim' : ''}" data-i="${i}" style="${i !== sel && i <= sel ? `border-color:${C.cyan};opacity:${.35 + .65 * w / Math.max(...rows[sel])}` : ''}">${t}</button>`;
    }).join('');
    chips.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { sel = +b.dataset.i; render(); }));
    const pairs = rows[sel].map((w, j) => ({ t: data.tokens[j], w })).sort((a, b) => b.w - a.w).slice(0, 6);
    document.getElementById('att-bars').innerHTML = pairs.map(p =>
      `<div class="bar-row"><span>${p.t}</span><div class="bar-track"><i style="width:${(p.w * 100).toFixed(1)}%"></i></div><em>${(p.w * 100).toFixed(0)}%</em></div>`).join('');
    document.getElementById('att-note').textContent = data.note;
    drawHeat(rows);
  }
  function drawHeat(rows) {
    const { ctx, st } = heat; const { w, h } = st; if (w < 10) return;
    const data = ATT[cur], n = data.tokens.length;
    ctx.clearRect(0, 0, w, h);
    const left = 58, top = 20;
    const cell = Math.min((w - left - 8) / n, (h - top - 8) / n);
    ctx.font = '600 9px "JetBrains Mono", monospace';
    data.tokens.forEach((t, i) => {
      ctx.fillStyle = i === sel ? C.amber : C.faint;
      ctx.fillText(t.slice(0, 6), 4, top + i * cell + cell / 2 + 3);
      ctx.save(); ctx.translate(left + i * cell + cell / 2, top - 5);
      ctx.fillText(t.slice(0, 4), -8, 0); ctx.restore();
    });
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (j > i) { ctx.fillStyle = 'rgba(35,44,78,.35)'; }
      else {
        const v = rows[i][j];
        ctx.fillStyle = `rgba(34,211,238,${.06 + .9 * v})`;
      }
      ctx.fillRect(left + j * cell, top + i * cell, cell - 2, cell - 2);
    }
    ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
    ctx.strokeRect(left - 1, top + sel * cell - 1, n * cell, cell);
  }
  document.getElementById('att-preset').addEventListener('change', e => { cur = +e.target.value; sel = ATT[cur].sel; render(); });
  const loop = createLoop(() => drawHeat(norm(ATT[cur].rows)));
  autoPause(document.getElementById('ltab-attn'), loop);
  render();
}

/* ---------- генерация ---------- */
const SCRIPTS = [
  { start: 'Столица Франции —', steps: [
    { 'Париж': 4.6, 'Лион': 1.4, 'город': 2.2, 'это': 1.0 },
    { '.': 2.6, ',': 2.2, ' —': 1.4, '!': 1.0 },
    { ' Это': 2.6, ' Он': 1.8, ' Здесь': 1.6 },
    { ' город': 2.8, ' центр': 1.6, ' место': 1.4 },
    { ' света': 2.2, ' любви': 1.8, ' моды': 2.0 },
    { '.': 3.2, '!': 1.2 } ] },
  { start: 'Нейросети учатся', steps: [
    { ' на': 3.4, ' находить': 1.8, ' быстро': 1.2 },
    { ' примерах': 3.6, ' данных': 2.8, ' ошибках': 1.4 },
    { ' и': 2.2, '.': 2.6, ',': 1.4 },
    { ' находят': 2.0, ' обобщают': 1.8, ' строят': 1.6 },
    { ' закономерности': 3.4, ' правила': 2.2, ' связи': 1.8 },
    { '.': 3.0, '!': 1.0 } ] },
  { start: 'Сегодня погода', steps: [
    { ' в': 2.8, ' —': 1.8, ' была': 1.6 },
    { ' Калининграде': 2.6, ' городе': 1.8, ' Москве': 1.6 },
    { ' переменчивая': 2.2, ' солнечная': 2.0, ' дождливая': 1.8 },
    { '.': 2.8, ',': 1.6 },
    { ' но': 2.0, ' и': 1.4 },
    { ' тёплая': 2.2, ' ветреная': 1.6, ' красивая': 1.4 },
    { '.': 3.0 } ] }
];
const FALLBACK = { '.': 3.0, '!': 1.0, ' …': .8 };

function initGeneration() {
  let cur = 0, stepI = 0, temp = .7, pieces = [], done = false;
  const softmax = logits => {
    const entries = Object.entries(logits);
    const mx = Math.max(...entries.map(([, v]) => v));
    const ex = entries.map(([t, v]) => [t, Math.exp((v - mx) / temp)]);
    const s = ex.reduce((a, [, v]) => a + v, 0);
    return ex.map(([t, v]) => ({ t, p: v / s })).sort((a, b) => b.p - a.p);
  };
  const currentLogits = () => stepI < SCRIPTS[cur].steps.length ? SCRIPTS[cur].steps[stepI] : FALLBACK;
  function renderBars() {
    const probs = softmax(currentLogits()).slice(0, 5);
    document.getElementById('gen-bars').innerHTML = probs.map(p =>
      `<div class="bar-row"><span>${p.t === ' ' ? '␣' : p.t.replace(/^ /, '␣')}</span><div class="bar-track"><i style="width:${(p.p * 100).toFixed(1)}%"></i></div><em>${(p.p * 100).toFixed(0)}%</em></div>`).join('');
  }
  function renderText(newIdx = -1) {
    document.getElementById('gen-text').innerHTML =
      `<span>${SCRIPTS[cur].start}</span>` + pieces.map((p, i) =>
        `<span class="gen-chip${i === newIdx ? ' new' : ''}">${p.replace(/^ /, '&nbsp;')}</span>`).join('');
  }
  function reset() {
    stepI = 0; pieces = []; done = false;
    renderText(); renderBars();
    document.getElementById('gen-status').textContent = 'T→0 — жадно и уверенно; T↑ — случайнее и «творчнее». Жми «Сэмплировать».';
  }
  function emit(greedy) {
    if (done) return;
    const probs = softmax(currentLogits());
    let pick = probs[0];
    if (!greedy) {
      let r = Math.random();
      for (const p of probs) { r -= p.p; if (r <= 0) { pick = p; break; } }
    }
    pieces.push(pick.t); stepI++;
    renderText(pieces.length - 1);
    if (pieces.length >= 12 || (pick.t.trim() === '.' && pieces.length > 3) || stepI > SCRIPTS[cur].steps.length + 1) {
      done = true;
      document.getElementById('gen-status').textContent = 'Стоп: демо-сценарий завершён. Сбрось и попробуй другую температуру!';
      document.getElementById('gen-bars').innerHTML = '<span class="muted sm">генерация завершена</span>';
      return;
    }
    renderBars();
    document.getElementById('gen-status').textContent =
      `${greedy ? 'Жадно взяли' : 'Сэмплировали'} «${pick.t.trim()}» (p=${(pick.p * 100).toFixed(0)}%, T=${temp.toFixed(2)}). Выбранный токен дописан ко входу — это авторегрессия.`;
  }
  document.getElementById('gen-preset').addEventListener('change', e => { cur = +e.target.value; reset(); });
  document.getElementById('gen-reset').addEventListener('click', reset);
  document.getElementById('gen-sample').addEventListener('click', () => emit(false));
  document.getElementById('gen-greedy').addEventListener('click', () => emit(true));
  bindRange(document.getElementById('gen-temp'), v => v.toFixed(2), v => { temp = v; if (!done) renderBars(); });
  reset();
}

/* ---------- вкладки ---------- */
export function initTransformer() {
  document.querySelectorAll('[data-ltab]').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('[data-ltab]').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.tabpanel').forEach(p => p.classList.toggle('active', p.id === 'ltab-' + btn.dataset.ltab));
  }));
  initTokens(); initAttention(); initGeneration();
}