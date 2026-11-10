// Load events data from JSON and provide utilities for rendering
let eventsData = [];

/**
 * Load events from the JSON data file
 */
async function loadEvents() {
    try {
        const response = await fetch('data/events.json');
        if (!response.ok) {
            throw new Error(`Failed to load events: ${response.status}`);
        }
        eventsData = await response.json();
        return eventsData;
    } catch (error) {
        console.error('Error loading events:', error);
        return [];
    }
}

/**
 * Filter events by type (e.g., "mission", "youth", "worship")
 * @param {string} type - Event type to filter by
 * @returns {array} Filtered events
 */
function getEventsByType(type) {
    return eventsData.filter(event => event.type === type);
}

/**
 * Get all events sorted by date (newest first)
 * @returns {array} Sorted events
 */
function getAllEventsSorted() {
    return eventsData.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * Format date string to readable format
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @returns {string} Formatted date
 */
function formatEventDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

/**
 * Get month and year from date string for display
 * @param {string} dateString - ISO date string
 * @returns {string} Month and year (e.g., "May 2026")
 */
function getMonthYear(dateString) {
    const options = { year: 'numeric', month: 'short' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

/**
 * Render a mission event card in the mission highlights format
 * @param {object} event - Event object
 * @returns {string} HTML card markup
 */
function renderMissionEventCard(event) {
    return `
        <article class="event-card">
            <span class="date-label">${getMonthYear(event.date)}</span>
            <h3>${event.title}</h3>
            <p class="event-location">${event.location}</p>
            ${event.image ? `<img src="${event.image}" alt="${event.title}" />` : ''}
            <p>${event.description}</p>
        </article>
    `;
}

/**
 * Render a general event card
 * @param {object} event - Event object
 * @returns {string} HTML card markup
 */
function renderEventCard(event) {
    return `
        <article class="card event-card">
            ${event.image ? `<img src="${event.image}" alt="${event.title}" />` : '<div class="event-icon">📅</div>'}
            <p class="badge">${formatEventDate(event.date)}</p>
            <h3>${event.title}</h3>
            <p>${event.description}</p>
            <p><strong>Date:</strong> ${formatEventDate(event.date)}</p>
            <p><strong>Location:</strong> ${event.location}</p>
            <div class="card-actions">
                <a class="btn btn-secondary" href="#">Learn More</a>
            </div>
        </article>
    `;
}

/**
 * Initialize events on page load - expose as global for use in pages
 */
window.initializeEvents = function() {
    return loadEvents();
};
