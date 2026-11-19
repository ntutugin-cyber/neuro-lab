/* Два демо: обучение с учителем (линейный классификатор) и без учителя (k-means). */
import { MLP, randn } from '../lib/nn.js';
import { LineChart } from '../lib/charts.js';
import { setupCanvas, createLoop, autoPause, bindRange, C, PALETTE, clamp } from '../lib/util.js';

export function initSupervised() {
  const { ctx, st } = setupCanvas(document.getElementById('sup-cv'));
  const chart = new LineChart(document.getElementById('sup-chart'), [{ color: C.lime, label: 'loss' }], 300);
  const off = document.createElement('canvas'); off.width = off.height = 44;
  const octx = off.getContext('2d');
  let model, pts, epoch = 0, playing = false, frame = 0, lastLoss = 1;
  let lr = bindRange(document.getElementById('sup-lr'), v => v.toFixed(2), v => lrVal = v).get();
  let lrVal = lr;

  const W2X = x => (x + 1.7) / 3.4 * st.w, W2Y = y => st.h - (y + 1.7) / 3.4 * st.h;

  function genData() {
    pts = [];
    const centers = [[-.6 + randn() * .12, -.45 + randn() * .12], [.6 + randn() * .12, .5 + randn() * .12]];
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < 42; i++)
        pts.push({ x: clamp(centers[c][0] + randn() * .26, -1.6, 1.6), y: clamp(centers[c][1] + randn() * .26, -1.6, 1.6), c });
  }
  function reset() {
    model = new MLP([2, 1]); epoch = 0; lastLoss = 1; chart.reset();
    setStatus('готова'); sync();
  }
  function step() {
    const xs = pts.map(p => [p.x, p.y]), ys = pts.map(p => [p.c]);
    lastLoss = model.trainBatch(xs, ys, lrVal);
    epoch++;
    if (epoch % 2 === 0) chart.push([lastLoss]);
    if (lastLoss < 0.035 && playing) { playing = false; playBtn.textContent = '▶ Обучать'; setStatus('сошлось ✓'); }
    sync();
  }
  function acc() {
    let ok = 0;
    for (const p of pts) if ((model.predict([p.x, p.y])[0] >= .5 ? 1 : 0) === p.c) ok++;
    return ok / pts.length;
  }
  function setStatus(s) { document.getElementById('sup-status').textContent = s; }
  function sync() {
    document.getElementById('sup-epoch').textContent = epoch;
    document.getElementById('sup-loss').textContent = lastLoss.toFixed(3);
    document.getElementById('sup-acc').textContent = Math.round(acc() * 100) + '%';
  }
  function heat() {
    const img = octx.createImageData(44, 44);
    for (let gy = 0; gy < 44; gy++) for (let gx = 0; gx < 44; gx++) {
      const x = -1.7 + 3.4 * gx / 43, y = 1.7 - 3.4 * gy / 43;
      const v = model.predict([x, y])[0], i = (gy * 44 + gx) * 4;
      if (v >= .5) { img.data[i] = 244; img.data[i + 1] = 63; img.data[i + 2] = 142; }
      else { img.data[i] = 34; img.data[i + 1] = 211; img.data[i + 2] = 238; }
      img.data[i + 3] = Math.round(Math.abs(v - .5) * 2 * 70);
    }
    octx.putImageData(img, 0, 0);
  }
  function draw() {
    const { w, h } = st; if (w < 10) return;
    ctx.clearRect(0, 0, w, h);
    if (frame % 6 === 0) heat();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, w, h);
    const w1 = model.W[0][0][0], w2 = model.W[0][0][1], b = model.B[0][0];
    ctx.strokeStyle = C.lime; ctx.lineWidth = 2.5; ctx.shadowColor = C.lime; ctx.shadowBlur = 10;
    ctx.beginPath();
    if (Math.abs(w2) > Math.abs(w1)) {
      ctx.moveTo(W2X(-1.7), W2Y(-(w1 * -1.7 + b) / w2));
      ctx.lineTo(W2X(1.7), W2Y(-(w1 * 1.7 + b) / w2));
    } else if (Math.abs(w1) > 1e-6) {
      ctx.moveTo(W2X(-(w2 * -1.7 + b) / w1), W2Y(-1.7));
      ctx.lineTo(W2X(-(w2 * 1.7 + b) / w1), W2Y(1.7));
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    for (const p of pts) {
      const pred = model.predict([p.x, p.y])[0] >= .5 ? 1 : 0;
      ctx.fillStyle = p.c ? C.magenta2 : C.cyan;
      ctx.beginPath(); ctx.arc(W2X(p.x), W2Y(p.y), 4, 0, 7); ctx.fill();
      if (pred !== p.c) {
        ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(W2X(p.x), W2Y(p.y), 7, 0, 7); ctx.stroke();
      }
    }
  }
  const playBtn = document.getElementById('sup-play');
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸ Пауза' : '▶ Обучать';
    setStatus(playing ? 'учится…' : 'пауза');
  });
  document.getElementById('sup-step').addEventListener('click', () => { step(); });
  document.getElementById('sup-reset').addEventListener('click', reset);
  document.getElementById('sup-data').addEventListener('click', () => { genData(); reset(); });
  genData(); reset();
  const loop = createLoop(() => { frame++; if (playing) { step(); step(); } draw(); });
  autoPause(document.getElementById('sup-cv'), loop);
}

