/* Мини-тест: 7 вопросов, мгновенная обратная связь, счёт, рестарт. */
const QS = [
  { q: 'Что такое «веса» нейросети?', o: ['Размер сети в мегабайтах', 'Настраиваемые числа на связях, в которых хранится всё «знание» сети', 'Скорость обучения'], a: 1, e: 'Обучение — это подбор весов (и смещений). «7B параметров» у LLM — 7 миллиардов таких чисел.' },
  { q: 'Зачем нужна функция активации (σ, tanh, ReLU)?', o: ['Чтобы сеть работала быстрее', 'Для красоты графиков', 'Она даёт нелинейность: без неё вся сеть схлопывается в одну линейную формулу'], a: 2, e: 'Сумма линейных функций линейна. Без нелинейности сеть не смогла бы выучить даже XOR.' },
  { q: 'Какая архитектура исторически лучше всего подходит для изображений?', o: ['Свёрточная (CNN)', 'Рекуррентная (RNN)', 'Табличный перцептрон'], a: 0, e: 'Фильтр 3×3 с общими весами ищет узор в любом месте картинки — это дёшево и устойчиво к сдвигам.' },
  { q: 'Сможет ли сеть БЕЗ скрытых слоёв выучить XOR?', o: ['Да, если долго обучать', 'Нет: XOR линейно неразделим, нужен хотя бы один скрытый слой', 'Да, если увеличить learning rate'], a: 1, e: 'Это доказали Минский и Пейперт в 1969 году. Проверь сам в песочнице — пресет «Без слоёв».' },
  { q: 'В GAN генератор…', o: ['Размечает данные', 'Создаёт подделки и учится обманывать дискриминатор', 'Сжимает картинки'], a: 1, e: 'G никогда не видит настоящие данные напрямую — только вердикты D. D учится ловить подделки, G — обманывать.' },
  { q: 'На какой архитектуре основаны ChatGPT, Claude и Qwen?', o: ['Каждый на своей уникальной', 'LSTM', 'Decoder-only Transformer с механизмом внимания'], a: 2, e: 'Архитектура у всех одна — Transformer. Различия в данных, масштабе, выравнивании (RLHF / Constitutional AI) и инженерии (MoE, GQA).' },
  { q: 'Обучение с учителем требует…', o: ['Размеченные данные: пример + правильный ответ', 'Только сырые данные без меток', 'Обязательно видеокарту'], a: 0, e: 'Метки — это «учитель». Без них — unsupervised (структура) или self-supervised (метки из самих данных, как у LLM).' }
];

export function initQuiz() {
  const root = document.getElementById('quiz-root');
  let i = 0, score = 0, results = [];

  function render() {
    if (i >= QS.length) return renderScore();
    const q = QS[i];
    root.innerHTML = `
      <p class="quiz-q">${i + 1}/${QS.length} · ${q.q}</p>
      <div class="quiz-opts">${q.o.map((o, j) => `<button class="quiz-opt" data-j="${j}">${o}</button>`).join('')}</div>
      <div class="quiz-exp hide" id="qexp"></div>
      <div class="quiz-nav">
        <div class="quiz-dots">${QS.map((_, j) => `<i class="${j < i ? (results[j] ? 'done' : 'miss') : j === i ? 'cur' : ''}"></i>`).join('')}</div>
        <button class="btn btn-primary btn-sm hide" id="qnext">${i === QS.length - 1 ? 'Результат →' : 'Дальше →'}</button>
      </div>`;
    root.querySelectorAll('.quiz-opt').forEach(b => b.addEventListener('click', () => {
      const j = +b.dataset.j, ok = j === q.a;
      results[i] = ok; if (ok) score++;
      root.querySelectorAll('.quiz-opt').forEach((x, k) => {
        x.disabled = true;
        if (k === q.a) x.classList.add('right');
        else if (k === j) x.classList.add('wrong');
      });
      const exp = document.getElementById('qexp');
      exp.textContent = (ok ? '✓ Верно! ' : '✗ Не совсем. ') + q.e;
      exp.classList.remove('hide');
      document.getElementById('qnext').classList.remove('hide');
      root.querySelector('.quiz-dots').children[i].className = ok ? 'done' : 'miss';
    }));
    document.getElementById('qnext').addEventListener('click', () => { i++; render(); });
  }
  function renderScore() {
    const verdict = score === 7 ? 'Идеально. Ты готов объяснять нейросети другим.' :
      score >= 5 ? 'Отлично! База усвоена — загляни в песочницу закрепить.' :
      'Неплохое начало. Перечитай главы, где ошибся, — и попробуй снова.';
    root.innerHTML = `<div class="quiz-score"><b>${score} / ${QS.length}</b><p>${verdict}</p>
      <div class="btn-row" style="justify-content:center"><button class="btn btn-primary" id="qrestart">↺ Пройти ещё раз</button>
      <a class="btn" href="#playground">В песочницу</a></div></div>`;
    document.getElementById('qrestart').addEventListener('click', () => { i = 0; score = 0; results = []; render(); });
  }
  render();
}