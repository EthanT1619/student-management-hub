-- Seed: initial tags (run after 001_mvp_schema.sql)

insert into public.tags (name, category, sort_order) values
  ('Vocabulary', 'academic', 10),
  ('Grammar', 'academic', 20),
  ('Reading', 'academic', 30),
  ('Speaking', 'academic', 40),
  ('Writing', 'academic', 50),
  ('Phonics', 'academic', 60),
  ('Homework', 'learning_management', 70),
  ('Study Habit', 'learning_management', 80),
  ('Attitude', 'classroom_state', 90),
  ('Concentration', 'classroom_state', 100),
  ('Confidence', 'classroom_state', 110),
  ('Emotional', 'classroom_state', 120)
on conflict (name) do nothing;
