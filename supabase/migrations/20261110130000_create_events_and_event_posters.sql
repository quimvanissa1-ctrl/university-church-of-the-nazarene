create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    title text not null check (length(btrim(title)) between 1 and 160),
    description text not null check (length(btrim(description)) between 1 and 5000),
    event_date date not null,
    start_time time without time zone,
    end_time time without time zone,
    location text check (location is null or length(location) <= 240),
    poster_url text,
    registration_url text check (
        registration_url is null
        or registration_url ~* '^https://(docs\.google\.com/forms/[^[:space:]]*|forms\.gle/[^[:space:]]*)$'
    ),
    registration_button_text text not null default 'Register for Event'
        check (length(btrim(registration_button_text)) between 1 and 80),
    is_published boolean not null default false,
    is_featured boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists events_published_date_idx
    on public.events (event_date)
    where is_published = true;

create index if not exists events_featured_published_date_idx
    on public.events (event_date)
    where is_published = true and is_featured = true;

create or replace function public.set_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
    before update on public.events
    for each row
    execute function public.set_events_updated_at();

alter table public.events enable row level security;

grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

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

drop policy if exists "Administrators can insert events" on public.events;
create policy "Administrators can insert events"
    on public.events
    for insert
    to authenticated
    with check (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

drop policy if exists "Administrators can update events" on public.events;
create policy "Administrators can update events"
    on public.events
    for update
    to authenticated
    using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    )
    with check (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

drop policy if exists "Administrators can delete events" on public.events;
create policy "Administrators can delete events"
    on public.events
    for delete
    to authenticated
    using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

insert into public.events (
    id, title, description, event_date, location, is_published
)
values
    (md5('ucotn-legacy-event-1')::uuid, 'Medical Outreach in Ongata Rongai', 'Our team partnered with local clinics to provide free health screenings, medicines, and spiritual care for hundreds of families.', '2026-05-15', 'Local Health Clinics', true),
    (md5('ucotn-legacy-event-2')::uuid, 'Discipleship Training in East Africa', 'Leaders from multiple churches gathered for a week of training that equipped them to lead small groups and outreach teams.', '2026-03-10', 'Regional Church Partners', true),
    (md5('ucotn-legacy-event-3')::uuid, 'Child Sponsorship Blessings', 'Through sponsorship, children received school supplies, mentorship, and encouragement to pursue education and faith.', '2026-01-22', 'Community Schools', true),
    (md5('ucotn-legacy-event-4')::uuid, 'Hiking Event', 'Join us for a refreshing outdoor hike where faith, fellowship, and nature come together.', '2026-07-15', 'Ngong Hills', true),
    (md5('ucotn-legacy-event-5')::uuid, 'Sunday Bible Study', 'Join a study group focused on Scripture, prayer, and practical discipleship.', '2026-06-08', 'University Church of the Nazarene', true),
    (md5('ucotn-legacy-event-6')::uuid, 'Main Sunday Service', 'Gather for worship, teaching, and community connection in our main Sunday celebration.', '2026-06-08', 'University Church of the Nazarene', true),
    (md5('ucotn-legacy-event-7')::uuid, 'Community Feed in Kajiado', 'Serving meals and sharing Christ''s love with families in need across the community.', '2026-08-12', 'Ongata Rongai Community Center', true),
    (md5('ucotn-legacy-event-8')::uuid, 'School Supply Drive', 'Collecting and distributing school supplies to children preparing for the new academic year.', '2026-07-30', 'Local Schools', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-posters', 'event-posters', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Event posters are publicly viewable" on storage.objects;
create policy "Event posters are publicly viewable"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'event-posters');

drop policy if exists "Administrators can upload event posters" on storage.objects;
create policy "Administrators can upload event posters"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'event-posters'
        and (
            coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
            or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
        )
    );

drop policy if exists "Administrators can replace event posters" on storage.objects;
create policy "Administrators can replace event posters"
    on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'event-posters'
        and (
            coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
            or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
        )
    )
    with check (
        bucket_id = 'event-posters'
        and (
            coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
            or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
        )
    );

drop policy if exists "Administrators can delete event posters" on storage.objects;
create policy "Administrators can delete event posters"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'event-posters'
        and (
            coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
            or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
        )
    );
