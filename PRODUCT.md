# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The public website serves the University Church of the Nazarene community. A designated website editor manages the site and can delegate tasks to other users.

## Product Purpose

Present the church and its existing pages, and provide an authenticated place for the editor to manage the website.

## Operating Context

The public site is a multi-page website. Website administration is limited to authenticated administrators; delegated access for other users is a future requirement.

## Capabilities and Constraints

- Preserve the existing public pages, design, navigation, footer, and functionality.
- The current implementation is limited to the Supabase authentication flow; content-management features follow only after that flow is working.
- Use Supabase Auth for administrator access. Do not expose a service-role key in browser code.
- Enable Row Level Security before adding database modifications. Public visitors should only read content intended for publication.
- The admin dashboard should adapt to desktop and mobile screens.

## Brand Commitments

- University Church of the Nazarene.
- Preserve the existing public site's identity and logo (`images/mylogo.png`).
- Preserve the footer text “Holiness unto the Lord • Building Christlike Disciples.”

## Evidence on Hand

- Existing public pages, styles, reusable header/footer components, and church logo are in the repository.

## Product Principles

- Keep the public church experience intact while extending administration alongside it.
- Restrict administrative capabilities to authorized users.
- Add website-management capabilities only after the authentication flow is verified.
