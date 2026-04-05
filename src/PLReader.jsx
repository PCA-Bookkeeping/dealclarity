// ═══════════════════════════════════════════════════════════════
// DealClarity – P&L Reader (Phase 3.5)
// Upload CSV/XLSX → auto-categorize → per-property breakdown → insights
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";
import {
  FileText, Upload, DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Download, Trash2, ChevronDown, ChevronUp, Building2, Lock, ArrowUpRight, ArrowDownRight,
  PiggyBank, Percent, Eye, EyeOff, Filter,
} from "lucide-react";
import * as XLSX from "xlsx";

const B = {
  pri: "#0F1A2E", priL: "#1B2D4A", acc: "#2A4066", accL: "#5A82AD",
  gold: "#C9A54C", goldL: "#F5E6C8", goldD: "#8B7025",
  red: "#DC2626", redL: "#FEE2E2", grn: "#16A34A", grnL: "#DCFCE7",
  blue: "#2563EB", blueL: "#DBEAFE", purple: "#7C3AED",
  bg: "#F7F8FA", card: "#FFFFFF", txt: "#1A1A1A", mut: "#6B7280", brd: "#E0E3EA",
};
const PIE_C = [B.pri, B.acc, B.gold, B.blue, B.red, B.purple, "#EA580C", "#0D9488", "#BE185D", B.grn];
const fmt = (n) => n == null || isNaN(n) ? "$0" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fp = (n) => n == null || isNaN(n) ? "0%" : `${n.toFixed(1)}%`;

// ── Category engine ──
const CATEGORIES = {
  revenue: { label: "Revenue", color: B.grn, keywords: ["rent", "income", "revenue", "lease", "tenant", "collected", "late fee", "application fee", "pet fee", "parking", "laundry", "storage fee", "utility reimburse", "other income", "deposit forfeit"] },
  mortgage: { label: "Mortgage / Debt Service", color: B.pri, keywords: ["mortgage", "loan", "principal", "interest", "debt service", "note payable", "heloc", "line of credit"] },
  taxes: { label: "Taxes & Insurance", color: B.red, keywords: ["tax", "property tax", "insurance", "hazard", "liability", "flood insurance", "umbrella"] },
  repairs: { label: "Repairs & Maintenance", color: "#EA580C", keywords: ["repair", "maintenance", "plumbing", "electrical", "hvac", "roof", "appliance", "landscap", "snow", "pest", "cleaning", "turnover", "make ready", "paint"] },
  management: { label: "Property Management", color: B.purple, keywords: ["management", "manager", "leasing", "property mgmt", "pm fee", "eviction", "legal", "attorney", "court"] },
  utilities: { label: "Utilities", color: B.blue, keywords: ["utility", "utilities", "water", "sewer", "electric", "gas", "trash", "internet", "cable", "phone"] },
  capex: { label: "Capital Expenditures", color: B.gold, keywords: ["capital", "capex", "improvement", "renovation", "remodel", "addition", "new roof", "new hvac", "flooring", "replacement"] },
  admin: { label: "Administrative / Other", color: B.mut, keywords: ["admin", "office", "software", "bookkeeping", "accounting", "travel", "mileage", "advertising", "marketing", "misc", "bank fee", "license", "permit", "hoa", "association", "dues"] },
};

function categorize(desc) {
  if (!desc) return "admin";
  const lower = desc.toLowerCase();
  for (const [cat, def] of Object.entries(CATEGORIES)) {
    if (def.keywords.some(kw => lower.includes(kw))) return cat;
  }
  return "admin";
}

