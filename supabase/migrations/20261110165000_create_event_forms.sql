create table if not exists public.event_forms (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    title text not null check (length(btrim(title)) between 1 and 160),
    description text check (description is null or length(btrim(description)) between 1 and 5000),
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists event_forms_event_idx
    on public.event_forms (event_id, created_at desc);

create index if not exists event_forms_published_idx
    on public.event_forms (is_published)
    where is_published = true;

create or replace function public.set_event_forms_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_event_forms_updated_at on public.event_forms;
create trigger set_event_forms_updated_at
    before update on public.event_forms
    for each row
    execute function public.set_event_forms_updated_at();

create table if not exists public.event_form_questions (
    id uuid primary key default gen_random_uuid(),
    form_id uuid not null references public.event_forms(id) on delete cascade,
    question_text text not null check (length(btrim(question_text)) between 1 and 500),
    description text check (description is null or length(btrim(description)) <= 1000),
    question_type text not null check (question_type in (
        'short_answer', 'paragraph', 'multiple_choice', 'checkbox', 'dropdown', 'date', 'number', 'email', 'phone'
    )),
    is_required boolean not null default false,
    options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
    display_order integer not null default 0 check (display_order >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists event_form_questions_form_order_idx
    on public.event_form_questions (form_id, display_order, created_at);

create or replace function public.set_event_form_questions_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_event_form_questions_updated_at on public.event_form_questions;
create trigger set_event_form_questions_updated_at
    before update on public.event_form_questions
    for each row
    execute function public.set_event_form_questions_updated_at();

create table if not exists public.event_form_responses (
    id uuid primary key default gen_random_uuid(),
    form_id uuid not null references public.event_forms(id) on delete cascade,
    submitted_at timestamptz not null default now()
);

create index if not exists event_form_responses_form_submitted_idx
    on public.event_form_responses (form_id, submitted_at desc);

create table if not exists public.event_form_answers (
    id uuid primary key default gen_random_uuid(),
    response_id uuid not null references public.event_form_responses(id) on delete cascade,
    question_id uuid not null references public.event_form_questions(id) on delete cascade,
    answer text,
    created_at timestamptz not null default now(),
    unique (response_id, question_id)
);

create index if not exists event_form_answers_response_idx
    on public.event_form_answers (response_id, question_id);

alter table public.events
    add column if not exists registration_method text not null default 'external_link'
        check (registration_method in ('external_link', 'internal_form')),
    add column if not exists form_id uuid,
    add constraint event_form_fk
    foreign key (form_id) references public.event_forms(id) on delete set null;

alter table public.events
    alter column description drop not null,
    alter column event_date drop not null;

alter table public.events
    add constraint event_registration_url_check
    check (
        registration_url is null
        or registration_url ~* '^https?://[^\s]+$'
    )
    not valid;

alter table public.events
    validate constraint event_registration_url_check;

alter table public.events enable row level security;

drop policy if exists "Published events and administrators can read events" on public.events;
create policy "Published events and administrators can read events"
    on public.events
    for select
    to anon, authenticated
    using (
        is_published
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

create policy "Public event forms are readable when connected to published events"
    on public.event_forms
    for select
    to anon, authenticated
    using (
        is_published
        and exists (
            select 1 from public.events e
            where e.id = event_forms.event_id and e.is_published = true
        )
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

create policy "Administrators can manage event forms"
    on public.event_forms
    for all
    to authenticated
    using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    )
    with check (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

create policy "Published form questions are viewable"
    on public.event_form_questions
    for select
    to anon, authenticated
    using (
        exists (
            select 1 from public.event_forms f
            where f.id = event_form_questions.form_id and f.is_published = true
        )
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

create policy "Administrators can manage form questions"
    on public.event_form_questions
    for all
    to authenticated
    using (
        exists (
            select 1 from public.event_forms f
            where f.id = event_form_questions.form_id
              and (
                  coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
                  or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
              )
        )
    )
    with check (
        exists (
            select 1 from public.event_forms f
            where f.id = event_form_questions.form_id
              and (
                  coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
                  or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
              )
        )
    );

create policy "Anyone can submit registrations"
    on public.event_form_responses
    for insert
    to anon, authenticated
    with check (true);

create policy "Administrators can view registrations"
    on public.event_form_responses
    for select
    to authenticated
    using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

create policy "Anyone can submit answers"
    on public.event_form_answers
    for insert
    to anon, authenticated
    with check (true);

create policy "Administrators can view answers"
    on public.event_form_answers
    for select
    to authenticated
    using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

alter table public.event_forms enable row level security;
alter table public.event_form_questions enable row level security;
alter table public.event_form_responses enable row level security;
alter table public.event_form_answers enable row level security;

grant select on public.event_forms to anon, authenticated;
grant insert, update, delete on public.event_forms to authenticated;
grant select on public.event_form_questions to anon, authenticated;
grant insert, update, delete on public.event_form_questions to authenticated;
grant select on public.event_form_responses to anon, authenticated;
grant insert on public.event_form_responses to anon, authenticated;
grant select on public.event_form_answers to anon, authenticated;
grant insert on public.event_form_answers to anon, authenticated;
