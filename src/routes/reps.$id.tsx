import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRepActiveContext, getActiveTeam } from "@/lib/management.functions";
import { supabase } from "@/integrations/supabase/client";
import { getRepById, getDMByName, getMonthlyForRep, getProductsForRep, findRepByLooseName, fmtEGP, fmtMonthShort, unitsFromEGP, fmtUnits, products as allProducts, type Aspiration } from "@/lib/mock-data";
import { useRepEdit, useHasMounted } from "@/lib/overrides";
import { useAuth } from "@/lib/use-auth";
import { EditModal, Field, TextInput, NumberInput, SelectInput } from "@/components/edit-modal";
import { RepKPISection } from "@/components/kpi-section";
import { PeriodFilters, aggregateMonthly, resolveSelectedMonths, emptyPeriod, type PeriodSelection } from "@/components/period-filter";
import { ProductFilter } from "@/components/product-filter";
import { PharmacyDetailDialog } from "@/components/pharmacy-detail-dialog";

export const Route = createFileRoute("/reps/$id")({
  component: RepDetail,
  head: ({ params }) => {
    const r = getRepById(params.id);
    return {
      meta: [
        { title: `${r?.name ?? "Medical Rep"} — SYNAPS` },
        { name: "description", content: `Performance details for ${r?.name ?? "rep"}` },
      ],
    };
  },
  loader: ({ params }) => {
    const r = getRepById(params.id);
    if (!r) throw notFound();
    return r;
  },
});

