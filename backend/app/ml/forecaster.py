"""
Demand forecasting using Facebook Prophet.

Provides two public entry points:

1. ``forecast_demand``  – supply-item demand forecast.
   Reads **real** daily consumption from the ``medicine_consumption``
   PostgreSQL table.  Falls back to synthetic generation when the
   database contains fewer than 30 days of history.

2. ``predict_demand``   – patient-footfall forecast (async).
   Uses Prophet when ≥ 14 records are provided; otherwise falls
   back to a simple-moving-average with ±20 % bounds.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import Any

try:
    import numpy as np  # type: ignore[import-untyped, import-not-found, unused-ignore]
except (ImportError, ModuleNotFoundError):
    np = None  # type: ignore[assignment]

try:
    import pandas as pd  # type: ignore[import-untyped, import-not-found, unused-ignore]
except (ImportError, ModuleNotFoundError):
    pd = None  # type: ignore[assignment]

try:
    from prophet import Prophet  # type: ignore[import-untyped, import-not-found, unused-ignore]
except (ImportError, ModuleNotFoundError):
    Prophet = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

# Minimum rows of history required for a meaningful Prophet fit.
_MIN_HISTORY_DAYS = 30


# ── Real-data fetcher ────────────────────────────────────────────────────────

def _fetch_real_consumption(item_id: int) -> pd.DataFrame | None:
    """Try to read daily consumption history from PostgreSQL.

    Returns a ``(ds, y)`` DataFrame when at least ``_MIN_HISTORY_DAYS``
    rows are available; otherwise returns ``None`` so the caller can
    fall back to synthetic data.
    """
    try:
        from app import db  # late import to avoid circular deps

        query = """
        SELECT consumption_date AS ds,
               SUM(quantity_consumed) AS y
        FROM medicine_consumption
        WHERE item_id = %s
        GROUP BY consumption_date
        ORDER BY consumption_date
        """
        rows = db.fetch_all(query, (item_id,))

        if len(rows) < _MIN_HISTORY_DAYS or pd is None:
            if pd is None:
                logger.warning("Pandas unavailable — falling back to synthetic data.")
            else:
                logger.info(
                    "Only %d real consumption rows for item %d (need %d); "
                    "falling back to synthetic data.",
                    len(rows), item_id, _MIN_HISTORY_DAYS,
                )
            return None

        df = pd.DataFrame(rows)
        df["ds"] = pd.to_datetime(df["ds"])
        df["y"] = df["y"].astype(float)
        logger.info(
            "Using %d real consumption rows for item %d.", len(df), item_id,
        )
        return df

    except Exception as e:
        logger.warning(
            "Could not fetch real consumption for item %d (%s). "
            "Falling back to synthetic data.",
            item_id, e,
        )
        return None


# ── Synthetic-data fallback ──────────────────────────────────────────────────

def _generate_synthetic_history(
    item_id: int,
    current_quantity: int,
    days: int = 180,
) -> pd.DataFrame:
    """Build a realistic-looking consumption history.

    Used **only** when the ``medicine_consumption`` table does not
    contain enough history for the requested item.  Retained (not
    deleted) per project requirements — acts as the safety-net
    fallback so the ML pipeline never fails due to missing data.
    """
    if np is None or pd is None:
        return None  # type: ignore[return-value]

    np.random.seed(item_id)  # reproducible per item
    base_daily = max(current_quantity / 30, 5)

    dates = [datetime.utcnow() - timedelta(days=days - i) for i in range(days)]
    values: list[float] = []
    for dt in dates:
        seasonal = 1.0 + 0.15 * np.sin(2 * np.pi * dt.weekday() / 7)
        noise = np.random.normal(0, base_daily * 0.1)
        values.append(max(0, base_daily * seasonal + noise))

    return pd.DataFrame({"ds": dates, "y": values})


# ── Public API: supply-item demand forecast ──────────────────────────────────

def forecast_demand(
    item_id: int,
    item_name: str,
    current_quantity: int,
    horizon_days: int = 30,
) -> list[dict]:
    """Return ``[{date, predicted_demand, lower_bound, upper_bound}, ...]``.

    Attempts real consumption data first; falls back to synthetic.
    """
    # Try real data first, fall back to synthetic
    history = _fetch_real_consumption(item_id)
    if history is None:
        history = _generate_synthetic_history(item_id, current_quantity)

    if Prophet is None or pd is None or np is None:
        logger.warning("ML libraries unavailable — falling back to synthetic SMA trend.")
        last_val = 10.0
        if history is not None and hasattr(history, "empty") and not history.empty:
            try:
                last_val = float(history["y"].iloc[-1])
            except Exception:
                pass
        return [
            {
                "date": (datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d"),
                "predicted_demand": max(0, round(last_val)),
                "lower_bound": max(0, round(last_val * 0.8)),
                "upper_bound": round(last_val * 1.2),
            }
            for i in range(1, horizon_days + 1)
        ]

    model = Prophet(
        yearly_seasonality=False,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,
    )
    model.fit(history)

    future = model.make_future_dataframe(periods=horizon_days)
    forecast = model.predict(future)

    # Return only the forecasted window (not the fitted history)
    result = forecast.tail(horizon_days)[
        ["ds", "yhat", "yhat_lower", "yhat_upper"]
    ]
    return [
        {
            "date": row["ds"].strftime("%Y-%m-%d"),
            "predicted_demand": round(row["yhat"], 1),
            "lower_bound": round(row["yhat_lower"], 1),
            "upper_bound": round(row["yhat_upper"], 1),
        }
        for _, row in result.iterrows()
    ]


# ── Patient Footfall Prediction ─────────────────────────────────────────────

_FORECAST_HORIZON = 7  # days to predict ahead
_MIN_RECORDS_FOR_PROPHET = 14  # Prophet needs at least ~2 weeks of data


def _run_prophet(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Fit Prophet on *df* (columns ``ds``, ``y``) and return 7-day forecast.

    This is a **synchronous** helper designed to be offloaded to a thread
    pool via :func:`asyncio.to_thread` so the event-loop stays responsive.
    """
    model = Prophet(
        yearly_seasonality=False,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,
    )
    model.fit(df)

    future = model.make_future_dataframe(periods=_FORECAST_HORIZON)
    forecast = model.predict(future)

    rows = forecast.tail(_FORECAST_HORIZON)[
        ["ds", "yhat", "yhat_lower", "yhat_upper"]
    ]
    return [
        {
            "date": row["ds"].strftime("%Y-%m-%d"),
            "predicted_count": max(0, round(row["yhat"], 1)),
            "lower_bound": max(0, round(row["yhat_lower"], 1)),
            "upper_bound": max(0, round(row["yhat_upper"], 1)),
        }
        for _, row in rows.iterrows()
    ]


