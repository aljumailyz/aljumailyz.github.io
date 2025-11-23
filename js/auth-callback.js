import { supabaseAvailable, supabaseClient } from './supabase.js';

const statusTitle = document.getElementById('status-text');
const statusDetail = document.getElementById('status-detail');

const setStatus = (title, detail = '') => {
  if (statusTitle) statusTitle.textContent = title;
  if (statusDetail) statusDetail.textContent = detail;
};

const fail = (detail) => {
  setStatus('Verification failed', detail || 'Link invalid or expired. Go back and request a new email.');
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
  const types = [type || 'signup', 'email', 'magiclink'].filter(Boolean);
  let lastErr;
  for (const t of types) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: t });
    if (!error) {
      setStatus('Email verified', 'Redirecting you to the app…');
      redirectHome();
      return;
    }
    lastErr = error;
  }
  throw new Error(lastErr?.message || 'Unable to confirm email.');
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
    fail('Supabase config missing. Update config.js with your URL and anon key.');
    return;
  }

  const client = supabaseClient();
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

  const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');
  if (errorDescription) {
    fail(`${errorDescription}. Return to the app and request a new verification email.`);
    return;
  }

  try {
    const code = searchParams.get('code') || hashParams.get('code');
    if (code) {
      await handleCodeFlow(client, code);
      return;
    }

    const handledLegacy = await handleLegacyHashFlow(client, hashParams);
    if (handledLegacy) return;

    const tokenHash = searchParams.get('token_hash');
    if (tokenHash) {
      const type = searchParams.get('type') || hashParams.get('type') || 'signup';
      await handleTokenHashFlow(client, tokenHash, type);
      return;
    }

    fail('No verification code found. Return to the app and request a new verification email.');
  } catch (err) {
    console.error('Auth callback error', err);
    fail(err.message || 'Link invalid or expired. Return to the app and request a new verification email.');
  }
};

run();
