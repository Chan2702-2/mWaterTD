-- Survey Pro Database Setup Script
-- Run this in Supabase SQL Editor

-- 1. Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'surveyor' CHECK (role IN ('admin', 'surveyor')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create forms table
CREATE TABLE IF NOT EXISTS public.forms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'textarea', 'date', 'dropdown', 'checkbox', 'photo', 'gps')),
  options TEXT, -- Comma-separated for dropdown/checkbox
  required BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create surveys table
CREATE TABLE IF NOT EXISTS public.surveys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES public.forms(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create answers table
CREATE TABLE IF NOT EXISTS public.answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id UUID REFERENCES public.surveys(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  answer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Create Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create Policies for forms
CREATE POLICY "Anyone can view forms" ON public.forms
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert forms" ON public.forms
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update forms" ON public.forms
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete forms" ON public.forms
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create Policies for questions
CREATE POLICY "Anyone can view questions" ON public.questions
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert questions" ON public.questions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update questions" ON public.questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete questions" ON public.questions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create Policies for surveys
CREATE POLICY "Anyone can view surveys" ON public.surveys
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert surveys" ON public.surveys
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own surveys" ON public.surveys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own surveys" ON public.surveys
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete all surveys" ON public.surveys
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create Policies for answers
CREATE POLICY "Anyone can view answers" ON public.answers
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert answers" ON public.answers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_questions_form_id ON public.questions(form_id);
CREATE INDEX IF NOT EXISTS idx_surveys_form_id ON public.surveys(form_id);
CREATE INDEX IF NOT EXISTS idx_surveys_user_id ON public.surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON public.surveys(created_at);
CREATE INDEX IF NOT EXISTS idx_answers_survey_id ON public.answers(survey_id);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON public.answers(question_id);

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_file_types)
VALUES ('survey-photos', 'survey-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view survey photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'survey-photos');

CREATE POLICY "Authenticated users can upload survey photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'survey-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own survey photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'survey-photos' AND auth.uid() IS NOT NULL);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'surveyor')
  );
  RETURN NEW;
END;
