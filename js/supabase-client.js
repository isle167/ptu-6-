// ============================================
// Supabase 클라이언트 초기화
// ============================================

const SUPABASE_URL = 'https://cubiyguqiszyqrxooqfb.supabase.co/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Yml5Z3VxaXN6eXFyeG9vcWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTY0MzcsImV4cCI6MjA5MjkzMjQzN30.-GcphLX_Yvqqld396KXcUK9wuJZpAnYZ3AxyRfhqqyo';

// Supabase 클라이언트 생성
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
