// KPI dataset uploaded from the monthly KPI sheet.
// New months can be added to the `KPI_DATASETS` map and a filter will pick them up automatically.

export type KPIMetrics = {
  dm: string;
  mr: string;
  areas: number;
  activeMR: number;
  pmWorkingDays: number;
  avgPMWorkingDays: number;
  doneVisits: number;
  plannedVisits: number;
  plannedAch: number;     // 0-1
  avgCallRate: number;
  avgList: number;
  visitedHCP: number;
  coreListHCP: number;
  coverageAch: number;    // 0-1
  qTargetCalls: number;
  targetCallAch: number;  // 0-1
  doneAVisits: number;
  aVisitsCont: number;    // 0-1
  dvDays: number;
  dvDaysPerMR: number;
  dvRatio: number;        // 0-1
  dvVisits: number;
  avgDVCallRate: number;
  salesPts: number;
  targetPts: number;
  salesAch: number;       // 0-1
};

// Example/sample KPI data — replace with your real data when uploading.
// New months can be appended here. Keys appear in the filter dropdown in order.
export const KPI_DATASETS: Record<string, KPIMetrics[]> = {
  // "January 2025": [ ... ]
};

// --- Uploaded KPI months (persisted in Supabase) -------------------------
// Now persisted in Supabase. We keep an in-memory cache so the existing
// synchronous consumers (KPI section, performance analysis) keep working.
// Call `hydrateKPIFromSupabase()` once at app start to populate the cache.
import { supabase } from "@/integrations/supabase/client";

const REMOVED_BUILTIN_KEY = "synaps-kpi-removed-builtins";

// In-memory cache, hydrated from Supabase.
let UPLOADED_CACHE: Record<string, KPIMetrics[]> = {};

export function readUploadedKPI(): Record<string, KPIMetrics[]> {
  return UPLOADED_CACHE;
}

function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("synaps-kpi-uploads-change"));
  }
}

/** Fetch every uploaded month from Supabase and refresh the in-memory cache. */
export async function hydrateKPIFromSupabase(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("kpi_months")
      .select("month_label, rows");
    if (error) {
      console.warn("hydrateKPIFromSupabase:", error.message);
      return;
    }
    const next: Record<string, KPIMetrics[]> = {};
    for (const row of data ?? []) {
      const r = row as { month_label: string; rows: unknown };
      if (Array.isArray(r.rows)) next[r.month_label] = r.rows as KPIMetrics[];
    }
    UPLOADED_CACHE = next;
    emitChange();
  } catch (err) {
    console.warn("hydrateKPIFromSupabase failed:", err);
  }
}

/** Save (upsert) a month to Supabase and refresh cache. */
export async function saveUploadedKPI(month: string, rows: KPIMetrics[]): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("You must be signed in to upload KPI data.");

  // Strict validation: month label + at least one valid row required.
  if (!month || !month.trim()) throw new Error("Please specify a month name before saving.");
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("File rejected: No valid KPI rows found.");
  }
  // Dedupe within the same upload by (dm + mr) — last occurrence wins.
  const deduped = new Map<string, KPIMetrics>();
  for (const r of rows) {
    const key = `${(r.dm ?? "").trim().toLowerCase()}::${(r.mr ?? "").trim().toLowerCase()}`;
    if (!key.trim().replace("::", "")) continue;
    deduped.set(key, r);
  }
  const cleanRows = [...deduped.values()];

  const { error } = await supabase
    .from("kpi_months")
    .upsert(
      { month_label: month, rows: cleanRows as unknown as never, uploaded_by: uid },
      { onConflict: "month_label" },
    );
  if (error) throw new Error(error.message);
  UPLOADED_CACHE = { ...UPLOADED_CACHE, [month]: cleanRows };
  emitChange();
}

/** Remove a month: deletes from Supabase if present, also marks built-ins as removed locally. */
export async function deleteUploadedKPI(month: string): Promise<void> {
  if (month in UPLOADED_CACHE) {
    const { error } = await supabase.from("kpi_months").delete().eq("month_label", month);
    if (error) throw new Error(error.message);
    const next = { ...UPLOADED_CACHE };
    delete next[month];
    UPLOADED_CACHE = next;
  }
  if (month in KPI_DATASETS && typeof window !== "undefined") {
    const removed = readRemovedBuiltins();
    if (!removed.includes(month)) {
      removed.push(month);
      window.localStorage.setItem(REMOVED_BUILTIN_KEY, JSON.stringify(removed));
    }
  }
  emitChange();
}

