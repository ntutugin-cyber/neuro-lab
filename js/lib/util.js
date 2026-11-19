/* Canvas/DOM-утилиты: DPI, циклы, видимость, контролы, скачивание. */
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const fmt = (v, d = 2) => (v >= 0 ? '' : '−') + Math.abs(v).toFixed(d);
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const st = { w: 0, h: 0 };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    st.w = r.width; st.h = r.height;
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  return { ctx, st };
}

export function createLoop(update) {
  let running = false, raf = 0, last = 0;
  const tick = t => {
    if (!running) return;
    const dt = Math.min(50, t - last || 16); last = t;
    update(dt, t);
    raf = requestAnimationFrame(tick);
  };
  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(tick); },
    stop() { running = false; cancelAnimationFrame(raf); },
    get running() { return running; }
  };
}

/* авто-пауза цикла, когда элемент вне экрана */
export function autoPause(el, loop) {
  new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? loop.start() : loop.stop()),
    { rootMargin: '80px' }).observe(el);
}

export function bindRange(input, format, cb) {
  const out = input.parentElement.querySelector('output');
  const update = fire => {
    const v = parseFloat(input.value);
    const p = (v - parseFloat(input.min)) / (parseFloat(input.max) - parseFloat(input.min)) * 100;
    input.style.setProperty('--p', p + '%');
    if (out) out.textContent = format ? format(v) : v;
    if (fire && cb) cb(v);
  };
  input.addEventListener('input', () => update(true));
  update(false);
  return { set(v) { input.value = v; update(true); }, get: () => parseFloat(input.value) };
}

export function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export const C = {
  violet: '#a78bfa', indigo: '#818cf8', cyan: '#22d3ee', cyan2: '#7ff0ff',
  magenta: '#f43f8e', magenta2: '#ff7ac8', lime: '#a3e635', amber: '#fbbf24',
  blue: '#5ea2ff', red: '#fb5e6c', ok: '#34d399', text: '#e9e9f4',
  muted: '#a6acc9', faint: '#6f7699', line: '#232c4e', bg: '#0b1020'
};
export const PALETTE = [C.cyan, C.magenta2, C.lime, C.amber, C.blue, C.violet, C.red, C.ok];

/* двухцветная раскраска значения: −1 → розовый, 0 → тёмный, +1 → голубой */
export function diverging(v) {
  const t = clamp(v, -1, 1);
  const mix = (a, b, k) => Math.round(lerp(a, b, k));
  if (t >= 0) return `rgb(${mix(16, 34, t)},${mix(22, 211, t)},${mix(43, 238, t)})`;
  return `rgb(${mix(16, 244, -t)},${mix(22, 63, -t)},${mix(43, 142, -t)})`;
}

export function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const L2 = dx * dx + dy * dy;
  const t = L2 ? clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}