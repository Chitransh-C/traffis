# Vaahan Drishti Command

City ANPR command center for a Gwalior demo: cameras, plate tracks, congestion, and a camera-graph route engine. Events are **seeded into PostGIS** — there is no live ML or Kafka.

Archive week in the current seed: **Sat 29 Aug – Fri 4 Sept 2026** (IST).

---

## What you need

- [Node.js](https://nodejs.org/) 20 or newer
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker Compose v2)
- Git
- Port **5432** free for Postgres, **8000** for the API, **5173** for the UI

On Windows use PowerShell. Run commands from the repo root.

---

## 1. Clone

```bash
git clone <repo-url> traffis
cd traffis
```

---

## 2. Install dependencies

Frontend (repo root):

```bash
npm install
```

API:

```bash
npm --prefix backend install
```

---

## 3. Start Postgres (PostGIS)

Bring up the `traffis-postgres` container. First start applies [`backend/schema.sql`](backend/schema.sql).

```bash
npm run db:up
```

Same as `docker compose up -d`.

Wait until healthy:

```bash
docker compose ps
```

`traffis-postgres` should show **healthy**.

| | |
| --- | --- |
| Host | `127.0.0.1:5432` |
| User / password / database | `traffis` / `traffis` / `traffis` |
| URL | `postgres://traffis:traffis@127.0.0.1:5432/traffis` |

Override with `DATABASE_URL` if needed.

---

## 4. Seed demo data

Loads cameras, vehicles, observations, alerts, and city meta from `src/data/*.json` into Postgres (truncates those tables first).

```bash
npm run db:seed
```

You should see something like: `Seeded 12 cameras, 100 vehicles, … observations, … alerts`.

You do **not** need to regenerate JSON for a first run. Those files are already in the repo.

Optional — rebuild the tape and re-fetch OSRM road shapes (needs network):

```bash
npm run generate
npm run db:seed
```

---

## 5. Start the application

Use **two terminals** from the repo root.

**API** (Express on port 8000):

```bash
npm run api
```

Wait for `TRAFFIS API on http://localhost:8000`.

**UI** (Vite on port 5173, proxies `/api` → 8000):

```bash
npm run dev
```

Open **http://localhost:5173**

If the UI says API offline: API not running, Docker down, or seed not applied.

Health check:

```bash
curl http://127.0.0.1:8000/api/health
```

---

## Daily restart

```bash
npm run db:up          # if the container is stopped
npm run api            # terminal 1
npm run dev            # terminal 2
```

Re-seed only when you change `src/data` or after `npm run generate`.

Stop Postgres: `docker compose down` (data stays in the `traffis_pg` volume). Wipe the volume only if you intend to lose the DB.

---

## App map

| Page | Use |
| --- | --- |
| **Command** | City map, congestion, cameras, observations, selected plate |
| **Analytics** | Flow, mix, OD (scroll the page) |
| **Trajectories** | Plate + date/time range → camera hits → Plot on map. **Story** vs **All possible paths**. **Last-seen zone** is a small ring on the last camera. |
| **Cameras** | Node list |
| **Alerts** | Full alert list for the scrubber day |

Playback bar at the bottom drives Command / Analytics / Alerts time. Trajectories uses its own from/to range.

Demo plates and windows: [`DEMO-PLATES.md`](DEMO-PLATES.md). Route-engine rules: [`engine_rules.md`](engine_rules.md).

Quick track: `MP07VP3320` · Thu 03 Sept · 11:00–17:00 · Track · Plot on map.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Frontend deps |
| `npm --prefix backend install` | API deps |
| `npm run db:up` | Docker Compose: PostGIS 16 |
| `npm run db:seed` | JSON → Postgres |
| `npm run api` | API with reload, `:8000` |
| `npm run dev` | Vite UI, `:5173` |
| `npm run generate` | Rebuild demo JSON + OSRM paths |
| `npm run build` | Typecheck + production UI |

---

## If something fails

- **Port 5432 in use** — stop local Postgres or change the host port in `docker-compose.yml`.
- **Seed errors** — container must be healthy first; then `npm run db:seed` again.
- **UI boots but empty map / API offline** — start `npm run api` and confirm `/api/health`.
- **Docker not running** — start Docker Desktop, then `npm run db:up`.
