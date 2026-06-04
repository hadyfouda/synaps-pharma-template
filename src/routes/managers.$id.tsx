import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { getDMById, getRepsByDM, getMonthlyForDM, mrProduct, fmtEGP, fmtMonthShort, unitsFromEGP, fmtUnits, findRepByLooseName, reps as legacyReps } from "@/lib/mock-data";
import { useDMEdit, useHasMounted } from "@/lib/overrides";
import { EditModal, Field, TextInput, NumberInput } from "@/components/edit-modal";
import { ManagerKPISection } from "@/components/kpi-section";
import { PeriodFilters, aggregateMonthly, resolveSelectedMonths, emptyPeriod, type PeriodSelection } from "@/components/period-filter";
import { ProductFilter } from "@/components/product-filter";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActiveTeam } from "@/lib/management.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { normalizeName, looseNameMatch } from "@/lib/name-match";

export const Route = createFileRoute("/managers/$id")({
  component: ManagerDetail,
  head: ({ params }) => {
    const d = getDMById(params.id);
    return {
      meta: [
        { title: `${d?.name ?? "District Manager"} — SYNAPS` },
        { name: "description", content: `Performance details for ${d?.name ?? "manager"}` },
      ],
    };
  },
  loader: ({ params }) => {
    const d = getDMById(params.id);
    if (!d) throw notFound();
    return d;
  },
});

