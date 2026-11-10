(function () {
    const client = window.supabaseClient;
    const bucketName = 'leader-photos';
    const maximumPhotoSize = 5 * 1024 * 1024;
    const allowedPhotoTypes = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif'
    };
    const state = {
        leaders: [],
        initialized: false,
        saving: false,
        busyLeaderIds: new Set(),
        editingLeader: null,
        photoObjectUrl: null
    };
    const elements = {};

    function showMessage(element, message, isError) {
        element.textContent = message;
        element.hidden = false;
        element.classList.toggle('is-error', Boolean(isError));
    }

    function safeHttpsUrl(value) {
        if (typeof value !== 'string') {
            return null;
        }
        try {
            const url = new URL(value.trim());
            return url.protocol === 'https:' ? url.href : null;
        } catch (error) {
            return null;
        }
    }

    function getPhotoUrl(imageUrl) {
        if (!imageUrl) {
            return '';
        }
        if (/^https:\/\//i.test(imageUrl)) {
            return imageUrl;
        }
        return client.storage.from(bucketName).getPublicUrl(imageUrl).data.publicUrl;
    }

    function getPhotoPath(imageUrl) {
        if (!imageUrl) {
            return null;
        }
        if (!/^https:\/\//i.test(imageUrl)) {
            return imageUrl;
        }

        const marker = '/storage/v1/object/public/' + bucketName + '/';
        const pathStart = imageUrl.indexOf(marker);
        if (pathStart === -1) {
            return null;
        }
        try {
            return decodeURIComponent(imageUrl.slice(pathStart + marker.length));
        } catch (error) {
            return null;
        }
    }

    function createActionButton(label, action, leaderId, disabled) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'event-action-button';
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.leaderId = leaderId;
        button.disabled = Boolean(disabled);
        return button;
    }

    function sortLeaders(leaders) {
        return leaders.slice().sort(function (left, right) {
            return left.display_order - right.display_order ||
                new Date(left.created_at) - new Date(right.created_at) ||
                left.id.localeCompare(right.id);
        });
    }

    function renderLeaderRow(leader) {
        const row = document.createElement('article');
        row.className = 'leader-row';

        const photo = document.createElement('div');
        photo.className = 'leader-row-photo';
        if (leader.image_url) {
            const image = document.createElement('img');
            image.src = getPhotoUrl(leader.image_url);
            image.alt = '';
            image.loading = 'lazy';
            photo.appendChild(image);
        } else {
            photo.textContent = leader.name.trim().charAt(0).toUpperCase();
        }

        const details = document.createElement('div');
        details.className = 'leader-row-details';
        const title = document.createElement('h3');
        title.textContent = leader.name;
        const description = document.createElement('p');
        description.textContent = leader.position + (leader.department ? ' · ' + leader.department : '');
        const statuses = document.createElement('div');
        statuses.className = 'leader-row-statuses';
        const publication = document.createElement('span');
        publication.className = 'leader-status' + (leader.is_published ? ' is-published' : '');
        publication.textContent = leader.is_published ? 'Published' : 'Unpublished';
        const order = document.createElement('span');
        order.className = 'leader-status';
        order.textContent = 'Order ' + leader.display_order;
        statuses.append(publication, order);
        details.append(title, description, statuses);

        const actions = document.createElement('div');
        actions.className = 'leader-row-actions';
        const isBusy = state.busyLeaderIds.has(leader.id);
        actions.append(
            createActionButton('Edit', 'edit', leader.id, isBusy),
            createActionButton('Preview', 'preview', leader.id, isBusy),
            createActionButton(leader.is_published ? 'Unpublish' : 'Publish', 'publish', leader.id, isBusy),
            createActionButton('Delete', 'delete', leader.id, isBusy)
        );
        row.append(photo, details, actions);
        return row;
    }

    function filteredLeaders() {
        const search = elements.search.value.trim().toLocaleLowerCase();
        const publication = elements.publicationFilter.value;
        const department = elements.departmentFilter.value;

        return sortLeaders(state.leaders).filter(function (leader) {
            const matchesSearch = !search ||
                leader.name.toLocaleLowerCase().includes(search) ||
                leader.position.toLocaleLowerCase().includes(search) ||
                (leader.department || '').toLocaleLowerCase().includes(search);
            const matchesPublication = publication === 'all' ||
                (publication === 'published' ? leader.is_published : !leader.is_published);
            const matchesDepartment = department === 'all' || leader.department === department;
            return matchesSearch && matchesPublication && matchesDepartment;
        });
    }

    function updateDepartmentFilter() {
        const selected = elements.departmentFilter.value;
        const departments = Array.from(new Set(state.leaders
            .map(function (leader) { return leader.department; })
            .filter(Boolean)))
            .sort(function (left, right) { return left.localeCompare(right); });
        elements.departmentFilter.replaceChildren(new Option('All departments', 'all'));
        departments.forEach(function (department) {
            elements.departmentFilter.add(new Option(department, department));
        });
        elements.departmentFilter.value = departments.includes(selected) ? selected : 'all';
    }

    function renderLeaders() {
        const leaders = filteredLeaders();
        elements.list.replaceChildren.apply(elements.list, leaders.map(renderLeaderRow));
        elements.list.setAttribute('aria-busy', 'false');
        elements.status.textContent = state.leaders.length === 0
            ? 'No leaders yet. Add a profile to get started.'
            : leaders.length === 0
                ? 'No leaders match these filters.'
                : leaders.length + (leaders.length === 1 ? ' leader' : ' leaders');
    }

    async function loadLeaders() {
        elements.list.setAttribute('aria-busy', 'true');
        elements.status.textContent = 'Loading leaders…';
        try {
            const result = await client
                .from('leaders')
                .select('*')
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: true });
            if (result.error) {
                throw result.error;
            }

            state.leaders = result.data || [];
            updateDepartmentFilter();
            elements.feedback.hidden = true;
            renderLeaders();
            return true;
        } catch (error) {
            state.leaders = [];
            elements.list.replaceChildren();
            elements.status.textContent = 'Leaders could not be loaded.';
            elements.list.setAttribute('aria-busy', 'false');
            showMessage(elements.feedback, error.message || 'Check the leaders table and your Leaders Management permission, then try again.', true);
            return false;
        }
    }

    function clearPhotoPreview() {
        if (state.photoObjectUrl) {
            URL.revokeObjectURL(state.photoObjectUrl);
            state.photoObjectUrl = null;
        }
        elements.photoPreview.hidden = true;
        elements.photoPreviewImage.replaceChildren();
        elements.removePhotoControl.hidden = true;
        elements.form.elements.remove_photo.checked = false;
    }

    function showPhotoPreview(url, canRemove) {
        if (state.photoObjectUrl && url !== state.photoObjectUrl) {
            URL.revokeObjectURL(state.photoObjectUrl);
            state.photoObjectUrl = null;
        }
        const image = document.createElement('img');
        image.src = url;
        image.alt = 'Leader photograph preview';
        elements.photoPreviewImage.replaceChildren(image);
        elements.photoPreview.hidden = false;
        elements.removePhotoControl.hidden = !canRemove;
        elements.form.elements.remove_photo.checked = false;
    }

    function closeLeaderDialog() {
        elements.dialog.close();
        elements.form.reset();
        clearPhotoPreview();
        elements.formMessage.hidden = true;
        state.editingLeader = null;
    }

    function nextDisplayOrder() {
        return state.leaders.reduce(function (maximum, leader) {
            return Math.max(maximum, leader.display_order);
        }, -1) + 1;
    }

    function openLeaderDialog(leader) {
        state.editingLeader = leader || null;
        elements.form.reset();
        clearPhotoPreview();
        elements.formMessage.hidden = true;
        elements.dialogTitle.textContent = leader ? 'Edit leader' : 'Add leader';
        elements.saveButton.dataset.idleLabel = leader ? 'Save changes' : 'Save leader';
        elements.saveButton.querySelector('.button-label').textContent = elements.saveButton.dataset.idleLabel;

        if (leader) {
            elements.form.elements.name.value = leader.name || '';
            elements.form.elements.position.value = leader.position || '';
            elements.form.elements.biography.value = leader.biography || '';
            elements.form.elements.department.value = leader.department || '';
            elements.form.elements.display_order.value = leader.display_order;
            elements.form.elements.email.value = leader.email || '';
            elements.form.elements.phone.value = leader.phone || '';
            elements.form.elements.social_links.value = Object.entries(leader.social_links || {})
                .map(function (entry) { return entry[0] + ' | ' + entry[1]; })
                .join('\n');
            elements.form.elements.is_published.checked = Boolean(leader.is_published);
            if (leader.image_url) {
                showPhotoPreview(getPhotoUrl(leader.image_url), true);
            }
        } else {
            elements.form.elements.display_order.value = nextDisplayOrder();
        }

        elements.dialog.showModal();
        elements.form.elements.name.focus();
    }

    function readSocialLinks(value) {
        const links = {};
        value.split(/\r?\n/).map(function (line) {
            return line.trim();
        }).filter(Boolean).forEach(function (line, index) {
            const separator = line.indexOf('|');
            const label = separator === -1 ? 'Link ' + (index + 1) : line.slice(0, separator).trim();
            const urlText = separator === -1 ? line : line.slice(separator + 1).trim();
            const url = safeHttpsUrl(urlText);
            if (!label || !url) {
                throw new Error('Social media links must use the format Label | https://…');
            }
            const key = label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'link_' + (index + 1);
            if (Object.prototype.hasOwnProperty.call(links, key)) {
                throw new Error('Each social media link must have a different label.');
            }
            links[key] = url;
        });
        return links;
    }

    function getFormValues() {
        return {
            name: elements.form.elements.name.value.trim(),
            position: elements.form.elements.position.value.trim(),
            biography: elements.form.elements.biography.value.trim() || null,
            department: elements.form.elements.department.value.trim() || null,
            email: elements.form.elements.email.value.trim() || null,
            phone: elements.form.elements.phone.value.trim() || null,
            social_links: readSocialLinks(elements.form.elements.social_links.value),
            display_order: Number(elements.form.elements.display_order.value),
            is_published: elements.form.elements.is_published.checked
        };
    }

    function appendProfileLink(parent, label, url) {
        const safeUrl = safeHttpsUrl(url);
        if (!safeUrl) {
            return;
        }
        const link = document.createElement('a');
        link.href = safeUrl;
        link.textContent = label;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        parent.appendChild(link);
    }

    function renderProfilePreview(leader, imageUrl) {
        elements.previewContent.replaceChildren();
        const profile = document.createElement('article');
        profile.className = 'leader-preview-profile';

        const photo = document.createElement('div');
        photo.className = 'leader-preview-photo';
        if (imageUrl) {
            const image = document.createElement('img');
            image.src = imageUrl;
            image.alt = leader.name ? leader.name + ' profile photograph' : 'Leader profile photograph';
            photo.appendChild(image);
        } else {
            photo.textContent = leader.name ? leader.name.trim().charAt(0).toUpperCase() : '👤';
        }
        profile.appendChild(photo);

        const name = document.createElement('h3');
        name.textContent = leader.name || 'Full name';
        const position = document.createElement('p');
        position.className = 'leader-preview-position';
        position.textContent = leader.position || 'Leadership title or position';
        profile.append(name, position);

        [leader.department, leader.biography].filter(Boolean).forEach(function (text) {
            const paragraph = document.createElement('p');
            paragraph.textContent = text;
            profile.appendChild(paragraph);
        });

        const contacts = document.createElement('div');
        contacts.className = 'leader-preview-links';
        if (leader.email) {
            const email = document.createElement('a');
            email.href = 'mailto:' + leader.email;
            email.textContent = leader.email;
            contacts.appendChild(email);
        }
        if (leader.phone) {
            const phone = document.createElement('a');
            phone.href = 'tel:' + leader.phone.replace(/[^\d+*#,;]/g, '');
            phone.textContent = leader.phone;
            contacts.appendChild(phone);
        }
        Object.keys(leader.social_links || {}).forEach(function (label) {
            appendProfileLink(contacts, label, leader.social_links[label]);
        });
        if (contacts.childElementCount) {
            profile.appendChild(contacts);
        }
        elements.previewContent.appendChild(profile);
        elements.previewDialog.showModal();
    }

    function previewCurrentForm() {
        try {
            const values = getFormValues();
            const selectedPhoto = elements.form.elements.photo.files[0];
            const imageUrl = selectedPhoto
                ? state.photoObjectUrl
                : elements.form.elements.remove_photo.checked
                    ? ''
                    : state.editingLeader && state.editingLeader.image_url
                        ? getPhotoUrl(state.editingLeader.image_url)
                        : '';
            renderProfilePreview(values, imageUrl);
        } catch (error) {
            showMessage(elements.formMessage, error.message, true);
        }
    }

    function validatePhoto(file) {
        if (!file) {
            return null;
        }
        if (!allowedPhotoTypes[file.type]) {
            return 'Choose a JPG, PNG, WebP, or GIF image.';
        }
        if (file.size > maximumPhotoSize) {
            return 'The profile photograph must be 5 MB or smaller.';
        }
        return null;
    }

    async function removePhotoIfUnused(photoPath, currentLeaderId) {
        if (!photoPath) {
            return null;
        }
        try {
            const result = await client
                .from('leaders')
                .select('id')
                .eq('image_url', photoPath)
                .neq('id', currentLeaderId)
                .limit(1)
                .maybeSingle();
            if (result.error) {
                return result.error;
            }
            if (result.data) {
                return null;
            }
            const removal = await client.storage.from(bucketName).remove([photoPath]);
            return removal.error || null;
        } catch (error) {
            return error;
        }
    }

    async function saveLeader() {
        if (state.saving) {
            return;
        }
        if (!elements.form.reportValidity()) {
            return;
        }

        state.saving = true;
        elements.saveButton.disabled = true;
        elements.saveButton.classList.add('is-loading');
        elements.saveButton.querySelector('.button-label').textContent = 'Saving…';
        elements.formMessage.hidden = true;

        let values;
        try {
            values = getFormValues();
        } catch (error) {
            showMessage(elements.formMessage, error.message, true);
            state.saving = false;
            elements.saveButton.disabled = false;
            elements.saveButton.classList.remove('is-loading');
            elements.saveButton.querySelector('.button-label').textContent = elements.saveButton.dataset.idleLabel;
            return;
        }

        if (!values.name || !values.position || !Number.isInteger(values.display_order) || values.display_order < 0) {
            showMessage(elements.formMessage, 'Enter a name, position, and a non-negative whole-number display order.', true);
            state.saving = false;
            elements.saveButton.disabled = false;
            elements.saveButton.classList.remove('is-loading');
            elements.saveButton.querySelector('.button-label').textContent = elements.saveButton.dataset.idleLabel;
            return;
        }

        const photoFile = elements.form.elements.photo.files[0] || null;
        const photoError = validatePhoto(photoFile);
        if (photoError) {
            showMessage(elements.formMessage, photoError, true);
            state.saving = false;
            elements.saveButton.disabled = false;
            elements.saveButton.classList.remove('is-loading');
            elements.saveButton.querySelector('.button-label').textContent = elements.saveButton.dataset.idleLabel;
            return;
        }

        const currentLeader = state.editingLeader;
        const leaderId = currentLeader ? currentLeader.id : crypto.randomUUID();
        const previousPhoto = getPhotoPath(currentLeader && currentLeader.image_url);
        let newPhotoPath = null;

        try {
            if (photoFile) {
                newPhotoPath = leaderId + '/' + crypto.randomUUID() + '.' + allowedPhotoTypes[photoFile.type];
                const upload = await client.storage.from(bucketName).upload(newPhotoPath, photoFile, {
                    cacheControl: '3600',
                    contentType: photoFile.type,
                    upsert: false
                });
                if (upload.error) {
                    throw upload.error;
                }
                values.image_url = newPhotoPath;
            } else if (currentLeader && elements.form.elements.remove_photo.checked) {
                values.image_url = null;
            } else {
                values.image_url = currentLeader ? currentLeader.image_url : null;
            }

            const result = currentLeader
                ? await client.from('leaders').update(values).eq('id', leaderId).select().single()
                : await client.from('leaders').insert([{ id: leaderId, ...values }]).select().single();
            if (result.error) {
                throw result.error;
            }

            const shouldRemoveOldPhoto = previousPhoto &&
                (newPhotoPath || elements.form.elements.remove_photo.checked) &&
                previousPhoto !== newPhotoPath;
            const cleanupError = shouldRemoveOldPhoto
                ? await removePhotoIfUnused(previousPhoto, leaderId)
                : null;

            closeLeaderDialog();
            const listLoaded = await loadLeaders();
            if (listLoaded) {
                showMessage(elements.feedback, cleanupError
                    ? 'Leader saved, but the previous photograph could not be removed from storage.'
                    : currentLeader ? 'Leader updated.' : 'Leader created.', Boolean(cleanupError));
            } else {
                showMessage(elements.feedback, 'Leader saved, but the leaders list could not be refreshed.', true);
            }
        } catch (error) {
            if (newPhotoPath) {
                const cleanup = await client.storage.from(bucketName).remove([newPhotoPath]);
                if (cleanup.error) {
                    console.error('Unable to remove a photograph uploaded for a leader that was not saved:', cleanup.error);
                }
            }
            showMessage(elements.formMessage, error.message || 'The leader could not be saved. Please try again.', true);
        } finally {
            state.saving = false;
            elements.saveButton.disabled = false;
            elements.saveButton.classList.remove('is-loading');
            elements.saveButton.querySelector('.button-label').textContent = elements.saveButton.dataset.idleLabel;
        }
    }

    async function updateLeader(leaderId, updates) {
        if (state.busyLeaderIds.has(leaderId)) {
            return;
        }
        state.busyLeaderIds.add(leaderId);
        renderLeaders();
        try {
            const result = await client.from('leaders').update(updates).eq('id', leaderId).select('id').single();
            if (result.error) {
                throw result.error;
            }
            if (await loadLeaders()) {
                showMessage(elements.feedback, 'Leader updated.', false);
            } else {
                showMessage(elements.feedback, 'Leader updated, but the leaders list could not be refreshed.', true);
            }
        } catch (error) {
            showMessage(elements.feedback, error.message || 'The leader could not be updated.', true);
        } finally {
            state.busyLeaderIds.delete(leaderId);
            renderLeaders();
        }
    }

    async function deleteLeader(leader) {
        if (!window.confirm('Delete "' + leader.name + '"? This action cannot be undone.')) {
            return;
        }
        if (state.busyLeaderIds.has(leader.id)) {
            return;
        }

        state.busyLeaderIds.add(leader.id);
        renderLeaders();
        try {
            const result = await client.from('leaders').delete().eq('id', leader.id).select('id').single();
            if (result.error) {
                throw result.error;
            }
            const photoPath = getPhotoPath(leader.image_url);
            const cleanupError = await removePhotoIfUnused(photoPath, leader.id);
            if (await loadLeaders()) {
                showMessage(elements.feedback, cleanupError
                    ? 'Leader deleted, but the photograph could not be removed from storage.'
                    : 'Leader deleted.', Boolean(cleanupError));
            } else {
                showMessage(elements.feedback, 'Leader deleted, but the leaders list could not be refreshed.', true);
            }
        } catch (error) {
            showMessage(elements.feedback, error.message || 'The leader could not be deleted.', true);
        } finally {
            state.busyLeaderIds.delete(leader.id);
            renderLeaders();
        }
    }

    function handleListClick(event) {
        const button = event.target.closest('[data-action]');
        if (!button) {
            return;
        }
        const leader = state.leaders.find(function (item) {
            return item.id === button.dataset.leaderId;
        });
        if (!leader) {
            return;
        }

        if (button.dataset.action === 'edit') {
            openLeaderDialog(leader);
        } else if (button.dataset.action === 'preview') {
            renderProfilePreview(leader, leader.image_url ? getPhotoUrl(leader.image_url) : '');
        } else if (button.dataset.action === 'publish') {
            updateLeader(leader.id, { is_published: !leader.is_published });
        } else if (button.dataset.action === 'delete') {
            deleteLeader(leader);
        }
    }

    function initialize() {
        if (!client) {
            showMessage(elements.feedback, window.supabaseConfigError || 'Supabase is not configured.', true);
            elements.status.textContent = 'Leaders are unavailable.';
            return;
        }
        if (state.initialized) {
            loadLeaders();
            return;
        }
        state.initialized = true;

        elements.addButton.addEventListener('click', function () { openLeaderDialog(null); });
        elements.closeButton.addEventListener('click', closeLeaderDialog);
        elements.cancelButton.addEventListener('click', closeLeaderDialog);
        elements.dialog.addEventListener('click', function (event) {
            if (event.target === elements.dialog) {
                closeLeaderDialog();
            }
        });
        elements.dialog.addEventListener('cancel', function (event) {
            event.preventDefault();
            closeLeaderDialog();
        });
        elements.form.addEventListener('submit', function (event) {
            event.preventDefault();
            saveLeader();
        });
        elements.list.addEventListener('click', handleListClick);
        [elements.search, elements.publicationFilter, elements.departmentFilter].forEach(function (input) {
            input.addEventListener('input', renderLeaders);
            input.addEventListener('change', renderLeaders);
        });
        elements.photoPreviewButton.addEventListener('click', previewCurrentForm);
        elements.closePreviewButton.addEventListener('click', function () { elements.previewDialog.close(); });
        elements.photoInput.addEventListener('change', function () {
            const file = elements.photoInput.files[0];
            const error = validatePhoto(file);
            if (error) {
                elements.photoInput.value = '';
                showMessage(elements.formMessage, error, true);
                if (state.editingLeader && state.editingLeader.image_url) {
                    showPhotoPreview(getPhotoUrl(state.editingLeader.image_url), true);
                } else {
                    clearPhotoPreview();
                }
                return;
            }
            if (file) {
                elements.form.elements.remove_photo.checked = false;
                if (state.photoObjectUrl) {
                    URL.revokeObjectURL(state.photoObjectUrl);
                }
                state.photoObjectUrl = URL.createObjectURL(file);
                showPhotoPreview(state.photoObjectUrl, false);
            } else if (state.editingLeader && state.editingLeader.image_url) {
                showPhotoPreview(getPhotoUrl(state.editingLeader.image_url), true);
            } else {
                clearPhotoPreview();
            }
        });
        elements.form.elements.remove_photo.addEventListener('change', function () {
            if (elements.form.elements.remove_photo.checked) {
                elements.photoInput.value = '';
                if (state.photoObjectUrl) {
                    URL.revokeObjectURL(state.photoObjectUrl);
                    state.photoObjectUrl = null;
                }
                elements.photoPreview.hidden = true;
            } else if (state.editingLeader && state.editingLeader.image_url) {
                showPhotoPreview(getPhotoUrl(state.editingLeader.image_url), true);
            }
        });

        loadLeaders();
    }

    window.initializeLeadersManagement = function () {
        if (!elements.list) {
            elements.addButton = document.getElementById('add-leader-button');
            elements.cancelButton = document.getElementById('cancel-leader-button');
            elements.closeButton = document.getElementById('close-leader-dialog');
            elements.dialog = document.getElementById('leader-dialog');
            elements.dialogTitle = document.getElementById('leader-dialog-title');
            elements.feedback = document.getElementById('leaders-feedback');
            elements.form = document.getElementById('leader-form');
            elements.formMessage = document.getElementById('leader-form-message');
            elements.list = document.getElementById('leaders-list');
            elements.photoInput = document.getElementById('leader-photo');
            elements.photoPreview = document.getElementById('leader-photo-preview');
            elements.photoPreviewImage = document.getElementById('leader-photo-preview-image');
            elements.photoPreviewButton = document.getElementById('preview-leader-button');
            elements.removePhotoControl = document.getElementById('remove-leader-photo-control');
            elements.previewDialog = document.getElementById('leader-preview-dialog');
            elements.previewContent = document.getElementById('leader-preview-content');
            elements.closePreviewButton = document.getElementById('close-leader-preview');
            elements.saveButton = document.getElementById('save-leader-button');
            elements.search = document.getElementById('leader-search');
            elements.publicationFilter = document.getElementById('leader-publication-filter');
            elements.departmentFilter = document.getElementById('leader-department-filter');
            elements.status = document.getElementById('leaders-list-status');
        }
        initialize();
    };
})();