export function initKmeans() {
  const { ctx, st } = setupCanvas(document.getElementById('km-cv'));
  let k = 3, pts = [], cents = [], iter = 0, auto = false, lastT = 0, anim = null, inertia = 0;
  const W2X = x => (x + 1.7) / 3.4 * st.w, W2Y = y => st.h - (y + 1.7) / 3.4 * st.h;

  function genPts() {
    pts = [];
    const cs = [[-.8, -.6], [.75, -.35], [-.05, .8]];
    for (const c of cs) for (let i = 0; i < 32; i++)
      pts.push({ x: clamp(c[0] + randn() * .24, -1.6, 1.6), y: clamp(c[1] + randn() * .24, -1.6, 1.6), a: 0 });
    initCents();
  }
  function initCents() {
    cents = Array.from({ length: k }, () => {
      const p = pts[Math.floor(Math.random() * pts.length)];
      return { x: p.x + randn() * .1, y: p.y + randn() * .1, tx: p.x, ty: p.y };
    });
    iter = 0; anim = null; assign(); sync(); setStatus('готов');
  }
  function assign() {
    inertia = 0;
    for (const p of pts) {
      let best = 0, bd = 1e9;
      cents.forEach((c, i) => {
        const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      p.a = best; inertia += bd;
    }
    inertia /= pts.length;
  }
  function step() {
    assign();
    const sums = cents.map(() => ({ x: 0, y: 0, n: 0 }));
    for (const p of pts) { const s = sums[p.a]; s.x += p.x; s.y += p.y; s.n++; }
    let move = 0;
    cents.forEach((c, i) => {
      if (sums[i].n) {
        c.tx = sums[i].x / sums[i].n; c.ty = sums[i].y / sums[i].n;
        move = Math.max(move, Math.hypot(c.tx - c.x, c.ty - c.y));
      } else { c.tx = c.x; c.ty = c.y; }
    });
    anim = { t: 0, from: cents.map(c => ({ x: c.x, y: c.y })) };
    iter++;
    setStatus(move < .01 ? 'кластеры устойчивы ✓' : 'центры едут…');
    if (move < .01 && auto) toggleAuto(false);
    sync();
  }
  function sync() {
    document.getElementById('km-iter').textContent = iter;
    document.getElementById('km-inertia').textContent = inertia.toFixed(3);
    document.getElementById('km-kstat').textContent = k;
    document.getElementById('km-kval').textContent = k;
  }
  function setStatus(s) { document.getElementById('km-status').textContent = s; }
  const autoBtn = document.getElementById('km-auto');
  function toggleAuto(v) {
    auto = v === undefined ? !auto : v;
    autoBtn.textContent = auto ? '⏸ Пауза' : '▶ Авто';
    if (auto) setStatus('итерируем…');
  }
  autoBtn.addEventListener('click', () => toggleAuto());
  document.getElementById('km-step').addEventListener('click', step);
  document.getElementById('km-data').addEventListener('click', () => { genPts(); });
  document.getElementById('km-kminus').addEventListener('click', () => { if (k > 2) { k--; initCents(); } });
  document.getElementById('km-kplus').addEventListener('click', () => { if (k < 5) { k++; initCents(); } });

  function draw(dt) {
    const { w, h } = st; if (w < 10) return;
    if (anim) {
      anim.t = Math.min(1, anim.t + dt / 380);
      const e = 1 - (1 - anim.t) ** 3;
      cents.forEach((c, i) => { c.x = anim.from[i].x + (c.tx - anim.from[i].x) * e; c.y = anim.from[i].y + (c.ty - anim.from[i].y) * e; });
      if (anim.t >= 1) { anim = null; assign(); sync(); }
    }
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      ctx.fillStyle = PALETTE[p.a]; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.arc(W2X(p.x), W2Y(p.y), 3.4, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    cents.forEach((c, i) => {
      const x = W2X(c.x), y = W2Y(c.y);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE[i]; ctx.shadowColor = PALETTE[i]; ctx.shadowBlur = 14;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.shadowBlur = 0; ctx.strokeStyle = '#0b1020'; ctx.lineWidth = 2; ctx.strokeRect(-7, -7, 14, 14);
      ctx.restore();
    });
  }
  genPts();
  const loop = createLoop((dt, t) => { if (auto && !anim && t - lastT > 520) { lastT = t; step(); } draw(dt); });
  autoPause(document.getElementById('km-cv'), loop);
}