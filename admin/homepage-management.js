(function () {
    const client = window.supabaseClient;
    const sectionDefinitions = [
        {
            id: 'hero',
            title: 'Hero Section',
            fields: [
                { key: 'title', label: 'Heading', multiline: true },
                { key: 'subtitle', label: 'Subtitle', multiline: true },
                { key: 'primary_button_text', label: 'First button text' },
                { key: 'primary_button_url', label: 'First button link' },
                { key: 'secondary_button_text', label: 'Second button text' },
                { key: 'secondary_button_url', label: 'Second button link' }
            ]
        },
        {
            id: 'theme',
            title: '2025 Theme',
            fields: [
                { key: 'label', label: 'Theme label' },
                { key: 'title', label: 'Theme heading' },
                { key: 'verse', label: 'Verse text', multiline: true },
                { key: 'citation', label: 'Verse citation' }
            ]
        },
        {
            id: 'about',
            title: 'About Us',
            fields: [
                { key: 'title', label: 'Section heading' },
                { key: 'intro', label: 'Introduction', multiline: true },
                {
                    key: 'cards',
                    label: 'About cards',
                    repeatable: true,
                    itemLabel: 'About card',
                    itemFields: [
                        { key: 'badge', label: 'Card label' },
                        { key: 'title', label: 'Card heading' },
                        { key: 'description', label: 'Description', multiline: true }
                    ]
                }
            ]
        },
        {
            id: 'history',
            title: 'Our History',
            fields: [
                { key: 'title', label: 'Section heading' },
                { key: 'content', label: 'Paragraph/content', multiline: true }
            ]
        },
        {
            id: 'faith_practices',
            title: 'Our Faith & Practices',
            fields: [
                { key: 'title', label: 'Section heading' },
                { key: 'content', label: 'Content', multiline: true }
            ]
        },
        {
            id: 'sermons',
            title: 'Latest Sermons',
            fields: [
                { key: 'title', label: 'Section heading' },
                { key: 'intro', label: 'Introduction', multiline: true },
                { key: 'playlist_url', label: 'YouTube playlist embed URL', type: 'url' },
                { key: 'info_text', label: 'Closing text', multiline: true },
                { key: 'button_text', label: 'Button text' },
                { key: 'button_url', label: 'Button link' }
            ]
        },
        {
            id: 'services',
            title: 'Service Times',
            fields: [
                { key: 'title', label: 'Section heading' },
                { key: 'intro', label: 'Introduction', multiline: true },
                {
                    key: 'items',
                    label: 'Service cards',
                    repeatable: true,
                    itemLabel: 'Service',
                    itemFields: [
                        { key: 'title', label: 'Service name' },
                        { key: 'time', label: 'Time' },
                        { key: 'description', label: 'Description', multiline: true },
                        { key: 'action1_text', label: 'First button text (optional)' },
                        { key: 'action1_url', label: 'First button link (optional)' },
                        { key: 'action2_text', label: 'Second button text (optional)' },
                        { key: 'action2_url', label: 'Second button link (optional)' }
                    ]
                },
                { key: 'info_text', label: 'Closing text', multiline: true },
                { key: 'info_link_text', label: 'Closing button text' },
                { key: 'info_link_url', label: 'Closing button link' }
            ]
        },
        {
            id: 'ministries',
            title: 'Homepage Ministry Cards',
            fields: [
                {
                    key: 'items',
                    label: 'Ministry cards',
                    repeatable: true,
                    itemLabel: 'Ministry',
                    itemFields: [
                        { key: 'title', label: 'Ministry name' },
                        { key: 'description', label: 'Description', multiline: true },
                        { key: 'button_text', label: 'Button text' },
                        { key: 'button_url', label: 'Button link' }
                    ]
                },
                { key: 'all_link_text', label: 'All ministries button text' },
                { key: 'all_link_url', label: 'All ministries button link' }
            ]
        },
        {
            id: 'leaders',
            title: 'Leaders',
            fields: [
                {
                    key: 'items',
                    label: 'Leader cards',
                    repeatable: true,
                    itemLabel: 'Leader',
                    itemFields: [{ key: 'name', label: 'Name' }]
                },
                { key: 'button_text', label: 'Button text' },
                { key: 'button_url', label: 'Button link' }
            ]
        },
        {
            id: 'events',
            title: 'Featured Event',
            fields: [
                { key: 'icon', label: 'Event icon or emoji' },
                { key: 'badge', label: 'Event label' },
                { key: 'title', label: 'Event title' },
                { key: 'description', label: 'Description', multiline: true },
                { key: 'date', label: 'Date' },
                { key: 'location', label: 'Location' },
                { key: 'register_button_text', label: 'Registration button text' },
                { key: 'register_button_url', label: 'Registration button link' },
                { key: 'all_link_text', label: 'All events button text' },
                { key: 'all_link_url', label: 'All events button link' }
            ]
        }
    ];

    let loaded = false;
    const editor = document.getElementById('homepage-sections');
    const status = document.getElementById('homepage-list-status');

    function setStatus(message, isError) {
        status.textContent = message;
        status.hidden = !message;
        status.classList.toggle('is-error', Boolean(isError));
    }

    function makeField(field, value, extraClass) {
        const wrapper = document.createElement('label');
        wrapper.className = 'homepage-field' + (extraClass ? ' ' + extraClass : '');
        const label = document.createElement('span');
        label.textContent = field.label;
        const control = field.multiline ? document.createElement('textarea') : document.createElement('input');
        if (control.tagName === 'INPUT') control.type = field.type || 'text';
        if (control.tagName === 'TEXTAREA') control.rows = 3;
        control.value = typeof value === 'string' ? value : '';
        control.dataset.field = field.key;
        wrapper.append(label, control);
        return wrapper;
    }

    function addRepeaterItem(list, field, value, itemIndex) {
        const item = document.createElement('fieldset');
        item.className = 'homepage-repeater-item';
        item.dataset.repeater = field.key;
        const legend = document.createElement('legend');
        legend.textContent = field.itemLabel + ' ' + (itemIndex + 1);
        item.appendChild(legend);

        const fields = document.createElement('div');
        fields.className = 'homepage-field-grid';
        field.itemFields.forEach(function (itemField) {
            const isWide = itemField.multiline || itemField.type === 'url';
            fields.appendChild(makeField(itemField, value && value[itemField.key], isWide ? 'homepage-field-wide' : ''));
        });
        item.appendChild(fields);

        const remove = document.createElement('button');
        remove.className = 'secondary-button homepage-remove-item';
        remove.type = 'button';
        remove.textContent = 'Remove ' + field.itemLabel.toLowerCase();
        remove.addEventListener('click', function () {
            item.remove();
            updateRepeaterLabels(list, field);
        });
        item.appendChild(remove);
        list.appendChild(item);
    }

    function updateRepeaterLabels(list, field) {
        list.querySelectorAll('.homepage-repeater-item legend').forEach(function (legend, index) {
            legend.textContent = field.itemLabel + ' ' + (index + 1);
        });
    }

    function collectForm(form, definition) {
        const content = {};
        definition.fields.forEach(function (field) {
            if (field.repeatable) {
                content[field.key] = Array.from(form.querySelectorAll('[data-repeater="' + field.key + '"]')).map(function (item) {
                    const value = {};
                    item.querySelectorAll('[data-field]').forEach(function (control) {
                        value[control.dataset.field] = control.value.trim();
                    });
                    return value;
                });
            } else {
                const control = form.querySelector('[data-field="' + field.key + '"]');
                content[field.key] = control ? control.value.trim() : '';
            }
        });
        return content;
    }

    function buildSection(definition, row) {
        const article = document.createElement('article');
        article.className = 'homepage-editor-card';
        article.setAttribute('aria-labelledby', 'homepage-title-' + definition.id);

        const header = document.createElement('header');
        header.className = 'homepage-editor-heading';
        const heading = document.createElement('h2');
        heading.id = 'homepage-title-' + definition.id;
        heading.textContent = definition.title;
        const visibilityLabel = document.createElement('label');
        visibilityLabel.className = 'homepage-visibility';
        const visibility = document.createElement('input');
        visibility.type = 'checkbox';
        visibility.checked = Boolean(row.is_published);
        visibility.dataset.sectionVisibility = '';
        const visibilityText = document.createElement('span');
        visibilityText.textContent = 'Show on homepage';
        visibilityLabel.append(visibility, visibilityText);
        header.append(heading, visibilityLabel);
        article.appendChild(header);

        const message = document.createElement('p');
        message.className = 'homepage-section-feedback';
        message.setAttribute('role', 'status');
        message.setAttribute('aria-live', 'polite');
        message.hidden = true;
        article.appendChild(message);

        const form = document.createElement('form');
        form.className = 'homepage-field-grid';
        form.noValidate = true;
        const content = row.content && typeof row.content === 'object' ? row.content : {};
        definition.fields.forEach(function (field) {
            if (field.repeatable) {
                const group = document.createElement('fieldset');
                group.className = 'homepage-repeater homepage-field-wide';
                const legend = document.createElement('legend');
                legend.textContent = field.label;
                group.appendChild(legend);
                const list = document.createElement('div');
                list.className = 'homepage-repeater-list';
                const values = Array.isArray(content[field.key]) ? content[field.key] : [];
                values.forEach(function (value, index) {
                    addRepeaterItem(list, field, value, index);
                });
                const add = document.createElement('button');
                add.className = 'secondary-button homepage-add-item';
                add.type = 'button';
                add.textContent = 'Add ' + field.itemLabel.toLowerCase();
                add.addEventListener('click', function () {
                    addRepeaterItem(list, field, {}, list.children.length);
                });
                group.append(list, add);
                form.appendChild(group);
            } else {
                const isWide = field.multiline || field.type === 'url';
                form.appendChild(makeField(field, content[field.key], isWide ? 'homepage-field-wide' : ''));
            }
        });

        const actions = document.createElement('div');
        actions.className = 'homepage-form-actions homepage-field-wide';
        const save = document.createElement('button');
        save.className = 'primary-button';
        save.type = 'submit';
        save.textContent = 'Save ' + definition.title;
        actions.appendChild(save);
        form.appendChild(actions);

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            message.hidden = true;
            if (!client) {
                message.textContent = window.supabaseConfigError || 'Supabase is not configured.';
                message.classList.add('is-error');
                message.hidden = false;
                return;
            }

            save.disabled = true;
            save.textContent = 'Saving…';
            try {
                const result = await client
                    .from('homepage_sections')
                    .upsert({
                        section_id: definition.id,
                        content: collectForm(form, definition),
                        is_published: visibility.checked
                    }, { onConflict: 'section_id' });
                if (result.error) throw result.error;
                message.textContent = definition.title + ' saved successfully.';
                message.classList.remove('is-error');
            } catch (error) {
                console.error('Unable to save homepage section ' + definition.id + ':', error);
                message.textContent = error.message || 'Unable to save this section. Please try again.';
                message.classList.add('is-error');
            } finally {
                message.hidden = false;
                save.disabled = false;
                save.textContent = 'Save ' + definition.title;
            }
        });

        article.appendChild(form);
        return article;
    }

    async function initializeHomepageManagement() {
        if (loaded) return;
        if (!client) {
            setStatus(window.supabaseConfigError || 'Supabase is not configured.', true);
            return;
        }

        setStatus('Loading homepage content…', false);
        editor.setAttribute('aria-busy', 'true');
        try {
            const result = await client
                .from('homepage_sections')
                .select('section_id, content, is_published')
                .order('section_id');
            if (result.error) throw result.error;
            const rows = new Map((result.data || []).map(function (row) {
                return [row.section_id, row];
            }));
            const missing = sectionDefinitions.filter(function (definition) {
                return !rows.has(definition.id);
            });
            if (missing.length) {
                throw new Error('Homepage content is incomplete. Apply the homepage content migration in supabase/migrations, then reload this page.');
            }
            const cards = sectionDefinitions.map(function (definition) {
                return buildSection(definition, rows.get(definition.id));
            });
            editor.replaceChildren.apply(editor, cards);
            setStatus('Edit the existing homepage sections below. Changes publish as soon as they are saved.', false);
            loaded = true;
        } catch (error) {
            console.error('Unable to load homepage sections:', error);
            setStatus(error.message || 'Unable to load homepage sections. Please try again.', true);
        } finally {
            editor.removeAttribute('aria-busy');
        }
    }

    window.initializeHomepageManagement = initializeHomepageManagement;
})();
