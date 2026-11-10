(function () {
    const footer = document.getElementById('site-footer');
    const standaloneTrigger = document.querySelector('.footer-admin-trigger');

    function bindTrigger(trigger) {
        if (trigger.dataset.adminAccessBound === 'true') {
            return;
        }

        trigger.dataset.adminAccessBound = 'true';
        let holdTimer = null;
        let activePointerId = null;
        let startX = 0;
        let startY = 0;

        function cancelHold() {
            if (holdTimer !== null) {
                window.clearTimeout(holdTimer);
                holdTimer = null;
            }

            activePointerId = null;
            trigger.classList.remove('is-holding');
        }

        trigger.addEventListener('pointerdown', function (event) {
            if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
                return;
            }

            cancelHold();
            activePointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            trigger.classList.add('is-holding');
            holdTimer = window.setTimeout(function () {
                holdTimer = null;
                activePointerId = null;
                trigger.classList.remove('is-holding');
                window.location.assign('/admin/login.html');
            }, 5000);
        });

        document.addEventListener('pointerup', function (event) {
            if (event.pointerId === activePointerId) {
                cancelHold();
            }
        });

        document.addEventListener('pointercancel', function (event) {
            if (event.pointerId === activePointerId) {
                cancelHold();
            }
        });

        document.addEventListener('pointermove', function (event) {
            if (
                event.pointerId === activePointerId &&
                (Math.abs(event.clientX - startX) > 12 || Math.abs(event.clientY - startY) > 12)
            ) {
                cancelHold();
            }
        });

        trigger.addEventListener('pointerleave', function (event) {
            if (event.pointerType === 'mouse') {
                cancelHold();
            }
        });

        window.addEventListener('blur', cancelHold);
    }

    if (standaloneTrigger) {
        bindTrigger(standaloneTrigger);
    }

    if (footer) {
        const observer = new MutationObserver(function () {
            const trigger = Array.from(footer.querySelectorAll('p')).find(function (paragraph) {
                return paragraph.textContent.trim() === 'Holiness unto the Lord • Building Christlike Disciples.';
            });

            if (trigger) {
                bindTrigger(trigger);
                observer.disconnect();
            }
        });

        observer.observe(footer, { childList: true, subtree: true });
    }
})();
