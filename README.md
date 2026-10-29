# Namma Trips — Karnataka Travel AI

Responsive React + TypeScript travel planner for Karnataka. The default planner is a deterministic, multi-step manual builder and works without Gemini or any AI service. It includes destination discovery, editable day timelines, expense estimates, map fallbacks, Kannada/English controls, favorites, and browser-saved trips. An optional AI-assisted planner remains available as a separate path.

## Run locally

Requires Node.js 20.19+ (Node 24 recommended) and npm.

```sh
npm install
npm run dev
```

Vite serves the UI at `http://localhost:5173`; the companion Express API runs on `http://localhost:8787`. The manual planner is the default and does not call the AI endpoint. Rule-based suggestions score destination interests, suggested visit duration and sample cost ranges, then group suggestions by a curated planning cluster. It builds editable day schedules and estimates deterministically. An optional AI-assisted planner can be used separately; without a Gemini key it falls back to a labeled local demo plan. Sample content and price allowances are not verified live prices, hours, routes or availability.

## Gemini setup

1. Create a Gemini API key in Google AI Studio.
2. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` on the server environment. Set `GEMINI_MODEL` only if you want a different supported model.
3. Restart the server. `GET /api/health` reports whether the server sees a key.

The key is read only by `server/index.mjs`; it is never sent to the browser. Optional route previews use `GOOGLE_MAPS_API_KEY` as described below. `POST /api/plan` uses Gemini's JSON response schema, bounds request size and trip duration, validates the returned itinerary, and returns safe errors for quota, API and malformed output failures. The server constrains attractions to the selected destination's curated candidates, requires breakfast, lunch and dinner breaks, checks schedule ordering and realistic stop durations, and removes model-supplied route times and prices that are not backed by a provider. The browser then falls back to a clearly labeled local demo plan with the same clustered schedule structure.

## Maps, storage and accounts

- Maps always have external Google Maps search links as a no-key fallback. Optional driving route previews are calculated server-side by Google Maps Directions when `GOOGLE_MAPS_API_KEY` is configured and the Google Directions API is enabled. Add this variable to the server `.env`; never use a `VITE_*` key. The API returns provider-calculated legs and retrieval time, does not include traffic, and never accepts AI-supplied duration estimates. Without the key, distances and travel times are omitted.
- Saved itineraries and favorites use browser `localStorage`. Unsaved manual form fields are kept in this browser tab’s `sessionStorage` so navigation does not discard a draft. Saved trips can be reopened, duplicated, deleted, printed or downloaded as Markdown; browser storage does not sync across devices. There is no authentication, cloud database or shareable trip record in this version. Share copies a plain-text summary to the clipboard; Download exports Markdown.
- The hero and destination card images are remote Unsplash editorial photographs used illustratively; they are not asserted to be verified photographs of the named destination. Destination records are centralized in `src/data/destinations.ts`, marked as demo, and use the Karnataka Tourism portal as a starting point for official checking. The dataset deliberately contains no invented coordinates or verification dates.

## Build and serve

```sh
npm test
npm run build
npm start
```

The production server serves `dist` and the `/api` endpoints from one process. Configure the hosting platform to supply the server environment variables and support Node.js. Do not publish `.env` or expose the Gemini key in a frontend variable.

## Project map

- `src/App.tsx` — navigation, discovery, itinerary editing, destination details and local trips.
- `src/components/ManualPlanner.tsx` — three-step manual planner, date and party inputs, rule-based destination selection.
- `shared/manualPlanner.mjs` — deterministic destination ranking, manual itinerary creation and plan warnings.
- `shared/budget.mjs` — expense categories and reconciled trip totals.
- `src/data/destinations.ts` — shared demo destination and collection records.
- `src/services/planner.ts` — client API and fallback itinerary.
- `src/types.ts` — planner, destination and itinerary types.
- `server/index.mjs` — Gemini server integration, schema validation and static production serving.
- `src/styles.css` — responsive editorial design system and mobile layouts.

Prices are rounded planning estimates. Each itinerary labels the budget basis (party size, accommodation, food and transport assumptions), and unknown attraction fees are excluded rather than treated as free. The category breakdown reconciles exactly to the displayed trip estimate across transport, accommodation, food, attraction entry, activities, parking/tolls and miscellaneous costs. Stop meal allowances seed food; unknown entry fees remain excluded; the remainder is allocated as editable planning allowances. Use the controls to replace them with your own figures. These estimates do not include verified taxes, fares, tolls or admission prices; replace them with provider- or user-supplied values before booking decisions. Verify current access, seasonal conditions, hours and official advice before travel.
