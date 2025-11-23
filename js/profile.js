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
  nameDisplay: document.getElementById('profile-name'),
  emailDisplay: document.getElementById('profile-email'),
  yearBadge: document.getElementById('profile-year-badge'),
  toastStack: document.getElementById('toast-stack'),
  yearPills: document.getElementById('year-pills'),
  accuracy: document.getElementById('profile-accuracy'),
  attemptCount: document.getElementById('profile-attempt-count'),
  sparkline: document.getElementById('profile-sparkline'),
  sparklineArea: document.querySelector('#profile-sparkline .sparkline-area'),
  sparklineLine: document.querySelector('#profile-sparkline .sparkline-line'),
  btnRefreshAttempts: document.getElementById('btn-refresh-attempts'),
  btnExportAttempts: document.getElementById('btn-export-attempts'),
  attemptHint: document.getElementById('profile-attempt-hint'),
};

const state = { user: null, attempts: [] };

const setStatus = (msg = '') => {
  if (DOM.status) DOM.status.textContent = msg;
};

const showToast = (message, type = 'success') => {
  if (!DOM.toastStack) return;
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = message;
  DOM.toastStack.appendChild(div);
  setTimeout(() => div.remove(), 3000);
};

const initPasswordToggles = () => {
  document.querySelectorAll('[data-toggle-pass]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.togglePass;
      const input = document.getElementById(targetId);
      if (!input) return;
      const nextType = input.type === 'password' ? 'text' : 'password';
      input.type = nextType;
      btn.textContent = nextType === 'password' ? 'Show' : 'Hide';
    });
  });
};

const renderSparkline = (values = []) => {
  if (!DOM.sparklineArea || !DOM.sparklineLine) return;
  if (!values.length) {
    DOM.sparklineArea.setAttribute('d', '');
    DOM.sparklineLine.setAttribute('d', '');
    return;
  }
  const width = 120;
  const height = 60;
  const points = values.map((v, idx) => {
    const x = values.length === 1 ? width : (idx / (values.length - 1)) * width;
    const y = height - (v / 100) * height;
    return { x, y };
  });
  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const areaPath = `M${points[0].x.toFixed(2)},${height} ${points
    .map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ')} L${points[points.length - 1].x.toFixed(2)},${height} Z`;
  DOM.sparklineLine.setAttribute('d', linePath);
  DOM.sparklineArea.setAttribute('d', areaPath);
};

const renderAttempts = () => {
  const attempts = state.attempts || [];
  if (!DOM.accuracy || !DOM.attemptCount) return;
  if (!attempts.length) {
    DOM.accuracy.textContent = '—';
    DOM.attemptCount.textContent = '0 attempts';
    renderSparkline([]);
    if (DOM.attemptHint) DOM.attemptHint.textContent = 'No attempts yet.';
    return;
  }
  const correct = attempts.filter((a) => a.is_correct).length;
  const pct = Math.round((correct / attempts.length) * 100);
  DOM.accuracy.textContent = `${pct}%`;
  DOM.attemptCount.textContent = `${attempts.length} attempts`;
  if (DOM.attemptHint) DOM.attemptHint.textContent = 'Recent attempts pulled from Supabase.';
  let runningCorrect = 0;
  const trend = attempts
    .slice()
    .reverse()
    .map((a, idx) => {
      runningCorrect += a.is_correct ? 1 : 0;
      return Math.round((runningCorrect / (idx + 1)) * 100);
    });
  renderSparkline(trend);
};

const loadAttempts = async () => {
  if (!supabaseAvailable() || !state.user) return;
  const client = supabaseClient();
  try {
    const { data, error } = await client
      .from('attempts')
      .select('is_correct, created_at, seconds_spent, question_id')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      showToast('Could not load attempts.', 'error');
      if (DOM.attemptHint) DOM.attemptHint.textContent = 'Attempts table unavailable or restricted.';
      return;
    }
    state.attempts = data || [];
    renderAttempts();
  } catch (err) {
    showToast('Could not load attempts.', 'error');
  }
};

