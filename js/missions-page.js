// Populate mission events on the Missions page
document.addEventListener('DOMContentLoaded', async function() {
    // Load events
    await initializeEvents();

    // Get only mission-type events sorted by date (newest first)
    const missionEvents = getEventsByType('mission')
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Render mission events
    const missionEventsContainer = document.getElementById('mission-events-container');
    if (missionEventsContainer && missionEvents.length > 0) {
        missionEventsContainer.innerHTML = missionEvents.map(event => renderMissionEventCard(event)).join('');
    }

    // Add click handler for "Load More" button
    const loadMoreButton = document.querySelector('.load-more-button');
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', function() {
            // Show/hide additional events
            const allCards = missionEventsContainer.querySelectorAll('.event-card');
            allCards.forEach((card, index) => {
                if (index >= 3) {
                    card.style.display = card.style.display === 'none' ? 'block' : 'none';
                }
            });

            // Update button text
            this.textContent = this.textContent === 'Load More Mission Highlights'
                ? 'Show Less'
                : 'Load More Mission Highlights';
        });
    }
});
