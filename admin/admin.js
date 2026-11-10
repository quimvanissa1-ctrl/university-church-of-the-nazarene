(function () {
    const client = window.supabaseClient;
    const isAdminPage = document.body.dataset.adminPage;

    function isAdministrator(user) {
        const metadata = user && user.app_metadata;
        return Boolean(metadata && (metadata.role === 'admin' || (Array.isArray(metadata.roles) && metadata.roles.includes('admin'))));
    }

    function hasLeadersManagementPermission(user) {
        const metadata = user && user.app_metadata;
        if (!metadata) {
            return false;
        }

        if (isAdministrator(user)) {
            return true;
        }

        if (metadata.role === 'leaders_manager' || (Array.isArray(metadata.roles) && metadata.roles.includes('leaders_manager'))) {
            return true;
        }

        const permissions = metadata.permissions;
        if (Array.isArray(permissions)) {
            return permissions.includes('leaders_management');
        }
        if (permissions && typeof permissions === 'object') {
            return permissions.leaders_management === true;
        }
        return false;
    }

    function canAccessDashboard(user) {
        return isAdministrator(user) || hasLeadersManagementPermission(user);
    }

    function showMessage(element, message, isError) {
        if (!element) {
            return;
        }

        element.textContent = message;
        element.hidden = false;
        element.classList.toggle('is-error', Boolean(isError));
    }

    function setLoading(button, isLoading, label) {
        button.disabled = isLoading;
        button.classList.toggle('is-loading', isLoading);
        button.querySelector('.button-label').textContent = isLoading ? label : button.dataset.idleLabel;
    }

    function setView(viewName) {
        ['login-view', 'reset-request-view', 'reset-password-view'].forEach(function (id) {
            const element = document.getElementById(id);
            if (element) {
                element.hidden = id !== viewName;
            }
        });
    }

    function initializeLogin() {
        const loginMessage = document.getElementById('login-message');
        const resetMessage = document.getElementById('reset-message');
        const passwordMessage = document.getElementById('new-password-message');
        const loginForm = document.getElementById('login-form');
        const resetRequestForm = document.getElementById('reset-request-form');
        const resetPasswordForm = document.getElementById('reset-password-form');
        const loginButton = document.getElementById('login-button');
        const resetButton = document.getElementById('reset-button');
        const updatePasswordButton = document.getElementById('update-password-button');

        [loginButton, resetButton, updatePasswordButton].forEach(function (button) {
            button.dataset.idleLabel = button.querySelector('.button-label').textContent;
        });

        document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
            button.addEventListener('click', function () {
                const input = document.getElementById(button.dataset.passwordToggle);
                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                button.textContent = show ? 'Hide' : 'Show';
                button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
            });
        });

        document.querySelector('[data-show-reset]').addEventListener('click', function () {
            setView('reset-request-view');
            document.getElementById('reset-email').value = document.getElementById('email').value;
            resetMessage.hidden = true;
        });

        document.querySelector('[data-show-login]').addEventListener('click', function () {
            setView('login-view');
            loginMessage.hidden = true;
        });

        loginForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            loginMessage.hidden = true;

            if (!client) {
                showMessage(loginMessage, window.supabaseConfigError || 'Supabase is not configured.', true);
                return;
            }

            setLoading(loginButton, true, 'Signing in…');
            const formData = new FormData(loginForm);
            let result;
            try {
                result = await client.auth.signInWithPassword({
                    email: formData.get('email').trim(),
                    password: formData.get('password')
                });
            } catch (error) {
                setLoading(loginButton, false);
                showMessage(loginMessage, error.message || 'Unable to sign in. Please try again.', true);
                return;
            }
            setLoading(loginButton, false);

            if (result.error) {
                showMessage(loginMessage, result.error.message || 'Unable to sign in. Please check your credentials.', true);
                return;
            }

            if (!canAccessDashboard(result.data.user)) {
                let error;
                try {
                    ({ error } = await client.auth.signOut());
                } catch (signOutError) {
                    error = signOutError;
                }
                if (error) {
                    showMessage(loginMessage, 'This account does not have admin or Leaders Management access, and its session could not be cleared. Please close this page and contact an administrator.', true);
                    return;
                }
                showMessage(loginMessage, 'This account does not have admin or Leaders Management access.', true);
                return;
            }

            showMessage(loginMessage, 'Sign in successful. Opening the dashboard…', false);
            window.location.replace('dashboard.html');
        });

        resetRequestForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            resetMessage.hidden = true;

            if (!client) {
                showMessage(resetMessage, window.supabaseConfigError || 'Supabase is not configured.', true);
                return;
            }

            setLoading(resetButton, true, 'Sending…');
            const email = new FormData(resetRequestForm).get('email').trim();
            let error;
            try {
                ({ error } = await client.auth.resetPasswordForEmail(email, {
                    redirectTo: new URL('login.html', window.location.href).toString()
                }));
            } catch (requestError) {
                setLoading(resetButton, false);
                showMessage(resetMessage, requestError.message || 'Unable to send a password reset email.', true);
                return;
            }
            setLoading(resetButton, false);

            if (error) {
                showMessage(resetMessage, error.message || 'Unable to send a password reset email.', true);
                return;
            }

            showMessage(resetMessage, 'If an account exists for this address, a password reset link is on its way.', false);
        });

        resetPasswordForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            passwordMessage.hidden = true;

            const password = document.getElementById('new-password').value;
            const confirmation = document.getElementById('confirm-password').value;
            if (password !== confirmation) {
                showMessage(passwordMessage, 'The passwords do not match.', true);
                return;
            }

            if (!client) {
                showMessage(passwordMessage, window.supabaseConfigError || 'Supabase is not configured.', true);
                return;
            }

            setLoading(updatePasswordButton, true, 'Updating…');
            let error;
            try {
                ({ error } = await client.auth.updateUser({ password: password }));
            } catch (updateError) {
                setLoading(updatePasswordButton, false);
                showMessage(passwordMessage, updateError.message || 'Unable to update the password.', true);
                return;
            }
            setLoading(updatePasswordButton, false);

            if (error) {
                showMessage(passwordMessage, error.message || 'Unable to update the password.', true);
                return;
            }

            let signOutError;
            try {
                ({ error: signOutError } = await client.auth.signOut());
            } catch (error) {
                signOutError = error;
            }
            setView('login-view');
            showMessage(loginMessage, signOutError
                ? 'Your password was updated, but this session could not be closed. Sign out before using the new password.'
                : 'Your password has been updated. Sign in with your new password.', Boolean(signOutError));
        });

        document.querySelectorAll('.primary-button').forEach(function (button) {
            button.dataset.idleLabel = button.querySelector('.button-label').textContent;
        });

        if (!client) {
            showMessage(loginMessage, window.supabaseConfigError || 'Supabase is not configured.', true);
            document.querySelectorAll('.primary-button').forEach(function (button) {
                button.disabled = true;
            });
            return;
        }

        client.auth.onAuthStateChange(function (event) {
            if (event === 'PASSWORD_RECOVERY') {
                setView('reset-password-view');
            }
        });

        client.auth.getSession().then(async function (result) {
            if (result.error || !result.data.session) {
                return;
            }

            const userResult = await client.auth.getUser();
            if (userResult.data.user && canAccessDashboard(userResult.data.user)) {
                window.location.replace('dashboard.html');
            } else if (userResult.data.user) {
                showMessage(loginMessage, 'This account does not have admin or Leaders Management access.', true);
            }
        }).catch(function () {
            showMessage(loginMessage, 'Could not verify your existing session. Please try signing in again.', true);
        });

        if (new URLSearchParams(window.location.search).has('unauthorized')) {
            showMessage(loginMessage, 'Admin or Leaders Management access is required to open the dashboard.', true);
        } else if (new URLSearchParams(window.location.search).has('session')) {
            showMessage(loginMessage, 'Your session could not be verified. Please sign in again.', true);
        }
    }

    async function initializeDashboard() {
        if (!client) {
            window.location.replace('login.html');
            return;
        }

        let result;
        try {
            result = await client.auth.getUser();
        } catch (error) {
            window.location.replace('login.html?session=error');
            return;
        }

        const { data, error } = result;
        if (error || !data.user) {
            window.location.replace('login.html');
            return;
        }

        if (!canAccessDashboard(data.user)) {
            try {
                await client.auth.signOut();
            } catch (signOutError) {
                console.error('Unable to clear non-admin session:', signOutError);
            }
            window.location.replace('login.html?unauthorized=1');
            return;
        }

        document.getElementById('admin-email').textContent = data.user.email || 'Administrator';
        const canManageLeaders = hasLeadersManagementPermission(data.user);
        const leadersNavigationItem = document.querySelector('[data-section="Leaders Management"]');
        if (leadersNavigationItem) {
            leadersNavigationItem.classList.toggle('is-locked', !canManageLeaders);
            leadersNavigationItem.setAttribute('aria-label', canManageLeaders
                ? 'Leaders Management'
                : 'Leaders Management, locked: permission required');
        }

        client.auth.onAuthStateChange(function (event) {
            if (event === 'SIGNED_OUT') {
                window.location.replace('login.html');
            }
        });

        document.getElementById('logout-button').addEventListener('click', async function (event) {
            const button = event.currentTarget;
            button.disabled = true;
            button.textContent = 'Signing out…';
            let signOutError;
            try {
                ({ error: signOutError } = await client.auth.signOut());
            } catch (error) {
                signOutError = error;
            }
            if (signOutError) {
                button.disabled = false;
                button.textContent = 'Log out';
                window.alert('Unable to log out. Please try again.');
            } else {
                window.location.replace('login.html');
            }
        });

        const sidebar = document.getElementById('admin-sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        const menuToggle = document.getElementById('menu-toggle');

        function closeSidebar() {
            sidebar.classList.remove('is-open');
            backdrop.classList.remove('is-open');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', 'Open navigation');
        }

        menuToggle.addEventListener('click', function () {
            const isOpen = sidebar.classList.toggle('is-open');
            backdrop.classList.toggle('is-open', isOpen);
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
        });

        backdrop.addEventListener('click', closeSidebar);

        document.querySelectorAll('[data-section]').forEach(function (item) {
            item.addEventListener('click', function () {
                document.querySelectorAll('[data-section]').forEach(function (navItem) {
                    navItem.classList.toggle('is-active', navItem === item);
                });
                const section = item.dataset.section;
                const isEventsSection = section === 'Events';
                const isEventFormsSection = section === 'Event Forms';
                const isHomepageSection = section === 'Homepage';
                const isLeadersSection = section === 'Leaders Management';
                const showLeadersManagement = isLeadersSection && canManageLeaders;
                document.getElementById('placeholder-card').hidden =
                    isEventsSection || isEventFormsSection || isHomepageSection || showLeadersManagement || (isLeadersSection && !canManageLeaders);
                document.getElementById('events-management').hidden = !isEventsSection;
                document.getElementById('event-forms-management').hidden = !isEventFormsSection;
                document.getElementById('homepage-management').hidden = !isHomepageSection;
                document.getElementById('leaders-management').hidden = !showLeadersManagement;
                document.getElementById('leaders-management-locked').hidden = !isLeadersSection || canManageLeaders;
                document.getElementById('section-title').textContent = section;
                document.getElementById('placeholder-title').textContent = section === 'Dashboard' ? 'Your website workspace' : section;
                document.getElementById('placeholder-copy').textContent = section === 'Dashboard'
                    ? 'Choose a section from the navigation to manage it. Content tools are not enabled yet.'
                    : 'Management tools for this section will be added after the authentication flow is complete.';
                if (isEventsSection && typeof window.initializeEventsManagement === 'function') {
                    window.initializeEventsManagement();
                }
                if (isEventFormsSection && typeof window.initializeEventFormsManagement === 'function') {
                    window.initializeEventFormsManagement();
                }
                if (isHomepageSection && typeof window.initializeHomepageManagement === 'function') {
                    window.initializeHomepageManagement();
                }
                if (showLeadersManagement && typeof window.initializeLeadersManagement === 'function') {
                    window.initializeLeadersManagement();
                }
                closeSidebar();
            });
        });
    }

    if (isAdminPage === 'login') {
        initializeLogin();
    } else if (isAdminPage === 'dashboard') {
        initializeDashboard();
    }
})();
