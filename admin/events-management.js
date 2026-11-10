(function () {
    const client = window.supabaseClient;
    const bucketName = 'event-posters';
    const maximumPosterSize = 5 * 1024 * 1024;
    const allowedPosterTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const state = {
        events: [],
        initialized: false,
        saving: false,
        busyEventIds: new Set(),
        editingEvent: null,
        posterObjectUrl: null
    };

    const elements = {};

    function showMessage(element, message, isError) {
        element.textContent = message;
        element.hidden = false;
        element.classList.toggle('is-error', Boolean(isError));
    }

    function setButtonLoading(button, isLoading, label) {
        button.disabled = isLoading;
        button.classList.toggle('is-loading', isLoading);
        button.querySelector('.button-label').textContent = isLoading ? label : button.dataset.idleLabel;
    }

    function getPosterUrl(posterPath) {
        if (!posterPath) {
            return '';
        }

        if (/^https:\/\//i.test(posterPath)) {
            return posterPath;
        }

        return client.storage.from(bucketName).getPublicUrl(posterPath).data.publicUrl;
    }

    function getPosterPath(posterUrl) {
        if (!posterUrl || /^https:\/\//i.test(posterUrl) && !posterUrl.includes('/storage/v1/object/public/' + bucketName + '/')) {
            return null;
        }

        if (/^https:\/\//i.test(posterUrl)) {
            const marker = '/storage/v1/object/public/' + bucketName + '/';
            const pathStart = posterUrl.indexOf(marker);
            return pathStart === -1 ? null : decodeURIComponent(posterUrl.slice(pathStart + marker.length));
        }

        return posterUrl;
    }

    function formatDate(dateString) {
        return new Date(dateString + 'T00:00:00').toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatTime(timeString) {
        if (!timeString) {
            return '';
        }

        const parts = timeString.slice(0, 5).split(':');
        const date = new Date();
        date.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
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
        if (event.is_featured) {
            statuses.appendChild(createStatus('Featured', 'is-featured'));
        }
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
            const matchesSearch = !search ||
                event.title.toLocaleLowerCase().includes(search) ||
                (event.location || '').toLocaleLowerCase().includes(search);
            const matchesPublication = publication === 'all' ||
                (publication === 'published' ? event.is_published : !event.is_published);
            const matchesFeatured = featured === 'all' ||
                (featured === 'featured' ? event.is_featured : !event.is_featured);
            return matchesSearch && matchesPublication && matchesFeatured;
        });
    }

    function renderEvents() {
        elements.list.replaceChildren();
        const events = getFilteredEvents();
        elements.list.setAttribute('aria-busy', 'false');
        elements.status.textContent = state.events.length === 0
            ? 'No events yet. Add an event to get started.'
            : events.length === 0
                ? 'No events match these filters.'
                : events.length + (events.length === 1 ? ' event' : ' events');

        events.forEach(function (event) {
            elements.list.appendChild(renderEventRow(event));
        });
    }

    async function loadEvents() {
        elements.list.setAttribute('aria-busy', 'true');
        elements.status.textContent = 'Loading events…';
        let result;
        try {
            result = await client
                .from('events')
                .select('*')
                .order('event_date', { ascending: false })
                .order('created_at', { ascending: false });
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
        elements.posterPreviewImage.removeAttribute('src');
        elements.removePosterControl.hidden = true;
        elements.form.elements.remove_poster.checked = false;
    }

    function showPosterPreview(url, canRemove) {
        if (state.posterObjectUrl) {
            URL.revokeObjectURL(state.posterObjectUrl);
            state.posterObjectUrl = null;
        }
        elements.posterPreviewImage.src = url;
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
    }

    function openEventDialog(event) {
        state.editingEvent = event || null;
        elements.form.reset();
        clearPosterPreview();
        elements.formMessage.hidden = true;
        elements.dialogTitle.textContent = event ? 'Edit event' : 'Add event';
        elements.saveButton.dataset.idleLabel = event ? 'Save changes' : 'Save event';
        elements.saveButton.querySelector('.button-label').textContent = elements.saveButton.dataset.idleLabel;

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
            if (event.poster_url) {
                showPosterPreview(getPosterUrl(event.poster_url), true);
            }
        } else {
            elements.form.elements.registration_button_text.value = 'Register for Event';
            elements.form.elements.is_published.checked = true;
        }

        elements.dialog.showModal();
        elements.form.elements.title.focus();
    }

    function validateGoogleFormsUrl(value) {
        if (!value) {
            return null;
        }

        let url;
        try {
            url = new URL(value);
        } catch (error) {
            return 'Enter a valid Google Forms URL.';
        }

        const host = url.hostname.toLowerCase();
        const isFormsUrl = url.protocol === 'https:' && (
            (host === 'docs.google.com' && url.pathname.startsWith('/forms/')) ||
            (host === 'forms.gle' && url.pathname.length > 1)
        );
        return isFormsUrl ? null : 'Use a Google Forms link beginning with https://docs.google.com/forms/ or https://forms.gle/.';
    }

    function validatePoster(file) {
        if (!file) {
            return null;
        }
        if (!allowedPosterTypes.includes(file.type)) {
            return 'Choose a JPG, PNG, WebP, or GIF image.';
        }
        if (file.size > maximumPosterSize) {
            return 'The poster must be 5 MB or smaller.';
        }
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
            registration_url: String(formData.get('registration_url') || '').trim() || null,
            registration_button_text: String(formData.get('registration_button_text') || '').trim() || 'Register for Event',
            is_published: elements.form.elements.is_published.checked,
            is_featured: elements.form.elements.is_featured.checked
        };
    }

    async function removePoster(posterPath) {
        if (!posterPath) {
            return null;
        }
        try {
            const result = await client.storage.from(bucketName).remove([posterPath]);
            return result.error || null;
        } catch (error) {
            return error;
        }
    }

    async function removePosterIfUnused(posterPath, currentEventId) {
        if (!posterPath) {
            return null;
        }

        try {
            const result = await client
                .from('events')
                .select('id')
                .eq('poster_url', posterPath)
                .neq('id', currentEventId)
                .limit(1)
                .maybeSingle();
            if (result.error) {
                return result.error;
            }
            return result.data ? null : removePoster(posterPath);
        } catch (error) {
            return error;
        }
    }

    async function saveEvent() {
        if (state.saving) {
            return;
        }
        state.saving = true;
        setButtonLoading(elements.saveButton, true, 'Saving…');
        elements.formMessage.hidden = true;

        const values = getFormValues();
        const posterFile = elements.form.elements.poster.files[0] || null;
        const posterError = validatePoster(posterFile);
        const urlError = validateGoogleFormsUrl(values.registration_url);
        if (!values.title || !values.description || !values.event_date || posterError || urlError) {
            showMessage(elements.formMessage, posterError || urlError || 'Enter an event title, description, and date.', true);
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
                const uploadResult = await client.storage.from(bucketName).upload(newPosterPath, posterFile, {
                    cacheControl: '3600',
                    contentType: posterFile.type,
                    upsert: false
                });
                if (uploadResult.error) {
                    throw uploadResult.error;
                }
                values.poster_url = newPosterPath;
            } else if (currentEvent && elements.form.elements.remove_poster.checked) {
                values.poster_url = null;
            } else {
                values.poster_url = currentEvent ? currentEvent.poster_url : null;
            }

            const result = currentEvent
                ? await client.from('events').update(values).eq('id', eventId).select().single()
                : await client.from('events').insert([{ id: eventId, ...values }]).select().single();
            if (result.error) {
                throw result.error;
            }

            const shouldRemoveOldPoster = previousPoster &&
                (newPosterPath || elements.form.elements.remove_poster.checked) &&
                previousPoster !== newPosterPath;
            const cleanupError = shouldRemoveOldPoster
                ? await removePosterIfUnused(previousPoster, eventId)
                : null;

            closeEventDialog();
            const listLoaded = await loadEvents();
            if (listLoaded) {
                showMessage(elements.feedback, cleanupError
                    ? 'Event saved, but its previous poster could not be removed from storage.'
                    : currentEvent ? 'Event updated.' : 'Event created.', Boolean(cleanupError));
            } else {
                showMessage(elements.feedback, 'Event saved, but the events list could not be refreshed.', true);
            }
        } catch (error) {
            if (newPosterPath) {
                const cleanupError = await removePoster(newPosterPath);
                if (cleanupError) {
                    console.error('Unable to remove a poster uploaded for an event that was not saved:', cleanupError);
                }
            }
            showMessage(elements.formMessage, error.message || 'The event could not be saved. Please try again.', true);
        } finally {
            state.saving = false;
            setButtonLoading(elements.saveButton, false);
        }
    }

    async function updateEvent(eventId, updates) {
        if (state.busyEventIds.has(eventId)) {
            return;
        }
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
            if (!listLoadFailed) {
                showMessage(elements.feedback, 'Event updated.', false);
            } else {
                showMessage(elements.feedback, 'Event updated, but the events list could not be refreshed.', true);
            }
        } catch (error) {
            showMessage(elements.feedback, error.message || 'The event could not be updated.', true);
        } finally {
            state.busyEventIds.delete(eventId);
            if (!listLoadFailed) {
                renderEvents();
            }
        }
    }

    async function deleteEvent(event) {
        if (!window.confirm('Delete "' + event.title + '"? This action cannot be undone.')) {
            return;
        }
        if (state.busyEventIds.has(event.id)) {
            return;
        }

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
        if (listLoaded) {
            showMessage(elements.feedback, cleanupError
                ? 'Event deleted, but its poster could not be removed from storage.'
                : 'Event deleted.', Boolean(cleanupError));
        } else {
            showMessage(elements.feedback, 'Event deleted, but the events list could not be refreshed.', true);
        }
    }

    async function handleListClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }
        const record = state.events.find(function (item) {
            return item.id === button.dataset.eventId;
        });
        if (!record) {
            return;
        }

        if (button.dataset.action === 'edit') {
            openEventDialog(record);
        } else if (button.dataset.action === 'publish') {
            await updateEvent(record.id, { is_published: !record.is_published });
        } else if (button.dataset.action === 'feature') {
            await updateEvent(record.id, { is_featured: !record.is_featured });
        } else if (button.dataset.action === 'delete') {
            await deleteEvent(record);
        }
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

        elements.addButton.addEventListener('click', function () {
            openEventDialog(null);
        });
        elements.closeButton.addEventListener('click', closeEventDialog);
        elements.cancelButton.addEventListener('click', closeEventDialog);
        elements.dialog.addEventListener('click', function (event) {
            if (event.target === elements.dialog) {
                closeEventDialog();
            }
        });
        elements.dialog.addEventListener('cancel', function (event) {
            event.preventDefault();
            closeEventDialog();
        });
        elements.form.addEventListener('submit', function (event) {
            event.preventDefault();
            saveEvent();
        });
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
                if (state.posterObjectUrl) {
                    URL.revokeObjectURL(state.posterObjectUrl);
                }
                state.posterObjectUrl = URL.createObjectURL(file);
                showPosterPreview(state.posterObjectUrl, false);
            } else if (state.editingEvent && state.editingEvent.poster_url) {
                showPosterPreview(getPosterUrl(state.editingEvent.poster_url), true);
            }
        });
        elements.form.elements.remove_poster.addEventListener('change', function () {
            if (elements.form.elements.remove_poster.checked) {
                elements.posterPreview.hidden = true;
            } else if (state.editingEvent && state.editingEvent.poster_url) {
                showPosterPreview(getPosterUrl(state.editingEvent.poster_url), true);
            }
        });

        loadEvents();
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
            elements.saveButton = document.getElementById('save-event-button');
            elements.search = document.getElementById('event-search');
            elements.status = document.getElementById('events-list-status');
        }
        initialize();
    };
})();
