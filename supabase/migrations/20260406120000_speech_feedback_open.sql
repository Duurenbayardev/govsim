-- Санал хүсэлтийн горимд гар өргөхийг түр хаах/нээх (F товч)
alter table public.sessions
  add column if not exists speech_feedback_open boolean not null default true;
