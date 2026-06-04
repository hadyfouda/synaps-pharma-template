import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  getProductBySlug, getMonthlyForProduct, getRepsForProduct, getDMByName,
  reps, dms, fmtEGP, fmtMonthShort, productSlug,
} from "@/lib/mock-data";

export const Route = createFileRoute("/products/$slug")({
  component: ProductDetail,
  head: ({ params }) => {
    const p = getProductBySlug(params.slug);
    return {
      meta: [
        { title: `${p?.name ?? "Product"} — SYNAPS` },
        { name: "description", content: `Sales performance details for ${p?.name ?? "product"}` },
      ],
    };
  },
  loader: ({ params }) => {
    const p = getProductBySlug(params.slug);
    if (!p) throw notFound();
    return p;
  },
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const p = getProductBySlug(slug)!;
  const months = getMonthlyForProduct(p.name);
  const repsSales = getRepsForProduct(p.name)
    .map((rs) => {
      const r = reps.find((x) => x.name === rs.mr);
      return { ...rs, rep: r };
    })
    .sort((a, b) => b.sales - a.sales);

  // Aggregate by DM
  const dmAgg = dms.map((d) => {
    const teamNames = new Set(reps.filter((r) => r.dm === d.name).map((r) => r.name));
    const rows = repsSales.filter((r) => teamNames.has(r.mr));
    const sales = rows.reduce((s, r) => s + r.sales, 0);
    const target = rows.reduce((s, r) => s + r.target, 0);
    return { dm: d, sales, target, ratio: target ? (sales / target) * 100 : 0 };
  }).filter((x) => x.sales > 0).sort((a, b) => b.sales - a.sales);

  const totalSales = months.reduce((s, m) => s + m.sales, 0);
  const totalTarget = months.reduce((s, m) => s + m.target, 0);
  const maxM = Math.max(...months.map((m) => Math.max(m.sales, m.target)), 1);

  const avgMonth = months.length ? totalSales / months.length : 0;
  const best = [...months].sort((a, b) => b.sales - a.sales)[0];
  const worst = [...months].sort((a, b) => a.sales - b.sales)[0];

  // keep getDMByName import alive
  void getDMByName;

  return (
    <>
      <header className="h-16 border-b border-border flex items-center px-8 bg-white gap-3">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Dashboard</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-lg font-semibold">{p.name}</h1>
        <span className="text-xs text-muted-foreground font-mono">{p.arabic}</span>
      </header>

      <div className="p-8 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPI label="Sales" value={`EGP ${fmtEGP(p.sales)}`} />
          <KPI label="Target" value={`EGP ${fmtEGP(p.target)}`} />
          <KPI label="Achievement" value={`${p.ratio.toFixed(1)}%`} accent />
          <KPI label="Units sold" value={fmtEGP(p.units)} />
          <KPI label="Monthly avg" value={`EGP ${fmtEGP(Math.round(avgMonth))}`} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Monthly Sales</h3>
            <div className="flex gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-sm bg-brand" /> Sales</span>
              <span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-sm bg-accent-2/70" /> Target</span>
            </div>
          </div>
          <div className="bg-card p-6 ring-1 ring-black/5 rounded-lg h-[280px] flex items-end gap-2 justify-between overflow-x-auto">
            {months.map((m) => {
              const sH = (m.sales / maxM) * 100;
              const tH = (m.target / maxM) * 100;
              return (
                <div key={m.month} className="flex-1 min-w-[28px] flex flex-col items-center gap-2 h-full justify-end">
                  <div className="w-full flex gap-0.5 items-end" style={{ height: "85%" }}>
                    <div className="flex-1 bg-brand rounded-t-sm" style={{ height: `${sH}%` }} title={`EGP ${fmtEGP(m.sales)}`} />
                    <div className="flex-1 bg-accent-2/70 rounded-t-sm" style={{ height: `${tH}%` }} title={`Target ${fmtEGP(m.target)}`} />
                  </div>
                  <span className="text-[9px] text-muted-foreground font-medium">{fmtMonthShort(m.month)}</span>
                </div>
              );
            })}
          </div>
          {best && worst && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 text-xs">
              <Stat label="Best month" value={`${fmtMonthShort(best.month)} — EGP ${fmtEGP(best.sales)}`} />
              <Stat label="Weakest month" value={`${fmtMonthShort(worst.month)} — EGP ${fmtEGP(worst.sales)}`} />
              <Stat label="Total" value={`EGP ${fmtEGP(totalSales)} / ${fmtEGP(totalTarget)}`} />
            </div>
          )}
        </section>

        {dmAgg.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3">Sales by District Manager</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dmAgg.map((row) => (
                <Link key={row.dm.id} to="/managers/$id" params={{ id: row.dm.id }} className="bg-card p-5 ring-1 ring-black/5 rounded-lg hover:ring-brand/50 transition">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{row.dm.name}</p>
                      <p className="text-[11px] text-muted-foreground">{row.dm.area}</p>
                    </div>
                    <span className={`text-xs font-mono font-semibold ${row.ratio >= 100 ? "text-emerald-600" : row.ratio >= 90 ? "text-brand" : "text-amber-600"}`}>{row.ratio.toFixed(1)}%</span>
                  </div>
                  <p className="text-lg font-semibold font-mono">EGP {fmtEGP(row.sales)}</p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">of {fmtEGP(row.target)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {repsSales.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold mb-3">Reps Performance ({repsSales.length})</h3>
            <div className="bg-card ring-1 ring-black/5 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-3 font-medium">Rep</th>
                    <th className="p-3 font-medium">Area</th>
                    <th className="p-3 font-medium">Sales</th>
                    <th className="p-3 font-medium">Target</th>
                    <th className="p-3 font-medium">Achievement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {repsSales.map((row) => {
                    const ratio = row.target ? (row.sales / row.target) * 100 : 0;
                    return (
                      <tr key={row.mr}>
                        <td className="p-3">
                          {row.rep ? (
                            <Link to="/reps/$id" params={{ id: row.rep.id }} className="font-medium hover:text-brand">{row.mr}</Link>
                          ) : <span className="font-medium">{row.mr}</span>}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs">{row.rep?.area ?? "—"}</td>
                        <td className="p-3 font-mono">{fmtEGP(row.sales)}</td>
                        <td className="p-3 font-mono text-muted-foreground">{fmtEGP(row.target)}</td>
                        <td className={`p-3 font-mono font-semibold ${ratio >= 100 ? "text-emerald-600" : ratio >= 90 ? "text-brand" : "text-amber-600"}`}>{ratio.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-card p-4 ring-1 ring-black/5 rounded-lg">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-mono font-semibold ${accent ? "text-brand text-lg" : ""}`}>{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card p-3 ring-1 ring-black/5 rounded-lg flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

// expose for tree-shaking safety
export { productSlug };
