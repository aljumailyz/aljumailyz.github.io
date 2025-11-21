(() => {
  const SUPABASE_URL = 'https://xsrbsmjklnigrtmqkbsm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_d82AZMNDIcPtyJUJECehRw_Rf2ZMfXV';

  const { createClient } = supabase;
  const client = createClient(SUPABASE_URL, SUPABASE_KEY);

  const App = {
    user: null,
    session: null,
    exams: [],
    currentExam: null,
    questions: [],
    questionIndex: 0,
    userAnswersLocal: {},
    questionStartTime: null,

    async init() {
      document.getElementById('year').textContent = new Date().getFullYear();

      client.auth.onAuthStateChange((_event, session) => {
        this.session = session;
        this.user = session?.user ?? null;
        this.updateAuthUI();
        if (this.user) {
          this.loadExams();
        } else {
          this.showExamSection(false);
          this.showQuestionSection(false);
          this.showStatsSection(false);
        }
      });

      const { data } = await client.auth.getSession();
      this.session = data.session;
      this.user = this.session?.user ?? null;
      this.updateAuthUI();
      if (this.user) {
        await this.loadExams();
      }
    },

    updateAuthUI() {
      const loggedIn = !!this.user;
      document.getElementById('loginBtn').style.display = loggedIn ? 'none' : 'inline-block';
      document.getElementById('signupBtn').style.display = loggedIn ? 'none' : 'inline-block';
      document.getElementById('logoutBtn').style.display = loggedIn ? 'inline-block' : 'none';
    },

    showLogin() {
      document.getElementById('loginModal').style.display = 'flex';
    },

    showSignup() {
      document.getElementById('signupModal').style.display = 'flex';
    },

    hideModals() {
      document.getElementById('loginModal').style.display = 'none';
      document.getElementById('signupModal').style.display = 'none';
    },

    async signup() {
      const email = document.getElementById('signupEmail').value.trim();
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

    async login() {
      const email = document.getElementById('loginEmail').value.trim();
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
      }
    },

    async logout() {
      await client.auth.signOut();
    },

    async loadExams() {
      this.showQuestionSection(false);
      this.showStatsSection(false);

      const { data, error } = await client
        .from('exams')
        .select('id, title, description')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching exams', error);
        alert('Error loading exams: ' + error.message);
        return;
      }

      this.exams = data || [];
      const list = document.getElementById('examList');
      list.innerHTML = '';

      if (this.exams.length === 0) {
        list.innerHTML = '<li>No exams yet. Use the Admin page to add some.</li>';
      } else {
        this.exams.forEach((exam) => {
          const li = document.createElement('li');
          li.className = 'exam-item';
          li.innerHTML = `
            <div class="exam-title">${exam.title}</div>
            <div class="exam-desc">${exam.description || ''}</div>
          `;
          li.addEventListener('click', () => this.startExam(exam));
          list.appendChild(li);
        });
      }

      this.showExamSection(true);
    },

    showExamSection(v) {
      document.getElementById('examSection').style.display = v ? 'block' : 'none';
    },

    showQuestionSection(v) {
      document.getElementById('questionSection').style.display = v ? 'block' : 'none';
    },

    showStatsSection(v) {
      document.getElementById('statsSection').style.display = v ? 'block' : 'none';
    },

    async startExam(exam) {
      if (!this.user) {
        alert('Please log in first.');
        return;
      }

      this.currentExam = exam;
      this.questionIndex = 0;
      this.userAnswersLocal = {};
      document.getElementById('examTitle').textContent = exam.title;

      const { data, error } = await client
        .from('questions')
        .select(`
          id,
          text,
          media_url,
          general_explanation,
          answers (
            id,
            choice_index,
            choice_text,
            explanation,
            is_correct
          )
        `)
        .eq('exam_id', exam.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error(error);
        alert('Error loading questions: ' + error.message);
        return;
      }

      this.questions = (data || []).map((q) => ({
        ...q,
        answers: (q.answers || []).sort((a, b) => a.choice_index - b.choice_index)
      }));

      if (this.questions.length === 0) {
        alert('This exam has no questions yet.');
        return;
      }

      this.showExamSection(false);
      this.showStatsSection(false);
      this.showQuestionSection(true);
      this.renderQuestion();
    },

    renderQuestion() {
      const q = this.questions[this.questionIndex];
      const total = this.questions.length;

      document.getElementById('questionCounter').textContent =
        `Question ${this.questionIndex + 1} of ${total}`;

      document.getElementById('questionText').textContent = q.text || '';

      // media (image)
      const mediaContainer = document.getElementById('questionMedia');
      mediaContainer.innerHTML = '';
      if (q.media_url) {
        const img = document.createElement('img');
        img.src = q.media_url;
        img.alt = 'Question image';
        img.addEventListener('click', () => this.showImage(q.media_url));
        mediaContainer.appendChild(img);
      }

      const answerList = document.getElementById('answerChoices');
      answerList.innerHTML = '';

      q.answers.forEach((ans) => {
        const li = document.createElement('li');
        li.className = 'answer-choice';
        li.dataset.index = ans.choice_index.toString();
        li.innerHTML = `
          <div class="answer-label">${String.fromCharCode(65 + ans.choice_index)}</div>
          <div class="answer-text">${ans.choice_text}</div>
        `;
        li.addEventListener('click', () => this.selectAnswer(ans.choice_index));
        answerList.appendChild(li);
      });

      // reset explanations and next button
      document.getElementById('explanationPanel').style.display = 'none';
      document.getElementById('explanationsList').innerHTML = '';
      const nextBtn = document.getElementById('nextBtn');
      nextBtn.style.display = 'none';
      nextBtn.textContent = 'Next';

      this.questionStartTime = Date.now();
    },

    async selectAnswer(choiceIndex) {
      const q = this.questions[this.questionIndex];

      // prevent double-answers
      if (this.userAnswersLocal[q.id] !== undefined) return;
      this.userAnswersLocal[q.id] = choiceIndex;

      // highlight answers
      const answerList = document.getElementById('answerChoices');
      const correctIndices = q.answers.filter(a => a.is_correct).map(a => a.choice_index);
      const chosenCorrect = correctIndices.includes(choiceIndex);

      answerList.childNodes.forEach((li) => {
        const idx = parseInt(li.dataset.index, 10);
        if (idx === choiceIndex) {
          li.classList.add('selected');
        }
        if (correctIndices.includes(idx)) {
          li.classList.add('correct');
        } else if (idx === choiceIndex) {
          li.classList.add('wrong');
        }
      });

      // build explanations panel
      const expPanel = document.getElementById('explanationPanel');
      const expList = document.getElementById('explanationsList');
      expList.innerHTML = '';

      q.answers.forEach((ans) => {
        const li = document.createElement('li');
        const isCorrect = ans.is_correct;
        const isChosen = ans.choice_index === choiceIndex;
        let prefix = '';
        if (isCorrect) prefix = '✓';
        else if (isChosen) prefix = '✕';
        li.innerHTML = `<strong>${prefix}</strong> ${ans.explanation || ''}`;
        expList.appendChild(li);
      });

      if (q.general_explanation) {
        const li = document.createElement('li');
        li.innerHTML = `<em>${q.general_explanation}</em>`;
        expList.appendChild(li);
      }

      expPanel.style.display = 'block';

      const nextBtn = document.getElementById('nextBtn');
      nextBtn.style.display = 'inline-block';
      if (this.questionIndex === this.questions.length - 1) {
        nextBtn.textContent = 'Finish';
      }

      // persist answer in DB
      const timeMs = this.questionStartTime ? (Date.now() - this.questionStartTime) : null;

      try {
        const { error } = await client.from('user_answers').insert({
          user_id: this.user.id,
          exam_id: this.currentExam.id,
          question_id: q.id,
          choice_index: choiceIndex,
          is_correct: chosenCorrect,
          time_ms: timeMs
        });
        if (error) {
          console.error('Error saving answer', error);
        }
      } catch (err) {
        console.error('Unexpected error saving answer', err);
      }
    },

    async nextQuestion() {
      if (this.questionIndex < this.questions.length - 1) {
        this.questionIndex++;
        this.renderQuestion();
      } else {
        await this.showStatistics();
      }
    },

    async showStatistics() {
      this.showQuestionSection(false);

      const { data, error } = await client
        .from('user_answers')
        .select('is_correct')
        .eq('user_id', this.user.id)
        .eq('exam_id', this.currentExam.id);

      if (error) {
        console.error(error);
        alert('Error fetching statistics: ' + error.message);
        return;
      }

      const total = data.length;
      const correct = data.filter((r) => r.is_correct).length;
      const percent = total ? Math.round((correct / total) * 100) : 0;

      document.getElementById('statsSummary').textContent =
        `You answered ${correct} out of ${total} questions correctly (${percent}%).`;

      this.showStatsSection(true);
    },

    backToExamList() {
      this.showStatsSection(false);
      this.loadExams();
    },

    showImage(url) {
      const modal = document.getElementById('imageModal');
      const img = document.getElementById('imageModalImg');
      img.src = url;
      modal.style.display = 'flex';
    },

    hideImage() {
      const modal = document.getElementById('imageModal');
      const img = document.getElementById('imageModalImg');
      img.src = '';
      modal.style.display = 'none';
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})();
