// ═══════════════════════════════════════════════════════════════
// DEALCLARITY — BUDGET PLANNER
// Modeled from Fabian's 60-hour Excel system
// Separate file — import into App.jsx, zero disruption
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  DollarSign, TrendingUp, PiggyBank, Plus, Trash2, ChevronDown,
  ChevronUp, BarChart3, List, LayoutDashboard, CreditCard,
  AlertTriangle, Check, ArrowUpRight, ArrowDownRight, Target,
  Calendar, Edit2, X, Save, Zap, Flame, ToggleLeft, ToggleRight,
  ArrowRight, Clock, Percent, Shield
} from "lucide-react";

// ── Brand (matches DealClarity)
const B = {
  pri: "#0F1A2E", priL: "#1B2D4A", acc: "#2A4066", accL: "#5A82AD",
  gold: "#C9A54C", goldL: "#F5E6C8", goldD: "#8B7025",
  red: "#DC2626", redL: "#FEE2E2", grn: "#16A34A", grnL: "#DCFCE7",
  blue: "#2563EB", blueL: "#DBEAFE",
  bg: "#F7F8FA", card: "#FFFFFF", txt: "#1A1A1A", mut: "#6B7280", brd: "#E0E3EA",
};
const PIE_C = [B.pri, B.acc, B.gold, "#EA580C", "#0D9488", "#7C3AED", "#BE185D", B.blue, "#16A34A", "#DC2626"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = (n) => n == null || isNaN(n) ? "$0" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fp = (n) => n == null || isNaN(n) ? "0%" : `${(+n).toFixed(1)}%`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Default budget categories (mirrors your Excel)
const DEFAULT_INCOME = [
  { id: "i1", name: "Employment (Net)", amounts: Array(12).fill(0) },
  { id: "i2", name: "Side Hustle (Net)", amounts: Array(12).fill(0) },
  { id: "i3", name: "Business Income", amounts: Array(12).fill(0) },
  { id: "i4", name: "Other Income", amounts: Array(12).fill(0) },
];
const DEFAULT_EXPENSES = [
  { id: "e1", name: "Housing / Rent", amounts: Array(12).fill(0) },
  { id: "e2", name: "Utilities", amounts: Array(12).fill(0) },
  { id: "e3", name: "Groceries", amounts: Array(12).fill(0) },
  { id: "e4", name: "Transportation", amounts: Array(12).fill(0) },
  { id: "e5", name: "Clothing", amounts: Array(12).fill(0) },
  { id: "e6", name: "Body Care & Medicine", amounts: Array(12).fill(0) },
  { id: "e7", name: "Media & Subscriptions", amounts: Array(12).fill(0) },
  { id: "e8", name: "Fun & Vacation", amounts: Array(12).fill(0) },
  { id: "e9", name: "Eating Out / Delivery", amounts: Array(12).fill(0) },
  { id: "e10", name: "Insurances", amounts: Array(12).fill(0) },
  { id: "e11", name: "Debts", amounts: Array(12).fill(0) },
];
const DEFAULT_SAVINGS = [
  { id: "s1", name: "Emergency Fund", amounts: Array(12).fill(0) },
  { id: "s2", name: "Investments / Stocks", amounts: Array(12).fill(0) },
  { id: "s3", name: "Travel Fund", amounts: Array(12).fill(0) },
  { id: "s4", name: "Other Savings", amounts: Array(12).fill(0) },
];

// ── Shared UI
const Card = ({ children, style }) => (
  <div className="rounded-xl border" style={{ background: B.card, borderColor: B.brd, ...style }}>{children}</div>
);
const KPI = ({ icon: I, label, value, sub, color, bg, trend }) => (
  <div className="rounded-xl p-4 border" style={{ borderColor: B.brd, background: bg || B.card }}>
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-2">
        <I size={15} style={{ color: color || B.acc }} />
        <span className="text-xs font-medium" style={{ color: B.mut }}>{label}</span>
      </div>
      {trend != null && (
        trend >= 0
          ? <ArrowUpRight size={14} style={{ color: B.grn }} />
          : <ArrowDownRight size={14} style={{ color: B.red }} />
      )}
    </div>
    <div className="text-xl font-bold" style={{ color: color || B.txt }}>{value}</div>
    {sub && <div className="text-xs mt-0.5" style={{ color: B.mut }}>{sub}</div>}
  </div>
);

// ── Budget Section (module-level to avoid focus-loss on re-render)
const sumRow = (amounts) => amounts.reduce((a, b) => a + (b || 0), 0);

function BudgetSection({ title, section, rows, totals, color, bgColor, icon: Icon,
  editingId, editName, setEditingId, setEditName, activeSection, setActiveSection,
  updateName, updateAmount, removeRow, addRow }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: B.brd }}>
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ background: bgColor }}
        onClick={() => setActiveSection(p => ({ ...p, [section]: !p[section] }))}>
        <div className="flex items-center gap-2">
          <Icon size={16} style={{ color }} />
          <span className="font-semibold text-sm" style={{ color }}>{title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: color, color: "#fff" }}>
            {fmt(sumRow(totals))}
          </span>
        </div>
        {activeSection[section] ? <ChevronUp size={15} style={{ color: B.mut }} /> : <ChevronDown size={15} style={{ color: B.mut }} />}
      </div>
      {activeSection[section] && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#F9FAFB", borderBottom: `1px solid ${B.brd}` }}>
                <th className="sticky left-0 p-2 text-left font-semibold w-36" style={{ background: "#F9FAFB", color: B.mut }}>Category</th>
                {MONTHS.map(m => <th key={m} className="p-2 text-right font-semibold" style={{ color: B.mut, minWidth: 72 }}>{m}</th>)}
                <th className="p-2 text-right font-bold" style={{ color: B.pri, minWidth: 80 }}>Total</th>
                <th className="p-2 text-right font-semibold" style={{ color: B.mut, minWidth: 72 }}>Monthly Avg</th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={row.id} style={{ borderBottom: `1px solid ${B.brd}`, background: ri % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                  <td className="sticky left-0 p-2" style={{ background: ri % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                    {editingId === row.id ? (
                      <div className="flex gap-1">
                        <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") updateName(section, row.id, editName); if (e.key === "Escape") setEditingId(null); }}
                          className="text-xs border rounded px-2 py-1 outline-none flex-1" style={{ borderColor: B.gold }} />
                        <button onClick={() => updateName(section, row.id, editName)} className="p-1 rounded" style={{ background: B.grnL }}><Check size={12} style={{ color: B.grn }} /></button>
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 group cursor-pointer font-medium" style={{ color: B.txt }}
                        onClick={() => { setEditingId(row.id); setEditName(row.name); }}>
                        {row.name}
                        <Edit2 size={10} className="opacity-0 group-hover:opacity-50" />
                      </span>
                    )}
                  </td>
                  {row.amounts.map((amt, mi) => (
                    <td key={mi} className="p-1 text-right">
                      <input type="number" value={amt || ""} placeholder="0"
                        onChange={e => updateAmount(section, row.id, mi, e.target.value)}
                        className="w-full text-right text-xs px-1 py-1 rounded border outline-none"
                        style={{ borderColor: "transparent", background: "transparent", color: amt > 0 ? B.txt : B.mut }}
                        onFocus={e => e.target.style.borderColor = B.gold}
                        onBlur={e => e.target.style.borderColor = "transparent"} />
                    </td>
                  ))}
                  <td className="p-2 text-right font-bold" style={{ color }}>
                    {fmt(sumRow(row.amounts))}
                  </td>
                  <td className="p-2 text-right" style={{ color: B.mut }}>
                    {fmt(sumRow(row.amounts) / 12)}
                  </td>
                  <td className="p-2">
                    <button onClick={() => removeRow(section, row.id)} className="p-1 rounded hover:bg-red-50 opacity-40 hover:opacity-100 transition-all">
                      <Trash2 size={11} style={{ color: B.red }} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr style={{ background: bgColor, borderTop: `2px solid ${color}` }}>
                <td className="sticky left-0 p-2 font-bold text-xs" style={{ background: bgColor, color }}>TOTAL</td>
                {totals.map((t, i) => <td key={i} className="p-2 text-right font-bold text-xs" style={{ color }}>{fmt(t)}</td>)}
                <td className="p-2 text-right font-bold text-xs" style={{ color }}>{fmt(sumRow(totals))}</td>
                <td className="p-2 text-right text-xs" style={{ color }}>{fmt(sumRow(totals) / 12)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <div className="px-4 py-2" style={{ borderTop: `1px solid ${B.brd}` }}>
            <button onClick={() => addRow(section)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ background: bgColor, color, border: `1px solid ${color}` }}>
              <Plus size={12} /> Add Category
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: BUDGET PLAN
// ═══════════════════════════════════════════════════════════════
function BudgetPlanTab({ data, setData, year, setYear }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [activeSection, setActiveSection] = useState({ income: true, expenses: true, savings: true });

  const sumCol = (rows, mo) => rows.reduce((a, r) => a + (r.amounts[mo] || 0), 0);
  const totalIncome = MONTHS.map((_, i) => sumCol(data.income, i));
  const totalExpenses = MONTHS.map((_, i) => sumCol(data.expenses, i));
  const totalSavings = MONTHS.map((_, i) => sumCol(data.savings, i));
  const toAllocate = MONTHS.map((_, i) => totalIncome[i] - totalExpenses[i] - totalSavings[i]);

  const addRow = (section) => {
    const newRow = { id: uid(), name: "New Category", amounts: Array(12).fill(0) };
    setData(p => ({ ...p, [section]: [...p[section], newRow] }));
  };
  const removeRow = (section, id) => setData(p => ({ ...p, [section]: p[section].filter(r => r.id !== id) }));
  const updateAmount = (section, id, mo, val) => {
    setData(p => ({ ...p, [section]: p[section].map(r => r.id === id ? { ...r, amounts: r.amounts.map((a, i) => i === mo ? (parseFloat(val) || 0) : a) } : r) }));
  };
  const updateName = (section, id, name) => {
    setData(p => ({ ...p, [section]: p[section].map(r => r.id === id ? { ...r, name } : r) }));
    setEditingId(null);
  };

  const sectionProps = { editingId, editName, setEditingId, setEditName, activeSection, setActiveSection, updateName, updateAmount, removeRow, addRow };

  return (
    <div className="space-y-4">
      {/* Year selector + summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium" style={{ color: B.mut }}>Planning Year:</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border text-sm font-semibold" style={{ borderColor: B.brd, color: B.pri }}>
            {[2024,2025,2026,2027,2028,2029,2030,2031,2032,2033,2034,2035,2036].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="px-3 py-1 rounded-full font-semibold" style={{ background: B.grnL, color: B.grn }}>
            Income: {fmt(sumRow(totalIncome))}
          </span>
          <span className="px-3 py-1 rounded-full font-semibold" style={{ background: B.redL, color: B.red }}>
            Expenses: {fmt(sumRow(totalExpenses))}
          </span>
          <span className="px-3 py-1 rounded-full font-semibold" style={{ background: B.blueL, color: B.blue }}>
            Savings: {fmt(sumRow(totalSavings))}
          </span>
        </div>
      </div>

      {/* To Allocate banner */}
      {(() => {
        const total = toAllocate.reduce((a, b) => a + b, 0);
        const good = total >= 0;
        return (
          <div className="rounded-xl p-3 flex items-center justify-between flex-wrap gap-2" style={{ background: good ? B.grnL : "#FFF1F1", border: `1.5px solid ${good ? B.grn : B.red}` }}>
            <div className="flex items-center gap-2">
              {good ? <Check size={16} style={{ color: B.grn }} /> : <AlertTriangle size={16} style={{ color: B.red }} />}
              <span className="text-sm font-semibold" style={{ color: good ? B.grn : B.red }}>
                {good ? "Budget balanced — " : "Budget deficit — "}
                <span className="font-bold">{fmt(Math.abs(total))}</span>
                {good ? " unallocated for the year" : " overspent vs income"}
              </span>
            </div>
            <div className="flex gap-2">
              {MONTHS.map((m, i) => (
                <div key={m} className="text-center">
                  <div className="text-xs" style={{ color: B.mut }}>{m}</div>
                  <div className="text-xs font-bold" style={{ color: toAllocate[i] >= 0 ? B.grn : B.red }}>
                    {toAllocate[i] >= 0 ? "+" : ""}{Math.round(toAllocate[i] / 100) * 100 === 0 ? "0" : Math.abs(toAllocate[i]) >= 1000 ? `${(toAllocate[i]/1000).toFixed(0)}k` : Math.round(toAllocate[i])}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <BudgetSection title="Income" section="income" rows={data.income} totals={totalIncome} color={B.grn} bgColor={B.grnL} icon={TrendingUp} {...sectionProps} />
      <BudgetSection title="Expenses" section="expenses" rows={data.expenses} totals={totalExpenses} color={B.red} bgColor={B.redL} icon={DollarSign} {...sectionProps} />
      <BudgetSection title="Savings & Investments" section="savings" rows={data.savings} totals={totalSavings} color={B.blue} bgColor={B.blueL} icon={PiggyBank} {...sectionProps} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: TRANSACTION TRACKER
// ═══════════════════════════════════════════════════════════════
function TransactionTab({ transactions, setTransactions, budgetData }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), type: "Income", category: "", amount: "", notes: "" });
  const [filterType, setFilterType] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All");
  const [showForm, setShowForm] = useState(false);

  const allCategories = useMemo(() => {
    const inc = budgetData.income.map(r => r.name);
    const exp = budgetData.expenses.map(r => r.name);
    const sav = budgetData.savings.map(r => r.name);
    if (form.type === "Income") return inc;
    if (form.type === "Expenses") return exp;
    if (form.type === "Savings") return sav;
    return [...inc, ...exp, ...sav];
  }, [form.type, budgetData]);

  const addTransaction = () => {
    if (!form.amount || !form.category) return;
    const amt = parseFloat(form.amount);
    const prev = transactions.length > 0 ? transactions[0].balance : 0;
    const balance = form.type === "Income" ? prev + amt : prev - amt;
    const tx = { id: uid(), ...form, amount: amt, balance, createdAt: Date.now() };
    const next = [tx, ...transactions];
    setTransactions(next);
    setForm(p => ({ ...p, amount: "", notes: "", category: "" }));
    setShowForm(false);
  };

  const filtered = transactions.filter(tx => {
    if (filterType !== "All" && tx.type !== filterType) return false;
    if (filterMonth !== "All" && !tx.date.startsWith(filterMonth)) return false;
    return true;
  });

  const monthOptions = [...new Set(transactions.map(tx => tx.date.slice(0, 7)))].sort().reverse();

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Income", val: transactions.filter(t => t.type === "Income").reduce((a, t) => a + t.amount, 0), color: B.grn, icon: TrendingUp },
          { label: "Total Expenses", val: transactions.filter(t => t.type === "Expenses").reduce((a, t) => a + t.amount, 0), color: B.red, icon: DollarSign },
          { label: "Total Saved", val: transactions.filter(t => t.type === "Savings").reduce((a, t) => a + t.amount, 0), color: B.blue, icon: PiggyBank },
          { label: "Transactions", val: transactions.length, color: B.pri, icon: List, isCount: true },
        ].map(s => (
          <KPI key={s.label} icon={s.icon} label={s.label} value={s.isCount ? s.val : fmt(s.val)} color={s.color} />
        ))}
      </div>

      {/* Add transaction */}
      <Card>
        <div className="px-4 py-3 flex items-center justify-between cursor-pointer"
          style={{ background: "#F9FAFB", borderBottom: showForm ? `1px solid ${B.brd}` : "none" }}
          onClick={() => setShowForm(p => !p)}>
          <div className="flex items-center gap-2">
            <Plus size={16} style={{ color: B.gold }} />
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Add Transaction</span>
          </div>
          {showForm ? <ChevronUp size={15} style={{ color: B.mut }} /> : <ChevronDown size={15} style={{ color: B.mut }} />}
        </div>
        {showForm && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value, category: "" }))}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: B.brd }}>
                {["Income", "Expenses", "Savings"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: B.brd }}>
                <option value="">Select...</option>
                {allCategories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>Amount ($)</label>
              <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd }} />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>Notes (optional)</label>
              <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="e.g. Salary December..." className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd }} />
            </div>
            <div className="md:col-span-3 flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: B.mut }}>Cancel</button>
              <button onClick={addTransaction} disabled={!form.amount || !form.category}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: B.pri }}>
                Add Transaction
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["All", "Income", "Expenses", "Savings"].map(f => (
          <button key={f} onClick={() => setFilterType(f)}
            className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: filterType === f ? B.pri : "#F3F4F6", color: filterType === f ? "#fff" : B.mut }}>
            {f}
          </button>
        ))}
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="px-3 py-1.5 rounded-full text-xs border ml-auto" style={{ borderColor: B.brd }}>
          <option value="All">All Months</option>
          {monthOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Transaction list */}
      <Card>
        {filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: B.mut }}>
            <List size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
            <p className="text-sm">No transactions yet. Add your first one above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: `1px solid ${B.brd}` }}>
                  {["Date","Type","Category","Amount","Notes","Balance",""].map(h => (
                    <th key={h} className="p-3 text-left font-semibold" style={{ color: B.mut }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => (
                  <tr key={tx.id} style={{ borderBottom: `1px solid ${B.brd}`, background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                    <td className="p-3" style={{ color: B.mut }}>{tx.date}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: tx.type === "Income" ? B.grnL : tx.type === "Expenses" ? B.redL : B.blueL, color: tx.type === "Income" ? B.grn : tx.type === "Expenses" ? B.red : B.blue }}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-3 font-medium" style={{ color: B.txt }}>{tx.category}</td>
                    <td className="p-3 font-bold" style={{ color: tx.type === "Income" ? B.grn : B.red }}>
                      {tx.type === "Income" ? "+" : "-"}{fmt(tx.amount)}
                    </td>
                    <td className="p-3" style={{ color: B.mut }}>{tx.notes || "—"}</td>
                    <td className="p-3 font-semibold" style={{ color: tx.balance >= 0 ? B.pri : B.red }}>{fmt(tx.balance)}</td>
                    <td className="p-3">
                      <button onClick={() => setTransactions(p => p.filter(t => t.id !== tx.id))}
                        className="p-1 rounded hover:bg-red-50 opacity-40 hover:opacity-100">
                        <Trash2 size={11} style={{ color: B.red }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: DASHBOARD
// ═══════════════════════════════════════════════════════════════
function DashboardTab({ budgetData, transactions, year }) {
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  const monthName = MONTHS[viewMonth];
  const monthStr = `${year}-${String(viewMonth + 1).padStart(2, "0")}`;

  const monthTx = transactions.filter(tx => tx.date.startsWith(monthStr));
  const monthIncome = monthTx.filter(t => t.type === "Income").reduce((a, t) => a + t.amount, 0);
  const monthExpenses = monthTx.filter(t => t.type === "Expenses").reduce((a, t) => a + t.amount, 0);
  const monthSavings = monthTx.filter(t => t.type === "Savings").reduce((a, t) => a + t.amount, 0);
  const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpenses) / monthIncome) * 100 : 0;

  // Budget vs actual for this month
  const budgetIncome = budgetData.income.reduce((a, r) => a + (r.amounts[viewMonth] || 0), 0);
  const budgetExpenses = budgetData.expenses.reduce((a, r) => a + (r.amounts[viewMonth] || 0), 0);

  // Monthly trend (last 6 months of transactions)
  const trendData = MONTHS.map((m, i) => {
    const ms = `${year}-${String(i + 1).padStart(2, "0")}`;
    const inc = transactions.filter(t => t.date.startsWith(ms) && t.type === "Income").reduce((a, t) => a + t.amount, 0);
    const exp = transactions.filter(t => t.date.startsWith(ms) && t.type === "Expenses").reduce((a, t) => a + t.amount, 0);
    const sav = transactions.filter(t => t.date.startsWith(ms) && t.type === "Savings").reduce((a, t) => a + t.amount, 0);
    return { month: m, income: inc, expenses: exp, savings: sav, net: inc - exp - sav };
  });

  // Expense by category pie
  const expPie = budgetData.expenses.map((r, i) => ({
    name: r.name, value: r.amounts[viewMonth] || 0
  })).filter(d => d.value > 0);

  // Savings breakdown
  const savPie = budgetData.savings.map(r => ({
    name: r.name, value: r.amounts[viewMonth] || 0
  })).filter(d => d.value > 0);

  // Budget vs actual comparison
  const compareData = [
    { name: "Income", budget: budgetIncome, actual: monthIncome },
    { name: "Expenses", budget: budgetExpenses, actual: monthExpenses },
  ];

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-bold text-sm" style={{ color: B.pri }}>Dashboard — {year}</h3>
        <div className="flex gap-1 flex-wrap">
          {MONTHS.map((m, i) => (
            <button key={m} onClick={() => setViewMonth(i)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={{ background: viewMonth === i ? B.pri : "#F3F4F6", color: viewMonth === i ? "#fff" : B.mut }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={TrendingUp} label={`${monthName} Income`} value={fmt(monthIncome)} sub={`Budget: ${fmt(budgetIncome)}`} color={B.grn} bg={B.grnL} />
        <KPI icon={DollarSign} label={`${monthName} Expenses`} value={fmt(monthExpenses)} sub={`Budget: ${fmt(budgetExpenses)}`} color={B.red} bg={B.redL} />
        <KPI icon={PiggyBank} label={`${monthName} Saved`} value={fmt(monthSavings)} color={B.blue} bg={B.blueL} />
        <KPI icon={Target} label="Savings Rate" value={fp(savingsRate)} sub={savingsRate >= 20 ? "Excellent!" : savingsRate >= 10 ? "Good" : "Below target"} color={savingsRate >= 20 ? B.grn : savingsRate >= 10 ? B.gold : B.red} />
      </div>

      {/* Monthly trend chart */}
      <Card>
        <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
          <span className="font-semibold text-sm" style={{ color: B.pri }}>Monthly Cash Flow — {year}</span>
        </div>
        <div className="p-4" style={{ height: 220 }}>
          <ResponsiveContainer>
            <AreaChart data={trendData} margin={{ left: 5, right: 5 }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={B.grn} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={B.grn} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={B.red} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={B.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend />
              <Area type="monotone" dataKey="income" name="Income" stroke={B.grn} fill="url(#incGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke={B.red} fill="url(#expGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Expense breakdown */}
        <Card>
          <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Expenses Breakdown — {monthName}</span>
          </div>
          <div className="p-4">
            {expPie.length === 0 ? (
              <div className="text-center py-8 text-xs" style={{ color: B.mut }}>No expense data for {monthName}</div>
            ) : (
              <div className="flex items-center gap-4">
                <div style={{ width: 140, height: 140 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={expPie} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2}>
                        {expPie.map((_, i) => <Cell key={i} fill={PIE_C[i % PIE_C.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1">
                  {expPie.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: PIE_C[i % PIE_C.length] }} />
                        <span style={{ color: B.txt }}>{d.name}</span>
                      </div>
                      <span className="font-semibold" style={{ color: B.txt }}>{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Budget vs Actual */}
        <Card>
          <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Budget vs Actual — {monthName}</span>
          </div>
          <div className="p-4" style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={compareData} margin={{ left: 5, right: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
                <Bar dataKey="budget" name="Budget" fill={B.accL} radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill={B.gold} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Savings allocation */}
      {savPie.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Savings Allocation — {monthName}</span>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {savPie.map((d, i) => (
              <div key={d.name} className="rounded-lg p-3 text-center" style={{ background: B.blueL }}>
                <div className="text-xs font-medium mb-1" style={{ color: B.mut }}>{d.name}</div>
                <div className="text-lg font-bold" style={{ color: B.blue }}>{fmt(d.value)}</div>
                <div className="text-xs" style={{ color: B.mut }}>
                  {budgetData.savings.reduce((a, r) => a + (r.amounts[viewMonth] || 0), 0) > 0
                    ? fp((d.value / budgetData.savings.reduce((a, r) => a + (r.amounts[viewMonth] || 0), 0)) * 100) + " of savings"
                    : ""}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: DEBT SNOWBALL (ADVANCED — per-debt extra payment targeting)
// ═══════════════════════════════════════════════════════════════
function DebtSnowballTab({ debts, setDebts }) {
  const [extra, setExtra] = useState(100);
  const [extraInput, setExtraInput] = useState("100");
  const [form, setForm] = useState({ name: "", balance: "", minPayment: "", interestRate: "" });
  const [showForm, setShowForm] = useState(false);
  // Strategy: "snowball" (smallest first), "avalanche" (highest interest first), "custom" (user picks targets)
  const [strategy, setStrategy] = useState("snowball");
  // For custom strategy: map of debtId -> extra $ amount assigned to that debt
  const [customAlloc, setCustomAlloc] = useState({});

  const addDebt = () => {
    if (!form.name || !form.balance) return;
    setDebts(p => [...p, { id: uid(), name: form.name, balance: parseFloat(form.balance), minPayment: parseFloat(form.minPayment) || 0, interestRate: parseFloat(form.interestRate) || 0 }]);
    setForm({ name: "", balance: "", minPayment: "", interestRate: "" });
    setShowForm(false);
  };

  // How much of the extra is allocated in custom mode
  const customAllocTotal = Object.values(customAlloc).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const customUnallocated = Math.max(0, extra - customAllocTotal);

  const updateCustomAlloc = (debtId, val) => {
    setCustomAlloc(p => ({ ...p, [debtId]: parseFloat(val) || 0 }));
  };

  // Distribute extra evenly across selected debts
  const distributeEvenly = () => {
    const activeDebts = debts.filter(d => d.balance > 0);
    if (!activeDebts.length) return;
    const each = Math.floor(extra / activeDebts.length);
    const remainder = extra - each * activeDebts.length;
    const alloc = {};
    activeDebts.forEach((d, i) => { alloc[d.id] = each + (i === 0 ? remainder : 0); });
    setCustomAlloc(alloc);
  };

  // Put all extra on a single debt
  const focusOnDebt = (debtId) => {
    const alloc = {};
    debts.forEach(d => { alloc[d.id] = d.id === debtId ? extra : 0; });
    setCustomAlloc(alloc);
  };

  // Snowball / Avalanche / Custom calculation
  const snowball = useMemo(() => {
    if (!debts.length) return { schedule: [], debtsCopy: [], totalInterestPaid: 0 };
    let debtsCopy = debts.map(d => ({ ...d, remaining: d.balance, totalInterestPaid: 0 }));

    // Sort order depends on strategy
    if (strategy === "snowball") debtsCopy.sort((a, b) => a.remaining - b.remaining);
    else if (strategy === "avalanche") debtsCopy.sort((a, b) => b.interestRate - a.interestRate);
    // custom: no sort, user controls allocation

    const schedule = [];
    let month = 0;
    const maxMonths = 360;

    while (debtsCopy.some(d => d.remaining > 0.01) && month < maxMonths) {
      month++;

      // Apply interest
      debtsCopy = debtsCopy.map(d => {
        if (d.remaining <= 0) return d;
        const monthlyRate = d.interestRate / 100 / 12;
        const interest = d.remaining * monthlyRate;
        return { ...d, remaining: d.remaining + interest, totalInterestPaid: d.totalInterestPaid + interest };
      });

      // Pay minimums first
      debtsCopy = debtsCopy.map(d => {
        if (d.remaining <= 0) return d;
        const pay = Math.min(d.minPayment, d.remaining);
        return { ...d, remaining: Math.max(0, d.remaining - pay) };
      });

      // Apply extra payment based on strategy
      if (strategy === "custom") {
        // Custom: apply each debt's allocated extra
        let leftover = 0;
        debtsCopy = debtsCopy.map(d => {
          if (d.remaining <= 0) return d;
          const alloc = parseFloat(customAlloc[d.id]) || 0;
          const pay = Math.min(alloc, d.remaining);
          leftover += alloc - pay;
          return { ...d, remaining: Math.max(0, d.remaining - pay) };
        });
        // Any unallocated extra + leftover goes to smallest remaining
        let unalloc = customUnallocated + leftover;
        for (let i = 0; i < debtsCopy.length && unalloc > 0.01; i++) {
          const sorted = [...debtsCopy].filter(d => d.remaining > 0).sort((a, b) => a.remaining - b.remaining);
          if (sorted.length === 0) break;
          const target = sorted[0];
          const idx = debtsCopy.findIndex(d => d.id === target.id);
          const pay = Math.min(unalloc, debtsCopy[idx].remaining);
          debtsCopy[idx] = { ...debtsCopy[idx], remaining: Math.max(0, debtsCopy[idx].remaining - pay) };
          unalloc -= pay;
        }
      } else {
        // Snowball or Avalanche: extra goes to first active debt in sorted order
        let snowballAmt = extra;
        // Also add freed-up minimums from paid-off debts in previous iterations
        for (let i = 0; i < debtsCopy.length && snowballAmt > 0.01; i++) {
          if (debtsCopy[i].remaining > 0) {
            const pay = Math.min(snowballAmt, debtsCopy[i].remaining);
            debtsCopy[i] = { ...debtsCopy[i], remaining: Math.max(0, debtsCopy[i].remaining - pay) };
            snowballAmt -= pay;
            if (debtsCopy[i].remaining > 0) break; // If debt not fully paid, stop
          }
        }
      }

      // Mark paid-off debts
      debtsCopy = debtsCopy.map(d => {
        if (d.remaining <= 0.01 && !d.paidOffMonth) {
          return { ...d, remaining: 0, paidOffMonth: month };
        }
        return d;
      });

      schedule.push({ month, debts: debtsCopy.map(d => ({ id: d.id, name: d.name, remaining: Math.max(0, d.remaining) })) });
    }

    const totalInterestPaid = debtsCopy.reduce((a, d) => a + d.totalInterestPaid, 0);
    return { schedule, debtsCopy, totalInterestPaid };
  }, [debts, extra, strategy, customAlloc, customUnallocated]);

  // Calculate min-only scenario for comparison
  const minOnlyMonths = useMemo(() => {
    if (!debts.length) return 0;
    let dc = debts.map(d => ({ ...d, remaining: d.balance }));
    let m = 0;
    while (dc.some(d => d.remaining > 0.01) && m < 600) {
      m++;
      dc = dc.map(d => {
        if (d.remaining <= 0) return d;
        const interest = d.remaining * (d.interestRate / 100 / 12);
        const afterInterest = d.remaining + interest;
        return { ...d, remaining: Math.max(0, afterInterest - d.minPayment) };
      });
    }
    return m;
  }, [debts]);

  const totalDebt = debts.reduce((a, d) => a + d.balance, 0);
  const minTotal = debts.reduce((a, d) => a + d.minPayment, 0);
  const payoffMonth = snowball.schedule ? snowball.schedule.length : 0;
  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + payoffMonth);
  const monthsSaved = minOnlyMonths - payoffMonth;
  const strategyLabel = strategy === "snowball" ? "Smallest First" : strategy === "avalanche" ? "Highest Interest First" : "Custom Targeting";

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI icon={CreditCard} label="Total Debt" value={fmt(totalDebt)} color={B.red} bg={B.redL} />
        <KPI icon={DollarSign} label="Min Payments" value={fmt(minTotal)} sub="/month" color={B.gold} />
        <KPI icon={Zap} label="Total Payment" value={fmt(minTotal + extra)} sub="/month" color={B.blue} />
        <KPI icon={Target} label="Debt Free" value={payoffMonth > 0 ? payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "--"} sub={payoffMonth > 0 ? `${payoffMonth} months` : "Add debts"} color={B.grn} bg={B.grnL} />
        <KPI icon={Clock} label="Months Saved" value={monthsSaved > 0 ? `${monthsSaved}` : "--"} sub={monthsSaved > 0 ? "vs min-only" : ""} color={B.blue} bg={B.blueL} />
      </div>

      {/* Interest saved callout */}
      {snowball.totalInterestPaid > 0 && (
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#FFF7ED", border: `1.5px solid ${B.gold}` }}>
          <Percent size={18} style={{ color: B.gold }} />
          <div>
            <span className="text-sm font-semibold" style={{ color: B.goldD }}>Total interest you'll pay: </span>
            <span className="text-sm font-bold" style={{ color: B.red }}>{fmt(snowball.totalInterestPaid)}</span>
            <span className="text-xs ml-2" style={{ color: B.mut }}>Strategy: {strategyLabel}</span>
          </div>
        </div>
      )}

      {/* Strategy selector */}
      <Card>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={15} style={{ color: B.pri }} />
            <label className="text-sm font-semibold" style={{ color: B.pri }}>Payoff Strategy</label>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { id: "snowball", label: "Snowball", desc: "Smallest balance first — quick wins build momentum" },
              { id: "avalanche", label: "Avalanche", desc: "Highest interest first — saves the most money" },
              { id: "custom", label: "Custom", desc: "You choose which debts get the extra payment" },
            ].map(s => (
              <button key={s.id} onClick={() => setStrategy(s.id)}
                className="rounded-xl p-3 text-left border-2 transition-all"
                style={{ borderColor: strategy === s.id ? B.gold : B.brd, background: strategy === s.id ? B.goldL : "#fff" }}>
                <div className="text-xs font-bold mb-0.5" style={{ color: strategy === s.id ? B.goldD : B.pri }}>{s.label}</div>
                <div className="text-xs leading-snug" style={{ color: B.mut }}>{s.desc}</div>
              </button>
            ))}
          </div>

          {/* Extra payment amount */}
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold" style={{ color: B.pri }}>Monthly Extra Payment</label>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: B.mut }}>$</span>
              <input type="number" value={extraInput} min="0" step="50"
                onChange={e => { setExtraInput(e.target.value); setExtra(Math.max(0, parseFloat(e.target.value) || 0)); }}
                className="w-24 text-right text-lg font-bold px-2 py-1 rounded-lg border outline-none"
                style={{ borderColor: B.blue, color: B.blue }}
              />
            </div>
          </div>
          <input type="range" min="0" max="10000" step="50" value={extra}
            onChange={e => { setExtra(Number(e.target.value)); setExtraInput(e.target.value); }}
            className="w-full" style={{ accentColor: B.blue }} />
          <div className="flex justify-between text-xs mt-1" style={{ color: B.mut }}>
            <span>$0</span><span>$2k</span><span>$4k</span><span>$6k</span><span>$8k</span><span>$10k</span>
          </div>
        </div>
      </Card>

      {/* Custom allocation panel */}
      {strategy === "custom" && debts.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: B.brd }}>
            <div className="flex items-center gap-2">
              <Target size={15} style={{ color: B.gold }} />
              <span className="font-semibold text-sm" style={{ color: B.pri }}>Extra Payment Allocation</span>
            </div>
            <div className="flex gap-2">
              <button onClick={distributeEvenly} className="text-xs px-3 py-1 rounded-lg font-medium"
                style={{ background: B.blueL, color: B.blue, border: `1px solid ${B.blue}` }}>
                Split Evenly
              </button>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {/* Allocation bar */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium" style={{ color: B.mut }}>Budget:</span>
              <span className="text-sm font-bold" style={{ color: B.blue }}>{fmt(extra)}</span>
              <ArrowRight size={12} style={{ color: B.mut }} />
              <span className="text-xs font-medium" style={{ color: B.mut }}>Allocated:</span>
              <span className="text-sm font-bold" style={{ color: customAllocTotal <= extra ? B.grn : B.red }}>{fmt(customAllocTotal)}</span>
              {customUnallocated > 0 && (
                <>
                  <ArrowRight size={12} style={{ color: B.mut }} />
                  <span className="text-xs" style={{ color: B.gold }}>Unallocated: {fmt(customUnallocated)} (goes to smallest)</span>
                </>
              )}
              {customAllocTotal > extra && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: B.redL, color: B.red }}>
                  Over by {fmt(customAllocTotal - extra)}!
                </span>
              )}
            </div>

            {debts.filter(d => d.balance > 0).map(debt => (
              <div key={debt.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "#FAFBFC" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: B.txt }}>{debt.name}</div>
                  <div className="text-xs" style={{ color: B.mut }}>{fmt(debt.balance)} @ {debt.interestRate}%</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs" style={{ color: B.mut }}>$</span>
                  <input type="number" min="0" step="25" value={customAlloc[debt.id] || 0}
                    onChange={e => updateCustomAlloc(debt.id, e.target.value)}
                    className="w-20 text-right text-sm font-semibold px-2 py-1.5 rounded-lg border outline-none"
                    style={{ borderColor: (customAlloc[debt.id] || 0) > 0 ? B.gold : B.brd, color: B.txt }} />
                  <span className="text-xs" style={{ color: B.mut }}>/mo</span>
                </div>
                <button onClick={() => focusOnDebt(debt.id)}
                  className="text-xs px-2 py-1 rounded font-medium whitespace-nowrap"
                  style={{ background: B.goldL, color: B.goldD }}>
                  Focus
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add debt */}
      <Card>
        <div className="px-4 py-3 flex items-center justify-between cursor-pointer"
          style={{ background: "#F9FAFB", borderBottom: showForm ? `1px solid ${B.brd}` : "none" }}
          onClick={() => setShowForm(p => !p)}>
          <div className="flex items-center gap-2">
            <Plus size={16} style={{ color: B.gold }} />
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Add Debt</span>
          </div>
          {showForm ? <ChevronUp size={15} style={{ color: B.mut }} /> : <ChevronDown size={15} style={{ color: B.mut }} />}
        </div>
        {showForm && (
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Debt Name", key: "name", type: "text", placeholder: "e.g. Credit Card" },
              { label: "Balance ($)", key: "balance", type: "number", placeholder: "5000" },
              { label: "Min Payment ($)", key: "minPayment", type: "number", placeholder: "150" },
              { label: "Interest Rate (%)", key: "interestRate", type: "number", placeholder: "18.9" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>{f.label}</label>
                <input type={f.type} value={form[f.key]} placeholder={f.placeholder}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd }} />
              </div>
            ))}
            <div className="md:col-span-4 flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: B.mut }}>Cancel</button>
              <button onClick={addDebt} disabled={!form.name || !form.balance}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: B.pri }}>Add Debt</button>
            </div>
          </div>
        )}
      </Card>

      {/* Debt list with payoff dates + per-debt extra */}
      {debts.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
            <span className="font-semibold text-sm" style={{ color: B.pri }}>
              Payoff Order ({strategyLabel})
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#F9FAFB", borderBottom: `1px solid ${B.brd}` }}>
                  {["#","Debt","Balance","Min Payment","Interest","Extra/mo","Payoff",""].map(h => (
                    <th key={h} className="p-3 text-left text-xs font-semibold" style={{ color: B.mut }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let sorted = [...debts];
                  if (strategy === "snowball") sorted.sort((a, b) => a.balance - b.balance);
                  else if (strategy === "avalanche") sorted.sort((a, b) => b.interestRate - a.interestRate);
                  return sorted;
                })().map((debt, i) => {
                  const paidOffMonth = snowball.debtsCopy?.find(d => d.id === debt.id)?.paidOffMonth;
                  const pDate = paidOffMonth ? new Date() : null;
                  if (pDate) pDate.setMonth(pDate.getMonth() + paidOffMonth);
                  const debtExtra = strategy === "custom" ? (customAlloc[debt.id] || 0) : (i === 0 ? extra : 0);
                  return (
                    <tr key={debt.id} style={{ borderBottom: `1px solid ${B.brd}`, background: i === 0 && strategy !== "custom" ? "#FFFBF0" : "transparent" }}>
                      <td className="p-3">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: PIE_C[i % PIE_C.length] }}>{i + 1}</span>
                      </td>
                      <td className="p-3 font-semibold" style={{ color: B.txt }}>{debt.name}</td>
                      <td className="p-3 font-bold" style={{ color: B.red }}>{fmt(debt.balance)}</td>
                      <td className="p-3" style={{ color: B.txt }}>{fmt(debt.minPayment)}/mo</td>
                      <td className="p-3" style={{ color: B.mut }}>{debt.interestRate}%</td>
                      <td className="p-3">
                        {debtExtra > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: B.blueL, color: B.blue }}>
                            +{fmt(debtExtra)}
                          </span>
                        ) : <span className="text-xs" style={{ color: B.mut }}>--</span>}
                      </td>
                      <td className="p-3">
                        {paidOffMonth ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: B.grnL, color: B.grn }}>
                            {pDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </span>
                        ) : "--"}
                      </td>
                      <td className="p-3">
                        <button onClick={() => setDebts(p => p.filter(d => d.id !== debt.id))}
                          className="p-1 rounded hover:bg-red-50 opacity-40 hover:opacity-100">
                          <Trash2 size={12} style={{ color: B.red }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Payoff chart */}
      {debts.length > 0 && snowball.schedule && snowball.schedule.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Remaining Balance Over Time</span>
          </div>
          <div className="p-4" style={{ height: 250 }}>
            <ResponsiveContainer>
              <AreaChart
                data={snowball.schedule.filter((_, i) => i % Math.max(1, Math.floor(snowball.schedule.length / 30)) === 0)}
                margin={{ left: 5, right: 5 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} label={{ value: "Month", position: "insideBottom", offset: -2, fontSize: 10 }} />
                <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => fmt(v)} labelFormatter={v => `Month ${v}`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {debts.map((d, i) => (
                  <Area key={d.id} type="monotone" stackId="1"
                    dataKey={(row) => row.debts.find(dd => dd.id === d.id)?.remaining || 0}
                    name={d.name} stroke={PIE_C[i % PIE_C.length]} fill={PIE_C[i % PIE_C.length]} fillOpacity={0.3} strokeWidth={1.5} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {debts.length === 0 && (
        <div className="text-center py-12" style={{ color: B.mut }}>
          <CreditCard size={40} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
          <p className="text-sm">Add your debts above to see your payoff plan.</p>
          <p className="text-xs mt-1">Choose Snowball, Avalanche, or Custom targeting for your extra payments.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 5: SAVINGS GOALS
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// TAB 6: BURN RATE CALCULATOR
// Based on Fabian's article "Financial Burn Rate"
// ═══════════════════════════════════════════════════════════════
function BurnRateTab() {
  const [mode, setMode] = useState("personal"); // personal | business
  const [months, setMonths] = useState([
    { id: uid(), label: "Month 1", bankOut: "", creditOut: "", otherOut: "", income: "" },
    { id: uid(), label: "Month 2", bankOut: "", creditOut: "", otherOut: "", income: "" },
    { id: uid(), label: "Month 3", bankOut: "", creditOut: "", otherOut: "", income: "" },
  ]);
  // Leak tracker categories
  const [leaks, setLeaks] = useState([
    { id: uid(), name: "Subscriptions & Memberships", amount: "" },
    { id: uid(), name: "Dining Out / Delivery", amount: "" },
    { id: uid(), name: "Convenience Charges / Fees", amount: "" },
    { id: uid(), name: "Unused Services", amount: "" },
    { id: uid(), name: "Impulse Purchases", amount: "" },
  ]);
  const [showLeaks, setShowLeaks] = useState(false);

  const updateMonth = (id, field, val) => {
    setMonths(p => p.map(m => m.id === id ? { ...m, [field]: val } : m));
  };
  const addMonth = () => {
    setMonths(p => [...p, { id: uid(), label: `Month ${p.length + 1}`, bankOut: "", creditOut: "", otherOut: "", income: "" }]);
  };
  const removeMonth = (id) => {
    if (months.length <= 1) return;
    setMonths(p => p.filter(m => m.id !== id));
  };

  // Calculations
  const monthTotals = months.map(m => {
    const out = (parseFloat(m.bankOut) || 0) + (parseFloat(m.creditOut) || 0) + (parseFloat(m.otherOut) || 0);
    const inc = parseFloat(m.income) || 0;
    return { ...m, totalOut: out, income: inc, net: inc - out };
  });

  const validMonths = monthTotals.filter(m => m.totalOut > 0);
  const avgBurnRate = validMonths.length > 0 ? validMonths.reduce((a, m) => a + m.totalOut, 0) / validMonths.length : 0;
  const avgIncome = validMonths.length > 0 ? validMonths.reduce((a, m) => a + m.income, 0) / validMonths.length : 0;
  const burnRatio = avgIncome > 0 ? (avgBurnRate / avgIncome) * 100 : 0;
  const monthlySurplus = avgIncome - avgBurnRate;
  const annualBurn = avgBurnRate * 12;

  // Leak totals
  const totalLeaks = leaks.reduce((a, l) => a + (parseFloat(l.amount) || 0), 0);
  const leakPercent = avgBurnRate > 0 ? (totalLeaks / avgBurnRate) * 100 : 0;

  // Health rating
  const getHealthRating = () => {
    if (burnRatio === 0) return { label: "Enter data", color: B.mut, bg: "#F3F4F6" };
    if (burnRatio <= 50) return { label: "Excellent", color: B.grn, bg: B.grnL };
    if (burnRatio <= 70) return { label: "Healthy", color: B.blue, bg: B.blueL };
    if (burnRatio <= 85) return { label: "Tight", color: B.gold, bg: B.goldL };
    if (burnRatio <= 100) return { label: "Danger Zone", color: "#EA580C", bg: "#FFF7ED" };
    return { label: "Bleeding Cash", color: B.red, bg: B.redL };
  };
  const health = getHealthRating();

  // Pie data for burn breakdown
  const burnPie = validMonths.length > 0 ? [
    { name: "Bank Outflows", value: validMonths.reduce((a, m) => a + (parseFloat(m.bankOut) || 0), 0) / validMonths.length },
    { name: "Credit Card", value: validMonths.reduce((a, m) => a + (parseFloat(m.creditOut) || 0), 0) / validMonths.length },
    { name: "Other", value: validMonths.reduce((a, m) => a + (parseFloat(m.otherOut) || 0), 0) / validMonths.length },
  ].filter(d => d.value > 0) : [];

  // Trend data
  const trendData = monthTotals.map((m, i) => ({
    month: m.label,
    outflows: m.totalOut,
    income: parseFloat(months[i].income) || 0,
  }));

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-3">
        <button onClick={() => setMode("personal")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ background: mode === "personal" ? B.pri : "#F3F4F6", color: mode === "personal" ? "#fff" : B.mut }}>
          <DollarSign size={13} /> Personal Burn Rate
        </button>
        <button onClick={() => setMode("business")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ background: mode === "business" ? B.pri : "#F3F4F6", color: mode === "business" ? "#fff" : B.mut }}>
          <BarChart3 size={13} /> Business Burn Rate
        </button>
      </div>

      {/* Explanation */}
      <div className="rounded-xl p-3" style={{ background: "#F0F9FF", border: `1px solid ${B.blue}` }}>
        <div className="flex items-start gap-2">
          <Flame size={16} style={{ color: "#EA580C", marginTop: 2 }} />
          <div>
            <div className="text-sm font-semibold mb-0.5" style={{ color: B.pri }}>
              {mode === "personal" ? "Your Personal Burn Rate" : "Your Business Burn Rate"}
            </div>
            <div className="text-xs leading-relaxed" style={{ color: B.mut }}>
              {mode === "personal"
                ? "Your burn rate is the total amount of money that leaves your life every single month. Pull 3 months of bank statements + credit card statements. Add up every outflow. Divide by 3. That's your monthly burn rate."
                : "Your business burn rate is total monthly operating expenses. Track all outflows: payroll, rent, software, marketing, supplies. This tells you how long your cash reserves will last."}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI icon={Flame} label="Monthly Burn" value={fmt(avgBurnRate)} color="#EA580C" bg="#FFF7ED" />
        <KPI icon={TrendingUp} label="Monthly Income" value={fmt(avgIncome)} color={B.grn} bg={B.grnL} />
        <KPI icon={DollarSign} label={monthlySurplus >= 0 ? "Surplus" : "Deficit"} value={fmt(Math.abs(monthlySurplus))} color={monthlySurplus >= 0 ? B.grn : B.red} bg={monthlySurplus >= 0 ? B.grnL : B.redL} />
        <KPI icon={Calendar} label="Annual Burn" value={fmt(annualBurn)} color={B.pri} />
        <div className="rounded-xl p-4 border text-center" style={{ borderColor: health.color, background: health.bg }}>
          <div className="text-xs font-medium mb-1" style={{ color: B.mut }}>Health</div>
          <div className="text-xl font-bold" style={{ color: health.color }}>{burnRatio > 0 ? `${burnRatio.toFixed(0)}%` : "--"}</div>
          <div className="text-xs font-semibold" style={{ color: health.color }}>{health.label}</div>
        </div>
      </div>

      {/* Monthly data entry */}
      <Card>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: B.brd }}>
          <div className="flex items-center gap-2">
            <Calendar size={15} style={{ color: B.pri }} />
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Monthly Outflows (3+ months recommended)</span>
          </div>
          <button onClick={addMonth} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ background: B.goldL, color: B.goldD, border: `1px solid ${B.gold}` }}>
            <Plus size={12} /> Add Month
          </button>
        </div>
        <div className="p-4 space-y-3">
          {months.map((m, i) => (
            <div key={m.id} className="grid grid-cols-5 gap-2 items-end p-2 rounded-lg" style={{ background: i % 2 === 0 ? "#FAFBFC" : "#fff" }}>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>
                  {mode === "personal" ? "Bank Outflows" : "Operating Expenses"}
                </label>
                <input type="number" placeholder="0" value={m.bankOut}
                  onChange={e => updateMonth(m.id, "bankOut", e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>
                  {mode === "personal" ? "Credit Card" : "Payroll / Contractors"}
                </label>
                <input type="number" placeholder="0" value={m.creditOut}
                  onChange={e => updateMonth(m.id, "creditOut", e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>Other Outflows</label>
                <input type="number" placeholder="0" value={m.otherOut}
                  onChange={e => updateMonth(m.id, "otherOut", e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>
                  {mode === "personal" ? "Take-Home Pay" : "Revenue"}
                </label>
                <input type="number" placeholder="0" value={months[i].income}
                  onChange={e => updateMonth(m.id, "income", e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd }} />
              </div>
              <div className="flex items-end gap-1">
                <div className="text-xs font-bold py-2" style={{ color: monthTotals[i].net >= 0 ? B.grn : B.red }}>
                  {monthTotals[i].totalOut > 0 ? (monthTotals[i].net >= 0 ? "+" : "") + fmt(monthTotals[i].net) : "--"}
                </div>
                {months.length > 1 && (
                  <button onClick={() => removeMonth(m.id)} className="p-1 rounded hover:bg-red-50 opacity-40 hover:opacity-100 mb-1">
                    <Trash2 size={11} style={{ color: B.red }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Charts row */}
      {validMonths.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Burn breakdown pie */}
          {burnPie.length > 0 && (
            <Card>
              <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
                <span className="font-semibold text-sm" style={{ color: B.pri }}>Burn Breakdown (Avg)</span>
              </div>
              <div className="p-4 flex items-center gap-4">
                <div style={{ width: 130, height: 130 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={burnPie} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                        {burnPie.map((_, i) => <Cell key={i} fill={["#EA580C", B.red, B.gold][i]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {burnPie.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: ["#EA580C", B.red, B.gold][i] }} />
                        <span style={{ color: B.txt }}>{d.name}</span>
                      </div>
                      <span className="font-semibold" style={{ color: B.txt }}>{fmt(d.value)}/mo</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Monthly trend */}
          <Card>
            <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
              <span className="font-semibold text-sm" style={{ color: B.pri }}>Income vs Outflows</span>
            </div>
            <div className="p-4" style={{ height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={trendData} margin={{ left: 5, right: 5 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="income" name="Income" fill={B.grn} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="outflows" name="Outflows" fill="#EA580C" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* Leak Finder */}
      <Card>
        <div className="px-4 py-3 flex items-center justify-between cursor-pointer"
          style={{ background: "#FFF7ED", borderBottom: showLeaks ? `1px solid ${B.brd}` : "none" }}
          onClick={() => setShowLeaks(p => !p)}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} style={{ color: "#EA580C" }} />
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Cash Leak Finder</span>
            {totalLeaks > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: B.redL, color: B.red }}>
                {fmt(totalLeaks)}/mo in leaks ({leakPercent.toFixed(0)}% of burn)
              </span>
            )}
          </div>
          {showLeaks ? <ChevronUp size={15} style={{ color: B.mut }} /> : <ChevronDown size={15} style={{ color: B.mut }} />}
        </div>
        {showLeaks && (
          <div className="p-4 space-y-3">
            <div className="text-xs mb-2" style={{ color: B.mut }}>
              Track the three silent killers: Subscription Creep, Dining/Delivery Drain, and Invisible Upgrades. How much are they really costing you?
            </div>
            {leaks.map(l => (
              <div key={l.id} className="flex items-center gap-3">
                <input type="text" value={l.name}
                  onChange={e => setLeaks(p => p.map(ll => ll.id === l.id ? { ...ll, name: e.target.value } : ll))}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd }} />
                <div className="flex items-center gap-1">
                  <span className="text-xs" style={{ color: B.mut }}>$</span>
                  <input type="number" value={l.amount} placeholder="0"
                    onChange={e => setLeaks(p => p.map(ll => ll.id === l.id ? { ...ll, amount: e.target.value } : ll))}
                    className="w-24 px-2 py-2 rounded-lg border text-sm text-right outline-none" style={{ borderColor: B.brd }} />
                  <span className="text-xs" style={{ color: B.mut }}>/mo</span>
                </div>
                <button onClick={() => setLeaks(p => p.filter(ll => ll.id !== l.id))}
                  className="p-1 rounded hover:bg-red-50 opacity-40 hover:opacity-100">
                  <Trash2 size={12} style={{ color: B.red }} />
                </button>
              </div>
            ))}
            <button onClick={() => setLeaks(p => [...p, { id: uid(), name: "New Category", amount: "" }])}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: "#FFF7ED", color: "#EA580C", border: "1px solid #EA580C" }}>
              <Plus size={12} /> Add Leak Category
            </button>

            {totalLeaks > 0 && (
              <div className="rounded-xl p-3 mt-2" style={{ background: B.redL, border: `1px solid ${B.red}` }}>
                <div className="text-sm font-semibold" style={{ color: B.red }}>
                  You're leaking {fmt(totalLeaks)}/month ({fmt(totalLeaks * 12)}/year)
                </div>
                <div className="text-xs mt-1" style={{ color: B.mut }}>
                  That's {leakPercent.toFixed(0)}% of your monthly burn rate going to avoidable expenses.
                  {totalLeaks * 12 > 5000 && " Redirecting even half of this to debt payoff or investments could change your financial trajectory."}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Action plan */}
      {avgBurnRate > 0 && (
        <Card>
          <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Your Burn Rate Action Plan</span>
          </div>
          <div className="p-4 space-y-3">
            {[
              { check: burnRatio <= 70, text: `Burn ratio is ${burnRatio.toFixed(0)}%${burnRatio <= 70 ? " - you're in good shape" : burnRatio <= 85 ? " - tighten up where you can" : " - this needs immediate attention"}` },
              { check: monthlySurplus > 0, text: monthlySurplus > 0 ? `Monthly surplus of ${fmt(monthlySurplus)} available for investing or debt payoff` : `Monthly deficit of ${fmt(Math.abs(monthlySurplus))} - you're spending more than you earn` },
              { check: totalLeaks < avgBurnRate * 0.1, text: totalLeaks > 0 ? `Cash leaks: ${fmt(totalLeaks)}/mo (${leakPercent.toFixed(0)}% of burn)${leakPercent > 15 ? " - high leak ratio, review subscriptions" : ""}` : "Run the Leak Finder above to identify hidden drains" },
              { check: validMonths.length >= 3, text: validMonths.length >= 3 ? "Using 3+ months of data - good statistical basis" : "Add more months for a more accurate burn rate" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                {item.check
                  ? <Check size={14} style={{ color: B.grn, marginTop: 2 }} />
                  : <AlertTriangle size={14} style={{ color: B.gold, marginTop: 2 }} />}
                <span className="text-xs" style={{ color: B.txt }}>{item.text}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Savings Input (module-level to avoid focus-loss)
const SavingsInput = ({ label, value, onChange, type = "text", pre }) => (
  <div className="flex-1 min-w-0">
    <label className="block text-xs font-medium mb-1" style={{ color: B.mut }}>{label}</label>
    <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: B.brd }}>
      {pre && <span className="px-2 text-xs font-medium" style={{ color: B.mut, background: "#F9FAFB" }}>{pre}</span>}
      <input type={type} value={value} onChange={onChange} className="w-full px-2 py-1.5 text-sm outline-none" style={{ color: B.txt }} />
    </div>
  </div>
);

function SavingsGoalsTab({ funds, setFunds, savingsLog, setSavingsLog }) {
  const [showAddFund, setShowAddFund] = useState(false);
  const [newFund, setNewFund] = useState({ name: "", goal: 0, startAmount: 0, startDate: "", goalDate: "", monthly: 0 });
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: 0, fundId: "", details: "" });

  const addFund = () => {
    if (!newFund.name || newFund.goal <= 0) return;
    const fund = { id: uid(), ...newFund, goal: parseFloat(newFund.goal) || 0, startAmount: parseFloat(newFund.startAmount) || 0, monthly: parseFloat(newFund.monthly) || 0 };
    setFunds(p => [...p, fund]);
    setNewFund({ name: "", goal: 0, startAmount: 0, startDate: "", goalDate: "", monthly: 0 });
    setShowAddFund(false);
  };
  const removeFund = (id) => {
    setFunds(p => p.filter(f => f.id !== id));
    setSavingsLog(p => p.filter(l => l.fundId !== id));
  };
  const addLogEntry = () => {
    if (!logForm.fundId || !logForm.amount) return;
    setSavingsLog(p => [...p, { id: uid(), ...logForm, amount: parseFloat(logForm.amount) || 0 }]);
    setLogForm(f => ({ ...f, amount: 0, details: "" }));
  };

  const getFundSaved = (fundId) => savingsLog.filter(l => l.fundId === fundId).reduce((a, l) => a + l.amount, 0);
  const totalGoal = funds.reduce((a, f) => a + f.goal, 0);
  const totalStart = funds.reduce((a, f) => a + f.startAmount, 0);
  const totalSaved = savingsLog.reduce((a, l) => a + l.amount, 0);
  const totalBalance = totalStart + totalSaved;
  const totalLeft = Math.max(0, totalGoal - totalBalance);

  const getMonthsLeft = (f) => {
    if (!f.goalDate || !f.startDate) return null;
    const start = new Date(f.startDate), end = new Date(f.goalDate);
    return Math.max(0, Math.round((end - new Date()) / (1000 * 60 * 60 * 24 * 30.44)));
  };

  const getProgress = (f) => {
    const balance = f.startAmount + getFundSaved(f.id);
    return f.goal > 0 ? Math.min(100, (balance / f.goal) * 100) : 0;
  };


  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={Target} label="Total Goal" value={fmt(totalGoal)} color={B.pri} bg={B.card} />
        <KPI icon={PiggyBank} label="Total Balance" value={fmt(totalBalance)} color={B.grn} bg={B.grnL} />
        <KPI icon={TrendingUp} label="Total Saved" value={fmt(totalSaved)} sub={`+ ${fmt(totalStart)} starting`} color={B.blue} bg={B.blueL} />
        <KPI icon={Target} label="Left to Save" value={fmt(totalLeft)} color={totalLeft > 0 ? B.red : B.grn} bg={totalLeft > 0 ? B.redL : B.grnL} />
      </div>

      {/* Fund cards */}
      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: B.brd }}>
          <span className="font-semibold text-sm" style={{ color: B.pri }}>Savings Funds ({funds.length})</span>
          <button onClick={() => setShowAddFund(!showAddFund)} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ background: B.goldL, color: B.goldD, border: `1px solid ${B.gold}` }}>
            <Plus size={12} /> Add Fund
          </button>
        </div>

        {/* Add fund form */}
        {showAddFund && (
          <div className="p-4 border-b space-y-3" style={{ borderColor: B.brd, background: "#FAFBFC" }}>
            <div className="flex flex-wrap gap-3">
              <SavingsInput label="Fund Name" value={newFund.name} onChange={e => setNewFund(p => ({ ...p, name: e.target.value }))} />
              <SavingsInput label="Goal Amount" value={newFund.goal || ""} onChange={e => setNewFund(p => ({ ...p, goal: e.target.value }))} type="number" pre="$" />
              <SavingsInput label="Starting Amount" value={newFund.startAmount || ""} onChange={e => setNewFund(p => ({ ...p, startAmount: e.target.value }))} type="number" pre="$" />
            </div>
            <div className="flex flex-wrap gap-3">
              <SavingsInput label="Start Date" value={newFund.startDate} onChange={e => setNewFund(p => ({ ...p, startDate: e.target.value }))} type="date" />
              <SavingsInput label="Goal Date" value={newFund.goalDate} onChange={e => setNewFund(p => ({ ...p, goalDate: e.target.value }))} type="date" />
              <SavingsInput label="Monthly Contribution" value={newFund.monthly || ""} onChange={e => setNewFund(p => ({ ...p, monthly: e.target.value }))} type="number" pre="$" />
            </div>
            <div className="flex gap-2">
              <button onClick={addFund} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: B.gold, color: B.pri }}>Save Fund</button>
              <button onClick={() => setShowAddFund(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: B.mut }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Fund list */}
        {funds.length > 0 ? (
          <div className="divide-y" style={{ borderColor: B.brd }}>
            {funds.map(f => {
              const saved = getFundSaved(f.id);
              const balance = f.startAmount + saved;
              const left = Math.max(0, f.goal - balance);
              const pct = getProgress(f);
              const monthsLeft = getMonthsLeft(f);
              const neededPerMonth = monthsLeft && monthsLeft > 0 ? left / monthsLeft : null;
              return (
                <div key={f.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm" style={{ color: B.pri }}>{f.name}</span>
                      {f.goalDate && <span className="text-xs ml-2" style={{ color: B.mut }}>Goal: {f.goalDate}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold" style={{ color: pct >= 100 ? B.grn : B.blue }}>{pct.toFixed(0)}%</span>
                      <button onClick={() => removeFund(f.id)} className="p-1 rounded hover:bg-red-50 opacity-40 hover:opacity-100">
                        <Trash2 size={12} style={{ color: B.red }} />
                      </button>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full rounded-full h-3" style={{ background: "#E5E7EB" }}>
                    <div className="h-3 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: pct >= 100 ? B.grn : `linear-gradient(90deg, ${B.blue}, ${B.gold})` }} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs" style={{ color: B.mut }}>
                    <span>Balance: <strong style={{ color: B.grn }}>{fmt(balance)}</strong></span>
                    <span>Goal: <strong style={{ color: B.pri }}>{fmt(f.goal)}</strong></span>
                    <span>Left: <strong style={{ color: left > 0 ? B.red : B.grn }}>{fmt(left)}</strong></span>
                    {f.monthly > 0 && <span>Monthly: <strong>{fmt(f.monthly)}</strong></span>}
                    {monthsLeft != null && <span>{monthsLeft} months left</span>}
                    {neededPerMonth != null && <span>Need: <strong style={{ color: neededPerMonth > (f.monthly || 0) ? B.red : B.grn }}>{fmt(neededPerMonth)}/mo</strong></span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10" style={{ color: B.mut }}>
            <Target size={36} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
            <p className="text-sm">No savings funds yet. Add your first goal above!</p>
          </div>
        )}
      </Card>

      {/* Transaction log */}
      {funds.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Savings Log</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap gap-3 items-end">
              <SavingsInput label="Date" value={logForm.date} onChange={e => setLogForm(p => ({ ...p, date: e.target.value }))} type="date" />
              <SavingsInput label="Amount" value={logForm.amount || ""} onChange={e => setLogForm(p => ({ ...p, amount: e.target.value }))} type="number" pre="$" />
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-medium mb-1" style={{ color: B.mut }}>Fund</label>
                <select value={logForm.fundId} onChange={e => setLogForm(p => ({ ...p, fundId: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd, color: B.txt }}>
                  <option value="">Select fund...</option>
                  {funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <SavingsInput label="Details (optional)" value={logForm.details} onChange={e => setLogForm(p => ({ ...p, details: e.target.value }))} />
              <button onClick={addLogEntry} className="px-4 py-1.5 rounded-lg text-xs font-semibold" style={{ background: B.gold, color: B.pri, marginBottom: 1 }}>
                <Plus size={12} style={{ display: "inline", verticalAlign: -2 }} /> Log
              </button>
            </div>

            {savingsLog.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: 500 }}>
                  <thead>
                    <tr style={{ background: "#F9FAFB", borderBottom: `1px solid ${B.brd}` }}>
                      <th className="p-2 text-left font-semibold" style={{ color: B.mut }}>Date</th>
                      <th className="p-2 text-right font-semibold" style={{ color: B.mut }}>Amount</th>
                      <th className="p-2 text-left font-semibold" style={{ color: B.mut }}>Fund</th>
                      <th className="p-2 text-left font-semibold" style={{ color: B.mut }}>Details</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...savingsLog].sort((a, b) => b.date.localeCompare(a.date)).map(entry => (
                      <tr key={entry.id} style={{ borderBottom: `1px solid ${B.brd}` }}>
                        <td className="p-2" style={{ color: B.txt }}>{entry.date}</td>
                        <td className="p-2 text-right font-bold" style={{ color: B.grn }}>{fmt(entry.amount)}</td>
                        <td className="p-2" style={{ color: B.pri }}>{funds.find(f => f.id === entry.fundId)?.name || "—"}</td>
                        <td className="p-2" style={{ color: B.mut }}>{entry.details || "—"}</td>
                        <td className="p-2">
                          <button onClick={() => setSavingsLog(p => p.filter(l => l.id !== entry.id))} className="p-1 rounded hover:bg-red-50 opacity-40 hover:opacity-100">
                            <Trash2 size={11} style={{ color: B.red }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Progress chart */}
      {funds.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Progress Overview</span>
          </div>
          <div className="p-4" style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={funds.map(f => ({ name: f.name.length > 12 ? f.name.slice(0, 12) + "..." : f.name, Balance: f.startAmount + getFundSaved(f.id), Remaining: Math.max(0, f.goal - f.startAmount - getFundSaved(f.id)) }))} margin={{ left: 5, right: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Balance" stackId="a" fill={B.grn} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Remaining" stackId="a" fill="#E5E7EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN BUDGET PLANNER COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function BudgetPlanner({ isPro, setShowPro }) {
  const [tab, setTab] = useState("plan");
  const [year, setYear] = useState(new Date().getFullYear());

  // Load from localStorage
  const [budgetData, setBudgetData] = useState(() => {
    try {
      const s = localStorage.getItem("dc_budget_data");
      return s ? JSON.parse(s) : { income: DEFAULT_INCOME, expenses: DEFAULT_EXPENSES, savings: DEFAULT_SAVINGS };
    } catch { return { income: DEFAULT_INCOME, expenses: DEFAULT_EXPENSES, savings: DEFAULT_SAVINGS }; }
  });
  const [transactions, setTransactions] = useState(() => {
    try {
      const s = localStorage.getItem("dc_transactions");
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });
  const [debts, setDebts] = useState(() => {
    try {
      const s = localStorage.getItem("dc_debts");
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });
  const [savingsFunds, setSavingsFunds] = useState(() => {
    try {
      const s = localStorage.getItem("dc_savings_funds");
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });
  const [savingsLog, setSavingsLog] = useState(() => {
    try {
      const s = localStorage.getItem("dc_savings_log");
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem("dc_budget_data", JSON.stringify(budgetData)); } catch {}
  }, [budgetData]);
  useEffect(() => {
    try { localStorage.setItem("dc_transactions", JSON.stringify(transactions)); } catch {}
  }, [transactions]);
  useEffect(() => {
    try { localStorage.setItem("dc_debts", JSON.stringify(debts)); } catch {}
  }, [debts]);
  useEffect(() => {
    try { localStorage.setItem("dc_savings_funds", JSON.stringify(savingsFunds)); } catch {}
  }, [savingsFunds]);
  useEffect(() => {
    try { localStorage.setItem("dc_savings_log", JSON.stringify(savingsLog)); } catch {}
  }, [savingsLog]);

  if (!isPro) {
    return (
      <div className="space-y-6 text-center py-16">
        <div style={{ fontSize: 48 }}>💰</div>
        <div>
          <h3 className="text-xl font-bold mb-2" style={{ color: "#1A1A1A" }}>Budget Planner is a Pro Feature</h3>
          <p className="text-sm max-w-md mx-auto" style={{ color: "#6B7280" }}>
            Personal & business budget planning, transaction tracking, monthly dashboard, and debt snowball calculator — all in one place.
          </p>
        </div>
        <button onClick={() => setShowPro(true)} className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ background: "#C9A54C", color: "#0F1A2E" }}>Upgrade to Pro</button>
      </div>
    );
  }

  const tabs = [
    { id: "plan", label: "Budget Plan", icon: Calendar },
    { id: "transactions", label: "Transactions", icon: List },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "debt", label: "Debt Snowball", icon: CreditCard },
    { id: "burnrate", label: "Burn Rate", icon: Flame },
    { id: "savings", label: "Savings Goals", icon: Target },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#0F1A2E" }}>Budget Planner</h2>
          <p className="text-xs" style={{ color: "#6B7280" }}>Plan, track, and crush your financial goals</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "#F5E6C8", color: "#8B7025" }}>Pro Feature</span>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#F3F4F6" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: tab === t.id ? "#fff" : "transparent", color: tab === t.id ? "#0F1A2E" : "#6B7280",
              boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "plan" && <BudgetPlanTab data={budgetData} setData={setBudgetData} year={year} setYear={setYear} />}
      {tab === "transactions" && <TransactionTab transactions={transactions} setTransactions={setTransactions} budgetData={budgetData} />}
      {tab === "dashboard" && <DashboardTab budgetData={budgetData} transactions={transactions} year={year} />}
      {tab === "debt" && <DebtSnowballTab debts={debts} setDebts={setDebts} />}
      {tab === "burnrate" && <BurnRateTab />}
      {tab === "savings" && <SavingsGoalsTab funds={savingsFunds} setFunds={setSavingsFunds} savingsLog={savingsLog} setSavingsLog={setSavingsLog} />}
    </div>
  );
}
