alter table public.event_form_answers
    add column if not exists question_text text,
    add column if not exists display_order integer;

update public.event_form_answers as answer
set question_text = question.question_text,
    display_order = question.display_order
from public.event_form_questions as question
where answer.question_id = question.id
  and (answer.question_text is null or answer.display_order is null);

update public.event_form_answers
set question_text = 'Question'
where question_text is null;

update public.event_form_answers
set display_order = 0
where display_order is null;

alter table public.event_form_answers
    alter column question_text set not null,
    alter column display_order set default 0,
    alter column display_order set not null,
    alter column question_id drop not null;

alter table public.event_form_answers
    drop constraint if exists event_form_answers_question_id_fkey;

alter table public.event_form_answers
    add constraint event_form_answers_question_id_fkey
    foreign key (question_id) references public.event_form_questions(id) on delete set null;

drop policy if exists "Public event forms are readable when connected to published events" on public.event_forms;
create policy "Public event forms are readable when connected to published events"
    on public.event_forms
    for select
    to anon, authenticated
    using (
        (
            is_published
            and exists (
                select 1
                from public.events as event
                where event.id = event_forms.event_id
                  and event.is_published = true
                  and event.registration_method = 'internal_form'
                  and event.form_id = event_forms.id
            )
        )
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

drop policy if exists "Published form questions are viewable" on public.event_form_questions;
create policy "Published form questions are viewable"
    on public.event_form_questions
    for select
    to anon, authenticated
    using (
        exists (
            select 1
            from public.event_forms as form
            join public.events as event on event.id = form.event_id
            where form.id = event_form_questions.form_id
              and form.is_published = true
              and event.is_published = true
              and event.registration_method = 'internal_form'
              and event.form_id = form.id
        )
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

drop policy if exists "Anyone can submit registrations" on public.event_form_responses;
drop policy if exists "Anyone can submit answers" on public.event_form_answers;
revoke insert on public.event_form_responses from anon, authenticated;
revoke insert on public.event_form_answers from anon, authenticated;

create or replace function public.submit_event_form_response(p_form_id uuid, p_answers jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    response_id uuid;
begin
    if jsonb_typeof(p_answers) is distinct from 'array' then
        raise exception 'Answers must be supplied as an array.';
    end if;

    if not exists (
        select 1
        from public.event_forms as form
        join public.events as event on event.id = form.event_id
        where form.id = p_form_id
          and form.is_published = true
          and event.is_published = true
          and event.registration_method = 'internal_form'
          and event.form_id = form.id
    ) then
        raise exception 'This registration form is not available.';
    end if;

    if not exists (
        select 1
        from public.event_form_questions as question
        where question.form_id = p_form_id
    ) then
        raise exception 'This registration form has no questions.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_answers) as submitted(value)
        where jsonb_typeof(submitted.value) is distinct from 'object'
           or submitted.value ->> 'question_id' is null
           or submitted.value ->> 'question_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           or coalesce(jsonb_typeof(submitted.value -> 'answer'), 'string') not in ('string', 'null')
    ) then
        raise exception 'One or more answers are invalid.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_answers) as submitted(value)
        group by (submitted.value ->> 'question_id')::uuid
        having count(*) > 1
    ) then
        raise exception 'A question may only be answered once.';
    end if;

    if exists (
        select 1
        from jsonb_array_elements(p_answers) as submitted(value)
        where not exists (
            select 1
            from public.event_form_questions as question
            where question.id = (submitted.value ->> 'question_id')::uuid
              and question.form_id = p_form_id
        )
    ) then
        raise exception 'An answer refers to a question outside this form.';
    end if;

    if exists (
        select 1
        from public.event_form_questions as question
        where question.form_id = p_form_id
          and question.is_required
          and not exists (
              select 1
              from jsonb_array_elements(p_answers) as submitted(value)
              where (submitted.value ->> 'question_id')::uuid = question.id
                and length(btrim(coalesce(submitted.value ->> 'answer', ''))) > 0
          )
    ) then
        raise exception 'Please answer all required questions.';
    end if;

    insert into public.event_form_responses (form_id)
    values (p_form_id)
    returning id into response_id;

    insert into public.event_form_answers (
        response_id,
        question_id,
        question_text,
        display_order,
        answer
    )
    select
        response_id,
        question.id,
        question.question_text,
        question.display_order,
        nullif(btrim(submitted.value ->> 'answer'), '')
    from public.event_form_questions as question
    left join lateral (
        select item.value
        from jsonb_array_elements(p_answers) as item(value)
        where (item.value ->> 'question_id')::uuid = question.id
        limit 1
    ) as submitted on true
    where question.form_id = p_form_id;

    return response_id;
end;
$$;

revoke all on function public.submit_event_form_response(uuid, jsonb) from public;
grant execute on function public.submit_event_form_response(uuid, jsonb) to anon, authenticated;
