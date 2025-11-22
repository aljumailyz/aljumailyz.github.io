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
  bankList: document.getElementById('bank-list'),
  bankSelect: document.getElementById('question-bank'),
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
  dashStatus: document.getElementById('dash-status'),
  importFile: document.getElementById('import-file'),
  btnImport: document.getElementById('btn-import'),
  importStatus: document.getElementById('import-status'),
};

const state = {
  user: null,
  banks: [],
  questions: [],
  answers: [],
  editingQuestionId: null,
  users: [],
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

const getClient = () => {
  if (!supabaseAvailable()) {
    setDashStatus('Supabase keys missing.');
    return null;
  }
  return supabaseClient();
};

const updateBankCounts = () => {
  if (!state.banks.length) return;
  const counts = state.questions.reduce((acc, q) => {
    acc[q.bankId] = (acc[q.bankId] || 0) + 1;
    return acc;
  }, {});
  state.banks = state.banks.map((b) => ({ ...b, count: counts[b.id] || 0 }));
};

const loadBanks = async () => {
  const client = getClient();
  if (!client) return;
  const { data, error } = await client.from('banks').select('*').order('created_at', { ascending: false });
  if (error) {
    setDashStatus(`Banks error: ${error.message}`);
    return;
  }
  state.banks = data || [];
  updateBankCounts();
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
};

const loadUsers = async () => {
  const client = getClient();
  if (!client) return;
  const { data, error } = await client.from('user_stats').select('user_id, accuracy, answered, time');
  if (error) {
    setDashStatus('User stats view missing or restricted. Create `user_stats` view.');
    return;
  }
  state.users =
    data?.map((u) => ({
      email: u.user_id,
      accuracy: Math.round(u.accuracy || 0),
      answered: u.answered || 0,
      time: u.time || 0,
    })) || [];
  renderUsers();
};

const refreshData = async () => {
  if (!state.user) return;
  setDashStatus('');
  await loadBanks();
  await loadQuestions();
  await loadUsers();
};

const normalizeYear = (yr) => {
  if (!yr) return '';
  const m = `${yr}`.match(/(\d)/);
  if (m) return `Year ${m[1]}`;
  return yr;
};

const saveBank = async (name, year = '', description = '') => {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from('banks').insert({ name, year: normalizeYear(year), description });
  if (error) {
    setDashStatus(`Save bank failed: ${error.message}`);
    return;
  }
  setDashStatus('Bank saved.');
  await loadBanks();
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
    DOM.bankList.innerHTML = state.banks
      .map(
        (b) => `
        <div class="list-item">
          <div class="list-meta">
            <strong>${b.name}</strong>
            <span class="muted">${b.count} questions ${b.year ? `• ${b.year}` : ''}</span>
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
  if (DOM.bankSelect) {
    const opts = ['<option value="">Select bank…</option>']
      .concat(state.banks.map((b) => `<option value="${b.id}">${b.name}${b.year ? ` • ${b.year}` : ''}</option>`))
      .join('');
    DOM.bankSelect.innerHTML = opts;
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

const saveQuestion = async () => {
  if (!DOM.questionForm.bank?.value || !DOM.questionForm.stem?.value) {
    setQuestionStatus('Bank and stem are required.');
    return;
  }
  const client = getClient();
  if (!client) return;
  const payload = {
    bank_id: DOM.questionForm.bank.value,
    topic: DOM.questionForm.topic.value,
    stem: DOM.questionForm.stem.value,
    image_url: DOM.questionForm.image.value,
    answers: state.answers,
  };
  if (state.editingQuestionId) payload.id = state.editingQuestionId;
  const { error } = await client.from('questions').upsert(payload);
  if (error) {
    setQuestionStatus(`Save failed: ${error.message}`);
    return;
  }
  setQuestionStatus('Saved to Supabase.');
  state.editingQuestionId = null;
  resetQuestionForm();
  await loadQuestions();
};

const renderQuestions = () => {
  if (!DOM.questionList) return;
  if (!state.questions.length) {
    DOM.questionList.innerHTML = '<p class="hint">No questions yet.</p>';
    return;
  }
  DOM.questionList.innerHTML = state.questions
    .map(
      (q) => `
      <div class="question-card" data-id="${q.id}">
        <div class="meta-row">
          <span class="pill">${q.bankId}</span>
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
  const filtered = state.users.filter((u) => u.email.toLowerCase().includes(query));
  DOM.userList.innerHTML = filtered
    .map(
      (u) => `
      <div class="list-item">
        <div class="list-meta">
          <strong>${u.email}</strong>
          <span class="muted">Accuracy ${u.accuracy}% · ${u.answered} answered · ${u.time} min</span>
        </div>
        <button class="ghost small" data-action="impersonate" data-email="${u.email}">View</button>
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
  return { bank: { name: raw.bank.name, description: raw.bank.description || '' }, questions };
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
      .insert({ name: exam.bank.name, description: exam.bank.description || '' })
      .select()
      .maybeSingle();
    if (bankErr || !bankRows) throw new Error(bankErr?.message || 'Bank insert failed');
    bankId = bankRows.id;
  }
  const payload = exam.questions.map((q) => ({ ...q, bank_id: bankId }));
  const { error: qErr } = await client.from('questions').insert(payload);
  if (qErr) throw new Error(qErr.message);
  setImportStatus('Imported exam into Supabase.');
  await refreshData();
};

const handleImportClick = async () => {
  const file = DOM.importFile?.files?.[0];
  if (!file) {
    setImportStatus('Choose a JSON file first.');
    return;
  }
  setImportStatus('Reading file...');
  try {
    const text = await file.text();
    const parsed = parseExamJSON(parseJSONWithCleanup(text));
    setImportStatus('Importing to Supabase...');
    await importExam(parsed);
  } catch (err) {
    setImportStatus(`Import failed: ${err.message}`);
  }
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
  if (action === 'remove-answer') removeAnswer(Number(event.target.dataset.idx));
  if (action === 'mark-correct') markCorrect(Number(event.target.dataset.idx));
  if (action === 'delete-bank') {
    const id = event.target.dataset.bank;
    await deleteBank(id);
  }
  if (action === 'edit-bank') {
    const id = event.target.dataset.bank;
    const bank = state.banks.find((b) => b.id === id);
    if (DOM.questionForm.bank) DOM.questionForm.bank.value = bank?.id || '';
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
    if (DOM.questionForm.topic) DOM.questionForm.topic.value = q.topic;
    if (DOM.questionForm.stem) DOM.questionForm.stem.value = q.stem;
    if (DOM.questionForm.image) DOM.questionForm.image.value = q.imageUrl || '';
    state.answers = q.answers.map((a) => ({ ...a }));
    setAnswerCount(state.answers.length || 1);
  }
};

const handleAnswerInput = (event) => {
  const action = event.target.dataset.action;
  if (!action) return;
  const idx = Number(event.target.dataset.idx);
  if (action === 'answer-text') setAnswerField(idx, 'text', event.target.value);
  if (action === 'answer-explanation') setAnswerField(idx, 'explanation', event.target.value);
};

const handleNewBank = async () => {
  const name = prompt('Bank name');
  if (!name) return;
  const year = prompt('Year (e.g., Year 1 - Year 6)');
  await saveBank(name, year || '');
};

const init = async () => {
  // Render base UI
  renderBanks();
  resetQuestionForm();
  renderUsers();
  renderQuestions();

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

  // Question actions
  DOM.questionForm.btnSave?.addEventListener('click', saveQuestion);
  DOM.questionForm.btnReset?.addEventListener('click', resetQuestionForm);
  document.getElementById('btn-new-question')?.addEventListener('click', resetQuestionForm);

  // Bank actions
  DOM.bankList?.addEventListener('click', handleListClick);
  DOM.btnNewBank?.addEventListener('click', handleNewBank);

  // User search
  DOM.userSearch?.addEventListener('input', renderUsers);

  // Question list actions
  DOM.questionList?.addEventListener('click', handleListClick);
};

document.addEventListener('DOMContentLoaded', init);
