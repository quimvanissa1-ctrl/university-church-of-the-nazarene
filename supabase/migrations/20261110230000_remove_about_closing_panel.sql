update public.homepage_sections
set content = content - 'footer_title' - 'footer_description'
where section_id = 'about'
    and (content ? 'footer_title' or content ? 'footer_description');
