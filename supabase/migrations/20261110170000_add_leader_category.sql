alter table public.leaders
    add column if not exists category text;

update public.leaders
set category = 'church_leaders'
where category is null
   or category not in ('church_leaders', 'ministries_leaders');

alter table public.leaders
    alter column category set default 'church_leaders',
    alter column category set not null;

alter table public.leaders
    drop constraint if exists leaders_category_check;

alter table public.leaders
    add constraint leaders_category_check
    check (category in ('church_leaders', 'ministries_leaders'));

create index if not exists leaders_category_published_order_idx
    on public.leaders (category, display_order, created_at, id)
    where is_published = true;