export function readRemovedBuiltins(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REMOVED_BUILTIN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function allDatasets(): Record<string, KPIMetrics[]> {
  const removed = new Set(readRemovedBuiltins());
  const builtins: Record<string, KPIMetrics[]> = {};
  for (const [k, v] of Object.entries(KPI_DATASETS)) {
    if (!removed.has(k)) builtins[k] = v;
  }
  return { ...builtins, ...readUploadedKPI() };
}

const MONTH_INDEX: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
function monthSortKey(label: string): number {
  const parts = label.toLowerCase().trim().split(/\s+/);
  let year = 0, m = 0;
  for (const p of parts) {
    const n = Number(p);
    if (Number.isFinite(n) && n > 1900) year = n;
    else if (p in MONTH_INDEX) m = MONTH_INDEX[p];
  }
  return year * 12 + m;
}
function sortMonths(months: string[]): string[] {
  return [...months].sort((a, b) => monthSortKey(a) - monthSortKey(b));
}

export function getKPIMonths(): string[] {
  return sortMonths(Object.keys(allDatasets()));
}

// Back-compat (static fallback).
export const KPI_MONTHS = Object.keys(KPI_DATASETS);

// All currently-available months (built-in not removed + uploaded).
export function getAllAvailableKPIMonths(): string[] {
  return sortMonths(Object.keys(allDatasets()));
}

// Loose name match: strip non-alphanumeric, lowercase, ignore order.
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[\u0600-\u06FF()\u060C,.\-_/\\]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
function nameScore(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  const minSize = Math.min(ta.size, tb.size);
  // Require at least 2 unique shared tokens (or all of them if name is shorter).
  if (hits < Math.min(2, minSize)) return 0;
  return hits / minSize; // 0..1 — higher = better
}

export function getKPIForRep(month: string, repName: string): KPIMetrics | undefined {
  const rows = allDatasets()[month] ?? [];
  let best: KPIMetrics | undefined;
  let bestScore = 0;
  for (const r of rows) {
    const s = nameScore(r.mr, repName);
    if (s > bestScore) { bestScore = s; best = r; }
  }
  return best;
}

export function getKPIRowsForDM(month: string, dmName: string): KPIMetrics[] {
  const rows = allDatasets()[month] ?? [];
  return rows.filter((r) => nameScore(r.dm, dmName) > 0);
}

function sum(arr: number[]) { return arr.reduce((a, b) => a + b, 0); }

export function aggregateKPI(rows: KPIMetrics[]): KPIMetrics | null {
  if (rows.length === 0) return null;
  const planned = sum(rows.map(r => r.plannedVisits));
  const done = sum(rows.map(r => r.doneVisits));
  const core = sum(rows.map(r => r.coreListHCP));
  const visited = sum(rows.map(r => r.visitedHCP));
  const qCalls = sum(rows.map(r => r.qTargetCalls));
  const pmDays = sum(rows.map(r => r.pmWorkingDays));
  const dvDays = sum(rows.map(r => r.dvDays));
  const sales = sum(rows.map(r => r.salesPts));
  const target = sum(rows.map(r => r.targetPts));
  const activeMR = sum(rows.map(r => r.activeMR));
  const aVisits = sum(rows.map(r => r.doneAVisits));
  return {
    dm: rows[0].dm,
    mr: "Total",
    areas: sum(rows.map(r => r.areas)),
    activeMR,
    pmWorkingDays: pmDays,
    avgPMWorkingDays: activeMR ? pmDays / activeMR : 0,
    doneVisits: done,
    plannedVisits: planned,
    plannedAch: planned ? done / planned : 0,
    avgCallRate: pmDays ? done / pmDays : 0,
    avgList: activeMR ? core / activeMR : 0,
    visitedHCP: visited,
    coreListHCP: core,
    coverageAch: core ? visited / core : 0,
    qTargetCalls: qCalls,
    targetCallAch: qCalls ? done / qCalls : 0,
    doneAVisits: aVisits,
    aVisitsCont: done ? aVisits / done : 0,
    dvDays,
    dvDaysPerMR: activeMR ? dvDays / activeMR : 0,
    dvRatio: pmDays ? dvDays / pmDays : 0,
    dvVisits: sum(rows.map(r => r.dvVisits)),
    avgDVCallRate: 0,
    salesPts: sales,
    targetPts: target,
    salesAch: target ? sales / target : 0,
  };
}
