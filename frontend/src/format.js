const mw = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export const fmtMW = (v) => (v == null ? "n/a" : `${mw.format(v)} MW`);
export const fmtMWh = (v) => (v == null ? "n/a" : `${mw.format(v)} MWh`);
export const fmtNum = (v) => (v == null ? "n/a" : mw.format(v));
export const fmtSigned = (v) => (v == null ? "n/a" : `${v > 0 ? "+" : ""}${mw.format(v)} MW`);
export const fmtPct = (v) => (v == null ? "n/a" : `${v.toFixed(1)}%`);

export const hourLabel = (isoString) => isoString.slice(11, 16);

export const dateLabel = (isoDate) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export const dateTimeLabel = (isoString) =>
  new Date(isoString).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " GMT";

export const addDays = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
