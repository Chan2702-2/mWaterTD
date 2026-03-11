// Survey Pro App - Main Application Logic

// App State
const AppState = {
  currentUser: null,
  currentPage: 'login',
  currentForm: null,
  forms: [],
  surveys: [],
  stats: { total: 0, today: 0 },
  map: null,
  markers: []
};

// Navigation
const Navigation = {
  pages: ['dashboard', 'survey', 'data', 'profile'],
  
  init() {
    this.setupBottomNav();
    this.setupAuthListeners();
    this.checkAuth();
  },

  setupBottomNav() {
    const navItems = document.querySelectorAll('.bottom-nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        if (page) this.navigate(page);
      });
    });
  },

  setupAuthListeners() {
    window.SurveyApp.Auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.navigate('login');
      } else if (session) {
        this.loadUserData(session.user);
      }
    });
  },

  async checkAuth() {
    try {
      const user = await window.SurveyApp.Auth.getCurrentUser();
      if (user) {
        await this.loadUserData(user);
      } else {
        this.navigate('login');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.navigate('login');
    }
  },

  async loadUserData(user) {
    try {
      const profile = await window.SurveyApp.Users.getProfile(user.id);
      AppState.currentUser = { ...user, ...profile };
      this.navigate('dashboard');
    } catch (error) {
      console.error('Failed to load user data:', error);
      // If profile doesn't exist, create one
      if (error.message.includes('No rows') || error.status === 406) {
        await window.SurveyApp.Users.updateProfile(user.id, {
          name: user.email.split('@')[0],
          role: 'surveyor'
        });
        this.navigate('dashboard');
      }
    }
  },

  navigate(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.add('hidden');
    });

    // Show target page
    const targetPage = document.getElementById(`${page}-page`);
    if (targetPage) {
      targetPage.classList.remove('hidden');
      targetPage.classList.add('animate-fade-in');
    }

    // Update bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page === page) {
        item.classList.add('active');
      }
    });

    // Show/hide bottom nav
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
      if (page === 'login') {
        bottomNav.classList.add('hidden');
      } else {
        bottomNav.classList.remove('hidden');
      }
    }

    AppState.currentPage = page;

    // Load page data
    this.loadPageData(page);
  },

  async loadPageData(page) {
    switch (page) {
      case 'dashboard':
        await Dashboard.load();
        break;
      case 'survey':
        await SurveyPage.load();
        break;
      case 'data':
        await DataPage.load();
        break;
      case 'profile':
        ProfilePage.load();
        break;
    }
  }
};

