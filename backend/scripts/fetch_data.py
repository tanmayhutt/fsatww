"""Download the Elexon snapshot used by the API.

Run from the backend directory:  python -m scripts.fetch_data

Forecasts are fetched from a few days before the study window because a
vintage published on 29 December still covers delivery hours on 1 January.
Actuals are fetched slightly past the window because FUELHH publishes each
half hour shortly after it ends.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

from app.elexon import fetch_wind_actuals, fetch_wind_forecasts

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

FORECAST_PUBLISH_FROM = datetime(2025, 12, 29, tzinfo=timezone.utc)
FORECAST_PUBLISH_TO = datetime(2026, 2, 2, tzinfo=timezone.utc)
ACTUAL_PUBLISH_FROM = datetime(2026, 1, 1, tzinfo=timezone.utc)
ACTUAL_PUBLISH_TO = datetime(2026, 2, 3, tzinfo=timezone.utc)


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    forecasts = fetch_wind_forecasts(FORECAST_PUBLISH_FROM, FORECAST_PUBLISH_TO)
    actuals = fetch_wind_actuals(ACTUAL_PUBLISH_FROM, ACTUAL_PUBLISH_TO)
    (DATA_DIR / "windfor.json").write_text(json.dumps(forecasts, separators=(",", ":")))
    (DATA_DIR / "fuelhh.json").write_text(json.dumps(actuals, separators=(",", ":")))
    (DATA_DIR / "snapshot.json").write_text(
        json.dumps(
            {
                "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "forecastRows": len(forecasts),
                "actualRows": len(actuals),
            },
            indent=2,
        )
    )
    print(f"forecasts={len(forecasts)} actuals={len(actuals)} -> {DATA_DIR}")


if __name__ == "__main__":
    main()
