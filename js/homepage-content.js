(function () {
    const client = window.supabaseClient;

    function setText(root, selector, value) {
        const element = root.querySelector(selector);
        if (element && typeof value === 'string') {
            element.textContent = value;
            element.hidden = value.length === 0;
        }
    }

    function isSafeLink(value) {
        if (typeof value !== 'string' || value.trim() === '') {
            return false;
        }

        const link = value.trim();
        return /^(https?:\/\/|\/|\.\/|\.\.\/|#)/i.test(link) && !/^javascript:/i.test(link);
    }

    function setLink(root, selector, text, url) {
        const link = root.querySelector(selector);
        if (!link) {
            return;
        }
        link.textContent = typeof text === 'string' ? text : '';
        link.hidden = !link.textContent || !isSafeLink(url);
        if (!link.hidden) {
            link.setAttribute('href', url.trim());
        }
    }

    function setSectionVisibility(section, isPublished) {
        const element = document.querySelector('[data-home-section="' + section + '"]');
        if (element) {
            element.hidden = !isPublished;
        }
    }

    function hasContent(item) {
        return item && Object.keys(item).some(function (key) {
            return typeof item[key] === 'string' && item[key].trim() !== '';
        });
    }

    function renderHero(content) {
        const section = document.querySelector('[data-home-section="hero"]');
        if (!section) return;
        setText(section, 'h1', content.title);
        setText(section, '.subtitle', content.subtitle);
        setLink(section, '.btn:nth-of-type(1)', content.primary_button_text, content.primary_button_url);
        setLink(section, '.btn:nth-of-type(2)', content.secondary_button_text, content.secondary_button_url);
    }

    function renderTheme(content) {
        const section = document.querySelector('[data-home-section="theme"]');
        if (!section) return;
        setText(section, '.theme-label', content.label);
        setText(section, 'h2', content.title);
        setText(section, '.theme-verse', content.verse);
        setText(section, '.theme-signature strong', content.citation);
    }

    function renderAbout(content) {
        const section = document.querySelector('[data-home-section="about"]');
        if (!section) return;
        setText(section, '.section-title', content.title);
        setText(section, '.section-intro', content.intro);

        const grid = section.querySelector('.about-grid');
        if (grid && Array.isArray(content.cards)) {
            const cards = content.cards.filter(hasContent).map(function (item) {
                const card = document.createElement('article');
                card.className = 'card about-card';
                const badge = document.createElement('div');
                badge.className = 'card-badge';
                badge.textContent = item.badge || '';
                const title = document.createElement('h3');
                title.textContent = item.title || '';
                const description = document.createElement('p');
                description.textContent = item.description || '';
                card.append(badge, title, description);
                return card;
            });
            grid.replaceChildren.apply(grid, cards);
            grid.hidden = cards.length === 0;
        }

        setText(section, '.about-footer h3', content.footer_title);
        setText(section, '.about-footer p', content.footer_description);
    }

    function renderEditorialSection(content, sectionId) {
        const section = document.querySelector('[data-home-section="' + sectionId + '"]');
        if (!section) return;
        setText(section, '.section-title', content.title);
        setText(section, '.section-copy p', content.content);
    }

    function renderSermons(content) {
        const section = document.querySelector('[data-home-section="sermons"]');
        if (!section) return;
        setText(section, '.section-title', content.title);
        setText(section, '.section-intro', content.intro);

        const iframe = section.querySelector('iframe');
        const playlistUrl = typeof content.playlist_url === 'string' ? content.playlist_url.trim() : '';
        let safePlaylistUrl = '';
        try {
            const parsed = new URL(playlistUrl);
            if (parsed.protocol === 'https:' && ['youtube.com', 'www.youtube.com'].includes(parsed.hostname)) {
                safePlaylistUrl = parsed.href;
            }
        } catch (error) {
            safePlaylistUrl = '';
        }
        if (iframe) {
            iframe.hidden = !safePlaylistUrl;
            if (safePlaylistUrl) iframe.src = safePlaylistUrl;
            else iframe.removeAttribute('src');
        }

        setText(section, '.playlist-actions p', content.info_text);
        setLink(section, '.playlist-actions .btn', content.button_text, content.button_url);
    }

    function createAction(text, url, className) {
        if (!text || !isSafeLink(url)) return null;
        const link = document.createElement('a');
        link.className = className;
        link.textContent = text;
        link.href = url.trim();
        return link;
    }

    function renderServices(content) {
        const section = document.querySelector('[data-home-section="services"]');
        if (!section) return;
        setText(section, '.section-title', content.title);
        setText(section, '.section-intro', content.intro);

        const grid = section.querySelector('.grid');
        if (grid && Array.isArray(content.items)) {
            const cards = content.items.filter(hasContent).map(function (item) {
                const card = document.createElement('article');
                card.className = 'card';
                if (item.title) {
                    const title = document.createElement('h3');
                    title.textContent = item.title;
                    card.appendChild(title);
                }
                if (item.time) {
                    const time = document.createElement('p');
                    const strong = document.createElement('strong');
                    strong.textContent = item.time;
                    time.appendChild(strong);
                    card.appendChild(time);
                }
                if (item.description) {
                    const description = document.createElement('p');
                    description.textContent = item.description;
                    card.appendChild(description);
                }

                const actions = [
                    createAction(item.action1_text, item.action1_url, 'btn btn-primary'),
                    createAction(item.action2_text, item.action2_url, 'btn btn-secondary')
                ].filter(Boolean);
                if (actions.length) {
                    const actionContainer = document.createElement('div');
                    actionContainer.className = 'card-actions';
                    actions.forEach(function (action) { actionContainer.appendChild(action); });
                    card.appendChild(actionContainer);
                }
                return card;
            });
            grid.replaceChildren.apply(grid, cards);
            grid.hidden = cards.length === 0;
        }

        const infoPanel = section.querySelector('.info-panel');
        if (infoPanel) {
            const paragraph = infoPanel.querySelector('p');
            if (paragraph && typeof content.info_text === 'string') {
                paragraph.textContent = content.info_text;
                paragraph.hidden = !content.info_text;
            }
            setLink(infoPanel, '.btn', content.info_link_text, content.info_link_url);
            infoPanel.hidden = !content.info_text && !content.info_link_text;
        }
    }

    function renderMinistries(content) {
        const section = document.querySelector('[data-home-section="ministries"]');
        if (!section) return;
        const grid = section.querySelector('.grid');
        if (grid && Array.isArray(content.items)) {
            const cards = content.items.filter(hasContent).map(function (item) {
                const card = document.createElement('article');
                card.className = 'card';
                const title = document.createElement('h3');
                title.textContent = item.title || '';
                const description = document.createElement('p');
                description.textContent = item.description || '';
                card.append(title, description);
                const action = createAction(item.button_text, item.button_url, 'button');
                if (action) card.appendChild(action);
                return card;
            });
            grid.replaceChildren.apply(grid, cards);
            grid.hidden = cards.length === 0;
        }
        setLink(section, '.info-panel .btn', content.all_link_text, content.all_link_url);
        const infoPanel = section.querySelector('.info-panel');
        if (infoPanel) infoPanel.hidden = !content.all_link_text;
    }

    function renderLeaders(content) {
        const section = document.querySelector('[data-home-section="leaders"]');
        if (!section) return;
        const grid = section.querySelector('.grid');
        if (grid && Array.isArray(content.items)) {
            const cards = content.items.filter(hasContent).map(function (item) {
                const card = document.createElement('article');
                card.className = 'card';
                if (item.name) {
                    const title = document.createElement('h3');
                    title.textContent = item.name;
                    card.appendChild(title);
                }
                return card;
            });
            grid.replaceChildren.apply(grid, cards);
            grid.hidden = cards.length === 0;
        }
        setLink(section, '.info-panel .btn', content.button_text, content.button_url);
        const infoPanel = section.querySelector('.info-panel');
        if (infoPanel) infoPanel.hidden = !content.button_text;
    }

    function renderEvents(content) {
        const section = document.querySelector('[data-home-section="events"]');
        const card = section && section.querySelector('.event-card');
        if (!card) return;
        card.replaceChildren();
        const cardFields = ['icon', 'badge', 'title', 'description', 'date', 'location', 'register_button_text'];
        card.hidden = !cardFields.some(function (key) {
            return typeof content[key] === 'string' && content[key].trim() !== '';
        });

        if (content.icon) {
            const icon = document.createElement('div');
            icon.className = 'event-icon';
            icon.textContent = content.icon;
            card.appendChild(icon);
        }
        if (content.badge) {
            const badge = document.createElement('p');
            badge.className = 'badge';
            badge.textContent = content.badge;
            card.appendChild(badge);
        }
        if (content.title) {
            const title = document.createElement('h3');
            title.textContent = content.title;
            card.appendChild(title);
        }
        if (content.description) {
            const description = document.createElement('p');
            description.textContent = content.description;
            card.appendChild(description);
        }

        [['Date:', content.date], ['Location:', content.location]].forEach(function (item) {
            if (!item[1]) return;
            const detail = document.createElement('p');
            const label = document.createElement('strong');
            label.textContent = item[0] + ' ';
            detail.append(label, document.createTextNode(item[1]));
            card.appendChild(detail);
        });

        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const register = createAction(content.register_button_text, content.register_button_url, 'btn btn-secondary');
        if (register) actions.appendChild(register);
        if (actions.childElementCount) card.appendChild(actions);

        const infoPanel = section.querySelector('.info-panel');
        if (infoPanel) {
            setLink(infoPanel, '.btn', content.all_link_text, content.all_link_url);
            infoPanel.hidden = !content.all_link_text;
        }
    }

    const renderers = {
        hero: renderHero,
        theme: renderTheme,
        about: renderAbout,
        history: function (content) { renderEditorialSection(content, 'history'); },
        faith_practices: function (content) { renderEditorialSection(content, 'faith_practices'); },
        sermons: renderSermons,
        services: renderServices,
        ministries: renderMinistries,
        leaders: renderLeaders,
        events: renderEvents
    };

    async function loadHomepageContent() {
        const main = document.querySelector('main');
        if (main) {
            main.setAttribute('aria-busy', 'true');
            main.dataset.homeContentState = 'loading';
        }

        try {
            if (!client) {
                throw new Error(window.supabaseConfigError || 'Supabase is not configured.');
            }
            const result = await client.rpc('get_public_homepage_sections');
            if (result.error) throw result.error;
            const rows = Array.isArray(result.data) ? result.data : [];
            rows.forEach(function (row) {
                if (!Object.prototype.hasOwnProperty.call(renderers, row.section_id)) return;
                setSectionVisibility(row.section_id, row.is_published);
                if (row.is_published && row.content && typeof row.content === 'object') {
                    renderers[row.section_id](row.content);
                }
            });
            if (main) main.dataset.homeContentState = 'loaded';
        } catch (error) {
            console.error('Unable to load homepage content from Supabase; showing the built-in homepage content.', error);
            if (main) main.dataset.homeContentState = 'fallback';
        } finally {
            if (main) main.removeAttribute('aria-busy');
        }
    }

    document.addEventListener('DOMContentLoaded', loadHomepageContent);
})();
