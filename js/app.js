import { supabaseAvailable, supabaseClient } from './supabase.js';

const DOM = {
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  btnSignin: document.getElementById('btn-signin'),
  btnSignup: document.getElementById('btn-signup'),
  btnSignout: document.getElementById('btn-signout'),
  authStatus: document.getElementById('auth-status'),
};

const state = {
  user: null,
};

// Ensure Supabase email links return to the current domain (e.g., GitHub Pages).
const emailRedirectTo = `${window.location.origin}${window.location.pathname}`;

const setAuthUI = (message = '') => {
  if (DOM.authStatus && message) DOM.authStatus.textContent = message;
  if (DOM.btnSignout) DOM.btnSignout.style.display = state.user ? 'block' : 'none';
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
  const action = mode === 'signup' ? client.auth.signUp : client.auth.signInWithPassword;
  const payload =
    mode === 'signup'
      ? { email, password, options: { emailRedirectTo } }
      : { email, password };
  try {
    const { data, error } = await action(payload);
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

const init = async () => {
  DOM.btnSignin?.addEventListener('click', () => auth('signin'));
  DOM.btnSignup?.addEventListener('click', () => auth('signup'));
  DOM.btnSignout?.addEventListener('click', signOut);
  await checkSession();
  setAuthUI('');
};

document.addEventListener('DOMContentLoaded', init);
