import { supabaseAvailable, supabaseClient } from './supabase.js';

const DOM = {
  email: document.getElementById('email'),
  password: document.getElementById('password'),
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
  statAccuracy: document.getElementById('stat-accuracy'),
  statAnswered: document.getElementById('stat-answered'),
  statTime: document.getElementById('stat-time'),
  progressAccuracy: document.getElementById('progress-accuracy'),
  progressAnswered: document.getElementById('progress-answered'),
  progressTime: document.getElementById('progress-time'),
};

const state = {
  user: null,
  stats: {
    accuracy: 0,
    answered: 0,
    time: 0,
  },
  banksLoading: false,
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

const setDashStatus = (message = '') => {
  if (DOM.dashStatus) DOM.dashStatus.textContent = message;
};

const loadBanks = async () => {
  state.banksLoading = true;
  setDashStatus('Loading banks…');
  if (!supabaseAvailable()) {
    stateBanks.banks = sampleBanks;
    renderBanks();
    state.banksLoading = false;
    setDashStatus('');
    return;
  }
  const client = supabaseClient();
  if (!client) {
    stateBanks.banks = sampleBanks;
    renderBanks();
    state.banksLoading = false;
    setDashStatus('');
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
};

const auth = async (mode) => {
  if (!supabaseAvailable()) {
    setAuthUI('Supabase keys missing.');
    return;
  }
  const email = DOM.email.value;
  const password = DOM.password.value;
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
};

const checkSession = async () => {
  if (!supabaseAvailable()) return;
  const client = supabaseClient();
  const { data } = await client.auth.getSession();
  if (data?.session?.user) {
    state.user = data.session.user;
    setAuthUI('');
  }
  client.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user ?? null;
    setAuthUI('');
  });
};

const setProgress = (el, value) => {
  if (el) el.style.width = `${Math.min(Math.max(value, 0), 100)}%`;
};

const refreshStats = () => {
  if (DOM.statAccuracy) DOM.statAccuracy.textContent = state.stats.accuracy ? `${state.stats.accuracy}%` : '—';
  if (DOM.statAnswered) DOM.statAnswered.textContent = state.stats.answered ? state.stats.answered : '—';
  if (DOM.statTime) DOM.statTime.textContent = state.stats.time ? `${state.stats.time} min` : '—';
  setProgress(DOM.progressAccuracy, state.stats.accuracy || 0);
  setProgress(DOM.progressAnswered, Math.min((state.stats.answered / 200) * 100, 100));
  setProgress(DOM.progressTime, Math.min((state.stats.time / 300) * 100, 100));
};

const handleStartPractice = () => {
  const id = DOM.bankSelect?.value;
  if (!id) {
    if (DOM.bankHint) DOM.bankHint.textContent = 'Pick a bank to continue.';
    return;
  }
  if (state.banksLoading) {
    if (DOM.bankHint) DOM.bankHint.textContent = 'Still loading banks… try again in a moment.';
    return;
  }
  const bank = stateBanks.banks.find((b) => b.id === id) || sampleBanks.find((b) => b.id === id);
  if (DOM.bankHint) DOM.bankHint.textContent = `Launching ${bank?.name || 'bank'}…`;
  if (DOM.dashStatus) DOM.dashStatus.textContent = `Practice session ready for ${bank?.name || 'selected bank'}.`;
  // Hook: load the chosen bank's questions here.
};

const init = async () => {
  renderBanks(); // show sample immediately
  loadBanks(); // async fetch real banks
  refreshStats();
  DOM.btnSignin?.addEventListener('click', () => auth('signin'));
  DOM.btnSignup?.addEventListener('click', () => auth('signup'));
  DOM.btnSignout?.addEventListener('click', signOut);
  DOM.btnStart?.addEventListener('click', handleStartPractice);
  await checkSession();
  setAuthUI('');
};

document.addEventListener('DOMContentLoaded', init);
