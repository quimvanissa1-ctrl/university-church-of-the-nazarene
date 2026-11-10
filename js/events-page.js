// Populate events on the Events page
document.addEventListener('DOMContentLoaded', async function() {
    // Load events
    await initializeEvents();

    // Get all events sorted by date
    const allEvents = getAllEventsSorted();

    // Get upcoming events (first 3 or featured)
    const upcomingEvents = allEvents.slice(0, 3);

    // Render featured/upcoming events
    const featuredContainer = document.getElementById('featured-events-container');
    if (featuredContainer) {
        featuredContainer.innerHTML = upcomingEvents.map(event => renderEventCard(event)).join('');
    }

    // Render all events
    const allEventsContainer = document.getElementById('all-events-container');
    if (allEventsContainer) {
        allEventsContainer.innerHTML = allEvents.map(event => renderEventCard(event)).join('');
    }
});
