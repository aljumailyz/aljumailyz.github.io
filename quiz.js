// quiz.js
import { supabase } from './supabaseClient.js';

let user = null;
let questions = [];
let currentIndex = 0;
let mode = 'tutor';
let subjectFilter = '';
let poolFilter = 'mixed';
let sessionId = null;
let correctCount = 0;
let answeredMap = {}; // question_id -> {selected_option, is_correct}
let timerInterval = null;
let remainingSeconds = 0;

const setupSection = document.getElementById('setup-section');
const quizSection = document.getElementById('quiz-section');
const subjectSelect = document.getElementById('subject-select');
const setupMessage = document.getElementById('setup-message');
const poolSelect = document.getElementById('pool-select');

async function init() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = 'index.html';
    return;
  }
  user = data.session.user;

  const { data: subjects, error } = await supabase
    .from('questions')
    .select('subject')
    .order('subject', { ascending: true });

  if (!error && subjects) {
    const unique = [...new Set(subjects.map(s => s.subject))];
    unique.forEach(subj => {
      const opt = document.createElement('option');
      opt.value = subj;
      opt.textContent = subj;
      subjectSelect.appendChild(opt);
    });
  }
}

document.getElementById('start-btn').addEventListener('click', async () => {
  setupMessage.textContent = '';
  mode = document.getElementById('mode-select').value;
  subjectFilter = subjectSelect.value;
  poolFilter = poolSelect.value;
  const numQuestions = parseInt(document.getElementById('num-questions').value, 10) || 10;

  let query = supabase.from('questions').select('*');
  if (subjectFilter) query = query.eq('subject', subjectFilter);
  query = query.order('id', { ascending: true }).limit(500);

  const { data: qs, error } = await query;
  if (error) {
    setupMessage.textContent = error.message;
    return;
  }
  if (!qs || qs.length === 0) {
    setupMessage.textContent = 'No questions found for this filter.';
    return;
  }

  let filteredQs = qs;

  if (poolFilter !== 'mixed') {
    const qIds = qs.map(q => q.id);
    const { data: ans, error: ansErr } = await supabase
      .from('answers')
      .select('question_id, is_correct')
      .eq('user_id', user.id)
      .in('question_id', qIds);

    if (!ansErr && ans) {
      const grouped = {};
      ans.forEach(a => {
        if (!grouped[a.question_id]) grouped[a.question_id] = [];
        grouped[a.question_id].push(a);
      });

      if (poolFilter === 'unused') {
        filteredQs = qs.filter(q => !grouped[q.id]);
      } else if (poolFilter === 'incorrect') {
        filteredQs = qs.filter(q => {
          const g = grouped[q.id];
          if (!g) return false;
          return g.some(a => a.is_correct === false);
        });
      }
    }
  }

  if (!filteredQs || filteredQs.length === 0) {
    setupMessage.textContent =
      'No questions found in this pool (try mixed or another subject).';
    return;
  }

  questions = shuffleArray(filteredQs);
  questions.length = Math.min(questions.length, numQuestions);

  const { data: sessionRes, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      mode,
      subject_filter: subjectFilter || null,
      num_questions: questions.length
    })
    .select('id')
    .single();

  if (sessionError) {
    setupMessage.textContent = sessionError.message;
    return;
  }
  sessionId = sessionRes.id;

  setupSection.style.display = 'none';
  quizSection.style.display = 'block';
  document.getElementById('mode-badge').textContent = `Mode: ${mode}`;
  document.getElementById('subject-badge').textContent = subjectFilter || 'All subjects';
  document.getElementById('pool-badge').textContent =
    poolFilter === 'mixed'
      ? 'Pool: All'
      : poolFilter === 'unused'
      ? 'Pool: Unused'
      : 'Pool: Incorrect';

  if (mode === 'timed') {
    const totalSeconds = questions.length * 90;
    startTimer(totalSeconds);
  } else {
    document.getElementById('timer').style.display = 'none';
  }

  renderQuestion();
});

document.getElementById('prev-btn').addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
});

document.getElementById('next-btn').addEventListener('click', () => {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    renderQuestion();
  }
});

document.getElementById('finish-btn').addEventListener('click', async () => {
  await finishSession();
});

document.getElementById('reveal-explanation-btn').addEventListener('click', () => {
  const box = document.getElementById('explanation-box');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
});

