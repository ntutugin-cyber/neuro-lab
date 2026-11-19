/* Точка входа: навигация, scrollspy, reveal, фильтр типов, инициализация демо. */
import { REDUCED } from './lib/util.js';
import { initHero } from './demos/hero.js';
import { initNeuron } from './demos/neuron.js';
import { initSupervised, initKmeans } from './demos/learning.js';
import { initCNN } from './demos/cnn.js';
import { initRNN } from './demos/rnn.js';
import { initGAN } from './demos/gan.js';
import { initTransformer } from './demos/transformer.js';
import { initPlayground } from './demos/playground.js';
import { initQuiz } from './demos/quiz.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* --- навигация --- */
const nav = $('#nav'), burger = $('#nav-burger'), links = $('#nav-links');
burger.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  burger.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
});
links.addEventListener('click', e => {
  if (e.target.tagName === 'A') { links.classList.remove('open'); burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { links.classList.remove('open'); burger.classList.remove('open'); }
});

/* --- прогресс чтения + тень навбара + кнопка наверх --- */
const progress = $('#progress'), totop = $('#totop');
let ticking = false;
addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? y / max * 100 : 0) + '%';
    nav.classList.toggle('scrolled', y > 10);
    totop.classList.toggle('show', y > 700);
    ticking = false;
  });
}, { passive: true });
totop.addEventListener('click', () => scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));

/* --- scrollspy --- */
const navMap = new Map($$('#nav-links a').map(a => [a.getAttribute('href').slice(1), a]));
const spy = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting && navMap.has(e.target.id)) {
    $$('#nav-links a').forEach(a => a.classList.remove('active'));
    navMap.get(e.target.id).classList.add('active');
  }
}), { rootMargin: '-40% 0px -55% 0px' });
navMap.forEach((_, id) => { const el = document.getElementById(id); if (el) spy.observe(el); });

/* --- reveal при скролле --- */
if (REDUCED) $$('.reveal').forEach(el => el.classList.add('in'));
else {
  const ro = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); }
  }), { threshold: .1, rootMargin: '0px 0px -40px' });
  $$('.reveal').forEach(el => ro.observe(el));
}

/* --- фильтр карточек типов --- */
$('#type-filters').addEventListener('click', e => {
  const chip = e.target.closest('[data-filter]'); if (!chip) return;
  $$('#type-filters .chip').forEach(c => c.classList.toggle('active', c === chip));
  const f = chip.dataset.filter;
  $$('#types-grid .type-card').forEach(card => {
    card.classList.toggle('hide', f !== 'all' && !card.dataset.tags.split(' ').includes(f));
  });
});

/* --- год в футере --- */
$('#year').textContent = new Date().getFullYear();

/* --- инициализация демо (изолированно, чтобы сбой одного не ломал остальные) --- */
const inits = [initHero, initNeuron, initSupervised, initKmeans, initCNN, initRNN, initGAN, initTransformer, initPlayground, initQuiz];
for (const fn of inits) {
  try { fn(); } catch (err) { console.error('[НейроЛаб] сбой инициализации', fn.name, err); }
}