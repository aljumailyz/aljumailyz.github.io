# ExamForge (fresh build)

Static UWorld-style practice site that works on GitHub Pages and uses Supabase for auth, question storage, and attempts. Supports images, up to six answer options, shuffling of questions/answers, and per-choice explanations.

## Quick start
- Open `index.html` locally or serve the folder (`npx serve .`) and try the sample questions.
- Explanations appear after you click **Submit**; questions/answers can be shuffled with the toggles.
- Builder lets you add up to six options (one marked correct) with explanations and an optional image URL.
- Supabase config is already in `config.js` for your project (public anon key).

## Supabase setup
Tables (run in the SQL editor):
```sql
create extension if not exists "uuid-ossp";

create table questions (
  id uuid primary key default uuid_generate_v4(),
  stem text not null,
  image_url text,
  source text,
  topic text,
  difficulty text default 'Moderate',
  mode text default 'Tutor',
  answers jsonb not null,
  owner uuid references auth.users(id),
  created_at timestamptz default now()
);

create table attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  question_id uuid references questions(id),
  selected text,
  is_correct boolean,
  seconds_spent int,
  submitted_at timestamptz default now()
);
```

Helpful view (used by the app first; falls back to `questions` if missing):
```sql
create view question_view as
select id, stem, image_url, source, topic, difficulty, mode, answers
from questions
order by created_at desc;
```

Row Level Security example:
- `questions`: allow authenticated insert/select (or restrict insert where `auth.uid() = owner`).
- `attempts`: allow insert/select where `user_id = auth.uid()`.

## How it works
- Pure static SPA (`index.html`, `styles.css`, `js/*`) — ideal for GitHub Pages.
- Supabase client loads from CDN; credentials come from `config.js` (public anon key).
- `js/app.js` loads `question_view` (or `questions`) when available; otherwise uses `js/data.js` sample content.
- Auth uses Supabase email/password. Attempts save to `attempts` when signed in; builder inserts into `questions`.
- Question and answer order can be toggled independently. Explanations render per choice after submission.

## Deploy on GitHub Pages
- Commit/push to GitHub, enable Pages on the repo root (`/`).
- Since `config.js` is included, the page works out of the box with your Supabase project URL/key.

## File map
- `index.html` – layout, hero, practice panel, reports, builder.
- `styles.css` – visual system, cards, gradients, option states.
- `js/app.js` – SPA logic, shuffling, grading, auth, builder, Supabase calls.
- `js/data.js` – sample questions for offline/demo.
- `js/supabase.js` – Supabase client bootstrap.
- `config.js` – Supabase project URL + public anon key.

## Next ideas
- Add filters (topic/difficulty) and timed mode countdowns.
- Render Markdown in stems/explanations; allow Supabase Storage uploads for images.
- Add charts for attempts per topic and streak tracking.