function RepDetail() {
  const { id } = Route.useParams();
  const r = getRepById(id)!;
  const fetchCtx = useServerFn(getRepActiveContext);
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
  const activeRep = useMemo(() => {
    if (!team) return undefined;
    return team.activeReps.find((ar) => findRepByLooseName(ar.name)?.id === id);
  }, [team, id]);
  const activeName = activeRep?.name ?? r.name;
  const activeAreaNames = activeRep?.areas.map((a) => a.name).join(" • ") ?? r.area;
  const activeManager = useMemo(() => {
    if (!team || !activeRep) return undefined;
    const ids = new Set(activeRep.areas.map((a) => a.id));
    const mgrs = team.activeManagers.filter((m) =>
      m.areas.some((a) => ids.has(a.id)),
    );
    return mgrs.length ? mgrs.map((m) => m.name).join(", ") : undefined;
  }, [team, activeRep]);
  const { data: ctxData } = useQuery({
    queryKey: ["rep-active-context", activeName],
    queryFn: () => fetchCtx({ data: { name: activeName } }),
    refetchOnWindowFocus: true,
    enabled: !!activeName,
  });
  useEffect(() => {
    const ch = supabase
      .channel(`rep_ctx_${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rep_assignments" },
        () => {
          qc.invalidateQueries({ queryKey: ["rep-active-context", activeName] });
          qc.invalidateQueries({ queryKey: ["active-team"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "doctors" },
        () => qc.invalidateQueries({ queryKey: ["rep-active-context", activeName] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, id, activeName]);
  const ctx = ctxData?.context;
  const isActive = (ctx?.areas.length ?? 0) > 0;
  const mounted = useHasMounted();
  const { edit, save, reset } = useRepEdit(id);

  const m = {
    ...r,
    name: edit.name ?? activeName,
    area: edit.area ?? activeAreaNames,
    sales: edit.sales ?? r.sales,
    target: edit.target ?? r.target,
    salesPts: edit.salesPts ?? r.salesPts,
    targetPts: edit.targetPts ?? r.targetPts,
    coverage: edit.coverage ?? r.coverage,
    callRate: edit.callRate ?? r.callRate,
    doubleVisits: edit.doubleVisits ?? r.doubleVisits,
    aspiration: (edit.aspiration ?? r.aspiration) as Aspiration,
    skills: edit.skills ?? r.skills,
  };
  m.ratio = m.target ? (m.sales / m.target) * 100 : 0;
  m.achievement = Math.round(m.ratio * 10) / 10;

  const legacyDm = getDMByName(r.dm);
  const dm = activeManager ? undefined : legacyDm;
  const months = getMonthlyForRep(r.name);
  const productsData = getProductsForRep(r.name);
  const [productSel, setProductSel] = useState<string>("");
  const [metric, setMetric] = useState<"value" | "units">("value");
  const [areaFilter, setAreaFilter] = useState<string>("");
  const [pharmacyDetailId, setPharmacyDetailId] = useState<string | null>(null);
  const totalProdSales = productsData.reduce((s, p) => s + p.sales, 0);
  const totalProdTarget = productsData.reduce((s, p) => s + p.target, 0);
  const selectedProduct = productSel ? productsData.find((p) => p.product === productSel) : undefined;
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
  const baseSales = (mounted ? m.sales : r.sales) * sShare;
  const baseTarget = (mounted ? m.target : r.target) * tShare;
  const totalMonthlySales = monthKeys.length ? filteredMonths.reduce((a, b) => a + b.sales, 0) : 0;
  const ptsFactor = totalMonthlySales > 0 ? filtered.sales / totalMonthlySales : 1;
  const displaySales = monthKeys.length ? filtered.sales : baseSales;
  const displayTarget = monthKeys.length ? filtered.target : baseTarget;
  const displayAch = displayTarget ? (displaySales / displayTarget) * 100 : 0;
  const displaySalesPts = Math.round((mounted ? m.salesPts : r.salesPts) * sShare * ptsFactor);

  const selectedProductMeta = productSel ? allProducts.find((p) => p.name === productSel) : undefined;
  const productUnitPrice =
    selectedProductMeta && selectedProductMeta.units > 0
      ? selectedProductMeta.sales / selectedProductMeta.units
      : 0;
  const useUnits = metric === "units" && !!productSel && productUnitPrice > 0;
  const kpiSales = useUnits ? displaySales / productUnitPrice : displaySales;
  const kpiTarget = useUnits ? displayTarget / productUnitPrice : displayTarget;
  const kpiSalesLabel = useUnits ? `${fmtUnits(kpiSales)} units` : `EGP ${fmtEGP(kpiSales)}`;
  const kpiTargetLabel = useUnits ? `${fmtUnits(kpiTarget)} units` : `EGP ${fmtEGP(kpiTarget)}`;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(m);
  const openEdit = () => { setForm(m); setOpen(true); };
  const view = mounted ? m : r;

  // keep openEdit import alive
  void openEdit;

  return (
    <>
      <header className="h-16 border-b border-border flex items-center justify-between px-8 bg-white">
        <div className="flex items-center gap-3">
          <Link to="/reps" className="text-xs text-muted-foreground hover:text-foreground">← Reps</Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-lg font-semibold">{view.name}</h1>
          {isActive && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => { setForm(m); setOpen(true); }} className="text-sm font-medium px-3 py-1.5 ring-1 ring-black/5 bg-card rounded-md hover:bg-secondary transition flex items-center gap-1.5">
            <Pencil className="size-3.5" /> Edit
          </button>
        </div>
      </header>

      <div className="p-8 space-y-8">
        <section className="bg-card ring-1 ring-black/5 rounded-lg p-6 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="size-16 bg-secondary rounded-full grid place-items-center text-lg font-semibold">{r.initials}</div>
            <div>
              <p className="text-xs text-muted-foreground">Medical Rep</p>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{view.name}</h2>
                {isActive && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/30">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{view.area}</p>
              {activeManager ? (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Manager: <span className="text-brand">{activeManager}</span>
                </p>
              ) : dm && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Manager: <Link to="/managers/$id" params={{ id: dm.id }} className="text-brand hover:underline">{dm.name}</Link>
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:ml-auto text-sm">
            <KPI label={`Sales${useUnits ? " (units)" : ""}`} value={kpiSalesLabel} />
            <KPI label={`Target${useUnits ? " (units)" : ""}`} value={kpiTargetLabel} />
            <KPI label="Achievement" value={`${displayAch.toFixed(1)}%`} accent />
            <KPI label="Sales (pts)" value={fmtEGP(displaySalesPts)} />
          </div>
        </section>

        {monthKeys.length > 0 && (
          <section className="flex items-center gap-2 flex-wrap justify-end">
            <div className="inline-flex items-center rounded-md ring-1 ring-black/10 overflow-hidden text-[11px]">
              <button
                type="button"
                onClick={() => setMetric("value")}
                className={`px-2.5 py-1 ${metric === "value" ? "bg-brand text-white" : "bg-background text-muted-foreground hover:text-foreground"}`}
              >
                Value
              </button>
              <button
                type="button"
                onClick={() => setMetric("units")}
                className={`px-2.5 py-1 border-l border-black/10 ${metric === "units" ? "bg-brand text-white" : "bg-background text-muted-foreground hover:text-foreground"}`}
              >
                Units
              </button>
            </div>
            {metric === "units" && !productSel && (
              <span className="text-[10px] text-amber-600">Select a product to view units</span>
            )}
            <ProductFilter
              options={productsData.map((p) => p.product)}
              value={productSel}
              onChange={setProductSel}
            />
            <PeriodFilters months={monthKeys} value={period} onChange={setPeriod} />
          </section>
        )}

        {ctx && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Active Sales Plan</h3>
              <div className="flex items-center gap-2 text-[11px] flex-wrap">
                {areaFilter && (
                  <button
                    type="button"
                    onClick={() => setAreaFilter("")}
                    className="px-2 py-0.5 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                {ctx.areas.map((a) => {
                  const active = areaFilter === a.name;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAreaFilter(active ? "" : a.name)}
                      className={`px-2 py-0.5 rounded-full transition ${active ? "bg-brand text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/80"}`}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card ring-1 ring-black/5 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/40">
                  <span className="text-xs font-semibold">
                    Assigned Pharmacies{areaFilter ? ` — ${areaFilter}` : ""}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {(areaFilter ? ctx.pharmacies.filter((p) => p.area_name === areaFilter) : ctx.pharmacies).length}
                  </span>
                </div>
                <div className="max-h-72 overflow-auto divide-y divide-border">
                  {(() => {
                    const list = areaFilter
                      ? ctx.pharmacies.filter((p) => p.area_name === areaFilter)
                      : ctx.pharmacies;
                    if (list.length === 0) {
                      return (
                        <p className="p-4 text-xs text-muted-foreground">
                          {areaFilter ? `No pharmacies in ${areaFilter}.` : "No pharmacies in active areas."}
                        </p>
                      );
                    }
                    return list.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPharmacyDetailId(p.id)}
                      className="w-full flex items-center justify-between px-4 py-2 text-xs text-left hover:bg-secondary/60 transition"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{p.area_name}</span>
                    </button>
                    ));
                  })()}
                </div>
              </div>
              <div className="bg-card ring-1 ring-black/5 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-secondary/40">
                  <span className="text-xs font-semibold">Doctor Segmentation</span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border">
                  <ClassStat letter="A" count={ctx.doctors.A} color="text-emerald-600" />
                  <ClassStat letter="B" count={ctx.doctors.B} color="text-brand" />
                  <ClassStat letter="C" count={ctx.doctors.C} color="text-muted-foreground" />
                </div>
                <div className="border-t border-border max-h-52 overflow-auto">
                  <DoctorList label="Class A" items={ctx.topDoctors.A} accent="bg-emerald-500/10 text-emerald-700 ring-emerald-500/30" />
                  <DoctorList label="Class B" items={ctx.topDoctors.B} accent="bg-brand/10 text-brand ring-brand/30" />
                  {ctx.topDoctors.A.length === 0 && ctx.topDoctors.B.length === 0 && (
                    <p className="p-4 text-xs text-muted-foreground">
                      No Class A/B doctors mapped yet. Add them from Admin → Team &amp; Transfers.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SoftCard label="Career Aspiration" value={view.aspiration} />
        </section>

        <RepKPISection repName={r.name} />

        <section>
          <h3 className="text-sm font-semibold mb-3">Skills</h3>
          <div className="bg-card ring-1 ring-black/5 rounded-lg p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <SkillBar label="Product Knowledge" value={view.skills.product} />
            <SkillBar label="Selling Skills" value={view.skills.selling} />
            <SkillBar label="Planning" value={view.skills.planning} />
          </div>
        </section>

        {productsData.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3">Sales by Product</h3>
            <div className="bg-card ring-1 ring-black/5 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-4 font-medium">Product</th>
                    <th className="p-4 font-medium">Sales</th>
                    <th className="p-4 font-medium">Target</th>
                    <th className="p-4 font-medium">Achievement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productsData.map((p) => {
                    const r2 = p.target ? (p.sales / p.target) * 100 : 0;
                    return (
                      <tr key={p.product}>
                        <td className="p-4 font-medium">{p.product}</td>
                        <td className="p-4 font-mono">{fmtEGP(p.sales)}</td>
                        <td className="p-4 font-mono text-muted-foreground">{fmtEGP(p.target)}</td>
                        <td className={`p-4 font-mono font-semibold ${r2 >= 100 ? "text-emerald-600" : r2 >= 90 ? "text-brand" : "text-amber-600"}`}>{r2.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {months.length > 0 && (
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
                    const r2 = m.target ? (m.sales / m.target) * 100 : 0;
                    return (
                      <tr key={m.month}>
                        <td className="p-4 font-medium">{fmtMonthShort(m.month)}</td>
                        <td className="p-4 font-mono">{fmtEGP(m.sales)}</td>
                        <td className="p-4 font-mono text-muted-foreground">{fmtEGP(m.target)}</td>
                        <td className="p-4 font-mono">{fmtUnits(unitsFromEGP(m.sales))}</td>
                        <td className="p-4 font-mono text-muted-foreground">{fmtUnits(unitsFromEGP(m.target))}</td>
                        <td className={`p-4 font-mono font-semibold ${r2 >= 100 ? "text-emerald-600" : r2 >= 90 ? "text-brand" : "text-amber-600"}`}>{r2.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <EditModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Edit ${form.name}`}
        onSubmit={() => save({
          name: form.name, area: form.area,
          sales: form.sales, target: form.target,
          salesPts: form.salesPts, targetPts: form.targetPts,
          aspiration: form.aspiration,
          skills: form.skills,
        })}
        onReset={reset}
      >
        <Field label="Name"><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
        <Field label="Area"><TextInput value={form.area} onChange={(v) => setForm({ ...form, area: v })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sales (EGP)"><NumberInput value={form.sales} onChange={(v) => setForm({ ...form, sales: v })} /></Field>
          <Field label="Target (EGP)"><NumberInput value={form.target} onChange={(v) => setForm({ ...form, target: v })} /></Field>
          <Field label="Sales (pts)"><NumberInput value={form.salesPts} onChange={(v) => setForm({ ...form, salesPts: v })} /></Field>
          <Field label="Target (pts)"><NumberInput value={form.targetPts} onChange={(v) => setForm({ ...form, targetPts: v })} /></Field>
          <Field label="Aspiration">
            <SelectInput<Aspiration>
              value={form.aspiration}
              onChange={(v) => setForm({ ...form, aspiration: v })}
              options={[
                { value: "District Manager", label: "District Manager" },
                { value: "Product Specialist", label: "Product Specialist" },
                { value: "KAM", label: "KAM" },
                { value: "Senior Rep", label: "Senior Rep" },
              ]}
            />
          </Field>
        </div>
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-semibold mb-2">Skills</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Product"><NumberInput value={form.skills.product} min={0} max={100} onChange={(v) => setForm({ ...form, skills: { ...form.skills, product: v } })} /></Field>
            <Field label="Selling"><NumberInput value={form.skills.selling} min={0} max={100} onChange={(v) => setForm({ ...form, skills: { ...form.skills, selling: v } })} /></Field>
            <Field label="Planning"><NumberInput value={form.skills.planning} min={0} max={100} onChange={(v) => setForm({ ...form, skills: { ...form.skills, planning: v } })} /></Field>
          </div>
        </div>
      </EditModal>
      <PharmacyDetailDialog
        pharmacyId={pharmacyDetailId}
        open={!!pharmacyDetailId}
        onClose={() => setPharmacyDetailId(null)}
      />
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

function ClassStat({ letter, count, color }: { letter: string; count: number; color: string }) {
  return (
    <div className="p-4 text-center">
      <p className="text-[10px] text-muted-foreground mb-1">Class {letter}</p>
      <p className={`text-2xl font-mono font-semibold ${color}`}>{count}</p>
    </div>
  );
}

function DoctorList({
  label,
  items,
  accent,
}: {
  label: string;
  items: { id: string; name: string; specialty: string | null; area_name: string | null }[];
  accent: string;
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label} ({items.length})
      </p>
      <ul className="divide-y divide-border">
        {items.map((d) => (
          <li key={d.id} className="px-4 py-2 flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-medium">{d.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {[d.specialty, d.area_name].filter(Boolean).join(" • ") || "—"}
              </p>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ring-1 shrink-0 ${accent}`}>
              {label.split(" ")[1]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SoftCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-4 ring-1 ring-black/5 rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-mono font-semibold">{value}</p>
    </div>
  );
}

function SkillBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{value}</span>
      </div>
      <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
        <div className="h-full bg-brand" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
