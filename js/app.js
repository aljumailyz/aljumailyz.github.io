import { supabaseAvailable, supabaseClient } from './supabase.js';

const DOM = {
  signinEmail: document.getElementById('signin-email'),
  signinPassword: document.getElementById('signin-password'),
  signupEmail: document.getElementById('signup-email'),
  signupPassword: document.getElementById('signup-password'),
  signupFirst: document.getElementById('signup-first'),
  signupLast: document.getElementById('signup-last'),
  signupYear: document.getElementById('signup-year'),
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
  subjectFilter: document.getElementById('subject-filter'),
  btnStart: document.getElementById('btn-start'),
  yearPillsFilter: document.getElementById('year-pills-filter'),
  btnProfile: document.getElementById('btn-profile'),
  btnSignoutDash: document.getElementById('btn-signout-dash'),
  menuToggle: document.getElementById('user-menu-toggle'),
  menuPanel: document.getElementById('user-menu-panel'),
  menuProfile: document.getElementById('menu-profile'),
  menuTheme: document.getElementById('menu-theme'),
  menuSignout: document.getElementById('menu-signout'),
  menuInitials: document.getElementById('user-menu-initials'),
  menuEmail: document.getElementById('user-menu-email'),
  profilePanel: document.getElementById('profile-panel'),
  profileFirst: document.getElementById('profile-first'),
  profileLast: document.getElementById('profile-last'),
  profileYear: document.getElementById('profile-year'),
  profilePassword: document.getElementById('profile-password'),
  btnSaveProfile: document.getElementById('btn-save-profile'),
  btnChangePassword: document.getElementById('btn-change-password'),
  profileStatus: document.getElementById('profile-status'),
  selectTimed: document.getElementById('select-timed'),
  themeToggleHero: document.getElementById('theme-toggle'),
  statAccuracy: document.getElementById('stat-accuracy'),
  statAnswered: document.getElementById('stat-answered'),
  statTime: document.getElementById('stat-time'),
  progressAccuracy: document.getElementById('progress-accuracy'),
  progressAnswered: document.getElementById('progress-answered'),
  progressTime: document.getElementById('progress-time'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingText: document.getElementById('loading-text'),
  btnRefreshBanks: document.getElementById('btn-refresh-banks'),
  accessSignout: document.getElementById('btn-access-signout'),
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
  access: {
    allowed: [],
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

// Ensure Supabase email links return to a dedicated callback page on this domain (works for GH Pages paths).
const basePath = (() => {
  const { pathname } = window.location;
  if (pathname.endsWith('/')) return pathname;
  const parts = pathname.split('/');
  parts.pop(); // remove file name if present
  const joined = parts.join('/') || '';
  return joined.endsWith('/') ? joined : `${joined}/`;
})();
const emailRedirectTo = `${window.location.origin}${basePath}auth-callback.html`;

const sampleBanks = [
  { id: 'sample-year1', name: 'Year 1 – Foundations', questions: 20, year: 'Year 1', subject: 'Foundations' },
  { id: 'sample-year2', name: 'Year 2 – Systems', questions: 18, year: 'Year 2', subject: 'Systems' },
  { id: 'sample-year3', name: 'Year 3 – Clinical', questions: 15, year: 'Year 3', subject: 'Clinical' },
];

const stateBanks = {
  banks: [],
};

const paidUsers = (window.__PAID_USERS || []).map((e) => e.toLowerCase());
const getAllowedEmails = () => {
  const dynamic = state.access?.allowed || [];
  return Array.from(new Set([...paidUsers, ...dynamic]));
};

// Fisher-Yates shuffle
const shuffleArray = (arr = []) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const setDashStatus = (message = '') => {
  if (DOM.dashStatus) {
    DOM.dashStatus.textContent = message || '';
  }
  if (message) showAccessOverlay(message);
  else hideAccessOverlay();
};

const enforceAccess = () => {
  const email = state.user?.email?.toLowerCase() || '';
  const allowed = getAllowedEmails();
  const hasAccess = email && allowed.includes(email);
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

// Launch the dedicated practice page using saved selection.
const startPracticeRedirect = () => {
  if (!enforceAccess()) return;
  const id = DOM.bankSelect?.value;
  if (!id) {
    if (DOM.bankHint) DOM.bankHint.textContent = 'Pick a bank to continue.';
    return;
  }
  const timedSelection = Boolean(DOM.selectTimed?.checked);
  const bank = stateBanks.banks.find((b) => b.id === id) || sampleBanks.find((b) => b.id === id);
  localStorage.setItem(
    'examforge.nextPractice',
    JSON.stringify({ bankId: id, bankName: bank?.name || 'Selected bank', timed: timedSelection }),
  );
  window.location.href = 'practice.html';
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

// Theme toggle
const getTheme = () => localStorage.getItem('examforge.theme') || 'light';
const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('examforge.theme', theme);
};
const toggleTheme = () => {
  const next = getTheme() === 'light' ? 'dark' : 'light';
  applyTheme(next);
};
applyTheme(getTheme());

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
  loadAccessGrants(); // warm access list alongside banks
  const { data, error } = await client.from('banks').select('id, name, year, subject').order('created_at', { ascending: false });
  if (error || !data?.length) {
    stateBanks.banks = sampleBanks;
  } else {
    stateBanks.banks = data.map((b) => ({
      id: b.id,
      name: b.name,
      year: b.year || '',
      subject: b.subject || '',
      questions: b.questions || 0,
    }));
  }
  renderBanks();
  state.banksLoading = false;
  setDashStatus('');
  hideLoading();
};

const getBankYear = (bank) => {
  if (bank.year) return bank.year;
  const name = bank.name?.toLowerCase() || '';
  const match = name.match(/year\s*(\d)/);
  if (match) return `Year ${match[1]}`;
  return 'All';
};

const getYearFilter = () => {
  const active = DOM.yearPillsFilter?.querySelector('.pill.active');
  return active?.dataset.year || 'all';
};

const getBankSubject = (bank) => bank.subject || 'Unlabeled';

const getSubjectFilter = () => DOM.subjectFilter?.value || 'all';

const renderSubjectFilter = (banks = []) => {
  if (!DOM.subjectFilter) return;
  const current = DOM.subjectFilter.value || 'all';
  const subjects = Array.from(
    new Set(
      (banks || [])
        .map((b) => getBankSubject(b))
        .filter(Boolean)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
  subjects.sort((a, b) => a.localeCompare(b));
  const options = ['<option value="all">All subjects</option>']
    .concat(subjects.map((s) => `<option value="${s}">${s}</option>`))
    .join('');
  DOM.subjectFilter.innerHTML = options;
  if (current && subjects.includes(current)) {
    DOM.subjectFilter.value = current;
  }
};

const renderBanks = () => {
  if (!DOM.bankSelect) return;
  const banks = stateBanks.banks.length ? stateBanks.banks : sampleBanks;
  renderSubjectFilter(banks);
  const filter = getYearFilter();
  const subjectFilter = getSubjectFilter();
  const filtered = banks.filter((b) => {
    const yr = getBankYear(b);
    const subj = getBankSubject(b);
    const yearMatches = filter === 'all' || yr === filter;
    const subjectMatches = subjectFilter === 'all' || subj === subjectFilter;
    return yearMatches && subjectMatches;
  });
  const normalizeYearSort = (yr) => {
    const match = `${yr}`.match(/(\d+)/);
    return match ? Number(match[1]) : 999;
  };
  const sorted = filtered.slice().sort((a, b) => {
    const yearDiff = normalizeYearSort(getBankYear(a)) - normalizeYearSort(getBankYear(b));
    if (yearDiff !== 0) return yearDiff;
    const subjDiff = getBankSubject(a).localeCompare(getBankSubject(b));
    if (subjDiff !== 0) return subjDiff;
    return a.name.localeCompare(b.name);
  });
  const options = ['<option value="">Choose a bank…</option>']
    .concat(
      sorted.map(
        (b) =>
          `<option value="${b.id}">${b.name}${
            b.questions ? ` (${b.questions})` : ''
          }${getBankYear(b) && getBankYear(b) !== 'All' ? ` • ${getBankYear(b)}` : ''}${
            getBankSubject(b) ? ` • ${getBankSubject(b)}` : ''
          }</option>`,
      ),
    )
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
  if (DOM.menuEmail) DOM.menuEmail.textContent = state.user?.email || 'Signed out';
  if (DOM.menuInitials) {
    const meta = state.user?.user_metadata || {};
    const base = meta.first_name?.[0] || state.user?.email?.[0] || 'U';
    DOM.menuInitials.textContent = base.toUpperCase();
  }
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
  const first = DOM.signupFirst?.value?.trim();
  const last = DOM.signupLast?.value?.trim();
  const year = DOM.signupYear?.value || '';
  if (!email || !password) return;
  if (mode === 'signup' && (!first || !last || !year)) {
    setAuthUI('First name, last name, and year are required.');
    return;
  }
  const client = supabaseClient();
  if (!client) {
    setAuthUI('Supabase client not ready.');
    return;
  }
  const payload =
    mode === 'signup'
      ? { email, password, options: { emailRedirectTo, data: { first_name: first, last_name: last, year } } }
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
      if (mode === 'signup') {
        setAuthUI('Almost there! Check your inbox and click the verification link to activate your account.');
      } else {
        setAuthUI('Signed in.');
      }
      enforceAccess();
    }
  } catch (err) {
    console.error('Auth error', err);
    setAuthUI('Unable to reach Supabase. Check your project URL/key.');
  }
};

const signOut = async () => {
  hideAccessOverlay();
  if (!supabaseAvailable()) {
    state.user = null;
    setAuthUI('Signed out.');
    persistPractice(true);
    DOM.profilePanel?.classList.add('hidden');
    return;
  }
  await supabaseClient().auth.signOut();
  state.user = null;
  setAuthUI('Signed out.');
  persistPractice(true);
  DOM.profilePanel?.classList.add('hidden');
};

const checkSession = async () => {
  if (!supabaseAvailable()) return;
  const client = supabaseClient();
  const { data } = await client.auth.getSession();
  if (data?.session?.user) {
    state.user = data.session.user;
    setAuthUI('');
    await loadStats();
    await loadAccessGrants();
    initRealtime();
    enforceAccess();
    hydrateProfileForm();
  }
  client.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user ?? null;
    setAuthUI('');
    loadStats();
    if (session?.user) {
      loadAccessGrants();
      initRealtime();
      enforceAccess();
      hydrateProfileForm();
    }
  });
};

const setProgress = (el, value) => {
  if (el) el.style.width = `${Math.min(Math.max(value, 0), 100)}%`;
};

const setProfileStatus = (message = '') => {
  if (DOM.profileStatus) DOM.profileStatus.textContent = message;
};

const hydrateProfileForm = () => {
  const meta = state.user?.user_metadata || {};
  if (DOM.profileFirst) DOM.profileFirst.value = meta.first_name || '';
  if (DOM.profileLast) DOM.profileLast.value = meta.last_name || '';
  if (DOM.profileYear) DOM.profileYear.value = meta.year || '';
  if (DOM.profilePassword) DOM.profilePassword.value = '';
};

const toggleProfilePanel = () => {
  if (!DOM.profilePanel) return;
  const isHidden = DOM.profilePanel.classList.contains('hidden');
  if (isHidden) {
    hydrateProfileForm();
    setProfileStatus('');
    DOM.profilePanel.classList.remove('hidden');
  } else {
    DOM.profilePanel.classList.add('hidden');
    setProfileStatus('');
  }
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
  hydrateProfileForm();
};

const loadAccessGrants = async () => {
  if (!supabaseAvailable()) return;
  try {
    const client = supabaseClient();
    const { data, error } = await client.from('access_grants').select('email, allowed');
    if (error) return;
    state.access.allowed =
      data
        ?.filter((row) => row.allowed !== false && row.email)
        .map((row) => row.email.toLowerCase()) || [];
  } catch (err) {
    // ignore
  }
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

const initRealtime = () => {
  if (!supabaseAvailable()) return;
  const client = supabaseClient();
  if (!client?.channel) return;
  // Avoid duplicate subscriptions by reusing a named channel.
  if (initRealtime.channel) return;
  const channel = client.channel('banks-access-changes');
  channel
    .on('postgres_changes', { event: '*', schema: 'public', table: 'banks' }, () => loadBanks())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'access_grants' }, () => loadAccessGrants())
    .subscribe();
  initRealtime.channel = channel;
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
  // Store selection and redirect to full-screen practice page
  const nextPractice = { bankId: id, bankName: bank?.name || 'Selected bank', timed: timedSelection };
  localStorage.setItem('examforge.nextPractice', JSON.stringify(nextPractice));
  window.location.href = 'practice.html';
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
        answers: shuffleArray(q.answers || []),
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
  // Shuffle question order as well
  questions = shuffleArray(questions);

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

// Keyboard navigation for practice (arrow keys + Enter/Space)
const handleKeyNav = (event) => {
  if (DOM.practice?.classList.contains('hidden')) return;
  const activeElement = document.activeElement;
  // Ignore when typing in inputs
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) return;
  const { questions, current, submissions } = state.practice;
  if (!questions.length) return;
  const answers = questions[current]?.answers || [];
  const sub = submissions[current] || {};
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
    case ' ':
      if (sub.selected !== null && sub.selected !== undefined) {
        event.preventDefault();
        handleSubmitQuestion();
      }
      break;
    default:
      break;
  }
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

