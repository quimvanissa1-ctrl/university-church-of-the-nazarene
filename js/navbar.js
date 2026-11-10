function initNavbar() {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    const navOverlay = document.getElementById('nav-overlay');
    const dropdownToggle = document.querySelector('.dropdown-toggle');
    const dropdown = document.querySelector('.dropdown');
    const navLinkItems = document.querySelectorAll('.nav-links a');

    const closeMobileMenu = () => {
        if (navLinks && navLinks.classList.contains('open')) {
            navLinks.classList.remove('open');
        }

        if (navToggle) {
            navToggle.setAttribute('aria-expanded', 'false');
        }

        if (navOverlay) {
            navOverlay.classList.remove('open');
        }
    };

    const toggleMobileMenu = () => {
        if (!navLinks || !navToggle) {
            return;
        }

        const isOpen = navLinks.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', String(isOpen));

        if (navOverlay) {
            navOverlay.classList.toggle('open', isOpen);
        }
    };

    if (navToggle) {
        navToggle.addEventListener('click', toggleMobileMenu);
    }

    if (navOverlay) {
        navOverlay.addEventListener('click', closeMobileMenu);
    }

    navLinkItems.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    if (dropdownToggle && dropdown) {
        let hideDropdownTimer;

        const clearHideTimer = () => {
            if (hideDropdownTimer) {
                clearTimeout(hideDropdownTimer);
                hideDropdownTimer = null;
            }
        };

        const showDropdown = () => {
            if (window.innerWidth > 900) {
                clearHideTimer();
                dropdown.classList.add('open');
                dropdownToggle.setAttribute('aria-expanded', 'true');
            }
        };

        const hideDropdown = () => {
            if (window.innerWidth > 900) {
                clearHideTimer();
                hideDropdownTimer = setTimeout(() => {
                    dropdown.classList.remove('open');
                    dropdownToggle.setAttribute('aria-expanded', 'false');
                }, 170);
            }
        };

        dropdown.addEventListener('mouseenter', showDropdown);
        dropdown.addEventListener('mouseleave', hideDropdown);

        dropdownToggle.addEventListener('click', function (event) {
            if (window.innerWidth <= 900) {
                event.preventDefault();
                const expanded = this.getAttribute('aria-expanded') === 'true';
                this.setAttribute('aria-expanded', String(!expanded));
                dropdown.classList.toggle('open');
            }
        });

        dropdownToggle.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.click();
            }
        });
    }

    window.addEventListener('resize', function () {
        if (window.innerWidth > 900) {
            closeMobileMenu();

            if (dropdown && dropdownToggle) {
                dropdown.classList.remove('open');
                dropdownToggle.setAttribute('aria-expanded', 'false');
            }
        }
    });
}
