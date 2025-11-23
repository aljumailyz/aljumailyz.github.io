import { supabaseAvailable, supabaseClient } from './supabase.js';

const DOM = {
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  btnSignin: document.getElementById('btn-signin'),
  btnSignout: document.getElementById('btn-signout'),
  authStatus: document.getElementById('auth-status'),
  hero: document.getElementById('hero'),
  dashboard: document.getElementById('dashboard'),
  dashGreeting: document.getElementById('dash-greeting'),
  dashSession: document.getElementById('dash-session'),
  dashUpdated: document.getElementById('dash-updated'),
  bankList: document.getElementById('bank-list'),
  bankSelect: document.getElementById('question-bank'),
  bankNameInput: document.getElementById('bank-name'),
  bankYearInput: document.getElementById('bank-year'),
  bankSubjectInput: document.getElementById('bank-subject'),
  bankFilter: document.getElementById('bank-filter'),
  bankFilterYear: document.getElementById('bank-filter-year'),
  bankFilterSubject: document.getElementById('bank-filter-subject'),
  bankSort: document.getElementById('bank-sort'),
  btnSaveBank: document.getElementById('btn-save-bank'),
  btnResetBank: document.getElementById('btn-reset-bank'),
  btnNewBank: document.getElementById('btn-new-bank'),
  questionForm: {
    bank: document.getElementById('question-bank'),
    topic: document.getElementById('question-topic'),
    stem: document.getElementById('question-stem'),
    image: document.getElementById('question-image'),
    answerCount: document.getElementById('answer-count'),
    answerEditor: document.getElementById('answer-editor'),
    btnSave: document.getElementById('btn-save-question'),
    btnReset: document.getElementById('btn-reset-question'),
    status: document.getElementById('question-status'),
  },
  questionList: document.getElementById('question-list'),
  userSearch: document.getElementById('user-search'),
  userList: document.getElementById('user-list'),
  userActivity: document.getElementById('user-activity'),
  btnRefreshActivity: document.getElementById('btn-refresh-activity'),
  accessEmail: document.getElementById('access-email'),
  accessDuration: document.getElementById('access-duration'),
  btnAddAccess: document.getElementById('btn-add-access'),
  accessList: document.getElementById('access-list'),
  historyList: document.getElementById('history-list'),
  btnClearHistory: document.getElementById('btn-clear-history'),
  dashStatus: document.getElementById('dash-status'),
  importFile: document.getElementById('import-file'),
  btnImport: document.getElementById('btn-import'),
  importStatus: document.getElementById('import-status'),
  importYear: document.getElementById('import-year'),
  importSubject: document.getElementById('import-subject'),
  questionFilterBank: document.getElementById('question-filter-bank'),
  questionFilterText: document.getElementById('question-filter-text'),
  countBanks: document.getElementById('count-banks'),
  countUsers: document.getElementById('count-users'),
  countAccess: document.getElementById('count-access'),
  countActivity: document.getElementById('count-activity'),
  countHistory: document.getElementById('count-history'),
  countQuestions: document.getElementById('count-questions'),
  btnToggleDensity: document.getElementById('btn-toggle-density'),
};

const COLLAPSE_STORAGE_KEY = 'examforge.admin.collapsed';
const DENSITY_STORAGE_KEY = 'examforge.admin.density';

const state = {
  user: null,
  banks: [],
  questions: [],
  answers: [],
  editingQuestionId: null,
  editingBankId: null,
  users: [],
  userActivity: [],
  history: [],
  accessGrants: [],
  collapsedPanels: {},
  bankMap: {},
  density: 'comfortable',
  lastUpdated: null,
};

const setDashStatus = (message = '') => {
  if (DOM.dashStatus) DOM.dashStatus.textContent = message;
};

const setQuestionStatus = (message = '') => {
  if (DOM.questionForm.status) DOM.questionForm.status.textContent = message;
};

const setImportStatus = (message = '') => {
  if (DOM.importStatus) DOM.importStatus.textContent = message;
};

const loadHistory = () => {
  try {
    const raw = localStorage.getItem('examforge.admin.history');
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch (err) {
    return [];
  }
};

const persistHistory = () => {
  try {
    localStorage.setItem('examforge.admin.history', JSON.stringify(state.history.slice(0, 30)));
  } catch (err) {
    // ignore
  }
};

const loadCollapsedPanels = () => {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch (err) {
    return {};
  }
};

const persistCollapsedPanels = (collapsed = {}) => {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapsed));
  } catch (err) {
    // ignore
  }
};

const applyCollapsedPanels = () => {
  const panels = document.querySelectorAll('[data-collapsible]');
  panels.forEach((panel) => {
    const key = panel.dataset.collapsible;
    const collapsed = Boolean(state.collapsedPanels?.[key]);
    panel.classList.toggle('collapsed', collapsed);
    const toggle = panel.querySelector(`[data-collapse-target="${key}"]`);
    if (toggle) {
      toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      toggle.textContent = collapsed ? 'Expand' : 'Collapse';
    }
  });
};

const rebuildBankMap = () => {
  state.bankMap = state.banks.reduce((acc, bank) => {
    acc[bank.id] = {
      name: bank.name,
      year: bank.year || '',
      subject: bank.subject || '',
    };
    return acc;
  }, {});
};

