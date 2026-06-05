import raw from "./real-data.json";
import { findLooseMatch, looseNameMatch } from "./name-match";
import { synapsConfig } from "@/synaps.config";

// ---------- Raw types from JSON ----------
interface RawMonthly { month: string; sales: number; target: number; ratio: number }
interface RawDM { name: string; area: string; sales: number; target: number; ratio: number }
interface RawMR { name: string; dm: string; area: string; sales: number; target: number; sales_pts: number; target_pts: number; ratio: number }
interface RawProduct { name: string; sales: number; target: number; units: number; target_units: number; ratio: number }
interface RawDMMonth { dm: string; month: string; sales: number; target: number }
interface RawProductMonth { product: string; month: string; sales: number; target: number }
interface RawMRMonth { mr: string; month: string; sales: number; target: number }
interface RawMRProduct { mr: string; product: string; sales: number; target: number }

type DataShape = {
  lineManager: string;
  dateRange: { start: string; end: string; months: number };
  totals: { sales: number; target: number };
  monthly: RawMonthly[];
  dms: RawDM[];
  mrs: RawMR[];
  products: RawProduct[];
  dmMonthly: RawDMMonth[];
  productMonthly: RawProductMonth[];
  mrMonthly: RawMRMonth[];
  mrProduct: RawMRProduct[];
};

// Allow client-side override (uploaded via "Update Reports")
function loadData(): DataShape {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("synaps-data-override");
      if (stored) return JSON.parse(stored) as DataShape;
    } catch {}
  }
  return raw as DataShape;
}
const data = loadData();

// ---------- Helpers ----------
export const currency = synapsConfig.dashboard.currency;
export const fmtCurrency = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
export const fmtEGP = fmtCurrency; // alias
export const fmtEGPshort = (n: number) => {
  const v = Math.abs(n);
  if (v >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(0);
};
const _totalProdUnits = (data.products ?? []).reduce((s, p) => s + (p.units ?? 0), 0);
const _totalProdSales = (data.products ?? []).reduce((s, p) => s + (p.sales ?? 0), 0);
export const globalUnitPrice = _totalProdUnits > 0 ? _totalProdSales / _totalProdUnits : 0;
export const unitsFromEGP = (egp: number) =>
  globalUnitPrice > 0 ? Math.round(egp / globalUnitPrice) : 0;
export const fmtUnits = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
const monthNamesEn = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const monthNamesShortEn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const fmtMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${monthNamesEn[m - 1]} ${y}`;
};
export const fmtMonthShort = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${monthNamesShortEn[m - 1]} ${String(y).slice(2)}`;
};
const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
};

// ---------- Exports: line / overview ----------
export const lineInfo = {
  manager: data.lineManager,
  start: data.dateRange.start,
  end: data.dateRange.end,
  months: data.dateRange.months,
};

// YoY comparison
const currentYear = new Date().getFullYear();
const prevYear = currentYear - 1;
const y_prev = data.monthly.filter((m) => m.month >= `${prevYear}-01` && m.month <= `${prevYear}-10`).reduce((s, m) => s + m.sales, 0);
const y_curr = data.monthly.filter((m) => m.month >= `${currentYear}-01` && m.month <= `${currentYear}-10`).reduce((s, m) => s + m.sales, 0);

export const kpis = {
  totalSales: data.totals.sales,
  totalTarget: data.totals.target,
  achievement: (data.totals.target > 0 ? (data.totals.sales / data.totals.target) * 100 : 0),
  yoyGrowth: y_prev ? ((y_curr - y_prev) / y_prev) * 100 : 0,
  mrCount: data.mrs.length,
  dmCount: data.dms.length,
  productCount: data.products.length,
};

// ---------- Monthly ----------
export const monthly = data.monthly;
export const monthlyTrend = data.monthly.slice(-12);

// Quarters (computed)
function quarterOf(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}
const qMap = new Map<string, { sales: number; target: number }>();
data.monthly.forEach((m) => {
  const q = quarterOf(m.month);
  const v = qMap.get(q) ?? { sales: 0, target: 0 };
  v.sales += m.sales; v.target += m.target;
  qMap.set(q, v);
});
export const quarters = Array.from(qMap.entries())
  .sort(([a], [b]) => (a < b ? -1 : 1))
  .map(([name, v]) => ({ name, sales: v.sales, target: v.target, ratio: v.target ? (v.sales / v.target) * 100 : 0 }));

// ---------- DMs (districts) ----------
export interface DM { id: string; name: string; area: string; sales: number; target: number; ratio: number; initials: string }
export const dms: DM[] = data.dms.map((d, i) => ({
  id: `dm${i + 1}`,
  name: d.name,
  area: d.area,
  sales: d.sales,
  target: d.target,
  ratio: d.ratio,
  initials: initialsOf(d.name),
}));

// ---------- Products ----------
export interface Product { name: string; arabic: string; sales: number; target: number; units: number; targetUnits: number; ratio: number }
export const products: Product[] = data.products.map((p) => ({
  name: p.name,
  arabic: p.name,
  sales: p.sales,
  target: p.target,
  units: p.units,
  targetUnits: p.target_units,
  ratio: p.ratio,
}));

