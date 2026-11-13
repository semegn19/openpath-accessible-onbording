# templates/

**Not loaded by the app.** These are examples for adopters: a form written by somebody else,
to show the engine is schema-driven rather than hardcoded to Savanna's three flows.

`example-course-enrolment-v1.json` is deliberately out of scope for the hackathon brief
(course enrolment was dropped). It is kept because "bring your own schema" is a claim worth
demonstrating, and it validates against the same rules the live forms do.

Copy one of these, change `id`/`title`/`steps`, run `npm run validate`, and add it to `PAGES`
in `app/src/App.tsx`. See the README, section "Add a fourth form".
