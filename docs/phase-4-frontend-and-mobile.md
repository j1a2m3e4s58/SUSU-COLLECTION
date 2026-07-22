# Phase 4: Frontend and Mobile

## Route Bundles

Every portal page is loaded with `React.lazy`. Authentication pages no longer download dashboard, reporting, spreadsheet, or PDF code before it is needed. The production build reports separate page chunks so future bundle growth is visible during review.

## Responsive Dialogs

Operational dialogs use the shared Radix dialog primitive. It provides:

- focus trapping and focus restoration;
- Escape-key dismissal;
- labelled titles and descriptions;
- collision-aware dropdowns;
- viewport-safe width, height, and scrolling.

Playwright checks dialog geometry at 360px, 400px, 430px, 768px tablet, and desktop widths.

## Accessibility

The browser suite includes Axe checks for serious and critical WCAG issues. It also verifies keyboard focus containment, keyboard-operated dropdowns, semantic table headings, labelled icon buttons, labelled date controls, and live notification announcements.

## Render Wake And Recovery

Safe read requests retry temporary network, `502`, `503`, and `504` failures with a short backoff. Non-idempotent write requests are never automatically repeated. Startup shows a wake message for slow Render responses, an unavailable screen after retries are exhausted, and a working **Retry Connection** action. An in-app connection notice reports retry, offline, and recovered states without hiding the current page.
