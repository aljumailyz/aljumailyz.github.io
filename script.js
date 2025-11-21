/*
 * Client‑side logic for the UWorld‑like exam practice app.  This module
 * encapsulates authentication, data fetching, user interaction and state
 * management.  It relies on the Supabase client loaded via the CDN as
 * described in the official docs【704982961175940†L1055-L1068】.  You should
 * replace SUPABASE_URL and SUPABASE_KEY with the values from your own
 * project.  The publishable key can be safely exposed in client‑side
 * applications because row‑level security rules protect your data.
 */

(() => {
  // Configuration – insert your own project details here.  The user has
  // provided a publishable key and URL; those values are inserted below.
  const SUPABASE_URL = 'https://xsrbsmjklnigrtmqkbsm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_d82AZMNDIcPtyJUJECehRw_Rf2ZMfXV';

  // Create a single Supabase client instance.  When using the script via
  // CDN the `supabase` global exposes helpers including `createClient`【704982961175940†L1055-L1068】.
  const { createClient } = supabase;
  const client = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Application state and methods are grouped on the App object.  This
  // simplifies access from HTML event handlers defined in index.html.
  const App = {
    user: null,
    session: null,
    exams: [],
    currentExam: null,
    questions: [],
    questionIndex: 0,
    userAnswers: {},

    /**
     * Initialize the application: check if a user is logged in and load
     * available exams.  This runs once on page load.
     */
    async init() {
      // Show current year in footer
      document.getElementById('year').textContent = new Date().getFullYear();

      // Listen for auth state changes
      client.auth.onAuthStateChange((_event, session) => {
        this.session = session;
        this.user = session?.user ?? null;
        this.updateAuthUI();
        if (this.user) {
          this.loadExams();
        } else {
          this.showExamSection(false);
        }
      });

      // Get initial session
      const { data } = await client.auth.getSession();
      this.session = data.session;
      this.user = this.session?.user ?? null;
      this.updateAuthUI();
      if (this.user) {
        await this.loadExams();
      }
    },

    /**
     * Update navigation buttons depending on login state.
     */
    updateAuthUI() {
      const loggedIn = !!this.user;
      document.getElementById('loginBtn').style.display = loggedIn ? 'none' : 'inline-block';
      document.getElementById('signupBtn').style.display = loggedIn ? 'none' : 'inline-block';
      document.getElementById('logoutBtn').style.display = loggedIn ? 'inline-block' : 'none';
    },

    /**
     * Display the login modal.
     */
    showLogin() {
      document.getElementById('loginModal').style.display = 'flex';
    },

    /**
     * Display the signup modal.
     */
    showSignup() {
      document.getElementById('signupModal').style.display = 'flex';
    },

    /**
     * Hide both modals.
     */
    hideModals() {
      document.getElementById('loginModal').style.display = 'none';
      document.getElementById('signupModal').style.display = 'none';
    },

    /**
     * Sign up a new user using Supabase Auth.  After successful
     * registration the user must verify their email before they can log in.
     */
    async signup() {
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;
      if (!email || !password) {
        alert('Please provide both email and password.');
        return;
      }
      const { error } = await client.auth.signUp({ email, password });
      if (error) {
        alert('Sign up error: ' + error.message);
      } else {
        alert('Check your email for a confirmation link before logging in.');
        this.hideModals();
      }
    },

    /**
     * Log in an existing user with email and password.
     */
    async login() {
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      if (!email || !password) {
        alert('Please provide both email and password.');
        return;
      }
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        alert('Login error: ' + error.message);
      } else {
        this.hideModals();
        // session and user will update via auth state listener
      }
    },

    /**
     * Log out the current user.
     */
    async logout() {
      await client.auth.signOut();
    },

    /**
     * Load all available exams from the database and display them.
     */
    async loadExams() {
      // Hide other sections
      this.showQuestionSection(false);
      this.showStatsSection(false);

      // Query the `exams` table.  Expect each exam to have `id` and `title` columns.
      const { data, error } = await client.from('exams').select('id, title, description');
      if (error) {
        console.error('Error fetching exams', error);
        return;
      }
      this.exams = data || [];
      const list = document.getElementById('examList');
      list.innerHTML = '';
      if (this.exams.length === 0) {
        list.innerHTML = '<li>No exams available. Add some in Supabase!</li>';
      } else {
        this.exams.forEach((exam) => {
          const li = document.createElement('li');
          li.textContent = exam.title;
          li.title = exam.description || '';
          li.addEventListener('click', () => this.startExam(exam));
          list.appendChild(li);
        });
      }
      this.showExamSection(true);
    },

    /**
     * Show or hide the exam selection area.
     */
    showExamSection(visible) {
      document.getElementById('examSection').style.display = visible ? 'block' : 'none';
    },

    /**
     * Show or hide the question area.
     */
    showQuestionSection(visible) {
      document.getElementById('questionSection').style.display = visible ? 'block' : 'none';
    },

    /**
     * Show or hide the statistics area.
     */
    showStatsSection(visible) {
      document.getElementById('statsSection').style.display = visible ? 'block' : 'none';
    },

    /**
     * Start an exam by loading its questions and resetting local state.
     */
    async startExam(exam) {
      this.currentExam = exam;
      this.questionIndex = 0;
      this.userAnswers = {};
      document.getElementById('examTitle').textContent = exam.title;
      // Fetch questions with their answers.  We assume there is a table
      // `questions` with columns `id`, `exam_id`, `text`, `correct_answer_index`,
      // and a relation to `answers` table via `question_id`.  The answers
      // table stores each option and its explanation.
      const { data, error } = await client
        .from('questions')
        .select('id, exam_id, text, correct_answer_index, answers(id, answer_text, explanation)')
        .eq('exam_id', exam.id)
        .order('id');
      if (error) {
        alert('Error loading questions: ' + error.message);
        return;
      }
      this.questions = data || [];
      if (this.questions.length === 0) {
        alert('This exam has no questions. Please add questions in Supabase.');
        return;
      }
      this.showExamSection(false);
      this.showQuestionSection(true);
      this.renderQuestion();
    },

    /**
     * Render the current question and answer choices.
     */
    renderQuestion() {
      const q = this.questions[this.questionIndex];
      document.getElementById('questionCounter').textContent = `Question ${this.questionIndex + 1} of ${this.questions.length}`;
      document.getElementById('questionText').textContent = q.text;
      const answerList = document.getElementById('answerChoices');
      answerList.innerHTML = '';
      // Reset explanation panel
      const explanationsPanel = document.getElementById('explanationPanel');
      explanationsPanel.style.display = 'none';
      document.getElementById('explanationsList').innerHTML = '';
      // Populate answers
      q.answers.forEach((ans, idx) => {
        const li = document.createElement('li');
        li.textContent = ans.answer_text;
        li.dataset.index = idx;
        li.addEventListener('click', () => this.selectAnswer(idx));
        answerList.appendChild(li);
      });
      // Hide next button until an answer is chosen
      document.getElementById('nextBtn').style.display = 'none';
    },

    /**
     * Handle answer selection: highlight the choice, show explanations and save
     * the answer to Supabase.  Option indices start at zero, but the
     * `correct_answer_index` is stored using the same indexing.
     */
    async selectAnswer(idx) {
      const q = this.questions[this.questionIndex];
      // Prevent multiple selections
      if (this.userAnswers[q.id] !== undefined) return;
      this.userAnswers[q.id] = idx;
      // Mark selected answer and indicate correct/wrong
      const answerList = document.getElementById('answerChoices');
      answerList.childNodes.forEach((li) => {
        const i = parseInt(li.dataset.index, 10);
        if (i === idx) {
          li.classList.add('selected');
        }
        if (i === q.correct_answer_index) {
          li.classList.add('correct');
        } else if (i === idx) {
          li.classList.add('wrong');
        }
      });
      // Show explanations panel
      const explanationsList = document.getElementById('explanationsList');
      q.answers.forEach((ans, i) => {
        const expLi = document.createElement('li');
        const prefix = i === q.correct_answer_index ? '✓' : (i === idx ? '✕' : '');
        expLi.innerHTML = `<strong>${prefix}</strong> ${ans.explanation}`;
        explanationsList.appendChild(expLi);
      });
      document.getElementById('explanationPanel').style.display = 'block';
      // Show next button if not last question
      if (this.questionIndex < this.questions.length - 1) {
        document.getElementById('nextBtn').style.display = 'inline-block';
      } else {
        document.getElementById('nextBtn').textContent = 'Finish';
        document.getElementById('nextBtn').style.display = 'inline-block';
      }
      // Persist answer in database – this creates or updates a row in
      // `user_answers` table.  The table should have a composite primary
      // key on (user_id, question_id) to allow upserts.  We also record
      // whether the answer was correct for convenience.
      try {
        const { error } = await client.from('user_answers').upsert({
          user_id: this.user.id,
          exam_id: this.currentExam.id,
          question_id: q.id,
          selected_answer_index: idx,
          is_correct: idx === q.correct_answer_index,
        });
        if (error) {
          console.error('Error saving answer', error);
        }
      } catch (err) {
        console.error('Unexpected error saving answer', err);
      }
    },

    /**
     * Move to the next question or finish the exam.
     */
    async nextQuestion() {
      if (this.questionIndex < this.questions.length - 1) {
        this.questionIndex++;
        this.renderQuestion();
      } else {
        // Completed the exam – show statistics
        await this.showStatistics();
      }
    },

    /**
     * Calculate and display the user’s statistics for the current exam.
     */
    async showStatistics() {
      // Hide question section
      this.showQuestionSection(false);
      // Query user answers for this exam from the DB
      const { data, error } = await client
        .from('user_answers')
        .select('is_correct')
        .eq('user_id', this.user.id)
        .eq('exam_id', this.currentExam.id);
      if (error) {
        alert('Error fetching statistics: ' + error.message);
        return;
      }
      const total = data.length;
      const correct = data.filter((r) => r.is_correct).length;
      const percent = total ? Math.round((correct / total) * 100) : 0;
      document.getElementById('statsSummary').textContent = `You answered ${correct} out of ${total} questions correctly (${percent}%).`;
      this.showStatsSection(true);
    },

    /**
     * Return to the exam list after finishing.
     */
    backToExamList() {
      this.showStatsSection(false);
      this.loadExams();
    },
  };

  // Expose App to global scope so HTML can call its methods
  window.App = App;
  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => App.init());
})();