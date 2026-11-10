(function () {
    // These are public browser values. Deployments may inject them from environment variables.
    const suppliedConfig = window.SUPABASE_CONFIG || {
        url: 'https://fjiqsltkelhcoobbffke.supabase.co',
        anonKey: 'sb_publishable_XtXbf5cae6Tj5-vE6A-UKQ_Jb64iGvP'
    };
    const config = {
        url: suppliedConfig.url || '',
        anonKey: suppliedConfig.anonKey || ''
    };

    window.supabaseClient = null;
    window.supabaseConfigError = '';

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        window.supabaseConfigError = 'Supabase client library did not load.';
        return;
    }

    if (!config.url || !config.anonKey) {
        window.supabaseConfigError = 'Configure SUPABASE_CONFIG with your Supabase URL and public anon key.';
        return;
    }

    window.supabaseClient = window.supabase.createClient(config.url, config.anonKey);
})();
