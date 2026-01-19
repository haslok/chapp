// Supabase Configuration
const SUPABASE_CONFIG = {
    url: 'https://gptlsxdpisuamuzueogg.supabase.co',
    anonKey: 'sb_publishable_HF3kZIX5QIKhQpePlBYeOg_VxBruKF3'
};

// Make config globally available
window.SUPABASE_CONFIG = SUPABASE_CONFIG;

// Initialize Supabase client (works in browser)
let supabaseClient = null;

// Wait for Supabase SDK to load, then initialize
function initSupabase() {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        try {
            supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log('✅ Supabase client initialized successfully');
            window.supabaseClient = supabaseClient;
        } catch (error) {
            console.error('❌ Failed to initialize Supabase client:', error);
            window.supabaseClient = null;
        }
    } else {
        // Retry after a short delay if Supabase SDK hasn't loaded yet
        setTimeout(initSupabase, 100);
    }
}

// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
} else {
    initSupabase();
}

// Make it globally available immediately (will be set when initialized)
window.supabaseClient = supabaseClient;
