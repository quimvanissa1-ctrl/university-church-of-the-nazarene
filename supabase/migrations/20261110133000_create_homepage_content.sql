create table if not exists public.homepage_sections (
    section_id text primary key check (
        section_id in (
            'hero',
            'theme',
            'about',
            'sermons',
            'services',
            'ministries',
            'leaders',
            'events'
        )
    ),
    content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
    is_published boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.set_homepage_sections_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_homepage_sections_updated_at on public.homepage_sections;
create trigger set_homepage_sections_updated_at
    before update on public.homepage_sections
    for each row
    execute function public.set_homepage_sections_updated_at();

alter table public.homepage_sections enable row level security;

grant select on public.homepage_sections to anon, authenticated;
grant insert, update, delete on public.homepage_sections to authenticated;

drop policy if exists "Published homepage content and administrators can read sections" on public.homepage_sections;
create policy "Published homepage content and administrators can read sections"
    on public.homepage_sections
    for select
    to anon, authenticated
    using (
        is_published
        or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

drop policy if exists "Administrators can insert homepage sections" on public.homepage_sections;
create policy "Administrators can insert homepage sections"
    on public.homepage_sections
    for insert
    to authenticated
    with check (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

drop policy if exists "Administrators can update homepage sections" on public.homepage_sections;
create policy "Administrators can update homepage sections"
    on public.homepage_sections
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

drop policy if exists "Administrators can delete homepage sections" on public.homepage_sections;
create policy "Administrators can delete homepage sections"
    on public.homepage_sections
    for delete
    to authenticated
    using (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        or coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) ? 'admin'
    );

create or replace function public.get_public_homepage_sections()
returns table (section_id text, content jsonb, is_published boolean)
language sql
stable
security definer
set search_path = ''
as $$
    select
        sections.section_id,
        case when sections.is_published then sections.content else null end,
        sections.is_published
    from public.homepage_sections as sections
$$;

revoke all on function public.get_public_homepage_sections() from public;
grant execute on function public.get_public_homepage_sections() to anon, authenticated;

insert into public.homepage_sections (section_id, content, is_published)
values
    (
        'hero',
        '{
            "title": "Welcome to University Church of the Nazarene",
            "subtitle": "A Christ-centered community of worship, discipleship, and service at Africa Nazarene University.",
            "primary_button_text": "Learn More",
            "primary_button_url": "#about",
            "secondary_button_text": "See Events",
            "secondary_button_url": "events.html"
        }'::jsonb,
        true
    ),
    (
        'theme',
        '{
            "label": "2025 THEME",
            "title": "Living a Fruitful Life",
            "verse": "“I am the vine; you are the branches. Whoever remains in me and I in him will bear much fruit.”",
            "citation": "John 15:5"
        }'::jsonb,
        true
    ),
    (
        'about',
        '{
            "title": "About Us",
            "intro": "University Church at Africa Nazarene University brings students, staff and the wider community together to worship, grow in Christ, and serve.",
            "cards": [
                {"badge": "Mission", "title": "Faith in community", "description": "We exist to know God, love God, and serve God by making Christlike disciples who engage our campus and community with care."},
                {"badge": "Vision", "title": "Welcoming every person", "description": "To be a warm and active church where everyone finds belonging, encouragement, and spiritual growth in Jesus."},
                {"badge": "Beliefs", "title": "Grounded in holiness", "description": "We follow the Wesleyan-Holiness tradition, trusting Scripture, grace, and the transforming work of the Holy Spirit."}
            ],
            "footer_title": "Modern church, timeless truth",
            "footer_description": "Our community balances strong worship, compassionate outreach, and youth-friendly discipleship in a way that feels fresh and inviting."
        }'::jsonb,
        true
    ),
    (
        'sermons',
        '{
            "title": "Latest Sermons",
            "intro": "Watch our latest sermons and growing collection of messages designed to encourage faith, growth, and spiritual reflection.",
            "playlist_url": "https://www.youtube.com/embed/videoseries?list=PL9Cr-hpTs1T4Z5qNom0YAAy2kB5HZoCOK",
            "info_text": "Discover more messages and subscribe to stay updated with our latest content.",
            "button_text": "Visit Our YouTube Channel",
            "button_url": "#"
        }'::jsonb,
        true
    ),
    (
        'services',
        '{
            "title": "Service Times",
            "intro": "Experience worship, fellowship, and teaching each week with services and study options for every age.",
            "items": [
                {"title": "Sunday Bible Study", "time": "9:30 AM - 10:20 AM", "description": "All ages welcome for trusted Bible teaching and discipleship."},
                {"title": "Sunday Worship", "time": "10:30 AM - 12:30 PM", "description": "Worship, prayer, and a message that encourages faith and community."},
                {"title": "Tea & Fellowship", "time": "After Service", "description": "Gather for refreshments and meaningful conversation with church family."},
                {"title": "Wednesday Bible Study", "time": "7:00 PM - 8:00 PM", "description": "Midweek study and prayer for deeper spiritual growth.", "action1_text": "Join Now", "action1_url": "https://meet.google.com", "action2_text": "Add to My Calendar", "action2_url": "#"}
            ],
            "info_text": "Need more details? Visit our ministries page to see full ministry offerings and weekly schedules.",
            "info_link_text": "View Ministries",
            "info_link_url": "ministries.html"
        }'::jsonb,
        true
    ),
    (
        'ministries',
        '{
            "items": [
                {"title": "NDI - Discipleship", "description": "Age-appropriate discipleship classes designed to help every generation grow in faith.", "button_text": "Visit NDI", "button_url": "classes.html"},
                {"title": "NYI - Youth Ministry", "description": "Dynamic programming for young people, including retreats, small groups, and spiritual leadership training.", "button_text": "Explore NYI", "button_url": "nyi.html"},
                {"title": "Praise & Worship", "description": "Join our worship team and experience Spirit-led praise through music, prayer, and celebration.", "button_text": "Join Worship", "button_url": "praise_worship.html"},
                {"title": "NCM Compassionate Ministry", "description": "Serving our community through outreach, relief work, and compassionate action.", "button_text": "Learn More", "button_url": "compassionate_page.html"}
            ],
            "all_link_text": "All Ministries",
            "all_link_url": "ministries.html"
        }'::jsonb,
        true
    ),
    (
        'leaders',
        '{
            "items": [
                {"name": "Rev. Richard Awanda"},
                {"name": "Rev. Charles Onyango"}
            ],
            "button_text": "Meet Our Team",
            "button_url": "leaders.html"
        }'::jsonb,
        true
    ),
    (
        'events',
        '{
            "icon": "🥾",
            "badge": "Upcoming",
            "title": "Hiking Event",
            "description": "Join us for a refreshing outdoor hike where faith, fellowship, and nature come together.",
            "date": "Saturday, TBD",
            "location": "Ngong Hills",
            "register_button_text": "Register",
            "register_button_url": "#",
            "all_link_text": "View All Events",
            "all_link_url": "events.html"
        }'::jsonb,
        true
    )
on conflict (section_id) do nothing;