// Dashboard
const Dashboard = {
  async load() {
    this.showLoading(true);
    try {
      const stats = await window.SurveyApp.Surveys.getStats(
        AppState.currentUser.role === 'surveyor' ? AppState.currentUser.id : null
      );
      AppState.stats = stats;
      this.renderStats();
      this.renderRecentSurveys();
      this.renderMap();
    } catch (error) {
      console.error('Dashboard load error:', error);
      this.showError('Failed to load dashboard');
    }
    this.showLoading(false);
  },

  renderStats() {
    const statsContainer = document.getElementById('stats-container');
    if (!statsContainer) return;

    statsContainer.innerHTML = `
      <div class="grid grid-cols-2 gap-4">
        <div class="stat-card animate-slide-up stagger-1">
          <div class="stat-value text-primary-600">${AppState.stats.total}</div>
          <div class="stat-label">Total Survey</div>
        </div>
        <div class="stat-card animate-slide-up stagger-2">
          <div class="stat-value text-green-600">${AppState.stats.today}</div>
          <div class="stat-label">Hari Ini</div>
        </div>
      </div>
    `;
  },

  renderRecentSurveys() {
    const container = document.getElementById('recent-surveys');
    if (!container) return;

    window.SurveyApp.Surveys.getToday(
      AppState.currentUser.role === 'surveyor' ? AppState.currentUser.id : null
    ).then(surveys => {
      if (surveys.length === 0) {
        container.innerHTML = `
          <div class="empty-state py-8">
            <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <div class="empty-state-title">Belum Ada Survey</div>
            <div class="empty-state-description">Mulai survey pertama Anda</div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="space-y-3">
          ${surveys.slice(0, 5).map((survey, index) => `
            <div class="card flex items-center justify-between animate-slide-up stagger-${index + 1}">
              <div>
                <div class="font-medium text-gray-900">${survey.form?.title || 'Survey'}</div>
                <div class="text-sm text-gray-500">${this.formatDate(survey.created_at)}</div>
              </div>
              <div class="w-2 h-2 rounded-full ${survey.latitude ? 'bg-green-500' : 'bg-amber-500'}"></div>
            </div>
          `).join('')}
        </div>
      `;
    });
  },

  renderMap() {
    const mapContainer = document.getElementById('dashboard-map');
    if (!mapContainer) return;

    // Initialize Leaflet map
    if (AppState.map) {
      AppState.map.remove();
    }

    AppState.map = L.map('dashboard-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([-6.2, 106.8], 10); // Default to Jakarta

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(AppState.map);

    // Load survey locations
    window.SurveyApp.Surveys.getAll().then(surveys => {
      const surveysWithLocation = surveys.filter(s => s.latitude && s.longitude);
      
      surveysWithLocation.forEach(survey => {
        const marker = L.marker([survey.latitude, survey.longitude])
          .addTo(AppState.map)
          .bindPopup(`
            <div class="text-center">
              <div class="font-medium">${survey.form?.title || 'Survey'}</div>
              <div class="text-xs text-gray-500">${this.formatDate(survey.created_at)}</div>
            </div>
          `);
        AppState.markers.push(marker);
      });

      // Fit bounds if markers exist
      if (surveysWithLocation.length > 0) {
        const group = L.featureGroup(AppState.markers);
        AppState.map.fitBounds(group.getBounds(), { padding: [50, 50] });
      }
    });
  },

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  showLoading(show) {
    const loader = document.getElementById('dashboard-loader');
    if (loader) loader.classList.toggle('hidden', !show);
  },

  showError(message) {
    // Show error notification
    this.showToast(message, 'error');
  },

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 left-4 right-4 z-50 p-4 rounded-xl animate-slide-down ${
      type === 'error' ? 'bg-red-500 text-white' : 'bg-primary-600 text-white'
    }`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};

// Survey Page
const SurveyPage = {
  currentForm: null,
  surveyData: {},
  gpsLocation: null,
  photos: {},

  async load() {
    this.showLoading(true);
    try {
      const forms = await window.SurveyApp.Forms.getAll();
      AppState.forms = forms;
      this.renderForms();
    } catch (error) {
      console.error('Forms load error:', error);
    }
    this.showLoading(false);
  },

  renderForms() {
    const container = document.getElementById('forms-list');
    if (!container) return;

    if (AppState.forms.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <div class="empty-state-title">Belum Ada Form</div>
          <div class="empty-state-description">Admin perlu membuat form survey terlebih dahulu</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-3">
        ${AppState.forms.map((form, index) => `
          <div class="card animate-slide-up stagger-${index + 1} cursor-pointer hover:shadow-elevated transition-shadow"
               onclick="SurveyPage.startSurvey('${form.id}')">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-semibold text-gray-900">${form.title}</h3>
                <p class="text-sm text-gray-500 mt-1">${form.description || 'Klik untuk mulai survey'}</p>
              </div>
              <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async startSurvey(formId) {
    this.showLoading(true);
    try {
      const form = await window.SurveyApp.Forms.getById(formId);
      const questions = await window.SurveyApp.Questions.getByFormId(formId);
      AppState.currentForm = { ...form, questions };
      this.surveyData = {};
      this.photos = {};
      this.renderSurveyForm();
    } catch (error) {
      console.error('Start survey error:', error);
    }
    this.showLoading(false);
  },

  renderSurveyForm() {
    const container = document.getElementById('survey-form-container');
    if (!container) return;

    const { form, questions } = AppState.currentForm;

    // Navigate to survey form view
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('survey-form-page').classList.remove('hidden');

    container.innerHTML = `
      <div class="space-y-6 pb-24">
        <div>
          <h2 class="text-xl font-bold text-gray-900">${form.title}</h2>
          <p class="text-sm text-gray-500 mt-1">Isi data survey dengan lengkap</p>
        </div>

        <!-- GPS Location -->
        <div class="card">
          <div class="flex items-center justify-between mb-3">
            <label class="text-sm font-medium text-gray-700">Lokasi GPS</label>
            <button onclick="SurveyPage.getGPS()" class="text-sm text-primary-600 font-medium">
              ${this.gpsLocation ? 'Update Lokasi' : 'Ambil Lokasi'}
            </button>
          </div>
          <div id="gps-status" class="text-sm ${this.gpsLocation ? 'text-green-600' : 'text-gray-400'}">
            ${this.gpsLocation 
              ? `📍 ${this.gpsLocation.lat.toFixed(6)}, ${this.gpsLocation.lng.toFixed(6)}`
              : 'Klik untuk mengambil lokasi otomatis'}
          </div>
        </div>

        <!-- Questions -->
        ${questions.map((q, index) => this.renderQuestion(q, index)).join('')}

        <!-- Submit Button -->
        <div class="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-surface-200">
          <button onclick="SurveyPage.submitSurvey()" class="btn-primary btn-lg w-full">
            Submit Survey
          </button>
        </div>
      </div>
    `;
  },

  renderQuestion(question, index) {
    const fieldId = `question_${question.id}`;
    const required = question.required ? '<span class="text-red-500">*</span>' : '';

    switch (question.type) {
      case 'text':
        return `
          <div class="form-field">
            <label class="input-label">${index + 1}. ${question.question_text} ${required}</label>
            <input type="text" id="${fieldId}" class="input" placeholder="Masukkan teks">
          </div>
        `;

      case 'number':
        return `
          <div class="form-field">
            <label class="input-label">${index + 1}. ${question.question_text} ${required}</label>
            <input type="number" id="${fieldId}" class="input" placeholder="Masukkan angka">
          </div>
        `;

      case 'textarea':
        return `
          <div class="form-field">
            <label class="input-label">${index + 1}. ${question.question_text} ${required}</label>
            <textarea id="${fieldId}" class="form-field-textarea" placeholder="Masukkan teks panjang"></textarea>
          </div>
        `;

      case 'date':
        return `
          <div class="form-field">
            <label class="input-label">${index + 1}. ${question.question_text} ${required}</label>
            <input type="date" id="${fieldId}" class="input">
          </div>
        `;

      case 'dropdown':
        const options = question.options ? question.options.split(',') : [];
        return `
          <div class="form-field">
            <label class="input-label">${index + 1}. ${question.question_text} ${required}</label>
            <select id="${fieldId}" class="input">
              <option value="">Pilih...</option>
              ${options.map(opt => `<option value="${opt.trim()}">${opt.trim()}</option>`).join('')}
            </select>
          </div>
        `;

      case 'checkbox':
        const checkOptions = question.options ? question.options.split(',') : [];
        return `
          <div class="form-field">
            <label class="input-label block mb-3">${index + 1}. ${question.question_text} ${required}</label>
            <div class="space-y-2">
              ${checkOptions.map((opt, i) => `
                <label class="flex items-center space-x-3 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 cursor-pointer">
                  <input type="checkbox" name="${fieldId}" value="${opt.trim()}" class="w-5 h-5 rounded text-primary-600">
                  <span class="text-gray-700">${opt.trim()}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `;

      case 'photo':
        return `
          <div class="form-field">
            <label class="input-label">${index + 1}. ${question.question_text} ${required}</label>
            <div class="photo-upload" id="photo-upload-${question.id}" onclick="SurveyPage.takePhoto('${question.id}')">
              ${this.photos[question.id] 
                ? `<img src="${this.photos[question.id]}" class="w-full h-48 object-cover rounded-lg">`
                : `<div class="text-gray-400">
                    <svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                    <p>Klik untuk mengambil foto</p>
                  </div>`
              }
            </div>
          </div>
        `;

      case 'gps':
        return `
          <div class="form-field">
            <label class="input-label">${index + 1}. ${question.question_text} ${required}</label>
            <button type="button" onclick="SurveyPage.getGPSForQuestion('${fieldId}')" class="btn-secondary btn-md w-full">
              📍 Ambil Koordinat
            </button>
            <input type="hidden" id="${fieldId}">
            <div id="${fieldId}_display" class="mt-2 text-sm text-gray-500"></div>
          </div>
        `;

      default:
        return `
          <div class="form-field">
            <label class="input-label">${index + 1}. ${question.question_text} ${required}</label>
            <input type="text" id="${fieldId}" class="input" placeholder="Masukkan jawaban">
          </div>
        `;
    }
  },

  getGPS() {
    const statusEl = document.getElementById('gps-status');
    statusEl.innerHTML = '<span class="text-primary-600">⏳ Mengambil lokasi...</span>';

    if (!navigator.geolocation) {
      statusEl.innerHTML = '<span class="text-red-500">GPS tidak didukung</span>';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.gpsLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        statusEl.innerHTML = `<span class="text-green-600">📍 ${this.gpsLocation.lat.toFixed(6)}, ${this.gpsLocation.lng.toFixed(6)}</span>`;
      },
      (error) => {
        statusEl.innerHTML = `<span class="text-red-500">Gagal mengambil lokasi: ${error.message}</span>`;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  getGPSForQuestion(fieldId) {
    const displayEl = document.getElementById(`${fieldId}_display`);
    const inputEl = document.getElementById(fieldId);
    displayEl.innerHTML = '<span class="text-primary-600">⏳ Mengambil lokasi...</span>';

    if (!navigator.geolocation) {
      displayEl.innerHTML = '<span class="text-red-500">GPS tidak didukung</span>';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
        inputEl.value = coords;
        displayEl.innerHTML = `<span class="text-green-600">📍 ${coords}</span>`;
      },
      (error) => {
        displayEl.innerHTML = `<span class="text-red-500">Gagal: ${error.message}</span>`;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  takePhoto(questionId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        // Compress and preview
        this.compressAndPreviewPhoto(file, questionId);
      }
    };
    
    input.click();
  },

  compressAndPreviewPhoto(file, questionId) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Resize to max 1024px
        const maxSize = 1024;
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to base64
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        this.photos[questionId] = compressedDataUrl;
        
        // Update UI
        const uploadEl = document.getElementById(`photo-upload-${questionId}`);
        if (uploadEl) {
          uploadEl.classList.add('has-photo');
          uploadEl.innerHTML = `<img src="${compressedDataUrl}" class="w-full h-48 object-cover rounded-lg">`;
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  async submitSurvey() {
    // Validate required fields
    const { questions } = AppState.currentForm;
    for (const q of questions) {
      if (q.required) {
        const el = document.getElementById(`question_${q.id}`);
        if (!el) continue;
        
        if (q.type === 'checkbox') {
          const checked = document.querySelectorAll(`input[name="question_${q.id}"]:checked`);
          if (checked.length === 0) {
            alert(`Mohon jawab: ${q.question_text}`);
            return;
          }
        } else if (!el.value) {
          alert(`Mohon jawab: ${q.question_text}`);
          el.focus();
          return;
        }
      }
    }

    this.showLoading(true);

    try {
      // Create survey
      const survey = await window.SurveyApp.Surveys.create({
        form_id: AppState.currentForm.id,
        user_id: AppState.currentUser.id,
        latitude: this.gpsLocation?.lat || null,
        longitude: this.gpsLocation?.lng || null
      });

      // Prepare answers
      const answers = [];
      for (const q of questions) {
        const fieldId = `question_${q.id}`;
        
        if (q.type === 'photo') {
          // Upload photo
          if (this.photos[q.id]) {
            const base64Data = this.photos[q.id].split(',')[1];
            const blob = this.base64ToBlob(base64Data, 'image/jpeg');
            const file = new File([blob], `photo_${q.id}.jpg`, { type: 'image/jpeg' });
            
            try {
              const photoUrl = await window.SurveyApp.Storage.uploadPhoto(
                file,
                AppState.currentUser.id
              );
              answers.push({
                survey_id: survey.id,
                question_id: q.id,
                answer: photoUrl
              });
            } catch (photoError) {
              console.error('Photo upload failed:', photoError);
              // Save base64 as fallback
              answers.push({
                survey_id: survey.id,
                question_id: q.id,
                answer: this.photos[q.id]
              });
            }
          }
        } else if (q.type === 'checkbox') {
          const checked = Array.from(document.querySelectorAll(`input[name="${fieldId}"]:checked`))
            .map(cb => cb.value)
            .join(', ');
          answers.push({
            survey_id: survey.id,
            question_id: q.id,
            answer: checked
          });
        } else {
          const el = document.getElementById(fieldId);
          answers.push({
            survey_id: survey.id,
            question_id: q.id,
            answer: el?.value || ''
          });
        }
      }

      // Save answers
      await window.SurveyApp.Answers.createMany(answers);

      // Show success
      this.showSuccess('Survey berhasil disubmit!');
      
      // Reset and go back
      this.gpsLocation = null;
      this.photos = {};
      Navigation.navigate('dashboard');
      
    } catch (error) {
      console.error('Submit error:', error);
      alert('Gagal submit survey: ' + error.message);
    }

    this.showLoading(false);
  },

  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  },

  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 left-4 right-4 z-50 p-4 rounded-xl bg-green-500 text-white animate-slide-down';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  showLoading(show) {
    const loader = document.getElementById('survey-loader');
    if (loader) loader.classList.toggle('hidden', !show);
  },

  backToForms() {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('survey-page').classList.remove('hidden');
    this.load();
  }
};

// Data Page
const DataPage = {
  filters: {
    search: '',
    formId: '',
    dateFrom: '',
    dateTo: ''
  },
  allSurveys: [],

  async load() {
    this.showLoading(true);
    try {
      const surveys = await window.SurveyApp.Surveys.getAll(
        AppState.currentUser.role === 'surveyor' 
          ? { userId: AppState.currentUser.id } 
          : {}
      );
      this.allSurveys = surveys;
      this.renderFilters();
      this.renderSurveys();
    } catch (error) {
      console.error('Data load error:', error);
    }
    this.showLoading(false);
  },

  renderFilters() {
    const container = document.getElementById('data-filters');
    if (!container) return;

    const forms = AppState.forms.length > 0 ? AppState.forms : [];

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Search -->
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" id="search-input" class="input pl-10" placeholder="Cari survey..." 
                 value="${this.filters.search}" oninput="DataPage.applyFilters()">
        </div>

        <!-- Form Filter (Admin only) -->
        ${AppState.currentUser.role === 'admin' ? `
          <select id="form-filter" class="input" onchange="DataPage.applyFilters()">
            <option value="">Semua Form</option>
            ${forms.map(f => `<option value="${f.id}" ${this.filters.formId === f.id ? 'selected' : ''}>${f.title}</option>`).join('')}
          </select>
        ` : ''}

        <!-- Date Range -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500">Dari Tanggal</label>
            <input type="date" id="date-from" class="input text-sm" value="${this.filters.dateFrom}" onchange="DataPage.applyFilters()">
          </div>
          <div>
            <label class="text-xs text-gray-500">Sampai Tanggal</label>
            <input type="date" id="date-to" class="input text-sm" value="${this.filters.dateTo}" onchange="DataPage.applyFilters()">
          </div>
        </div>
      </div>
    `;
  },

  applyFilters() {
    this.filters.search = document.getElementById('search-input')?.value || '';
    this.filters.formId = document.getElementById('form-filter')?.value || '';
    this.filters.dateFrom = document.getElementById('date-from')?.value || '';
    this.filters.dateTo = document.getElementById('date-to')?.value || '';

    let filtered = [...this.allSurveys];

    // Search filter
    if (this.filters.search) {
      const search = this.filters.search.toLowerCase();
      filtered = filtered.filter(s => 
        s.form?.title?.toLowerCase().includes(search) ||
        s.user?.name?.toLowerCase().includes(search) ||
        s.user?.email?.toLowerCase().includes(search)
      );
    }

    // Form filter
    if (this.filters.formId) {
      filtered = filtered.filter(s => s.form_id === this.filters.formId);
    }

    // Date filters
    if (this.filters.dateFrom) {
      filtered = filtered.filter(s => new Date(s.created_at) >= new Date(this.filters.dateFrom));
    }
    if (this.filters.dateTo) {
      filtered = filtered.filter(s => new Date(s.created_at) <= new Date(this.filters.dateTo + 'T23:59:59'));
    }

    this.renderSurveysList(filtered);
  },

  renderSurveys() {
    this.renderSurveysList(this.allSurveys);
  },

  renderSurveysList(surveys) {
    const container = document.getElementById('surveys-list');
    if (!container) return;

    if (surveys.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <div class="empty-state-title">Tidak Ada Data</div>
          <div class="empty-state-description">Belum ada survey yang sesuai dengan filter</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="space-y-3">
        ${surveys.map((survey, index) => `
          <div class="card animate-slide-up stagger-${index + 1}" onclick="DataPage.showDetail('${survey.id}')">
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h3 class="font-semibold text-gray-900">${survey.form?.title || 'Survey'}</h3>
                <p class="text-sm text-gray-500 mt-1">${survey.user?.name || survey.user?.email || 'Unknown'}</p>
                <div class="flex items-center gap-3 mt-2">
                  <span class="text-xs text-gray-400">${this.formatDate(survey.created_at)}</span>
                  ${survey.latitude ? `<span class="chip-primary text-xs">📍 Lokasi</span>` : ''}
                </div>
              </div>
              ${AppState.currentUser.role === 'admin' ? `
                <button onclick="event.stopPropagation(); DataPage.deleteSurvey('${survey.id}')" class="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async showDetail(surveyId) {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;

    try {
      const survey = await window.SurveyApp.Surveys.getById(surveyId);
      const answers = await window.SurveyApp.Answers.getBySurveyId(surveyId);

      document.getElementById('detail-content').innerHTML = `
        <div class="space-y-4">
          <div>
            <h3 class="font-bold text-lg">${survey.form?.title || 'Survey'}</h3>
            <p class="text-sm text-gray-500">${this.formatDate(survey.created_at)}</p>
          </div>

          ${survey.latitude ? `
            <div class="p-3 bg-surface-50 rounded-xl">
              <div class="text-sm text-gray-500">Lokasi</div>
              <div class="font-mono">${survey.latitude.toFixed(6)}, ${survey.longitude.toFixed(6)}</div>
            </div>
          ` : ''}

          <div class="divide-y divide-surface-100">
            ${answers.map(a => `
              <div class="py-3">
                <div class="text-sm text-gray-500 mb-1">${a.question?.question_text || 'Pertanyaan'}</div>
                ${a.question?.type === 'photo' && a.answer ? `
                  <img src="${a.answer}" class="w-full h-48 object-cover rounded-lg mt-2">
                ` : `
                  <div class="font-medium">${a.answer || '-'}</div>
                `}
              </div>
            `).join('')}
          </div>
        </div>
      `;

      modal.classList.remove('hidden');
    } catch (error) {
      console.error('Detail error:', error);
    }
  },

  async deleteSurvey(surveyId) {
    if (!confirm('Yakin hapus survey ini?')) return;

    try {
      await window.SurveyApp.Surveys.delete(surveyId);
      this.showSuccess('Survey dihapus');
      this.load();
    } catch (error) {
      console.error('Delete error:', error);
    }
  },

  exportData(format) {
    const data = this.allSurveys.map(s => ({
      'Form': s.form?.title || '',
      'User': s.user?.name || s.user?.email || '',
      'Tanggal': this.formatDate(s.created_at),
      'Latitude': s.latitude || '',
      'Longitude': s.longitude || ''
    }));

    if (format === 'csv') {
      this.exportCSV(data);
    } else if (format === 'excel') {
      this.exportExcel(data);
    }
  },

  exportCSV(data) {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportExcel(data) {
    // Simple HTML table export (can be opened in Excel)
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    let html = '<table border="1">';
    html += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    html += data.map(row => 
      '<tr>' + headers.map(h => `<td>${row[h] || ''}</td>`).join('') + '</tr>'
    ).join('');
    html += '</table>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey_export_${Date.now()}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  },

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 left-4 right-4 z-50 p-4 rounded-xl bg-green-500 text-white animate-slide-down';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  showLoading(show) {
    const loader = document.getElementById('data-loader');
    if (loader) loader.classList.toggle('hidden', !show);
  }
};

// Profile Page
const ProfilePage = {
  load() {
    const user = AppState.currentUser;
    if (!user) return;

    const container = document.getElementById('profile-content');
    if (!container) return;

    container.innerHTML = `
      <div class="text-center py-8">
        <div class="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <span class="text-3xl font-bold text-primary-600">${(user.name || user.email)[0].toUpperCase()}</span>
        </div>
        <h2 class="text-xl font-bold text-gray-900">${user.name || 'User'}</h2>
        <p class="text-gray-500">${user.email}</p>
        <span class="chip-primary mt-2">${user.role === 'admin' ? 'Admin' : 'Surveyor'}</span>
      </div>

      <div class="space-y-3">
        <div class="card">
          <div class="flex items-center justify-between py-2">
            <span class="text-gray-600">Total Survey</span>
            <span class="font-bold text-gray-900">${AppState.stats.total}</span>
          </div>
        </div>
        <div class="card">
          <div class="flex items-center justify-between py-2">
            <span class="text-gray-600">Survey Hari Ini</span>
            <span class="font-bold text-gray-900">${AppState.stats.today}</span>
          </div>
        </div>
      </div>

      <div class="mt-6">
        <button onclick="ProfilePage.logout()" class="btn-secondary btn-lg w-full text-red-600 hover:bg-red-50">
          Keluar
        </button>
      </div>
    `;
  },

  async logout() {
    try {
      await window.SurveyApp.Auth.signOut();
      Navigation.navigate('login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
};

// Login/Signup
const AuthPage = {
  async login(email, password) {
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      const data = await window.SurveyApp.Auth.signIn(email, password);
      // Auth listener will handle navigation
    } catch (error) {
      console.error('Login error:', error);
      alert('Login gagal: ' + error.message);
      btn.disabled = false;
      btn.innerHTML = 'Masuk';
    }
  },

  async signup(email, password, name) {
    const btn = document.getElementById('signup-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';

    try {
      console.log('[DEBUG] Starting signup for:', email);
      const data = await window.SurveyApp.Auth.signUp(email, password, {
        name,
        role: 'surveyor'
      });
      
      console.log('[DEBUG] Signup response:', JSON.stringify(data, null, 2));
      
      if (data.session) {
        alert('Registrasi berhasil! Anda akan diarahkan ke dashboard.');
      } else {
        // Check if user was created but needs email confirmation
        console.log('[DEBUG] No session, user created:', data.user);
        alert('Registrasi berhasil! Silakan verifikasi email Anda.');
      }
    } catch (error) {
      console.error('Signup error:', error);
      console.error('Error details:', error.message, error.status);
      alert('Registrasi gagal: ' + error.message);
      btn.disabled = false;
      btn.innerHTML = 'Daftar';
    }
  },

  toggleAuthMode() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    loginForm.classList.toggle('hidden');
    signupForm.classList.toggle('hidden');
  }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  Navigation.init();
  
  // Setup login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      AuthPage.login(email, password);
    });
  }

  // Setup signup form
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value;
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;
      AuthPage.signup(email, password, name);
    });
  }

  // Setup modal close
  const detailModal = document.getElementById('detail-modal');
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) {
        detailModal.classList.add('hidden');
      }
    });
  }

  // Setup survey form back button
  const backBtn = document.getElementById('survey-form-back');
  if (backBtn) {
    backBtn.addEventListener('click', () => SurveyPage.backToForms());
  }
});

// Make functions globally available
window.Navigation = Navigation;
window.Dashboard = Dashboard;
window.SurveyPage = SurveyPage;
window.DataPage = DataPage;
window.ProfilePage = ProfilePage;
window.AuthPage = AuthPage;
