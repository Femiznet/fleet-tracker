# Fleet Tracker

Fleet Tracker is a Next.js API and PostgreSQL application for CNG fleet
operations. The current code provides customer records, company-truck and
company-skid dispatch workflows, plant-status reporting, customer-skid loadings
tracking, HCL Tracker integration, and Green API message intake and parsing.

## Current application state

The root page at `/` currently renders only `Hello`. There is no operator
dashboard or UI for the workflows described below; they are exposed through
API routes.

The `/api/updates` and `/api/models` route files are empty and do not implement
handlers. Although an `ai_configurations` table exists, no AI configuration
workflow is currently exposed by these routes.

## Features

### Company dispatch and pickup

Company dispatches and pickups are stored as movements with outbound or inbound
trip legs.

- A dispatch associates a truck, customer, and outgoing company skid. It
  rejects customer-owned skids, skids in maintenance, and skids that are not
  loaded. The customer must have a geofence classified as a customer.
- Live-tracked dispatches also require the truck and skid to be at locations
  classified as plant geofences. A dispatch can instead use manual tracking.
- A pickup associates a truck and customer and can optionally specify the
  returning skid. Without the `forceOverride` option, the truck must be at the
  customer's geofence and a specified skid must be recorded there. The override
  bypasses those location matches.
- Manual dispatch actions record arrival at the customer and the start of the
  return journey. Completing the dispatch records its arrival back at the plant.
- Tracking mode can be changed on an in-progress dispatch. The database guards
  switching back to live tracking when a GPS-observed arrival has not first
  been recorded manually.
- Completing a movement requires the truck to be at `GASTECH PLANT`. A
  dispatch also requires an arrived inbound trip. Completion requires a
  returned skid or a non-empty note. Cancellation closes in-progress trip legs
  and resets relevant truck and skid statuses.
- A database trigger reacts to truck-location updates during active movements:
  for live dispatches it records outbound arrival at the customer, creates the
  inbound trip when the truck leaves, and records the inbound arrival at the
  plant.

Customer-owned skids have a separate loading flow below; the company dispatch
function does not dispatch them.

### Customer skid loadings

Customer-owned skids arriving at the plant to load are recorded separately
from company skids. A loading record starts in the `empty` state and stores the
customer, skid number, state, washing selection, arrival time, first loaded
time, and dispatch time.

- States are `empty`, `loading`, `loaded`, and `on_hold`.
- A loading can be marked for washing only while it is empty or loaded.
- Dispatch is a separate operation and is allowed only after the loading is
  loaded. It records when the skid left and retains the loading record as history.
- The app does not ask for or store a waybill number.
- Only one active loading for a normalized skid number can exist at a time.

### Plant status

Plant status is a single editable record in `plant_status`, not a series of
saved report snapshots. Its officer, notes, and metrics can be updated while
fleet information is assembled live from the truck, skid, movement, trip, and
customer-skid-loading records.

The status response includes:

- The live fleet snapshot: loading, loaded, empty, on-hold, new-loaded, and
  washing skids; trucks on the ground, on standby, in transit, returning, or in
  maintenance; and trucks and skids in maintenance.
- Company skids currently available at the plant and active customer skid
  loadings, including their state and washing selection.
- The current plant-status record and the daily dispatch summary.

Metrics are JSON with supported fields for inlet and loading pressure, landing
gearbox counts, new chassis, compressor states, and extra fields. Updating
metrics merges the submitted top-level fields into the existing metrics.

`POST /api/plant-status` also returns a WhatsApp-ready text rendering of the
current plant status. It does not send a WhatsApp message.

Daily totals use the `Africa/Lagos` day boundary. Customer counts are based on
customer skid loadings dispatched that day; company counts are outbound dispatch
trips recorded as arrived that day. The response includes distinct customers
served and the combined skid total. Company arrival timestamps are recorded by
the database functions and location trigger.

### Customers

Customer records can be listed, created, fetched, updated, and deleted through
the customer API. Records include a name, customer type, optional geofence name
and location, and an active flag. Dispatch flows use the customer's configured
geofence.

### HCL Tracker and truck locations

The HCL Tracker integration authenticates to the configured upstream service,
keeps its session cookies in memory, and retries once after an expired session.
The API exposes paginated vehicle data and address lookup by latitude and
longitude.