const updateCounts = () => {
  if (DOM.countBanks) DOM.countBanks.textContent = state.banks.length;
  if (DOM.countUsers) DOM.countUsers.textContent = state.users.length;
  if (DOM.countAccess) DOM.countAccess.textContent = state.accessGrants.length;
  if (DOM.countActivity) DOM.countActivity.textContent = state.userActivity.length;
  if (DOM.countHistory) DOM.countHistory.textContent = state.history.length;
  if (DOM.countQuestions) DOM.countQuestions.textContent = state.questions.length;
};

const loadDensityPreference = () => {
  try {
    return localStorage.getItem(DENSITY_STORAGE_KEY) || 'comfortable';
  } catch (err) {
    return 'comfortable';
  }
};

const setDensity = (mode = 'comfortable') => {
  const compact = mode === 'compact';
  document.body.classList.toggle('compact', compact);
  state.density = compact ? 'compact' : 'comfortable';
  if (DOM.btnToggleDensity) DOM.btnToggleDensity.textContent = compact ? 'Comfortable view' : 'Compact view';
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, state.density);
  } catch (err) {
    // ignore
  }
};

const addHistoryEntry = ({ id, stem, bankId, action }) => {
  const entry = {
    id,
    stem: stem || '',
    bankId: bankId || '',
    action: action || 'Updated',
    at: new Date().toISOString(),
    by: state.user?.email || '',
  };
  state.history = [entry, ...state.history].slice(0, 30);
  persistHistory();
  renderHistory();
  updateCounts();
};

const getClient = () => {
  if (!supabaseAvailable()) {
    setDashStatus('Supabase keys missing.');
    return null;
  }
  return supabaseClient();
};

const updateBankCounts = () => {
  const counts = state.questions.reduce((acc, q) => {
    acc[q.bankId] = (acc[q.bankId] || 0) + 1;
    return acc;
  }, {});
  state.banks = state.banks.map((b) => ({ ...b, count: counts[b.id] || 0 }));
  rebuildBankMap();
};

const loadBanks = async () => {
  const client = getClient();
  if (!client) return;
  const { data, error } = await client.from('banks').select('*').order('created_at', { ascending: false });
  if (error) {
    setDashStatus(`Banks error: ${error.message}`);
    return;
  }
  state.banks = (data || []).map((b) => ({
    ...b,
    subject: b.subject || '',
  }));
  updateBankCounts();
  updateCounts();
  renderBanks();
};

const loadQuestions = async () => {
  const client = getClient();
  if (!client) return;
  const { data, error } = await client
    .from('questions')
    .select('id, bank_id, topic, stem, image_url, answers')
    .order('created_at', { ascending: false });
  if (error) {
    setDashStatus(`Questions error: ${error.message}`);
    return;
  }
  state.questions =
    data?.map((q) => ({
      id: q.id,
      bankId: q.bank_id,
      topic: q.topic,
      stem: q.stem,
      imageUrl: q.image_url,
      answers: q.answers || [],
    })) || [];
  updateBankCounts();
  renderBanks();
  renderQuestions();
  updateCounts();
};

const loadUsers = async () => {
  const client = getClient();
  if (!client) return;
  const profileMap = await buildProfileMap();
  const { data, error } = await client.from('user_stats').select('user_id, accuracy, answered, time');
  if (error) {
    setDashStatus('User stats view missing or restricted. Create `user_stats` view.');
    return;
  }
  state.users =
    data?.map((u) => ({
      email: u.user_id,
      name: profileMap[u.user_id] || profileMap[u.user_id?.toLowerCase?.()]?.name || '',
      accuracy: Math.round(u.accuracy || 0),
      answered: u.answered || 0,
      time: u.time || 0,
    })) || [];
  renderUsers();
  updateCounts();
};

const loadAccessGrants = async () => {
  const client = getClient();
  if (!client) return;
  const { data, error } = await client.from('access_grants').select('email, allowed, expires_at').order('email');
  if (error) {
    setDashStatus('Access table missing (access_grants). Create it with email text, allowed boolean.');
    return;
  }
  state.accessGrants = (data || []).map((row) => ({
    email: (row.email || '').toLowerCase(),
    allowed: row.allowed !== false,
    expiresAt: row.expires_at || null,
  }));
  renderAccessGrants();
  updateCounts();
};

const buildProfileMap = async () => {
  const client = getClient();
  if (!client) return {};
  const tables = ['profiles', 'user_profiles'];
  for (const table of tables) {
    try {
      const { data, error } = await client.from(table).select('id, email, first_name, last_name').limit(500);
      if (error) continue;
      const map = {};
      (data || []).forEach((row) => {
        const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
        const email = (row.email || '').toLowerCase();
        const entry = { email, name };
        const identifiers = [row.id, row.email, email].filter(Boolean);
        identifiers.forEach((key) => {
          map[key] = entry;
        });
      });
      return map;
    } catch (err) {
      continue;
    }
  }
  return {};
};

const formatTimeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const setUpdatedLabel = (iso) => {
  if (!DOM.dashUpdated) return;
  if (!iso) {
    DOM.dashUpdated.textContent = 'Not loaded yet';
    return;
  }
  DOM.dashUpdated.textContent = `Updated ${formatTimeAgo(iso)} (${new Date(iso).toLocaleTimeString()})`;
};

