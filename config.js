// Supabase Configuration
// IMPORTANT: Replace these with your actual Supabase credentials
// You can find them in your Supabase project settings: https://app.supabase.com/project/_/settings/api
const SUPABASE_CONFIG = {
    url: 'YOUR_SUPABASE_URL', // e.g., 'https://xxxxx.supabase.co'
    anonKey: 'YOUR_SUPABASE_ANON_KEY' // Your Supabase anon/public key (safe to expose in client-side code)
};

// Initialize Supabase client (works in browser)
let supabaseClient = null;
if (typeof supabase !== 'undefined' && SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_URL') {
    try {
        supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('Supabase client initialized');
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
    }
} else if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL') {
    console.warn('⚠️ Please configure your Supabase credentials in config.js');
}

// Make it globally available
window.supabaseClient = supabaseClient;
