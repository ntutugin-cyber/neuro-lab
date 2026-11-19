/* RNN читает фразу по словам: скрытое состояние, лента памяти, вердикт тона. */
import { setupCanvas, createLoop, autoPause, bindRange, C, diverging, clamp } from '../lib/util.js';

const LEX = {
  'фильм': [0, .1], 'был': [0, 0], 'было': [0, 0], 'очень': [0, .9], 'слишком': [-.2, .7],
  'интересный': [.9, .3], 'красивый': [.7, .2], 'захватывающий': [.85, .4], 'хороший': [.7, .1],
  'великолепно': [.95, .5], 'шедевр': [1, .6], 'люблю': [.8, .3], 'понравился': [.75, .2],
  'скучный': [-.9, .3], 'длинный': [-.4, .3], 'предсказуемый': [-.55, .2], 'ужасный': [-1, .5],
  'плохой': [-.7, .2], 'ненавижу': [-.95, .5], 'слабо': [-.5, .1], 'разочарован': [-.8, .3],
  'но': [0, 0], 'и': [0, 0], 'а': [0, 0], 'начало': [0, .1], 'финал': [0, .2],
  'актёры': [0, .1], 'играли': [0, 0], 'сюжет': [0, .1], 'звук': [0, .1]
};
const Wx = [[1.5, .9, 0], [.7, .3, 0], [.1, .8, 0], [.4, .2, .3]];
const Wh = [[.78, .1, 0, 0], [.05, .55, 0, 0], [0, 0, .45, .1], [0, 0, 0, .35]];
const bh = [0, 0, 0, -.1], wo = [1.7, .7, .15, .5], bo = -.15;
const PRESETS = [
  'фильм был очень интересный и красивый',
  'скучный слишком длинный и предсказуемый фильм',
  'начало было скучный но финал очень интересный'
];

export function initRNN() {
  const heat = setupCanvas(document.getElementById('rnn-heat'));
  let words = [], h = [0, 0, 0, 0], hist = [], stepIdx = 0, playing = false, lastT = 0, speed = 1;
  const stateEl = document.getElementById('rnn-state');
  stateEl.innerHTML = Array.from({ length: 4 }, (_, i) =>
    `<div class="cell"><i></i><b>0.00</b><span>h${i + 1}</span></div>`).join('');
  const cells = [...stateEl.children];

  function setStatus(s) { document.getElementById('rnn-status').textContent = s; }
  function apply(text) {
    words = text.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean).slice(0, 14);
    reset();
  }
  function reset() {
    h = [0, 0, 0, 0]; hist = []; stepIdx = 0; playing = false;
    document.getElementById('rnn-play').textContent = '▶ Проиграть';
    document.getElementById('rnn-words').innerHTML = words.map(w =>
      `<span class="word${LEX[w] ? '' : ' unknown'}" title="${LEX[w] ? '' : 'нет в словаре — нейтральный вектор'}">${w}</span>`).join('');
    syncState(); gauge(.5);
    setStatus('нажми ▶ или «Слово →»');
    document.getElementById('rnn-formula').textContent = 'hₜ = tanh(Wx·xₜ + Wh·hₜ₋₁) · ждём первое слово';
  }
  function doStep() {
    if (stepIdx >= words.length) { playing = false; document.getElementById('rnn-play').textContent = '▶ Проиграть'; return; }
    const w = words[stepIdx];
    const e = LEX[w] || [0, 0];
    const x = [e[0], e[1], 1];
    const nh = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      let s = bh[i];
      for (let k = 0; k < 3; k++) s += Wx[i][k] * x[k];
      for (let k = 0; k < 4; k++) s += Wh[i][k] * h[k];
      nh[i] = Math.tanh(s);
    }
    h = nh; hist.push([...h]);
    const chips = document.getElementById('rnn-words').children;
    [...chips].forEach((c, i) => { c.classList.toggle('done', i <= stepIdx); c.classList.toggle('current', i === stepIdx); });
    document.getElementById('rnn-formula').textContent =
      `шаг ${stepIdx + 1}: «${w}» → x=[${x.map(v => v.toFixed(1)).join(', ')}] → h=[${h.map(v => v.toFixed(2)).join(', ')}]`;
    syncState();
    const p = 1 / (1 + Math.exp(-(h.reduce((s, v, i) => s + v * wo[i], 0) + bo)));
    gauge(p);
    stepIdx++;
    if (stepIdx >= words.length) {
      playing = false;
      document.getElementById('rnn-play').textContent = '▶ Проиграть';
      setStatus(`готово: ${p > .6 ? 'позитив 😀' : p < .4 ? 'негатив 😞' : 'нейтрально 😐'} (${p.toFixed(2)})`);
    } else setStatus(`прочитано ${stepIdx}/${words.length}`);
  }
  function syncState() {
    cells.forEach((c, i) => {
      c.classList.toggle('neg', h[i] < 0);
      c.querySelector('i').style.height = ((h[i] + 1) / 2 * 100) + '%';
      c.querySelector('b').textContent = h[i].toFixed(2);
    });
  }
  function gauge(p) {
    document.getElementById('rnn-gauge').style.left = (p * 100) + '%';
    document.getElementById('rnn-outval').textContent = p.toFixed(2);
  }
  function drawHeat() {
    const { ctx, st } = heat; const { w, hgt } = { w: st.w, hgt: st.h }; if (w < 10) return;
    ctx.clearRect(0, 0, w, hgt);
    const rows = Math.max(words.length, 1), top = 18;
    const cw = (w - 16) / 4, ch = Math.min(26, (hgt - top - 6) / rows);
    ctx.font = '600 9px "JetBrains Mono", monospace'; ctx.fillStyle = C.faint;
    for (let i = 0; i < 4; i++) ctx.fillText('h' + (i + 1), 8 + i * cw + cw / 2 - 6, 11);
    hist.forEach((hv, r) => {
      hv.forEach((v, c) => {
        ctx.fillStyle = diverging(v);
        ctx.globalAlpha = r === hist.length - 1 ? 1 : .55 + .45 * (r / Math.max(1, hist.length - 1));
        ctx.fillRect(8 + c * cw, top + r * ch, cw - 3, ch - 3);
      });
    });
    ctx.globalAlpha = 1;
    if (hist.length) {
      ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5;
      ctx.strokeRect(6, top + (hist.length - 1) * ch - 1, w - 12, ch - 1);
    }
  }

  const presetSel = document.getElementById('rnn-preset');
  const textIn = document.getElementById('rnn-text');
  presetSel.addEventListener('change', () => { textIn.value = PRESETS[+presetSel.value]; apply(textIn.value); });
  document.getElementById('rnn-apply').addEventListener('click', () => apply(textIn.value));
  textIn.addEventListener('keydown', e => { if (e.key === 'Enter') apply(textIn.value); });
  const playBtn = document.getElementById('rnn-play');
  playBtn.addEventListener('click', () => {
    if (stepIdx >= words.length) reset();
    playing = !playing;
    playBtn.textContent = playing ? '⏸ Пауза' : '▶ Проиграть';
    if (playing) setStatus('читаем…');
  });
  document.getElementById('rnn-step').addEventListener('click', doStep);
  document.getElementById('rnn-reset').addEventListener('click', reset);
  bindRange(document.getElementById('rnn-speed'), v => v.toFixed(1), v => speed = v);

  apply(textIn.value);
  const loop = createLoop((dt, t) => {
    if (playing && t - lastT > 850 / speed) { lastT = t; doStep(); }
    drawHeat();
  });
  autoPause(document.getElementById('demo-rnn'), loop);
}