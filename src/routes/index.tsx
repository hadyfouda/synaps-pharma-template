import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  reps as allReps, products, kpis as baseKpis, monthly, quarters, dms as allDms,
  fmtEGP, fmtEGPshort, fmtMonth, fmtMonthShort, lineInfo, productSlug,
  dmMonthly, productMonthly, getRepsByDM, getProductsForRep, getMonthlyForRep,
  fmtUnits, findRepByLooseName, findDMByLooseName,
} from "@/lib/mock-data";
import { RepFilter, useRepFilter, filterByAreas } from "@/lib/rep-filter";
import { getActiveTeam } from "@/lib/management.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

// Module-level aliases for drill-builders (kept unfiltered).
const reps = allReps;
const dms = allDms;
const kpis = baseKpis;

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Dashboard — SYNAPS" },
      { name: "description", content: `Sales line performance — ${lineInfo.manager}` },
    ],
  }),
});

function Index() {
  const { areaNames, isFilterActive, selectedRep } = useRepFilter();

  // Period filter: Quarter / Semester / Year
  type PeriodMode = "quarter" | "semester" | "year";
  const [periodMode, setPeriodMode] = useState<PeriodMode>("year");
  const [periodValue, setPeriodValue] = useState<string>("all");

  // Live team from DB (active reps/managers) — keeps dashboard counts and
  // cards in sync with the Managers & Reps tabs.
  const fetchTeam = useServerFn(getActiveTeam);
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { data: team } = useQuery({
    queryKey: ["active-team"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return null;
      return fetchTeam();
    },
    refetchOnWindowFocus: true,
    enabled: isAuthenticated,
    retry: false,
  });
  useEffect(() => {
    const ch = supabase
      .channel("rep_assignments_dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rep_assignments" },
        () => qc.invalidateQueries({ queryKey: ["active-team"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Restrict legacy reps/dms to those whose names match an active DB record.
  const teamFilteredReps = useMemo(() => {
    if (!team) return allReps;
    const matched = new Map<string, { name: string; area?: string }>();
    const extras: typeof allReps = [];
    for (const m of team.activeReps) {
      const legacy = findRepByLooseName(m.name);
      if (legacy) matched.set(legacy.id, { name: m.name, area: m.areas?.[0]?.name });
      else {
        const initials = m.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";
        const areaLabel = m.areas?.[0]?.name ?? "—";
        extras.push({
          id: `rep-extra-${m.rep_id}`,
          name: m.name,
          initials,
          dm: "—",
          area: areaLabel,
          sales: 0,
          target: 0,
          ratio: 0,
          achievement: 0,
          salesPts: 0,
          targetPts: 0,
          pointsRatio: 0,
          coverage: 0,
          callRate: 0,
          doubleVisits: 0,
          tierCoverage: { A: 0, B: 0, C: 0 },
          skills: { product: 0, selling: 0, planning: 0 },
          aspiration: "Senior Rep",
        });
      }
    }
    const base = matched.size
      ? allReps
          .filter((r) => matched.has(r.id))
          .map((r) => {
            const ov = matched.get(r.id)!;
            const initials = ov.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || r.initials;
            return { ...r, name: ov.name, initials, area: ov.area ?? r.area };
          })
      : allReps;
    return [...base, ...extras];
  }, [team]);
  const teamFilteredDms = useMemo(() => {
    if (!team) return allDms;
    const matched = new Map<string, { name: string; area?: string }>();
    const extras: typeof allDms = [];
    for (const m of team.activeManagers) {
      const legacy = findDMByLooseName(m.name);
      if (legacy) matched.set(legacy.id, { name: m.name, area: m.areas?.[0]?.name });
      else {
        // Active manager with no legacy sales record — show a placeholder card
        // so the dashboard reflects the real team count.
        const initials = m.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";
        const areaLabel = m.areas?.[0]?.name ?? "—";
        extras.push({
          id: `dm-extra-${m.rep_id}`,
          name: m.name,
          area: areaLabel,
          sales: 0,
          target: 0,
          ratio: 0,
          initials,
        });
      }
    }
    const base = matched.size
      ? allDms
          .filter((d) => matched.has(d.id))
          .map((d) => {
            const ov = matched.get(d.id)!;
            const initials = ov.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || d.initials;
            return { ...d, name: ov.name, initials, area: ov.area ?? d.area };
          })
      : allDms;
    return [...base, ...extras];
  }, [team]);

  const reps = useMemo(() => filterByAreas(teamFilteredReps, areaNames), [teamFilteredReps, areaNames]);
  const dms = useMemo(() => filterByAreas(teamFilteredDms, areaNames), [teamFilteredDms, areaNames]);

  // Recompute KPIs from filtered reps when a filter is active
  const kpis = useMemo(() => {
    // Always recompute when team data is loaded so counts reflect DB.
    const totalSales = reps.reduce((s, r) => s + r.sales, 0);
    const totalTarget = reps.reduce((s, r) => s + r.target, 0);
    return {
      ...baseKpis,
      ...(isFilterActive
        ? { totalSales, achievement: totalTarget ? (totalSales / totalTarget) * 100 : 0 }
        : {}),
      mrCount: reps.length,
      dmCount: dms.length,
    };
  }, [isFilterActive, reps, dms]);

  // Scale monthly figures by reps' share of total when filter is active (mock approximation)
  const repShare = useMemo(() => {
    if (!isFilterActive) return 1;
    const totalAll = allReps.reduce((s, r) => s + r.sales, 0);
    return totalAll ? reps.reduce((s, r) => s + r.sales, 0) / totalAll : 0;
  }, [isFilterActive, reps]);
  const scaledMonthly = useMemo(
    () => (isFilterActive ? monthly.map((m) => ({ ...m, sales: m.sales * repShare, target: m.target * repShare })) : monthly),
    [isFilterActive, repShare],
  );
  const scaledQuarters = useMemo(
    () => (isFilterActive
      ? quarters.map((q) => ({ ...q, sales: q.sales * repShare, target: q.target * repShare, ratio: q.target ? (q.sales / q.target) * 100 : 0 }))
      : quarters),
    [isFilterActive, repShare],
  );

  // Available years & selected year filter
  const years = useMemo(() => Array.from(new Set(monthly.map((m) => m.month.slice(0, 4)))).sort(), []);
  const [selectedYear, setSelectedYear] = useState<string>(years[years.length - 1] ?? "2025");
  const currentYear = selectedYear;

  const { yearMonths, h1, h2, h1Sales, h1Target, h2Sales, h2Target, yearSales, yearTarget } = useMemo(() => {
    const ym = scaledMonthly.filter((m) => m.month.startsWith(selectedYear));
    const h1m = ym.filter((m) => parseInt(m.month.slice(5, 7), 10) <= 6);
    const h2m = ym.filter((m) => parseInt(m.month.slice(5, 7), 10) > 6);
    const s = (arr: typeof ym, k: "sales" | "target") => arr.reduce((acc, m) => acc + m[k], 0);
    return {
      yearMonths: ym,
      h1: h1m,
      h2: h2m,
      h1Sales: s(h1m, "sales"),
      h1Target: s(h1m, "target"),
      h2Sales: s(h2m, "sales"),
      h2Target: s(h2m, "target"),
      yearSales: s(ym, "sales"),
      yearTarget: s(ym, "target"),
    };
  }, [scaledMonthly, selectedYear]);

  const sum = (arr: { sales: number; target: number }[], k: "sales" | "target") => arr.reduce((s, m) => s + m[k], 0);
  const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

  // Resolve period filter to a months subset of the current year.
  const periodMonths = useMemo(() => {
    if (periodMode === "year") return yearMonths;
    if (periodMode === "semester") {
      if (periodValue === "H1") return h1;
      if (periodValue === "H2") return h2;
      return yearMonths;
    }
    // quarter
    const q = parseInt(periodValue.replace("Q", ""), 10);
    if (!q) return yearMonths;
    return yearMonths.filter((m) => {
      const mo = parseInt(m.month.slice(5, 7), 10);
      return Math.ceil(mo / 3) === q;
    });
  }, [periodMode, periodValue, yearMonths, h1, h2]);

  const periodActive = !(periodMode === "year" && (periodValue === "all" || periodValue === ""));
  const periodLabel = periodMode === "year"
    ? `Full Year ${currentYear}`
    : periodMode === "semester"
      ? `${periodValue === "H1" ? "H1 (Jan — Jun)" : periodValue === "H2" ? "H2 (Jul — Dec)" : `Year ${currentYear}`}`
      : `${periodValue} ${currentYear}`;

  // Override KPIs with period totals when a non-default period is selected.
  const periodSales = sum(periodMonths, "sales");
  const periodTarget = sum(periodMonths, "target");
  const effectiveKpis = useMemo(() => {
    if (!periodActive) return kpis;
    return {
      ...kpis,
      totalSales: periodSales,
      totalTarget: periodTarget,
      achievement: periodTarget ? (periodSales / periodTarget) * 100 : 0,
    };
  }, [kpis, periodActive, periodSales, periodTarget]);

  const yearQuarters = useMemo(() => {
    const qNames = ["Q1", "Q2", "Q3", "Q4"];
    return qNames.map((qName, idx) => {
      const qMonths = yearMonths.filter((m) => Math.ceil(parseInt(m.month.slice(5, 7), 10) / 3) === idx + 1);
      const qSales = qMonths.reduce((s, m) => s + m.sales, 0);
      const qTarget = qMonths.reduce((s, m) => s + m.target, 0);
      return { name: qName, sales: qSales, target: qTarget, ratio: qTarget ? (qSales / qTarget) * 100 : 0 };
    });
  }, [yearMonths]);

  const chartMonths = periodActive ? periodMonths : yearMonths;
  const maxMonthly = Math.max(1, ...chartMonths.map((m) => m.sales));
  const topReps = [...reps].sort((a, b) => b.ratio - a.ratio).slice(0, 5);
  const [drill, setDrill] = useState<DrillContent | null>(null);

  return (
    <>
      <header className="p-4 flex flex-col gap-1 bg-white">
        <div>
          <h1 className="text-lg font-semibold uppercase tracking-tight text-primary">Sales Line</h1>
          <p className="text-[11px] text-muted-foreground">
            Year {selectedYear} · {yearMonths.length} months · {kpis.dmCount} district managers · {kpis.mrCount} reps
            {isFilterActive && selectedRep && <> · <span className="text-brand font-medium">Filtered: {selectedRep.name}</span></>}
            {periodActive && <> · <span className="text-brand font-medium">Period: {periodLabel}</span></>}
          </p>
        </div>
      </header>

      <div className="p-8 flex flex-col gap-8">
        {/* Period filter */}
        <section className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Year</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-1 text-xs rounded-md bg-background ring-1 ring-black/10 hover:ring-brand transition cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Period</span>
          <div className="inline-flex bg-muted/60 rounded-md p-0.5 ring-1 ring-black/5">
            {([
              { k: "quarter", label: "Quarter" },
              { k: "semester", label: "Semester" },
              { k: "year", label: "Total Year" },
            ] as { k: PeriodMode; label: string }[]).map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => {
                  setPeriodMode(opt.k);
                  setPeriodValue(opt.k === "quarter" ? "Q1" : opt.k === "semester" ? "H1" : "all");
                }}
                className={`px-3 py-1 text-xs rounded-[5px] transition ${
                  periodMode === opt.k ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {periodMode === "quarter" && (
            <div className="inline-flex gap-1">
              {["Q1", "Q2", "Q3", "Q4"].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setPeriodValue(q)}
                  className={`px-2.5 py-1 text-xs rounded-md ring-1 transition ${
                    periodValue === q ? "bg-brand text-white ring-brand" : "bg-background ring-black/10 hover:ring-brand"
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {periodMode === "semester" && (
            <div className="inline-flex gap-1">
              {[{ k: "H1", label: "H1 (Jan — Jun)" }, { k: "H2", label: "H2 (Jul — Dec)" }].map((s) => (
                <button
                  key={s.k}
                  type="button"
                  onClick={() => setPeriodValue(s.k)}
                  className={`px-2.5 py-1 text-xs rounded-md ring-1 transition ${
                    periodValue === s.k ? "bg-brand text-white ring-brand" : "bg-background ring-black/10 hover:ring-brand"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <span className="text-[11px] text-muted-foreground ml-auto">{selectedYear} · {periodMonths.length} months</span>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard
            label="Target Achievement"
            value={`${effectiveKpis.achievement.toFixed(1)}%`}
            sub={`${fmtEGP(effectiveKpis.totalSales)} EGP of ${fmtEGP(effectiveKpis.totalTarget)}`}
            onClick={() => setDrill(buildAchievementDrill())}
          />
          <KpiCard
            label="Total Sales (EGP)"
            value={fmtEGP(effectiveKpis.totalSales)}
            sub={`Target ${fmtEGP(effectiveKpis.totalTarget)} EGP`}
            onClick={() => setDrill(buildSalesDrill())}
          />
          <KpiCard
            label="YoY Growth"
            value={`${kpis.yoyGrowth > 0 ? "+" : ""}${kpis.yoyGrowth.toFixed(1)}%`}
            sub="Year over year"
            delta={kpis.yoyGrowth > 0 ? "+" : ""}
            onClick={() => setDrill(buildYoYDrill())}
          />
          <KpiCard label="Team" value={`${kpis.mrCount}`} sub={`${kpis.dmCount} areas · ${kpis.productCount} products`} onClick={() => setDrill(buildTeamDrill())} />
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-semibold">Semester & Yearly Sales</h3>
            <span className="text-[11px] text-muted-foreground">
              Year {selectedYear}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SemesterCard
              label="H1 (Jan — Jun)"
              sales={h1Sales}
              target={h1Target}
              ratio={pct(h1Sales, h1Target)}
              months={h1.length}
            />
            <SemesterCard
              label="H2 (Jul — Dec)"
              sales={h2Sales}
              target={h2Target}
              ratio={pct(h2Sales, h2Target)}
              months={h2.length}
            />
            <SemesterCard
              label={`Full Year ${currentYear}`}
              sales={yearSales}
              target={yearTarget}
              ratio={pct(yearSales, yearTarget)}
              months={yearMonths.length}
              highlight
            />
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <section className="lg:col-span-8 space-y-6">
            {/* Quarter comparison */}
            <div>
              <h3 className="text-sm font-semibold mb-3">
                Quarter Comparison
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {yearQuarters.map((q) => (
                  <div key={q.name} className="bg-card p-5 ring-1 ring-black/5 rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{q.name}</p>
                    <p className="text-xl font-semibold font-mono">{fmtEGPshort(q.sales)}</p>
                    <p className="text-[11px] mt-1 font-mono" style={{ color: q.ratio >= 100 ? "var(--emerald-600, #059669)" : "var(--muted-foreground)" }}>Achievement {q.ratio.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Sales trend */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Sales Growth Trend</h3>
                <span className="text-[11px] text-muted-foreground">{selectedYear}</span>
              </div>
              <div className="bg-card p-6 ring-1 ring-black/5 rounded-lg">
                <TrendChart data={yearMonths.map(m => ({ month: m.month, sales: m.sales, target: m.target }))} />
              </div>
            </div>

            {/* Monthly bars by total sales */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Monthly Sales — Sales vs Target {periodActive && <span className="text-[11px] text-muted-foreground font-normal">({periodLabel})</span>}</h3>
                <div className="flex gap-4 text-[11px]">
                  <Legend color="bg-brand" label="Sales" />
                  <Legend color="bg-accent-2" label="Target" />
                </div>
              </div>
              <div className="bg-card p-6 ring-1 ring-black/5 rounded-lg h-[320px] flex items-end gap-3 justify-between">
                {chartMonths.map((m) => {
                  const maxV = Math.max(m.sales, m.target, maxMonthly);
                  const sH = (m.sales / maxV) * 100;
                  const tH = (m.target / maxV) * 100;
                  return (
                    <button
                      key={m.month}
                      type="button"
                      onClick={() => setDrill(buildMonthDrill(m.month))}
                      className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer"
                    >
                      <div className="w-full flex gap-0.5 items-end" style={{ height: "85%" }}>
                        <div className="flex-1 bg-brand rounded-t-sm transition group-hover:opacity-80" style={{ height: `${sH}%` }} title={`Sales ${fmtEGP(m.sales)} EGP`} />
                        <div className="flex-1 bg-accent-2/70 rounded-t-sm transition group-hover:opacity-80" style={{ height: `${tH}%` }} title={`Target ${fmtEGP(m.target)} EGP`} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium group-hover:text-foreground transition">{fmtMonthShort(m.month)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product performance */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Product Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {products.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setDrill(buildProductDrill(p.name))}
                    className="bg-card p-5 ring-1 ring-black/5 rounded-lg hover:ring-brand/50 hover:shadow-md transition block text-left"
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <h4 className="font-semibold">{p.name}</h4>
                    </div>
                    <p className="text-xl font-semibold tracking-tight mb-1">
                      {fmtEGP(p.sales)}<span className="text-xs text-muted-foreground font-normal ml-1">EGP</span>
                    </p>
                    <p className={`text-xs font-medium mb-3 ${p.ratio >= 100 ? "text-emerald-600" : p.ratio >= 80 ? "text-brand" : "text-amber-600"}`}>
                      {p.ratio.toFixed(1)}% of target achieved
                    </p>
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${p.ratio >= 100 ? "bg-emerald-500" : p.ratio >= 80 ? "bg-brand" : "bg-amber-500"}`} style={{ width: `${Math.min(p.ratio, 130)}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2 font-mono">{fmtEGP(p.units)} units of {fmtEGP(p.targetUnits)}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* DM split */}
            <div>
              <h3 className="text-sm font-semibold mb-3">District Managers Performance ({kpis.dmCount} areas)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dms.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDrill(buildDmDrill(d.name))}
                    className="bg-card p-5 ring-1 ring-black/5 rounded-lg hover:ring-brand/50 hover:shadow-md transition text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{d.name}</p>
                        <p className="text-[11px] text-muted-foreground">{d.area}</p>
                      </div>
                      <span className={`text-xs font-mono font-semibold ${d.ratio >= 100 ? "text-emerald-600" : d.ratio >= 90 ? "text-brand" : "text-amber-600"}`}>{d.ratio.toFixed(1)}%</span>
                    </div>
                     <p className="text-lg font-semibold tracking-tight font-mono">{fmtEGP(d.sales)} <span className="text-[10px] text-muted-foreground font-normal">EGP</span></p>
                    <div className="mt-3 w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${d.ratio >= 100 ? "bg-emerald-500" : d.ratio >= 90 ? "bg-brand" : "bg-amber-500"}`} style={{ width: `${Math.min(d.ratio, 130)}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className="lg:col-span-4 space-y-8">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Top Reps</h3>
                <Link to="/reps" className="text-xs text-brand font-medium flex items-center gap-1">
                  All <ArrowUpRight className="size-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {topReps.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setDrill(buildRepDrill(r.name))}
                    className="w-full flex items-center justify-between p-3 bg-card ring-1 ring-black/5 rounded-lg hover:ring-brand/50 hover:shadow-md transition text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 bg-secondary rounded-full grid place-items-center text-xs font-semibold shrink-0">{r.initials}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{r.area}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold font-mono shrink-0 ${r.ratio >= 100 ? "text-emerald-600" : r.ratio >= 90 ? "text-brand" : "text-amber-600"}`}>{r.ratio.toFixed(1)}%</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
      <DrillModal drill={drill} onClose={() => setDrill(null)} />
    </>
  );
}

function KpiCard({ label, value, sub, delta, onClick }: { label: string; value: string; sub?: string; delta?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card p-5 ring-1 ring-black/5 rounded-lg text-left hover:ring-brand/50 hover:shadow-md transition"
    >
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight font-mono">{value}</span>
        {delta && <span className="text-xs font-medium text-emerald-600">{delta}</span>}
      </div>
      {sub && <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">{sub}</p>}
    </button>
  );
}

function SemesterCard({ label, sales, target, ratio, months, highlight }: { label: string; sales: number; target: number; ratio: number; months: number; highlight?: boolean }) {
  const color = ratio >= 100 ? "text-emerald-600" : ratio >= 90 ? "text-brand" : "text-amber-600";
  const bar = ratio >= 100 ? "bg-emerald-500" : ratio >= 90 ? "bg-brand" : "bg-amber-500";
  return (
    <div className={`p-5 ring-1 rounded-lg ${highlight ? "bg-brand/5 ring-brand/30" : "bg-card ring-black/5"}`}>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="text-[10px] text-muted-foreground font-mono">{months} months</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight font-mono">{fmtEGP(sales)} <span className="text-[10px] text-muted-foreground font-normal">EGP</span></p>
      <div className="flex items-baseline justify-between mt-1 mb-2">
        <span className="text-[11px] text-muted-foreground font-mono">of {fmtEGP(target)} EGP</span>
        <span className={`text-xs font-semibold font-mono ${color}`}>{ratio.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${Math.min(ratio, 130)}%` }} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <span className={`size-2 rounded-sm ${color}`} />
      <span>{label}</span>
    </div>
  );
}

function TrendChart({ data: trendData }: { data: { month: string; sales: number; target: number }[] }) {
  const data = trendData.map((m) => ({ label: fmtMonthShort(m.month), sales: m.sales, target: m.target }));
  const max = Math.max(...data.map((d) => Math.max(d.sales, d.target)));
  const min = 0;
  const W = 600, H = 200, pad = 28;
  const stepX = (W - pad * 2) / (data.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (H - pad * 2);
  const linePath = (key: "sales" | "target") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${y(d[key])}`).join(" ");
  const areaPath = `${linePath("sales")} L ${pad + (data.length - 1) * stepX} ${H - pad} L ${pad} ${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[220px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#trendFill)" />
      <path d={linePath("target")} stroke="var(--accent-2)" strokeWidth="1.5" strokeDasharray="4 4" fill="none" />
      <path d={linePath("sales")} stroke="var(--brand)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={pad + i * stepX} cy={y(d.sales)} r="3" fill="var(--card)" stroke="var(--brand)" strokeWidth="2" />
          <text x={pad + i * stepX} y={H - 8} textAnchor="middle" fontSize="9" className="fill-muted-foreground">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ---------- Drill-down modal ----------
type DrillRow = { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "bad" | "muted" };
type DrillSection = { title: string; rows: DrillRow[] };
type DrillContent = { title: string; subtitle?: string; headline?: { label: string; value: string; sub?: string }; sections: DrillSection[]; link?: { to: string; params?: Record<string, string>; label: string } };

function toneClass(t?: DrillRow["tone"]) {
  if (t === "ok") return "text-emerald-600";
  if (t === "warn") return "text-amber-600";
  if (t === "bad") return "text-red-600";
  return "text-foreground";
}
function ratioTone(r: number): DrillRow["tone"] {
  return r >= 100 ? "ok" : r >= 80 ? "warn" : "bad";
}

function buildAchievementDrill(): DrillContent {
  const gap = kpis.totalTarget - kpis.totalSales;
  const months = monthly.map((m) => ({ ...m, gap: m.target - m.sales }));
  const best = [...months].sort((a, b) => b.ratio - a.ratio).slice(0, 3);
  const worst = [...months].sort((a, b) => a.ratio - b.ratio).slice(0, 3);
  return {
    title: "Target Achievement",
    subtitle: "How sales compare to target across the line",
    headline: { label: `${kpis.achievement.toFixed(1)}%`, value: `${fmtEGP(kpis.totalSales)} of ${fmtEGP(kpis.totalTarget)} EGP`, sub: gap > 0 ? `Gap to target: ${fmtEGP(gap)} EGP` : `Above target by ${fmtEGP(-gap)} EGP` },
    sections: [
      { title: "Top performing months", rows: best.map((m) => ({ label: fmtMonth(m.month), value: `${m.ratio.toFixed(1)}%`, sub: `${fmtEGP(m.sales)} EGP`, tone: ratioTone(m.ratio) })) },
      { title: "Months below target", rows: worst.map((m) => ({ label: fmtMonth(m.month), value: `${m.ratio.toFixed(1)}%`, sub: `Gap ${fmtEGP(m.gap)} EGP`, tone: ratioTone(m.ratio) })) },
    ],
  };
}
function buildSalesDrill(): DrillContent {
  const byYear = new Map<string, number>();
  monthly.forEach((m) => byYear.set(m.month.slice(0, 4), (byYear.get(m.month.slice(0, 4)) ?? 0) + m.sales));
  const topProducts = [...products].sort((a, b) => b.sales - a.sales);
  return {
    title: "Total Sales",
    subtitle: `${lineInfo.months} months · ${fmtMonth(lineInfo.start)} → ${fmtMonth(lineInfo.end)}`,
    headline: { label: fmtEGP(kpis.totalSales), value: `EGP`, sub: `Average ${fmtEGP(kpis.totalSales / lineInfo.months)} EGP / month` },
    sections: [
      { title: "Sales by year", rows: Array.from(byYear.entries()).sort().map(([y, v]) => ({ label: y, value: fmtEGP(v), sub: `EGP` })) },
      { title: "Sales by product", rows: topProducts.map((p) => ({ label: p.name, value: fmtEGP(p.sales), sub: `${fmtUnits(p.units)} units · ${p.ratio.toFixed(1)}% of target`, tone: ratioTone(p.ratio) })) },
    ],
  };
}
function buildYoYDrill(): DrillContent {
  const y24 = monthly.filter((m) => m.month >= "2024-01" && m.month <= "2024-10");
  const y25 = monthly.filter((m) => m.month >= "2025-01" && m.month <= "2025-10");
  const s24 = y24.reduce((s, m) => s + m.sales, 0);
  const s25 = y25.reduce((s, m) => s + m.sales, 0);
  return {
    title: "Year-over-Year Growth",
    subtitle: "Jan–Oct 2025 vs Jan–Oct 2024",
    headline: { label: `${kpis.yoyGrowth > 0 ? "+" : ""}${kpis.yoyGrowth.toFixed(1)}%`, value: `${fmtEGP(s25 - s24)} EGP difference`, sub: `${y24.length || 0} comparable months` },
    sections: [
      { title: "Period totals", rows: [
        { label: "2024 (Jan–Oct)", value: fmtEGP(s24), sub: `EGP` },
        { label: "2025 (Jan–Oct)", value: fmtEGP(s25), sub: `EGP` },
      ]},
    ],
  };
}
function buildTeamDrill(): DrillContent {
  const above = reps.filter((r) => r.ratio >= 100).length;
  const below = reps.filter((r) => r.ratio < 80).length;
  return {
    title: "Team Overview",
    subtitle: `${kpis.dmCount} districts · ${kpis.mrCount} medical reps · ${kpis.productCount} products`,
    headline: { label: `${kpis.mrCount}`, value: "Medical reps", sub: `${above} above target · ${below} below 80%` },
    sections: [
      { title: "Districts (DM)", rows: dms.map((d) => ({ label: d.name, value: `${d.ratio.toFixed(1)}%`, sub: d.area, tone: ratioTone(d.ratio) })) },
    ],
    link: { to: "/reps", label: "View all reps" },
  };
}
function buildMonthDrill(month: string): DrillContent {
  const m = monthly.find((x) => x.month === month)!;
  const dmRows = dmMonthly
    .filter((x) => x.month === month)
    .map((x) => ({ ...x, ratio: x.target ? (x.sales / x.target) * 100 : 0 }))
    .sort((a, b) => b.sales - a.sales);
  const prodRows = productMonthly
    .filter((x) => x.month === month)
    .map((x) => ({ ...x, ratio: x.target ? (x.sales / x.target) * 100 : 0 }))
    .sort((a, b) => b.sales - a.sales);
  return {
    title: fmtMonth(month),
    subtitle: "Monthly breakdown",
    headline: { label: `${m.ratio.toFixed(1)}%`, value: `${fmtEGP(m.sales)} of ${fmtEGP(m.target)} EGP` },
    sections: [
      { title: "By district", rows: dmRows.map((d) => ({ label: d.dm, value: fmtEGP(d.sales), sub: `${d.ratio.toFixed(1)}% of target`, tone: ratioTone(d.ratio) })) },
      { title: "By product", rows: prodRows.map((p) => {
        const prod = products.find((x) => x.name === p.product);
        const ppu = prod && prod.units > 0 ? prod.sales / prod.units : 0;
        const u = ppu > 0 ? Math.round(p.sales / ppu) : 0;
        return { label: p.product, value: fmtEGP(p.sales), sub: `${u > 0 ? `${fmtUnits(u)} units · ` : ""}${p.ratio.toFixed(1)}% of target`, tone: ratioTone(p.ratio) };
      }) },
    ],
  };
}
function buildProductDrill(name: string): DrillContent {
  const p = products.find((x) => x.name === name)!;
  const last12prod = productMonthly.filter((x) => x.product === name).sort((a, b) => (a.month < b.month ? 1 : -1)).slice(0, 6);
  const ppu = p.units > 0 ? p.sales / p.units : 0;
  return {
    title: p.name,
    subtitle: "Product performance",
    headline: { label: `${p.ratio.toFixed(1)}%`, value: `${fmtEGP(p.sales)} of ${fmtEGP(p.target)} EGP · ${fmtUnits(p.units)} of ${fmtUnits(p.targetUnits)} units` },
    sections: [
      { title: "Last 6 months", rows: last12prod.map((m) => {
        const r = m.target ? (m.sales / m.target) * 100 : 0;
        const u = ppu > 0 ? Math.round(m.sales / ppu) : 0;
        return { label: fmtMonth(m.month), value: fmtEGP(m.sales), sub: `${fmtUnits(u)} units · ${r.toFixed(1)}% of target`, tone: ratioTone(r) };
      })},
    ],
    link: { to: "/products/$slug", params: { slug: productSlug(p.name) }, label: "Open product page" },
  };
}
function buildDmDrill(name: string): DrillContent {
  const d = dms.find((x) => x.name === name)!;
  const team = getRepsByDM(name).sort((a, b) => b.ratio - a.ratio);
  return {
    title: d.name,
    subtitle: d.area,
    headline: { label: `${d.ratio.toFixed(1)}%`, value: `${fmtEGP(d.sales)} of ${fmtEGP(d.target)} EGP`, sub: `${team.length} reps in this district` },
    sections: [
      { title: "Reps in this district", rows: team.map((r) => ({ label: r.name, value: `${r.ratio.toFixed(1)}%`, sub: `${fmtEGP(r.sales)} EGP`, tone: ratioTone(r.ratio) })) },
    ],
  };
}
function buildRepDrill(name: string): DrillContent {
  const r = reps.find((x) => x.name === name)!;
  const recent = getMonthlyForRep(name).slice(-6).reverse();
  const prods = getProductsForRep(name).sort((a, b) => b.sales - a.sales);
  return {
    title: r.name,
    subtitle: `${r.area} · DM ${r.dm}`,
    headline: { label: `${r.ratio.toFixed(1)}%`, value: `${fmtEGP(r.sales)} of ${fmtEGP(r.target)} EGP`, sub: `Points ${r.pointsRatio.toFixed(1)}%` },
    sections: [
      { title: "Recent months", rows: recent.map((m) => {
        const rat = m.target ? (m.sales / m.target) * 100 : 0;
        return { label: fmtMonth(m.month), value: fmtEGP(m.sales), sub: `${rat.toFixed(1)}%`, tone: ratioTone(rat) };
      })},
      { title: "By product", rows: prods.map((p) => {
        const rat = p.target ? (p.sales / p.target) * 100 : 0;
        const prod = products.find((x) => x.name === p.product);
        const ppu = prod && prod.units > 0 ? prod.sales / prod.units : 0;
        const u = ppu > 0 ? Math.round(p.sales / ppu) : 0;
        return { label: p.product, value: fmtEGP(p.sales), sub: `${fmtUnits(u)} units · ${rat.toFixed(1)}%`, tone: ratioTone(rat) };
      })},
    ],
    link: { to: "/reps/$id", params: { id: r.id }, label: "Open rep profile" },
  };
}

function DrillModal({ drill, onClose }: { drill: DrillContent | null; onClose: () => void }) {
  if (!drill) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-xl ring-1 ring-black/10 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-semibold truncate">{drill.title}</h2>
            {drill.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{drill.subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 ml-3"><X className="size-4" /></button>
        </div>
        {drill.headline && (
          <div className="px-5 py-4 bg-secondary/40 border-b border-border">
            <p className="text-2xl font-semibold tracking-tight font-mono">{drill.headline.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{drill.headline.value}</p>
            {drill.headline.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{drill.headline.sub}</p>}
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {drill.sections.map((sec) => (
            <div key={sec.title}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">{sec.title}</p>
              <div className="space-y-2">
                {sec.rows.map((row, i) => (
                  <div key={i} className="flex items-baseline justify-between py-1.5 border-b border-border/40 last:border-0">
                    <div className="min-w-0 mr-4">
                      <p className="text-sm font-medium truncate">{row.label}</p>
                      {row.sub && <p className="text-[10px] text-muted-foreground">{row.sub}</p>}
                    </div>
                    <span className={`text-sm font-semibold font-mono shrink-0 ${toneClass(row.tone)}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {drill.link && (
          <div className="p-4 border-t border-border">
            <Link
              to={drill.link.to as never}
              params={drill.link.params as never}
              className="text-sm font-medium text-brand flex items-center gap-1 hover:underline"
            >
              {drill.link.label} <ArrowUpRight className="size-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
