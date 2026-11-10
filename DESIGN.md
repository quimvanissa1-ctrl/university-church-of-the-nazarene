---
name: University Church of the Nazarene
description: A welcoming church website grounded in holiness, worship, and service.
colors:
  gold: "#D39512"
  green: "#14736C"
  blue: "#007799"
  red: "#9D0A0F"
  black: "#000000"
  white: "#FFFFFF"
  light-gray: "#F5F5F5"
  medium-gray: "#555555"
  dark-gray: "#121212"
  home-night: "#05090c"
  home-blue: "#08151c"
  home-horizon: "#123343"
  home-paper: "#fbfaf6"
  home-ink: "#17191b"
  home-muted: "#41474b"
  home-line: "rgba(0, 0, 0, 0.12)"
  gold-hover: "#e5ae38"
typography:
  display:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(3rem, 6vw, 5.35rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(2rem, 3.4vw, 3.15rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Georgia, serif"
    fontSize: "1rem"
  label:
    fontFamily: "Georgia, serif"
    fontSize: "0.78rem"
    fontWeight: 700
    letterSpacing: "0.12em"
rounded:
  card: "12px"
  pill: "999px"
spacing:
  section-desktop: "clamp(3.75rem, 7vw, 6.5rem)"
  section-mobile: "3.5rem"
  container-max: "1160px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.black}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 1.45rem"
    height: "3.25rem"
  button-primary-hover:
    backgroundColor: "{colors.gold-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 1.45rem"
    height: "3.25rem"
---

# Design System: University Church of the Nazarene

## Overview

**Creative North Star: "Dawn Over the Gathering"**

The public site pairs the church's established Georgia typography and gold, green, blue, and red identity with a calm editorial layout. On the homepage, a dark horizon opens into light paper surfaces, guiding visitors from welcome to the church's theme, mission, vision, history, faith, and ways to participate.

Use the real church logo and Supabase-managed content as the visual and editorial source of truth. Keep the shared navigation and footer familiar; let generous spacing, clear headings, and restrained color carry the experience rather than decorative cards.

**Key Characteristics:**
- Georgia serif typography throughout, with a large, left-led welcome.
- Brand color used sparingly against dark, white, and warm-paper surfaces.
- Flat editorial sections, thin dividers, and rounded action links.
- Homepage content and visibility remain administrator-editable.

## Colors

The palette retains the church's exact brand colors; the homepage adds quiet night, horizon, paper, and ink tones to create a readable dawn-to-day flow.

### Primary
- **Church Gold** (#D39512): Primary calls to action and small moments of emphasis.

### Secondary
- **Worship Green** (#14736C): Section labels and service details.
- **Church Blue** (#007799): Scripture references, focus rings, and the horizon accent.
- **Church Red** (#9D0A0F): A restrained note in the hero horizon and shared site identity.

### Neutral
- **Black** (#000000): Primary button text and brand anchor.
- **Night** (#05090c): Homepage hero base.
- **Horizon Blue** (#08151c and #123343): The hero's transition from night to dawn.
- **Warm Paper** (#fbfaf6): Alternating light homepage sections.
- **Ink** (#17191b): Homepage headings and primary text.
- **Muted Ink** (#41474b): Supporting copy.
- **Subtle Rule** (rgba(0, 0, 0, 0.12)): Dividers between editorial content.
- **White** (#FFFFFF), **Light Gray** (#F5F5F5), **Medium Gray** (#555555), **Dark Gray** (#121212): Shared site surfaces and base text roles.

### Named Rules
**The Dawn-to-Day Rule.** Keep the dark horizon in the welcome; let the rest of the homepage remain light, readable, and content-led.

## Typography

**Display Font:** Georgia, serif  
**Body Font:** Georgia, serif  
**Label Font:** Georgia, serif

**Character:** Familiar, grounded serif typography gives the church a warm and enduring voice. Scale, weight, and whitespace—not a second typeface—create hierarchy.

### Hierarchy
- **Display** (700, `clamp(3rem, 6vw, 5.35rem)`, line-height 1): Homepage welcome heading.
- **Headline** (700, `clamp(2rem, 3.4vw, 3.15rem)`, line-height 1.12): Homepage section titles.
- **Title** (700, `clamp(1.3rem, 2vw, 1.7rem)`, line-height 1.25): Mission, vision, service, and other content headings.
- **Body** (400, 1rem base): Paragraphs use generous line spacing, typically 1.75–1.85 on the homepage; keep longer reading lines near 65–75ch.
- **Label** (700, 0.78rem, 0.12em, uppercase): Theme and card category labels.

## Layout

The shared content container is capped at 1160px and centered. Homepage sections use generous vertical spacing (`clamp(3.75rem, 7vw, 6.5rem)`, reduced to 3.5rem on narrow screens); the hero has its own responsive height and padding. Mission, vision, and beliefs use three columns on wide screens, while services, ministries, and leaders use two. At 800px, the hero and about grid tighten; at 600px, these groups stack into one column. The shared navigation becomes a compact toggle below 900px.

## Elevation & Depth

The homepage is flat by default. Section contrast, the hero's layered color, and thin rules establish depth; the playlist frame and shared fixed header use soft, neutral black shadows. Do not add a colored glow to homepage actions.

### Shadow Vocabulary
- **Shared header** (`0 14px 40px rgba(0, 0, 0, 0.18)`): Separates the fixed navigation from scrolling content.
- **Sermon playlist** (`0 18px 40px rgba(0, 0, 0, 0.1)`): Softly lifts the embedded media frame.

## Shapes

Homepage content uses mostly square editorial blocks and thin horizontal rules. Buttons and service actions are full pills; shared cards elsewhere retain the 12px site radius. Avoid accent rails on homepage content.

## Components

### Buttons
- **Shape:** Full pill (`999px`).
- **Primary:** Gold surface, black text, `0.85rem 1.45rem` padding, and a 3.25rem minimum height.
- **Hover / Focus:** Gold brightens and the button lifts slightly; focus uses a clear 3px blue outline (white on the dark hero). Homepage buttons have no colored shadow.
- **Secondary:** Transparent surface with a white border and white text in the hero.

### Cards / Containers
- **Homepage style:** Flat content groups with a thin top divider and no enclosing fill or shadow.
- **Internal spacing:** 1.5rem above card content; use the shared centered 1160px container.
- **Mission / vision / beliefs:** Keep the content labels and copy editable; do not turn them into decorative icon cards.

### Navigation
- **Style:** Fixed shared header with the existing logo, dark red-to-black surface, and gold links.
- **Mobile:** Collapsible menu below 900px; keep the closed state compact and preserve the existing toggle behavior.

### Homepage Hero
- **Style:** Left-aligned welcome and editable actions on a dark blue-black horizon; the existing church logo is the quiet visual anchor.
- **Motion:** One short horizon-line reveal; disable it for reduced-motion preferences.

### Theme Band
- **Style:** Compact warm-paper editorial band immediately after the hero. Keep its theme, scripture, and publication state driven by Supabase.

## Do's and Don'ts

### Do:
- **Do** use the exact church palette: gold #D39512, green #14736C, blue #007799, red #9D0A0F, and black #000000.
- **Do** preserve the existing logo, shared navigation, footer, Supabase rendering, and admin editability.
- **Do** let mission, vision, beliefs, history, faith, service information, and other published homepage content lead the page.
- **Do** retain responsive spacing, visible focus, and reduced-motion behavior.

### Don't:
- **Don't** restore the removed “Modern church, timeless truth” callout or its dedicated editable fields.
- **Don't** hardcode or republish Supabase-managed content to make a section appear.
- **Don't** use all brand colors at once, add decorative card stacks, or add colored glow shadows to homepage actions.
- **Don't** replace the site's established Georgia typography or shared page chrome as part of a homepage change.
