import { supabaseAvailable, supabaseClient } from './supabase.js';

const DOM = {
  practiceBank: document.getElementById('practice-bank'),
  practiceProgress: document.getElementById('practice-progress'),
  miniProgress: document.getElementById('mini-progress'),
  miniTimer: document.getElementById('mini-timer'),
  practiceStem: document.getElementById('practice-stem'),
  practiceImage: document.getElementById('practice-image'),
  practiceOptions: document.getElementById('practice-options'),
  practiceStatus: document.getElementById('practice-status'),
  practiceNav: document.getElementById('practice-nav'),
  btnSubmitQuestion: document.getElementById('btn-submit-question'),
  btnNextQuestion: document.getElementById('btn-next-question'),
  btnFinishQuiz: document.getElementById('btn-finish-quiz'),
  btnFlagQuestion: document.getElementById('btn-flag-question'),
  toggleTimed: document.getElementById('toggle-timed'),
  timerDisplay: document.getElementById('timer-display'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingText: document.getElementById('loading-text'),
  pageStatus: document.getElementById('page-status'),
  themeToggle: document.getElementById('theme-toggle'),
};

const paidUsers = (window.__PAID_USERS || []).map((e) => e.toLowerCase());

const state = {
  user: null,
  practice: {
    bankName: '',
    bankId: '',
    questions: [],
    current: 0,
    submissions: [],
    timed: false,
    timer: { duration: 30, remaining: 30, handle: null },
    startedAt: null,
  },
};

const shuffleArray = (arr = []) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const setStatus = (msg = '') => {
  if (DOM.pageStatus) DOM.pageStatus.textContent = msg;
};

const showLoading = (message = 'Loading…') => {
  if (DOM.loadingText) DOM.loadingText.textContent = message;
  DOM.loadingOverlay?.classList.remove('hidden');
};

const hideLoading = () => {
  DOM.loadingOverlay?.classList.add('hidden');
};

const getTheme = () => localStorage.getItem('examforge.theme') || 'light';
const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('examforge.theme', theme);
};
applyTheme(getTheme());

const loadSelection = () => {
  try {
    const raw = localStorage.getItem('examforge.nextPractice');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    localStorage.removeItem('examforge.nextPractice');
    return parsed;
  } catch (err) {
    return null;
  }
};

const enforceAccess = () => {
  const email = state.user?.email?.toLowerCase() || '';
  const hasAccess = email && paidUsers.includes(email);
  if (!hasAccess) {
    setStatus('Access required. Please contact Zaid to enable access.');
  }
  return hasAccess;
};