const saveProfile = async () => {
  if (!supabaseAvailable() || !state.user) return;
  const client = supabaseClient();
  const first = DOM.profileFirst?.value?.trim();
  const last = DOM.profileLast?.value?.trim();
  const year = DOM.profileYear?.value || '';
  try {
    const { error } = await client.auth.updateUser({
      data: { first_name: first, last_name: last, year },
    });
    if (error) {
      setProfileStatus(error.message);
    } else {
      setProfileStatus('Profile updated.');
      // refresh local user metadata
      const { data } = await client.auth.getSession();
      if (data?.session?.user) state.user = data.session.user;
    }
  } catch (err) {
    setProfileStatus('Could not update profile.');
  }
};

const changePassword = async () => {
  if (!supabaseAvailable() || !state.user) return;
  const newPass = DOM.profilePassword?.value;
  if (!newPass) {
    setProfileStatus('Enter a new password.');
    return;
  }
  const client = supabaseClient();
  try {
    const { error } = await client.auth.updateUser({ password: newPass });
    if (error) setProfileStatus(error.message);
    else setProfileStatus('Password updated.');
  } catch (err) {
    setProfileStatus('Could not update password.');
  }
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
  // Update local stats time (store minutes)
  const minutes = Math.max(1, Math.round(seconds / 60));
  state.stats.time += minutes;
  refreshStats();
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
  // Theme toggle
  DOM.themeToggleHero?.addEventListener('click', toggleTheme);
  DOM.btnSignin?.addEventListener('click', () => auth('signin'));
  DOM.btnSignup?.addEventListener('click', () => auth('signup'));
  DOM.btnSignout?.addEventListener('click', signOut);
  DOM.btnSignoutDash?.addEventListener('click', signOut);
  DOM.accessSignout?.addEventListener('click', signOut);
  DOM.btnProfile?.addEventListener('click', () => setDashStatus('Profile coming soon.'));
  DOM.btnStart?.addEventListener('click', startPracticeRedirect);
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
  document.addEventListener('keydown', handleKeyNav);
  DOM.btnResetStats?.addEventListener('click', () => {
    state.stats = { accuracy: 0, answered: 0, time: 0 };
    refreshStats();
    persistPractice();
    setDashStatus('Stats reset locally. (Supabase stats are unchanged)');
  });
  DOM.btnSaveProfile?.addEventListener('click', saveProfile);
  DOM.btnChangePassword?.addEventListener('click', changePassword);
  DOM.btnProfile?.addEventListener('click', () => {
    window.location.href = 'profile.html';
  });
  DOM.btnRefreshBanks?.addEventListener('click', () => {
    setDashStatus('Refreshing banks…');
    loadBanks();
  });
  DOM.subjectFilter?.addEventListener('change', renderBanks);
  DOM.yearPillsFilter?.addEventListener('click', (event) => {
    const pill = event.target.closest('.pill');
    if (!pill?.dataset.year) return;
    [...DOM.yearPillsFilter.querySelectorAll('.pill')].forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    renderBanks();
  });
  DOM.menuToggle?.addEventListener('click', () => DOM.menuPanel?.classList.toggle('hidden'));
  DOM.menuProfile?.addEventListener('click', () => (window.location.href = 'profile.html'));
  DOM.menuSignout?.addEventListener('click', signOut);
  DOM.menuTheme?.addEventListener('click', toggleTheme);
  document.addEventListener('click', (e) => {
    if (!DOM.menuPanel || !DOM.menuToggle) return;
    if (DOM.menuPanel.contains(e.target) || DOM.menuToggle.contains(e.target)) return;
    DOM.menuPanel.classList.add('hidden');
  });
  await checkSession();
  setAuthUI('');
};

document.addEventListener('DOMContentLoaded', init);
