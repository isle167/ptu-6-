// ============================================
// Supabase 클라이언트 초기화 (필기)
// ============================================
const SUPABASE_URL = 'https://cubiyguqiszyqrxooqfb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1Yml5Z3VxaXN6eXFyeG9vcWZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTY0MzcsImV4cCI6MjA5MjkzMjQzN30.-GcphLX_Yvqqld396KXcUK9wuJZpAnYZ3AxyRfhqqyo';
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
 
// ============================================
// Supabase 클라이언트 초기화 (실기)
// ============================================
const SUPABASE_URL_PRACTICAL = 'https://xuyurqkszcpfapgwoymg.supabase.co';
const SUPABASE_ANON_KEY_PRACTICAL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eXVycWtzemNwZmFwZ3dveW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NTA0MDUsImV4cCI6MjA5MzEyNjQwNX0.4FWYVzkbVfGyINIVF6LzaPZjFL4MWnd90-AQPGd_9lg';
 
const supabaseClientPractical = window.supabase.createClient(SUPABASE_URL_PRACTICAL, SUPABASE_ANON_KEY_PRACTICAL);
 
console.log('✅ Supabase 클라이언트 초기화 완료 (필기 + 실기)');