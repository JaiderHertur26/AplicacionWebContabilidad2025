import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wiwchscykwseungpqlco.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpd2Noc2N5a3dzZXVuZ3BxbGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5NDQ4NTAsImV4cCI6MjA3NzUyMDg1MH0.zqoJOfQ_gsG7CUqSaGskaHY3JHa-f3Wp4MsinJE78j8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);