const loadUserActivity = async () => {
  const client = getClient();
  if (!client) return;
  const profileMap = await buildProfileMap();
  try {
    const { data, error } = await client
      .from('attempts')
      .select('user_id, is_correct, created_at')
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) {
      setDashStatus('User activity unavailable (attempts table not accessible).');
      return;
    }
    state.userActivity =
      data?.map((row) => {
        const profile = profileMap[row.user_id] || {};
        const email = profile.email || row.user_id;
        const name = profile.name || '';
        return {
          userId: row.user_id,
          email,
          name,
          isCorrect: row.is_correct,
          createdAt: row.created_at,
        };
      }) || [];
    renderUserActivity();
    updateCounts();
  } catch (err) {
    setDashStatus('User activity load failed.');
  }
};

const refreshData = async () => {
  if (!state.user) return;
  setDashStatus('');
  await loadBanks();
  await loadQuestions();
  await loadUsers();
  await loadUserActivity();
  await loadAccessGrants();
  state.lastUpdated = new Date().toISOString();
  setUpdatedLabel(state.lastUpdated);
};

const clearHistory = () => {
  state.history = [];
  persistHistory();
  renderHistory();
  updateCounts();
};

const normalizeYear = (yr) => {
  if (!yr) return '';
  const m = `${yr}`.match(/(\d)/);
  if (m) return `Year ${m[1]}`;
  return yr;
};

const normalizeSubject = (subject) => (subject || '').trim();

const resetBankForm = () => {
  if (DOM.bankNameInput) DOM.bankNameInput.value = '';
  if (DOM.bankYearInput) DOM.bankYearInput.value = '';
  if (DOM.bankSubjectInput) DOM.bankSubjectInput.value = '';
  state.editingBankId = null;
};

const saveBank = async (name, year = '', subject = '', description = '', id = null) => {
  const client = getClient();
  if (!client) return;
  const payload = { name, year: normalizeYear(year), subject: normalizeSubject(subject), description };
  if (id) payload.id = id;
  const { error } = await client.from('banks').upsert(payload);
  if (error) {
    setDashStatus(`Save bank failed: ${error.message}`);
    return;
  }
  setDashStatus('Bank saved.');
  await loadBanks();
  resetBankForm();
};

const deleteBank = async (id) => {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from('banks').delete().eq('id', id);
  if (error) {
    setDashStatus(`Delete bank failed: ${error.message}`);
    return;
  }
  await loadBanks();
  await loadQuestions();
};

const deleteQuestion = async (id) => {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from('questions').delete().eq('id', id);
  if (error) {
    setDashStatus(`Delete question failed: ${error.message}`);
    return;
  }
  await loadQuestions();
};

const renderBanks = () => {
  if (DOM.bankList) {
    const search = (DOM.bankFilter?.value || '').toLowerCase();
    const filterYear = DOM.bankFilterYear?.value || 'all';
    const filterSubject = DOM.bankFilterSubject?.value || 'all';
    const sortBy = DOM.bankSort?.value || 'name';

    // Build subject options
    if (DOM.bankFilterSubject) {
      const current = DOM.bankFilterSubject.value;
      const subjects = Array.from(
        new Set(
          state.banks
            .map((b) => (b.subject || '').trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b)),
        ),
      );
      const subjectOptions = ['<option value="all">All subjects</option>']
        .concat(subjects.map((s) => `<option value="${s}">${s}</option>`))
        .join('');
      DOM.bankFilterSubject.innerHTML = subjectOptions;
      if (current && subjects.includes(current)) DOM.bankFilterSubject.value = current;
    }

    const filtered = state.banks
      .filter((b) => {
        const text = `${b.name} ${b.subject || ''}`.toLowerCase();
        const matchesSearch = !search || text.includes(search);
        const matchesYear = filterYear === 'all' || b.year === filterYear;
        const matchesSubject = filterSubject === 'all' || (b.subject || '') === filterSubject;
        return matchesSearch && matchesYear && matchesSubject;
      })
      .sort((a, b) => {
        if (sortBy === 'year') return (a.year || '').localeCompare(b.year || '') || a.name.localeCompare(b.name);
        if (sortBy === 'subject')
          return (a.subject || '').localeCompare(b.subject || '') || a.name.localeCompare(b.name);
        if (sortBy === 'count') return (b.count || 0) - (a.count || 0) || a.name.localeCompare(b.name);
        return a.name.localeCompare(b.name);
      });

    if (!filtered.length) {
      DOM.bankList.innerHTML = `
        <div class="empty-cta">
          <strong>No banks match your filters.</strong>
          <span class="muted">Start a new bank or import an exam file to create one automatically.</span>
          <div class="head-actions">
            <a class="pill clickable" href="#banks">New bank</a>
            <a class="pill clickable" href="#import">Import exam</a>
          </div>
        </div>
      `;
    } else {
      DOM.bankList.innerHTML = filtered
        .map(
          (b) => `
          <div class="list-item">
            <div class="list-meta">
              <strong>${b.name}</strong>
              <span class="muted">${b.count} questions${b.year ? ` • ${b.year}` : ''}${b.subject ? ` • ${b.subject}` : ''}</span>
            </div>
            <div class="list-actions">
              <button class="ghost small" data-bank="${b.id}" data-action="edit-bank">Edit</button>
              <button class="ghost small" data-bank="${b.id}" data-action="delete-bank">Delete</button>
            </div>
          </div>
        `,
        )
        .join('');
    }
  }
  if (DOM.bankSelect) {
    const opts = ['<option value="">Select bank…</option>']
      .concat(
        state.banks.map(
          (b) => `<option value="${b.id}">${b.name}${b.year ? ` • ${b.year}` : ''}${b.subject ? ` • ${b.subject}` : ''}</option>`,
        ),
      )
      .join('');
    DOM.bankSelect.innerHTML = opts;
  }

  if (DOM.questionFilterBank) {
    const opts = ['<option value="all">All banks</option>']
      .concat(
        state.banks.map(
          (b) => `<option value="${b.id}">${b.name}${b.year ? ` • ${b.year}` : ''}${b.subject ? ` • ${b.subject}` : ''}</option>`,
        ),
      )
      .join('');
    DOM.questionFilterBank.innerHTML = opts;
  }
};

