import { supabaseAvailable, supabaseClient } from './supabase.js';

const DOM = {
  signinEmail: document.getElementById('signin-email'),
  signinPassword: document.getElementById('signin-password'),
  signupEmail: document.getElementById('signup-email'),
  signupPassword: document.getElementById('signup-password'),
  btnSignin: document.getElementById('btn-signin'),
  btnSignup: document.getElementById('btn-signup'),
  btnSignout: document.getElementById('btn-signout'),
  authStatus: document.getElementById('auth-status'),
  hero: document.getElementById('hero'),
  dashboard: document.getElementById('dashboard'),
  dashGreeting: document.getElementById('dash-greeting'),
  dashSession: document.getElementById('dash-session'),
  dashStatus: document.getElementById('dash-status'),
  bankSelect: document.getElementById('bank-select'),
  bankHint: document.getElementById('bank-hint'),
  btnStart: document.getElementById('btn-start'),
  btnProfile: document.getElementById('btn-profile'),
  btnSignoutDash: document.getElementById('btn-signout-dash'),
  selectTimed: document.getElementById('select-timed'),
  statAccuracy: document.getElementById('stat-accuracy'),
  statAnswered: document.getElementById('stat-answered'),
  statTime: document.getElementById('stat-time'),
  progressAccuracy: document.getElementById('progress-accuracy'),
  progressAnswered: document.getElementById('progress-answered'),
  progressTime: document.getElementById('progress-time'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingText: document.getElementById('loading-text'),
  practice: document.getElementById('practice'),
  practiceBank: document.getElementById('practice-bank'),
  practiceProgress: document.getElementById('practice-progress'),
  practiceStem: document.getElementById('practice-stem'),
  practiceImage: document.getElementById('practice-image'),
  practiceOptions: document.getElementById('practice-options'),
  btnSubmitQuestion: document.getElementById('btn-submit-question'),
  btnNextQuestion: document.getElementById('btn-next-question'),
  practiceStatus: document.getElementById('practice-status'),
  practiceNav: document.getElementById('practice-nav'),
  btnFinishQuiz: document.getElementById('btn-finish-quiz'),
  toggleTimed: document.getElementById('toggle-timed'),
  timerDisplay: document.getElementById('timer-display'),
  btnResetStats: document.getElementById('btn-reset-stats'),
};

const state = {
  user: null,
  stats: {
    accuracy: 0,
    answered: 0,
    time: 0,
  },
  banksLoading: false,
  practice: {
    bankName: '',
    bankId: '',
    questions: [],
    current: 0,
    submissions: [],
    timed: false,
    timer: {
      duration: 30,
      remaining: 30,
      handle: null,
    },
    startedAt: null,
  },
};

// Ensure Supabase email links return to the current domain (e.g., GitHub Pages).
const emailRedirectTo = `${window.location.origin}${window.location.pathname}`;

const sampleBanks = [
  { id: 'sample-medicine', name: 'Medicine – Sample', questions: 20 },
  { id: 'sample-step', name: 'Step-style Sample', questions: 12 },
];

const stateBanks = {
  banks: [],
};

const paidUsers = (window.__PAID_USERS || []).map((e) => e.toLowerCase());

const setDashStatus = (message = '') => {
  if (DOM.dashStatus) {
    DOM.dashStatus.textContent = message || '';
  }
  if (message) showAccessOverlay(message);
  else hideAccessOverlay();
};

const enforceAccess = () => {
  const email = state.user?.email?.toLowerCase() || '';
  const hasAccess = email && paidUsers.includes(email);
  const message = hasAccess ? '' : 'Please contact Zaid to enable access.';
  setDashStatus(message);
  if (!hasAccess) {
    DOM.btnStart?.setAttribute('disabled', 'disabled');
    DOM.bankSelect?.setAttribute('disabled', 'disabled');
    DOM.practice?.classList.add('hidden');
  } else {
    DOM.btnStart?.removeAttribute('disabled');
    DOM.bankSelect?.removeAttribute('disabled');
  }
  return hasAccess;
};

const showLoading = (message = 'Loading…') => {
  if (DOM.loadingText) DOM.loadingText.textContent = message;
  DOM.loadingOverlay?.classList.remove('hidden');
};

const hideLoading = () => {
  DOM.loadingOverlay?.classList.add('hidden');
};

const showAccessOverlay = (message) => {
  const overlay = document.getElementById('access-overlay');
  const msg = document.getElementById('access-message');
  if (msg && message) msg.textContent = message;
  overlay?.classList.remove('hidden');
};

const hideAccessOverlay = () => {
  const overlay = document.getElementById('access-overlay');
  overlay?.classList.add('hidden');
};

const loadBanks = async () => {
  state.banksLoading = true;
  setDashStatus('Loading banks…');
  showLoading('Loading banks…');
  if (!supabaseAvailable()) {
    stateBanks.banks = sampleBanks;
    renderBanks();
    state.banksLoading = false;
    setDashStatus('');
    hideLoading();
    return;
  }
  const client = supabaseClient();
  if (!client) {
    stateBanks.banks = sampleBanks;
    renderBanks();
    state.banksLoading = false;
    setDashStatus('');
    hideLoading();
    return;
  }
  const { data, error } = await client.from('banks').select('id, name').order('created_at', { ascending: false });
  if (error || !data?.length) {
    stateBanks.banks = sampleBanks;
  } else {
    stateBanks.banks = data.map((b) => ({ id: b.id, name: b.name, questions: b.questions || 0 }));
  }
  renderBanks();
  state.banksLoading = false;
  setDashStatus('');
  hideLoading();
};

const renderBanks = () => {
  if (!DOM.bankSelect) return;
  const banks = stateBanks.banks.length ? stateBanks.banks : sampleBanks;
  const options = ['<option value="">Choose a bank…</option>']
    .concat(banks.map((b) => `<option value="${b.id}">${b.name}${b.questions ? ` (${b.questions})` : ''}</option>`))
    .join('');
  DOM.bankSelect.innerHTML = options;
};

const setAuthUI = (message = '') => {
  let text = message;
  if (!text) {
    if (state.user?.email) text = `Signed in as ${state.user.email}`;
    else if (state.user) text = 'Signed in.';
  }
  if (DOM.authStatus && text !== undefined) DOM.authStatus.textContent = text;
  if (DOM.btnSignout) DOM.btnSignout.style.display = state.user ? 'block' : 'none';
  const signedIn = Boolean(state.user);
  DOM.hero?.classList.toggle('hidden', signedIn);
  DOM.dashboard?.classList.toggle('hidden', !signedIn);
  if (signedIn) {
    if (DOM.dashGreeting) DOM.dashGreeting.textContent = `Welcome, ${state.user.email}`;
    if (DOM.dashSession) DOM.dashSession.textContent = 'Signed in';
  }
  if (signedIn) enforceAccess();
};

const auth = async (mode) => {
  if (!supabaseAvailable()) {
    setAuthUI('Supabase keys missing.');
    return;
  }
  const email = mode === 'signup' ? DOM.signupEmail?.value : DOM.signinEmail?.value;
  const password = mode === 'signup' ? DOM.signupPassword?.value : DOM.signinPassword?.value;
  if (!email || !password) return;
  const client = supabaseClient();
  if (!client) {
    setAuthUI('Supabase client not ready.');
    return;
  }
  const payload =
    mode === 'signup'
      ? { email, password, options: { emailRedirectTo } }
      : { email, password };
  try {
    const { data, error } =
      mode === 'signup'
        ? await client.auth.signUp(payload)
        : await client.auth.signInWithPassword(payload);
    if (error) {
      setAuthUI(error.message);
    } else {
      state.user = data.user || data.session?.user || null;
      setAuthUI(mode === 'signup' ? 'Check your email to confirm.' : 'Signed in.');
      enforceAccess();
    }
  } catch (err) {
    console.error('Auth error', err);
    setAuthUI('Unable to reach Supabase. Check your project URL/key.');
  }
};

const signOut = async () => {
  if (!supabaseAvailable()) return;
  await supabaseClient().auth.signOut();
  state.user = null;
  setAuthUI('Signed out.');
  persistPractice(true);
};

const checkSession = async () => {
  if (!supabaseAvailable()) return;
  const client = supabaseClient();
  const { data } = await client.auth.getSession();
  if (data?.session?.user) {
    state.user = data.session.user;
    setAuthUI('');
    await loadStats();
    enforceAccess();
  }
  client.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user ?? null;
    setAuthUI('');
    loadStats();
    if (session?.user) enforceAccess();
  });
};

