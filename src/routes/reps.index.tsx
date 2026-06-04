import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { reps, fmtEGP, findRepByLooseName } from "@/lib/mock-data";
import { getActiveTeam } from "@/lib/management.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { normalizeName } from "@/lib/name-match";
import { useRepFilter } from "@/lib/rep-filter";

export const Route = createFileRoute("/reps/")({
  component: RepsPage,
  head: () => ({
    meta: [
      { title: "Medical Reps — SYNAPS" },
      { name: "description", content: "Track the medical reps team performance" },
    ],
  }),
});

function RepsPage() {
  const [filter, setFilter] = useState<string>("all");
  const fetchTeam = useServerFn(getActiveTeam);
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const { scope, allowedRepNames } = useRepFilter();
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

  // Live updates on assignment changes
  useEffect(() => {
    const ch = supabase
      .channel("rep_assignments_reps_idx")
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

  // Loosely link each active rep (DB) to a legacy rep card by name.
  const activeReps = team?.activeReps ?? [];
  type ActiveRep = (typeof activeReps)[number];
  const activeManagers = team?.activeManagers ?? [];
  const { filteredByActive, extras } = useMemo(() => {
    if (!team) return { filteredByActive: reps, extras: [] as ActiveRep[] };
    const matched = new Map<string, (typeof reps)[number]>();
    const unmatched: ActiveRep[] = [];
    for (const ar of team.activeReps) {
      const legacy = findRepByLooseName(ar.name);
      if (legacy) {
        // Override legacy name/area/manager with active data (source of truth).
        const areaIdSet = new Set(ar.areas.map((a) => a.id));
        const mgrs = activeManagers.filter((mm) =>
          mm.areas.some((a) => areaIdSet.has(a.id)),
        );
        const areaNames = ar.areas.map((a) => a.name).join(" • ") || legacy.area;
        const dmName = mgrs.map((mm) => mm.name).join(", ") || legacy.dm;
        matched.set(legacy.id, {
          ...legacy,
          name: ar.name,
          area: areaNames,
          dm: dmName,
          initials: ar.name
            .split(/\s+/)
            .filter(Boolean)
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase(),
        });
      } else unmatched.push(ar);
    }
    return { filteredByActive: Array.from(matched.values()), extras: unmatched };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team]);
  const scoped =
    scope === "admin"
      ? filteredByActive
      : filteredByActive.filter((r) => allowedRepNames.has(r.name.toLowerCase()));
  const filtered =
    filter === "all"
      ? scoped
      : scoped.filter((r) => (r.dm || "").split(/,\s*/).includes(filter));
  const sorted = [...filtered].sort((a, b) => b.ratio - a.ratio);
  const allActiveCount = team?.activeReps.length ?? filteredByActive.length + extras.length;
  // touch normalizeName to keep import alive
  void normalizeName;

  return (
    <>
      <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-white">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Reps Team Performance</h1>
          {team && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30">
              {team.activeReps.length} active
            </span>
          )}
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm bg-card ring-1 ring-black/5 rounded-md px-3 py-2"
        >
          <option value="all">All areas ({allActiveCount})</option>
          {activeManagers.map((m) => (
            <option key={m.rep_id} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
      </header>
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sorted.map((r, i) => (
            <Link
              key={r.id}
              to="/reps/$id"
              params={{ id: r.id }}
              className="bg-card p-6 ring-1 ring-black/5 rounded-lg hover:ring-brand/50 hover:shadow-md transition block"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-11 bg-secondary rounded-full grid place-items-center text-sm font-semibold shrink-0">{r.initials}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold truncate">{r.name}</p>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30 shrink-0">Active</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{r.area}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{r.dm}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">#{(i + 1).toString().padStart(2, "0")}</span>
              </div>

              <div className="flex items-baseline justify-between mb-3">
                <span className="text-xs text-muted-foreground">Target achievement</span>
                <span className={`text-xl font-semibold font-mono ${r.ratio >= 100 ? "text-emerald-600" : r.ratio >= 90 ? "text-brand" : "text-amber-600"}`}>{r.achievement}%</span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mb-5">
                <div className={`h-full ${r.ratio >= 100 ? "bg-emerald-500" : r.ratio >= 90 ? "bg-brand" : "bg-amber-500"}`} style={{ width: `${Math.min(r.ratio, 130)}%` }} />
              </div>

              <dl className="grid grid-cols-2 gap-4 text-xs">
                <Stat label="Sales" value={`EGP ${fmtEGP(r.sales)}`} />
                <Stat label="Target" value={`EGP ${fmtEGP(r.target)}`} />
                <Stat label="Sales (pts)" value={`${fmtEGP(r.salesPts)}`} />
                <Stat label="Target (pts)" value={`${fmtEGP(r.targetPts)}`} />
                <Stat label="Coverage" value={`${r.coverage}%`} />
                <Stat label="Call Rate" value={`${r.callRate}%`} />
              </dl>
            </Link>
          ))}
          {filter === "all" &&
            extras.map((r) => (
              <div
                key={r.rep_id}
                className="bg-card p-6 ring-1 ring-black/5 rounded-lg block opacity-95"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="size-11 bg-secondary rounded-full grid place-items-center text-sm font-semibold">
                    {r.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold truncate">{r.name}</p>
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30">Active</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.areas.map((a) => a.name).join(", ") || "—"}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  No performance data uploaded yet for this rep.
                </p>
              </div>
            ))}
        </div>
        {team && sorted.length === 0 && extras.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No active representatives. Assign areas from Admin → Team & Transfers.
          </p>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground mb-1">{label}</dt>
      <dd className="font-medium font-mono">{value}</dd>
    </div>
  );
}
