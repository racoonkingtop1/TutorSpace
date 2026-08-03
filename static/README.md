# static/ — the actual GitHub Pages build

Plain HTML + CSS + vanilla JS (ES modules), zero build step. **This is what
`https://racoonkingtop1.github.io/TutorSpace/` actually serves.**

This exists as a separate, deliberately more conservative deployment target
than `apps/web` (the React/Vite app): no bundler, no JSX, no TypeScript
compilation, no dynamic `import()` of a bundled chunk — every file here is
served byte-for-byte as written, which removes any dependency on a build
tool behaving a particular way on GitHub's infrastructure. If `apps/web`'s
Vite build ever causes problems on Pages again, this folder is unaffected —
it has no relationship to Vite at all.

## Structure

```
static/
  index.html         Today screen (the site root)
  students.html       Student list + search
  student.html         Student profile — ?id=<student-id>
  lesson.html           Create lesson (?studentId=) / complete lesson (?id=)
  plan.html               Statistics / goal progress
  settings.html             Payment policy
  subscription.html          Plan picker + mock checkout
  tutor-card.html              Public tutor card — ?slug=<public-slug>
  css/styles.css      All styling — same design tokens as apps/web/src/styles/tokens.css
  js/
    data.js            Owns the dataset: fetch + sessionStorage-backed edits +
                       the same computed-value logic as db/views.sql
    format.js           money/date/time/query-string helpers
    shell.js              Renders the demo banner + bottom tab bar
    today.js, students.js, student.js, lesson.js, plan.js,
    settings.js, subscription.js, tutor-card.js    one file per page
  data/dataset.json  The 500-record demo dataset (copy of db/demo-data.json)
```

## How data works here

Each page is a real, separate HTML document (classic multi-page site, not a
client-routed SPA) — state that needs to survive navigating between pages
(e.g. marking a lesson complete, then viewing the updated balance on
`student.html`) is persisted to `sessionStorage` by `js/data.js`, not just
kept in a JS variable. That's a deliberate difference from `apps/web`'s demo
mode, which resets on every reload since it's a single-page app and doesn't
need cross-*page* persistence. Both are still demos: closing the tab (or
clicking "Сбросить демо-данные" in Settings) drops all edits back to the
generated dataset.

Regenerate the dataset with `node scripts/generate-demo-data.mjs` from the
repo root — it writes to `static/data/dataset.json` along with the other two
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
snapshot of the same screens for the purpose of a dependency-free public
demo; it is **not** generated from `apps/web` and won't automatically pick
up changes made there. If you change a screen in `apps/web`, mirror the
change here manually if the public demo should reflect it too.
