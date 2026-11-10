(function () {
    const client = window.supabaseClient;
    const bucketName = 'event-posters';
    const maximumPosterSize = 5 * 1024 * 1024;
    const allowedPosterTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const questionTypes = [
        { value: 'short_answer', label: 'Short Answer' },
        { value: 'paragraph', label: 'Paragraph' },
        { value: 'multiple_choice', label: 'Multiple Choice' },
        { value: 'checkbox', label: 'Checkboxes' },
        { value: 'dropdown', label: 'Dropdown' },
        { value: 'date', label: 'Date' },
        { value: 'number', label: 'Number' },
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone Number' }
    ];

    const state = {
        events: [],
        formQuestions: [],
        initialized: false,
        saving: false,
        busyEventIds: new Set(),
        editingEvent: null,
        posterObjectUrl: null
    };

    const elements = {};

    function showMessage(element, message, isError) {
        if (!element) return;
        element.textContent = message;
        element.hidden = false;
        element.classList.toggle('is-error', Boolean(isError));
    }

    function setButtonLoading(button, isLoading, label) {
        if (!button) return;
        button.disabled = isLoading;
        button.classList.toggle('is-loading', isLoading);
        const labelNode = button.querySelector('.button-label');
        if (labelNode) {
            labelNode.textContent = isLoading ? label : button.dataset.idleLabel;
        }
    }

    function getPosterUrl(posterPath) {
        if (!posterPath) return '';
        if (/^https?:\/\//i.test(posterPath)) return posterPath;
        return client.storage.from(bucketName).getPublicUrl(posterPath).data.publicUrl;
    }

    function getPosterPath(posterUrl) {
        if (!posterUrl || !/^https?:\/\//i.test(posterUrl)) return posterUrl || null;
        const marker = '/storage/v1/object/public/' + bucketName + '/';
        const pathStart = posterUrl.indexOf(marker);
        return pathStart === -1 ? null : decodeURIComponent(posterUrl.slice(pathStart + marker.length));
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const value = new Date(dateString + 'T00:00:00');
        if (Number.isNaN(value.getTime())) return dateString;
        return value.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatTime(timeString) {
        if (!timeString) return '';
        const parts = String(timeString).slice(0, 5).split(':').map(Number);
        const date = new Date();
        date.setHours(parts[0], parts[1], 0, 0);
        return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    function createStatus(label, className) {
        const status = document.createElement('span');
        status.className = 'event-status ' + className;
        status.textContent = label;
        return status;
    }

    function createActionButton(label, action, eventId, isDisabled) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'event-action-button';
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.eventId = eventId;
        button.disabled = Boolean(isDisabled);
        return button;
    }

    function createEmptyQuestion() {
        return {
            id: crypto.randomUUID(),
            question_text: '',
            description: '',
            question_type: 'short_answer',
            is_required: false,
            options: ['Option 1', 'Option 2'],
            display_order: state.formQuestions.length
        };
    }

    function getOptionsText(options) {
        if (!Array.isArray(options)) return '';
        return options.map(function (option) { return String(option).trim(); }).filter(Boolean).join('\n');
    }

    function moveQuestion(index, delta) {
        const nextIndex = index + delta;
        if (nextIndex < 0 || nextIndex >= state.formQuestions.length) return;
        const [item] = state.formQuestions.splice(index, 1);
        state.formQuestions.splice(nextIndex, 0, item);
        renderEventFormBuilder();
    }

    function renderQuestionPreview(question) {
        const item = document.createElement('div');
        item.className = 'event-form-preview-question';
        const label = document.createElement('p');
        label.textContent = question.question_text || 'Untitled question';
        item.appendChild(label);

        if (question.description) {
            const description = document.createElement('small');
            description.textContent = question.description;
            item.appendChild(description);
        }

        switch (question.question_type) {
            case 'paragraph':
                item.appendChild(document.createElement('textarea'));
                break;
            case 'multiple_choice':
                const choiceGroup = document.createElement('div');
                (question.options || []).forEach(function (option) {
                    const choice = document.createElement('label');
                    const input = document.createElement('input');
                    input.type = 'radio';
                    input.name = 'preview-' + question.id;
                    choice.append(input, document.createTextNode(' ' + option));
                    choiceGroup.appendChild(choice);
                });
                item.appendChild(choiceGroup);
                break;
            case 'dropdown':
                const select = document.createElement('select');
                (question.options && question.options.length ? question.options : ['Option 1']).forEach(function (option) {
                    const optionEl = document.createElement('option');
                    optionEl.textContent = option;
                    optionEl.value = option;
                    select.appendChild(optionEl);
                });
                item.appendChild(select);
                break;
            case 'checkbox':
                (question.options || []).forEach(function (option) {
                    const row = document.createElement('label');
                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    row.append(input, document.createTextNode(' ' + option));
                    item.appendChild(row);
                });
                break;
            case 'date':
                const dateInput = document.createElement('input');
                dateInput.type = 'date';
                item.appendChild(dateInput);
                break;
            case 'number':
                const numberInput = document.createElement('input');
                numberInput.type = 'number';
                item.appendChild(numberInput);
                break;
            case 'email':
                const emailInput = document.createElement('input');
                emailInput.type = 'email';
                item.appendChild(emailInput);
                break;
            case 'phone':
                const phoneInput = document.createElement('input');
                phoneInput.type = 'tel';
                item.appendChild(phoneInput);
                break;
            default:
                item.appendChild(document.createElement('input'));
                break;
        }
        return item;
    }

    function renderEventFormBuilder() {
        if (!elements.builderQuestions) return;
        elements.builderQuestions.replaceChildren();
        if (!state.formQuestions.length) return;

        state.formQuestions.forEach(function (question, index) {
            const card = document.createElement('div');
            card.className = 'event-form-question-card';

            const textField = document.createElement('label');
            textField.className = 'event-field';
            textField.innerHTML = '<span>Question text <span aria-hidden="true">*</span></span>';
            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.value = question.question_text || '';
            textInput.placeholder = 'Type your question';
            textInput.addEventListener('input', function () {
                question.question_text = textInput.value;
            });
            textField.appendChild(textInput);

            const meta = document.createElement('div');
            meta.className = 'event-form-question-meta';

            const typeField = document.createElement('label');
            typeField.className = 'event-field';
            typeField.innerHTML = '<span>Answer type</span>';
            const select = document.createElement('select');
            questionTypes.forEach(function (option) {
                const optionEl = document.createElement('option');
                optionEl.value = option.value;
                optionEl.textContent = option.label;
                optionEl.selected = question.question_type === option.value;
                select.appendChild(optionEl);
            });
            select.addEventListener('change', function () {
                question.question_type = select.value;
                if (['multiple_choice', 'checkbox', 'dropdown'].includes(question.question_type) && (!Array.isArray(question.options) || question.options.length === 0)) {
                    question.options = ['Option 1', 'Option 2'];
                }
                renderEventFormBuilder();
            });
            typeField.appendChild(select);
            meta.appendChild(typeField);

            const requiredToggle = document.createElement('label');
            requiredToggle.className = 'event-required-toggle';
            const requiredInput = document.createElement('input');
            requiredInput.type = 'checkbox';
            requiredInput.checked = Boolean(question.is_required);
            requiredInput.addEventListener('change', function () {
                question.is_required = requiredInput.checked;
            });
            requiredToggle.append(requiredInput, document.createTextNode(' Required'));
            meta.appendChild(requiredToggle);

            const descriptionField = document.createElement('label');
            descriptionField.className = 'event-field';
            descriptionField.innerHTML = '<span>Description</span>';
            const descriptionInput = document.createElement('textarea');
            descriptionInput.rows = 2;
            descriptionInput.value = question.description || '';
            descriptionInput.addEventListener('input', function () {
                question.description = descriptionInput.value;
            });
            descriptionField.appendChild(descriptionInput);

            const optionsField = document.createElement('label');
            optionsField.className = 'event-field';
            const optionsLabel = document.createElement('span');
            optionsLabel.textContent = 'Answer options';
            optionsField.appendChild(optionsLabel);
            const optionsText = document.createElement('textarea');
            optionsText.rows = 3;
            optionsText.value = getOptionsText(question.options);
            optionsText.placeholder = 'One option per line';
            optionsText.hidden = !['multiple_choice', 'checkbox', 'dropdown'].includes(question.question_type);
            optionsText.addEventListener('input', function () {
                question.options = optionsText.value.split('\n').map(function (option) { return option.trim(); }).filter(Boolean);
            });
            optionsField.appendChild(optionsText);

            const actions = document.createElement('div');
            actions.className = 'event-form-question-actions';
            const moveUp = document.createElement('button');
            moveUp.type = 'button';
            moveUp.className = 'secondary-button';
            moveUp.textContent = '↑';
            moveUp.title = 'Move question up';
            moveUp.disabled = index === 0;
            moveUp.addEventListener('click', function () { moveQuestion(index, -1); });
            const moveDown = document.createElement('button');
            moveDown.type = 'button';
            moveDown.className = 'secondary-button';
            moveDown.textContent = '↓';
            moveDown.title = 'Move question down';
            moveDown.disabled = index === state.formQuestions.length - 1;
            moveDown.addEventListener('click', function () { moveQuestion(index, 1); });
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'secondary-button';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', function () {
                state.formQuestions.splice(index, 1);
                if (!state.formQuestions.length) state.formQuestions.push(createEmptyQuestion());
                renderEventFormBuilder();
            });
            actions.append(moveUp, moveDown, deleteButton);

            card.append(textField, meta, descriptionField, optionsField, actions);
            elements.builderQuestions.appendChild(card);
        });
    }

    function syncRegistrationFields() {
        if (!elements.form || !elements.form.elements.registration_method) return;
        const method = elements.form.elements.registration_method.value;
        const showLinkField = method === 'external_link';
        const showFormBuilder = method === 'internal_form';
        const linkField = elements.form.querySelector('.event-registration-link-field');
        if (linkField) {
            linkField.hidden = !showLinkField;
            const input = linkField.querySelector('input');
            if (input) input.required = showLinkField;
        }
        if (elements.builderContainer) elements.builderContainer.hidden = !showFormBuilder;
        if (showFormBuilder && !state.formQuestions.length) {
            state.formQuestions = [createEmptyQuestion()];
            renderEventFormBuilder();
        }
    }

    function buildFormPayload(questions) {
        return questions.map(function (question, index) {
            const optionValues = Array.isArray(question.options) ? question.options : [];
            return {
                question_text: String(question.question_text || '').trim(),
                description: String(question.description || '').trim(),
                question_type: question.question_type || 'short_answer',
                is_required: Boolean(question.is_required),
                options: optionValues.map(function (option) { return String(option).trim(); }).filter(Boolean),
                display_order: index
            };
        });
    }

    function validateBuilderQuestions() {
        if (!state.formQuestions.length) return 'Add at least one question to the event registration form.';
        const invalidQuestion = state.formQuestions.find(function (question) {
            const text = String(question.question_text || '').trim();
            if (!text) return true;
            if (['multiple_choice', 'checkbox', 'dropdown'].includes(question.question_type)) {
                const options = Array.isArray(question.options) ? question.options : [];
                return options.length < 2;
            }
            return false;
        });
        if (invalidQuestion) return 'Every question needs text, and multiple-choice, checkbox, and dropdown questions need at least two answer options.';
        return null;
    }

    async function saveEventFormRecord(eventId, formTitle, existingFormId, questions) {
        const normalizedQuestions = buildFormPayload(questions);
        let formResult;
        if (existingFormId) {
            formResult = await client.from('event_forms').update({ title: formTitle, description: 'Registered attendees will answer the questions below.', is_published: true, updated_at: new Date().toISOString() }).eq('id', existingFormId).select().single();
        } else {
            formResult = await client.from('event_forms').insert([{ event_id: eventId, title: formTitle, description: 'Registered attendees will answer the questions below.', is_published: true }]).select().single();
        }
        if (formResult.error) throw formResult.error;
        const formId = formResult.data.id;
        const removeResult = await client.from('event_form_questions').delete().eq('form_id', formId);
        if (removeResult.error) throw removeResult.error;
        if (normalizedQuestions.length) {
            const rows = normalizedQuestions.map(function (question) {
                return {
                    form_id: formId,
                    question_text: question.question_text,
                    description: question.description || null,
                    question_type: question.question_type,
                    is_required: question.is_required,
                    options: question.options,
                    display_order: question.display_order
                };
            });
            const insertResult = await client.from('event_form_questions').insert(rows);
            if (insertResult.error) throw insertResult.error;
        }
        return formId;
    }

    function renderEventRow(event) {
        const row = document.createElement('article');
        row.className = 'event-row';
        const poster = document.createElement('div');
        poster.className = 'event-row-poster';
        if (event.poster_url) {
            const image = document.createElement('img');
            image.src = getPosterUrl(event.poster_url);
            image.alt = '';
            image.loading = 'lazy';
            poster.appendChild(image);
        } else {
            const placeholder = document.createElement('span');
            placeholder.textContent = 'No poster';
            poster.appendChild(placeholder);
        }

        const details = document.createElement('div');
        details.className = 'event-row-details';
        const title = document.createElement('h3');
        title.textContent = event.title;
        const date = document.createElement('p');
        date.textContent = formatDate(event.event_date) + (event.location ? ' · ' + event.location : '');
        const statuses = document.createElement('div');
        statuses.className = 'event-row-statuses';
        statuses.appendChild(createStatus(event.is_published ? 'Published' : 'Unpublished', event.is_published ? 'is-published' : 'is-draft'));
        if (event.is_featured) statuses.appendChild(createStatus('Featured', 'is-featured'));
        if (event.registration_method === 'internal_form') statuses.appendChild(createStatus('Form', 'is-featured'));
        details.append(title, date, statuses);

        const actions = document.createElement('div');
        actions.className = 'event-row-actions';
        const isBusy = state.busyEventIds.has(event.id);
        actions.append(
            createActionButton('Edit', 'edit', event.id, isBusy),
            createActionButton(event.is_published ? 'Unpublish' : 'Publish', 'publish', event.id, isBusy),
            createActionButton(event.is_featured ? 'Unfeature' : 'Feature', 'feature', event.id, isBusy),
            createActionButton('Delete', 'delete', event.id, isBusy)
        );

        row.append(poster, details, actions);
        return row;
    }

    function getFilteredEvents() {
        const search = elements.search.value.trim().toLocaleLowerCase();
        const publication = elements.publicationFilter.value;
        const featured = elements.featuredFilter.value;
        return state.events.filter(function (event) {
            const matchesSearch = !search || (event.title || '').toLocaleLowerCase().includes(search) || (event.location || '').toLocaleLowerCase().includes(search);
            const matchesPublication = publication === 'all' || (publication === 'published' ? event.is_published : !event.is_published);
            const matchesFeatured = featured === 'all' || (featured === 'featured' ? event.is_featured : !event.is_featured);
            return matchesSearch && matchesPublication && matchesFeatured;
        });
    }

    function renderEvents() {
        elements.list.replaceChildren();
        const events = getFilteredEvents();
        elements.list.setAttribute('aria-busy', 'false');
        elements.status.textContent = state.events.length === 0 ? 'No events yet. Add an event to get started.' : events.length === 0 ? 'No events match these filters.' : events.length + (events.length === 1 ? ' event' : ' events');
        events.forEach(function (event) { elements.list.appendChild(renderEventRow(event)); });
    }

    async function loadEvents() {
        elements.list.setAttribute('aria-busy', 'true');
        elements.status.textContent = 'Loading events…';
        let result;
        try {
            result = await client.from('events').select('*').order('event_date', { ascending: false }).order('created_at', { ascending: false });
        } catch (error) {
            state.events = [];
            elements.list.replaceChildren();
            elements.status.textContent = 'Events could not be loaded.';
            elements.list.setAttribute('aria-busy', 'false');
            showMessage(elements.feedback, error.message || 'Check your connection and try again.', true);
            return false;
        }

        if (result.error) {
            state.events = [];
            elements.list.replaceChildren();
            elements.status.textContent = 'Events could not be loaded.';
            elements.list.setAttribute('aria-busy', 'false');
            showMessage(elements.feedback, result.error.message || 'Check the events table and administrator access, then try again.', true);
            return false;
        }

        state.events = result.data || [];
        elements.feedback.hidden = true;
        renderEvents();
        return true;
    }

    function clearPosterPreview() {
        if (state.posterObjectUrl) {
            URL.revokeObjectURL(state.posterObjectUrl);
            state.posterObjectUrl = null;
        }
        elements.posterPreview.hidden = true;
        elements.posterPreviewImage.replaceChildren();
        elements.removePosterControl.hidden = true;
        elements.form.elements.remove_poster.checked = false;
    }

    function showPosterPreview(url, canRemove) {
        if (state.posterObjectUrl) {
            URL.revokeObjectURL(state.posterObjectUrl);
            state.posterObjectUrl = null;
        }
        const image = document.createElement('img');
        image.src = url;
        image.alt = 'Event poster preview';
        elements.posterPreviewImage.replaceChildren(image);
        elements.posterPreview.hidden = false;
        elements.removePosterControl.hidden = !canRemove;
        elements.form.elements.remove_poster.checked = false;
    }

    function closeEventDialog() {
        elements.dialog.close();
        elements.form.reset();
        clearPosterPreview();
        elements.formMessage.hidden = true;
        state.editingEvent = null;
        state.formQuestions = [];
        renderEventFormBuilder();
    }

    function openEventDialog(event) {
        state.editingEvent = event || null;
        elements.form.reset();
        clearPosterPreview();
        elements.formMessage.hidden = true;
        elements.dialogTitle.textContent = event ? 'Edit event' : 'Add event';
        elements.saveButton.dataset.idleLabel = event ? 'Save changes' : 'Save event';
        const buttonLabel = elements.saveButton.querySelector('.button-label');
        if (buttonLabel) buttonLabel.textContent = elements.saveButton.dataset.idleLabel;

        if (event) {
            elements.form.elements.title.value = event.title || '';
            elements.form.elements.description.value = event.description || '';
            elements.form.elements.event_date.value = event.event_date || '';
            elements.form.elements.start_time.value = event.start_time ? event.start_time.slice(0, 5) : '';
            elements.form.elements.end_time.value = event.end_time ? event.end_time.slice(0, 5) : '';
            elements.form.elements.location.value = event.location || '';
            elements.form.elements.registration_url.value = event.registration_url || '';
            elements.form.elements.registration_button_text.value = event.registration_button_text || 'Register for Event';
            elements.form.elements.is_published.checked = Boolean(event.is_published);
            elements.form.elements.is_featured.checked = Boolean(event.is_featured);
            elements.form.elements.registration_method.value = event.registration_method || 'external_link';
            state.formQuestions = (event.event_form_questions || []).map(function (question) {
                return {
                    id: crypto.randomUUID(),
                    question_text: question.question_text || '',
                    description: question.description || '',
                    question_type: question.question_type || 'short_answer',
                    is_required: Boolean(question.is_required),
                    options: Array.isArray(question.options) ? question.options : [],
                    display_order: question.display_order || 0
                };
            });
            if (!state.formQuestions.length) state.formQuestions = [createEmptyQuestion()];
            if (event.poster_url) showPosterPreview(getPosterUrl(event.poster_url), true);
        } else {
            elements.form.elements.registration_button_text.value = 'Register for Event';
            elements.form.elements.is_published.checked = true;
            elements.form.elements.registration_method.value = 'external_link';
            state.formQuestions = [createEmptyQuestion()];
        }

        renderEventFormBuilder();
        syncRegistrationFields();
        elements.dialog.showModal();
        elements.form.elements.title.focus();
    }

    function validateRegistrationUrl(value) {
        if (!value) return null;
        let url;
        try { url = new URL(value); } catch (error) { return 'Enter a valid registration URL.'; }
        return url.protocol === 'http:' || url.protocol === 'https:' ? null : 'Use an HTTP or HTTPS registration URL.';
    }

    function validatePoster(file) {
        if (!file) return null;
        if (!allowedPosterTypes.includes(file.type)) return 'Choose a JPG, PNG, WebP, or GIF image.';
        if (file.size > maximumPosterSize) return 'The poster must be 5 MB or smaller.';
        return null;
    }

    function getFormValues() {
        const formData = new FormData(elements.form);
        return {
            title: String(formData.get('title') || '').trim(),
            description: String(formData.get('description') || '').trim(),
            event_date: String(formData.get('event_date') || ''),
            start_time: String(formData.get('start_time') || '') || null,
            end_time: String(formData.get('end_time') || '') || null,
            location: String(formData.get('location') || '').trim() || null,
            registration_method: String(formData.get('registration_method') || 'external_link'),
            registration_url: String(formData.get('registration_url') || '').trim() || null,
            registration_button_text: String(formData.get('registration_button_text') || '').trim() || 'Register for Event',
            is_published: elements.form.elements.is_published.checked,
            is_featured: elements.form.elements.is_featured.checked
        };
    }

    async function removePoster(posterPath) {
        if (!posterPath) return null;
        try {
            const result = await client.storage.from(bucketName).remove([posterPath]);
            return result.error || null;
        } catch (error) {
            return error;
        }
    }

    async function removePosterIfUnused(posterPath, currentEventId) {
        if (!posterPath) return null;
        try {
            const result = await client.from('events').select('id').eq('poster_url', posterPath).neq('id', currentEventId).limit(1).maybeSingle();
            if (result.error) return result.error;
            return result.data ? null : removePoster(posterPath);
        } catch (error) {
            return error;
        }
    }

    async function saveEvent() {
        if (state.saving) return;
        state.saving = true;
        setButtonLoading(elements.saveButton, true, 'Saving…');
        elements.formMessage.hidden = true;

        const values = getFormValues();
        const posterFile = elements.form.elements.poster.files[0] || null;
        const posterError = validatePoster(posterFile);
        const urlError = values.registration_method === 'external_link' ? validateRegistrationUrl(values.registration_url) : null;
        const formBuilderError = values.registration_method === 'internal_form' ? validateBuilderQuestions() : null;
        const hasRequiredEventFields = values.title && values.registration_method;

        if (!hasRequiredEventFields || formBuilderError || posterError || urlError) {
            showMessage(elements.formMessage, posterError || urlError || formBuilderError || 'Enter an event title and choose a registration method.', true);
            state.saving = false;
            setButtonLoading(elements.saveButton, false);
            return;
        }

        const currentEvent = state.editingEvent;
        const eventId = currentEvent ? currentEvent.id : crypto.randomUUID();
        const previousPoster = getPosterPath(currentEvent && currentEvent.poster_url);
        let newPosterPath = null;

        try {
            if (posterFile) {
                const extension = posterFile.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'image';
                newPosterPath = eventId + '/' + crypto.randomUUID() + '.' + extension;
                const uploadResult = await client.storage.from(bucketName).upload(newPosterPath, posterFile, { cacheControl: '3600', contentType: posterFile.type, upsert: false });
                if (uploadResult.error) throw uploadResult.error;
                values.poster_url = newPosterPath;
            } else if (currentEvent && elements.form.elements.remove_poster.checked) {
                values.poster_url = null;
            } else {
                values.poster_url = currentEvent ? currentEvent.poster_url : null;
            }

            values.registration_button_text = values.registration_button_text || 'Register for Event';
            values.registration_method = values.registration_method || 'external_link';

            let existingFormId = currentEvent && currentEvent.form_id ? currentEvent.form_id : null;
            if (values.registration_method === 'internal_form') {
                const formTitle = (values.title || 'Event') + ' Registration';
                existingFormId = await saveEventFormRecord(eventId, formTitle, existingFormId, state.formQuestions);
                values.form_id = existingFormId;
                values.registration_url = null;
            } else {
                values.form_id = null;
                values.registration_url = values.registration_url || null;
            }

            const result = currentEvent ? await client.from('events').update(values).eq('id', eventId).select().single() : await client.from('events').insert([{ id: eventId, ...values }]).select().single();
            if (result.error) throw result.error;

            const shouldRemoveOldPoster = previousPoster && (newPosterPath || elements.form.elements.remove_poster.checked) && previousPoster !== newPosterPath;
            const cleanupError = shouldRemoveOldPoster ? await removePosterIfUnused(previousPoster, eventId) : null;

            closeEventDialog();
            const listLoaded = await loadEvents();
            if (listLoaded) {
                showMessage(elements.feedback, cleanupError ? 'Event saved, but its previous poster could not be removed from storage.' : currentEvent ? 'Event updated.' : 'Event created.', Boolean(cleanupError));
            } else {
                showMessage(elements.feedback, 'Event saved, but the events list could not be refreshed.', true);
            }
        } catch (error) {
            if (newPosterPath) {
                const cleanupError = await removePoster(newPosterPath);
                if (cleanupError) console.error('Unable to remove a poster uploaded for an event that was not saved:', cleanupError);
            }
            showMessage(elements.formMessage, error.message || 'The event could not be saved. Please try again.', true);
        } finally {
            state.saving = false;
            setButtonLoading(elements.saveButton, false);
        }
    }

    async function updateEvent(eventId, updates) {
        if (state.busyEventIds.has(eventId)) return;
        state.busyEventIds.add(eventId);
        renderEvents();
        let listLoadFailed = false;
        try {
            const result = await client.from('events').update(updates).eq('id', eventId).select('id').single();
            if (result.error) {
                showMessage(elements.feedback, result.error.message || 'The event could not be updated.', true);
                return;
            }
            listLoadFailed = !(await loadEvents());
            if (!listLoadFailed) showMessage(elements.feedback, 'Event updated.', false);
            else showMessage(elements.feedback, 'Event updated, but the events list could not be refreshed.', true);
        } catch (error) {
            showMessage(elements.feedback, error.message || 'The event could not be updated.', true);
        } finally {
            state.busyEventIds.delete(eventId);
            if (!listLoadFailed) renderEvents();
        }
    }

    async function deleteEvent(event) {
        if (!window.confirm('Delete "' + event.title + '"? This action cannot be undone.')) return;
        if (state.busyEventIds.has(event.id)) return;

        state.busyEventIds.add(event.id);
        renderEvents();
        let result;
        try {
            result = await client.from('events').delete().eq('id', event.id).select('id').single();
        } catch (error) {
            state.busyEventIds.delete(event.id);
            renderEvents();
            showMessage(elements.feedback, error.message || 'The event could not be deleted.', true);
            return;
        }
        state.busyEventIds.delete(event.id);
        if (result.error) {
            showMessage(elements.feedback, result.error.message || 'The event could not be deleted.', true);
            renderEvents();
            return;
        }

        const posterPath = getPosterPath(event.poster_url);
        const cleanupError = posterPath ? await removePosterIfUnused(posterPath, event.id) : null;
        const listLoaded = await loadEvents();
        if (listLoaded) showMessage(elements.feedback, cleanupError ? 'Event deleted, but its poster could not be removed from storage.' : 'Event deleted.', Boolean(cleanupError));
        else showMessage(elements.feedback, 'Event deleted, but the events list could not be refreshed.', true);
    }

    async function handleListClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) return;
        const record = state.events.find(function (item) { return item.id === button.dataset.eventId; });
        if (!record) return;

        if (button.dataset.action === 'edit') openEventDialog(record);
        else if (button.dataset.action === 'publish') await updateEvent(record.id, { is_published: !record.is_published });
        else if (button.dataset.action === 'feature') await updateEvent(record.id, { is_featured: !record.is_featured });
        else if (button.dataset.action === 'delete') await deleteEvent(record);
    }

    function initialize() {
        if (!client) {
            showMessage(elements.feedback, window.supabaseConfigError || 'Supabase is not configured.', true);
            elements.status.textContent = 'Events are unavailable.';
            return;
        }

        if (state.initialized) {
            loadEvents();
            return;
        }
        state.initialized = true;

        elements.addButton.addEventListener('click', function () { openEventDialog(null); });
        elements.closeButton.addEventListener('click', closeEventDialog);
        elements.cancelButton.addEventListener('click', closeEventDialog);
        elements.dialog.addEventListener('click', function (event) { if (event.target === elements.dialog) closeEventDialog(); });
        elements.dialog.addEventListener('cancel', function (event) { event.preventDefault(); closeEventDialog(); });
        elements.form.addEventListener('submit', function (event) { event.preventDefault(); saveEvent(); });
        elements.list.addEventListener('click', handleListClick);
        [elements.search, elements.publicationFilter, elements.featuredFilter].forEach(function (input) {
            input.addEventListener('input', renderEvents);
            input.addEventListener('change', renderEvents);
        });
        elements.form.elements.poster.addEventListener('change', function () {
            const file = elements.form.elements.poster.files[0];
            const error = validatePoster(file);
            if (error) {
                elements.form.elements.poster.value = '';
                showMessage(elements.formMessage, error, true);
                clearPosterPreview();
                return;
            }
            if (file) {
                if (state.posterObjectUrl) URL.revokeObjectURL(state.posterObjectUrl);
                state.posterObjectUrl = URL.createObjectURL(file);
                showPosterPreview(state.posterObjectUrl, false);
            } else if (state.editingEvent && state.editingEvent.poster_url) {
                showPosterPreview(getPosterUrl(state.editingEvent.poster_url), true);
            }
        });
        elements.form.elements.remove_poster.addEventListener('change', function () {
            if (elements.form.elements.remove_poster.checked) elements.posterPreview.hidden = true;
            else if (state.editingEvent && state.editingEvent.poster_url) showPosterPreview(getPosterUrl(state.editingEvent.poster_url), true);
        });
        elements.form.elements.registration_method.forEach(function (input) { input.addEventListener('change', syncRegistrationFields); });
        elements.addQuestionButton.addEventListener('click', function () { state.formQuestions.push(createEmptyQuestion()); renderEventFormBuilder(); });
        elements.previewButton.addEventListener('click', function () {
            const formBuilderError = validateBuilderQuestions();
            if (formBuilderError) { showMessage(elements.formMessage, formBuilderError, true); return; }
            const previewBody = document.getElementById('event-form-preview-body');
            previewBody.replaceChildren();
            state.formQuestions.forEach(function (question) { previewBody.appendChild(renderQuestionPreview(question)); });
            document.getElementById('event-form-preview-dialog').showModal();
        });
        document.getElementById('close-event-form-preview-dialog').addEventListener('click', function () { document.getElementById('event-form-preview-dialog').close(); });
        document.getElementById('close-event-form-preview-button').addEventListener('click', function () { document.getElementById('event-form-preview-dialog').close(); });

        loadEvents();
        loadEventForms();
    }

    window.initializeEventsManagement = function () {
        if (!elements.list) {
            elements.addButton = document.getElementById('add-event-button');
            elements.cancelButton = document.getElementById('cancel-event-button');
            elements.closeButton = document.getElementById('close-event-dialog');
            elements.dialog = document.getElementById('event-dialog');
            elements.dialogTitle = document.getElementById('event-dialog-title');
            elements.feedback = document.getElementById('events-feedback');
            elements.featuredFilter = document.getElementById('event-featured-filter');
            elements.form = document.getElementById('event-form');
            elements.formMessage = document.getElementById('event-form-message');
            elements.list = document.getElementById('events-list');
            elements.posterPreview = document.getElementById('event-poster-preview');
            elements.posterPreviewImage = document.getElementById('event-poster-preview-image');
            elements.publicationFilter = document.getElementById('event-publication-filter');
            elements.removePosterControl = document.getElementById('remove-poster-control');
            elements.saveButton = document.getElementById('save-event-button');
            elements.search = document.getElementById('event-search');
            elements.status = document.getElementById('events-list-status');
            elements.builderContainer = document.getElementById('event-form-builder');
            elements.builderQuestions = document.getElementById('event-form-builder-questions');
            elements.addQuestionButton = document.getElementById('add-event-question-button');
            elements.previewButton = document.getElementById('preview-event-form-button');
        }
        initialize();
    };

    async function loadEventForms() {
        const formList = document.getElementById('event-forms-list');
        const notice = document.getElementById('event-forms-feedback');
        if (!formList || !notice || !client) return;
        formList.setAttribute('aria-busy', 'true');
        notice.hidden = true;
        const { data, error } = await client.from('event_forms').select('*').order('created_at', { ascending: false });
        formList.setAttribute('aria-busy', 'false');
        if (error) {
            formList.replaceChildren();
            showMessage(notice, error.message || 'The event forms could not be loaded.', true);
            return;
        }
        if (!data || !data.length) {
            formList.innerHTML = '<p class="events-empty-state">No event forms yet. Create one while adding an event.</p>';
            return;
        }

        const eventIds = [...new Set(data.map(function (item) { return item.event_id; }).filter(Boolean))];
        let events = [];
        if (eventIds.length) {
            const eventResult = await client.from('events').select('id, title').in('id', eventIds);
            if (!eventResult.error) events = eventResult.data || [];
        }
        const eventMap = new Map(events.map(function (item) { return [item.id, item.title]; }));
        formList.replaceChildren();
        for (const form of data) {
            const card = document.createElement('article');
            card.className = 'event-row';
            const details = document.createElement('div');
            details.className = 'event-row-details';
            const title = document.createElement('h3');
            title.textContent = form.title || 'Untitled event form';
            const eventTitle = document.createElement('p');
            eventTitle.textContent = 'Event: ' + (eventMap.get(form.event_id) || 'Unknown event');
            const responseCount = document.createElement('p');
            responseCount.textContent = 'Responses: loading…';
            details.append(title, eventTitle, responseCount);

            const actions = document.createElement('div');
            actions.className = 'event-row-actions';
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.className = 'event-action-button';
            editButton.textContent = 'Edit Form';
            editButton.onclick = async function () {
                const eventResult = await client.from('events').select('*').eq('form_id', form.id).maybeSingle();
                if (eventResult.data) {
                    const questionResult = await client.from('event_form_questions').select('*').eq('form_id', form.id).order('display_order', { ascending: true });
                    if (!questionResult.error) eventResult.data.event_form_questions = questionResult.data || [];
                    openEventDialog(eventResult.data);
                }
            };
            const viewResponses = document.createElement('button');
            viewResponses.type = 'button';
            viewResponses.className = 'event-action-button';
            viewResponses.textContent = 'View Responses';
            viewResponses.onclick = function () {
                window.open('event-registration.html?eventId=' + encodeURIComponent(form.event_id) + '&formId=' + encodeURIComponent(form.id) + '&mode=responses', '_blank');
            };
            actions.append(editButton, viewResponses);
            card.append(details, actions);
            formList.appendChild(card);

            const responseResult = await client.from('event_form_responses').select('id', { count: 'exact' }).eq('form_id', form.id);
            if (!responseResult.error && typeof responseResult.count === 'number') responseCount.textContent = 'Responses: ' + responseResult.count;
            else responseCount.textContent = 'Responses: 0';
        }
    }

    window.initializeEventFormsManagement = loadEventForms;
})();
