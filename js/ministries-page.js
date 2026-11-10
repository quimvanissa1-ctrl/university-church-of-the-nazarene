const MINISTRIES_MAINTENANCE_MODE = true;

if (!MINISTRIES_MAINTENANCE_MODE) {
    const main = document.querySelector('.ministries-page');
    const originalContent = document.getElementById('ministries-page-content');

    if (main && originalContent) {
        main.replaceChildren(originalContent.content.cloneNode(true));
    }
}
