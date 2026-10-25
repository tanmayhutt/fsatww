"""Thin client for the two Elexon BMRS datasets this app is allowed to use.

The brief links to the documentation pages on bmrs.elexon.co.uk. The JSON is
served from data.elexon.co.uk. No API key is required.
"""

from datetime import datetime, timedelta

import httpx

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"

# The stream endpoints accept long windows, but chunking keeps each response
# small and makes a partial failure cheap to retry.
CHUNK = timedelta(days=7)


def _stream(dataset: str, start: datetime, end: datetime) -> list[dict]:
    rows: list[dict] = []
    with httpx.Client(timeout=60) as client:
        cursor = start
        while cursor < end:
            chunk_end = min(cursor + CHUNK, end)
            response = client.get(
                f"{BASE_URL}/{dataset}/stream",
                params={
                    "publishDateTimeFrom": cursor.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "publishDateTimeTo": chunk_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                },
            )
            response.raise_for_status()
            rows.extend(response.json())
            cursor = chunk_end
    return rows


def fetch_wind_forecasts(start: datetime, end: datetime) -> list[dict]:
    """WINDFOR rows published in [start, end): publishTime, startTime, generation."""
    return [
        {"publishTime": r["publishTime"], "startTime": r["startTime"], "generation": r["generation"]}
        for r in _stream("WINDFOR", start, end)
    ]


def fetch_wind_actuals(start: datetime, end: datetime) -> list[dict]:
    """FUELHH rows for fuelType WIND published in [start, end): startTime, generation."""
    return [
        {"publishTime": r["publishTime"], "startTime": r["startTime"], "generation": r["generation"]}
        for r in _stream("FUELHH", start, end)
        if r["fuelType"] == "WIND"
    ]