const renderPractice = () => {
  const { questions, current, submissions, bankName, timed, timer } = state.practice;
  if (DOM.practiceBank) DOM.practiceBank.textContent = bankName || 'Practice';
  if (DOM.practiceProgress) DOM.practiceProgress.textContent = questions.length ? `${current + 1} / ${questions.length}` : '0 / 0';
  if (DOM.miniProgress) DOM.miniProgress.textContent = questions.length ? `${current + 1} / ${questions.length}` : '0 / 0';
  if (!questions.length) {
    if (DOM.practiceStatus) DOM.practiceStatus.textContent = 'No questions available.';
    return;
  }
  const q = questions[current];
  const submission = submissions[current] || { selected: null, submitted: false, correct: null };
  if (DOM.practiceStem) DOM.practiceStem.textContent = q.stem;
  if (DOM.practiceImage) {
    if (q.imageUrl) {
      DOM.practiceImage.src = q.imageUrl;
      DOM.practiceImage.classList.remove('hidden');
    } else {
      DOM.practiceImage.classList.add('hidden');
    }
  }
  if (DOM.practiceOptions) {
    const correctIdx = q.answers.findIndex((a) => a.isCorrect);
    DOM.practiceOptions.innerHTML = q.answers
      .map(
        (a, idx) => `
        <li class="option
          ${submission.selected === idx ? 'selected' : ''}
          ${submission.submitted && idx === correctIdx ? 'correct' : ''}
          ${submission.submitted && submission.selected === idx && idx !== correctIdx ? 'incorrect' : ''}"
          data-idx="${idx}">
          <div class="option-index">${String.fromCharCode(65 + idx)}</div>
          <div class="option-content">
            <div>${a.text}</div>
            ${submission.submitted && a.explanation ? `<p class="hint">${a.explanation}</p>` : ''}
          </div>
        </li>`,
      )
      .join('');
  }
  if (DOM.practiceStatus) DOM.practiceStatus.textContent = submission.flagged ? 'Flagged for review' : '';
  if (DOM.toggleTimed) DOM.toggleTimed.checked = timed;
  const timerText = timed ? `${timer.remaining}s` : '--';
  if (DOM.timerDisplay) DOM.timerDisplay.textContent = timerText;
  if (DOM.miniTimer) DOM.miniTimer.textContent = timerText;
  if (DOM.practiceNav) {
    DOM.practiceNav.innerHTML = questions
      .map((_, idx) => {
        const sub = submissions[idx] || {};
        const classes = [
          'nav-item',
          idx === current ? 'active' : '',
          sub.submitted ? (sub.correct ? 'correct' : 'incorrect') : '',
          sub.flagged ? 'flagged' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const flag = sub.flagged ? '<span class="nav-flag" title="Flagged question" aria-hidden="true">⚑</span>' : '';
        return `<div class="${classes}" data-nav="${idx}">${flag}<span class="nav-number">${idx + 1}</span></div>`;
      })
      .join('');
  }
  if (DOM.btnFlagQuestion) {
    DOM.btnFlagQuestion.classList.toggle('active', submission.flagged);
    DOM.btnFlagQuestion.setAttribute('aria-pressed', submission.flagged ? 'true' : 'false');
    DOM.btnFlagQuestion.textContent = submission.flagged ? '⚑ Flagged' : '⚑ Flag';
  }
};

const logAttempt = async (submission, question) => {
  if (!supabaseAvailable() || !state.user || !submission.questionId) return;
  const client = supabaseClient();
  const seconds = Math.max(1, Math.round((Date.now() - (state.practice.startedAt || Date.now())) / 1000));
  try {
    await client.from('attempts').insert({
      user_id: state.user.id,
      question_id: submission.questionId,
      selected: question.answers[submission.selected]?.text || null,
      is_correct: submission.correct,
      seconds_spent: seconds,
    });
  } catch (err) {
    // swallow in client-only mode
  }
};

const renderNoSession = () => {
  setStatus('Please sign in from the dashboard before practicing.');
  hideLoading();
};

const loadQuestions = async (bankId, bankName, timedSelection = false) => {
  showLoading('Loading questions…');
  const client = supabaseAvailable() ? supabaseClient() : null;
  let questions = [];
  if (client) {
    const { data, error } = await client
      .from('questions')
      .select('id, stem, image_url, answers')
      .eq('bank_id', bankId)
      .order('created_at', { ascending: false });
    if (!error && data?.length) {
      questions = data.map((q) => ({
        id: q.id,
        stem: q.stem,
        imageUrl: q.image_url,
        answers: shuffleArray(q.answers || []),
      }));
    }
  }
  if (!questions.length) {
    questions = [
      {
        id: null,
        stem: 'No questions found for this bank.',
        imageUrl: null,
        answers: [
          { text: 'Return', explanation: '', isCorrect: true },
          { text: 'Contact admin', explanation: '', isCorrect: false },
        ],
      },
    ];
  }
  questions = shuffleArray(questions);
  state.practice = {
    bankName,
    bankId,
    questions,
    current: 0,
    submissions: questions.map((q) => ({ selected: null, submitted: false, correct: null, questionId: q.id || null, flagged: false })),
    timed: timedSelection,
    timer: { duration: 30, remaining: 30, handle: null },
    startedAt: Date.now(),
  };
  hideLoading();
  renderPractice();
  startTimer();
};

const handleOptionClick = (event) => {
  const li = event.target.closest('.option');
  if (!li || !DOM.practiceOptions?.contains(li)) return;
  const idx = state.practice.current;
  const currentSubmission = state.practice.submissions[idx] || {};
  if (currentSubmission.submitted) return; // lock answers after submit
  const submissions = state.practice.submissions.slice();
  submissions[idx] = { ...submissions[idx], selected: Number(li.dataset.idx), submitted: false, correct: null };
  state.practice.submissions = submissions;
  renderPractice();
};

const handleSubmitQuestion = () => {
  const { questions, current, submissions } = state.practice;
  const sub = submissions[current] || {};
  if (!questions.length || sub.selected === null) {
    if (DOM.practiceStatus) DOM.practiceStatus.textContent = 'Select an answer first.';
    return;
  }
  const q = questions[current];
  const correctIdx = q.answers.findIndex((a) => a.isCorrect);
  const isCorrect = sub.selected === correctIdx;
  if (DOM.practiceStatus) DOM.practiceStatus.textContent = isCorrect ? 'Correct!' : 'Incorrect. Review and continue.';
  const nextSubs = submissions.slice();
  nextSubs[current] = { ...nextSubs[current], selected: sub.selected, submitted: true, correct: isCorrect };
  state.practice.submissions = nextSubs;
  logAttempt(nextSubs[current], q);
  renderPractice();
};

const handleNextQuestion = () => {
  const total = state.practice.questions.length;
  if (!total) return;
  state.practice.current = (state.practice.current + 1) % total;
  state.practice.startedAt = Date.now();
  resetTimer();
  renderPractice();
};

const handleNavClick = (event) => {
  const idx = event.target.dataset.nav;
  if (idx === undefined) return;
  const target = Number(idx);
  if (Number.isNaN(target)) return;
  if (target < 0 || target >= state.practice.questions.length) return;
  state.practice.current = target;
  state.practice.startedAt = Date.now();
  resetTimer();
  renderPractice();
};

const toggleFlag = () => {
  const { submissions, current } = state.practice;
  if (!submissions.length) return;
  const next = submissions.slice();
  const sub = next[current] || { flagged: false };
  next[current] = { ...sub, flagged: !sub.flagged };
  state.practice.submissions = next;
  renderPractice();
};

const finishQuiz = () => {
  const { questions, submissions } = state.practice;
  if (!questions.length) {
    if (DOM.practiceStatus) DOM.practiceStatus.textContent = 'No questions to submit.';
    return;
  }
  const allSubmitted = submissions.every((s) => s.submitted);
  if (!allSubmitted) {
    if (DOM.practiceStatus) DOM.practiceStatus.textContent = 'Submit all questions first.';
    return;
  }
  const correctCount = submissions.filter((s) => s.correct).length;
  const total = questions.length;
  const accuracyPct = Math.round((correctCount / total) * 100);
  if (DOM.practiceStatus) DOM.practiceStatus.textContent = `Quiz submitted. Score: ${correctCount}/${total} (${accuracyPct}%).`;
};

const resetTimer = () => {
  clearInterval(state.practice.timer.handle);
  state.practice.timer.remaining = state.practice.timer.duration;
  startTimer();
};

const startTimer = () => {
  clearInterval(state.practice.timer.handle);
  if (!state.practice.timed) return;
  state.practice.timer.remaining = state.practice.timer.duration;
  if (DOM.timerDisplay) DOM.timerDisplay.textContent = `${state.practice.timer.remaining}s`;
  if (DOM.miniTimer) DOM.miniTimer.textContent = `${state.practice.timer.remaining}s`;
  state.practice.timer.handle = setInterval(() => {
    state.practice.timer.remaining -= 1;
    if (DOM.timerDisplay) DOM.timerDisplay.textContent = `${state.practice.timer.remaining}s`;
    if (DOM.miniTimer) DOM.miniTimer.textContent = `${state.practice.timer.remaining}s`;
    if (state.practice.timer.remaining <= 0) {
      clearInterval(state.practice.timer.handle);
      handleSubmitQuestion();
    }
  }, 1000);
};

const handleKeyNav = (event) => {
  const activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) return;
  const { questions, current, submissions } = state.practice;
  if (!questions.length) return;
  const answers = questions[current]?.answers || [];
  const sub = submissions[current] || {};
  if (sub.submitted) {
    // Submitted questions are locked; only allow navigation.
    if (event.key === ' ' || event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'Enter') {
      event.preventDefault();
      handleNextQuestion();
    }
    return;
  }
  const maxIdx = answers.length - 1;
  if (maxIdx < 0) return;

  const move = (dir) => {
    let next = sub.selected ?? 0;
    if (dir === 'down' || dir === 'right') next = Math.min(maxIdx, next + 1);
    if (dir === 'up' || dir === 'left') next = Math.max(0, next - 1);
    const nextSubs = submissions.slice();
    nextSubs[current] = { ...sub, selected: next, submitted: false, correct: null };
    state.practice.submissions = nextSubs;
    renderPractice();
  };

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      event.preventDefault();
      move('down');
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      event.preventDefault();
      move('up');
      break;
    case 'Enter':
      if (sub.selected !== null && sub.selected !== undefined) {
        event.preventDefault();
        handleSubmitQuestion();
      }
      break;
    case ' ':
      event.preventDefault();
      handleNextQuestion();
      break;
    default:
      break;
  }
};

