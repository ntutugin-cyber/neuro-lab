/* Фоновая живая сеть в hero: дрейф узлов, связи, импульсы, реакция на курсор. */
import { setupCanvas, createLoop, autoPause, C, REDUCED } from '../lib/util.js';

export function initHero() {
  const cv = document.getElementById('hero-cv');
  const { ctx, st } = setupCanvas(cv);
  const cols = [C.violet, C.cyan, C.magenta2, C.lime];
  let nodes = [], pulses = [], mx = -9999, my = -9999;

  const build = () => {
    const n = Math.round(Math.min(90, Math.max(28, st.w * st.h / 16000)));
    nodes = Array.from({ length: n }, () => ({
      x: Math.random() * st.w, y: Math.random() * st.h,
      vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22,
      r: 1.6 + Math.random() * 2.4, c: cols[Math.floor(Math.random() * cols.length)]
    }));
    pulses = [];
  };
  build();
  new ResizeObserver(() => { if (st.w > 0) build(); }).observe(cv);
  cv.parentElement.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top;
  });
  cv.parentElement.addEventListener('pointerleave', () => { mx = my = -9999; });

  const loop = createLoop((dt, t) => {
    const { w, h } = st; if (w < 10) return;
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(150, w * 0.16);
    for (const n of nodes) {
      n.x += n.vx * dt * .06; n.y += n.vy * dt * .06;
      const dx = n.x - mx, dy = n.y - my, d = Math.hypot(dx, dy);
      if (d < 130 && d > 0.1) { n.x += dx / d * .7; n.y += dy / d * .7; }
      if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < R) {
          ctx.strokeStyle = `rgba(139,92,246,${(1 - d / R) * .30})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    if (!REDUCED && Math.random() < .12 && nodes.length > 2) {
      const a = Math.floor(Math.random() * nodes.length);
      let b = Math.floor(Math.random() * nodes.length);
      if (a !== b && Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) < R * 1.6)
        pulses.push({ a, b, t: 0 });
    }
    pulses = pulses.filter(p => p.t < 1);
    for (const p of pulses) {
      p.t += dt * .0011;
      const a = nodes[p.a], b = nodes[p.b];
      const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
      ctx.fillStyle = C.cyan2; ctx.shadowColor = C.cyan; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (const n of nodes) {
      ctx.fillStyle = n.c; ctx.globalAlpha = .85;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  });
  if (!REDUCED) autoPause(cv, loop);
  else { loop.start(); setTimeout(() => loop.stop(), 60); }
}