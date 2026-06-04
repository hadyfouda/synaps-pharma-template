import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { products, monthly, dms, kpis, fmtEGP, fmtMonth, findDMByLooseName } from "@/lib/mock-data";
import { getActiveTeam } from "@/lib/management.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/sales")({
  component: SalesPage,
  head: () => ({
    meta: [
      { title: "Sales — SYNAPS" },
      { name: "description", content: "Detailed analysis of the sales line" },
    ],
  }),
});

function SalesPage() {
  const fetchTeam = useServerFn(getActiveTeam);
  const { isAuthenticated } = useAuth();
  const { data: team } = useQuery({
    queryKey: ["active-team"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return null;
      return fetchTeam();
    },
    enabled: isAuthenticated,
    retry: false,
  });
  const visibleDms = useMemo(() => {
    if (!team) return dms;
    const matched = new Map<string, (typeof dms)[number]>();
    for (const am of team.activeManagers) {
      const legacy = findDMByLooseName(am.name);
      if (legacy) matched.set(legacy.id, legacy);
    }
    return Array.from(matched.values());
  }, [team]);
  return (
    <>
      <header className="h-16 border-b border-border flex items-center px-8 bg-white">
        <h1 className="text-lg font-semibold">Sales Analysis</h1>
      </header>
      <div className="p-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Stat label="Total Sales" value={`EGP ${fmtEGP(kpis.totalSales)}`} />
          <Stat label="Total Target" value={`EGP ${fmtEGP(kpis.totalTarget)}`} />
          <Stat label="Achievement" value={`${kpis.achievement.toFixed(1)}%`} accent />
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-3">Monthly Sales Log</h3>
          <div className="bg-card ring-1 ring-black/5 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-4 font-medium">Month</th>
                  <th className="p-4 font-medium">Sales (EGP)</th>
                  <th className="p-4 font-medium">Target (EGP)</th>
                  <th className="p-4 font-medium">Achievement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {monthly.map((m) => (
                  <tr key={m.month}>
                    <td className="p-4 font-medium">{fmtMonth(m.month)}</td>
                    <td className="p-4 font-mono">{fmtEGP(m.sales)}</td>
                    <td className="p-4 font-mono">{fmtEGP(m.target)}</td>
                    <td className={`p-4 font-mono font-semibold ${m.ratio >= 100 ? "text-emerald-600" : m.ratio >= 85 ? "text-brand" : "text-amber-600"}`}>{m.ratio.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-3">Products Breakdown</h3>
          <div className="bg-card ring-1 ring-black/5 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-4 font-medium">Product</th>
                  <th className="p-4 font-medium">Sales</th>
                  <th className="p-4 font-medium">Target</th>
                  <th className="p-4 font-medium">Units</th>
                  <th className="p-4 font-medium">Achievement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.name}>
                    <td className="p-4">
                      <div className="font-medium">{p.name}</div>
                    </td>
                    <td className="p-4 font-mono">{fmtEGP(p.sales)}</td>
                    <td className="p-4 font-mono">{fmtEGP(p.target)}</td>
                    <td className="p-4 font-mono">{fmtEGP(p.units)} / {fmtEGP(p.targetUnits)}</td>
                    <td className={`p-4 font-mono font-semibold ${p.ratio >= 100 ? "text-emerald-600" : p.ratio >= 80 ? "text-brand" : "text-amber-600"}`}>{p.ratio.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-3">District Managers Breakdown</h3>
          <div className="bg-card ring-1 ring-black/5 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-4 font-medium">District Manager</th>
                  <th className="p-4 font-medium">Area</th>
                  <th className="p-4 font-medium">Sales</th>
                  <th className="p-4 font-medium">Target</th>
                  <th className="p-4 font-medium">Achievement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleDms.map((d) => (
                  <tr key={d.id}>
                    <td className="p-4 font-medium">{d.name}</td>
                    <td className="p-4 text-xs text-muted-foreground">{d.area}</td>
                    <td className="p-4 font-mono">{fmtEGP(d.sales)}</td>
                    <td className="p-4 font-mono">{fmtEGP(d.target)}</td>
                    <td className={`p-4 font-mono font-semibold ${d.ratio >= 100 ? "text-emerald-600" : d.ratio >= 90 ? "text-brand" : "text-amber-600"}`}>{d.ratio.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card p-5 ring-1 ring-black/5 rounded-lg">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <p className={`text-2xl font-semibold tracking-tight font-mono ${accent ? "text-brand" : ""}`}>{value}</p>
    </div>
  );
}
