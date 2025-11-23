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
  btnExplain: document.getElementById('btn-explain'),
  explainOverlay: document.getElementById('explain-overlay'),
  explainStatus: document.getElementById('explain-status'),
  explainCopy: document.getElementById('explain-copy'),
  btnCloseExplain: document.getElementById('btn-close-explain'),
  toggleTimed: document.getElementById('toggle-timed'),
  timerDisplay: document.getElementById('timer-display'),
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingText: document.getElementById('loading-text'),
  pageStatus: document.getElementById('page-status'),
  themeToggle: document.getElementById('theme-toggle'),
  sessionBarBank: document.getElementById('session-bank'),
  sessionTags: document.getElementById('session-tags'),
  sessionProgress: document.getElementById('session-progress'),
  sessionTimer: document.getElementById('session-timer'),
  btnToggleDensity: document.getElementById('btn-toggle-density'),
  btnShortcuts: document.getElementById('btn-shortcuts'),
  shortcutInline: document.getElementById('shortcut-inline'),
  shortcutSheet: document.getElementById('shortcut-sheet'),
  toastStack: document.getElementById('toast-stack'),
  aiHint: document.getElementById('ai-hint'),
  btnCopyExplain: document.getElementById('btn-copy-explain'),
  btnToggleExplain: document.getElementById('btn-toggle-explain'),
  btnRetryExplain: document.getElementById('btn-retry-explain'),
  followupInput: document.getElementById('followup-input'),
  btnAskFollowup: document.getElementById('btn-ask-followup'),
  btnAIMode: document.getElementById('btn-ai-mode'),
  aiLoader: document.getElementById('ai-loader'),
  aiModeBadge: document.getElementById('ai-mode-badge'),
  followupSuggestions: document.getElementById('followup-suggestions'),
  explainHistory: document.getElementById('explain-history'),
};

const paidUsers = (window.__PAID_USERS || []).map((e) => e.toLowerCase());
const DENSITY_STORAGE_KEY = 'examforge.practice.density';

const AI_MODE_KEY = 'examforge.ai.mode';

