document.addEventListener('DOMContentLoaded', async function () {
    const client = window.supabaseClient;
    const params = new URLSearchParams(window.location.search);
    const eventId = params.get('eventId');
    const formId = params.get('formId');
    const mode = params.get('mode') === 'responses' ? 'responses' : 'register';

    const statusEl = document.getElementById('event-registration-status');
    const formContainer = document.getElementById('event-registration-form-container');
    const titleEl = document.getElementById('event-registration-title');
    const summaryEl = document.getElementById('event-registration-summary');
    const formTitleEl = document.getElementById('event-registration-form-title');
    const formDescriptionEl = document.getElementById('event-registration-form-description');
    const responseCountEl = document.getElementById('event-registration-response-count');

    function setStatus(message, isError) {
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.hidden = !message;
        statusEl.classList.toggle('is-error', Boolean(isError));
    }

    function createFieldLabel(question, required) {
        const labelId = 'event-question-label-' + question.id;
        const label = document.createElement('div');
        label.id = labelId;
        label.className = 'event-form-question-label';
        const text = document.createElement('strong');
        text.textContent = question.question_text || 'Untitled question';
        label.appendChild(text);

        if (required) {
            const requiredMarker = document.createElement('span');
            requiredMarker.className = 'required-marker';
            requiredMarker.textContent = ' *';
            label.appendChild(requiredMarker);
        }

        if (question.description) {
            const description = document.createElement('small');
            description.id = labelId + '-description';
            description.textContent = question.description;
            label.appendChild(description);
        }

        return label;
    }

    function setQuestionContext(element, question) {
        const labelId = 'event-question-label-' + question.id;
        element.setAttribute('aria-labelledby', labelId);
        if (question.description) {
            element.setAttribute('aria-describedby', labelId + '-description');
        }
        if (question.is_required) {
            element.setAttribute('aria-required', 'true');
        }
    }

    function buildAnswerInput(question) {
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'event-form-question-input';

        const commonAttributes = {
            name: question.id,
            required: Boolean(question.is_required)
        };

        if (question.question_type === 'paragraph') {
            const textarea = document.createElement('textarea');
            Object.assign(textarea, commonAttributes);
            textarea.dataset.questionId = question.id;
            setQuestionContext(textarea, question);
            textarea.rows = 5;
            inputWrapper.appendChild(textarea);
            return inputWrapper;
        }

        if (question.question_type === 'multiple_choice') {
            inputWrapper.setAttribute('role', 'radiogroup');
            setQuestionContext(inputWrapper, question);
            const options = Array.isArray(question.options) && question.options.length ? question.options : ['Option 1'];
            options.forEach(function (option) {
                const optionLabel = document.createElement('label');
                optionLabel.className = 'event-form-option';
                const optionInput = document.createElement('input');
                Object.assign(optionInput, commonAttributes, { type: 'radio', value: option });
                optionInput.dataset.questionId = question.id;
                optionInput.name = question.id;
                optionLabel.append(optionInput, document.createTextNode(' ' + option));
                inputWrapper.appendChild(optionLabel);
            });
            return inputWrapper;
        }

        if (question.question_type === 'checkbox') {
            inputWrapper.setAttribute('role', 'group');
            setQuestionContext(inputWrapper, question);
            const options = Array.isArray(question.options) && question.options.length ? question.options : ['Option 1'];
            options.forEach(function (option) {
                const optionLabel = document.createElement('label');
                optionLabel.className = 'event-form-option';
                const optionInput = document.createElement('input');
                Object.assign(optionInput, commonAttributes, { type: 'checkbox', value: option, required: false });
                optionInput.dataset.questionId = question.id;
                optionInput.name = question.id + '-' + option.replace(/\s+/g, '-').toLowerCase();
                optionLabel.append(optionInput, document.createTextNode(' ' + option));
                inputWrapper.appendChild(optionLabel);
            });
            return inputWrapper;
        }

        if (question.question_type === 'dropdown') {
            const select = document.createElement('select');
            Object.assign(select, commonAttributes, { required: Boolean(question.is_required) });
            select.dataset.questionId = question.id;
            setQuestionContext(select, question);
            const blankOption = document.createElement('option');
            blankOption.value = '';
            blankOption.textContent = 'Select an option';
            select.appendChild(blankOption);
            const options = Array.isArray(question.options) && question.options.length ? question.options : ['Option 1'];
            options.forEach(function (option) {
                const optionEl = document.createElement('option');
                optionEl.value = option;
                optionEl.textContent = option;
                select.appendChild(optionEl);
            });
            inputWrapper.appendChild(select);
            return inputWrapper;
        }

        const input = document.createElement('input');
        if (question.question_type === 'date') {
            input.type = 'date';
        } else if (question.question_type === 'number') {
            input.type = 'number';
            input.step = 'any';
        } else if (question.question_type === 'email') {
            input.type = 'email';
        } else if (question.question_type === 'phone') {
            input.type = 'tel';
            input.inputMode = 'tel';
            input.pattern = '[+0-9() .-]{7,24}';
            input.title = 'Enter a phone number with at least 7 digits.';
        } else {
            input.type = 'text';
        }
        Object.assign(input, commonAttributes);
        input.dataset.questionId = question.id;
        setQuestionContext(input, question);
        inputWrapper.appendChild(input);
        return inputWrapper;
    }

    function collectQuestionValue(question, formEl) {
        const controlNodes = formEl.querySelectorAll('[data-question-id="' + question.id + '"]');

        if (question.question_type === 'checkbox') {
            const values = [];
            controlNodes.forEach(function (node) {
                if (node.checked) {
                    values.push(node.value);
                }
            });
            return values.join(', ');
        }

        if (question.question_type === 'multiple_choice') {
            const checked = Array.from(controlNodes).find(function (node) {
                return node.checked;
            });
            return checked ? checked.value : '';
        }

        if (question.question_type === 'dropdown') {
            const node = controlNodes[0];
            return node ? node.value : '';
        }

        const node = controlNodes[0];
        return node ? node.value : '';
    }

    function renderQuestion(question) {
        const wrapper = document.createElement('div');
        wrapper.className = 'event-registration-question';
        wrapper.appendChild(createFieldLabel(question, Boolean(question.is_required)));
        wrapper.appendChild(buildAnswerInput(question));
        return wrapper;
    }

    async function renderResponses(eventData, formData, questions) {
        if (!client) {
            setStatus('You must be signed in to view event responses.', true);
            return;
        }

        try {
            const userResult = await client.auth.getUser();
            if (userResult.error) throw userResult.error;
            const user = userResult.data && userResult.data.user;
            if (!user) {
                setStatus('You must be signed in to view event responses.', true);
                return;
            }
            const metadata = user.app_metadata || {};
            const roles = Array.isArray(metadata.roles) ? metadata.roles : [];
            if (metadata.role !== 'admin' && !roles.includes('admin')) {
                setStatus('You do not have permission to view event responses.', true);
                return;
            }
        } catch (error) {
            console.error('Unable to verify event response access:', error);
            setStatus('Your access could not be verified. Sign in with an administrator account and try again.', true);
            return;
        }

        try {
            const responses = [];
            const responsePageSize = 500;
            let responseOffset = 0;
            while (true) {
                const responseResult = await client
                    .from('event_form_responses')
                    .select('id, submitted_at')
                    .eq('form_id', formData.id)
                    .order('submitted_at', { ascending: false })
                    .range(responseOffset, responseOffset + responsePageSize - 1);
                if (responseResult.error) throw responseResult.error;
                const responsePage = responseResult.data || [];
                responses.push.apply(responses, responsePage);
                if (responsePage.length < responsePageSize) break;
                responseOffset += responsePageSize;
            }

            let answers = [];
            const responseIds = responses.map(function (response) { return response.id; });
            const answerBatchSize = 50;
            for (let responseIndex = 0; responseIndex < responseIds.length; responseIndex += answerBatchSize) {
                const responseIdBatch = responseIds.slice(responseIndex, responseIndex + answerBatchSize);
                let answerOffset = 0;
                while (true) {
                    const answerResult = await client
                        .from('event_form_answers')
                        .select('response_id, question_id, question_text, display_order, answer')
                        .in('response_id', responseIdBatch)
                        .order('display_order', { ascending: true })
                        .range(answerOffset, answerOffset + responsePageSize - 1);
                    if (answerResult.error) throw answerResult.error;
                    const answerPage = answerResult.data || [];
                    answers.push.apply(answers, answerPage);
                    if (answerPage.length < responsePageSize) break;
                    answerOffset += responsePageSize;
                }
            }

            const answersByResponse = new Map();
            answers.forEach(function (answer) {
                if (!answersByResponse.has(answer.response_id)) {
                    answersByResponse.set(answer.response_id, []);
                }
                answersByResponse.get(answer.response_id).push(answer);
            });

            const list = document.createElement('div');
            list.className = 'event-registration-response-list';

            responseCountEl.textContent = 'Total responses: ' + responses.length;
            responseCountEl.hidden = false;
            titleEl.textContent = eventData.title || 'Event responses';
            summaryEl.textContent = 'Review the submitted registrations for this event.';
            formTitleEl.textContent = 'Response sheet';
            formDescriptionEl.textContent = 'Form: ' + (formData.title || 'Event registration');
            formDescriptionEl.hidden = false;

            if (!responses.length) {
                const emptyState = document.createElement('p');
                emptyState.textContent = 'No responses yet.';
                list.appendChild(emptyState);
            } else {
                const questionById = new Map(questions.map(function (question) {
                    return [question.id, question];
                }));
                responses.forEach(function (response, index) {
                    const submission = document.createElement('details');
                    submission.className = 'event-registration-response';
                    const heading = document.createElement('summary');
                    const submittedAt = new Date(response.submitted_at);
                    heading.textContent = 'Submission ' + (index + 1) + ' · ' +
                        (Number.isNaN(submittedAt.getTime()) ? 'Date unavailable' : submittedAt.toLocaleString());
                    submission.appendChild(heading);

                    const answerList = document.createElement('dl');
                    const responseAnswers = (answersByResponse.get(response.id) || []).slice().sort(function (left, right) {
                        return (left.display_order || 0) - (right.display_order || 0);
                    });
                    const answerItems = responseAnswers.length
                        ? responseAnswers
                        : questions.map(function (question) {
                            return Object.assign({}, question, { answer: null, question_text: question.question_text });
                        });
                    answerItems.forEach(function (answer) {
                        const originalQuestion = answer.question_id ? questionById.get(answer.question_id) : null;
                        const term = document.createElement('dt');
                        term.textContent = answer.question_text || (originalQuestion && originalQuestion.question_text) || 'Question';
                        const detail = document.createElement('dd');
                        detail.textContent = answer.answer === null || answer.answer === undefined || answer.answer === ''
                            ? 'No answer provided'
                            : answer.answer;
                        answerList.append(term, detail);
                    });

                    if (!answerItems.length) {
                        const emptyAnswer = document.createElement('dd');
                        emptyAnswer.textContent = 'No answers were recorded for this submission.';
                        answerList.appendChild(emptyAnswer);
                    }
                    submission.appendChild(answerList);
                    list.appendChild(submission);
                });
            }

            formContainer.replaceChildren(list);
            setStatus('');
        } catch (error) {
            console.error('Unable to load event registration responses:', error);
            setStatus('Responses could not be loaded. Check your administrator access and try again.', true);
        }
    }

    async function renderRegistrationForm(eventData, formData, questions) {
        if (!questions.length) {
            setStatus('This event registration form does not contain any questions yet.', true);
            return;
        }

        const form = document.createElement('form');
        form.id = 'event-registration-form';
        form.className = 'event-registration-form';
        form.noValidate = true;

        questions.forEach(function (question) {
            const questionNode = renderQuestion(question);
            questionNode.addEventListener('input', function (inputEvent) {
                if (inputEvent.target.removeAttribute) inputEvent.target.removeAttribute('aria-invalid');
            });
            questionNode.addEventListener('change', function (inputEvent) {
                if (inputEvent.target.removeAttribute) inputEvent.target.removeAttribute('aria-invalid');
            });
            form.appendChild(questionNode);
        });

        const submitArea = document.createElement('div');
        submitArea.className = 'event-registration-actions';
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.className = 'btn btn-primary';
        submitButton.textContent = eventData.registration_button_text || 'Submit';
        submitArea.appendChild(submitButton);
        form.appendChild(submitArea);

        let isSubmitting = false;
        form.addEventListener('submit', async function (submitEvent) {
            submitEvent.preventDefault();
            if (isSubmitting) return;

            const invalidQuestion = questions.find(function (question) {
                const answer = collectQuestionValue(question, form);
                if (Boolean(question.is_required) && !String(answer || '').trim()) {
                    return true;
                }
                const controls = Array.from(form.querySelectorAll('[data-question-id="' + question.id + '"]'));
                const value = String(answer || '').trim();
                if (!value) return false;
                if (question.question_type === 'phone') {
                    const phone = value.replace(/[()\s.-]/g, '');
                    return !/^\+?[0-9]{7,15}$/.test(phone);
                }
                if (question.question_type === 'email' || question.question_type === 'number' || question.question_type === 'date') {
                    return controls.some(function (control) {
                        return !control.checkValidity();
                    });
                }
                return false;
            });

            if (invalidQuestion) {
                const controls = Array.from(form.querySelectorAll('[data-question-id="' + invalidQuestion.id + '"]'));
                controls.forEach(function (control) { control.setAttribute('aria-invalid', 'true'); });
                if (controls[0]) controls[0].focus();
                const message = invalidQuestion.question_type === 'phone'
                    ? 'Enter a valid phone number for: '
                    : invalidQuestion.is_required && !String(collectQuestionValue(invalidQuestion, form) || '').trim()
                        ? 'Please complete the required question: '
                        : 'Enter a valid answer for: ';
                setStatus(message + (invalidQuestion.question_text || 'Untitled question'), true);
                return;
            }

            isSubmitting = true;
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting…';
            form.setAttribute('aria-busy', 'true');
            setStatus('Submitting your registration…', false);
            try {
                const responseResult = await client.rpc('submit_event_form_response', {
                    p_form_id: formData.id,
                    p_answers: questions.map(function (question) {
                        const answer = collectQuestionValue(question, form);
                        return {
                        question_id: question.id,
                            answer: answer && String(answer).trim() ? String(answer).trim() : null
                        };
                    })
                });
                if (responseResult.error) throw responseResult.error;
                if (!responseResult.data) throw new Error('The registration service did not confirm the response.');

                form.replaceChildren();
                const success = document.createElement('div');
                success.className = 'event-registration-success';
                const successTitle = document.createElement('h3');
                successTitle.textContent = 'Thank you for registering.';
                const successCopy = document.createElement('p');
                successCopy.textContent = 'Your response has been recorded for ' + (eventData.title || 'this event') + '.';
                success.append(successTitle, successCopy);
                form.appendChild(success);
                setStatus('', false);
            } catch (error) {
                console.error('Unable to submit event registration:', error);
                setStatus('Your registration could not be saved. Please try again.', true);
                submitButton.disabled = false;
                submitButton.textContent = eventData.registration_button_text || 'Submit';
            } finally {
                isSubmitting = false;
                form.setAttribute('aria-busy', 'false');
            }
        });

        formContainer.replaceChildren(form);
        titleEl.textContent = eventData.title || 'Event Registration';
        summaryEl.textContent = 'Complete the form below to register for this event.';
        formTitleEl.textContent = formData.title || 'Registration Form';
        formDescriptionEl.textContent = formData.description || 'Please complete the questions below.';
        formDescriptionEl.hidden = false;
        responseCountEl.hidden = true;
        setStatus('');
    }

    if (!client) {
        setStatus(window.supabaseConfigError || 'The event registration form is temporarily unavailable.', true);
        return;
    }

    if (!eventId) {
        setStatus('A valid event was not provided for this registration form.', true);
        return;
    }

    try {
        const eventResult = await client
            .from('events')
            .select('*')
            .eq('id', eventId)
            .maybeSingle();

        if (eventResult.error) throw eventResult.error;
        const eventData = eventResult.data;

        if (!eventData) {
            setStatus('This event could not be found.', true);
            return;
        }

        const activeFormId = formId || eventData.form_id;
        if (!activeFormId) {
            setStatus('This event is not connected to an internal registration form.', true);
            return;
        }

        const formResult = await client.from('event_forms').select('*').eq('id', activeFormId).maybeSingle();
        if (formResult.error) throw formResult.error;
        const formData = formResult.data;

        if (!formData) {
            setStatus('This registration form could not be found.', true);
            return;
        }
        if (formData.event_id !== eventData.id) {
            setStatus('This form is not associated with the selected event.', true);
            return;
        }

        const questionResult = await client
            .from('event_form_questions')
            .select('*')
            .eq('form_id', activeFormId)
            .order('display_order', { ascending: true });

        if (questionResult.error) throw questionResult.error;

        if (mode === 'responses') {
            await renderResponses(eventData, formData, questionResult.data || []);
            return;
        }

        if (!eventData.is_published || !formData.is_published ||
            eventData.registration_method !== 'internal_form' || eventData.form_id !== activeFormId) {
            setStatus('This form is not currently available for registration.', true);
            return;
        }

        await renderRegistrationForm(eventData, formData, questionResult.data || []);
    } catch (error) {
        setStatus(error.message || 'The event form could not be loaded.', true);
    }
});