const renderAnswers = () => {
  const editor = DOM.questionForm.answerEditor;
  if (!editor) return;
  editor.innerHTML = state.answers
    .map(
      (ans, idx) => `
      <div class="answer-row" data-idx="${idx}">
        <div class="answer-row-top">
          <span class="pill">Option ${String.fromCharCode(65 + idx)}</span>
          <label class="answer-flag"><input type="radio" name="correct" ${ans.isCorrect ? 'checked' : ''} data-action="mark-correct" data-idx="${idx}" /> Correct</label>
          <button class="ghost small" data-action="remove-answer" data-idx="${idx}">Remove</button>
        </div>
        <label class="input-group">
          <span>Answer text</span>
          <input data-action="answer-text" data-idx="${idx}" value="${ans.text || ''}" />
        </label>
        <label class="input-group">
          <span>Explanation</span>
          <textarea rows="2" data-action="answer-explanation" data-idx="${idx}">${ans.explanation || ''}</textarea>
        </label>
      </div>
    `,
    )
    .join('');
};

const addAnswer = () => {
  if (state.answers.length >= 6) {
    if (DOM.questionForm.status) DOM.questionForm.status.textContent = 'Limit: 6 answers max.';
    return;
  }
  state.answers.push({ text: '', explanation: '', isCorrect: state.answers.length === 0 });
  setAnswerCount(state.answers.length);
};

const setAnswerCount = (count) => {
  const target = Math.min(Math.max(count, 1), 6);
  const current = state.answers.length;
  if (target > current) {
    for (let i = current; i < target; i += 1) state.answers.push({ text: '', explanation: '', isCorrect: false });
  } else if (target < current) {
    state.answers = state.answers.slice(0, target);
  }
  if (!state.answers.some((a) => a.isCorrect) && state.answers[0]) state.answers[0].isCorrect = true;
  if (DOM.questionForm.answerCount) DOM.questionForm.answerCount.value = String(target);
  renderAnswers();
};

const removeAnswer = (idx) => {
  state.answers.splice(idx, 1);
  if (!state.answers.some((a) => a.isCorrect) && state.answers[0]) state.answers[0].isCorrect = true;
  renderAnswers();
};

const markCorrect = (idx) => {
  state.answers = state.answers.map((a, i) => ({ ...a, isCorrect: i === idx }));
  renderAnswers();
};

const setAnswerField = (idx, field, value) => {
  state.answers[idx][field] = value;
};

const resetQuestionForm = () => {
  if (DOM.questionForm.bank) DOM.questionForm.bank.value = '';
  if (DOM.questionForm.topic) DOM.questionForm.topic.value = '';
  if (DOM.questionForm.stem) DOM.questionForm.stem.value = '';
  if (DOM.questionForm.image) DOM.questionForm.image.value = '';
  state.answers = [{ text: '', explanation: '', isCorrect: true }];
  setAnswerCount(Number(DOM.questionForm.answerCount?.value || 4));
  state.editingQuestionId = null;
  setQuestionStatus('');
};

const validateAnswers = (answers = []) => {
  const errors = [];
  const cleaned = (answers || []).map((a) => ({
    text: (a.text || '').trim(),
    explanation: (a.explanation || '').trim(),
    isCorrect: Boolean(a.isCorrect),
  }));
  if (cleaned.length < 2) errors.push('At least 2 answers required.');
  if (!cleaned.some((a) => a.isCorrect)) errors.push('Mark one answer as correct.');
  cleaned.forEach((a, idx) => {
    if (!a.text) errors.push(`Answer ${String.fromCharCode(65 + idx)} is empty.`);
  });
  return { cleaned, errors };
};

