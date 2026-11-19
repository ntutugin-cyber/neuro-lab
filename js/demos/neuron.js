/* Демо «живой нейрон»: входы, веса, смещение, активация, пресеты И/ИЛИ/НЕ. */
import { setupCanvas, createLoop, autoPause, bindRange, C, fmt, REDUCED, lerp } from '../lib/util.js';

const F = {
  sigmoid: { f: z => 1 / (1 + Math.exp(-z)), name: 'σ', range: [0, 1] },
  tanh: { f: Math.tanh, name: 'tanh', range: [-1, 1] },
  relu: { f: z => Math.max(0, z), name: 'ReLU', range: [0, 4] },
  step: { f: z => z >= 0 ? 1 : 0, name: 'порог', range: [0, 1] }
};

export function initNeuron() {
  const cv = setupCanvas(document.getElementById('nrv'));
  const cc = setupCanvas(document.getElementById('nrc'));
  const S = { x: [1, .5, 0], w: [.8, -.4, .7], b: -.2, act: 'sigmoid' };
  const ranges = {};
  ['x1', 'x2', 'x3'].forEach((id, i) => ranges[id] = bindRange(document.getElementById('n' + id), v => v.toFixed(2), v => S.x[i] = v));
  ['w1', 'w2', 'w3'].forEach((id, i) => ranges[id] = bindRange(document.getElementById('n' + id), v => fmt(v), v => S.w[i] = v));
  ranges.b = bindRange(document.getElementById('nb'), v => fmt(v), v => S.b = v);
  const actSel = document.getElementById('nact');
  actSel.addEventListener('change', () => S.act = actSel.value);

  const presets = {
    and: { w: [1, 1, 0], b: -1.5, x: [1, 1, 0], act: 'step', msg: 'И: сработает, только когда x₁ и x₂ = 1' },
    or: { w: [1, 1, 0], b: -.5, x: [0, 1, 0], act: 'step', msg: 'ИЛИ: достаточно одного входа = 1' },
    not: { w: [-2, 0, 0], b: 1, x: [1, 0, 0], act: 'step', msg: 'НЕ: инвертирует x₁ — крути ползунок x₁' }
  };
  document.querySelectorAll('[data-npreset]').forEach(btn => btn.addEventListener('click', () => {
    const p = presets[btn.dataset.npreset];
    p.w.forEach((v, i) => ranges['w' + (i + 1)].set(v));
    p.x.forEach((v, i) => ranges['x' + (i + 1)].set(v));
    ranges.b.set(p.b);
    actSel.value = p.act; S.act = p.act;
    document.getElementById('n-status').textContent = p.msg;
  }));

  const calc = () => {
    const z = S.x.reduce((s, x, i) => s + x * S.w[i], 0) + S.b;
    return { z, a: F[S.act].f(z) };
  };

  const drawMain = t => {
    const { ctx, st } = cv; const { w, h } = st; if (w < 10) return;
    ctx.clearRect(0, 0, w, h);
    const { z, a } = calc();
    const ix = Math.max(46, w * .1), sx = w * .54, ox = w - Math.max(52, w * .12);
    const iy = [h * .22, h * .5, h * .78], sy = h * .5, oy = h * .5;
    ctx.font = '600 11px "JetBrains Mono", monospace';
    for (let i = 0; i < 3; i++) {
      const wgt = S.w[i], aw = Math.min(1, Math.abs(wgt) / 2);
      ctx.strokeStyle = wgt >= 0 ? `rgba(34,211,238,${.25 + .55 * aw})` : `rgba(244,63,142,${.25 + .55 * aw})`;
      ctx.lineWidth = .8 + 4 * aw;
      ctx.beginPath(); ctx.moveTo(ix + 16, iy[i]); ctx.lineTo(sx - 27, sy); ctx.stroke();
      const flow = Math.abs(S.x[i] * wgt);
      if (!REDUCED && flow > .02) {
        const p = ((t * .0004 * (0.4 + flow)) + i * .37) % 1;
        ctx.fillStyle = wgt >= 0 ? C.cyan2 : C.magenta2;
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(lerp(ix + 16, sx - 27, p), lerp(iy[i], sy, p), 2.6, 0, 7); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = C.muted;
      ctx.fillText('w' + (i + 1) + '=' + fmt(wgt, 1), (ix + sx) / 2 - 26, (iy[i] + sy) / 2 - 6);
    }
    ctx.strokeStyle = 'rgba(167,139,250,.7)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx + 27, sy); ctx.lineTo(ox - 20, oy); ctx.stroke();
    if (!REDUCED) {
      const p = (t * .0006) % 1;
      ctx.fillStyle = C.violet; ctx.shadowColor = C.violet; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(lerp(sx + 27, ox - 20, p), sy, 2.6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = `rgba(34,211,238,${.12 + .5 * S.x[i]})`;
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ix, iy[i], 15, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.text; ctx.textAlign = 'center';
      ctx.fillText(S.x[i].toFixed(2), ix, iy[i] + 4);
      ctx.fillStyle = C.faint; ctx.fillText('x' + (i + 1), ix, iy[i] - 22);
      ctx.textAlign = 'left';
    }
    ctx.fillStyle = 'rgba(139,92,246,.22)'; ctx.strokeStyle = C.violet; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 26, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.font = '700 13px "JetBrains Mono", monospace';
    ctx.fillText('Σ+b', sx, sy - 2);
    ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.fillStyle = C.cyan2;
    ctx.fillText(fmt(z), sx, sy + 13);
    const [lo, hi] = F[S.act].range;
    const bright = Math.max(0, Math.min(1, (a - lo) / (hi - lo || 1)));
    ctx.fillStyle = `rgba(163,230,53,${.1 + .55 * bright})`; ctx.strokeStyle = C.lime;
    ctx.beginPath(); ctx.arc(ox, oy, 19, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.text; ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText(a.toFixed(2), ox, oy + 4);
    ctx.fillStyle = C.faint; ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText('a = ' + F[S.act].name + '(z)', ox, oy - 27);
    ctx.textAlign = 'left';
    document.getElementById('nformula').textContent =
      `z = ${S.x.map((x, i) => `${x.toFixed(2)}·(${fmt(S.w[i])})`).join(' + ')} + (${fmt(S.b)}) = ${fmt(z)}   →   a = ${F[S.act].name}(${fmt(z)}) = ${a.toFixed(3)}`;
    document.getElementById('nbig').textContent = a.toFixed(2);
    document.getElementById('nbar').style.width = (bright * 100) + '%';
  };

  const drawCurve = () => {
    const { ctx, st } = cc; const { w, h } = st; if (w < 10) return;
    ctx.clearRect(0, 0, w, h);
    const { z, a } = calc();
    const [lo, hi] = F[S.act].range;
    const X = zz => 30 + (w - 44) * (zz + 4) / 8;
    const Y = aa => h - 18 - (h - 32) * (aa - lo) / (hi - lo || 1);
    ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(30, Y(0)); ctx.lineTo(w - 10, Y(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0), 8); ctx.lineTo(X(0), h - 14); ctx.stroke();
    ctx.font = '600 9px "JetBrains Mono", monospace'; ctx.fillStyle = C.faint;
    ctx.fillText('−4', X(-4) - 4, h - 4); ctx.fillText('z=0', X(0) - 8, h - 4); ctx.fillText('+4', X(4) - 8, h - 4);
    ctx.strokeStyle = C.violet; ctx.lineWidth = 2; ctx.shadowColor = C.violet; ctx.shadowBlur = 6;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 160; i++) {
      const zz = -4 + 8 * i / 160, aa = F[S.act].f(zz);
      if (S.act === 'step' && Math.abs(zz) < .025) { started = false; continue; }
      const x = X(zz), y = Y(aa);
      started ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      started = true;
    }
    ctx.stroke(); ctx.shadowBlur = 0;
    const zc = Math.max(-4, Math.min(4, z));
    ctx.fillStyle = C.lime; ctx.shadowColor = C.lime; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(X(zc), Y(F[S.act].f(zc)), 5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = C.muted; ctx.fillText(F[S.act].name + '(z)', 34, 14);
  };

  const loop = createLoop((dt, t) => { drawMain(t); drawCurve(); });
  autoPause(document.getElementById('demo-neuron'), loop);
}