import { supabaseAvailable, supabaseClient } from './supabase.js';

const statusTitle = document.getElementById('status-text');
const statusDetail = document.getElementById('status-detail');

const setStatus = (title, detail = '') => {
  if (statusTitle) statusTitle.textContent = title;
  if (statusDetail) statusDetail.textContent = detail;
};

const basePath = (() => {
  const path = window.location.pathname || '/';
  const lastSlash = path.lastIndexOf('/');
  return lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '/';
})();

const redirectHome = () => {
  const home = `${window.location.origin}${basePath || '/'}`;
  setTimeout(() => window.location.replace(home || '/'), 800);
};

const handleCodeFlow = async (client, code) => {
  setStatus('Confirming your email…', 'Finishing your signup.');
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw new Error(error.message || 'Unable to confirm email.');
  setStatus('Email verified', 'Redirecting you to the app…');
  redirectHome();
};

const handleTokenHashFlow = async (client, tokenHash, type) => {
  setStatus('Confirming your email…', 'Finishing your signup.');
  const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type || 'signup' });
  if (error) throw new Error(error.message || 'Unable to confirm email.');
  setStatus('Email verified', 'Redirecting you to the app…');
  redirectHome();
};

const handleLegacyHashFlow = async (client, hashParams) => {
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  if (!accessToken || !refreshToken) return false;
  setStatus('Restoring your session…', 'Just a moment.');
  const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) throw new Error(error.message || 'Unable to restore session.');
  setStatus('Signed in', 'Redirecting you to the app…');
  redirectHome();
  return true;
};

const run = async () => {
  setStatus('Finishing up…', 'Checking your verification link.');

  if (!supabaseAvailable()) {
    setStatus('Supabase config missing', 'Update config.js with your URL and anon key.');
    return;
  }

  const client = supabaseClient();
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');
  if (errorDescription) {
    setStatus('Verification failed', errorDescription);
    return;
  }

  try {
    const code = searchParams.get('code');
    if (code) {
      await handleCodeFlow(client, code);
      return;
    }

    const handledLegacy = await handleLegacyHashFlow(client, hashParams);
    if (handledLegacy) return;

    const tokenHash = searchParams.get('token_hash');
    if (tokenHash) {
      const type = searchParams.get('type') || 'signup';
      await handleTokenHashFlow(client, tokenHash, type);
      return;
    }

    setStatus('No verification code found', 'Return to the app and try signing in again.');
  } catch (err) {
    console.error('Auth callback error', err);
    setStatus('Verification failed', err.message || 'Something went wrong. Please try again.');
  }
};

run();