const setProgress = (el, value) => {
  if (el) el.style.width = `${Math.min(Math.max(value, 0), 100)}%`;
};

const loadStats = async () => {
  if (!supabaseAvailable() || !state.user) return;
  const client = supabaseClient();
  const { data, error } = await client
    .from('user_stats')
    .select('accuracy, answered, time')
    .eq('user_id', state.user.id)
    .maybeSingle();
  if (error || !data) return;
  state.stats.accuracy = Math.round(data.accuracy || 0);
  state.stats.answered = data.answered || 0;
  state.stats.time = data.time || 0;
  refreshStats();
};

const refreshStats = () => {
  const { accuracy, answered, time } = state.stats;
  if (DOM.statAccuracy) DOM.statAccuracy.textContent = accuracy ? `${accuracy}%` : '—';
  if (DOM.statAnswered) DOM.statAnswered.textContent = answered ? answered : '—';
  if (DOM.statTime) DOM.statTime.textContent = time ? `${time} min` : '—';
  setProgress(DOM.progressAccuracy, accuracy || 0);
  setProgress(DOM.progressAnswered, Math.min(((answered || 0) / 200) * 100, 100));
  setProgress(DOM.progressTime, Math.min(((time || 0) / 300) * 100, 100));
};

const handleStartPractice = () => {
  if (!enforceAccess()) return;
  const id = DOM.bankSelect?.value;
  if (!id) {
    if (DOM.bankHint) DOM.bankHint.textContent = 'Pick a bank to continue.';
    return;
  }
  const timedSelection = Boolean(DOM.selectTimed?.checked);
  if (state.banksLoading) {
    if (DOM.bankHint) DOM.bankHint.textContent = 'Still loading banks… try again in a moment.';
    return;
  }
  const bank = stateBanks.banks.find((b) => b.id === id) || sampleBanks.find((b) => b.id === id);
  if (DOM.bankHint) DOM.bankHint.textContent = `Launching ${bank?.name || 'bank'}…`;
  if (DOM.dashStatus) DOM.dashStatus.textContent = `Practice session ready for ${bank?.name || 'selected bank'}.`;
  loadPracticeQuestions(id, bank?.name || 'Selected bank', timedSelection);
};

