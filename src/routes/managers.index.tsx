import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dms, getRepsByDM, fmtEGP, findDMByLooseName, findRepByLooseName } from "@/lib/mock-data";
import { getActiveTeam } from "@/lib/management.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useRepFilter } from "@/lib/rep-filter";
import { normalizeName } from "@/lib/name-match";

export const Route = createFileRoute("/managers/")({
  component: ManagersPage,
  head: () => ({
    meta: [
      { title: "District Managers — SYNAPS" },
      { name: "description", content: "District Managers (DMs) performance" },
    ],
  }),
});

function ManagersPage() {
  const fetchTeam = useServerFn(getActiveTeam);
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { scope, allowedManagerNames } = useRepFilter();
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
      .channel("rep_assignments_mgrs_idx")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rep_assignments" },
        () => qc.invalidateQueries({ queryKey: ["active-team"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const activeManagers = team?.activeManagers ?? [];
  type ActiveMgr = (typeof activeManagers)[number];
  const { filteredDms, extras } = useMemo(() => {
    if (!team) return { filteredDms: dms, extras: [] as ActiveMgr[] };
    const matched = new Map<string, (typeof dms)[number]>();
    const unmatched: ActiveMgr[] = [];
    for (const am of team.activeManagers) {
      const legacy = findDMByLooseName(am.name);
      // Override the displayed name with the DB name for accurate scope matching.
      if (legacy) matched.set(legacy.id, { ...legacy, name: am.name });
      else unmatched.push(am);
    }
    return { filteredDms: Array.from(matched.values()), extras: unmatched };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team]);
  // Build a map from manager DB name (normalized) → reps assigned to that manager,
  // either via manager_id OR (for VACANT / unowned reps) via shared area.
  const repsByManagerKey = useMemo(() => {
    const map = new Map<string, ActiveMgr[]>();
    if (!team) return map;
    const mgrIdToKey = new Map<string, string>();
    const areaToMgrKey = new Map<string, string>();
    for (const m of team.activeManagers) {
      const key = normalizeName(m.name);
      mgrIdToKey.set(m.rep_id, key);
      for (const a of m.areas) areaToMgrKey.set(a.id, key);
    }
    for (const r of team.activeReps) {
      const keys = new Set<string>();
      if (r.manager_id) {
        const k = mgrIdToKey.get(r.manager_id);
        if (k) keys.add(k);
      } else {
        for (const a of r.areas) {
          const k = areaToMgrKey.get(a.id);
          if (k) keys.add(k);
        }
      }
      for (const k of keys) {
        const arr = map.get(k) ?? [];
        arr.push(r);
        map.set(k, arr);
      }
    }
    return map;
  }, [team]);
  const scoped =
    scope === "admin"
      ? filteredDms
      : filteredDms.filter((d) => allowedManagerNames.has(d.name.toLowerCase()));
  const sorted = [...scoped].sort((a, b) => b.ratio - a.ratio);
  const scopedExtras =
    scope === "admin"
      ? extras
      : extras.filter((m) => allowedManagerNames.has(m.name.toLowerCase()));
  return (
    <>
      <header className="h-16 border-b border-border flex items-center gap-3 px-8 bg-card/50 bg-white">
        <h1 className="text-lg font-semibold">District Managers Performance</h1>
        {team && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30">
            {team.activeManagers.length} active
          </span>
        )}
      </header>
      <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sorted.map((d, i) => {
          const dbTeam = repsByManagerKey.get(normalizeName(d.name)) ?? [];
          const legacyTeam = getRepsByDM(d.name);
          const teamCount = dbTeam.length || legacyTeam.length;
          // Compute team average from legacy perf data where available, matched by rep name.
          const ratios = dbTeam.length
            ? dbTeam
                .map((ar) => findRepByLooseName(ar.name)?.ratio)
                .filter((x): x is number => typeof x === "number")
            : legacyTeam.map((r) => r.ratio);
          const teamAvg = ratios.length
            ? ratios.reduce((s, r) => s + r, 0) / ratios.length
            : 0;
          const repNames = (dbTeam.length ? dbTeam : legacyTeam).map((r) => r.name);
          return (
            <Link
              key={d.id}
              to="/managers/$id"
              params={{ id: d.id }}
              className="bg-card p-6 ring-1 ring-black/5 rounded-lg hover:ring-brand/50 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-11 bg-brand/15 text-brand-foreground rounded-full grid place-items-center text-sm font-semibold shrink-0 ring-1 ring-brand/30">
                    {d.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold truncate">{d.name}</p>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30 shrink-0">Active</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{d.area}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{(i + 1).toString().padStart(2, "0")}</span>
              </div>
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-xs text-muted-foreground">Target achievement</span>
                <span className={`text-xl font-semibold font-mono ${d.ratio >= 100 ? "text-emerald-600" : d.ratio >= 90 ? "text-brand" : "text-amber-600"}`}>
                  {d.ratio.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mb-5">
                <div
                  className={`h-full ${d.ratio >= 100 ? "bg-emerald-500" : d.ratio >= 90 ? "bg-brand" : "bg-amber-500"}`}
                  style={{ width: `${Math.min(d.ratio, 130)}%` }}
                />
              </div>
              <dl className="grid grid-cols-2 gap-4 text-xs">
                <div><dt className="text-muted-foreground mb-1">Sales</dt><dd className="font-medium font-mono">EGP {fmtEGP(d.sales)}</dd></div>
                <div><dt className="text-muted-foreground mb-1">Target</dt><dd className="font-medium font-mono">EGP {fmtEGP(d.target)}</dd></div>
                <div><dt className="text-muted-foreground mb-1">Reps</dt><dd className="font-medium font-mono">{teamCount}</dd></div>
                <div><dt className="text-muted-foreground mb-1">Team avg</dt><dd className="font-medium font-mono">{teamAvg ? teamAvg.toFixed(1) : 0}%</dd></div>
              </dl>
              {repNames.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/60">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Reps</p>
                  <p className="text-[11px] text-foreground/80 leading-relaxed">
                    {repNames.join(" • ")}
                  </p>
                </div>
              )}
            </Link>
          );
        })}
        {scopedExtras.map((m) => (
          <div
            key={m.rep_id}
            className="bg-card p-6 ring-1 ring-black/5 rounded-lg"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="size-11 bg-brand/15 text-brand-foreground rounded-full grid place-items-center text-sm font-semibold ring-1 ring-brand/30">
                {m.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold truncate">{m.name}</p>
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30">Active</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {m.areas.map((a) => a.name).join(", ") || "—"}
                </p>
              </div>
            </div>
            {(() => {
              const dbTeam = repsByManagerKey.get(normalizeName(m.name)) ?? [];
              return (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    {dbTeam.length} rep{dbTeam.length === 1 ? "" : "s"} assigned — no performance data uploaded yet.
                  </p>
                  {dbTeam.length > 0 && (
                    <p className="text-[11px] text-foreground/80 leading-relaxed">
                      {dbTeam.map((r) => r.name).join(" • ")}
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        ))}
        {team && sorted.length === 0 && extras.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full">
            No active managers. Assign areas from Admin → Team & Transfers.
          </p>
        )}
      </div>
    </>
  );
}