The truck-location sync job fetches the first 100 vehicles with coordinates,
updates matching trucks' coordinates, speed, and current location, and ignores
vehicles that are not already registered locally. It first checks learned
geofence zones. For coordinates without a local match, it looks up the address
through HCL Tracker and records observations to refine matching geofences.
Movement-trigger logic uses updated locations to advance live trips.

The truck-seeding job fetches the first 25 vehicles through the app's own
HCL-vehicles endpoint and inserts them into the truck table. Duplicate truck
numbers are ignored by the insert.

### Green API messages

`POST /api/messages` accepts the supported Green API incoming-message
structures: text, extended text, quoted text, edits, and deletes. A statically
configured chat allowlist maps chat IDs to customer geofence names. Messages
from unknown chats, unknown customers, or text that is not recognized as an
update or dispatch-details message are not saved as normal message records.
Creates, edits, and deletes are applied to the stored message.

`GET /api/cron/process-messages` parses unprocessed saved messages into
`processed_messages` records. Update messages are parsed into pressure,
flow-rate, total-flow, skid, and available-truck data with warnings for missing,
ambiguous, or out-of-range values. Dispatch-details messages are parsed into
truck, skid, driver, customer, date, time, and contact fields with review
warnings when data is missing or unclear.

Parsing a dispatch-details message does **not** create a fleet movement or
dispatch. It only stores the parsed message data and its processing status.

## Feature package configuration

Feature package availability is configured in `features.config.json`. Set
`required` to `true` to fail registry generation when a package is missing, or
`false` to allow it to be absent. An optional package is still enabled when it
is present; if missing, its unavailable fallback is generated so the rest of
the app can run. Dependencies are listed per feature; a feature is also
unavailable when one of its dependencies is unavailable. For example, messages
depends on customers.

The customers feature is currently required. Set it to optional to let the app
run without its package; customer API routes will return HTTP 503, and messages
will also be unavailable. The database package is core infrastructure and is
not optional.

## API routes

| Method                   | Route                                        | Purpose                                                    |
| ------------------------ | -------------------------------------------- | ---------------------------------------------------------- |
| `GET`, `POST`            | `/api/customers`                             | List or create customers                                   |
| `GET`, `PATCH`, `DELETE` | `/api/customers/[id]`                        | Fetch, update, or delete a customer                        |
| `POST`                   | `/api/movements/dispatch`                    | Start a company-skid dispatch                              |
| `POST`                   | `/api/movements/pickup`                      | Start a customer-site pickup                               |
| `POST`                   | `/api/movements/[id]/complete`               | Complete an active dispatch or pickup                      |
| `POST`                   | `/api/movements/[id]/cancel`                 | Cancel an active movement                                  |
| `POST`                   | `/api/movements/[id]/manual-action`          | Advance a manual dispatch                                  |
| `PATCH`                  | `/api/movements/[id]/tracking-mode`          | Change an active dispatch's tracking mode                  |
| `GET`, `POST`            | `/api/plant-status`                          | Read live plant data and update the current status         |
| `GET`, `POST`            | `/api/customer-skid-loadings`                | List active loadings or history, and register a loading    |
| `PATCH`                  | `/api/customer-skid-loadings/[id]`           | Update a loading's state or washing selection              |
| `POST`                   | `/api/customer-skid-loadings/[id]/dispatch`  | Mark a loaded skid dispatched; no request body is required |
| `POST`                   | `/api/messages`                              | Receive a Green API message webhook                        |
| `GET`                    | `/api/hcltracker/vehicles?page=…&per_page=…` | Fetch upstream vehicle data                                |
| `GET`                    | `/api/hcltracker/address?lat=…&lon=…`        | Resolve an upstream address                                |
| `GET`                    | `/api/cron/seed-trucks`                      | Seed trucks from the upstream vehicle feed                 |
| `GET`                    | `/api/cron/sync-locations`                   | Sync GPS locations for registered trucks                   |
| `GET`                    | `/api/cron/process-messages`                 | Parse pending messages                                     |

`GET /api/plant-status?date=YYYY-MM-DD` accepts an optional date for the
dispatch summary. `GET /api/customer-skid-loadings?includeHistory=true` includes
dispatched loadings; without that query, it returns active loadings.

For the Green API webhook, both validation and processing failures are returned
as JSON with HTTP 200 so the provider does not retry automatically. Check the
response's `ok` field to distinguish success from failure.

## UI server actions

UI components can call the feature actions directly instead of making fetch
requests to the app's own API routes. Actions live under `src/actions/<feature>`
and return a consistent `{ success, data }` or `{ success, error }` result.
Errors include a message and status; validation failures also include field
details.

