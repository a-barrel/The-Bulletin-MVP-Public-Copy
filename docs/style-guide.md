# Pinpoint Style Guide

Last updated: 2025‑11‑10

## 1. Brand & Personality
- **Tone:** White-and-purple social hub for playful, goofy exchanges (GIFs, discussions, events).
- **Adjectives:** Playful · Casual · Social.
- **Inspiration:** Discord (feature depth) + Telegram (light, friendly visuals).

## 2. Color System
| Role | HEX | Usage |
| --- | --- | --- |
| Primary Purple | `#9B5DE5` | Event pins, core accents |
| Primary Pink | `#F15BB5` | UI box backgrounds, celebratory moments |
| Primary Blue | `#3EB8F0` | Discussion pins, secondary accents |
| Dark Purple | `#5D3889` | Headers, button backgrounds, info frames |
| Wash Pink | `#CDAEF2` | Text-heavy surfaces, offset blue areas |
| Wash Blue | `#ECF8FE` | Surfaces that offset purple content |
| Soft Lavender | `#F5EFFD` | Card backgrounds, hero washes |
| Brand White | `#FFFFFF` | General surfaces, cards |

- **Neutrals:** `#000000` (primary text), `#1E1E1E` (body copy variant), `#757575` (secondary copy), `#B3B3B3` (dividers), `#00000080` (overlays/focus scrims).
- **Rule:** Avoid pure black UI fills—reserve `#000000` for text; lean on washes or dark purple for backgrounds.
- **Alert colors:** `#FF3B30` (destructive), `#3EB8F0` / `#5D3889` (info states) appear in Figma exports—reuse them consistently.

## 3. Typography
- **Primary font:** Urbanist (Regular 400 for body, Bold 700 for emphasis). Inter appears in certain mockups but Urbanist should be the UI default.
- **Fallback stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- **Common sizes:** Body 16px (single-line + multi-line), captions 14px, sub-labels 10–12px, headline 24px, hero/title 32px. Occasional jumbo headings (60–70px) appear in marketing contexts.
- **Line heights:** Aim for 1.4–1.6 on body text; headings can be tighter (1.2–1.3).
- **Style tips:** Text is almost always black; keep headings friendly/bold and body copy highly legible (no letter-spacing tricks). Use uppercase sparingly.

## 4. Layout & Spacing
- **Spacing rhythm:** Small increments (mostly 2–4px multiples in Figma). Favor 8px-based padding for larger structures and halve it for tight clusters.
- **Border radius:** Rounded, approachable corners. Rectangles in Figma commonly use 10px radius; buttons can go full-pill when needed.
- **Padding:** Cards/sections usually carry 16–24px padding. Don’t let components hug viewport edges; keep a breathing gutter on all screens.
- **Responsiveness:** Favor auto-resizing flex/grid layouts over fixed widths. Many Figma screens struggle when compressed—test mobile/desktop parity before shipping.

## 5. Components & Patterns
- **Buttons:** High-contrast fills (dark purple or pure white) with bold text. Hover states lighten/darken subtly; focus rings should be obvious.
- **Inputs:** Light wash backgrounds (`#CDAEF2` or `#ECF8FE`), 1px outline, generous padding. Focus state increases contrast; error state uses `#FF3B30`.
- **Cards / badges:** Use wash colors or soft lavender fill with subtle drop shadow (same as Figma exports). Keep content centered, text legible.
- **Navigation / bars:** Keep pill indicators and nav buttons away from screen edges. Notification badges use `#F15BB5` or `#FF3B30` depending on urgency.
- **Overlays:** Use translucent black (`#00000080`) with blur for modals/toasts; keep animation subtle.

### Friend Badge Indicator
- Purpose: show at-a-glance when the viewer is already friends with the referenced user.
- Treatment: append the custom filled smiley SVG (circle face with halo) sized ~1.1em by default, tinted via `var(--friend-badge-color, #1BBF72)`, and nudged with `margin-left: 0.35rem`. The component exposes a `size` prop for constrained chips/captions.
- Accessibility: the SVG lives inside a `role="img"` wrapper with `aria-label="Friend"`; screen readers announce the relationship even if the icon is hidden.
- Surfaces: profile hero titles, DM thread list rows, chat bubbles, Updates friend-request chips, pin cards, and any shared user-name component. Reuse the `FriendBadge` component rather than recreating ad‑hoc spans.

## 6. Imagery & Media
- **Style:** Clean photography or gentle purple ↔ blue gradients. Avoid harsh color clashes.
- **Icons:** Simple, friendly vectors (outline or duotone). Maintain consistent stroke weight and sizing.
- **Avatars / media:** Circular crops, 1px border if placed on lighter washes. Keep face centered.

## 7. Motion & Interactions
- **Philosophy:** Subtle, non-flashy. Default to 150–250ms ease-out transitions.
- **Microinteractions:** Button press shading, list hover highlights, simple skeleton loaders. Avoid bouncy physics unless it improves clarity.

## 8. Accessibility & Content
- **Copy tone:** Friendly, casual, inclusive. Use plain language with short sentences.
- **Focus states:** Always visible (outline or glow). Never rely solely on color to show active/selected states.
- **Contrast:** Stick to WCAG AA; darker text on pastel backgrounds, or reverse text only when contrast meets 4.5:1.

## 9. Assets & References
- **Design files / logos:** (Add links/paths once available.)
- **Inspo board:** (Add references once compiled.)
- **Figma exports:** Stored in `TODO-AND-IDEAS/figma-Exports/` for raw reference.

## 10. Known Challenges / To Watch
- Desktop vs. mobile parity: some screens look great on one but not the other. Default to responsive layouts, avoid fixed widths, and verify both breakpoints.
- Keep breathing room from viewport edges to avoid “cramped” feel. If in doubt, add more gutter spacing.
