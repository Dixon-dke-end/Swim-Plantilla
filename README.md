# MAREA — swimwear storefront template

A demo storefront for a swimwear brand built with **Astro 7**, plus an income
accounting module that reads the client's own Excel files, and an automated
pipeline that records the demo video from the real site.

> MAREA is a placeholder brand. Products, reviews, lab figures and sales data
> are sample content. Photos come from [Unsplash](https://unsplash.com).

## What is inside

| Area | Where | Notes |
| --- | --- | --- |
| Storefront | `src/modules/{catalog,cart,home,lab}`, `src/pages` | Home, collection with filters, product pages, cart drawer, quality-tests page. Spanish UI, COP prices. |
| Motion | `src/shared/styles/motion.css`, `src/shared/lib/view-transition.ts` | View Transitions API (Astro `ClientRouter` + `document.startViewTransition`) and CSS scroll-driven animations. No animation libraries. Respects `prefers-reduced-motion`. |
| Accounting | `src/modules/accounting`, `/contabilidad` | Imports `.xlsx`/`.xls`/`.csv`, detects the header row and columns, supports accrual (*causación*) and cash (*caja*) methods, IVA modes, data-quality report and PUC journal entries. |
| Excel template | `public/plantillas`, `scripts/generate_income_templates.py` | Official template plus sample files (sales book, POS cash report, bank statement). |
| Demo video | `video/` | Playwright + Chrome screencast + ffmpeg. See `video/GUION.md`. |
| Deliverables | `entregables/` | Rendered video (full and light), script and Excel template. |

## Commands

```bash
npm install
npm run dev        # dev server (see AGENTS.md for background mode)
npm run test       # vitest
npm run check      # astro check
npm run build      # static build in dist/
npm run preview    # serve dist/ on http://localhost:4321
```

Regenerate the Excel template and samples:

```bash
python -I scripts/generate_income_templates.py
```

Record and render the demo video (needs Chrome, ffmpeg and `npm run preview` running):

```bash
cd video && npm install
node record.mjs            # all scenes, or: node record.mjs opening accounting
node render.mjs            # writes video/out/marea-demo.mp4
```

## Before going to production

- Checkout and newsletter are front-end only: no payments or emails are sent.
- Lab figures ("200 h en cloro", "UPF 50+", …) are illustrative and must be replaced with the client's real data.
- The PUC accounts are configurable defaults and must be validated by the client's accountant.