// ---------- MRs ----------
export type Aspiration = "Product Specialist" | "District Manager" | "KAM" | "Senior Rep";
export interface Rep {
  id: string;
  name: string;
  initials: string;
  dm: string;
  area: string;
  sales: number;
  target: number;
  ratio: number;
  achievement: number;
  salesPts: number;
  targetPts: number;
  pointsRatio: number;
  coverage: number;
  callRate: number;
  doubleVisits: number;
  tierCoverage: { A: number; B: number; C: number };
  skills: { product: number; selling: number; planning: number };
  aspiration: Aspiration;
}

const aspirations: Aspiration[] = ["District Manager", "Product Specialist", "KAM", "Senior Rep"];

export const reps: Rep[] = data.mrs.map((m, i) => {
  const ratio = m.ratio;
  const base = Math.min(100, Math.max(40, Math.round(ratio)));
  const skill = (delta: number) => Math.min(100, Math.max(40, base + delta - 5));
  return {
    id: `r${i + 1}`,
    name: m.name,
    initials: initialsOf(m.name),
    dm: m.dm,
    area: m.area,
    sales: m.sales,
    target: m.target,
    ratio,
    achievement: Math.round(ratio * 10) / 10,
    salesPts: m.sales_pts,
    targetPts: m.target_pts,
    pointsRatio: m.target_pts ? (m.sales_pts / m.target_pts) * 100 : 0,
    coverage: Math.min(100, Math.round(60 + (ratio - 50) * 0.5)),
    callRate: Math.min(100, Math.round(65 + (ratio - 50) * 0.4)),
    doubleVisits: Math.max(1, Math.round(ratio / 25)),
    tierCoverage: { A: skill(15), B: skill(5), C: skill(-10) },
    skills: { product: skill(8), selling: skill(2), planning: skill(-2) },
    aspiration: aspirations[i % aspirations.length],
  };
});

// ---------- Cross-cuts for charts ----------
export const dmMonthly = data.dmMonthly;
export const productMonthly = data.productMonthly;
export const mrMonthly = data.mrMonthly;
export const mrProduct = data.mrProduct;

// ---------- Events (template - customize as needed) ----------
export interface EventItem {
  id: string;
  date: string;
  title: string;
  location: string;
  type: "Conference" | "Meeting" | "Double Visit" | "Training";
  time: string;
}
export const events: EventItem[] = [];

// ---------- Projects ----------
export interface Project {
  id: string;
  repId: string;
  title: string;
  description: string;
  progress: number;
  status: "Active" | "Completed" | "Delayed";
  dueDate: string;
}
export const projects: Project[] = [];

export const skillTrend = [
  { period: "Q3", product: 64, selling: 60 },
  { period: "Q4", product: 70, selling: 66 },
  { period: "Q1", product: 76, selling: 72 },
  { period: "Q2", product: 80, selling: 76 },
];

// ---------- Lookups ----------
export const getRepById = (id: string) => reps.find((r) => r.id === id);
export const getDMById = (id: string) => dms.find((d) => d.id === id);
export const getDMByName = (name: string) =>
  dms.find((d) => d.name === name) ?? findLooseMatch(name, dms, (d) => d.name);
export const getRepsByDM = (dmName: string) =>
  reps.filter((r) => r.dm === dmName || looseNameMatch(r.dm, dmName));
export const getMonthlyForDM = (dmName: string) =>
  data.dmMonthly
    .filter((m) => m.dm === dmName || looseNameMatch(m.dm, dmName))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
export const getMonthlyForRep = (repName: string) => {
  const rows = data.mrMonthly.filter(
    (m) => m.mr === repName || looseNameMatch(m.mr, repName),
  );
  const agg = new Map<string, { month: string; sales: number; target: number; mr: string }>();
  for (const r of rows) {
    const cur = agg.get(r.month);
    if (cur) {
      cur.sales += r.sales;
      cur.target += r.target;
    } else {
      agg.set(r.month, { month: r.month, sales: r.sales, target: r.target, mr: r.mr });
    }
  }
  return Array.from(agg.values()).sort((a, b) => (a.month < b.month ? -1 : 1));
};
export const getProductsForRep = (repName: string) => {
  const rows = data.mrProduct.filter(
    (p) => p.mr === repName || looseNameMatch(p.mr, repName),
  );
  const agg = new Map<string, { product: string; sales: number; target: number; mr: string }>();
  for (const r of rows) {
    const cur = agg.get(r.product);
    if (cur) {
      cur.sales += r.sales;
      cur.target += r.target;
    } else {
      agg.set(r.product, { product: r.product, sales: r.sales, target: r.target, mr: r.mr });
    }
  }
  return Array.from(agg.values());
};

export const findRepByLooseName = (name: string) =>
  findLooseMatch(name, reps, (r) => r.name);
export const findDMByLooseName = (name: string) =>
  findLooseMatch(name, dms, (d) => d.name);

// ---------- Products lookups ----------
export const productSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const getProductBySlug = (slug: string) =>
  products.find((p) => productSlug(p.name) === slug);
export const getMonthlyForProduct = (productName: string) =>
  data.productMonthly.filter((m) => m.product === productName).sort((a, b) => (a.month < b.month ? -1 : 1));
export const getRepsForProduct = (productName: string) =>
  data.mrProduct.filter((p) => p.product === productName);
