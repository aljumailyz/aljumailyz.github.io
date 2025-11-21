# UWorld‑style Exam Practice Platform

This project provides a complete, self‑hosted exam practice web app that you can
deploy on [GitHub Pages](https://pages.github.com/) and connect to your own
[Supabase](https://supabase.com/) backend.  It mimics many of the features of
popular question banks like **UWorld**: multiple choice questions with up to
six answers, per‑answer explanations, user authentication, progress saving and
basic performance statistics.

## Key features

- **Static hosting**: the entire front‑end is a set of HTML/CSS/JS files that
  can be hosted from any static site provider (GitHub Pages, Netlify, Vercel,
  Cloudflare Pages, etc.).  No server‑side code is required.
- **Supabase integration**: authentication, database and storage are powered by
  your Supabase project.  The client library is loaded directly from a
  CDN and a client instance is created using your project’s URL and
  publishable key【704982961175940†L1055-L1068】.  The library exposes a `createClient`
  function which returns a Supabase client for interacting with your
  database【467619416476982†L169-L201】.
- **User accounts**: users can sign up (email + password) and log in.  New
  accounts receive a confirmation email automatically (this requires your
  Supabase project to have SMTP/email configured).  Once logged in, their
  progress is stored per‑user so they can resume later.
- **Exam selection**: users are presented with a list of available exams.  An
  exam corresponds to a category or module of questions.
- **Question interface**: each question displays up to six answer choices.  When
  a user selects an option it instantly highlights correct and incorrect
  answers, reveals all explanations and records the answer in the database.
- **Statistics**: after completing an exam the user sees how many questions
  they answered correctly and their percentage score.
- **Responsive design**: the interface is styled with modern CSS and adapts to
  mobile and desktop screens.  Small animations make interactions feel
  polished.

## File overview

| File                | Purpose |
|---------------------|---------|
| `index.html`        | Main HTML page containing the app structure.  It loads the Supabase client from a CDN and references `script.js` for logic and `style.css` for styling. |
| `style.css`         | Contains all styling, including variables for theme colours, global resets, layout, buttons and animations. |
| `script.js`         | JavaScript that initializes Supabase, handles authentication, fetches exams/questions, manages state, records answers and computes statistics. |
| `README.md`         | This documentation. |

## Prerequisites

1. **Supabase project** – Create a new project at
   `https://app.supabase.com` and note the **Project URL** and
   **Publishable Key**.  These are used in `script.js` to create a
   client【704982961175940†L1055-L1068】.  **Never embed a service role key in client‑side code**.
2. **Database schema** – Execute the SQL below in your Supabase **SQL Editor**
   to set up the required tables and relationships.  Row‑level security (RLS)
   policies are also included to ensure users can only see and modify their own
   progress.

```sql
-- Exams table stores each exam or question bank
create table if not exists public.exams (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text
);

-- Questions for each exam
create table if not exists public.questions (
  id                     uuid primary key default gen_random_uuid(),
  exam_id                uuid references public.exams on delete cascade,
  text                   text not null,
  correct_answer_index   smallint not null, -- 0‑based index of the correct answer
  constraint fk_exam foreign key (exam_id) references public.exams (id)
);

-- Answers for each question.  Each question can have between 2 and 6 answers.
create table if not exists public.answers (
  id            uuid primary key default gen_random_uuid(),
  question_id   uuid references public.questions on delete cascade,
  answer_text   text not null,
  explanation   text not null
);

-- Track a user's answer to each question
create table if not exists public.user_answers (
  user_id                uuid references auth.users on delete cascade,
  exam_id                uuid references public.exams on delete cascade,
  question_id            uuid references public.questions on delete cascade,
  selected_answer_index  smallint not null,
  is_correct             boolean not null,
  inserted_at            timestamp with time zone default now(),
  primary key (user_id, question_id)
);

-- Enable row level security
alter table public.user_answers enable row level security;

-- Policy: allow users to see/insert/update their own answers
create policy "Allow own answers" on public.user_answers
  for all
  using (auth.uid() = user_id);
```

After running the SQL, navigate to **Authentication → Settings → Email** in the
Supabase dashboard and configure the SMTP settings if you want users to
receive confirmation or password reset emails.

## How it works

### Supabase client

The [`@supabase/supabase-js` library](https://supabase.com/docs/reference/javascript) is loaded via a CDN in
`index.html`.  According to the official documentation you can add

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

which makes a global `supabase` object available.  From this object you can
destructure the `createClient` function and create a client using your
project’s URL and a publishable key【704982961175940†L1055-L1068】.  `script.js` does exactly that:

```js
const { createClient } = supabase;
const client = createClient('https://YOUR_PROJECT.supabase.co', 'sb_publishable_...');
```

The `client` object exposes methods for authentication (`auth.signUp`,
`auth.signInWithPassword`, `auth.signOut`), querying tables (`from('table').select()`),
and inserting/upserting rows (`from('table').upsert()`).  The library is
isomorphic, meaning it can run in browsers or on servers.  When using a CDN
you don’t need to install anything via npm.

### Authentication

When the app loads it calls `client.auth.getSession()` to check if a user
already has an active session.  It then subscribes to `onAuthStateChange` to
update the UI when the login status changes.  Users can sign up with email
and password; Supabase sends an email confirmation automatically.  Once
confirmed they can log in.  The `user.id` is stored in each row of the
`user_answers` table to associate answers with the correct user.

### Exam and question flow

1. **Exam selection** – `loadExams()` fetches all rows from the `exams`
   table and renders them as a clickable list.  Each exam row should at least
   have an `id` and `title`.  You can optionally include a `description` to be
   shown as a tooltip.
2. **Fetching questions** – when a user selects an exam, `startExam()` runs
   a query on the `questions` table filtered by `exam_id`.  It also uses
   Supabase’s relational capabilities to fetch the nested `answers` for each
   question in a single request: `select('id, text, correct_answer_index, answers(id, answer_text, explanation)')`.
3. **Rendering questions** – the current question number is displayed along
   with the question text and answer options.  When the user selects an answer
   the UI highlights correct and incorrect choices, reveals each answer’s
   explanation, and persists the selection via an `upsert` into
   `user_answers`.  Row‑level security ensures that users cannot write answers
   on behalf of others.
4. **Statistics** – after the last question the app queries the
   `user_answers` table for this exam and user, counts the number of correct
   answers and displays a summary.

## Adding exams and questions

Supabase provides an intuitive web interface for managing your data.  To add
exams and questions:

1. **Exams** – open your project’s dashboard, go to **Table Editor** and
   choose the `exams` table.  Click **Insert Row** and provide a title and
   optional description.  The `id` will be generated automatically.
2. **Questions** – select the `questions` table.  Create a new row and set
   `exam_id` to the `id` of the exam you just created.  Enter the question
   text and specify which answer index is correct (0 for the first answer,
   1 for the second and so on).  Up to six answer choices are supported, but
   you can provide as few as two.
3. **Answers** – select the `answers` table and add rows for each answer.
   Set `question_id` to the `id` of the corresponding question.  Provide
   the `answer_text` (the choice) and an `explanation` (why it is correct or
   incorrect).  The order of answers you insert determines the index used by
   `correct_answer_index`.

You can bulk import data via CSV or the Supabase CLI.  For larger question
banks it may be easier to script the insertion using the Supabase REST API or
supabase-js in Node.  See the official documentation for details.

## Customizing the look and feel

The design is implemented with CSS variables defined at the top of
`style.css`.  Adjust `--primary`, `--secondary`, `--accent` and other
variables to match your brand colours.  You can also modify the card styles,
buttons and animations as needed.  The file uses flexbox and CSS grid to
ensure responsiveness on mobile devices.

## Deploying to GitHub Pages

1. **Create a repository** – make a new GitHub repository and push the
   contents of the `uworld-clone` folder to the root of the repository.
2. **Enable Pages** – in your repository settings, scroll to the **Pages**
   section.  Select the `main` branch (or whichever branch you use) and the
   `/` (root) folder as the source.  Save.  GitHub will build and deploy the
   site automatically; the URL will be shown once it’s ready (typically
   `https://YOUR_USERNAME.github.io/YOUR_REPO`).
3. **Environment variables** – because this is a static site, the Supabase
   project URL and publishable key are hard‑coded in `script.js`.  If you
   rotate your key or change projects, update the constants at the top of
   `script.js` and redeploy.

## Extending the project

This template provides a solid starting point.  Additional enhancements you may
wish to implement include:

* **Tagging and filtering** – add tags or categories to questions and let
  users filter by topic, system or difficulty.
* **Timed mode** – record how long users take to answer and provide time‑based
  scoring.
* **Search** – add a search bar to find specific questions.
* **Review sessions** – allow users to revisit previously answered questions
  and see explanations without affecting their statistics.
* **Leaderboards** – compute aggregated statistics across users for friendly
  competition (ensure you handle privacy appropriately).

## Troubleshooting

If you see `Access denied` errors when reading or writing data, verify that
Row Level Security policies are correctly configured and that you are using
your **publishable (anon) key**, not the service role key.  If users are not
receiving confirmation emails, check your SMTP settings in the Supabase
dashboard.  For more information on using Supabase from the browser consult
the JavaScript client reference【467619416476982†L169-L201】.

---

*This project is provided as a learning example and is not affiliated with
UWorld.  Always respect copyright when adding content and ensure that your
usage complies with the terms of service of any materials you incorporate.*