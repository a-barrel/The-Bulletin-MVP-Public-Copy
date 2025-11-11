# Contrast & “White-on-White” Debug Primer

Last updated: 2025-11-11

## TL;DR
When text or icons randomly disappear, 99% of the time they inherited `theme.palette.primary.contrastText` (pure white) while living on a white or pastel surface. The component (Chip, Button, Tab, etc.) expected a dark background, but our design was already light. Always double-check the background fill before letting a component use the default contrast color.

## Why It Happens
1. **MUI defaults**  
   Filled buttons, Chips, Tabs, etc. pull their text/icon color from `theme.palette[color].contrastText`. For `primary`/`secondary`, that’s `#FFFFFF`. If we render those components on top of a white card (or a pastel wash), the content blends in.

2. **Nested surfaces**  
   Often we wrap a component in a pastel container, then render another white card inside it. The inner card inherits the ancestor’s neutral color (white) and stays white, even though the designer intended dark text. Our recent Settings and Profile edit dialogs had this exact layering issue.

3. **Missing “reverse text” rules**  
   The style guide calls out when to flip text to white (e.g., Dark Purple backgrounds). Anytime we see custom backgrounds that aren’t one of those canonical dark fills, we should default to black text and only flip when the style guide explicitly says so.

## How To Fix It
1. **Set explicit text colors**  
   When using Chips/Buttons on light backgrounds, pass `sx={{ color: '#1F1336' }}` or similar to override the contrastText default. Do the same for icons if they inherit the same palette color.

2. **Use branded washes for cards**  
   Instead of stacking pure white over white, use `#ECF8FE`, `#CDAEF2`, or one of the other washes so component outlines stay visible even when they use white text internally.

3. **Check browsers at 400% zoom**  
   The quickest visual test: zoom >300% and toggle light/dark backgrounds. If anything disappears, you’ve hit contrastText on the wrong background.

4. **Document fixes in the audit**  
   Every time we fix an area, add it to `TODO-AND-IDEAS/AUDIT-REPORTS/audit-white-text-YYYY-MM-DD.md` so future devs know the context.

## Debug Console Tabs
The debug console’s top tabs are pure white because the Tab component uses `contrastText` against a transparent (white) background. When you restyle the console:
1. Give the tab bar a pastel wash (`#ECF8FE`).
2. Force tab text colors:  
   ```css
   .debug-console .MuiTab-root {
     color: #1F1336;
   }
   .debug-console .MuiTab-root.Mui-selected {
     color: #5D3889;
   }
   ```
3. Ensure the indicator uses a darker purple so it stays visible.
