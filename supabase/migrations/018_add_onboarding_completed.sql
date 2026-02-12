-- Adiciona flag de onboarding
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
