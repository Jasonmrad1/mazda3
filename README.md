# My Garage

A React + TypeScript, offline-first personal Mazda companion. Initialized for the owner's black-interior 2019 Mazda3 BP Hatchback, using all four supplied photographs. No service, fuel, expense, pressure or sensor records are pre-populated.

## Run

Requires Node.js 22.12+ (developed with Node 24).

```sh
npm ci
npm run dev
```

Open the printed local URL (normally `http://127.0.0.1:5173`).

```sh
npm test          # Domain and IndexedDB tests
npm run test:e2e # Chrome browser workflows; start dev server first
npm run build    # TypeScript check, production build and PWA generation
npm run preview  # Serve production PWA, normally port 4173
```

For browser tests against the production build, set `TEST_BASE_URL=http://127.0.0.1:4173`. The Playwright configuration uses installed Chrome; change the channel if necessary.

## Deploy to Render

The root `render.yaml` configures this frontend as a Render Static Site. Connect the repository in Render with **New > Blueprint** and deploy the Blueprint, or create a Static Site manually with:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Rewrite rule: `/*` to `/index.html` (for client-side routes)

The static site deploy does not include the optional AI proxy. The garage works without it; configure an authenticated, HTTPS assistant backend separately if needed. Do not expose the sample loopback proxy as a public service without adding authenticated access.

## What works

The November refinement adds simpler Home / Care / Fuel / Garage / Assistant navigation, four prominent everyday actions, short forms with expandable optional details, an essential-care default with the complete inspection catalog still accessible, and a single four-tire pressure form. Entered mileage is preserved across input-unit changes.

### Whole-car 3D explorer

