import { supabaseAvailable, supabaseClient } from './supabase.js';

const DOM = {
  first: document.getElementById('profile-first'),
  last: document.getElementById('profile-last'),
  year: document.getElementById('profile-year'),
  password: document.getElementById('profile-password'),
  btnSave: document.getElementById('btn-save-profile'),
  btnChangePassword: document.getElementById('btn-change-password'),
  btnSignout: document.getElementById('btn-signout'),
  status: document.getElementById('profile-status'),
};

const state = { user: null };

const setStatus = (msg = '') => {
  if (DOM.status) DOM.status.textContent = msg;
};

const hydrate = () => {
  const meta = state.user?.user_metadata || {};
  if (DOM.first) DOM.first.value = meta.first_name || '';
  if (DOM.last) DOM.last.value = meta.last_name || '';
  if (DOM.year) DOM.year.value = meta.year || '';
  if (DOM.password) DOM.password.value = '';
};

const loadSession = async () => {
  if (!supabaseAvailable()) {
    setStatus('Supabase keys missing.');
    return;
  }
  const client = supabaseClient();
  const { data } = await client.auth.getSession();
  if (!data?.session?.user) {
    setStatus('Please sign in from the main page first.');
    return;
  }
  state.user = data.session.user;
  hydrate();
};

const saveProfile = async () => {
  if (!supabaseAvailable() || !state.user) return;
  const client = supabaseClient();
  const first = DOM.first?.value?.trim();
  const last = DOM.last?.value?.trim();
  const year = DOM.year?.value || '';
  const { error } = await client.auth.updateUser({ data: { first_name: first, last_name: last, year } });
  if (error) setStatus(error.message);
  else {
    setStatus('Profile updated.');
    const { data } = await client.auth.getSession();
    if (data?.session?.user) state.user = data.session.user;
  }
};

const changePassword = async () => {
  if (!supabaseAvailable() || !state.user) return;
  const newPass = DOM.password?.value;
  if (!newPass) {
    setStatus('Enter a new password.');
    return;
  }
  const client = supabaseClient();
  const { error } = await client.auth.updateUser({ password: newPass });
  if (error) setStatus(error.message);
  else setStatus('Password updated.');
};

const signOut = async () => {
  if (!supabaseAvailable()) return;
  await supabaseClient().auth.signOut();
  window.location.href = 'index.html';
};

const init = async () => {
  await loadSession();
  DOM.btnSave?.addEventListener('click', saveProfile);
  DOM.btnChangePassword?.addEventListener('click', changePassword);
  DOM.btnSignout?.addEventListener('click', signOut);
};

document.addEventListener('DOMContentLoaded', init);
