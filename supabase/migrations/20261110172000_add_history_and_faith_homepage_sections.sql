alter table public.homepage_sections
    drop constraint if exists homepage_sections_section_id_check;

alter table public.homepage_sections
    add constraint homepage_sections_section_id_check
    check (
        section_id in (
            'hero',
            'theme',
            'about',
            'history',
            'faith_practices',
            'sermons',
            'services',
            'ministries',
            'leaders',
            'events'
        )
    );

insert into public.homepage_sections (section_id, content, is_published)
values
    (
        'history',
        '{
            "title": "Our History",
            "content": "University Church of the Nazarene has a long heritage of gospel ministry, local service, and global compassion. From our earliest days, our congregation has gathered to worship, learn, and reach out with practical love."
        }'::jsonb,
        true
    ),
    (
        'faith_practices',
        '{
            "title": "Our Faith & Practices",
            "content": "Rooted in Scripture and Wesleyan-Holiness tradition, we believe in grace, holiness, and the transforming power of Jesus Christ. Our worship, prayer, and discipleship practices are designed to grow Christ-like character in every member."
        }'::jsonb,
        true
    )
on conflict (section_id) do nothing;