```ts
import { createDispatchAction } from '@/actions/movements';

const result = await createDispatchAction(formValues);
if (!result.success) {
  setError(result.error.error);
}
```

Customer, movement, customer skid-loading, and plant-status API routes call
these same actions and return the same JSON result; action failures also set
the corresponding HTTP status. Webhooks, cron jobs, and external integrations
remain separate API routes.

## Data model

The current Drizzle schema defines:

- `customers`, `trucks`, and `skids` for customers and company fleet assets.
- `movements` and `trips` for dispatch and pickup lifecycles.
- `customer_skid_loadings` for customer-owned skids while they are at the plant.
- `plant_status` for the one current plant-status record.
- `geofence_zones` for plant/customer classifications and learned location
  areas.
- `messages` and `processed_messages` for incoming and parsed message data.
- `drivers`, `motormates`, and `ai_configurations` tables. These tables exist in
  the schema, but the current API route list does not expose CRUD workflows for
  them.

The schema and database functions enforce key rules such as one active movement
per truck, at most one trip per direction on a movement, loaded-only company
dispatch, loaded-only customer-skid-loading dispatch, and empty-or-loaded-only
washing selection.

## Technology

- Next.js 16 App Router and React 19
- TypeScript
- PostgreSQL with Drizzle ORM and Drizzle Kit
- Zod request validation
- HCL Tracker as the vehicle/location source
- Green API webhook message format

## Development setup

Requirements: Node.js, pnpm, PostgreSQL, and (for reset scripts) Bash and the
PostgreSQL `psql` command-line client.

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Format the code with Prettier:

   ```sh
   pnpm format
   ```

   Check formatting without changing files:

   ```sh
   pnpm format:check
   ```

3. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to a PostgreSQL
   database. The example file documents the expected connection-string format.
4. For HCL Tracker routes and location jobs, also configure:
   - `HCL_BASE_URL`
   - `HCL_USER`
   - `HCL_PASS`
5. Generate the current schema migration, append the database functions, and
   apply it:

   ```sh
   pnpm db:push
   ```

6. Configure `APP_URL` for the truck-seeding job, which calls the app's own
   vehicle endpoint.
7. Configure `CRON_SECRET` for scheduled jobs. The process-messages job
   requires it. The seed-trucks and sync-locations jobs check it when it is set.
8. Start the development server:

   ```sh
   pnpm dev
   ```

Available code checks/build:

```sh
pnpm lint
pnpm typecheck
pnpm build
```

The schema reset/generation scripts do not seed customer, truck, skid, or
geofence records. Customer creation is available through the API; this route
list does not include CRUD APIs for geofences, trucks, or skids. Live dispatch
requires appropriate customer and plant geofence records to be present.

## Database commands

| Command            | Effect                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm db:generate` | Generate a Drizzle migration and append SQL files from `db-functions/`                                                                           |
| `pnpm db:migrate`  | Apply generated Drizzle migrations                                                                                                               |
| `pnpm db:push`     | Generate and then apply migrations                                                                                                               |
| `pnpm db:force`    | Run `drizzle-kit push --force` directly                                                                                                          |
| `pnpm db:reset`    | **Destructive:** drops the PostgreSQL `public` schema, deletes local `drizzle/` migrations, regenerates schema and functions, and reapplies them |

Custom PostgreSQL functions are maintained in `db-functions/`; the
`scripts/append-functions.ts` script appends them to the generated migration.
Do not run `pnpm db:reset` against a database whose data must be retained.

## Scheduled jobs and test scripts

The cron routes are HTTP endpoints; `test/run-cron.sh` is a helper that calls
truck seeding, message processing, and location sync repeatedly against a
running local server. `test/run-seeds.sh` seeds sample customers and skids and
requires a disposable database.

The repository's test helpers need attention before they can be treated as a
reliable suite: `pnpm test:cron` points to a root `test.sh` file that is not
present, and `test/plant-status.sh` still expects the removed per-report
ID-based API. No unit-test runner is configured in `package.json`.

## Security and operational notes

- The process-messages cron route requires `CRON_SECRET`. The seed-trucks and
  sync-locations routes enforce the same bearer token only if that variable is
  configured.
- The other API routes do not implement authentication in their route
  handlers. Protect them at the deployment or network layer before exposing
  this service publicly.
- HCL Tracker credentials belong in `.env.local` or deployment secrets, not in
  committed files.