const exportAttempts = async () => {
  if (!supabaseAvailable() || !state.user) {
    showToast('Supabase required for export.', 'error');
    return;
  }
  const client = supabaseClient();
  try {
    const { data, error } = await client
      .from('attempts')
      .select('created_at, is_correct, seconds_spent, question_id, selected')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    const rows = data || [];
    const header = ['created_at', 'question_id', 'is_correct', 'selected', 'seconds_spent'];
    const csv = [header.join(',')]
      .concat(
        rows.map((r) =>
          [
            r.created_at,
            r.question_id || '',
            r.is_correct ? 'true' : 'false',
            `"${(r.selected || '').replace(/"/g, '""')}"`,
            r.seconds_spent || '',
          ].join(','),
        ),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'examforge-attempts.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${rows.length} attempts.`, 'success');
  } catch (err) {
    showToast(err.message || 'Export failed.', 'error');
  }
};

const hydrate = () => {
  const meta = state.user?.user_metadata || {};
  const fullName = `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || 'Your name';
  if (DOM.nameDisplay) DOM.nameDisplay.textContent = fullName;
  if (DOM.emailDisplay) DOM.emailDisplay.textContent = state.user?.email || '';
  if (DOM.yearBadge) DOM.yearBadge.textContent = meta.year || 'Year —';
  if (DOM.first) DOM.first.value = meta.first_name || '';
  if (DOM.last) DOM.last.value = meta.last_name || '';
  if (DOM.year) DOM.year.value = meta.year || '';
  if (DOM.password) DOM.password.value = '';
  if (DOM.yearPills) {
    [...DOM.yearPills.querySelectorAll('.pill')].forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.year === (meta.year || ''));
    });
  }
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
  loadAttempts();
};

const saveProfile = async () => {
  if (!supabaseAvailable() || !state.user) return;
  const client = supabaseClient();
  const first = DOM.first?.value?.trim();
  const last = DOM.last?.value?.trim();
  const year = DOM.year?.value || '';
  const { error } = await client.auth.updateUser({ data: { first_name: first, last_name: last, year } });
  if (error) {
    setStatus(error.message);
    showToast(error.message, 'error');
  }
  else {
    setStatus('Profile updated.');
    showToast('Profile updated.', 'success');
    const { data } = await client.auth.getSession();
    if (data?.session?.user) state.user = data.session.user;
  }
};

const changePassword = async () => {
  if (!supabaseAvailable() || !state.user) return;
  const newPass = DOM.password?.value;
  if (!newPass) {
    setStatus('Enter a new password.');
    showToast('Enter a new password.', 'error');
    return;
  }
  const client = supabaseClient();
  const { error } = await client.auth.updateUser({ password: newPass });
  if (error) {
    setStatus(error.message);
    showToast(error.message, 'error');
  } else {
    setStatus('Password updated.');
    showToast('Password updated.', 'success');
  }
};

const signOut = async () => {
  if (!supabaseAvailable()) return;
  await supabaseClient().auth.signOut();
  window.location.href = 'index.html';
};

const handleYearPillClick = (event) => {
  const target = event.target.closest('.pill');
  if (!target || !target.dataset.year) return;
  if (DOM.year) DOM.year.value = target.dataset.year;
  [...DOM.yearPills.querySelectorAll('.pill')].forEach((pill) => {
    pill.classList.toggle('active', pill === target);
  });
};

const init = async () => {
  await loadSession();
  DOM.btnSave?.addEventListener('click', saveProfile);
  DOM.btnChangePassword?.addEventListener('click', changePassword);
  DOM.btnSignout?.addEventListener('click', signOut);
  DOM.yearPills?.addEventListener('click', handleYearPillClick);
  DOM.btnRefreshAttempts?.addEventListener('click', loadAttempts);
  DOM.btnExportAttempts?.addEventListener('click', exportAttempts);
  initPasswordToggles();
};

document.addEventListener('DOMContentLoaded', init);
