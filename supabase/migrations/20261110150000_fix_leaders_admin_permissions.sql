create or replace function public.has_leaders_management_permission()
returns boolean
language sql
stable
set search_path = ''
as $$
    select
        coalesce(metadata ->> 'role' = 'admin', false)
        or coalesce((metadata -> 'roles') ? 'admin', false)
        or coalesce(metadata ->> 'role' = 'leaders_manager', false)
        or coalesce((metadata -> 'roles') ? 'leaders_manager', false)
        or case jsonb_typeof(metadata -> 'permissions')
            when 'array' then coalesce((metadata -> 'permissions') ? 'leaders_management', false)
            when 'object' then coalesce(metadata -> 'permissions' -> 'leaders_management' = 'true'::jsonb, false)
            else false
        end
    from (select coalesce(auth.jwt() -> 'app_metadata', '{}'::jsonb) as metadata) as claims;
$$;
