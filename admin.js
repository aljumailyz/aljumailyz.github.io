// admin.js
import { supabase } from './supabaseClient.js';

const msg = document.getElementById('admin-message');

async function init() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = 'index.html';
    return;
  }

  const user = data.session.user;
  const ADMIN_EMAIL = 'youremail@example.com'; // change this to your email
  if (user.email !== ADMIN_EMAIL) {
    msg.textContent = 'You are not authorized to add questions (admin only).';
    document.getElementById('q-save-btn').disabled = true;
  }
}

document.getElementById('q-save-btn').addEventListener('click', async () => {
  msg.textContent = '';

  const stem = document.getElementById('q-stem').value.trim();
  const optA = document.getElementById('q-opt-a').value.trim();
  const optB = document.getElementById('q-opt-b').value.trim();
  const optC = document.getElementById('q-opt-c').value.trim();
  const optD = document.getElementById('q-opt-d').value.trim();
  const correct = document.getElementById('q-correct').value;
  const explanation = document.getElementById('q-explanation').value.trim();
  const subject = document.getElementById('q-subject').value.trim();
  const system = document.getElementById('q-system').value.trim();
  const difficulty = document.getElementById('q-difficulty').value;
  const imageUrl = document.getElementById('q-image').value.trim() || null;

  if (!stem || !optA || !optB || !optC || !optD || !explanation || !subject || !system) {
    msg.textContent = 'Please fill all required fields.';
    return;
  }

  const { error } = await supabase.from('questions').insert({
    stem,
    option_a: optA,
    option_b: optB,
    option_c: optC,
    option_d: optD,
    correct_option: correct,
    explanation,
    subject,
    system,
    difficulty,
    image_url: imageUrl
  });

  if (error) {
    msg.textContent = error.message;
  } else {
    msg.textContent = 'Question saved.';
  }
});

init();
