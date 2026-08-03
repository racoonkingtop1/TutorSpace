# static/ — the actual GitHub Pages build

Plain HTML + CSS + vanilla JS (ES modules), zero build step. **This is what
`https://racoonkingtop1.github.io/TutorSpace/` actually serves.**

It's a real single-page app: one `index.html`, one JS-driven router
(`js/router.js`, hash-based — `#/students/:id` etc.), screens swap by
re-rendering `#content` in place. No bundler, no JSX, no TypeScript
compilation — every file is served byte-for-byte as written — but switching
screens never triggers a full page load, matching how the original design
prototype behaved (a single interactive document, not separate files per
screen).

## Structure

```
static/
  index.html          The only HTML page — shell + #content + #modal-root
  css/styles.css       All styling (design tokens, components: calendar,
                       donut chart, stepper, switch, modal, radio cards, ...)
  js/
    app.js              Registers routes, starts the router
    router.js             Hash router — no full page loads between screens
    shell.js               Demo banner + bottom tab bar, active-tab aware
    widgets.js               Date picker, activity heatmap, donut chart,
                             stepper, toggle switch, modal — shared UI parts
    data.js                    Dataset + mutations + computed values
                               (mirrors db/views.sql), sessionStorage-backed
    theme.js                     Light/Dark/System switching (persisted)
    format.js                     money/date/time/escapeHtml helpers
    pages/
      today.js, students.js, lessonsHistory.js, student.js, lesson.js,
      plan.js, settings.js, subscription.js, tutorCard.js
        one render function per screen, registered as a route in app.js
  data/dataset.json  The 500-record demo dataset (copy of db/demo-data.json)
```

## Screens

Every screen from the original Claude Design prototype has a home here —
this was rebuilt once already as a thinner multi-page site and lost several
sections in the process; the SPA rebuild restored them:

- **Today** (`#/today`) — header with today's date, "Запланировать" button,
  upcoming lessons (with cancel), completed lessons, empty state, activity
  calendar.
- **Students** (`#/students`) — search, subject filter, debt-only filter, add
  student, link to full lesson history, AI-analysis button (demo no-op).
- **Student profile** (`#/students/:id`) — balance, subject average, lesson
  history, payments.
- **Lesson form** (`#/lesson/new` and `#/lesson/:id`) — one unified form:
  student/date/time/subject, the "Занятие проведено" toggle that reveals
  duration/topic/grade-stepper/comment, cancel-lesson confirm dialog.
- **Plan** (`#/plan`) — period tabs, donut chart with a toggleable legend,
  metric progress bars, subject + date-range filters, activity calendar with
  month navigation.
- **Settings** (`#/settings`) — theme switch, student/tutor lesson reminders
  (add/delete/custom steppers), payment policy, overdue-payment reminder
  settings.
- **Subscription** (`#/subscription`) — plan picker, payment step (method,
  promo code, total), success/fail screens, account management, retention
  offer, cancel-confirm modal.
- **Public tutor card** (`#/t/:slug`) — no app chrome (matches the original
  "без навигации" public page), avatar placeholder, subjects/prices,
  reviews, "Написать репетитору" contact modal.

## How data works here

`js/data.js` fetches `data/dataset.json` once, applies any in-session edits
from `sessionStorage`, and exposes the same computed-value logic as
`db/views.sql` (balance, debt/blocked status, rating, plan progress) plus
mutation functions the pages call directly (`createLesson`,
`completeLesson`, `checkoutSubscription`, etc.) — each one saves back to
`sessionStorage` so the change is visible on every other screen without a
page reload. It's still a demo: closing the tab, or clicking "Сбросить
демо-данные" in Settings, drops everything back to the generated dataset.

Regenerate the dataset with `node scripts/generate-demo-data.mjs` from the
repo root — it writes to `static/data/dataset.json` along with two other
copies (see that script's header comment).

## Local preview

Any static file server works — `fetch()` needs real HTTP, not `file://`:

```bash
npx serve static
# or: python3 -m http.server 8080 --directory static
```

## Relationship to apps/web

`apps/web` (React + Vite + Express API, see the root README) remains the
real, buildable-into-a-real-product codebase — the one to extend when
`apps/api` gets a real database behind it. `static/` is a hand-maintained
mirror of the same screens for a dependency-free public demo; it is **not**
generated from `apps/web` and won't automatically pick up changes made
there. If you change a screen in `apps/web`, mirror the change here manually
if the public demo should reflect it too.