const saveQuestion = async () => {
  const bankId = DOM.questionForm.bank?.value;
  const stem = DOM.questionForm.stem?.value?.trim();
  const topic = DOM.questionForm.topic?.value?.trim();
  const imageUrl = DOM.questionForm.image?.value?.trim();
  const { cleaned: answers, errors } = validateAnswers(state.answers);
  if (!bankId) errors.push('Bank is required.');
  if (!stem) errors.push('Stem is required.');
  if (errors.length) {
    setQuestionStatus(errors.join(' '));
    return;
  }
  const client = getClient();
  if (!client) return;
  const payload = {
    bank_id: bankId,
    topic,
    stem,
    image_url: imageUrl,
    answers,
  };
  if (state.editingQuestionId) payload.id = state.editingQuestionId;
  const { data, error } = await client.from('questions').upsert(payload).select().maybeSingle();
  if (error) {
    setQuestionStatus(`Save failed: ${error.message}`);
    return;
  }
  addHistoryEntry({
    id: data?.id || state.editingQuestionId || 'new',
    stem: stem.slice(0, 120),
    bankId,
    action: state.editingQuestionId ? 'Updated' : 'Created',
  });
  setQuestionStatus('Saved to Supabase.');
  state.editingQuestionId = null;
  resetQuestionForm();
  await loadQuestions();
};

const renderQuestions = () => {
  if (!DOM.questionList) return;
  if (!state.questions.length) {
    DOM.questionList.innerHTML =
      '<div class="empty-cta"><strong>No questions yet.</strong><span class="muted">Create one with “New question” or import an exam file.</span><div class="head-actions"><a class="pill clickable" href="#questions">New question</a><a class="pill clickable" href="#import">Import exam</a></div></div>';
    return;
  }
  const filterBank = DOM.questionFilterBank?.value || 'all';
  const search = (DOM.questionFilterText?.value || '').toLowerCase();
  const filtered = state.questions.filter((q) => {
    const matchesBank = filterBank === 'all' || q.bankId === filterBank;
    const text = `${q.topic || ''} ${q.stem || ''}`.toLowerCase();
    const matchesSearch = !search || text.includes(search);
    return matchesBank && matchesSearch;
  });
  if (!filtered.length) {
    DOM.questionList.innerHTML =
      '<div class="empty-cta"><strong>No questions match your filters.</strong><span class="muted">Try showing all banks or clearing the search text.</span><div class="head-actions"><a class="pill clickable" href="#questions" data-action="reset-question-filters">Clear filters</a></div></div>';
    return;
  }
  DOM.questionList.innerHTML = filtered
    .map(
      (q) => `
      <div class="question-card" data-id="${q.id}">
        <div class="meta-row">
          <span class="pill">${state.bankMap[q.bankId]?.name || q.bankId}</span>
          ${state.bankMap[q.bankId]?.year ? `<span class="pill tone-soft small">${state.bankMap[q.bankId].year}</span>` : ''}
          ${state.bankMap[q.bankId]?.subject ? `<span class="pill tone-soft small">${state.bankMap[q.bankId].subject}</span>` : ''}
          <span class="pill tone-soft">${q.topic || 'No topic'}</span>
        </div>
        <p class="q-text">${q.stem}</p>
        ${q.imageUrl ? `<img class="q-image" src="${q.imageUrl}" alt="Question image" />` : ''}
        <ol class="snap-options">
          ${q.answers
            .map(
              (a, i) => `<li>${String.fromCharCode(65 + i)}. ${a.text} ${a.isCorrect ? '✅' : ''}<br /><small>${a.explanation || ''}</small></li>`,
            )
            .join('')}
        </ol>
        <div class="list-actions">
          <button class="ghost small" data-action="edit-question" data-id="${q.id}">Edit</button>
          <button class="ghost small" data-action="delete-question" data-id="${q.id}">Delete</button>
        </div>
      </div>
    `,
    )
    .join('');
};