async function finishSession(timeExpired = false) {
  if (sessionId) {
    await supabase
      .from('sessions')
      .update({ finished_at: new Date().toISOString() })
      .eq('id', sessionId);
  }
  if (timerInterval) clearInterval(timerInterval);

  const msg = timeExpired
    ? `Time is up! You got ${correctCount} / ${questions.length} correct.`
    : `Test finished. You got ${correctCount} / ${questions.length} correct.`;
  alert(msg);
}

function startTimer(totalSeconds) {
  remainingSeconds = totalSeconds;
  const timerEl = document.getElementById('timer');
  timerEl.style.display = 'inline-block';

  function update() {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    timerEl.textContent = `Time left: ${m}:${s.toString().padStart(2, '0')}`;
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      finishSession(true);
    }
    remainingSeconds--;
  }

  update();
  timerInterval = setInterval(update, 1000);
}

function renderQuestion() {
  const q = questions[currentIndex];
  document.getElementById('question-stem').textContent = q.stem;
  document.getElementById('question-counter').textContent = `Question ${
    currentIndex + 1
  } of ${questions.length}`;
  document.getElementById('score-badge').textContent = `Score: ${correctCount} correct`;

  const img = document.getElementById('question-image');
  if (q.image_url) {
    img.src = q.image_url;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }

  document.getElementById('explanation-text').textContent = q.explanation;

  const saved = answeredMap[q.id];
  const explanationBox = document.getElementById('explanation-box');
  const revealBtn = document.getElementById('reveal-explanation-btn');

  if (mode === 'tutor') {
    explanationBox.style.display = saved ? 'block' : 'none';
    revealBtn.style.display = 'inline-block';
  } else {
    explanationBox.style.display = 'none';
    revealBtn.style.display = saved ? 'inline-block' : 'none';
  }

  const fill = document.getElementById('progress-fill');
  fill.style.width = `${((currentIndex + 1) / questions.length) * 100}%`;

  const opts = [
    { id: 'opt-A', key: 'A', textKey: 'option_a' },
    { id: 'opt-B', key: 'B', textKey: 'option_b' },
    { id: 'opt-C', key: 'C', textKey: 'option_c' },
    { id: 'opt-D', key: 'D', textKey: 'option_d' }
  ];

  opts.forEach(o => {
    const btn = document.getElementById(o.id);
    btn.textContent = `${o.key}. ${q[o.textKey]}`;
    btn.className = 'option-btn';
    btn.onclick = () => selectOption(q, o.key);
  });

  if (saved) {
    opts.forEach(o => {
      const btn = document.getElementById(o.id);
      if (o.key === saved.selected_option) {
        btn.classList.add(saved.is_correct ? 'correct' : 'incorrect');
      }
      if (o.key === q.correct_option && !saved.is_correct) {
        btn.classList.add('correct');
      }
    });
  }
}

async function selectOption(q, choice) {
  if (!sessionId || !user) return;

  let already = answeredMap[q.id];
  if (!already) {
    const isCorrect = choice === q.correct_option;
    answeredMap[q.id] = { selected_option: choice, is_correct: isCorrect };
    if (isCorrect) correctCount++;

    await supabase.from('answers').insert({
      session_id: sessionId,
      user_id: user.id,
      question_id: q.id,
      selected_option: choice,
      is_correct: isCorrect
    });
  } else {
    already.selected_option = choice;
  }

  const opts = [
    { id: 'opt-A', key: 'A' },
    { id: 'opt-B', key: 'B' },
    { id: 'opt-C', key: 'C' },
    { id: 'opt-D', key: 'D' }
  ];
  opts.forEach(o => {
    const btn = document.getElementById(o.id);
    btn.className = 'option-btn';
    if (o.key === choice) {
      btn.classList.add(choice === q.correct_option ? 'correct' : 'incorrect');
    }
    if (o.key === q.correct_option && choice !== q.correct_option) {
      btn.classList.add('correct');
    }
  });

  if (mode === 'tutor') {
    document.getElementById('explanation-box').style.display = 'block';
  } else {
    document.getElementById('reveal-explanation-btn').style.display = 'inline-block';
  }
  document.getElementById('score-badge').textContent = `Score: ${correctCount} correct`;
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

init();
