function loadComponent(elementId, path) {
    const target = document.getElementById(elementId);
    if (!target) {
        return;
    }

    fetch(path)
        .then(response => response.text())
        .then(html => {
            target.innerHTML = html;
            if (elementId === 'site-header') {
                initNavbar();
                highlightCurrentPage();
            }
        })
        .catch(error => {
            console.error(`Unable to load ${path}:`, error);
        });
}

function highlightCurrentPage() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(link => {
        const hrefPath = link.getAttribute('href').split('/').pop();
        if (hrefPath === currentPath || (currentPath === 'index.html' && hrefPath === '')) {
            link.classList.add('active');
        }
    });
}

function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (event) {
            event.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

window.addEventListener('DOMContentLoaded', function () {
    loadComponent('site-header', 'components/header.html');
    loadComponent('site-footer', 'components/footer.html');
    setupSmoothScrolling();
});
