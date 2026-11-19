/* Песочница: конструктор MLP для OR/AND/XOR на трёх битах. Полный цикл обучения. */
import { MLP } from '../lib/nn.js';
import { LineChart } from '../lib/charts.js';
import { setupCanvas, createLoop, autoPause, bindRange, download, C, fmt, clamp, lerp, distToSeg, REDUCED } from '../lib/util.js';

const COMBOS = Array.from({ length: 8 }, (_, i) => [(i >> 2) & 1, (i >> 1) & 1, i & 1]);
const OPS = { OR: (a, b, c) => a | b | c, AND: (a, b, c) => a & b & c, XOR: (a, b, c) => a ^ b ^ c };

export function initPlayground() {
  const { ctx, st } = setupCanvas(document.getElementById('pg-cv'));
  const chart = new LineChart(document.getElementById('pg-chart'), [{ color: C.violet2, label: 'loss' }], 600);
  const tooltip = document.getElementById('pg-tooltip');
  const cvEl = document.getElementById('pg-cv');

  const S = {
    op: 'XOR', probe: [1, 0, 1], layers: [4], act: 'tanh', lr: .3, speed: 8,
    labels: false, running: false, epoch: 0, loss: 1, solved: false,
    lastCheck: 0, checkLoss: 1, particles: [], hover: null
  };
  let model, nodes = [], edges = [], lastSync = 0, chartAcc = 0;

  const targets = () => COMBOS.map(c => [OPS[S.op](...c)]);
  function rebuild(keepEpoch = false) {
    model = new MLP([3, ...S.layers, 1], S.act);
    if (!keepEpoch) S.epoch = 0;
    S.loss = 1; S.solved = false; S.checkLoss = 1; S.lastCheck = S.epoch;
    S.particles = []; chart.reset(); layout(); sync(true);
  }
  function layout() {
    const cols = [3, ...S.layers, 1];
    const { w, h } = st;
    const padX = Math.max(44, w * .08);
    nodes = []; edges = [];
    const C_ = cols.length;
    cols.forEach((n, ci) => {
      const x = C_ === 1 ? w / 2 : padX + (w - 2 * padX) * ci / (C_ - 1);
      const gap = Math.min(54, (h - 76) / Math.max(1, n - 1));
      for (let j = 0; j < n; j++) {
        const y = h / 2 + (j - (n - 1) / 2) * gap;
        nodes.push({ x, y, col: ci, idx: j, n: cols[ci], act: 0 });
      }
    });
    for (let l = 0; l < model.W.length; l++) {
      const from = nodes.filter(n => n.col === l), to = nodes.filter(n => n.col === l + 1);
      to.forEach(t => from.forEach(f => edges.push({ f, t, l, j: t.idx, k: f.idx })));
    }
  }
  new ResizeObserver(() => { if (st.w > 10) layout(); }).observe(cvEl);

  function trainEpochs(n) {
    const ys = targets();
    for (let i = 0; i < n; i++) {
      S.loss = model.trainBatch(COMBOS, ys, S.lr);
      S.epoch++; chartAcc++;
      if (chartAcc >= Math.max(1, Math.ceil(S.speed / 4))) { chart.push([S.loss]); chartAcc = 0; }
    }
    const a = accuracy();
    if (a === 8 && !S.solved) {
      S.solved = true; S.running = false;
      playBtn.textContent = '▶ Обучать';
      chart.push([S.loss]);
      const out = nodes.find(nd => nd.col === nodes[nodes.length - 1].col);
      if (out && !REDUCED) for (let i = 0; i < 70; i++) {
        const ang = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.4;
        S.particles.push({ x: out.x, y: out.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1, life: 1, c: [C.lime, C.cyan, C.magenta2, C.amber][i % 4] });
      }
    }
    if (a < 8) S.solved = false;
  }
  function accuracy() {
    const ys = targets(); let ok = 0;
    COMBOS.forEach((c, i) => { if ((model.predict(c)[0] >= .5 ? 1 : 0) === ys[i][0]) ok++; });
    return ok;
  }
  function hint() {
    const a = accuracy();
    if (S.op === 'XOR' && S.layers.length === 0)
      return '⚠ XOR линейно неразделим: без скрытого слоя сеть обречена (проблема Минского, 1969). Добавь слой — и всё получится.';
    if (S.solved) return `🎉 Решено за ${S.epoch} эпох! Поэкспериментируй: меньше нейронов? другой lr? другая активация?`;
    if (S.epoch - S.lastCheck >= 600) {
      const stuck = Math.abs(S.loss - S.checkLoss) < .002 && a < 8;
      S.lastCheck = S.epoch; S.checkLoss = S.loss;
      if (stuck) return S.act === 'relu'
        ? 'Похоже, застряла. ReLU на маленьких сетях часто «умирает» (все нули) — попробуй tanh или сбрось веса.'
        : 'Похоже, плато. Попробуй: больше нейронов, другой lr (0.1–0.5), сброс весов или tanh вместо сигмоиды.';
    }
    if (S.running) return 'Идёт градиентный спуск: каждая эпоха — forward и backward по всем 8 комбинациям.';
    return 'Нажми «Обучать» или прогони одну эпоху кнопкой «1 эпоха».';
  }
  function sync(force) {
    const t = performance.now();
    if (!force && t - lastSync < 140) return;
    lastSync = t;
    const ys = targets(), a = accuracy();
    document.getElementById('pg-epoch').textContent = S.epoch;
    document.getElementById('pg-acc').textContent = a + '/8';
    document.getElementById('pg-loss').textContent = S.loss.toFixed(4);
    document.getElementById('pg-params').textContent = model.paramCount();
    document.getElementById('pg-status').textContent =
      S.solved ? `решено за ${S.epoch} эпох 🎉` : S.running ? 'учится…' : 'пауза';
    document.getElementById('pg-hint').textContent = hint();
    document.getElementById('pg-table').innerHTML = COMBOS.map((c, i) => {
      const p = model.predict(c)[0], ok = (p >= .5 ? 1 : 0) === ys[i][0];
      const cur = c.join() === S.probe.join();
      return `<tr data-row="${i}" class="${cur ? 'cur' : ''}"><td>${c[0]}</td><td>${c[1]}</td><td>${c[2]}</td><td>${ys[i][0]}</td><td>${p.toFixed(3)}</td><td class="${ok ? 'yes' : 'no'}">${ok ? '✓' : '✗'}</td></tr>`;
    }).join('');
  }
  document.getElementById('pg-table').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-row]');
    if (!tr) return;
    S.probe = [...COMBOS[+tr.dataset.row]];
    syncProbe(); sync(true);
  });

  /* --- отрисовка --- */
  function draw(t) {
    const { w, h } = st; if (w < 10 || !nodes.length) return;
    ctx.clearRect(0, 0, w, h);
    const acts = model.forward(S.probe);
    nodes.forEach(n => n.act = acts[n.col][n.idx]);
    const pulseSpeed = S.running ? .00045 * (1 + S.speed / 12) : .00018;
    for (const e of edges) {
      const wgt = model.W[e.l][e.j][e.k], aw = Math.min(1, Math.abs(wgt) / 2.2);
      ctx.strokeStyle = wgt >= 0 ? `rgba(34,211,238,${.14 + .5 * aw})` : `rgba(244,63,142,${.14 + .5 * aw})`;
      ctx.lineWidth = .6 + 3.6 * aw;
      ctx.beginPath(); ctx.moveTo(e.f.x, e.f.y); ctx.lineTo(e.t.x, e.t.y); ctx.stroke();
      const flow = aw * e.f.act;
      if (!REDUCED && flow > .04) {
        const p = ((t * pulseSpeed) + (e.l * 7 + e.j * 13 + e.k * 5) * .113) % 1;
        ctx.fillStyle = wgt >= 0 ? C.cyan2 : C.magenta2;
        ctx.globalAlpha = clamp(flow + .15, 0, 1);
        ctx.beginPath(); ctx.arc(lerp(e.f.x, e.t.x, p), lerp(e.f.y, e.t.y, p), 2.1, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (S.labels && edges.length <= 48) {
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillStyle = wgt >= 0 ? C.cyan : C.magenta2;
        ctx.fillText(fmt(wgt, 1), (e.f.x + e.t.x) / 2 - 10, (e.f.y + e.t.y) / 2 - 3);
      }
    }
    const lastCol = nodes[nodes.length - 1].col;
    const target = OPS[S.op](...S.probe);
    for (const n of nodes) {
      const isIn = n.col === 0, isOut = n.col === lastCol;
      const r = isIn ? 17 : isOut ? 19 : 14;
      const base = isIn ? C.cyan : isOut ? C.lime : C.violet;
      ctx.fillStyle = base + Math.round(20 + clamp(n.act, 0, 1) * 110).toString(16).padStart(2, '0');
      ctx.strokeStyle = base; ctx.lineWidth = 1.6;
      if (isOut) {
        const ok = (n.act >= .5 ? 1 : 0) === target;
        ctx.strokeStyle = ok ? C.ok : C.red;
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = S.solved ? 18 : 8;
      }
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      if (isIn) {
        ctx.fillStyle = C.text; ctx.font = '800 12px "JetBrains Mono", monospace';
        ctx.fillText('ABC'[n.idx], n.x, n.y - 3);
        ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.fillStyle = C.cyan2;
        ctx.fillText(S.probe[n.idx], n.x, n.y + 10);
      } else {
        ctx.fillStyle = C.text; ctx.font = '600 9.5px "JetBrains Mono", monospace';
        ctx.fillText(n.act.toFixed(2), n.x, n.y + 3);
        if (isOut) {
          ctx.fillStyle = C.faint; ctx.font = '600 9px "JetBrains Mono", monospace';
          ctx.fillText(`ŷ · цель ${target}`, n.x, n.y - r - 8);
        }
      }
      ctx.textAlign = 'left';
    }
    S.particles = S.particles.filter(p => p.life > 0);
    for (const p of S.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += .06; p.life -= .016;
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* --- hover-инспекция --- */
  cvEl.addEventListener('pointermove', e => {
    const r = cvEl.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let txt = null;
    for (const n of nodes) if (Math.hypot(x - n.x, y - n.y) < 20) {
      const name = n.col === 0 ? 'Вход ' + 'ABC'[n.idx] : n.col === nodes[nodes.length - 1].col ? 'Выход ŷ' : `Слой ${n.col} · нейрон ${n.idx + 1}`;
      const b = n.col === 0 ? null : model.B[n.col - 1][n.idx];
      txt = `${name}\na = ${n.act.toFixed(3)}${b !== null ? `\nbias = ${fmt(b, 3)}` : ''}`;
      break;
    }
    if (!txt) for (const ed of edges) {
      if (distToSeg(x, y, ed.f.x, ed.f.y, ed.t.x, ed.t.y) < 5) {
        txt = `вес = ${fmt(model.W[ed.l][ed.j][ed.k], 3)}`; break;
      }
    }
    if (txt) {
      tooltip.textContent = txt;
      tooltip.classList.remove('hide');
      tooltip.style.left = clamp(x + 14, 4, st.w - 150) + 'px';
      tooltip.style.top = clamp(y - 12, 4, st.h - 50) + 'px';
    } else tooltip.classList.add('hide');
  });
  cvEl.addEventListener('pointerleave', () => tooltip.classList.add('hide'));

  /* --- контролы --- */
  const playBtn = document.getElementById('pg-play');
  playBtn.addEventListener('click', () => {
    S.running = !S.running;
    playBtn.textContent = S.running ? '⏸ Пауза' : '▶ Обучать';
    sync(true);
  });
  document.getElementById('pg-step').addEventListener('click', () => { trainEpochs(1); chart.push([S.loss]); sync(true); });
  document.getElementById('pg-reset').addEventListener('click', () => { rebuild(); });
  document.getElementById('pg-op').addEventListener('click', e => {
    const b = e.target.closest('[data-op]'); if (!b) return;
    S.op = b.dataset.op;
    document.querySelectorAll('#pg-op .seg-btn').forEach(x => x.classList.toggle('active', x === b));
    S.epoch = 0; S.solved = false; S.checkLoss = S.loss; S.lastCheck = 0; chart.reset();
    sync(true);
  });
  const probeBtns = ['pg-a', 'pg-b', 'pg-c'].map(id => document.getElementById(id));
  function syncProbe() {
    probeBtns.forEach((b, i) => {
      b.classList.toggle('on', S.probe[i] === 1);
      b.querySelector('span').textContent = S.probe[i];
    });
  }
  probeBtns.forEach((b, i) => b.addEventListener('click', () => { S.probe[i] ^= 1; syncProbe(); sync(true); }));

  const layerRows = document.getElementById('pg-layerrows');
  function renderLayers() {
    document.getElementById('pg-lval').textContent = S.layers.length;
    layerRows.innerHTML = S.layers.map((n, i) =>
      `<div class="layer-row"><span>Слой ${i + 1} · нейронов</span><div class="step"><button class="step-btn" data-l="${i}" data-d="-1">−</button><span class="step-val">${n}</span><button class="step-btn" data-l="${i}" data-d="1">+</button></div></div>`).join('') ||
      '<p class="muted sm">Скрытых слоёв нет: входы соединены с выходом напрямую (линейная модель).</p>';
  }
  layerRows.addEventListener('click', e => {
    const b = e.target.closest('[data-l]'); if (!b) return;
    const i = +b.dataset.l, nv = clamp(S.layers[i] + +b.dataset.d, 1, 8);
    if (nv !== S.layers[i]) { S.layers[i] = nv; renderLayers(); rebuild(); }
  });
  document.getElementById('pg-lminus').addEventListener('click', () => { if (S.layers.length > 0) { S.layers.pop(); renderLayers(); rebuild(); } });
  document.getElementById('pg-lplus').addEventListener('click', () => { if (S.layers.length < 4) { S.layers.push(4); renderLayers(); rebuild(); } });
  document.getElementById('pg-act').addEventListener('change', e => { S.act = e.target.value; rebuild(); });
  bindRange(document.getElementById('pg-lr'), v => v.toFixed(2), v => S.lr = v);
  bindRange(document.getElementById('pg-speed'), v => v, v => S.speed = v);
  document.getElementById('pg-labels').addEventListener('change', e => S.labels = e.target.checked);

  const PRESETS = {
    fast: { op: 'XOR', layers: [4], act: 'tanh', lr: .35, speed: 12 },
    deep: { op: 'XOR', layers: [4, 4, 4], act: 'tanh', lr: .25, speed: 12 },
    linear: { op: 'XOR', layers: [], act: 'sigmoid', lr: .3, speed: 12 }
  };
  const lrR = bindRange(document.getElementById('pg-lr'), v => v.toFixed(2), v => S.lr = v);
  const spR = bindRange(document.getElementById('pg-speed'), v => v, v => S.speed = v);
  document.querySelectorAll('[data-pgpreset]').forEach(b => b.addEventListener('click', () => {
    const p = PRESETS[b.dataset.pgpreset];
    S.op = p.op; S.layers = [...p.layers]; S.act = p.act;
    document.querySelectorAll('#pg-op .seg-btn').forEach(x => x.classList.toggle('active', x.dataset.op === p.op));
    document.getElementById('pg-act').value = p.act;
    lrR.set(p.lr); spR.set(p.speed);
    renderLayers(); rebuild();
    S.running = true; playBtn.textContent = '⏸ Пауза'; sync(true);
  }));

  document.getElementById('pg-export').addEventListener('click', () => {
    const ys = targets();
    download('neuro-lab-model.json', JSON.stringify({
      task: S.op, inputs: ['A', 'B', 'C'], epochs: S.epoch, accuracy: accuracy() + '/8',
      loss: S.loss, learningRate: S.lr, activation: S.act,
      model: model.toJSON(),
      predictions: COMBOS.map((c, i) => ({ input: c, target: ys[i][0], output: +model.predict(c)[0].toFixed(4) }))
    }, null, 2));
  });

  renderLayers(); syncProbe(); rebuild();
  const loop = createLoop((dt, t) => {
    if (S.running) trainEpochs(S.speed);
    draw(t); sync(false);
  });
  autoPause(document.getElementById('demo-pg'), loop);
}