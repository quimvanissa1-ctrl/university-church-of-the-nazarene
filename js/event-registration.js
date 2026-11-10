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

    function setStatus(message, isError) {
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.hidden = !message;
        statusEl.classList.toggle('is-error', Boolean(isError));
    }

    function createFieldLabel(question, required) {
        const label = document.createElement('label');
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
            description.textContent = question.description;
            label.appendChild(description);
        }

        return label;
    }

    function buildAnswerInput(question) {
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'event-form-question-input';

        const commonAttributes = {
            name: question.id,
            'data-question-id': question.id,
            required: Boolean(question.is_required)
        };

        if (question.question_type === 'paragraph') {
            const textarea = document.createElement('textarea');
            Object.assign(textarea, commonAttributes);
            textarea.rows = 5;
            inputWrapper.appendChild(textarea);
            return inputWrapper;
        }

        if (question.question_type === 'multiple_choice') {
            const options = Array.isArray(question.options) && question.options.length ? question.options : ['Option 1'];
            options.forEach(function (option) {
                const optionLabel = document.createElement('label');
                optionLabel.className = 'event-form-option';
                const optionInput = document.createElement('input');
                Object.assign(optionInput, commonAttributes, { type: 'radio', value: option });
                optionInput.name = question.id;
                optionLabel.append(optionInput, document.createTextNode(' ' + option));
                inputWrapper.appendChild(optionLabel);
            });
            return inputWrapper;
        }

        if (question.question_type === 'checkbox') {
            const options = Array.isArray(question.options) && question.options.length ? question.options : ['Option 1'];
            options.forEach(function (option) {
                const optionLabel = document.createElement('label');
                optionLabel.className = 'event-form-option';
                const optionInput = document.createElement('input');
                Object.assign(optionInput, commonAttributes, { type: 'checkbox', value: option });
                optionInput.name = question.id + '-' + option.replace(/\s+/g, '-').toLowerCase();
                optionLabel.append(optionInput, document.createTextNode(' ' + option));
                inputWrapper.appendChild(optionLabel);
            });
            return inputWrapper;
        }

        if (question.question_type === 'dropdown') {
            const select = document.createElement('select');
            Object.assign(select, commonAttributes, { required: Boolean(question.is_required) });
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
        } else if (question.question_type === 'email') {
            input.type = 'email';
        } else if (question.question_type === 'phone') {
            input.type = 'tel';
        } else {
            input.type = 'text';
        }
        Object.assign(input, commonAttributes);
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
            if (userResult.error || !userResult.data?.user) {
                setStatus('You must be signed in to view event responses.', true);
                return;
            }
        } catch (error) {
            setStatus('You must be signed in to view event responses.', true);
            return;
        }

        try {
            const responseResult = await client
                .from('event_form_responses')
                .select('*')
                .eq('form_id', formData.id)
                .order('submitted_at', { ascending: false });

            if (responseResult.error) throw responseResult.error;

            const responses = responseResult.data || [];
            const responseIds = responses.map(function (response) { return response.id; });
            let answers = [];

            if (responseIds.length) {
                const answerResult = await client.from('event_form_answers').select('*').in('response_id', responseIds);
                if (answerResult.error) throw answerResult.error;
                answers = answerResult.data || [];
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

            if (!responses.length) {
                const emptyState = document.createElement('p');
                emptyState.textContent = 'No responses have been received for this form yet.';
                list.appendChild(emptyState);
            } else {
                responses.forEach(function (response, index) {
                    const submission = document.createElement('article');
                    submission.className = 'event-registration-response';
                    const heading = document.createElement('h3');
                    heading.textContent = 'Submission ' + (index + 1) + ' · ' + new Date(response.submitted_at).toLocaleString();
                    submission.appendChild(heading);

                    const answerList = document.createElement('dl');
                    questions.forEach(function (question) {
                        const matchedAnswers = (answersByResponse.get(response.id) || []).filter(function (answer) {
                            return answer.question_id === question.id;
                        });
                        const answerValue = matchedAnswers.length ? matchedAnswers[0].answer || 'No answer provided' : 'No answer provided';
                        const term = document.createElement('dt');
                        term.textContent = question.question_text || 'Untitled question';
                        const detail = document.createElement('dd');
                        detail.textContent = answerValue;
                        answerList.append(term, detail);
                    });

                    submission.appendChild(answerList);
                    list.appendChild(submission);
                });
            }

            formContainer.replaceChildren(list);
            titleEl.textContent = 'Responses for ' + (formData.title || eventData.title || 'event');
            summaryEl.textContent = 'Review each submission for this event registration form.';
            setStatus('');
        } catch (error) {
            setStatus(error.message || 'Unable to load the event responses.', true);
        }
    }

    async function renderRegistrationForm(eventData, formData, questions) {
        if (!questions.length) {
            setStatus('This event registration form does not contain any questions yet.', true);
            return;
        }

        const form = document.createElement('form');
        form.id = 'event-registration-form';
        form.noValidate = true;

        const intro = document.createElement('p');
        intro.textContent = formData.description || 'Please complete the form to register for this event.';
        form.appendChild(intro);

        questions.forEach(function (question) {
            form.appendChild(renderQuestion(question));
        });

        const submitArea = document.createElement('div');
        submitArea.className = 'event-registration-actions';
        const submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.className = 'btn btn-primary';
        submitButton.textContent = eventData.registration_button_text || 'Submit';
        submitArea.appendChild(submitButton);
        form.appendChild(submitArea);

        form.addEventListener('submit', async function (submitEvent) {
            submitEvent.preventDefault();
            setStatus('', false);

            const invalidQuestion = questions.find(function (question) {
                const answer = collectQuestionValue(question, form);
                return Boolean(question.is_required) && !String(answer || '').trim();
            });

            if (invalidQuestion) {
                setStatus('Please complete the required question: ' + (invalidQuestion.question_text || 'Untitled question'), true);
                return;
            }

            try {
                const responseInsert = await client.from('event_form_responses').insert([{ form_id: formData.id }]).select().single();
                if (responseInsert.error) throw responseInsert.error;

                const responseId = responseInsert.data.id;
                const answerRows = questions.map(function (question) {
                    const answer = collectQuestionValue(question, form);
                    return {
                        response_id: responseId,
                        question_id: question.id,
                        answer: answer && String(answer).trim() ? answer : null
                    };
                }).filter(function (answerRow) {
                    return answerRow.answer !== null;
                });

                if (answerRows.length) {
                    const answerInsert = await client.from('event_form_answers').insert(answerRows);
                    if (answerInsert.error) throw answerInsert.error;
                }

                form.replaceChildren();
                const success = document.createElement('div');
                success.className = 'event-registration-success';
                const successTitle = document.createElement('h3');
                successTitle.textContent = 'Thank you for registering.';
                const successCopy = document.createElement('p');
                successCopy.textContent = 'Your response has been recorded for ' + (eventData.title || 'this event') + '.';
                success.append(successTitle, successCopy);
                form.appendChild(success);
                submitButton.disabled = true;
                setStatus('Your form has been submitted successfully.', false);
            } catch (error) {
                setStatus(error.message || 'Your response could not be submitted. Please try again.', true);
            }
        });

        formContainer.replaceChildren(form);
        titleEl.textContent = eventData.title || 'Event Registration';
        summaryEl.textContent = 'Complete the form below to register for this event.';
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

        if (!formData.is_published && eventData.is_published !== true) {
            setStatus('This form is not currently available for registration.', true);
            return;
        }

        await renderRegistrationForm(eventData, formData, questionResult.data || []);
    } catch (error) {
        setStatus(error.message || 'The event form could not be loaded.', true);
    }
});
