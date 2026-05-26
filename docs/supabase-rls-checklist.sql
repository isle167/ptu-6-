-- TypeExam v2 production RLS checklist
-- Run in Supabase SQL editor after confirming table/column names.

alter table public.profiles enable row level security;
alter table public.wrong_notes enable row level security;
alter table public.game_records enable row level security;
alter table public.words enable row level security;
alter table public.past_exams enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "wrong_notes_crud_own" on public.wrong_notes;
create policy "wrong_notes_crud_own"
on public.wrong_notes for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "game_records_crud_own" on public.game_records;
create policy "game_records_crud_own"
on public.game_records for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "words_select_public_or_own" on public.words;
create policy "words_select_public_or_own"
on public.words for select
to authenticated
using (is_custom = false or created_by = auth.uid());

drop policy if exists "words_insert_custom_own" on public.words;
create policy "words_insert_custom_own"
on public.words for insert
to authenticated
with check (is_custom = true and created_by = auth.uid());

drop policy if exists "words_update_custom_own" on public.words;
create policy "words_update_custom_own"
on public.words for update
to authenticated
using (is_custom = true and created_by = auth.uid())
with check (is_custom = true and created_by = auth.uid());

drop policy if exists "words_delete_custom_own" on public.words;
create policy "words_delete_custom_own"
on public.words for delete
to authenticated
using (is_custom = true and created_by = auth.uid());

drop policy if exists "past_exams_select_authenticated" on public.past_exams;
create policy "past_exams_select_authenticated"
on public.past_exams for select
to authenticated
using (true);