const renderPractice = () => {
  const { questions, current, submissions, bankName, timed, timer } = state.practice;
  if (!DOM.practice) return;
  DOM.practice.classList.toggle('hidden', !questions.length);
  if (!questions.length) {
    if (DOM.practiceStatus) DOM.practiceStatus.textContent = 'No questions found for this bank.';
    return;
  }
  const q = questions[current];
  const submission = submissions[current] || { selected: null, submitted: false, correct: null };
  if (DOM.practiceBank) DOM.practiceBank.textContent = bankName;
  if (DOM.practiceProgress) DOM.practiceProgress.textContent = `${current + 1} / ${questions.length}`;
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
  if (DOM.practiceStatus) DOM.practiceStatus.textContent = '';
  if (DOM.toggleTimed) DOM.toggleTimed.checked = timed;
  if (DOM.timerDisplay) DOM.timerDisplay.textContent = timed ? `${timer.remaining}s` : '--';
  if (DOM.practiceNav) {
    DOM.practiceNav.innerHTML = questions
      .map((_, idx) => {
        const sub = submissions[idx] || {};
        const classes = [
          'nav-item',
          idx === current ? 'active' : '',
          sub.submitted ? (sub.correct ? 'correct' : 'incorrect') : '',
        ]
          .filter(Boolean)
          .join(' ');
        return `<div class="${classes}" data-nav="${idx}">${idx + 1}</div>`;
      })
      .join('');
  }
};

const loadPracticeQuestions = async (bankId, bankName, timedSelection = false) => {
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
        answers: q.answers || [],
      }));
    }
  }
  if (!questions.length) {
    // fallback to sample if none
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
  state.practice = {
    bankName,
    bankId,
    questions,
    current: 0,
    submissions: questions.map(() => ({ selected: null, submitted: false, correct: null, questionId: null })),
    timed: timedSelection,
    timer: { duration: 30, remaining: 30, handle: null },
    startedAt: Date.now(),
  };
  state.practice.submissions = questions.map((q) => ({
    selected: null,
    submitted: false,
    correct: null,
    questionId: q.id || null,
  }));
  persistPractice();
  hideLoading();
  renderPractice();
  startTimer();
};