const init = async () => {
  DOM.themeToggle?.addEventListener('click', () => {
    const next = getTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });
  document.addEventListener('keydown', handleKeyNav);
  DOM.practiceOptions?.addEventListener('click', handleOptionClick);
  DOM.btnSubmitQuestion?.addEventListener('click', handleSubmitQuestion);
  DOM.btnNextQuestion?.addEventListener('click', handleNextQuestion);
  DOM.practiceNav?.addEventListener('click', handleNavClick);
  DOM.btnFinishQuiz?.addEventListener('click', finishQuiz);
  DOM.btnFlagQuestion?.addEventListener('click', toggleFlag);
  DOM.toggleTimed?.addEventListener('change', (e) => {
    state.practice.timed = e.target.checked;
    resetTimer();
    renderPractice();
  });

  const selection = loadSelection();
  if (!selection?.bankId) {
    setStatus('No bank selected. Return to the dashboard to start a session.');
    return;
  }
  state.practice.timed = Boolean(selection.timed);

  if (!supabaseAvailable()) {
    setStatus('Supabase keys missing. Practice requires Supabase.');
    return;
  }
  const client = supabaseClient();
  const { data } = await client.auth.getSession();
  if (!data?.session?.user) {
    renderNoSession();
    return;
  }
  state.user = data.session.user;
  if (!enforceAccess()) return;
  await loadQuestions(selection.bankId, selection.bankName || 'Practice bank', selection.timed);
};

document.addEventListener('DOMContentLoaded', init);
