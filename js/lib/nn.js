/* Мини-движок MLP: forward, backprop, SGD. Выход всегда sigmoid + BCE. */
export const ACT = {
  sigmoid: { f: x => 1 / (1 + Math.exp(-x)), d: a => a * (1 - a) },
  tanh:    { f: x => Math.tanh(x),           d: a => 1 - a * a },
  relu:    { f: x => Math.max(0, x),         d: a => (a > 0 ? 1 : 0) }
};

export function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class MLP {
  constructor(sizes, hidden = 'tanh') {
    this.sizes = [...sizes];
    this.hidden = hidden;
    this.W = []; this.B = [];
    for (let i = 1; i < sizes.length; i++) {
      const fan = sizes[i - 1], n = sizes[i];
      const s = hidden === 'relu' ? Math.sqrt(2 / fan) : Math.sqrt(1.5 / fan);
      this.W.push(Array.from({ length: n }, () => Array.from({ length: fan }, () => randn() * s)));
      this.B.push(new Array(n).fill(0));
    }
    this.zeroGrad();
  }
  forward(x) {
    const acts = [x.slice()], zs = [null];
    let a = x;
    for (let l = 0; l < this.W.length; l++) {
      const last = l === this.W.length - 1;
      const f = last ? ACT.sigmoid.f : ACT[this.hidden].f;
      const z = [], out = [];
      for (let j = 0; j < this.W[l].length; j++) {
        let s = this.B[l][j]; const w = this.W[l][j];
        for (let k = 0; k < a.length; k++) s += w[k] * a[k];
        z.push(s); out.push(f(s));
      }
      zs.push(z); acts.push(out); a = out;
    }
    this._acts = acts; this._zs = zs;
    return acts;
  }
  predict(x) { const a = this.forward(x); return a[a.length - 1]; }
  /* обратный проход от готовой дельты выходного слоя; аккумулирует градиенты (или нет) */
  backwardDelta(delta, accumulate = true) {
    const L = this.W.length, acts = this._acts;
    let d = delta.slice(), gradInput = null;
    for (let l = L - 1; l >= 0; l--) {
      const prev = acts[l];
      if (accumulate) {
        for (let j = 0; j < this.W[l].length; j++) {
          this.gB[l][j] += d[j];
          const gw = this.gW[l][j];
          for (let k = 0; k < prev.length; k++) gw[k] += d[j] * prev[k];
        }
      }
      const pd = new Array(prev.length).fill(0);
      for (let k = 0; k < prev.length; k++) {
        let s = 0;
        for (let j = 0; j < this.W[l].length; j++) s += this.W[l][j][k] * d[j];
        pd[k] = s;
      }
      if (l > 0) {
        const df = ACT[this.hidden].d;
        for (let k = 0; k < prev.length; k++) pd[k] *= df(prev[k]);
        d = pd;
      } else gradInput = pd;
    }
    return gradInput;
  }
  /* BCE по sigmoid-выходу: дельта = a - y */
  backward(y) {
    const out = this._acts[this._acts.length - 1];
    return this.backwardDelta(out.map((a, j) => a - y[j]), true);
  }
  loss(y) {
    const out = this._acts[this._acts.length - 1];
    let s = 0;
    for (let j = 0; j < y.length; j++)
      s -= y[j] * Math.log(out[j] + 1e-9) + (1 - y[j]) * Math.log(1 - out[j] + 1e-9);
    return s / y.length;
  }
  zeroGrad() {
    this.gW = this.W.map(w => w.map(r => r.map(() => 0)));
    this.gB = this.B.map(b => b.map(() => 0));
  }
  applyGrads(lr, n = 1) {
    const k = lr / n;
    for (let l = 0; l < this.W.length; l++)
      for (let j = 0; j < this.W[l].length; j++) {
        this.B[l][j] -= k * this.gB[l][j];
        for (let i = 0; i < this.W[l][j].length; i++) this.W[l][j][i] -= k * this.gW[l][j][i];
      }
  }
  trainBatch(xs, ys, lr) {
    this.zeroGrad();
    let loss = 0;
    for (let i = 0; i < xs.length; i++) {
      this.forward(xs[i]);
      loss += this.loss(ys[i]);
      this.backward(ys[i]);
    }
    this.applyGrads(lr, xs.length);
    return loss / xs.length;
  }
  paramCount() {
    let n = 0;
    for (let l = 0; l < this.W.length; l++) n += this.B[l].length + this.W[l].length * this.W[l][0].length;
    return n;
  }
  toJSON() { return { sizes: this.sizes, hidden: this.hidden, out: 'sigmoid', W: this.W, B: this.B }; }
}