create table if not exists public.leaders (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) between 1 and 160),
    position text not null check (length(btrim(position)) between 1 and 160),
    biography text check (biography is null or length(biography) <= 5000),
    department text check (department is null or length(btrim(department)) <= 160),
    image_url text check (image_url is null or length(image_url) <= 2048),
    email text check (
        email is null
        or (length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    ),
    phone text check (phone is null or length(btrim(phone)) <= 40),
    social_links jsonb not null default '{}'::jsonb check (jsonb_typeof(social_links) = 'object'),
    display_order integer not null default 0 check (display_order >= 0),
    is_published boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists leaders_name_normalized_uidx
    on public.leaders (lower(btrim(name)));

create index if not exists leaders_published_order_idx
    on public.leaders (display_order, created_at, id)
    where is_published = true;

create or replace function public.set_leaders_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_leaders_updated_at on public.leaders;
create trigger set_leaders_updated_at
    before update on public.leaders
    for each row
    execute function public.set_leaders_updated_at();

create or replace function public.has_leaders_management_permission()
returns boolean
language sql
stable
set search_path = ''
as $$
    select
        coalesce(metadata ->> 'role' = 'leaders_manager', false)
        or coalesce((metadata -> 'roles') ? 'leaders_manager', false)
        or case jsonb_typeof(metadata -> 'permissions')
            when 'array' then coalesce((metadata -> 'permissions') ? 'leaders_management', false)
            when 'object' then coalesce(metadata -> 'permissions' -> 'leaders_management' = 'true'::jsonb, false)
            else
                coalesce(metadata ->> 'role' = 'admin', false)
                or coalesce((metadata -> 'roles') ? 'admin', false)
        end
    from (select coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb) as metadata) as claims;
$$;

revoke all on function public.has_leaders_management_permission() from public;
grant execute on function public.has_leaders_management_permission() to anon, authenticated;

alter table public.leaders enable row level security;

grant select on public.leaders to anon, authenticated;
grant insert, update, delete on public.leaders to authenticated;

drop policy if exists "Published leaders and managers can read leaders" on public.leaders;
create policy "Published leaders and managers can read leaders"
    on public.leaders
    for select
    to anon, authenticated
    using (is_published or public.has_leaders_management_permission());

drop policy if exists "Leaders managers can insert leaders" on public.leaders;
create policy "Leaders managers can insert leaders"
    on public.leaders
    for insert
    to authenticated
    with check (public.has_leaders_management_permission());

drop policy if exists "Leaders managers can update leaders" on public.leaders;
create policy "Leaders managers can update leaders"
    on public.leaders
    for update
    to authenticated
    using (public.has_leaders_management_permission())
    with check (public.has_leaders_management_permission());

drop policy if exists "Leaders managers can delete leaders" on public.leaders;
create policy "Leaders managers can delete leaders"
    on public.leaders
    for delete
    to authenticated
    using (public.has_leaders_management_permission());

insert into public.leaders (id, name, position, department, display_order, is_published)
select seed.id, seed.name, seed.position, 'Pastoral Team', seed.display_order, true
from (
    values
        (md5('ucotn-leader-richard-awanda')::uuid, 'Rev. Richard Awanda', 'Lead Pastor', 0),
        (md5('ucotn-leader-charles-onyango')::uuid, 'Rev. Charles Onyango', 'Associate Minister', 1)
) as seed(id, name, position, display_order)
where not exists (
    select 1
    from public.leaders as existing
    where lower(btrim(existing.name)) = lower(btrim(seed.name))
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leader-photos', 'leader-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Leader photos are publicly viewable" on storage.objects;
create policy "Leader photos are publicly viewable"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'leader-photos');

drop policy if exists "Leaders managers can upload leader photos" on storage.objects;
create policy "Leaders managers can upload leader photos"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'leader-photos'
        and public.has_leaders_management_permission()
    );

drop policy if exists "Leaders managers can replace leader photos" on storage.objects;
create policy "Leaders managers can replace leader photos"
    on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'leader-photos'
        and public.has_leaders_management_permission()
    )
    with check (
        bucket_id = 'leader-photos'
        and public.has_leaders_management_permission()
    );

drop policy if exists "Leaders managers can delete leader photos" on storage.objects;
create policy "Leaders managers can delete leader photos"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'leader-photos'
        and public.has_leaders_management_permission()
    );