const renderUsers = () => {
  if (!DOM.userList) return;
  const query = DOM.userSearch?.value?.toLowerCase() || '';
  const filtered = state.users.filter((u) => {
    const name = (u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return !query || email.includes(query) || name.includes(query);
  });
  if (!filtered.length) {
    DOM.userList.innerHTML =
      '<div class="empty-cta"><strong>No users found.</strong><span class="muted">Try clearing search or check if stats view is available.</span></div>';
    return;
  }
  DOM.userList.innerHTML = filtered
    .map(
      (u) => `
      <div class="list-item">
        <div class="list-meta">
          <strong>${u.name || u.email}</strong>
          <span class="muted">${u.email}</span>
          <span class="muted">Accuracy ${u.accuracy}% · ${u.answered} answered · ${u.time} min</span>
        </div>
        <button class="ghost small" data-action="impersonate" data-email="${u.email}">View</button>
      </div>
    `,
    )
    .join('');
};

const renderAccessGrants = () => {
  if (!DOM.accessList) return;
  if (!state.accessGrants.length) {
    DOM.accessList.innerHTML = '<p class="muted">No access grants found.</p>';
    return;
  }
  const now = Date.now();
  DOM.accessList.innerHTML = state.accessGrants
    .map(
      (a) => `
      <div class="list-item">
        <div class="list-meta">
          <strong>${a.email}</strong>
          <span class="pill ${a.allowed ? 'tone-accent' : 'tone-soft'} small">${a.allowed ? 'Allowed' : 'Revoked'}</span>
          ${
            a.expiresAt
              ? `<span class="pill ${new Date(a.expiresAt).getTime() > now ? 'tone-info' : 'tone-soft'} small">
                  Expires ${new Date(a.expiresAt).toLocaleDateString()}
                </span>`
              : '<span class="pill tone-soft small">No expiry</span>'
          }
        </div>
        <div class="list-actions">
          <button class="ghost small" data-action="toggle-access" data-email="${a.email}">
            ${a.allowed ? 'Revoke' : 'Allow'}
          </button>
        </div>
      </div>
    `,
    )
    .join('');
};

const renderUserActivity = () => {
  if (!DOM.userActivity) return;
  if (!state.userActivity.length) {
    DOM.userActivity.innerHTML = '<p class="muted">No recent activity.</p>';
    return;
  }
  DOM.userActivity.innerHTML = state.userActivity
    .map(
      (a) => `
      <div class="list-item">
        <div class="list-meta">
          <strong>${a.email}</strong>
          <span class="muted">${a.name || 'Name unavailable'}</span>
        </div>
        <div class="list-meta">
          <span class="${a.isCorrect ? 'pill tone-accent small' : 'pill tone-soft small'}">${a.isCorrect ? 'Correct' : 'Incorrect'}</span>
          <span class="muted">${formatTimeAgo(a.createdAt)}</span>
        </div>
      </div>
    `,
    )
    .join('');
};

const renderHistory = () => {
  if (!DOM.historyList) return;
  if (!state.history.length) {
    DOM.historyList.innerHTML = '<p class="muted">No recent edits yet.</p>';
    return;
  }
  DOM.historyList.innerHTML = state.history
    .map(
      (h) => `
      <div class="list-item">
        <div class="list-meta">
          <strong>${h.action}</strong>
          <span class="muted">${h.bankId || 'No bank'} · ${formatTimeAgo(h.at)}</span>
        </div>
        <div class="list-meta">
          <span class="muted">${h.stem || 'No stem'}</span>
          ${h.by ? `<span class="pill tone-soft small">${h.by}</span>` : ''}
        </div>
      </div>
    `,
    )
    .join('');
};

const setAuthUI = (message = '') => {
  let text = message;
  if (!text && state.user?.email) text = `Signed in as ${state.user.email}`;
  if (DOM.authStatus && text !== undefined) DOM.authStatus.textContent = text;
  const signedIn = Boolean(state.user);
  DOM.hero?.classList.toggle('hidden', signedIn);
  DOM.dashboard?.classList.toggle('hidden', !signedIn);
  if (signedIn) {
    if (DOM.dashGreeting) DOM.dashGreeting.textContent = `Welcome, ${state.user.email}`;
    if (DOM.dashSession) DOM.dashSession.textContent = 'Signed in';
  }
};

const normalizeAnswers = (answers = []) => {
  const arr = Array.isArray(answers) ? answers.slice(0, 6) : [];
  const normalized = arr.map((a) => ({
    text: a?.text || '',
    explanation: a?.explanation || '',
    isCorrect: Boolean(a?.isCorrect),
  }));
  if (!normalized.length) normalized.push({ text: '', explanation: '', isCorrect: true });
  if (!normalized.some((a) => a.isCorrect)) normalized[0].isCorrect = true;
  return normalized;
};

const parseJSONWithCleanup = (text) => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned);
};

const parseExamJSON = (raw) => {
  if (!raw?.bank?.name) throw new Error('Missing bank.name');
  if (!Array.isArray(raw.questions) || !raw.questions.length) throw new Error('No questions found');
  const questions = raw.questions.map((q, idx) => {
    if (!q.stem) throw new Error(`Question ${idx + 1} missing stem`);
    return {
      topic: q.topic || null,
      stem: q.stem,
      image_url: q.imageUrl || q.image_url || null,
      answers: normalizeAnswers(q.answers),
    };
  });
  return {
    bank: {
      name: raw.bank.name,
      description: raw.bank.description || '',
      year: normalizeYear(raw.bank.year),
      subject: normalizeSubject(raw.bank.subject),
    },
    questions,
  };
};

const applyImportDefaults = (exam, defaultYear = '', defaultSubject = '') => {
  return {
    ...exam,
    bank: {
      ...exam.bank,
      year: normalizeYear(defaultYear || exam.bank.year || ''),
      subject: normalizeSubject(defaultSubject || exam.bank.subject || ''),
    },
  };
};

const validateExam = (exam) => {
  const errors = [];
  if (!exam?.bank?.name) errors.push('Bank name missing.');
  (exam.questions || []).forEach((q, idx) => {
    const stem = (q.stem || '').trim();
    if (!stem) errors.push(`Q${idx + 1}: stem is required.`);
    const { errors: answerErrors } = validateAnswers(q.answers || []);
    answerErrors.forEach((e) => errors.push(`Q${idx + 1}: ${e}`));
  });
  return errors;
};

