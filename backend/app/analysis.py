"""Forecast accuracy analysis for a day-ahead wind power buyer.

Everything here is driven by one rule: a forecast counts only if its
publishTime is before the moment the buyer had to decide. The forecast
horizon (startTime minus publishTime) is therefore the main grouping key.
"""

from __future__ import annotations

import json
import math
import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Decisions made in January 2026. A decision on day D-1 buys delivery day D.
FIRST_DECISION_DAY = date(2026, 1, 1)
LAST_DECISION_DAY = date(2026, 1, 31)

# N2EX (Nord Pool) GB day-ahead auction gate closure, 09:50 UK time.
# In January the UK is on GMT, so local time equals UTC.
DEFAULT_DECISION_TIME = time(9, 50)

UTC = timezone.utc


def parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def iso(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass(frozen=True)
class Forecast:
    publish_time: datetime
    start_time: datetime
    generation: float

    @property
    def horizon_hours(self) -> float:
        return (self.start_time - self.publish_time).total_seconds() / 3600


class WindData:
    """In-memory store of forecasts and hourly actuals for the study window."""

    def __init__(self, forecasts: list[Forecast], actuals_hourly: dict[datetime, float]):
        self.forecasts = sorted(forecasts, key=lambda f: (f.publish_time, f.start_time))
        self.actuals = actuals_hourly
        self.publish_times = sorted({f.publish_time for f in self.forecasts})
        self.by_publish: dict[datetime, list[Forecast]] = defaultdict(list)
        for f in self.forecasts:
            self.by_publish[f.publish_time].append(f)

    @classmethod
    def load(cls, data_dir: Path = DATA_DIR) -> "WindData":
        with open(data_dir / "windfor.json") as fh:
            forecasts = [
                Forecast(parse_ts(r["publishTime"]), parse_ts(r["startTime"]), float(r["generation"]))
                for r in json.load(fh)
            ]
        with open(data_dir / "fuelhh.json") as fh:
            raw_actuals = json.load(fh)

        # FUELHH is half-hourly, WINDFOR is hourly. Average the two settlement
        # periods of each hour so both series describe the same interval.
        buckets: dict[datetime, list[float]] = defaultdict(list)
        for r in raw_actuals:
            t = parse_ts(r["startTime"])
            buckets[t.replace(minute=0, second=0, microsecond=0)].append(float(r["generation"]))
        actuals = {t: statistics.fmean(v) for t, v in buckets.items() if len(v) == 2}
        return cls(forecasts, actuals)

    # Vintage selection

    def latest_publish_before(self, moment: datetime) -> datetime | None:
        """The most recent forecast vintage that existed at `moment`."""
        candidates = [p for p in self.publish_times if p <= moment]
        return candidates[-1] if candidates else None

    def vintages_for_day(self, delivery_day: date, before: datetime) -> list[datetime]:
        """All vintages published before `before` that cover the delivery day."""
        day_start = datetime.combine(delivery_day, time.min, UTC)
        day_end = day_start + timedelta(days=1)
        out = []
        for p in self.publish_times:
            if p > before:
                break
            if any(day_start <= f.start_time < day_end for f in self.by_publish[p]):
                out.append(p)
        return out

    def day_forecast(self, publish_time: datetime, delivery_day: date) -> list[Forecast]:
        day_start = datetime.combine(delivery_day, time.min, UTC)
        day_end = day_start + timedelta(days=1)
        return [f for f in self.by_publish[publish_time] if day_start <= f.start_time < day_end]

    # Pairing forecasts with outcomes

    def pairs(self, forecasts: list[Forecast]) -> list[dict]:
        out = []
        for f in forecasts:
            actual = self.actuals.get(f.start_time)
            if actual is None:
                continue
            out.append(
                {
                    "startTime": iso(f.start_time),
                    "publishTime": iso(f.publish_time),
                    "horizonHours": round(f.horizon_hours, 2),
                    "forecast": f.generation,
                    "actual": round(actual, 1),
                    "error": round(f.generation - actual, 1),
                }
            )
        return out

    def day_ahead_pairs(self, decision_time: time) -> list[dict]:
        """One forecast per delivery hour across the month, chosen the way the
        buyer would have chosen it: the latest vintage before gate closure."""
        out = []
        day = FIRST_DECISION_DAY
        while day <= LAST_DECISION_DAY:
            decision_at = datetime.combine(day, decision_time, UTC)
            vintage = self.latest_publish_before(decision_at)
            if vintage is not None:
                out.extend(self.pairs(self.day_forecast(vintage, day + timedelta(days=1))))
            day += timedelta(days=1)
        return out


# Metrics

def summarise(errors: list[float], actuals: list[float] | None = None) -> dict:
    if not errors:
        return {"count": 0}
    abs_errors = [abs(e) for e in errors]
    out = {
        "count": len(errors),
        "mae": round(statistics.fmean(abs_errors), 1),
        "rmse": round(math.sqrt(statistics.fmean(e * e for e in errors)), 1),
        "bias": round(statistics.fmean(errors), 1),
        "p50AbsError": round(_quantile(abs_errors, 0.5), 1),
        "p90AbsError": round(_quantile(abs_errors, 0.9), 1),
        "maxAbsError": round(max(abs_errors), 1),
        "errorP10": round(_quantile(errors, 0.1), 1),
        "errorP90": round(_quantile(errors, 0.9), 1),
    }
    if actuals:
        mean_actual = statistics.fmean(actuals)
        out["meanActual"] = round(mean_actual, 1)
        out["nmaePct"] = round(100 * out["mae"] / mean_actual, 1) if mean_actual else None
    return out


def _quantile(values: list[float], q: float) -> float:
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    pos = q * (len(s) - 1)
    lo, hi = math.floor(pos), math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def horizon_profile(pairs: list[dict], bucket_hours: int = 2) -> list[dict]:
    """Error statistics grouped by forecast horizon."""
    buckets: dict[int, list[dict]] = defaultdict(list)
    for p in pairs:
        if p["horizonHours"] < 0:
            continue
        buckets[int(p["horizonHours"] // bucket_hours) * bucket_hours].append(p)
    out = []
    for start in sorted(buckets):
        rows = buckets[start]
        stats = summarise([r["error"] for r in rows], [r["actual"] for r in rows])
        out.append({"horizonFrom": start, "horizonTo": start + bucket_hours, **stats})
    return out


def hour_of_day_profile(pairs: list[dict]) -> list[dict]:
    buckets: dict[int, list[dict]] = defaultdict(list)
    for p in pairs:
        buckets[parse_ts(p["startTime"]).hour].append(p)
    return [
        {"hour": h, **summarise([r["error"] for r in buckets[h]], [r["actual"] for r in buckets[h]])}
        for h in sorted(buckets)
    ]


def daily_profile(pairs: list[dict]) -> list[dict]:
    buckets: dict[str, list[dict]] = defaultdict(list)
    for p in pairs:
        buckets[p["startTime"][:10]].append(p)
    out = []
    for day in sorted(buckets):
        rows = buckets[day]
        out.append(
            {
                "deliveryDay": day,
                "publishTime": rows[0]["publishTime"],
                "forecastMwh": round(sum(r["forecast"] for r in rows), 0),
                "actualMwh": round(sum(r["actual"] for r in rows), 0),
                **summarise([r["error"] for r in rows], [r["actual"] for r in rows]),
            }
        )
    return out


def error_histogram(pairs: list[dict], width: int = 500) -> list[dict]:
    buckets: dict[int, int] = defaultdict(int)
    for p in pairs:
        buckets[int(math.floor(p["error"] / width)) * width] += 1
    return [{"from": b, "to": b + width, "count": buckets[b]} for b in sorted(buckets)]
