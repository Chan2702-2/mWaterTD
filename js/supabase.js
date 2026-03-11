// Supabase Configuration
// Using CDN - no local credentials needed

// Get Supabase from global window object (loaded via CDN)
const supabase = window.supabase.createClient(
  'https://xmvikikzktwzsiuxqilw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdmlraWt6a3R3enNpdXhxaWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzg4MTMsImV4cCI6MjA4ODgxNDgxM30.L25WMkUsGOdMyskFQhisOjxTgjF6q6s5cOZ9Uj_AU1s'
);

// Database Schema Configuration
const DB_SCHEMA = {
  tables: {
    users: 'profiles',
    forms: 'forms',
    questions: 'questions',
    surveys: 'surveys',
    answers: 'answers'
  }
};

// Auth helpers
const Auth = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  async signUp(email, password, userData) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
};

// User/Profile helpers
const Users = {
  async getProfile(userId) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.users)
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.users)
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getSurveyors() {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.users)
      .select('*')
      .eq('role', 'surveyor');
    if (error) throw error;
    return data;
  }
};

// Form helpers
const Forms = {
  async create(formData) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.forms)
      .insert([formData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.forms)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(formId) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.forms)
      .select('*')
      .eq('id', formId)
      .single();
    if (error) throw error;
    return data;
  },

  async update(formId, updates) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.forms)
      .update(updates)
      .eq('id', formId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(formId) {
    // First delete all questions
    await supabase
      .from(DB_SCHEMA.tables.questions)
      .delete()
      .eq('form_id', formId);
    
    // Then delete the form
    const { error } = await supabase
      .from(DB_SCHEMA.tables.forms)
      .delete()
      .eq('id', formId);
    if (error) throw error;
  }
};

// Question helpers
const Questions = {
  async create(questionData) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.questions)
      .insert([questionData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createMany(questions) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.questions)
      .insert(questions)
      .select();
    if (error) throw error;
    return data;
  },

  async getByFormId(formId) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.questions)
      .select('*')
      .eq('form_id', formId)
      .order('id', { ascending: true });
    if (error) throw error;
    return data;
  },

  async update(questionId, updates) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.questions)
      .update(updates)
      .eq('id', questionId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(questionId) {
    const { error } = await supabase
      .from(DB_SCHEMA.tables.questions)
      .delete()
      .eq('id', questionId);
    if (error) throw error;
  }
};

// Survey helpers
const Surveys = {
  async create(surveyData) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.surveys)
      .insert([surveyData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAll(filters = {}) {
    let query = supabase
      .from(DB_SCHEMA.tables.surveys)
      .select(`
        *,
        form:forms(title),
        user:users(name, email)
      `)
      .order('created_at', { ascending: false });

    if (filters.formId) {
      query = query.eq('form_id', filters.formId);
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.dateFrom) {
      query = querygte('created_at', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getById(surveyId) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.surveys)
      .select(`
        *,
        form:forms(title),
        user:users(name, email)
      `)
      .eq('id', surveyId)
      .single();
    if (error) throw error;
    return data;
  },

  async getStats(userId = null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    let query = supabase
      .from(DB_SCHEMA.tables.surveys)
      .select('id, created_at', { count: 'exact' });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: allData, count: totalCount } = await query;

    const todayQuery = supabase
      .from(DB_SCHEMA.tables.surveys)
      .select('id', { count: 'exact' })
      .gte('created_at', todayStr);

    if (userId) {
      todayQuery.eq('user_id', userId);
    }

    const { count: todayCount } = await todayQuery;

    return {
      total: totalCount || 0,
      today: todayCount || 0
    };
  },

  async getToday(userId = null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    let query = supabase
      .from(DB_SCHEMA.tables.surveys)
      .select(`
        *,
        form:forms(title),
        user:users(name)
      `)
      .gte('created_at', todayStr)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async delete(surveyId) {
    // Delete answers first
    await supabase
      .from(DB_SCHEMA.tables.answers)
      .delete()
      .eq('survey_id', surveyId);

    // Then delete survey
    const { error } = await supabase
      .from(DB_SCHEMA.tables.surveys)
      .delete()
      .eq('id', surveyId);
    if (error) throw error;
  }
};

// Answer helpers
const Answers = {
  async create(answerData) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.answers)
      .insert([answerData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createMany(answers) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.answers)
      .insert(answers)
      .select();
    if (error) throw error;
    return data;
  },

  async getBySurveyId(surveyId) {
    const { data, error } = await supabase
      .from(DB_SCHEMA.tables.answers)
      .select(`
        *,
        question:questions(question_text, type)
      `)
      .eq('survey_id', surveyId);
    if (error) throw error;
    return data;
  }
};

// Storage helpers for photos
const Storage = {
  async uploadPhoto(file, userId) {
    const fileName = `${userId}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('survey-photos')
      .upload(fileName, file);
    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('survey-photos')
      .getPublicUrl(fileName);
    
    return publicUrl;
  },

  async deletePhoto(url) {
    // Extract file path from URL
    const path = url.split('/').slice(-2).join('/');
    const { error } = await supabase.storage
      .from('survey-photos')
      .remove([path]);
    if (error) throw error;
  }
};

// Export all helpers
window.SurveyApp = {
  supabase,
  Auth,
  Users,
  Forms,
  Questions,
  Surveys,
  Answers,
  Storage
};