const importExam = async (exam) => {
  const client = getClient();
  if (!client) return;
  // Use existing bank by name if present, otherwise create one.
  const existing = state.banks.find((b) => b.name.toLowerCase() === exam.bank.name.toLowerCase());
  let bankId = existing?.id;
  if (!bankId) {
    const { data: bankRows, error: bankErr } = await client
      .from('banks')
      .insert({
        name: exam.bank.name,
        description: exam.bank.description || '',
        year: normalizeYear(exam.bank.year),
        subject: normalizeSubject(exam.bank.subject),
      })
      .select()
      .maybeSingle();
    if (bankErr || !bankRows) throw new Error(bankErr?.message || 'Bank insert failed');
    bankId = bankRows.id;
  } else if (exam.bank.year || exam.bank.subject || exam.bank.description) {
    await client
      .from('banks')
      .update({
        year: normalizeYear(exam.bank.year) || existing.year || null,
        subject: normalizeSubject(exam.bank.subject) || existing.subject || null,
        description: exam.bank.description || existing.description || null,
      })
      .eq('id', bankId);
  }
  const payload = exam.questions.map((q) => ({ ...q, bank_id: bankId }));
  const { error: qErr } = await client.from('questions').insert(payload);
  if (qErr) throw new Error(qErr.message);
  setImportStatus('Imported exam into Supabase.');
  await refreshData();
};

const handleImportClick = async () => {
  const files = Array.from(DOM.importFile?.files || []);
  if (!files.length) {
    setImportStatus('Choose one or more JSON files first.');
    return;
  }
  const defaultYear = normalizeYear(DOM.importYear?.value || '');
  const defaultSubject = normalizeSubject(DOM.importSubject?.value || '');
  setImportStatus(`Reading ${files.length} file(s)...`);
  let imported = 0;
  let lastMessage = '';
  for (const file of files) {
    try {
      const text = await file.text();
      const parsed = parseExamJSON(parseJSONWithCleanup(text));
      const exam = applyImportDefaults(parsed, defaultYear, defaultSubject);
      const validationErrors = validateExam(exam);
      if (validationErrors.length) {
        lastMessage = `Import blocked for ${file.name}: ${validationErrors.slice(0, 4).join(' ')}`;
        continue;
      }
      setImportStatus(`Importing ${file.name}...`);
      await importExam(exam);
      imported += 1;
      lastMessage = `Imported ${exam.questions.length} questions into ${exam.bank.name}.`;
      addHistoryEntry({
        id: exam.bank.name,
        stem: `Imported ${exam.questions.length} questions`,
        bankId: exam.bank.name,
        action: 'Imported',
      });
    } catch (err) {
      lastMessage = `Import failed for ${file.name}: ${err.message}`;
    }
  }
  setImportStatus(`${lastMessage} (${imported}/${files.length} files processed)`);
};

const signIn = async () => {
  if (!supabaseAvailable()) {
    setAuthUI('Supabase keys missing.');
    return;
  }
  const email = DOM.email.value;
  const password = DOM.password.value;
  if (!email || !password) return;
  const client = supabaseClient();
  if (!client) return;
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) setAuthUI(error.message);
  else {
    state.user = data.user || data.session?.user || null;
    setAuthUI('');
    await refreshData();
  }
};

const signOut = async () => {
  if (!supabaseAvailable()) return;
  await supabaseClient().auth.signOut();
  state.user = null;
  setAuthUI('Signed out.');
  setDashStatus('');
  setUpdatedLabel(null);
};

const initAuth = async () => {
  if (!supabaseAvailable()) return;
  const client = supabaseClient();
  const { data } = await client.auth.getSession();
  if (data?.session?.user) state.user = data.session.user;
  client.auth.onAuthStateChange((_e, session) => {
    state.user = session?.user ?? null;
    setAuthUI('');
    refreshData();
  });
  setAuthUI('');
  await refreshData();
};

const handleListClick = async (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  event.preventDefault();
  if (action === 'remove-answer') removeAnswer(Number(event.target.dataset.idx));
  if (action === 'mark-correct') markCorrect(Number(event.target.dataset.idx));
  if (action === 'delete-bank') {
    const id = event.target.dataset.bank;
    await deleteBank(id);
  }
  if (action === 'edit-bank') {
    const id = event.target.dataset.bank;
    const bank = state.banks.find((b) => b.id === id);
    handleBankEdit(bank);
    setDashStatus('Editing bank — update name/year then Save.');
  }
  if (action === 'delete-question') {
    const id = event.target.dataset.id;
    await deleteQuestion(id);
  }
  if (action === 'edit-question') {
    const id = event.target.dataset.id;
    const q = state.questions.find((x) => x.id === id);
    if (!q) return;
    state.editingQuestionId = id;
    if (DOM.questionForm.bank) DOM.questionForm.bank.value = q.bankId;
    if (DOM.questionForm.topic) DOM.questionForm.topic.value = q.topic || '';
    if (DOM.questionForm.stem) DOM.questionForm.stem.value = q.stem || '';
    if (DOM.questionForm.image) DOM.questionForm.image.value = q.imageUrl || '';
    state.answers = q.answers.map((a) => ({ ...a }));
    setAnswerCount(state.answers.length || 1);
    setQuestionStatus(`Editing question in ${q.bankId}`);
  }
  if (action === 'toggle-access') {
    const email = (event.target.dataset.email || '').toLowerCase();
    const current = state.accessGrants.find((a) => a.email === email);
    await setAccess(email, !(current?.allowed));
  }
  if (action === 'reset-question-filters') {
    if (DOM.questionFilterBank) DOM.questionFilterBank.value = 'all';
    if (DOM.questionFilterText) DOM.questionFilterText.value = '';
    renderQuestions();
  }
};

