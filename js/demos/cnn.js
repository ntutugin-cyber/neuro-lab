/* CNN: свёртка 3×3 по картинке 32×32, анимация окна, pooling, кисть, инспекция. */
import { setupCanvas, createLoop, autoPause, bindRange, C, diverging, clamp } from '../lib/util.js';

const N = 32, M = 30;
const KERNELS = {
  sobelX: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
  sobelY: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
  laplace: [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]],
  blur: [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]],
  sharpen: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]]
};

export function initCNN() {
  const cin = setupCanvas(document.getElementById('cnn-in'));
  const cout = setupCanvas(document.getElementById('cnn-out'));
  const cpool = setupCanvas(document.getElementById('cnn-pool'));
  let gray = new Float32Array(N * N), map = new Float32Array(M * M), pool = new Float32Array(15 * 15);
  let kernel = 'sobelX', idx = 0, playing = false, speed = 6, pooling = false, brush = false;
  let inspect = -1, painting = false, mmin = 0, mmax = 1;

  function baseImage() {
    const off = document.createElement('canvas'); off.width = off.height = N;
    const o = off.getContext('2d');
    o.fillStyle = '#000'; o.fillRect(0, 0, N, N);
    o.fillStyle = '#fff';
    o.beginPath(); o.arc(10, 10, 6, 0, 7); o.fill();
    o.fillRect(19, 19, 9, 9);
    o.strokeStyle = '#fff'; o.lineWidth = 2.4;
    o.beginPath(); o.moveTo(3, 29); o.lineTo(15, 21); o.stroke();
    o.beginPath(); o.moveTo(22, 4); o.lineTo(29, 12); o.lineTo(22, 12); o.closePath(); o.fill();
    const d = o.getImageData(0, 0, N, N).data;
    for (let i = 0; i < N * N; i++) gray[i] = d[i * 4] / 255;
  }
  function convolve() {
    const K = KERNELS[kernel];
    mmin = 1e9; mmax = -1e9;
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
      let s = 0;
      for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++)
        s += gray[(y + ky) * N + x + kx] * K[ky][kx];
      map[y * M + x] = s;
      if (s < mmin) mmin = s; if (s > mmax) mmax = s;
    }
    for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
      let m = -1e9;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
        m = Math.max(m, map[(y * 2 + dy) * M + x * 2 + dx]);
      pool[y * 15 + x] = m;
    }
  }
  const norm = v => mmax - mmin < 1e-6 ? 0 : (v - (mmin + mmax) / 2) / ((mmax - mmin) / 2);
  function matrixHTML() {
    const K = KERNELS[kernel];
    document.getElementById('cnn-matrix').innerHTML = K.map(r =>
      '<tr>' + r.map(v => `<td class="${v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'}">${Math.abs(v) < 1 && v !== 0 ? v.toFixed(2) : v}</td>`).join('') + '</tr>').join('');
  }
  function windowAt(i) { return { x: i % M, y: Math.floor(i / M) }; }
  function readout(i) {
    if (i < 0 || i >= M * M) { document.getElementById('cnn-val').textContent = 'Σ окно·ядро = —'; return; }
    document.getElementById('cnn-val').textContent = `окно (${i % M}, ${Math.floor(i / M)}) · Σ окно·ядро = ${map[i].toFixed(2)}`;
  }
  function setStatus(s) { document.getElementById('cnn-status').textContent = s; }

  const playBtn = document.getElementById('cnn-play');
  function setPlay(v) {
    playing = v;
    playBtn.textContent = v ? '⏸ Пауза' : '▶ Показ';
    setStatus(v ? 'ядро скользит…' : idx >= M * M ? 'карта готова ✓' : 'пауза · наведи на вход');
  }
  playBtn.addEventListener('click', () => { if (idx >= M * M) idx = 0; setPlay(!playing); });
  document.getElementById('cnn-restart').addEventListener('click', () => { idx = 0; setPlay(false); readout(-1); });
  bindRange(document.getElementById('cnn-speed'), v => v, v => speed = v);
  document.getElementById('cnn-kernel').addEventListener('change', e => {
    kernel = e.target.value; convolve(); matrixHTML(); idx = 0; readout(-1);
    setStatus('ядро заменено');
  });
  document.getElementById('cnn-pooling').addEventListener('change', e => {
    pooling = e.target.checked;
    document.getElementById('cnn-poolwrap').classList.toggle('hide', !pooling);
  });
  document.getElementById('cnn-brush').addEventListener('change', e => {
    brush = e.target.checked;
    document.getElementById('cnn-in').style.cursor = brush ? 'crosshair' : 'default';
    setStatus(brush ? 'рисуй по входу!' : 'инспекция окна');
  });

  const inCanvas = document.getElementById('cnn-in');
  function cellFromEvent(e) {
    const r = inCanvas.getBoundingClientRect();
    return {
      gx: clamp(Math.floor((e.clientX - r.left) / r.width * N), 0, N - 1),
      gy: clamp(Math.floor((e.clientY - r.top) / r.height * N), 0, N - 1)
    };
  }
  function paint(e) {
    const { gx, gy } = cellFromEvent(e);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = gx + dx, y = gy + dy;
      if (x >= 0 && x < N && y >= 0 && y < N) gray[y * N + x] = 1;
    }
    convolve(); idx = M * M;
  }
  inCanvas.style.touchAction = 'none';
  inCanvas.addEventListener('pointerdown', e => {
    if (brush) { painting = true; inCanvas.setPointerCapture(e.pointerId); paint(e); }
    else inspectAt(e);
  });
  inCanvas.addEventListener('pointermove', e => { if (brush && painting) paint(e); else if (!brush && !playing) inspectAt(e); });
  inCanvas.addEventListener('pointerup', () => painting = false);
  inCanvas.addEventListener('pointerleave', () => { painting = false; inspect = -1; });
  function inspectAt(e) {
    const { gx, gy } = cellFromEvent(e);
    const x = clamp(gx - 1, 0, M - 1), y = clamp(gy - 1, 0, M - 1);
    inspect = y * M + x; readout(inspect);
  }

  function drawGrid(c, size, get, revealed) {
    const { ctx, st } = c; const { w, h } = st; if (w < 10) return;
    ctx.clearRect(0, 0, w, h);
    const cell = Math.min(w, h) / size;
    const ox = (w - cell * size) / 2, oy = (h - cell * size) / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = y * size + x;
      ctx.fillStyle = i < revealed ? get(i) : 'rgba(16,22,43,.9)';
      ctx.fillRect(ox + x * cell, oy + y * cell, cell - .5, cell - .5);
    }
    return { cell, ox, oy };
  }
  function draw() {
    const g = drawGrid(cin, N, i => { const v = Math.round(gray[i] * 235 + 12); return `rgb(${v},${v},${Math.min(255, v + 14)})`; }, N * N);
    const wi = inspect >= 0 ? inspect : Math.min(idx, M * M - 1);
    if (g && (playing || inspect >= 0 || idx > 0)) {
      const { x, y } = windowAt(wi);
      ctx.strokeStyle = C.amber; ctx.lineWidth = 2; ctx.shadowColor = C.amber; ctx.shadowBlur = 8;
      cin.ctx.strokeRect(g.ox + x * g.cell, g.oy + y * g.cell, g.cell * 3, g.cell * 3);
      cin.ctx.shadowBlur = 0;
    }
    const o = drawGrid(cout, M, i => diverging(norm(map[i])), idx);
    if (o && idx > 0 && idx < M * M) {
      const { x, y } = windowAt(idx);
      cout.ctx.strokeStyle = C.amber; cout.ctx.lineWidth = 2;
      cout.ctx.strokeRect(o.ox + x * o.cell - 1, o.oy + y * o.cell - 1, o.cell + 2, o.cell + 2);
    }
    if (pooling) drawGrid(cpool, 15, i => {
      const t = clamp((pool[i] - mmin) / (mmax - mmin + 1e-6), 0, 1);
      return `rgb(${Math.round(20 + 143 * t)},${Math.round(30 + 200 * t)},${Math.round(20 + 33 * t)})`;
    }, idx >= M * M ? 225 : Math.floor(idx / 4));
  }

  baseImage(); convolve(); matrixHTML(); readout(-1);
  const loop = createLoop(() => {
    if (playing) {
      idx = Math.min(M * M, idx + speed);
      readout(Math.min(idx, M * M - 1));
      if (idx >= M * M) setPlay(false);
    }
    draw();
  });
  autoPause(document.getElementById('demo-cnn'), loop);
}