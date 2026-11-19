/* Настоящий мини-GAN на 2D-точках: G и D обучаются попеременно, фон — мнение D. */
import { MLP, randn, ACT } from '../lib/nn.js';
import { LineChart } from '../lib/charts.js';
import { setupCanvas, createLoop, autoPause, bindRange, C } from '../lib/util.js';

const VIEW = 1.7, BATCH = 32;

function sampleReal(target) {
  if (target === 'ring') {
    const a = Math.random() * Math.PI * 2, r = 1.05 + randn() * .05;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }
  if (target === 'square') {
    const side = Math.floor(Math.random() * 4), t = Math.random() * 2.2 - 1.1;
    return side === 0 ? [t, 1.1] : side === 1 ? [t, -1.1] : side === 2 ? [1.1, t] : [-1.1, t];
  }
  const t = Math.random() * Math.PI, up = Math.random() < .5;
  const p = up ? [Math.cos(t), Math.sin(t)] : [1 - Math.cos(t), .5 - Math.sin(t)];
  return [(p[0] - .5) * 1.7 + randn() * .04, (p[1] - .25) * 1.7 + randn() * .04];
}

export function initGAN() {
  const { ctx, st } = setupCanvas(document.getElementById('gan-cv'));
  const chart = new LineChart(document.getElementById('gan-chart'),
    [{ color: C.amber, label: 'D' }, { color: C.magenta2, label: 'G' }], 300);
  const off = document.createElement('canvas'); off.width = off.height = 40;
  const octx = off.getContext('2d');
  let G, D, target = 'ring', realPts = [], fakePts = [], steps = 0, playing = false, frame = 0;
  let lr = .02, spf = 4, showHeat = true, dLoss = 0, gLoss = 0;

  const X = x => (x + VIEW) / (2 * VIEW) * st.w;
  const Y = y => st.h - (y + VIEW) / (2 * VIEW) * st.h;

  function reset() {
    G = new MLP([2, 12, 12, 2], 'tanh');
    D = new MLP([2, 16, 16, 1], 'tanh');
    steps = 0; dLoss = gLoss = 0; chart.reset();
    realPts = Array.from({ length: 220 }, () => sampleReal(target));
    fakePts = [];
    setStatus('нажми «Тренировать»'); sync();
  }
  function trainStep() {
    const z = [], real = [], fake = [];
    for (let i = 0; i < BATCH; i++) {
      z.push([randn() * .8, randn() * .8]);
      real.push(sampleReal(target));
    }
    /* --- обучаем D --- */
    D.zeroGrad(); let dl = 0;
    for (let i = 0; i < BATCH; i++) {
      D.forward(real[i]); dl += D.loss([1]); D.backward([1]);
      const f = G.predict(z[i]); fake.push(f);
      D.forward(f); dl += D.loss([0]); D.backward([0]);
    }
    D.applyGrads(lr, BATCH * 2);
    dLoss = dl / (BATCH * 2);
    /* --- обучаем G (non-saturating): хотим D(G(z)) → 1 --- */
    G.zeroGrad(); let gl = 0;
    for (let i = 0; i < BATCH; i++) {
      const actsG = G.forward(z[i]);
      const f = actsG[actsG.length - 1];
      const dOut = D.predict(f)[0];
      gl += -Math.log(dOut + 1e-9);
      const gIn = D.backwardDelta([dOut - 1], false);
      G.backwardDelta(gIn.map((g, j) => g * ACT.tanh.d(f[j])), true);
    }
    G.applyGrads(lr, BATCH);
    gLoss = gl / BATCH;
    fakePts = fake;
    steps++;
    if (steps % 6 === 0) chart.push([dLoss, gLoss]);
    if (steps % 10 === 0) {
      sync();
      setStatus(steps < 60 ? 'разминка…' :
        gLoss > 2.6 ? 'D слишком силён — G не получает сигнала' :
        dLoss > 1.15 ? 'G обманывает D — D догоняет' : 'идёт борьба ⚔');
    }
  }
  function sync() {
    document.getElementById('gan-steps').textContent = steps;
    document.getElementById('gan-dloss').textContent = dLoss ? dLoss.toFixed(3) : '—';
    document.getElementById('gan-gloss').textContent = gLoss ? gLoss.toFixed(3) : '—';
  }
  function setStatus(s) { document.getElementById('gan-status').textContent = s; }
  function heat() {
    const img = octx.createImageData(40, 40);
    for (let gy = 0; gy < 40; gy++) for (let gx = 0; gx < 40; gx++) {
      const x = -VIEW + 2 * VIEW * gx / 39, y = VIEW - 2 * VIEW * gy / 39;
      const v = D.predict([x, y])[0], i = (gy * 40 + gx) * 4;
      if (v >= .5) { img.data[i] = 34; img.data[i + 1] = 211; img.data[i + 2] = 238; }
      else { img.data[i] = 244; img.data[i + 1] = 63; img.data[i + 2] = 142; }
      img.data[i + 3] = Math.round(Math.abs(v - .5) * 2 * 85);
    }
    octx.putImageData(img, 0, 0);
  }
  function draw() {
    const { w, h } = st; if (w < 10) return;
    ctx.clearRect(0, 0, w, h);
    if (showHeat) {
      if (frame % 12 === 0) heat();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, w, h);
    }
    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.strokeRect(.5, .5, w - 1, h - 1);
    ctx.fillStyle = C.cyan; ctx.globalAlpha = .55;
    for (const p of realPts) { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 2.6, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.fillStyle = C.magenta2; ctx.shadowColor = C.magenta; ctx.shadowBlur = 6;
    for (const p of fakePts) { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), 3.2, 0, 7); ctx.fill(); }
    ctx.shadowBlur = 0;
  }

  const playBtn = document.getElementById('gan-play');
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸ Пауза' : '▶ Тренировать';
    setStatus(playing ? 'борьба началась…' : 'пауза');
  });
  document.getElementById('gan-step').addEventListener('click', () => { trainStep(); sync(); });
  document.getElementById('gan-reset').addEventListener('click', () => { playing = false; playBtn.textContent = '▶ Тренировать'; reset(); });
  document.getElementById('gan-target').addEventListener('change', e => { target = e.target.value; playing = false; playBtn.textContent = '▶ Тренировать'; reset(); });
  bindRange(document.getElementById('gan-lr'), v => v.toFixed(3), v => lr = v);
  bindRange(document.getElementById('gan-speed'), v => v, v => spf = v);
  document.getElementById('gan-heat').addEventListener('change', e => showHeat = e.target.checked);

  reset();
  const loop = createLoop(() => { frame++; if (playing) for (let i = 0; i < spf; i++) trainStep(); draw(); });
  autoPause(document.getElementById('demo-gan'), loop);
}