function ManagerDetail() {
  const { id } = Route.useParams();
  const d = getDMById(id)!;
  const mounted = useHasMounted();
  const { edit, save, reset } = useDMEdit(id);

  const merged = {
    ...d,
    name: edit.name ?? d.name,
    area: edit.area ?? d.area,
    sales: edit.sales ?? d.sales,
    target: edit.target ?? d.target,
  };
  merged.ratio = merged.target ? (merged.sales / merged.target) * 100 : 0;

  const { isAuthenticated } = useAuth();
  const fetchTeam = useServerFn(getActiveTeam);
  const { data: activeTeamData } = useQuery({
    queryKey: ["active-team"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) return null;
      return fetchTeam();
    },
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const team = useMemo(() => {
    if (!activeTeamData) return getRepsByDM(d.name).sort((a, b) => b.ratio - a.ratio);
    const dmKey = normalizeName(d.name);
    const mgr =
      activeTeamData.activeManagers.find((m) => normalizeName(m.name) === dmKey) ??
      activeTeamData.activeManagers.find((m) => looseNameMatch(m.name, d.name));
    if (!mgr) return [];
    const areaIds = new Set(mgr.areas.map((a) => a.id));
    const byMgrId = activeTeamData.activeReps.filter((r) => r.manager_id === mgr.rep_id);
    const byArea = activeTeamData.activeReps.filter(
      (r) => !r.manager_id && r.areas.some((a) => areaIds.has(a.id)),
    );
    const seen = new Set<string>();
    const repsInDM = [...byMgrId, ...byArea].filter((r) => {
      if (seen.has(r.rep_id)) return false;
      seen.add(r.rep_id);
      return true;
    });
    const cards = repsInDM.map((ar) => {
      const legacy = findRepByLooseName(ar.name);
      const areaNames = ar.areas.map((a) => a.name).join(" • ");
      const initials = ar.name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
      if (legacy) {
        return { ...legacy, name: ar.name, area: areaNames || legacy.area, initials };
      }
      const empty = legacyReps[0];
      return { ...empty, id: ar.rep_id, name: ar.name, area: areaNames, initials, sales: 0, target: 0, ratio: 0, achievement: 0 } as typeof empty;
    });
    return cards.sort((a, b) => b.ratio - a.ratio);
  }, [activeTeamData, d.name]);
  const months = getMonthlyForDM(d.name);
  const productAgg = useMemo(() => {
    const repNames = new Set(team.map((t) => t.name));
    const map = new Map<string, { sales: number; target: number }>();
    for (const row of mrProduct) {
      if (!repNames.has(row.mr)) continue;
      const cur = map.get(row.product) ?? { sales: 0, target: 0 };
      cur.sales += row.sales;
      cur.target += row.target;
      map.set(row.product, cur);
    }
    return Array.from(map.entries()).map(([product, v]) => ({ product, ...v }));
  }, [team]);
  const [productSel, setProductSel] = useState<string>("");
  const totalProdSales = productAgg.reduce((s, p) => s + p.sales, 0);
  const totalProdTarget = productAgg.reduce((s, p) => s + p.target, 0);
  const selectedProduct = productSel ? productAgg.find((p) => p.product === productSel) : undefined;
  const sShare = selectedProduct && totalProdSales > 0 ? selectedProduct.sales / totalProdSales : 1;
  const tShare = selectedProduct && totalProdTarget > 0 ? selectedProduct.target / totalProdTarget : 1;
  const filteredMonths = useMemo(
    () => months.map((m) => ({ ...m, sales: m.sales * sShare, target: m.target * tShare })),
    [months, sShare, tShare],
  );
  const monthKeys = useMemo(() => months.map((x) => x.month), [months]);
  const [period, setPeriod] = useState<PeriodSelection>(emptyPeriod);
  const resolved = useMemo(() => resolveSelectedMonths(monthKeys, period), [monthKeys, period]);
  const effective = resolved.length ? resolved : monthKeys;
  const filtered = useMemo(() => aggregateMonthly(filteredMonths, effective), [filteredMonths, effective]);
  const baseSales = (mounted ? merged.sales : d.sales) * sShare;
  const baseTarget = (mounted ? merged.target : d.target) * tShare;
  const displaySales = monthKeys.length ? filtered.sales : baseSales;
  const displayTarget = monthKeys.length ? filtered.target : baseTarget;
  const displayAch = displayTarget ? (displaySales / displayTarget) * 100 : 0;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(merged);
  const openEdit = () => { setForm(merged); setOpen(true); };

  return (
    <>
      <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-white">
        <div className="flex items-center gap-3">
          <Link to="/managers" className="text-xs text-muted-foreground hover:text-foreground">← Managers</Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-lg font-semibold">{mounted ? merged.name : d.name}</h1>
        </div>
        <button onClick={openEdit} className="text-sm font-medium px-3 py-1.5 ring-1 ring-black/5 bg-card rounded-md hover:bg-secondary transition flex items-center gap-1.5">
          <Pencil className="size-3.5" /> Edit
        </button>
      </header>

      <div className="p-8 space-y-8">
        <section className="bg-card ring-1 ring-black/5 rounded-lg p-6 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="size-16 bg-brand/15 text-brand-foreground rounded-full grid place-items-center text-lg font-semibold ring-1 ring-brand/30">
              {d.initials}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">District Manager</p>
              <h2 className="text-xl font-semibold">{mounted ? merged.name : d.name}</h2>
              <p className="text-xs text-muted-foreground">{mounted ? merged.area : d.area}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:ml-auto text-sm">
            <KPI label="Sales" value={`EGP ${fmtEGP(displaySales)}`} />
            <KPI label="Target" value={`EGP ${fmtEGP(displayTarget)}`} />
            <KPI label="Achievement" value={`${displayAch.toFixed(1)}%`} accent />
            <KPI label="Reps" value={`${team.length}`} />
          </div>
        </section>

        {monthKeys.length > 0 && (
          <div className="flex justify-end -mt-4 gap-2 items-center flex-wrap">
            <ProductFilter
              options={productAgg.map((p) => p.product)}
              value={productSel}
              onChange={setProductSel}
            />
            <PeriodFilters months={monthKeys} value={period} onChange={setPeriod} />
          </div>
        )}

        <ManagerKPISection dmName={d.name} />

        <section>
          <h3 className="text-sm font-semibold mb-3">Monthly Performance</h3>
          <div className="bg-card ring-1 ring-black/5 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-4 font-medium">Month</th>
                  <th className="p-4 font-medium">Sales Value</th>
                  <th className="p-4 font-medium">Target Value</th>
                  <th className="p-4 font-medium">Sales Units</th>
                  <th className="p-4 font-medium">Target Units</th>
                  <th className="p-4 font-medium">Achievement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMonths.map((m) => {
                  const r = m.target ? (m.sales / m.target) * 100 : 0;
                  return (
                    <tr key={m.month}>
                      <td className="p-4 font-medium">{fmtMonthShort(m.month)}</td>
                      <td className="p-4 font-mono">{fmtEGP(m.sales)}</td>
                      <td className="p-4 font-mono text-muted-foreground">{fmtEGP(m.target)}</td>
                      <td className="p-4 font-mono">{fmtUnits(unitsFromEGP(m.sales))}</td>
                      <td className="p-4 font-mono text-muted-foreground">{fmtUnits(unitsFromEGP(m.target))}</td>
                      <td className={`p-4 font-mono font-semibold ${r >= 100 ? "text-emerald-600" : r >= 90 ? "text-brand" : "text-amber-600"}`}>{r.toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-3">Reps Team ({team.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {team.map((r) => (
              <Link
                key={r.id}
                to="/reps/$id"
                params={{ id: r.id }}
                className="bg-card p-4 ring-1 ring-black/5 rounded-lg hover:ring-brand/50 transition flex items-center gap-3"
              >
                <div className="size-10 bg-secondary rounded-full grid place-items-center text-xs font-semibold shrink-0">{r.initials}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{r.area}</p>
                </div>
                <span className={`text-sm font-mono font-semibold ${r.ratio >= 100 ? "text-emerald-600" : r.ratio >= 90 ? "text-brand" : "text-amber-600"}`}>{r.achievement}%</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <EditModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit ${form.name}`}
        onSubmit={() => save({ name: form.name, area: form.area, sales: form.sales, target: form.target })}
        onReset={reset}
      >
        <Field label="Name"><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
        <Field label="Area"><TextInput value={form.area} onChange={(v) => setForm({ ...form, area: v })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sales (EGP)"><NumberInput value={form.sales} onChange={(v) => setForm({ ...form, sales: v })} /></Field>
          <Field label="Target (EGP)"><NumberInput value={form.target} onChange={(v) => setForm({ ...form, target: v })} /></Field>
        </div>
      </EditModal>
    </>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-mono font-semibold ${accent ? "text-brand text-lg" : ""}`}>{value}</p>
    </div>
  );
}