const state = {
  user: null,
  access: {
    allowed: [],
  },
  practice: {
    bankName: '',
    bankId: '',
    questions: [],
    current: 0,
    submissions: [],
    timed: false,
    timer: { duration: 30, remaining: 30, handle: null },
    startedAt: null,
    sessionStartedAt: null,
    year: '',
    subject: '',
    reviewMode: false,
    reviewQueue: [],
  },
  explainLoading: false,
  aiMode: 'concise',
  explainHistory: [],
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

const showExplainOverlay = (message = '') => {
  if (DOM.explainOverlay) DOM.explainOverlay.classList.remove('hidden');
  if (DOM.explainStatus) DOM.explainStatus.textContent = message || 'Requesting explanation…';
  if (DOM.explainCopy) {
    DOM.explainCopy.textContent = '';
    DOM.explainCopy.classList.remove('collapsed-text');
  }
};

const hideExplainOverlay = () => {
  if (DOM.explainOverlay) DOM.explainOverlay.classList.add('hidden');
};

const DEFAULT_MODEL = '@preset/ai-explainer';
const getPublicAIKey = () => ''; // disabled; use Supabase-stored key instead
const getPublicAIModel = () => DEFAULT_MODEL;
let cachedAIKey = null;
let cachedAIModel = null;

const sanitizeModel = (model) => {
  if (!model || typeof model !== 'string') return DEFAULT_MODEL;
  const first = model.split(/[,\s]+/).filter(Boolean)[0];
  return first || DEFAULT_MODEL;
};

const escapeHtml = (text) =>
  `${text}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const formatExplanation = (text) => {
  if (!text) return '';
  // Strip common markdown emphasis/backticks and normalize bullets.
  const cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^- /gm, '• ')
    .trim();
  const safe = escapeHtml(cleaned);
  return safe.replace(/\(([A-Z]{2,6})\)/g, '(<span class="ai-abbr">$1</span>)');
};

const buildPrompt = (stem, answers, correctIndex, followUp = '', wordLimit = 180) => {
  return [
    `You are a concise medical explainer. Spell out abbreviations on first mention. Explain the correct answer, why the others are wrong, and briefly describe the underlying disease/pathology. Keep it under ${wordLimit} words.`,
    `Question: ${stem}`,
    'Answers:',
    answers.map((a, i) => `${i + 1}. ${a}${i === correctIndex ? ' (correct)' : ''}`).join('\n'),
    followUp ? `Follow-up: ${followUp}` : '',
    'Return a clear teaching explanation with abbreviations expanded the first time they appear.',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const addHistoryEntry = (stem, mode, text) => {
  const entry = {
    id: `${Date.now()}`,
    stem: stem.slice(0, 80),
    mode,
    text,
    at: new Date().toLocaleTimeString(),
  };
  state.explainHistory = [entry, ...state.explainHistory].slice(0, 5);
  renderExplainHistory();
};

const renderExplainHistory = () => {
  if (!DOM.explainHistory) return;
  if (!state.explainHistory.length) {
    DOM.explainHistory.innerHTML = '<p class="muted">No recent explanations.</p>';
    return;
  }
  DOM.explainHistory.innerHTML = state.explainHistory
    .map(
      (h) => `
        <div class="history-item">
          <div>
            <strong>${h.mode === 'detailed' ? 'Detailed' : 'Concise'}</strong>
            <span>${h.at}</span><br>
            <span>${h.stem}</span>
          </div>
          <button class="ghost small" data-history="${h.id}">View</button>
        </div>
      `,
    )
    .join('');
};

const renderFollowupSuggestions = () => {
  if (!DOM.followupSuggestions) return;
  const suggestions = [
    'Expand on the key steps',
    'Explain differential diagnoses',
    'List red flags',
  ];
  DOM.followupSuggestions.innerHTML = suggestions
    .map((s) => `<button class="ghost small" data-suggest="${s}">${s}</button>`)
    .join('');
};

const updateAIModeBadge = () => {
  if (DOM.aiModeBadge) DOM.aiModeBadge.textContent = state.aiMode === 'detailed' ? 'Detailed' : 'Concise';
};

const loadAIMode = () => {
  try {
    const stored = localStorage.getItem(AI_MODE_KEY);
    if (stored === 'detailed' || stored === 'concise') return stored;
  } catch (err) {
    // ignore
  }
  return 'concise';
};

const setAIMode = (mode) => {
  const next = mode === 'detailed' ? 'detailed' : 'concise';
  state.aiMode = next;
  updateAIModeBadge();
  if (DOM.btnAIMode) DOM.btnAIMode.textContent = next === 'detailed' ? 'Detailed' : 'Concise';
  try {
    localStorage.setItem(AI_MODE_KEY, next);
  } catch (err) {
    // ignore
  }
};
const updateExplainAvailability = () => {
  const hasRemoteKey = Boolean(cachedAIKey);
  const disabled = !hasRemoteKey;
  if (DOM.btnExplain) {
    DOM.btnExplain.classList.toggle('disabled', disabled);
    DOM.btnExplain.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (!state.explainLoading) DOM.btnExplain.textContent = disabled ? 'Explain (setup needed)' : 'Explain';
  }
  if (DOM.aiHint) DOM.aiHint.textContent = hasRemoteKey ? 'AI' : 'Set config.js';
};

const fetchAIKeyFromSupabase = async () => {
  if (cachedAIKey) return { key: cachedAIKey, model: cachedAIModel || getPublicAIModel() };
  if (!supabaseAvailable()) return { key: '', model: getPublicAIModel() };
  try {
    const client = supabaseClient();
    const { data, error } = await client.from('ai_keys').select('key, model').eq('id', 'public').maybeSingle();
    if (!error && data?.key) {
      cachedAIKey = data.key;
      cachedAIModel = sanitizeModel(data.model);
      return { key: cachedAIKey, model: cachedAIModel };
    }
  } catch (_err) {
    // fall back silently
  }
  return { key: getPublicAIKey(), model: getPublicAIModel() };
};

const getExplainEndpoint = () => null; // Edge function disabled; client-only OpenRouter via Supabase key

const getTheme = () => localStorage.getItem('examforge.theme') || 'light';
const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('examforge.theme', theme);
};
applyTheme(getTheme());

const getAccessToken = async () => {
  if (!supabaseAvailable()) return null;
  const client = supabaseClient();
  const { data } = await client.auth.getSession();
  return data?.session?.access_token || null;
};

const setDensity = (mode = 'comfortable') => {
  const compact = mode === 'compact';
  document.body.classList.toggle('compact', compact);
  if (DOM.btnToggleDensity) DOM.btnToggleDensity.textContent = compact ? 'Comfortable view' : 'Compact view';
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, compact ? 'compact' : 'comfortable');
  } catch (err) {
    // ignore
  }
};

const loadDensity = () => {
  try {
    return localStorage.getItem(DENSITY_STORAGE_KEY) || 'comfortable';
  } catch (err) {
    return 'comfortable';
  }
};

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

const getAllowedEmails = () => {
  const dynamic = state.access?.allowed || [];
  return Array.from(new Set([...paidUsers, ...dynamic]));
};

const showToast = (message, type = 'success', action = null) => {
  if (!DOM.toastStack) return;
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  const content = document.createElement('div');
  content.textContent = message;
  div.appendChild(content);
  if (action?.label && typeof action.handler === 'function') {
    const btn = document.createElement('button');
    btn.className = 'ghost small';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.handler();
      div.remove();
    });
    div.appendChild(btn);
  }
  DOM.toastStack.appendChild(div);
  setTimeout(() => div.remove(), 4500);
};

const toggleShortcutSheet = (show) => {
  const isVisible = DOM.shortcutSheet && !DOM.shortcutSheet.classList.contains('hidden');
  const next = show !== undefined ? show : !isVisible;
  DOM.shortcutSheet?.classList.toggle('hidden', !next);
};

const enforceAccess = () => {
  const email = state.user?.email?.toLowerCase() || '';
  const allowed = getAllowedEmails();
  const hasAccess = email && allowed.includes(email);
  if (!hasAccess) {
    setStatus('Access required. Please contact Zaid to enable access.');
  } else {
    setStatus('');
  }
  return hasAccess;
};

const renderPractice = () => {
  const { questions, current, submissions, bankName, timed, timer } = state.practice;
  if (state.practice.reviewMode && !state.practice.reviewQueue.length) state.practice.reviewMode = false;
  if (DOM.practiceBank) DOM.practiceBank.textContent = bankName || 'Practice';
  if (DOM.sessionBarBank) DOM.sessionBarBank.textContent = bankName || 'Bank';
  const tagText = [state.practice.year, state.practice.subject].filter(Boolean).join(' • ');
  if (DOM.sessionTags) DOM.sessionTags.textContent = tagText || '—';
  if (DOM.practiceProgress) DOM.practiceProgress.textContent = questions.length ? `${current + 1} / ${questions.length}` : '0 / 0';
  if (DOM.miniProgress) DOM.miniProgress.textContent = questions.length ? `${current + 1} / ${questions.length}` : '0 / 0';
  if (DOM.sessionProgress) DOM.sessionProgress.textContent = questions.length ? `${current + 1} / ${questions.length}` : '0 / 0';
  if (!questions.length) {
    if (DOM.practiceStatus) DOM.practiceStatus.textContent = 'No questions available.';
    if (DOM.sessionTimer) DOM.sessionTimer.textContent = '--';
    if (DOM.timerDisplay) DOM.timerDisplay.textContent = '--';
    if (DOM.miniTimer) DOM.miniTimer.textContent = '--';
    updateExplainAvailability();
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
  if (DOM.sessionTimer) DOM.sessionTimer.textContent = timerText;
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
  updateExplainAvailability();
};

const explainQuestion = async () => {
  const { questions, current } = state.practice;
  const { key: publicKey, model: publicModel } = await fetchAIKeyFromSupabase();
  if (!publicKey) {
    showExplainOverlay('No AI key available. Add a key to Supabase table ai_keys (id=public).');
    return;
  }
  if (!questions.length) return;
  const q = questions[current];
  const answers = q.answers?.map((a) => a.text || '') || [];
  const correctIndex = q.answers?.findIndex((a) => a.isCorrect) ?? 0;
  const wordLimit = state.aiMode === 'detailed' ? 400 : 180;
  const maxTokens = state.aiMode === 'detailed' ? 1100 : 550;
  if (state.explainLoading) {
    showToast('Please wait for the current explanation to finish.', 'error');
    return;
  }
  state.explainLoading = true;
  showExplainOverlay('Requesting explanation…');
  DOM.aiLoader?.classList.remove('hidden');
  if (DOM.btnExplain) {
    DOM.btnExplain.textContent = 'Explaining...';
    DOM.btnExplain.classList.add('disabled');
  }
  try {
    // Force a single model to avoid OpenRouter models-array errors.
    const model = sanitizeModel(publicModel || getPublicAIModel());
    const prompt = buildPrompt(q.stem, answers, correctIndex, '', wordLimit);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publicKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a concise medical explainer for exam prep.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
        top_p: 0.9,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      if (DOM.explainStatus) DOM.explainStatus.textContent = `AI explain failed: ${errText || res.status}`;
      return;
    }
    const data = await res.json();
    const text = formatExplanation(data?.choices?.[0]?.message?.content || data?.explanation || 'No response');
    if (DOM.explainStatus) DOM.explainStatus.textContent = '';
    if (DOM.explainCopy) DOM.explainCopy.innerHTML = text;
    addHistoryEntry(q.stem, state.aiMode, text);
  } catch (err) {
    if (DOM.explainStatus) DOM.explainStatus.textContent = 'AI explain failed. Try again.';
  } finally {
    DOM.aiLoader?.classList.add('hidden');
    state.explainLoading = false;
    if (DOM.btnExplain) {
      DOM.btnExplain.textContent = 'Explain';
      DOM.btnExplain.classList.remove('disabled');
    }
  }
};

const askFollowup = async () => {
  const followUp = DOM.followupInput?.value?.trim();
  if (!followUp) {
    showToast('Enter a follow-up question first.', 'error');
    return;
  }
  if (state.explainLoading) {
    showToast('Please wait for the current explanation to finish.', 'error');
    return;
  }
  const { questions, current } = state.practice;
  if (!questions.length) return;
  const q = questions[current];
  const answers = q.answers?.map((a) => a.text || '') || [];
  const correctIndex = q.answers?.findIndex((a) => a.isCorrect) ?? 0;
  const { key: publicKey, model: publicModel } = await fetchAIKeyFromSupabase();
  if (!publicKey) {
    showExplainOverlay('No AI key available. Add a key to Supabase table ai_keys (id=public).');
    return;
  }
  const wordLimit = state.aiMode === 'detailed' ? 400 : 180;
  const maxTokens = state.aiMode === 'detailed' ? 1100 : 550;
  showExplainOverlay('Requesting follow-up…');
  DOM.aiLoader?.classList.remove('hidden');
  try {
    const model = sanitizeModel(publicModel || getPublicAIModel());
    const prompt = buildPrompt(q.stem, answers, correctIndex, followUp, wordLimit);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publicKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a concise medical explainer for exam prep. Spell out abbreviations on first mention.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
        top_p: 0.9,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      if (DOM.explainStatus) DOM.explainStatus.textContent = `AI explain failed: ${errText || res.status}`;
      return;
    }
    const data = await res.json();
    const text = formatExplanation(data?.choices?.[0]?.message?.content || data?.explanation || 'No response');
    if (DOM.explainStatus) DOM.explainStatus.textContent = '';
    if (DOM.explainCopy) DOM.explainCopy.innerHTML = text;
    addHistoryEntry(q.stem, state.aiMode, text);
  } catch (err) {
    if (DOM.explainStatus) DOM.explainStatus.textContent = 'AI explain failed. Try again.';
  } finally {
    DOM.aiLoader?.classList.add('hidden');
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

const loadQuestions = async (bankIds = [], bankNames = [], timedSelection = false, meta = {}) => {
  showLoading('Loading questions…');
  const client = supabaseAvailable() ? supabaseClient() : null;
  let questions = [];
  const ids = Array.isArray(bankIds) ? bankIds.filter(Boolean) : bankIds ? [bankIds] : [];
  const nameList = Array.isArray(bankNames) ? bankNames : bankNames ? [bankNames] : [];
  const title = nameList.length > 1 ? `${nameList[0]} + ${nameList.length - 1} more` : nameList[0] || 'Practice';
  if (client && ids.length) {
    const query = client.from('questions').select('id, stem, image_url, answers').order('created_at', { ascending: false });
    if (ids.length === 1) query.eq('bank_id', ids[0]);
    else query.in('bank_id', ids);
    const { data, error } = await query;
    if (error) {
      console.warn('Questions load error', error);
      setStatus(`Could not load questions (${error.message || error.code || 'RLS/permissions?'}).`);
    } else if (data?.length) {
      questions = data.map((q) => ({
        id: q.id,
        stem: q.stem,
        imageUrl: q.image_url,
        answers: shuffleArray(q.answers || []),
      }));
    } else {
      setStatus('No questions found for selected banks.');
    }
  }
  if (!questions.length) {
    questions = [
      {
        id: null,
        stem: 'No questions found for the selected banks.',
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
    bankName: title,
    bankId: ids.join(','),
    questions,
    current: 0,
    submissions: questions.map((q) => ({ selected: null, submitted: false, correct: null, questionId: q.id || null, flagged: false })),
    timed: timedSelection,
    timer: { duration: 30, remaining: 30, handle: null },
    startedAt: Date.now(),
    sessionStartedAt: Date.now(),
    year: Array.isArray(meta.years) ? meta.years.join(', ') : meta.year || '',
    subject: Array.isArray(meta.subjects) ? meta.subjects.join(', ') : meta.subject || '',
    reviewMode: false,
    reviewQueue: [],
  };
  hideLoading();
  renderPractice();
  startTimer();
};

const loadAccessGrants = async () => {
  if (!supabaseAvailable()) return;
  try {
    const client = supabaseClient();
    const { data, error } = await client.from('access_grants').select('email, allowed, expires_at');
    if (error) return;
    const now = Date.now();
    state.access.allowed =
      data
        ?.filter((row) => {
          if (row.allowed === false || !row.email) return false;
          if (row.expires_at && new Date(row.expires_at).getTime() < now) return false;
          return true;
        })
        .map((row) => row.email.toLowerCase()) || [];
  } catch (err) {
    // ignore
  }
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
  if (sub.submitted) {
    handleNextQuestion();
    return;
  }
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
  if (state.practice.reviewMode && state.practice.reviewQueue.length) {
    const currentIdx = state.practice.reviewQueue.indexOf(state.practice.current);
    const nextIdx =
      currentIdx === -1 || currentIdx === state.practice.reviewQueue.length - 1
        ? state.practice.reviewQueue[0]
        : state.practice.reviewQueue[currentIdx + 1];
    state.practice.current = nextIdx;
  } else {
    state.practice.current = (state.practice.current + 1) % total;
  }
  state.practice.startedAt = Date.now();
  resetTimer();
  renderPractice();
};

const handlePrevQuestion = () => {
  const total = state.practice.questions.length;
  if (!total) return;
  if (state.practice.reviewMode && state.practice.reviewQueue.length) {
    const currentIdx = state.practice.reviewQueue.indexOf(state.practice.current);
    const prevIdx =
      currentIdx <= 0 ? state.practice.reviewQueue[state.practice.reviewQueue.length - 1] : state.practice.reviewQueue[currentIdx - 1];
    state.practice.current = prevIdx;
  } else {
    state.practice.current = (state.practice.current - 1 + total) % total;
  }
  state.practice.startedAt = Date.now();
  resetTimer();
  renderPractice();
};

const handleNavClick = (event) => {
  const targetEl = event.target.closest('[data-nav]');
  if (!targetEl || !DOM.practiceNav?.contains(targetEl)) return;
  const target = Number(targetEl.dataset.nav);
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

function reviewMistakes() {
  if (!state.practice.reviewQueue.length) {
    if (DOM.practiceStatus) DOM.practiceStatus.textContent = 'No incorrect answers to review.';
    return;
  }
  state.practice.reviewMode = true;
  state.practice.current = state.practice.reviewQueue[0];
  state.practice.startedAt = Date.now();
  resetTimer();
  if (DOM.practiceStatus) DOM.practiceStatus.textContent = 'Reviewing incorrect questions only.';
  renderPractice();
}

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
  const elapsedMs = state.practice.sessionStartedAt ? Date.now() - state.practice.sessionStartedAt : 0;
  const elapsedMin = Math.max(1, Math.round(elapsedMs / 60000));
  const summary = `Score: ${correctCount}/${total} (${accuracyPct}%) • ${elapsedMin} min`;
  state.practice.reviewQueue = submissions
    .map((s, idx) => ({ ...s, idx }))
    .filter((s) => s.submitted && s.correct === false)
    .map((s) => s.idx);
  state.practice.reviewMode = state.practice.reviewQueue.length > 0;
  if (DOM.practiceStatus) DOM.practiceStatus.textContent = `Quiz submitted. ${summary}`;
  showToast(`Quiz submitted. ${summary}`, state.practice.reviewQueue.length ? 'error' : 'success', {
    label: state.practice.reviewQueue.length ? 'Review mistakes' : '',
    handler: () => reviewMistakes(),
  });
  if (!state.practice.reviewQueue.length) state.practice.reviewMode = false;
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
  if (DOM.sessionTimer) DOM.sessionTimer.textContent = `${state.practice.timer.remaining}s`;
  state.practice.timer.handle = setInterval(() => {
    state.practice.timer.remaining -= 1;
    if (DOM.timerDisplay) DOM.timerDisplay.textContent = `${state.practice.timer.remaining}s`;
    if (DOM.miniTimer) DOM.miniTimer.textContent = `${state.practice.timer.remaining}s`;
    if (DOM.sessionTimer) DOM.sessionTimer.textContent = `${state.practice.timer.remaining}s`;
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
  const maxIdx = answers.length - 1;
  if (maxIdx < 0) return;

  const move = (dir) => {
    // Only adjust selection if question isn't submitted yet.
    if (!sub.submitted) {
      let next = sub.selected ?? 0;
      if (dir === 'down' || dir === 'right') next = Math.min(maxIdx, next + 1);
      if (dir === 'up' || dir === 'left') next = Math.max(0, next - 1);
      const nextSubs = submissions.slice();
      nextSubs[current] = { ...sub, selected: next, submitted: false, correct: null };
      state.practice.submissions = nextSubs;
      renderPractice();
    } else {
      // If submitted, let arrow keys navigate between questions.
      if (dir === 'down' || dir === 'right') handleNextQuestion();
      if (dir === 'up' || dir === 'left') handlePrevQuestion();
    }
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
      if (sub.selected !== null && sub.selected !== undefined && !sub.submitted) {
        event.preventDefault();
        handleSubmitQuestion();
      }
      break;
    case ' ':
      event.preventDefault();
      handleNextQuestion();
      break;
    case 'n':
    case 'N':
      event.preventDefault();
      handleNextQuestion();
      break;
    case 'p':
    case 'P':
      event.preventDefault();
      handlePrevQuestion();
      break;
    case 'f':
    case 'F':
      event.preventDefault();
      toggleFlag();
      break;
    case 't':
    case 'T':
      event.preventDefault();
      if (DOM.toggleTimed) {
        DOM.toggleTimed.checked = !DOM.toggleTimed.checked;
        state.practice.timed = DOM.toggleTimed.checked;
        resetTimer();
        renderPractice();
      }
      break;
    case '?':
      event.preventDefault();
      toggleShortcutSheet();
      break;
    case 'Escape':
      toggleShortcutSheet(false);
      break;
    case 'e':
    case 'E':
      event.preventDefault();
      if (!state.explainLoading && DOM.btnExplain && !DOM.btnExplain.classList.contains('disabled')) explainQuestion();
      break;
    default:
      if (event.key >= '1' && event.key <= '6') {
        if (sub.submitted) break;
        const idxNum = Number(event.key) - 1;
        if (idxNum >= 0 && idxNum <= maxIdx) {
          const nextSubs = submissions.slice();
          nextSubs[current] = { ...sub, selected: idxNum, submitted: sub.submitted, correct: sub.correct };
          state.practice.submissions = nextSubs;
          renderPractice();
        }
      }
      break;
  }
};

const init = async () => {
  DOM.themeToggle?.addEventListener('click', () => {
    const next = getTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });
  setAIMode(loadAIMode());
  // Fetch AI key upfront so Explain can enable if available.
  fetchAIKeyFromSupabase().finally(updateExplainAvailability);
  document.addEventListener('keydown', handleKeyNav);
  DOM.practiceOptions?.addEventListener('click', handleOptionClick);
  DOM.btnSubmitQuestion?.addEventListener('click', handleSubmitQuestion);
  DOM.btnNextQuestion?.addEventListener('click', handleNextQuestion);
  DOM.practiceNav?.addEventListener('click', handleNavClick);
  DOM.btnFinishQuiz?.addEventListener('click', finishQuiz);
  DOM.btnFlagQuestion?.addEventListener('click', toggleFlag);
  DOM.btnExplain?.addEventListener('click', explainQuestion);
  DOM.btnCloseExplain?.addEventListener('click', hideExplainOverlay);
  DOM.btnCopyExplain?.addEventListener('click', async () => {
    if (!DOM.explainCopy?.textContent) return;
    try {
      await navigator.clipboard.writeText(DOM.explainCopy.textContent);
      showToast('Copied explanation.', 'success');
    } catch (err) {
      showToast('Copy failed.', 'error');
    }
  });
  DOM.btnToggleExplain?.addEventListener('click', () => {
    if (!DOM.explainCopy) return;
    const collapsed = DOM.explainCopy.classList.toggle('collapsed-text');
    DOM.btnToggleExplain.textContent = collapsed ? 'Expand' : 'Collapse';
  });
  DOM.btnRetryExplain?.addEventListener('click', explainQuestion);
  DOM.btnAskFollowup?.addEventListener('click', askFollowup);
  DOM.btnAIMode?.addEventListener('click', () => {
    setAIMode(state.aiMode === 'detailed' ? 'concise' : 'detailed');
  });
  DOM.followupSuggestions?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-suggest]');
    if (!btn) return;
    const text = btn.dataset.suggest || '';
    if (DOM.followupInput) DOM.followupInput.value = text;
    askFollowup();
  });
  DOM.explainHistory?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-history]');
    if (!btn) return;
    const id = btn.dataset.history;
    const entry = state.explainHistory.find((h) => h.id === id);
    if (entry && DOM.explainCopy) {
      DOM.explainCopy.innerHTML = entry.text;
      showExplainOverlay('Loaded from history');
      if (DOM.explainStatus) DOM.explainStatus.textContent = '';
    }
  });
  DOM.toggleTimed?.addEventListener('change', (e) => {
    state.practice.timed = e.target.checked;
    resetTimer();
    renderPractice();
  });
  DOM.btnToggleDensity?.addEventListener('click', () =>
    setDensity(document.body.classList.contains('compact') ? 'comfortable' : 'compact'),
  );
  DOM.btnShortcuts?.addEventListener('click', () => toggleShortcutSheet());
  DOM.shortcutInline?.addEventListener('click', () => toggleShortcutSheet());
  setDensity(loadDensity());
  renderExplainHistory();
  renderFollowupSuggestions();
  updateAIModeBadge();

  const selection = loadSelection();
  const bankIds = selection?.bankIds || (selection?.bankId ? [selection.bankId] : []);
  if (!bankIds.length) {
    setStatus('No banks selected. Return to the dashboard to start a session.');
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
  await loadAccessGrants();
  if (!enforceAccess()) return;
  await loadQuestions(bankIds, selection.bankNames || [], selection.timed, {
    years: selection.years || [],
    subjects: selection.subjects || [],
  });
};

document.addEventListener('DOMContentLoaded', init);
