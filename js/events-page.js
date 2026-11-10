document.addEventListener('DOMContentLoaded', async function () {
    const client = window.supabaseClient;
    const status = document.getElementById('events-page-status');
    const upcomingContainer = document.getElementById('upcoming-events-container');
    const pastContainer = document.getElementById('past-events-container');

    function showEmptyState(container, message) {
        const emptyState = document.createElement('p');
        emptyState.className = 'events-empty-state';
        emptyState.textContent = message;
        container.appendChild(emptyState);
    }

    function formatDate(dateString) {
        const parts = dateString.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    function formatTime(timeString) {
        const parts = timeString.slice(0, 5).split(':').map(Number);
        const date = new Date();
        date.setHours(parts[0], parts[1], 0, 0);
        return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    function getPosterUrl(posterPath) {
        if (!posterPath) {
            return '';
        }
        if (/^https:\/\//i.test(posterPath)) {
            return posterPath;
        }
        if (/^http:\/\//i.test(posterPath)) {
            return '';
        }
        return client.storage.from('event-posters').getPublicUrl(posterPath).data.publicUrl;
    }

    function createEventCard(event) {
        const card = document.createElement('article');
        card.className = 'card event-card' + (event.is_featured ? ' is-featured' : '');

        if (event.poster_url) {
            const posterUrl = getPosterUrl(event.poster_url);
            if (posterUrl) {
                const poster = document.createElement('img');
                poster.src = posterUrl;
                poster.alt = event.title + ' poster';
                poster.loading = 'lazy';
                card.appendChild(poster);
            }
        }

        const labels = document.createElement('div');
        labels.className = 'event-card-labels';
        const dateLabel = document.createElement('span');
        dateLabel.className = 'badge';
        dateLabel.textContent = formatDate(event.event_date);
        labels.appendChild(dateLabel);
        if (event.is_featured) {
            const featuredLabel = document.createElement('span');
            featuredLabel.className = 'badge event-featured-badge';
            featuredLabel.textContent = 'Featured';
            labels.appendChild(featuredLabel);
        }
        card.appendChild(labels);

        const title = document.createElement('h3');
        title.textContent = event.title;
        card.appendChild(title);

        const description = document.createElement('p');
        description.textContent = event.description;
        card.appendChild(description);

        if (event.start_time || event.end_time) {
            const time = document.createElement('p');
            const timeLabel = document.createElement('strong');
            timeLabel.textContent = 'Time: ';
            const timeValue = [event.start_time, event.end_time]
                .filter(Boolean)
                .map(formatTime)
                .join(' – ');
            time.append(timeLabel, document.createTextNode(timeValue));
            card.appendChild(time);
        }

        if (event.location) {
            const location = document.createElement('p');
            const locationLabel = document.createElement('strong');
            locationLabel.textContent = 'Location: ';
            location.append(locationLabel, document.createTextNode(event.location));
            card.appendChild(location);
        }

        if (event.registration_method === 'internal_form' && event.form_id) {
            const actions = document.createElement('div');
            actions.className = 'card-actions';
            const registrationLink = document.createElement('a');
            registrationLink.className = 'btn btn-secondary';
            registrationLink.href = 'event-registration.html?eventId=' + encodeURIComponent(event.id) + '&formId=' + encodeURIComponent(event.form_id);
            registrationLink.target = '_blank';
            registrationLink.rel = 'noopener noreferrer';
            registrationLink.textContent = event.registration_button_text || 'Register for Event';
            actions.appendChild(registrationLink);
            card.appendChild(actions);
        } else if (event.registration_url) {
            const actions = document.createElement('div');
            actions.className = 'card-actions';
            const registrationLink = document.createElement('a');
            registrationLink.className = 'btn btn-secondary';
            registrationLink.href = event.registration_url;
            registrationLink.target = '_blank';
            registrationLink.rel = 'noopener noreferrer';
            registrationLink.textContent = event.registration_button_text || 'Register for Event';
            actions.appendChild(registrationLink);
            card.appendChild(actions);
        }

        return card;
    }

    if (!client) {
        status.textContent = window.supabaseConfigError || 'Events could not be loaded right now. Please try again later.';
        upcomingContainer.replaceChildren();
        upcomingContainer.setAttribute('aria-busy', 'false');
        showEmptyState(upcomingContainer, 'Events are temporarily unavailable.');
        showEmptyState(pastContainer, 'Events are temporarily unavailable.');
        return;
    }

    let result;
    try {
        result = await client
            .from('events')
            .select('id, title, description, event_date, start_time, end_time, location, poster_url, registration_method, registration_url, form_id, registration_button_text, is_featured')
            .eq('is_published', true)
            .order('event_date', { ascending: true })
            .order('start_time', { ascending: true });
    } catch (error) {
        upcomingContainer.setAttribute('aria-busy', 'false');
        status.textContent = 'Events could not be loaded right now. Please try again later.';
        showEmptyState(upcomingContainer, 'Please check back soon.');
        showEmptyState(pastContainer, 'Please check back soon.');
        console.error('Unable to load public events:', error);
        return;
    }

    upcomingContainer.setAttribute('aria-busy', 'false');
    if (result.error) {
        status.textContent = 'Events could not be loaded right now. Please try again later.';
        showEmptyState(upcomingContainer, 'Please check back soon.');
        showEmptyState(pastContainer, 'Please check back soon.');
        console.error('Unable to load public events:', result.error);
        return;
    }

    const today = new Date();
    const todayString = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');
    const upcomingEvents = [];
    const pastEvents = [];
    (result.data || []).forEach(function (event) {
        (event.event_date >= todayString ? upcomingEvents : pastEvents).push(event);
    });

    upcomingEvents.sort(function (a, b) {
        return a.event_date.localeCompare(b.event_date) || (a.start_time || '').localeCompare(b.start_time || '');
    });
    pastEvents.sort(function (a, b) {
        return b.event_date.localeCompare(a.event_date) || (b.start_time || '').localeCompare(a.start_time || '');
    });

    if (upcomingEvents.length === 0) {
        showEmptyState(upcomingContainer, 'There are no upcoming events right now. Please check back soon.');
    } else {
        upcomingEvents.forEach(function (event) {
            upcomingContainer.appendChild(createEventCard(event));
        });
    }
    if (pastEvents.length === 0) {
        showEmptyState(pastContainer, 'There are no past events to display.');
    } else {
        pastEvents.forEach(function (event) {
            pastContainer.appendChild(createEventCard(event));
        });
    }
    status.textContent = '';
});