const handleOptionClick = (event) => {
  const li = event.target.closest('.option');
  if (!li || !DOM.practiceOptions?.contains(li)) return;
  const idx = state.practice.current;
  const submissions = state.practice.submissions.slice();
  submissions[idx] = { ...submissions[idx], selected: Number(li.dataset.idx), submitted: false, correct: null };
  state.practice.submissions = submissions;
  persistPractice();
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
  if (DOM.practiceStatus) DOM.practiceStatus.textContent = isCorrect ? 'Correct!' : 'Incorrect. Review and try next.';
  const nextSubs = submissions.slice();
  nextSubs[current] = { ...nextSubs[current], selected: sub.selected, submitted: true, correct: isCorrect };
  state.practice.submissions = nextSubs;
  logAttempt(nextSubs[current], q);
  persistPractice();
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
  state.stats.answered += total;
  state.stats.accuracy = accuracyPct;
  refreshStats();
  persistPractice(true);
  startTimer();
  if (DOM.practiceStatus) DOM.practiceStatus.textContent = `Quiz submitted. Score: ${correctCount}/${total} (${accuracyPct}%).`;
};

const persistPractice = (clear = false) => {
  const key = 'examforge.practice';
  if (clear) {
    localStorage.removeItem(key);
    return;
  }
  const payload = {
    practice: state.practice,
    stats: state.stats,
  };
  if (payload.practice?.timer) payload.practice.timer.handle = null;
  localStorage.setItem(key, JSON.stringify(payload));
};

const restorePractice = () => {
  try {
    const raw = localStorage.getItem('examforge.practice');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.practice?.questions?.length) {
      state.practice = parsed.practice;
      if (state.practice.timer) state.practice.timer.handle = null;
      state.stats = parsed.stats || state.stats;
      renderPractice();
      startTimer();
    }
  } catch (err) {
    console.warn('Restore failed', err);
  }
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
  state.practice.timer.handle = setInterval(() => {
    state.practice.timer.remaining -= 1;
    if (DOM.timerDisplay) DOM.timerDisplay.textContent = `${state.practice.timer.remaining}s`;
    if (state.practice.timer.remaining <= 0) {
      clearInterval(state.practice.timer.handle);
      handleSubmitQuestion();
    }
  }, 1000);
};

const logAttempt = async (submission, question) => {
  if (!supabaseAvailable() || !state.user || !submission.questionId) return;
  const client = supabaseClient();
  const seconds = Math.max(1, Math.round((Date.now() - (state.practice.startedAt || Date.now())) / 1000));
  await client.from('attempts').insert({
    user_id: state.user.id,
    question_id: submission.questionId,
    selected: question.answers[submission.selected]?.text || null,
    is_correct: submission.correct,
    seconds_spent: seconds,
  });
};

const init = async () => {
  renderBanks(); // show sample immediately
  loadBanks(); // async fetch real banks
  refreshStats();
  restorePractice();
  DOM.btnSignin?.addEventListener('click', () => auth('signin'));
  DOM.btnSignup?.addEventListener('click', () => auth('signup'));
  DOM.btnSignout?.addEventListener('click', signOut);
  DOM.btnSignoutDash?.addEventListener('click', signOut);
  DOM.btnProfile?.addEventListener('click', () => setDashStatus('Profile coming soon.'));
  DOM.btnStart?.addEventListener('click', handleStartPractice);
  DOM.practiceOptions?.addEventListener('click', handleOptionClick);
  DOM.btnSubmitQuestion?.addEventListener('click', handleSubmitQuestion);
  DOM.btnNextQuestion?.addEventListener('click', handleNextQuestion);
  DOM.practiceNav?.addEventListener('click', handleNavClick);
  DOM.btnFinishQuiz?.addEventListener('click', finishQuiz);
  DOM.toggleTimed?.addEventListener('change', (e) => {
    state.practice.timed = e.target.checked;
    resetTimer();
    persistPractice();
    renderPractice();
  });
  DOM.btnResetStats?.addEventListener('click', () => {
    state.stats = { accuracy: 0, answered: 0, time: 0 };
    refreshStats();
    persistPractice();
    setDashStatus('Stats reset locally. (Supabase stats are unchanged)');
  });
  await checkSession();
  setAuthUI('');
};

document.addEventListener('DOMContentLoaded', init);
