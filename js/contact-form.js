window.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector('.contact-form');
    if (!form) {
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const status = form.querySelector('.form-status');
    const fieldLabels = {
        name: 'your name',
        email: 'a valid email address',
        subject: 'a subject',
        message: 'a message'
    };

    function showStatus(message, state) {
        status.textContent = message;
        status.dataset.state = state;
    }

    form.addEventListener('invalid', function (event) {
        const field = form.querySelector(':invalid') || event.target;
        const label = fieldLabels[field.name];
        if (label) {
            const message = field.validity.valueMissing
                ? `Please enter ${label}.`
                : 'Please enter a valid email address.';
            showStatus(message, 'error');
        }
    }, true);

    form.addEventListener('input', function () {
        status.textContent = '';
        status.removeAttribute('data-state');
    });

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
        form.setAttribute('aria-busy', 'true');
        showStatus('Sending your message...', 'loading');

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: {
                    Accept: 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Form submission failed with status ${response.status}`);
            }

            form.reset();
            showStatus('Thank you! Your message has been sent successfully.', 'success');
        } catch (error) {
            console.error('Unable to send contact form:', error);
            showStatus('Sorry, your message could not be sent. Please try again later.', 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
            form.removeAttribute('aria-busy');
        }
    });
});
