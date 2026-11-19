/* Живой линейный график (loss и т.п.) на canvas. */
import { setupCanvas, C } from './util.js';

export class LineChart {
  constructor(canvas, series, maxPoints = 500) {
    const { ctx, st } = setupCanvas(canvas);
    this.ctx = ctx; this.st = st;
    this.series = series; this.max = maxPoints;
    this.data = series.map(() => []);
  }
  push(values) {
    values.forEach((v, i) => {
      this.data[i].push(v);
      if (this.data[i].length > this.max) this.data[i].shift();
    });
    this.draw();
  }
  reset() { this.data = this.series.map(() => []); this.draw(); }
  draw() {
    const { ctx, st } = this; const { w, h } = st;
    if (w < 10) return;
    ctx.clearRect(0, 0, w, h);
    let ymax = 0.1;
    this.data.forEach(d => d.forEach(v => { if (isFinite(v) && v > ymax) ymax = v; }));
    ymax *= 1.12;
    const padL = 34, padB = 6, padT = 16;
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.strokeStyle = C.line; ctx.fillStyle = C.faint; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padT + (h - padT - padB) * i / 3;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - 6, y); ctx.stroke();
      ctx.fillText((ymax * (1 - i / 3)).toFixed(2), 3, y + 3);
    }
    this.series.forEach((s, si) => {
      const d = this.data[si];
      if (d.length < 2) return;
      ctx.beginPath();
      d.forEach((v, i) => {
        const x = padL + (w - padL - 6) * i / (this.max - 1);
        const y = padT + (h - padT - padB) * (1 - Math.min(v, ymax) / ymax);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.strokeStyle = s.color; ctx.lineWidth = 2;
      ctx.shadowColor = s.color; ctx.shadowBlur = 6;
      ctx.stroke(); ctx.shadowBlur = 0;
      const lx = w - 6 - (this.series.length - 1 - si) * 74;
      ctx.fillStyle = s.color;
      ctx.fillRect(lx - 52, 5, 8, 3);
      ctx.fillText(s.label, lx - 40, 10);
    });
  }
}