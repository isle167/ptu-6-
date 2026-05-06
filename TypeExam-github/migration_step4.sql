-- ============================================
-- TypeExam 전체 RLS 정책 + profiles is_admin
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. profiles 테이블 is_admin 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 2. words 테이블 RLS (공개 읽기 허용)
-- ============================================
ALTER TABLE words ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "words_select_public" ON words;
DROP POLICY IF EXISTS "words_insert_auth" ON words;
DROP POLICY IF EXISTS "words_update_admin" ON words;
DROP POLICY IF EXISTS "words_delete_admin" ON words;

-- 비로그인 포함 누구나 읽기 가능
CREATE POLICY "words_select_public" ON words
  FOR SELECT USING (true);

-- 로그인한 유저는 커스텀 단어 추가 가능
CREATE POLICY "words_insert_auth" ON words
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 관리자만 수정
CREATE POLICY "words_update_admin" ON words
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 관리자만 삭제
CREATE POLICY "words_delete_admin" ON words
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- 3. past_exams 테이블 RLS (공개 읽기 허용)
-- ============================================
ALTER TABLE past_exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "past_exams_select_public" ON past_exams;
DROP POLICY IF EXISTS "past_exams_update_admin" ON past_exams;
DROP POLICY IF EXISTS "past_exams_delete_admin" ON past_exams;

CREATE POLICY "past_exams_select_public" ON past_exams
  FOR SELECT USING (true);

CREATE POLICY "past_exams_update_admin" ON past_exams
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "past_exams_delete_admin" ON past_exams
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- 4. profiles 테이블 RLS
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 5. wrong_notes 테이블 RLS (본인 것만)
-- ============================================
ALTER TABLE wrong_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wrong_notes_own" ON wrong_notes;

CREATE POLICY "wrong_notes_own" ON wrong_notes
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 6. game_records 테이블 RLS (본인 것만)
-- ============================================
ALTER TABLE game_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_records_own" ON game_records;

CREATE POLICY "game_records_own" ON game_records
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 7. 최초 관리자 지정 (본인 이메일로 교체)
-- ============================================
-- UPDATE profiles
--   SET is_admin = true
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
