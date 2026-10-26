"""FastAPI service exposing the wind forecast analysis.

Routes are read-only and computed from a committed Elexon snapshot, so the
service has no database and no secrets. Refresh the snapshot with
`python -m scripts.fetch_data`.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from functools import lru_cache

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .analysis import (
    DEFAULT_DECISION_TIME,
    FIRST_DECISION_DAY,
    LAST_DECISION_DAY,
    UTC,
    WindData,
    band_coverage,
    bias_for_day,
    corrected_pairs,
    daily_profile,
    day_ahead_by_day,
    rolling_bias,
    error_histogram,
    horizon_profile,
    hour_of_day_profile,
    iso,
    parse_ts,
    summarise,
)

app = FastAPI(title="Wind forecast accuracy API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def data() -> WindData:
    return WindData.load()


def _parse_decision_time(value: str) -> time:
    try:
        hh, mm = value.split(":")
        return time(int(hh), int(mm))
    except ValueError as exc:
        raise HTTPException(400, "decisionTime must look like HH:MM") from exc


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "forecastRows": len(data().forecasts), "actualHours": len(data().actuals)}


@app.get("/api/meta")
def meta() -> dict:
    d = data()
    return {
        "firstDecisionDay": FIRST_DECISION_DAY.isoformat(),
        "lastDecisionDay": LAST_DECISION_DAY.isoformat(),
        "defaultDecisionTime": DEFAULT_DECISION_TIME.strftime("%H:%M"),
        "publishTimesOfDay": sorted({p.strftime("%H:%M") for p in d.publish_times}),
        "forecastRows": len(d.forecasts),
        "actualHours": len(d.actuals),
        "source": {
            "forecasts": "Elexon BMRS dataset WINDFOR",
            "actuals": "Elexon BMRS dataset FUELHH, fuelType WIND",
        },
    }


@app.get("/api/decision")
def decision(
    day: date = Query(..., description="Decision day, the day before delivery"),
    decisionTime: str = Query(DEFAULT_DECISION_TIME.strftime("%H:%M")),
) -> dict:
    """What the buyer could see at the moment of the day-ahead decision."""
    if not FIRST_DECISION_DAY <= day <= LAST_DECISION_DAY:
        raise HTTPException(400, f"day must be between {FIRST_DECISION_DAY} and {LAST_DECISION_DAY}")
    d = data()
    t = _parse_decision_time(decisionTime)
    decision_at = datetime.combine(day, t, UTC)
    delivery_day = day + timedelta(days=1)

    vintage = d.latest_publish_before(decision_at)
    if vintage is None:
        raise HTTPException(404, "No forecast existed before that moment")
    usable = d.pairs(d.day_forecast(vintage, delivery_day))

    # Earlier vintages for the same day show how the forecast moved.
    history = [
        {"publishTime": iso(p), "points": d.pairs(d.day_forecast(p, delivery_day))}
        for p in d.vintages_for_day(delivery_day, decision_at)
    ]

    # The last forecast issued before each delivery hour. The buyer never had
    # it, so it is shown only to make the horizon effect visible.
    hindsight = []
    for f in d.day_forecast(vintage, delivery_day):
        latest = d.latest_publish_before(f.start_time)
        if latest is None:
            continue
        match = [g for g in d.by_publish[latest] if g.start_time == f.start_time]
        hindsight.extend(d.pairs(match))

    # Expected error band for each horizon, learned from the whole month using
    # forecasts chosen the same way (latest before gate closure).
    profile = horizon_profile(d.day_ahead_pairs(t))
    band = {row["horizonFrom"]: row for row in profile}
    for p in usable:
        key = int(p["horizonHours"] // 2) * 2
        row = band.get(key)
        if row and row.get("count"):
            p["bandLow"] = round(p["forecast"] - row["errorP90"], 1)
            p["bandHigh"] = round(p["forecast"] - row["errorP10"], 1)

    # Wind to plan for: the forecast minus the bias learned from earlier
    # decision days only. The first day of the study has nothing to learn from.
    bias = bias_for_day(d, t, day)
    for p in usable:
        p["planFor"] = round(p["forecast"] - bias["bias"], 1)
        p["errorCorrected"] = round(p["planFor"] - p["actual"], 1)

    errors = [p["error"] for p in usable]
    corrected = [p["errorCorrected"] for p in usable]
    return {
        "decisionAt": iso(decision_at),
        "deliveryDay": delivery_day.isoformat(),
        "publishTime": iso(vintage),
        "forecastAgeMinutes": int((decision_at - vintage).total_seconds() // 60),
        "points": usable,
        "history": history,
        "hindsight": hindsight,
        "bias": bias,
        "summary": {
            "forecastMwh": round(sum(p["forecast"] for p in usable), 0),
            "planForMwh": round(sum(p["planFor"] for p in usable), 0),
            "actualMwh": round(sum(p["actual"] for p in usable), 0),
            **summarise(errors, [p["actual"] for p in usable]),
            "corrected": summarise(corrected, [p["actual"] for p in usable]),
        },
    }


@app.get("/api/accuracy")
def accuracy(decisionTime: str = Query(DEFAULT_DECISION_TIME.strftime("%H:%M"))) -> dict:
    """Quantified error of the forecasts a day-ahead buyer actually had."""
    d = data()
    t = _parse_decision_time(decisionTime)
    day_ahead = d.day_ahead_pairs(t)
    all_pairs = d.pairs(
        [
            f
            for f in d.forecasts
            if FIRST_DECISION_DAY + timedelta(days=1) <= f.start_time.date() <= LAST_DECISION_DAY + timedelta(days=1)
        ]
    )
    actuals = [p["actual"] for p in day_ahead]

    # Raw against corrected, on the same days: every decision day that had at
    # least one earlier day to learn the bias from.
    table = rolling_bias(d, t)
    corrected = corrected_pairs(d, t)
    raw_same_days = [p for day, ps in day_ahead_by_day(d, t) if table[day]["days"] > 0 for p in ps]
    raw_summary = summarise([p["error"] for p in raw_same_days], [p["actual"] for p in raw_same_days])
    corrected_summary = summarise([p["errorCorrected"] for p in corrected], [p["actual"] for p in corrected])
    by_day = daily_profile(day_ahead)

    return {
        "decisionTime": t.strftime("%H:%M"),
        "dayAhead": {
            "summary": summarise([p["error"] for p in day_ahead], actuals),
            "daysOver": sum(1 for row in by_day if row["bias"] > 0),
            "days": len(by_day),
            "byHourOfDay": hour_of_day_profile(day_ahead),
            "byDay": by_day,
            "histogram": error_histogram(day_ahead),
        },
        "correction": {
            "days": len({p["startTime"][:10] for p in corrected}),
            "hours": len(corrected),
            "raw": raw_summary,
            "corrected": corrected_summary,
            "improvementPct": round(100 * (1 - corrected_summary["mae"] / raw_summary["mae"]), 1)
            if raw_summary.get("mae")
            else None,
            "finalBias": table[max(table)]["bias"] if table else None,
        },
        "bandCheck": band_coverage(d, t),
        "byHorizon": horizon_profile(all_pairs),
        "pairCount": len(all_pairs),
    }


@app.get("/api/actuals")
def actuals() -> dict:
    """Hourly metered wind for the whole window. Drives the hero animation."""
    d = data()
    hours = sorted(d.actuals)
    return {
        "start": iso(hours[0]),
        "stepMinutes": 60,
        "maxMw": round(max(d.actuals.values()), 1),
        "mw": [round(d.actuals[h], 1) for h in hours],
    }


@app.get("/api/vintages")
def vintages(day: date = Query(...)) -> dict:
    """Every forecast vintage covering a delivery day, for the tech walkthrough."""
    d = data()
    end_of_day = datetime.combine(day, time.max, UTC)
    return {
        "deliveryDay": day.isoformat(),
        "vintages": [
            {"publishTime": iso(p), "points": d.pairs(d.day_forecast(p, day))}
            for p in d.vintages_for_day(day, end_of_day)
        ],
    }


# In the Docker image the built React app sits next to the API and is served
# from the same origin. In development Vite serves it and proxies /api here.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
