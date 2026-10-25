# Wind Forecast Desk

A web portal for a GB electricity supplier's day-ahead buying desk. It shows the national wind
generation forecast that was actually available at the moment the day-ahead auction closed, and it
quantifies how wrong that forecast tends to be, so the desk can buy with a known margin.

Scope follows the brief: national wind actuals and forecasts from Elexon only, for purchase
decisions made in January 2026.

Live app: **TODO add Vercel URL**

## What it does

**Day-ahead desk.** Pick a decision day. The app finds the newest Elexon forecast published before
gate closure (09:50 GMT by default, adjustable) and shows the 24 hourly values for the delivery day,
with a shaded range the outcome fell inside 80% of the time in January for that lead time. Actuals
and later forecasts can be overlaid to see what happened, and a table lists every forecast vintage
that existed before the decision so the drift is visible.

**Forecast accuracy.** Headline error metrics for the forecasts the desk really had, across all 31
decision days: mean absolute error, bias, P90 miss, RMSE. Charts break the error down by lead time,
by hour of delivery, by day, and as a distribution.

**Method.** Plain-language description of the data, the decision-moment rule, the metrics and the
limits of one month of data.

## The one idea that matters

Elexon reissues the wind forecast several times a day. Each reissue for the same delivery hour is
closer to delivery and usually better. A buyer at 09:50 on the day before can only use the issue
that existed then, so scoring forecasts against the newest issue would use information the buyer
never had and would understate the error. Every number in the app is computed on the vintage with
the latest `publishTime` on or before the decision moment, and error is grouped by horizon
(`startTime` minus `publishTime`) so the cost of deciding early is explicit.

Finding from the data: across January 2026 the day-ahead forecast ran about 1.7 GW above metered
output on average, at every lead time. Curtailment of wind farms is a likely contributor, since
WINDFOR forecasts available wind and FUELHH measures what was actually delivered. A desk can correct
for a stable bias before buying.

## Repository layout

```
.
├── backend/
│   ├── app/
│   │   ├── main.py          FastAPI routes: /api/meta, /api/decision, /api/accuracy, /api/vintages
│   │   ├── analysis.py      Vintage selection, forecast-actual pairing, error metrics
│   │   └── elexon.py        Client for the Elexon WINDFOR and FUELHH stream endpoints
│   ├── scripts/fetch_data.py  Downloads the Elexon snapshot into backend/data
│   ├── data/                Committed snapshot: windfor.json, fuelhh.json, snapshot.json
│   ├── tests/               pytest unit tests for the analysis rules
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          Shell, tabs, gate-closure control
│   │   ├── api.js           Fetch wrapper for the API
│   │   ├── theme.js         Chart colours
│   │   ├── format.js        Number and date formatting
│   │   └── components/
│   │       ├── DecisionView.jsx   Day-ahead desk view
│   │       ├── AccuracyView.jsx   Forecast accuracy view
│   │       ├── MethodView.jsx     Method notes
│   │       ├── StatTile.jsx
│   │       └── ChartTooltip.jsx
│   ├── index.html, vite.config.js, package.json
├── api/index.py             Vercel serverless entry that imports the FastAPI app
├── deploy/                  Server deploy scripts, Caddy site file and deployment notes
├── .github/workflows/deploy.yml  CI (tests, build) and deploy on push to main
├── Dockerfile               Multi-stage build: Vite build, then Python image serving API and UI
├── compose.yaml
├── vercel.json              Static front end plus Python function for /api/*
└── requirements.txt         Dependencies for the Vercel function
```

## Running it

### Docker, one command

```bash
docker compose up --build
```

Open http://localhost:5090. The image builds the React app and serves it from the FastAPI process.
Set `WIND_DESK_BIND=0.0.0.0:8000` to bind elsewhere.

### Local development

Backend (Python 3.12 or newer):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend (Node 20 or newer), in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to port 8000.

Tests:

```bash
cd backend && pytest
```

### Refreshing the data snapshot

The Elexon data is committed as a snapshot so the deployed app is fast and reproducible. To pull it
again:

```bash
cd backend && python -m scripts.fetch_data
```

## Data

- Forecasts: Elexon BMRS dataset `WINDFOR`, fields `publishTime`, `startTime`, `generation` (MW).
  Hourly target times, reissued roughly eight times a day.
- Actuals: Elexon BMRS dataset `FUELHH`, `fuelType = WIND`, fields `startTime`, `generation` (MW),
  half-hourly. The two half hours in each forecast hour are averaged.
- Window: forecasts published 29 December 2025 to 1 February 2026, actuals for 1 January to
  2 February 2026, which covers every delivery day bought by a decision made in January 2026.
- No API key is required. The JSON host is `data.elexon.co.uk`; the brief's links point at the
  documentation pages on `bmrs.elexon.co.uk`.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/meta` | Data window, default gate closure, available publish times |
| `GET /api/decision?day=2026-01-14&decisionTime=09:50` | Forecast available at the decision moment for the next day, with actuals, earlier vintages and expected range |
| `GET /api/accuracy?decisionTime=09:50` | Error metrics for the day-ahead forecasts across the month, plus the horizon profile |
| `GET /api/vintages?day=2026-01-15` | Every forecast vintage covering a delivery day |
| `GET /api/health` | Liveness and row counts |

## Design notes

- Pure Python for the analysis. Twenty thousand rows do not need pandas, and a small dependency set
  keeps the serverless cold start short.
- Metrics are computed on request from an in-memory store loaded once per process. No database.
- The expected range is empirical (P10 to P90 of signed error per two-hour horizon bucket), not a
  model. With one month of data that is the honest option.
- One light theme, no icon library, Recharts for charts. Forecast is always blue and actual is
  always orange, on every chart.

## AI tools

This project was built with Claude (Anthropic) used as a coding assistant for scaffolding,
implementation and review. All design decisions, the analysis method and the data checks were
reviewed by the author.