Home now opens directly to an immersive, full-width black-and-silver 3D hero using [Ddiaz Design’s 2020 Mazda 3 Hatchback](https://sketchfab.com/3d-models/2020-mazda-3-hatchback-a72de3f3c1604409a7e6fc6be9854c9d). The BP hatchback body and textured interior geometry were visually checked. This is explicitly a **2020 BP reference**, not a certified reproduction of the owner's 2019 Preferred trim. All applicable classic/PBR body-color channels are changed to black before the model is revealed. Exterior and Interior share one loaded model; the interior has driver and rear-cabin camera presets. Orbit/look, zoom, reset and fullscreen remain available. Your four actual photographs remain available through **Your photographs** and as an offline fallback.

This app embeds the publisher’s hosted viewer with attribution and does not extract or redistribute model binaries. The publisher lists CC BY-NC-SA and credits a Racing Master model; no locally redistributable rights are assumed. Alternative model listings remain in `src/data/models3d.ts`. No purchase was made. A locally bundled model would require an appropriately licensed file and optimization. The free candidates were visually inspected; exact trim fidelity remains unverified. HKV Studios' exact-year hatchback listing advertises a detailed interior, but the actual file and permitted web delivery must be checked before it can replace this reference.

The navigation, showroom brand and install icons use the [Mazda emblem from Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/mazda.svg). Mazda trademarks belong to their owner; My Garage is a personal companion and is not affiliated with Mazda.

The 3D viewer requires internet, WebGL and browser graphics support. It loads automatically on Home as requested, sets Sketchfab’s `dnt=1` parameter, limits textures to 1024px on small screens / 2048px on larger screens, and does not send vehicle history, VIN or uploaded files. Photos and core care tools stay available if it cannot load. Browser QA confirmed the actual black exterior and interior in hardware-accelerated Chrome; software-rendered/headless environments may be rejected by Sketchfab. Loading, connection-error, graphics-error and offline fallback states are implemented. Initial setup is now optional through **Personalize your garage**, so it does not obscure the opening hero. All application chrome and charts use neutral monochrome colors; critical conditions remain identifiable by explicit labels and typography.

- Responsive five-section cockpit, real vehicle gallery, editable profile and black interior, onboarding, dark and light themes, reduced-motion support.
- Canonical integer-meter distance storage, preserved original reading units, chronological validation and corrections through editable records. Approximate starting mileage is labeled; it is not a confirmed reading.
- Sourced US normal/severe oil schedules, time/distance deadlines, custom intervals, a broad inspection tracker, service records, attachments and timeline. Unknown history remains incomplete.
- Four manual tire editors with PSI/bar/kPa conversion, cold-pressure placard confirmation, condition, tread and manufacture date; inspection history preserves unknown odometers.
- Full/partial fuel entries, full-to-full measured cycles, distance-weighted average consumption, US MPG / L/100 km / km/L / km per 20 L, priced-cycle costs, monthly spending and actual-data charts.
- USD/LBP expense separation, ownership charts and categories, optional recurring-expense labels, private documents, searchable PDF text with physical PDF page references, PDF/CSV exports and JSON backup/restore.
- Offline reference assistant that combines records with retrieved handbook/manual content, cites sources, discloses uncertainty and prioritizes urgent symptoms. Optional explicit-consent AI backend connection; no client-side provider key.
- Due reminders, custom date/odometer reminders, snooze/dismiss/complete, browser notification permission controls, calendar export, installable PWA with locally bundled font, photos, mechanical schedule PDF and app shell.

## Maintenance references and accuracy

The included `public/manuals/2019-mazda3-maintenance.pdf` is Mazda's [2019 Mazda3 US scheduled maintenance PDF](https://www.mazdausa.com/siteassets/global-resources/vehicle-resources/owner-manuals/2019/m3s/2019-mazda3-hatchback-sedan-schedule-maintenance.pdf). US tables are on physical PDF pages 1–3. The [official digital schedule](https://www.mazda.ca/en/digital-owners-manual/2019/mazda3/contents/07020601.html) was cross-checked during implementation.

- Normal oil maximum: 10,000 mi / 12 months or earlier vehicle monitor indication. Severe oil: 5,000 mi / 6 months. Other verified intervals do not automatically shorten.
- Rotation: 10,000 mi; cabin filter: 30,000 mi / 24 months; plugs: 75,000 mi.
- Coolant's first interval requires an unknown in-service date: 120,000 mi / 120 months. After a recorded replacement, subsequent reminders use 60,000 mi / 60 months.
- Engine air filter is tied to every third maintenance event; no fixed distance is inferred. Other tracker items have no fabricated fixed replacement interval.
- 36 PSI is the owner's reference for the supplied setup; the driver's door placard must be confirmed and takes precedence. Matching recorded pressure is not a vehicle safety certification.
- Vehicle and equipment specifications were supplied by the owner, not VIN-decoded. Remote start remains unverified. No navigation PDF was supplied. Uploaded navigation content is excluded from mechanical retrieval based on document classification/name.
- Sources are available in-app. Actual fitted hardware, regional documentation and the mechanical manual must take precedence over incompatible references.

## Offline, privacy and reminder limits

IndexedDB (Dexie) stores records and uploaded files in the current browser profile, with writes completed before UI success. No cloud account, analytics, telemetry or synchronization is included. Another person using the same browser profile can access the data. VIN is excluded from all exports; photos and documents are included in JSON backups, which should be kept private. Browser/device backups and OS protection remain the owner's responsibility. Use the Settings action to request persistent storage and download regular backups; browsers can otherwise evict local storage. Complete deletion clears all local garage records, uploaded assets, VIN and notification-deduplication keys, leaving bundled app/reference assets available.

The production service worker caches the app, bundled imagery/fonts/PDF and PDF/search/export modules for offline use after the first successful online load. Dev mode does not register a service worker. App installation requires HTTPS or localhost; iOS uses Share → Add to Home Screen.

**Browser notifications do not reliably run when the app is closed.** Due checks happen on launch and focus, using the latest entered odometer. Date reminders can be exported as `.ics` for a calendar app; the calendar controls delivery. No background distance measurement or live sensor integration is claimed. The optional monthly distance value is a user estimate and never updates the odometer.

## Optional AI and future integrations

The app is fully usable without generative AI. In Assistant connection settings, users can opt in to an HTTPS backend that accepts a JSON request containing `query`, sanitized `vehicle`, service `history`, `fuel`, and up to three retrieved `context` citations, returning `{ "answer": "..." }`. VIN, photos and full files are excluded. The included `server/proxy.mjs` is a loopback-only example proxy with size limits, rate limits, explicit CORS origin, timeout, a grounding policy and server-only gateway credentials. Configure `server/.env.example` values in the process environment and run `node --env-file=server/.env server/proxy.mjs`. A public backend must add authenticated access through a reverse proxy/session layer. A paid AI provider is not provisioned or connected by this project.

The data model uses stable vehicle IDs and `vehicleId` relationships for future multi-car support. No Bluetooth adapter, cloud sync or vehicle-control commands are implemented. Future OBD integration should detect capabilities, preserve observation timestamps and units, and stay read-only by default.

## Structure

- `src/features/`: five primary sections, tires and onboarding
- `src/components/`: reusable UI, forms and charts
- `src/lib/`: typed domain model, calculations, Dexie persistence, exports and reminders
- `src/data/`: sourced maintenance and handbook reference data
- `public/`: supplied car photos, bundled font/license, offline mechanical reference
- `server/`: optional AI proxy contract and example
- `tests/`: real Chrome end-to-end workflows

Production release checks should include iOS Safari and Android Chrome on actual devices, calendar imports and OS notification delivery. The current browser QA covers desktop Chrome and a mobile Chrome viewport, not actual mobile hardware.