function parseAmount(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const str = String(val).replace(/[$,\s]/g, "").replace(/\((.+)\)/, "-$1");
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

// ── Smart column detection ──
function detectColumns(headers) {
  const lower = headers.map(h => (h || "").toString().toLowerCase().trim());
  let desc = lower.findIndex(h => ["description", "desc", "memo", "category", "account", "line item", "item", "name", "type", "detail"].some(k => h.includes(k)));
  let amount = lower.findIndex(h => ["amount", "total", "balance", "value", "sum", "net"].some(k => h.includes(k)));
  let credit = lower.findIndex(h => ["credit", "income", "deposit", "receipts", "inflow"].some(k => h.includes(k)));
  let debit = lower.findIndex(h => ["debit", "expense", "payment", "withdrawal", "outflow", "cost"].some(k => h.includes(k)));
  let date = lower.findIndex(h => ["date", "period", "month", "quarter"].some(k => h.includes(k)));
  let property = lower.findIndex(h => ["property", "address", "unit", "building", "location", "project"].some(k => h.includes(k)));

  if (desc === -1) desc = 0;
  if (amount === -1 && credit === -1 && debit === -1) amount = lower.length > 1 ? lower.length - 1 : 1;

  return { desc, amount, credit, debit, date, property };
}

// ── Main component ──
export default function PLReader({ isPro, setShowPro }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [overrides, setOverrides] = useState({}); // { rowIdx: categoryKey }
  const [showTable, setShowTable] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [filterProp, setFilterProp] = useState("all");
  const [expandedInsight, setExpandedInsight] = useState(null);
  const fileRef = useRef(null);

  // Pro gate
  if (!isPro) return (
    <div className="text-center py-16">
      <Lock size={48} style={{ color: B.brd, margin: "0 auto 12px" }} />
      <h3 className="text-lg font-bold mb-2">P&L Reader is a Pro Feature</h3>
      <p className="text-sm mb-4" style={{ color: B.mut }}>Upload any P&L, bank statement, or income/expense report. DealClarity auto-categorizes every line item and shows you exactly where your money goes.</p>
      <button onClick={() => setShowPro(true)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ background: B.gold }}>Upgrade to Pro</button>
    </div>
  );

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setOverrides({});

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let parsed = [];
        if (file.name.endsWith(".csv") || file.name.endsWith(".tsv")) {
          // CSV/TSV parsing
          const text = evt.target.result;
          const delim = file.name.endsWith(".tsv") ? "\t" : ",";
          const lines = text.split(/\r?\n/).filter(l => l.trim());
          if (lines.length < 2) return;
          const headers = lines[0].split(delim).map(h => h.replace(/^"|"$/g, "").trim());
          const cols = detectColumns(headers);
          for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(delim).map(v => v.replace(/^"|"$/g, "").trim());
            const desc = vals[cols.desc] || "";
            let amount = 0;
            if (cols.credit >= 0 && cols.debit >= 0) {
              const cr = parseAmount(vals[cols.credit]);
              const db = parseAmount(vals[cols.debit]);
              amount = cr > 0 ? cr : -Math.abs(db);
            } else {
              amount = parseAmount(vals[cols.amount]);
            }
            if (amount === 0 && !desc) continue;
            parsed.push({
              desc,
              amount,
              category: categorize(desc),
              date: cols.date >= 0 ? vals[cols.date] || "" : "",
              property: cols.property >= 0 ? vals[cols.property] || "" : "",
              raw: vals,
            });
          }
        } else {
          // XLSX parsing
          const data = new Uint8Array(evt.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          if (json.length < 2) return;
          const headers = json[0].map(h => String(h));
          const cols = detectColumns(headers);
          for (let i = 1; i < json.length; i++) {
            const vals = json[i];
            const desc = String(vals[cols.desc] || "");
            let amount = 0;
            if (cols.credit >= 0 && cols.debit >= 0) {
              const cr = parseAmount(vals[cols.credit]);
              const db = parseAmount(vals[cols.debit]);
              amount = cr > 0 ? cr : -Math.abs(db);
            } else {
              amount = parseAmount(vals[cols.amount]);
            }
            if (amount === 0 && !desc) continue;
            parsed.push({
              desc,
              amount,
              category: categorize(desc),
              date: cols.date >= 0 ? String(vals[cols.date] || "") : "",
              property: cols.property >= 0 ? String(vals[cols.property] || "") : "",
              raw: vals.map(v => String(v)),
            });
          }
        }
        setRows(parsed);
      } catch (err) {
        console.error("P&L parse error:", err);
        alert("Could not parse this file. Please check the format and try again.");
      }
    };
    if (file.name.endsWith(".csv") || file.name.endsWith(".tsv")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }, []);

  // Apply overrides
  const data = useMemo(() => rows.map((r, i) => ({
    ...r,
    category: overrides[i] || r.category,
  })), [rows, overrides]);

  // Filters
  const properties = useMemo(() => [...new Set(data.map(r => r.property).filter(Boolean))], [data]);
  const filtered = useMemo(() => {
    let d = data;
    if (filterCat !== "all") d = d.filter(r => r.category === filterCat);
    if (filterProp !== "all") d = d.filter(r => r.property === filterProp);
    return d;
  }, [data, filterCat, filterProp]);

  // Metrics
  const totalRevenue = useMemo(() => filtered.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0), [filtered]);
  const totalExpenses = useMemo(() => filtered.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0), [filtered]);
  const netIncome = totalRevenue - totalExpenses;
  const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

  // Category breakdown
  const catBreakdown = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      const cat = r.category;
      if (!map[cat]) map[cat] = { revenue: 0, expenses: 0, count: 0 };
      if (r.amount > 0) map[cat].revenue += r.amount;
      else map[cat].expenses += Math.abs(r.amount);
      map[cat].count++;
    });
    return Object.entries(map)
      .map(([key, val]) => ({ key, ...CATEGORIES[key], ...val, total: val.revenue - val.expenses }))
      .sort((a, b) => b.expenses - a.expenses);
  }, [filtered]);

  // Property breakdown
  const propBreakdown = useMemo(() => {
    if (properties.length === 0) return [];
    const map = {};
    data.forEach(r => {
      const prop = r.property || "Unassigned";
      if (!map[prop]) map[prop] = { revenue: 0, expenses: 0, count: 0 };
      if (r.amount > 0) map[prop].revenue += r.amount;
      else map[prop].expenses += Math.abs(r.amount);
      map[prop].count++;
    });
    return Object.entries(map)
      .map(([name, val]) => ({ name, ...val, net: val.revenue - val.expenses, margin: val.revenue > 0 ? ((val.revenue - val.expenses) / val.revenue * 100) : 0 }))
      .sort((a, b) => b.net - a.net);
  }, [data, properties]);

  // Pie data
  const pieData = useMemo(() =>
    catBreakdown.filter(c => c.expenses > 0).map(c => ({ name: c.label, value: c.expenses })),
  [catBreakdown]);

  // Monthly trend (if dates available)
  const monthlyTrend = useMemo(() => {
    const withDates = filtered.filter(r => r.date);
    if (withDates.length === 0) return [];
    const map = {};
    withDates.forEach(r => {
      let month = "";
      // Try to extract month from various date formats
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) {
        month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      } else {
        // Try MM/YYYY or similar
        const m = r.date.match(/(\d{1,2})[\/\-](\d{4})/);
        if (m) month = `${m[2]}-${m[1].padStart(2, "0")}`;
        else return;
      }
      if (!map[month]) map[month] = { month, revenue: 0, expenses: 0 };
      if (r.amount > 0) map[month].revenue += r.amount;
      else map[month].expenses += Math.abs(r.amount);
    });
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({ ...m, net: m.revenue - m.expenses }));
  }, [filtered]);

  // Insights
  const insights = useMemo(() => {
    const ins = [];
    // Expense ratio check
    if (expenseRatio > 60) ins.push({ type: "warning", title: "High Expense Ratio", detail: `Your expenses are ${expenseRatio.toFixed(0)}% of revenue. Most healthy RE portfolios run 40-55%. Look at your top expense categories to find where you're leaking cash.` });
    else if (expenseRatio > 0 && expenseRatio <= 45) ins.push({ type: "success", title: "Strong Expense Control", detail: `Your expense ratio is ${expenseRatio.toFixed(0)}%. That's tight operations. You're keeping more of every dollar collected.` });

    // Biggest expense
    const topExp = catBreakdown.filter(c => c.key !== "revenue" && c.key !== "mortgage").sort((a, b) => b.expenses - a.expenses)[0];
    if (topExp && topExp.expenses > 0) {
      const pct = totalExpenses > 0 ? (topExp.expenses / totalExpenses * 100).toFixed(0) : 0;
      ins.push({ type: "info", title: `Top Expense: ${topExp.label}`, detail: `${topExp.label} accounts for ${pct}% of your total expenses (${fmt(topExp.expenses)}). ${topExp.key === "repairs" ? "Consider a preventive maintenance schedule to reduce reactive repairs." : topExp.key === "management" ? "Benchmark your PM fee against local rates. Self-managing could save you this entire line item." : "Review line items in this category for optimization opportunities."}` });
    }

    // Net income check
    if (netIncome < 0) ins.push({ type: "danger", title: "Negative Net Income", detail: `You're losing ${fmt(Math.abs(netIncome))} on this P&L. This needs immediate attention. Either revenue is too low or expenses need aggressive trimming.` });

    // Property insights
    const negProps = propBreakdown.filter(p => p.net < 0);
    if (negProps.length > 0) ins.push({ type: "warning", title: `${negProps.length} Property${negProps.length > 1 ? "ies" : ""} Losing Money`, detail: `${negProps.map(p => `${p.name} (${fmt(p.net)})`).join(", ")}. Evaluate whether to raise rents, reduce expenses, or consider selling.` });

    // Cap rate estimate (if we have enough data)
    if (totalRevenue > 0 && netIncome > 0) {
      ins.push({ type: "info", title: "NOI Margin", detail: `Your NOI margin is ${((netIncome / totalRevenue) * 100).toFixed(1)}%. Anything above 40% on a rental portfolio is strong. Below 30% means your expenses are eating too much of your gross.` });
    }

    return ins;
  }, [catBreakdown, propBreakdown, expenseRatio, netIncome, totalRevenue, totalExpenses]);

  // ── Empty state ──
  if (rows.length === 0) return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <FileText size={48} style={{ color: B.gold, margin: "0 auto 12px" }} />
        <h3 className="text-lg font-bold mb-2">P&L Reader</h3>
        <p className="text-sm mb-6" style={{ color: B.mut }}>
          Upload any P&L statement, income/expense report, or bank statement.
          DealClarity auto-categorizes every line item and shows you exactly where your money goes.
        </p>
        <div
          onClick={() => fileRef.current?.click()}
          className="mx-auto p-8 rounded-2xl border-2 border-dashed cursor-pointer hover:opacity-80"
          style={{ borderColor: B.gold, background: B.goldL, maxWidth: 400 }}
        >
          <Upload size={32} style={{ color: B.gold, margin: "0 auto 8px" }} />
          <p className="text-sm font-semibold" style={{ color: B.pri }}>Drop CSV or XLSX here</p>
          <p className="text-xs mt-1" style={{ color: B.mut }}>Supports QuickBooks, Stessa, Buildium, AppFolio exports</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls" onChange={handleFile} className="hidden" />
      </div>

      {/* Sample format guide */}
      <div className="p-4 rounded-xl" style={{ background: B.bg, border: `1px solid ${B.brd}` }}>
        <h4 className="text-sm font-bold mb-2">Supported Formats</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs" style={{ color: B.mut }}>
          <div>
            <p className="font-semibold mb-1" style={{ color: B.txt }}>Minimum columns:</p>
            <p>Description + Amount (or Credit/Debit)</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: B.txt }}>Optional columns:</p>
            <p>Date, Property/Address, Category</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Loaded state ──
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold">{fileName}</h3>
          <p className="text-xs" style={{ color: B.mut }}>{data.length} line items | {properties.length > 0 ? `${properties.length} properties` : "No property column detected"}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setRows([]); setFileName(""); setOverrides({}); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80" style={{ background: B.redL, color: B.red }}>
            <Trash2 size={12} /> Clear
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-80" style={{ background: B.grnL, color: B.grn }}>
            <Upload size={12} /> New File
          </button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls" onChange={handleFile} className="hidden" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Revenue", value: fmt(totalRevenue), icon: TrendingUp, color: B.grn, bg: B.grnL },
          { label: "Total Expenses", value: fmt(totalExpenses), icon: TrendingDown, color: B.red, bg: B.redL },
          { label: "Net Income", value: fmt(netIncome), icon: DollarSign, color: netIncome >= 0 ? B.grn : B.red, bg: netIncome >= 0 ? B.grnL : B.redL },
          { label: "Expense Ratio", value: fp(expenseRatio), icon: Percent, color: expenseRatio > 55 ? B.red : B.grn, bg: expenseRatio > 55 ? B.redL : B.grnL },
        ].map((kpi, i) => (
          <div key={i} className="p-3 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon size={14} style={{ color: kpi.color }} />
              <span className="text-xs" style={{ color: B.mut }}>{kpi.label}</span>
            </div>
            <span className="text-lg font-bold" style={{ color: kpi.color }}>{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-bold flex items-center gap-2"><AlertTriangle size={14} style={{ color: B.gold }} /> Insights</h4>
          {insights.map((ins, i) => {
            const colors = { warning: { bg: B.goldL, border: B.gold, text: B.goldD }, danger: { bg: B.redL, border: B.red, text: B.red }, success: { bg: B.grnL, border: B.grn, text: B.grn }, info: { bg: B.blueL, border: B.blue, text: B.blue } };
            const c = colors[ins.type] || colors.info;
            return (
              <div key={i} className="p-3 rounded-xl cursor-pointer" onClick={() => setExpandedInsight(expandedInsight === i ? null : i)}
                style={{ background: c.bg, border: `1px solid ${c.border}22` }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: c.text }}>{ins.title}</span>
                  {expandedInsight === i ? <ChevronUp size={14} style={{ color: c.text }} /> : <ChevronDown size={14} style={{ color: c.text }} />}
                </div>
                {expandedInsight === i && <p className="text-xs mt-2" style={{ color: B.txt }}>{ins.detail}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Category breakdown + Pie chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category table */}
        <div className="p-4 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
          <h4 className="text-sm font-bold mb-3">Expense Breakdown</h4>
          <div className="space-y-2">
            {catBreakdown.map((cat, i) => {
              const pct = totalExpenses > 0 ? (cat.expenses / totalExpenses * 100) : 0;
              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium" style={{ color: B.txt }}>{cat.label}</span>
                    <span style={{ color: B.mut }}>{fmt(cat.expenses)} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full" style={{ background: B.bg }}>
                    <div className="h-2 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: cat.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Pie */}
        <div className="p-4 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
          <h4 className="text-sm font-bold mb-3">Expense Distribution</h4>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_C[i % PIE_C.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-center py-8" style={{ color: B.mut }}>No expense data to display</p>}
        </div>
      </div>

      {/* Property breakdown (if properties exist) */}
      {propBreakdown.length > 1 && (
        <div className="p-4 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
          <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Building2 size={14} /> Per-Property Breakdown</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: B.bg }}>
                  <th className="p-2 text-left font-medium" style={{ color: B.mut }}>Property</th>
                  <th className="p-2 text-right font-medium" style={{ color: B.mut }}>Revenue</th>
                  <th className="p-2 text-right font-medium" style={{ color: B.mut }}>Expenses</th>
                  <th className="p-2 text-right font-medium" style={{ color: B.mut }}>Net Income</th>
                  <th className="p-2 text-right font-medium" style={{ color: B.mut }}>Margin</th>
                </tr>
              </thead>
              <tbody>
                {propBreakdown.map((p, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${B.brd}` }}>
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2 text-right" style={{ color: B.grn }}>{fmt(p.revenue)}</td>
                    <td className="p-2 text-right" style={{ color: B.red }}>{fmt(p.expenses)}</td>
                    <td className="p-2 text-right font-bold" style={{ color: p.net >= 0 ? B.grn : B.red }}>
                      {fmt(p.net)} {p.net >= 0 ? <ArrowUpRight size={10} style={{ display: "inline" }} /> : <ArrowDownRight size={10} style={{ display: "inline" }} />}
                    </td>
                    <td className="p-2 text-right" style={{ color: p.margin >= 30 ? B.grn : B.red }}>{fp(p.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly trend */}
      {monthlyTrend.length > 1 && (
        <div className="p-4 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
          <h4 className="text-sm font-bold mb-3">Monthly Trend</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={monthlyTrend} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke={B.grn} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke={B.red} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="net" name="Net" stroke={B.gold} strokeWidth={2} dot={false} strokeDasharray="5 5" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Line items table */}
      <div className="p-4 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <button onClick={() => setShowTable(!showTable)} className="flex items-center gap-2 text-sm font-bold">
            {showTable ? <EyeOff size={14} /> : <Eye size={14} />} {showTable ? "Hide" : "Show"} Line Items ({filtered.length})
          </button>
          <div className="flex gap-2">
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="text-xs p-1.5 rounded-lg border" style={{ borderColor: B.brd }}>
              <option value="all">All Categories</option>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            {properties.length > 0 && (
              <select value={filterProp} onChange={e => setFilterProp(e.target.value)} className="text-xs p-1.5 rounded-lg border" style={{ borderColor: B.brd }}>
                <option value="all">All Properties</option>
                {properties.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>
        </div>
        {showTable && (
          <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: "auto" }}>
            <table className="w-full text-xs">
              <thead className="sticky" style={{ top: 0, background: B.bg, zIndex: 1 }}>
                <tr>
                  <th className="p-2 text-left font-medium" style={{ color: B.mut }}>Description</th>
                  <th className="p-2 text-right font-medium" style={{ color: B.mut }}>Amount</th>
                  <th className="p-2 text-left font-medium" style={{ color: B.mut }}>Category</th>
                  {properties.length > 0 && <th className="p-2 text-left font-medium" style={{ color: B.mut }}>Property</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const origIdx = data.indexOf(r);
                  return (
                    <tr key={i} style={{ borderTop: `1px solid ${B.brd}` }}>
                      <td className="p-2" style={{ maxWidth: 250 }}>{r.desc}</td>
                      <td className="p-2 text-right font-medium" style={{ color: r.amount >= 0 ? B.grn : B.red }}>{fmt(r.amount)}</td>
                      <td className="p-2">
                        <select value={r.category} onChange={e => setOverrides({ ...overrides, [origIdx]: e.target.value })}
                          className="text-xs p-1 rounded border" style={{ borderColor: B.brd, color: CATEGORIES[r.category]?.color || B.mut }}>
                          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      {properties.length > 0 && <td className="p-2 text-xs" style={{ color: B.mut }}>{r.property}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Book promo */}
      <div className="p-3 rounded-xl text-center" style={{ background: B.bg, border: `1px solid ${B.brd}` }}>
        <p className="text-xs" style={{ color: B.mut }}>
          Want to master reading P&Ls for real estate? Check out <a href="https://amazon.com" target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: B.gold }}>"The Books Don't Lie"</a> on Amazon.
        </p>
      </div>
    </div>
  );
}
