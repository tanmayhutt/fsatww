from datetime import datetime, time, timezone

from app.analysis import Forecast, WindData, band_coverage, corrected_pairs, horizon_profile, rolling_bias, summarise

UTC = timezone.utc


def ts(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 1, day, hour, minute, tzinfo=UTC)


def make_data() -> WindData:
    # Two vintages for delivery day 15 January: one before and one after a
    # 09:50 decision on 14 January. The later one is closer to the outcome.
    early = [Forecast(ts(14, 7, 30), ts(15, h), 10000.0) for h in range(24)]
    late = [Forecast(ts(14, 11, 30), ts(15, h), 11500.0) for h in range(24)]
    actuals = {ts(15, h): 12000.0 for h in range(24)}
    return WindData(early + late, actuals)


def test_latest_vintage_respects_decision_moment():
    d = make_data()
    assert d.latest_publish_before(ts(14, 9, 50)) == ts(14, 7, 30)
    assert d.latest_publish_before(ts(14, 12, 0)) == ts(14, 11, 30)
    assert d.latest_publish_before(ts(14, 1, 0)) is None


def test_day_ahead_pairs_use_only_forecasts_the_buyer_had():
    d = make_data()
    pairs = d.day_ahead_pairs(time(9, 50))
    assert len(pairs) == 24
    assert all(p["publishTime"] == "2026-01-14T07:30:00Z" for p in pairs)
    assert all(p["error"] == -2000.0 for p in pairs)


def test_summary_metrics():
    s = summarise([100.0, -100.0, 300.0], [1000.0, 1000.0, 1000.0])
    assert s["count"] == 3
    assert s["mae"] == 166.7
    assert s["bias"] == 100.0
    assert s["nmaePct"] == 16.7


def test_horizon_profile_buckets_by_lead_time():
    d = make_data()
    profile = horizon_profile(d.pairs(d.forecasts))
    # Early vintage covers 16.5h to 39.5h ahead, late vintage 12.5h to 35.5h.
    assert profile[0]["horizonFrom"] == 12
    assert profile[-1]["horizonTo"] == 40
    assert sum(row["count"] for row in profile) == 48


def test_half_hourly_actuals_are_averaged_to_hours(tmp_path):
    import json

    (tmp_path / "windfor.json").write_text(json.dumps([]))
    (tmp_path / "fuelhh.json").write_text(
        json.dumps(
            [
                {"startTime": "2026-01-15T00:00:00Z", "generation": 100},
                {"startTime": "2026-01-15T00:30:00Z", "generation": 300},
                {"startTime": "2026-01-15T01:00:00Z", "generation": 500},
            ]
        )
    )
    d = WindData.load(tmp_path)
    assert d.actuals == {ts(15, 0): 200.0}


def make_month(days=4, bias=1000.0):
    # Each decision day D-1 at 07:30 issues a forecast for day D that is
    # `bias` MW above the actual, so the rolling correction can be checked.
    forecasts = []
    actuals = {}
    for d in range(1, days + 1):
        for h in range(24):
            target = ts(d + 1, h)
            forecasts.append(Forecast(ts(d, 7, 30), target, 10000.0 + bias))
            actuals[target] = 10000.0
    return WindData(forecasts, actuals)


def test_rolling_bias_uses_only_earlier_days():
    d = make_month()
    table = rolling_bias(d, time(9, 50))
    first = min(table)
    assert table[first] == {"bias": 0.0, "days": 0}
    later = [v for k, v in sorted(table.items())][1:]
    assert all(v["bias"] == 1000.0 for v in later)
    assert [v["days"] for v in later] == [1, 2, 3]


def test_corrected_pairs_remove_a_constant_bias():
    d = make_month()
    pairs = corrected_pairs(d, time(9, 50))
    assert len(pairs) == 3 * 24
    assert all(p["errorCorrected"] == 0.0 for p in pairs)
    assert all(p["planFor"] == 10000.0 for p in pairs)


def test_band_coverage_counts_hours_inside_the_band():
    d = make_month()
    result = band_coverage(d, time(9, 50))
    assert result["total"] == 4 * 24
    assert result["inside"] == result["total"]
    assert result["coveragePct"] == 100.0