const handleAnswerInput = (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  const idx = Number(event.target.dataset.idx);
  if (action === 'answer-text') setAnswerField(idx, 'text', event.target.value);
  if (action === 'answer-explanation') setAnswerField(idx, 'explanation', event.target.value);
};

const setAccess = async (email, allowed, expiresAt = null) => {
  if (!email) return;
  const client = getClient();
  if (!client) return;
  try {
    const payload = { email, allowed };
    if (expiresAt) payload.expires_at = expiresAt;
    const { error } = await client.from('access_grants').upsert(payload);
    if (error) {
      setDashStatus(`Access update failed: ${error.message}`);
      return;
    }
    setDashStatus(`Access ${allowed ? 'granted' : 'revoked'} for ${email}.`);
    await loadAccessGrants();
  } catch (err) {
    setDashStatus('Access update failed.');
  }
};

const handleBankEdit = (bank) => {
  if (!bank) return;
  state.editingBankId = bank.id;
  if (DOM.bankNameInput) DOM.bankNameInput.value = bank.name || '';
  if (DOM.bankYearInput) DOM.bankYearInput.value = bank.year || '';
  if (DOM.bankSubjectInput) DOM.bankSubjectInput.value = bank.subject || '';
};

const handleSaveBankClick = async () => {
  const name = DOM.bankNameInput?.value?.trim();
  const year = DOM.bankYearInput?.value || '';
  const subject = DOM.bankSubjectInput?.value || '';
  if (!name) {
    setDashStatus('Bank name is required.');
    return;
  }
  await saveBank(name, year, subject, '', state.editingBankId);
};

const handleNewBank = () => {
  resetBankForm();
  setDashStatus('New bank: fill name and year, then Save.');
  DOM.bankNameInput?.focus();
};

const handleAddAccess = async () => {
  const email = DOM.accessEmail?.value?.trim().toLowerCase();
  const durationDays = Number(DOM.accessDuration?.value || 0);
  if (!email) {
    setDashStatus('Enter an email to grant access.');
    return;
  }
  const expiresAt =
    durationDays > 0 ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString() : null;
  await setAccess(email, true, expiresAt);
  if (DOM.accessEmail) DOM.accessEmail.value = '';
};

const handleCollapseClick = (event) => {
  const toggle = event.target.closest('[data-collapse-target]');
  if (!toggle) return;
  const key = toggle.dataset.collapseTarget;
  state.collapsedPanels[key] = !state.collapsedPanels[key];
  persistCollapsedPanels(state.collapsedPanels);
  applyCollapsedPanels();
};

const init = async () => {
  // Render base UI
  renderBanks();
  resetBankForm();
  resetQuestionForm();
  renderUsers();
  renderQuestions();
  state.history = loadHistory();
  renderHistory();
  setDensity(loadDensityPreference());
  state.collapsedPanels = loadCollapsedPanels();
  applyCollapsedPanels();
  setUpdatedLabel(state.lastUpdated);
  updateCounts();

  // Auth actions
  DOM.btnSignin?.addEventListener('click', signIn);
  DOM.btnSignout?.addEventListener('click', signOut);
  await initAuth();

  // Answer editor
  DOM.questionForm.answerEditor?.addEventListener('click', handleListClick);
  DOM.questionForm.answerEditor?.addEventListener('input', handleAnswerInput);
  DOM.questionForm.answerCount?.addEventListener('change', (e) => setAnswerCount(Number(e.target.value)));
  DOM.btnImport?.addEventListener('click', handleImportClick);
  document.getElementById('btn-add-answer')?.addEventListener('click', addAnswer);
  DOM.btnRefreshActivity?.addEventListener('click', loadUserActivity);
  DOM.btnClearHistory?.addEventListener('click', clearHistory);
  DOM.btnAddAccess?.addEventListener('click', handleAddAccess);
  DOM.bankFilter?.addEventListener('input', renderBanks);
  DOM.bankFilterYear?.addEventListener('change', renderBanks);
  DOM.bankFilterSubject?.addEventListener('change', renderBanks);
  DOM.bankSort?.addEventListener('change', renderBanks);
  DOM.questionFilterBank?.addEventListener('change', renderQuestions);
  DOM.questionFilterText?.addEventListener('input', renderQuestions);
  DOM.dashboard?.addEventListener('click', handleCollapseClick);
  DOM.btnToggleDensity?.addEventListener('click', () =>
    setDensity(state.density === 'compact' ? 'comfortable' : 'compact'),
  );

  // Question actions
  DOM.questionForm.btnSave?.addEventListener('click', saveQuestion);
  DOM.questionForm.btnReset?.addEventListener('click', resetQuestionForm);
  document.getElementById('btn-new-question')?.addEventListener('click', resetQuestionForm);

  // Bank actions
  DOM.bankList?.addEventListener('click', handleListClick);
  DOM.btnNewBank?.addEventListener('click', handleNewBank);
  DOM.btnSaveBank?.addEventListener('click', handleSaveBankClick);
  DOM.btnResetBank?.addEventListener('click', resetBankForm);

  // User search
  DOM.userSearch?.addEventListener('input', renderUsers);

  // Question list actions
  DOM.questionList?.addEventListener('click', handleListClick);
};

document.addEventListener('DOMContentLoaded', init);
