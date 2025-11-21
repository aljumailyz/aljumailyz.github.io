// stats.js
import { supabase } from './supabaseClient.js';

const statsContent = document.getElementById('stats-content');

async function init() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = 'index.html';
    return;
  }
  const user = data.session.user;

  const { data: answers, error } = await supabase
    .from('answers')
    .select('*, questions(subject, system)')
    .eq('user_id', user.id)
    .order('answered_at', { ascending: false });

  if (error) {
    statsContent.innerHTML = `<p>${error.message}</p>`;
    return;
  }

  if (!answers || answers.length === 0) {
    statsContent.innerHTML = `<p>No questions answered yet.</p>`;
    return;
  }

  const total = answers.length;
  const correct = answers.filter(a => a.is_correct).length;
  const overallPct = ((correct / total) * 100).toFixed(1);

  const bySubject = {};
  answers.forEach(a => {
    const subj = a.questions.subject;
    if (!bySubject[subj]) bySubject[subj] = { total: 0, correct: 0 };
    bySubject[subj].total++;
    if (a.is_correct) bySubject[subj].correct++;
  });

  let html = '';
  html += `<p><strong>Overall:</strong> ${correct} / ${total} correct (${overallPct}%).</p>`;
  html += `<h2>By Subject</h2>`;
  html += `<table style="width:100%; border-collapse:collapse;">
    <thead>
      <tr>
        <th style="text-align:left; border-bottom:1px solid #e5e7eb; padding:0.5rem;">Subject</th>
        <th style="text-align:left; border-bottom:1px solid #e5e7eb; padding:0.5rem;">Correct</th>
        <th style="text-align:left; border-bottom:1px solid #e5e7eb; padding:0.5rem;">Total</th>
        <th style="text-align:left; border-bottom:1px solid #e5e7eb; padding:0.5rem;">%</th>
      </tr>
    </thead>
    <tbody>`;

  Object.entries(bySubject).forEach(([subj, s]) => {
    const pct = ((s.correct / s.total) * 100).toFixed(1);
    html += `<tr>
      <td style="padding:0.5rem; border-bottom:1px solid #f3f4f6;">${subj}</td>
      <td style="padding:0.5rem; border-bottom:1px solid #f3f4f6;">${s.correct}</td>
      <td style="padding:0.5rem; border-bottom:1px solid #f3f4f6;">${s.total}</td>
      <td style="padding:0.5rem; border-bottom:1px solid #f3f4f6;">${pct}%</td>
    </tr>`;
  });

  html += `</tbody></table>`;

  statsContent.innerHTML = html;
}

init();