def _sma_fallback(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flat 7-day forecast from the simple moving average (±20 % bounds).

    Used when fewer than ``_MIN_RECORDS_FOR_PROPHET`` records are
    supplied — too few for Prophet to fit meaningfully.
    """
    counts = [r["patient_count"] for r in records]
    sma = sum(counts) / len(counts) if counts else 0.0
    margin = round(sma * 0.2, 1)

    last_date_str = max(r["date"] for r in records)
    # Accept both date objects and ISO-format strings
    if isinstance(last_date_str, date):
        last_date = last_date_str
    else:
        last_date = datetime.strptime(str(last_date_str), "%Y-%m-%d").date()

    result: list[dict[str, Any]] = []
    for day_offset in range(1, _FORECAST_HORIZON + 1):
        forecast_date = last_date + timedelta(days=day_offset)
        result.append(
            {
                "date": forecast_date.strftime("%Y-%m-%d"),
                "predicted_count": max(0, round(sma, 1)),
                "lower_bound": max(0, round(sma - margin, 1)),
                "upper_bound": round(sma + margin, 1),
            }
        )
    return result


async def predict_demand(
    records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Predict patient footfall for the next 7 days.

    Parameters
    ----------
    records:
        Dicts with keys ``date`` (``YYYY-MM-DD`` str or :class:`date`)
        and ``patient_count`` (int).

    Returns
    -------
    list[dict]
        Seven dicts with ``date``, ``predicted_count``, ``lower_bound``,
        ``upper_bound``.
    """
    if not records:
        raise ValueError("records must be a non-empty list")

    # ── Fallback: too few data points for Prophet ────────────────────────
    if len(records) < _MIN_RECORDS_FOR_PROPHET or Prophet is None or pd is None:
        if Prophet is None or pd is None:
            logger.warning("Prophet/Pandas module unavailable — using SMA fallback.")
        else:
            logger.info(
                "Only %d record(s) received (< %d) — using SMA fallback.",
                len(records), _MIN_RECORDS_FOR_PROPHET,
            )
        return _sma_fallback(records)

    # ── Full Prophet forecast ────────────────────────────────────────────
    logger.info("Received %d records — fitting Prophet model.", len(records))

    df = pd.DataFrame(
        {
            "ds": pd.to_datetime(
                [r["date"] for r in records], format="%Y-%m-%d"
            ),
            "y": [r["patient_count"] for r in records],
        }
    )

    # Run the CPU-bound Prophet fit in a thread so we don't block the
    # async event loop.
    return await asyncio.to_thread(_run_prophet, df)
