# ExamForge

ExamForge is a web-based question bank and quiz player with email/password login, timed or untimed practice, and an allowlist for paid users.

## What you can do
- Sign up or sign in with your email and choose a bank to practice.
- Pick timed or untimed mode before starting; see per-question explanations only after you submit.
- Navigate questions with the left sidebar, submit answers, finish to see your score, and track basic stats.
- If your email isn’t on the allowlist, you’ll see a clear “Please contact Zaid to enable access” gate.

## Getting access (paid allowlist)
- Allowed emails live in `config.js` under `window.__PAID_USERS` (lowercase). Zaid adds or removes emails there to grant/revoke access.
- If you’re blocked, contact Zaid with the email you use to sign in so he can allow it.

## Running the site
- Local: open `index.html` in a browser (or `npx serve .`). Ensure `config.js` has your Supabase URL and anon key.
- GitHub Pages: push `index.html`, `config.js`, `/js`, and `/styles.css` to the Pages branch and enable Pages from the root.

## Admin and content
- Admin tools live at `admin.html` (requires your Supabase user to have `app_metadata.role = "admin"`).
- Import banks/questions via JSON (`sample-exam.json` shows the format: bank info + questions with up to 6 answers, explanations, optional imageUrl).

## Supabase checklist
1) Tables: `banks`, `questions` (JSONB `answers`), `attempts`.  
2) View: `user_stats` aggregating attempts (`answered`, `accuracy`, `time`).  
3) RLS: admin policies on banks/questions, per-user policies on attempts.  
4) Admin flag: set `app_metadata.role = "admin"` for your admin account.  

## File map
- `index.html` – user dashboard and practice flow.
- `styles.css` – layout and components.
- `js/app.js` – auth, allowlist check, bank loading, practice logic, stats, timers.
- `js/admin.js` – admin CRUD/import for banks/questions (Supabase-gated).
- `config.js` – Supabase URL/key and paid users allowlist.
- `sample-exam.json` – example import file for banks/questions.
