(function () {
    const client = window.supabaseClient;

    function safeHttpsUrl(value) {
        if (typeof value !== 'string' || value.trim() === '') {
            return null;
        }

        try {
            const url = new URL(value.trim());
            return url.protocol === 'https:' ? url.href : null;
        } catch (error) {
            return null;
        }
    }

    function getPhotoUrl(imageUrl) {
        if (!imageUrl) {
            return '';
        }
        if (/^https:\/\//i.test(imageUrl)) {
            return safeHttpsUrl(imageUrl) || '';
        }
        return client.storage.from('leader-photos').getPublicUrl(imageUrl).data.publicUrl;
    }

    function appendText(parent, tagName, className, text) {
        if (!text) {
            return null;
        }
        const element = document.createElement(tagName);
        if (className) {
            element.className = className;
        }
        element.textContent = text;
        parent.appendChild(element);
        return element;
    }

    function appendExternalLink(parent, label, url) {
        const safeUrl = safeHttpsUrl(url);
        if (!safeUrl) {
            return;
        }
        const link = document.createElement('a');
        link.href = safeUrl;
        link.textContent = label;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        parent.appendChild(link);
    }

    function renderLeader(leader) {
        const card = document.createElement('article');
        card.className = 'card leader-card';

        const avatar = document.createElement('div');
        avatar.className = 'leader-avatar';
        if (leader.image_url) {
            const image = document.createElement('img');
            image.src = getPhotoUrl(leader.image_url);
            image.alt = leader.name + ' profile photograph';
            image.loading = 'lazy';
            avatar.appendChild(image);
        } else {
            avatar.setAttribute('aria-hidden', 'true');
            avatar.textContent = '👤';
        }

        card.appendChild(avatar);
        appendText(card, 'h3', '', leader.name);
        appendText(card, 'p', 'leader-role', leader.position);
        appendText(card, 'p', 'leader-department', leader.department);
        appendText(card, 'p', 'leader-biography', leader.biography);

        const contact = document.createElement('div');
        contact.className = 'leader-contact';
        if (leader.email) {
            const email = document.createElement('a');
            email.href = 'mailto:' + leader.email;
            email.textContent = leader.email;
            contact.appendChild(email);
        }
        if (leader.phone) {
            const phone = document.createElement('a');
            phone.href = 'tel:' + leader.phone.replace(/[^\d+*#,;]/g, '');
            phone.textContent = leader.phone;
            contact.appendChild(phone);
        }
        if (contact.childElementCount) {
            card.appendChild(contact);
        }

        if (leader.social_links && typeof leader.social_links === 'object' && !Array.isArray(leader.social_links)) {
            const socialLinks = document.createElement('div');
            socialLinks.className = 'leader-social-links';
            Object.keys(leader.social_links).forEach(function (label) {
                const readableLabel = label.replace(/_/g, ' ').replace(/\b[a-z]/g, function (letter) {
                    return letter.toUpperCase();
                });
                appendExternalLink(socialLinks, readableLabel, leader.social_links[label]);
            });
            if (socialLinks.childElementCount) {
                card.appendChild(socialLinks);
            }
        }

        return card;
    }

    async function loadLeaders() {
        const status = document.getElementById('leaders-page-status');
        const grid = document.getElementById('leaders-grid');
        grid.setAttribute('aria-busy', 'true');

        try {
            if (!client) {
                throw new Error(window.supabaseConfigError || 'Supabase is not configured.');
            }

            const result = await client
                .from('leaders')
                .select('name, position, biography, department, image_url, email, phone, social_links')
                .eq('is_published', true)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: true });

            if (result.error) {
                throw result.error;
            }

            const leaders = result.data || [];
            grid.replaceChildren.apply(grid, leaders.map(renderLeader));
            status.textContent = leaders.length
                ? ''
                : 'Our leadership team profiles are coming soon.';
            status.hidden = leaders.length > 0;
        } catch (error) {
            console.error('Unable to load published leaders from Supabase.', error);
            grid.replaceChildren();
            status.textContent = 'Our leadership profiles are temporarily unavailable. Please try again later.';
            status.hidden = false;
        } finally {
            grid.setAttribute('aria-busy', 'false');
        }
    }

    document.addEventListener('DOMContentLoaded', loadLeaders);
})();
