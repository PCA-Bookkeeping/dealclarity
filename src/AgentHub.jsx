import { useState, useMemo, useCallback } from "react";
import {
  DollarSign, TrendingUp, Percent, Plus, Trash2, FileText, Users, BarChart3,
  Home, Target, Calculator, PiggyBank, Receipt, Car, Building2, Briefcase,
  ArrowUpRight, ArrowDownRight, Lock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { trackEvent, EVENTS } from "./utils/analytics";

// ═══════════════════════════════════════════════════════════════
// AGENT HUB — Financial Command Center for Real Estate Agents
// Phase 3: Commission Tracker, Tax Planner, Listing Net Sheet,
//          Marketing ROI, Team Dashboard
// ═══════════════════════════════════════════════════════════════

const PIE_C = ["#0F1A2E", "#2A4066", "#C9A54C", "#6B7280", "#DC2626", "#2563EB", "#7C3AED", "#EA580C", "#0D9488", "#BE185D"];

const fmt = (n, currency = "USD") =>
  n == null || isNaN(n)
    ? "$0"
    : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
const fp = (n) => (n == null || isNaN(n) ? "0%" : `${n.toFixed(1)}%`);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Shared UI primitives ──
const Input = ({ label, value, onChange, pre = "$", suf, tip, sm }) => (
  <div className={sm ? "flex-1 min-w-0" : "w-full"}>
    <label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>
      {label}{tip && <span className="ml-1 cursor-help" title={tip}>ℹ️</span>}
    </label>
    <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: "#E0E3EA", background: "#fff" }}>
      {pre && <span className="px-2 text-sm font-medium" style={{ color: "#6B7280", background: "#F9FAFB", borderRight: "1px solid #E0E3EA", padding: "8px 10px" }}>{pre}</span>}
      <input type="number" value={value} min={0} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-full px-3 py-2 text-sm outline-none" style={{ color: "#1A1A1A" }} />
      {suf && <span className="px-2 text-xs whitespace-nowrap" style={{ color: "#6B7280", background: "#F9FAFB", borderLeft: "1px solid #E0E3EA", padding: "8px 10px" }}>{suf}</span>}
    </div>
  </div>
);

const Stat = ({ icon: I, label, value, sub, color = "#0F1A2E", bg = "#F7F8FA" }) => (
  <div className="rounded-xl p-4" style={{ background: bg }}>
    <div className="flex items-center gap-2 mb-1">
      {I && <I size={14} style={{ color }} />}
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "#6B7280" }}>{label}</span>
    </div>
    <div className="text-xl font-bold" style={{ color }}>{value}</div>
    {sub && <div className="text-xs mt-1" style={{ color: "#6B7280" }}>{sub}</div>}
  </div>
);

const ProGate = ({ feature, setShowPro }) => (
  <div className="rounded-2xl p-8 text-center flex flex-col items-center gap-4" style={{ background: "#F7F8FA", border: "2px dashed #E0E3EA" }}>
    <Lock size={40} color="#6B7280" />
    <h3 className="text-lg font-bold" style={{ color: "#1A1A1A" }}>{feature} is a Pro Feature</h3>
    <p className="text-sm" style={{ color: "#6B7280" }}>Upgrade to unlock full Agent Hub capabilities.</p>
    <button onClick={() => setShowPro(true)} className="px-6 py-3 rounded-xl font-semibold text-sm" style={{ background: "#C9A54C", color: "#0F1A2E" }}>Upgrade to Pro</button>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// TAB 1: COMMISSION TRACKER
// ═══════════════════════════════════════════════════════════════
function CommissionTracker({ isPro, setShowPro, currency }) {
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState({ address: "", salePrice: 300000, commRate: 3, split: 70, capLimit: 25000, isBuyer: false, date: new Date().toISOString().slice(0, 10) });

  const addTx = () => {
    if (!isPro && transactions.length >= 5) { setShowPro(true); return; }
    const grossComm = form.salePrice * (form.commRate / 100);
    const agentShare = grossComm * (form.split / 100);
    const tx = { id: uid(), ...form, grossComm, agentShare };
    setTransactions(prev => [tx, ...prev]);
    setForm(f => ({ ...f, address: "", salePrice: 300000 }));
  };
  const removeTx = (id) => setTransactions(prev => prev.filter(t => t.id !== id));

  const stats = useMemo(() => {
    const total = transactions.reduce((s, t) => s + t.agentShare, 0);
    const gross = transactions.reduce((s, t) => s + t.grossComm, 0);
    const capUsed = transactions.reduce((s, t) => s + (t.grossComm - t.agentShare), 0);
    const avgDeal = transactions.length > 0 ? total / transactions.length : 0;
    const buyerDeals = transactions.filter(t => t.isBuyer).length;
    const sellerDeals = transactions.length - buyerDeals;
    return { total, gross, capUsed, avgDeal, deals: transactions.length, buyerDeals, sellerDeals };
  }, [transactions]);

  const capProgress = form.capLimit > 0 ? Math.min(100, (stats.capUsed / form.capLimit) * 100) : 0;
  const capHit = capProgress >= 100;

  return (
    <div className="space-y-6">
      {/* YTD Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="YTD Net Income" value={fmt(stats.total, currency)} color="#16A34A" bg="#DCFCE7" />
        <Stat icon={TrendingUp} label="Gross Commission" value={fmt(stats.gross, currency)} />
        <Stat icon={Target} label="Deals Closed" value={stats.deals} sub={`${stats.buyerDeals} buyer / ${stats.sellerDeals} seller`} />
        <Stat icon={Calculator} label="Avg Per Deal" value={fmt(stats.avgDeal, currency)} />
      </div>

      {/* Cap Tracker */}
      <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold" style={{ color: "#1A1A1A" }}>Brokerage Cap Progress</span>
          <span className="text-xs font-bold" style={{ color: capHit ? "#16A34A" : "#C9A54C" }}>
            {capHit ? "CAP HIT! 100% to you now" : `${fmt(stats.capUsed, currency)} / ${fmt(form.capLimit, currency)}`}
          </span>
        </div>
        <div className="w-full h-4 rounded-full overflow-hidden" style={{ background: "#E0E3EA" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${capProgress}%`, background: capHit ? "#16A34A" : "#C9A54C" }} />
        </div>
        <div className="flex gap-3 mt-3">
          <Input label="Cap Limit" value={form.capLimit} onChange={v => setForm(f => ({ ...f, capLimit: v }))} sm />
          <Input label="Default Split %" value={form.split} onChange={v => setForm(f => ({ ...f, split: v }))} pre="" suf="%" sm />
          <Input label="Default Rate %" value={form.commRate} onChange={v => setForm(f => ({ ...f, commRate: v }))} pre="" suf="%" sm />
        </div>
      </div>

      {/* Add Transaction */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
        <h3 className="text-sm font-bold" style={{ color: "#1A1A1A" }}>Log a Transaction</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="w-full">
            <label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>Property Address</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="e.g. 123 Main St" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#E0E3EA" }} />
          </div>
          <Input label="Sale Price" value={form.salePrice} onChange={v => setForm(f => ({ ...f, salePrice: v }))} sm />
          <div className="w-full">
            <label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#E0E3EA" }} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isBuyer} onChange={e => setForm(f => ({ ...f, isBuyer: e.target.checked }))} />
            Buyer Side
          </label>
          <div className="text-xs" style={{ color: "#6B7280" }}>
            Gross: {fmt(form.salePrice * (form.commRate / 100), currency)} | Your Share: {fmt(form.salePrice * (form.commRate / 100) * (form.split / 100), currency)}
          </div>
        </div>
        <button onClick={addTx} className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2" style={{ background: "#0F1A2E", color: "#fff" }}>
          <Plus size={14} /> Add Transaction
        </button>
      </div>

      {/* Transaction List */}
      {transactions.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E0E3EA" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#0F1A2E", color: "#fff" }}>
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Property</th>
                <th className="text-right px-4 py-2 font-medium">Sale Price</th>
                <th className="text-right px-4 py-2 font-medium">Your Share</th>
                <th className="text-center px-4 py-2 font-medium">Side</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={t.id} style={{ background: i % 2 === 0 ? "#fff" : "#F7F8FA" }}>
                  <td className="px-4 py-2">{t.date}</td>
                  <td className="px-4 py-2 font-medium">{t.address || "—"}</td>
                  <td className="px-4 py-2 text-right">{fmt(t.salePrice, currency)}</td>
                  <td className="px-4 py-2 text-right font-bold" style={{ color: "#16A34A" }}>{fmt(t.agentShare, currency)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: t.isBuyer ? "#DBEAFE" : "#DCFCE7", color: t.isBuyer ? "#2563EB" : "#16A34A" }}>
                      {t.isBuyer ? "Buyer" : "Seller"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => removeTx(t.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: INCOME & TAX PLANNER
// ═══════════════════════════════════════════════════════════════
function TaxPlanner({ isPro, setShowPro, currency }) {
  if (!isPro) return <ProGate feature="Income & Tax Planner" setShowPro={setShowPro} />;
  const [income, setIncome] = useState({ gross: 120000, otherIncome: 0 });
  const [expenses, setExpenses] = useState([
    { id: uid(), name: "MLS / Board Dues", amount: 1800, category: "business" },
    { id: uid(), name: "E&O Insurance", amount: 1200, category: "insurance" },
    { id: uid(), name: "Marketing & Ads", amount: 6000, category: "marketing" },
    { id: uid(), name: "Brokerage Desk Fee", amount: 3600, category: "business" },
    { id: uid(), name: "CRM / Tech Subscriptions", amount: 2400, category: "tech" },
    { id: uid(), name: "Vehicle / Mileage", amount: 4500, category: "vehicle" },
    { id: uid(), name: "Continuing Education", amount: 800, category: "education" },
  ]);
  const [mileage, setMileage] = useState({ miles: 8000, rate: 0.70 });
  const [newExp, setNewExp] = useState({ name: "", amount: 0, category: "business" });

  const CATEGORIES = [
    { id: "business", label: "Business", icon: Briefcase },
    { id: "marketing", label: "Marketing", icon: TrendingUp },
    { id: "tech", label: "Tech / CRM", icon: Calculator },
    { id: "vehicle", label: "Vehicle", icon: Car },
    { id: "insurance", label: "Insurance", icon: Building2 },
    { id: "education", label: "Education", icon: FileText },
  ];

  const addExpense = () => {
    if (!newExp.name || newExp.amount <= 0) return;
    setExpenses(prev => [...prev, { id: uid(), ...newExp }]);
    setNewExp({ name: "", amount: 0, category: "business" });
  };
  const removeExp = (id) => setExpenses(prev => prev.filter(e => e.id !== id));

  const calc = useMemo(() => {
    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
    const mileDeduction = mileage.miles * mileage.rate;
    const totalDeductions = totalExp + mileDeduction;
    const netIncome = income.gross + income.otherIncome - totalDeductions;
    // US Self-Employment Tax (15.3% on 92.35% of net)
    const seTaxableIncome = netIncome * 0.9235;
    const seTax = Math.max(0, seTaxableIncome * 0.153);
    // Estimated income tax (simplified brackets)
    const taxableAfterSE = netIncome - (seTax / 2);
    let incomeTax = 0;
    if (taxableAfterSE > 243725) incomeTax = 243725 * 0.24 + (taxableAfterSE - 243725) * 0.32;
    else if (taxableAfterSE > 100525) incomeTax = 100525 * 0.22 + (taxableAfterSE - 100525) * 0.24;
    else if (taxableAfterSE > 44725) incomeTax = 44725 * 0.12 + (taxableAfterSE - 44725) * 0.22;
    else if (taxableAfterSE > 11600) incomeTax = 11600 * 0 + (taxableAfterSE - 11600) * 0.12;
    else incomeTax = 0;
    incomeTax = Math.max(0, incomeTax);
    const totalTax = seTax + incomeTax;
    const effectiveRate = netIncome > 0 ? (totalTax / netIncome) * 100 : 0;
    const quarterlyPayment = totalTax / 4;
    const takeHome = netIncome - totalTax;
    // By category
    const byCategory = CATEGORIES.map(c => ({
      ...c,
      total: expenses.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0),
    })).filter(c => c.total > 0);

    return { totalExp, mileDeduction, totalDeductions, netIncome, seTax, incomeTax, totalTax, effectiveRate, quarterlyPayment, takeHome, byCategory };
  }, [income, expenses, mileage]);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Gross Income" value={fmt(income.gross + income.otherIncome, currency)} />
        <Stat icon={Receipt} label="Total Deductions" value={fmt(calc.totalDeductions, currency)} color="#DC2626" bg="#FEE2E2" />
        <Stat icon={PiggyBank} label="Est. Take-Home" value={fmt(calc.takeHome, currency)} color="#16A34A" bg="#DCFCE7" />
        <Stat icon={Target} label="Quarterly Payment" value={fmt(calc.quarterlyPayment, currency)} sub={`${fp(calc.effectiveRate)} effective rate`} color="#2563EB" bg="#DBEAFE" />
      </div>

      {/* Income */}
      <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: "#1A1A1A" }}>Income</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Gross Commission Income (YTD)" value={income.gross} onChange={v => setIncome(p => ({ ...p, gross: v }))} />
          <Input label="Other Income (Coaching, Referrals, etc.)" value={income.otherIncome} onChange={v => setIncome(p => ({ ...p, otherIncome: v }))} />
        </div>
      </div>

      {/* Tax Breakdown */}
      <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: "#1A1A1A" }}>Tax Estimate (US Self-Employed)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span style={{ color: "#6B7280" }}>Net Income:</span> <span className="font-bold">{fmt(calc.netIncome, currency)}</span></div>
          <div><span style={{ color: "#6B7280" }}>SE Tax (15.3%):</span> <span className="font-bold" style={{ color: "#DC2626" }}>{fmt(calc.seTax, currency)}</span></div>
          <div><span style={{ color: "#6B7280" }}>Income Tax:</span> <span className="font-bold" style={{ color: "#DC2626" }}>{fmt(calc.incomeTax, currency)}</span></div>
          <div><span style={{ color: "#6B7280" }}>Total Tax:</span> <span className="font-bold" style={{ color: "#DC2626" }}>{fmt(calc.totalTax, currency)}</span></div>
          <div><span style={{ color: "#6B7280" }}>Quarterly Due:</span> <span className="font-bold" style={{ color: "#2563EB" }}>{fmt(calc.quarterlyPayment, currency)}</span></div>
          <div><span style={{ color: "#6B7280" }}>Take-Home:</span> <span className="font-bold" style={{ color: "#16A34A" }}>{fmt(calc.takeHome, currency)}</span></div>
        </div>
      </div>

      {/* Expenses */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
        <h3 className="text-sm font-bold" style={{ color: "#1A1A1A" }}>Business Expenses</h3>
        {expenses.map(e => (
          <div key={e.id} className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: "#F3F4F6" }}>
            <div>
              <span className="text-sm font-medium">{e.name}</span>
              <span className="text-xs ml-2 px-2 py-0.5 rounded-full" style={{ background: "#F3F4F6", color: "#6B7280" }}>{e.category}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold" style={{ color: "#DC2626" }}>{fmt(e.amount, currency)}</span>
              <button onClick={() => removeExp(e.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        <div className="flex gap-2 items-end pt-2">
          <div className="flex-1">
            <label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>Expense Name</label>
            <input type="text" value={newExp.name} onChange={e => setNewExp(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Zillow Premier Agent" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#E0E3EA" }} />
          </div>
          <Input label="Amount" value={newExp.amount} onChange={v => setNewExp(p => ({ ...p, amount: v }))} sm />
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>Category</label>
            <select value={newExp.category} onChange={e => setNewExp(p => ({ ...p, category: e.target.value }))}
              className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#E0E3EA" }}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <button onClick={addExpense} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "#0F1A2E", color: "#fff" }}><Plus size={14} /></button>
        </div>
      </div>

      {/* Mileage */}
      <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
        <h3 className="text-sm font-bold mb-3" style={{ color: "#1A1A1A" }}>Mileage Deduction</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input label="Business Miles (YTD)" value={mileage.miles} onChange={v => setMileage(p => ({ ...p, miles: v }))} pre="" suf="mi" />
          <Input label="IRS Rate" value={mileage.rate} onChange={v => setMileage(p => ({ ...p, rate: v }))} pre="$" suf="/mi" />
          <Stat icon={Car} label="Mileage Deduction" value={fmt(calc.mileDeduction, currency)} color="#16A34A" bg="#DCFCE7" />
        </div>
      </div>

      {/* Expense Breakdown Chart */}
      {calc.byCategory.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: "#1A1A1A" }}>Expense Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={calc.byCategory} layout="vertical">
              <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => fmt(v, currency)} />
              <Bar dataKey="total" fill="#C9A54C" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: LISTING NET SHEET
// ═══════════════════════════════════════════════════════════════
function ListingNetSheet({ isPro, setShowPro, currency }) {
  const [form, setForm] = useState({
    salePrice: 450000,
    mortgageBalance: 280000,
    listingCommission: 2.5,
    buyerCommission: 2.5,
    closingCostRate: 2.0,
    titleInsurance: 2500,
    transferTax: 0.5,
    homeWarranty: 500,
    repairsCredit: 0,
    otherFees: 1500,
  });

  const calc = useMemo(() => {
    const listingComm = form.salePrice * (form.listingCommission / 100);
    const buyerComm = form.salePrice * (form.buyerCommission / 100);
    const totalComm = listingComm + buyerComm;
    const closingCosts = form.salePrice * (form.closingCostRate / 100);
    const transferTaxAmt = form.salePrice * (form.transferTax / 100);
    const totalCosts = totalComm + closingCosts + form.titleInsurance + transferTaxAmt + form.homeWarranty + form.repairsCredit + form.otherFees;
    const sellerNet = form.salePrice - form.mortgageBalance - totalCosts;
    const costBreakdown = [
      { name: "Listing Commission", value: listingComm },
      { name: "Buyer Commission", value: buyerComm },
      { name: "Closing Costs", value: closingCosts },
      { name: "Title Insurance", value: form.titleInsurance },
      { name: "Transfer Tax", value: transferTaxAmt },
      { name: "Home Warranty", value: form.homeWarranty },
      { name: "Repairs Credit", value: form.repairsCredit },
      { name: "Other Fees", value: form.otherFees },
    ].filter(c => c.value > 0);
    return { listingComm, buyerComm, totalComm, closingCosts, transferTaxAmt, totalCosts, sellerNet, costBreakdown };
  }, [form]);

  const exportNetSheetPDF = () => {
    if (!isPro) { setShowPro(true); return; }
    const doc = new jsPDF();
    doc.setFillColor(15, 26, 46);
    doc.rect(0, 0, 210, 35, "F");
    doc.setTextColor(255);
    doc.setFontSize(20);
    doc.text("Seller Net Sheet", 15, 20);
    doc.setFontSize(10);
    doc.text(`Prepared ${new Date().toLocaleDateString()}`, 15, 28);
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`Sale Price: ${fmt(form.salePrice, currency)}`, 15, 45);
    doc.text(`Mortgage Balance: ${fmt(form.mortgageBalance, currency)}`, 15, 53);
    const rows = calc.costBreakdown.map(c => [c.name, fmt(c.value, currency)]);
    rows.push(["TOTAL COSTS", fmt(calc.totalCosts, currency)]);
    rows.push(["ESTIMATED SELLER NET", fmt(calc.sellerNet, currency)]);
    autoTable(doc, { startY: 60, head: [["Item", "Amount"]], body: rows, theme: "grid", headStyles: { fillColor: [15, 26, 46] } });
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Powered by DealClarity | This is an estimate only", 15, doc.internal.pageSize.height - 10);
    doc.save("Seller-Net-Sheet.pdf");
    trackEvent("net_sheet_exported");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat icon={Home} label="Sale Price" value={fmt(form.salePrice, currency)} />
        <Stat icon={Building2} label="Total Costs" value={fmt(calc.totalCosts, currency)} color="#DC2626" bg="#FEE2E2" />
        <Stat icon={DollarSign} label="Seller Net" value={fmt(calc.sellerNet, currency)} color={calc.sellerNet >= 0 ? "#16A34A" : "#DC2626"} bg={calc.sellerNet >= 0 ? "#DCFCE7" : "#FEE2E2"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="rounded-xl p-4 space-y-3" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
          <h3 className="text-sm font-bold" style={{ color: "#1A1A1A" }}>Property Details</h3>
          <Input label="Sale Price" value={form.salePrice} onChange={v => setForm(f => ({ ...f, salePrice: v }))} />
          <Input label="Mortgage Balance" value={form.mortgageBalance} onChange={v => setForm(f => ({ ...f, mortgageBalance: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Listing Commission %" value={form.listingCommission} onChange={v => setForm(f => ({ ...f, listingCommission: v }))} pre="" suf="%" />
            <Input label="Buyer Commission %" value={form.buyerCommission} onChange={v => setForm(f => ({ ...f, buyerCommission: v }))} pre="" suf="%" />
          </div>
          <Input label="Closing Costs %" value={form.closingCostRate} onChange={v => setForm(f => ({ ...f, closingCostRate: v }))} pre="" suf="%" />
          <Input label="Title Insurance" value={form.titleInsurance} onChange={v => setForm(f => ({ ...f, titleInsurance: v }))} />
          <Input label="Transfer Tax %" value={form.transferTax} onChange={v => setForm(f => ({ ...f, transferTax: v }))} pre="" suf="%" />
          <Input label="Home Warranty" value={form.homeWarranty} onChange={v => setForm(f => ({ ...f, homeWarranty: v }))} />
          <Input label="Repairs / Seller Credit" value={form.repairsCredit} onChange={v => setForm(f => ({ ...f, repairsCredit: v }))} />
          <Input label="Other Fees" value={form.otherFees} onChange={v => setForm(f => ({ ...f, otherFees: v }))} />
        </div>

        {/* Breakdown */}
        <div className="space-y-4">
          <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: "#1A1A1A" }}>Cost Breakdown</h3>
            {calc.costBreakdown.map((c, i) => (
              <div key={i} className="flex justify-between py-1.5 border-b text-sm" style={{ borderColor: "#F3F4F6" }}>
                <span style={{ color: "#6B7280" }}>{c.name}</span>
                <span className="font-medium" style={{ color: "#DC2626" }}>{fmt(c.value, currency)}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 mt-2 text-sm font-bold" style={{ borderTop: "2px solid #0F1A2E" }}>
              <span>Seller Net Proceeds</span>
              <span style={{ color: calc.sellerNet >= 0 ? "#16A34A" : "#DC2626", fontSize: 18 }}>{fmt(calc.sellerNet, currency)}</span>
            </div>
          </div>
          <button onClick={exportNetSheetPDF} className="w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "#0F1A2E", color: "#fff" }}>
            <FileText size={16} /> Export Net Sheet PDF {!isPro && "(Pro)"}
          </button>
          {calc.costBreakdown.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={calc.costBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {calc.costBreakdown.map((_, i) => <Cell key={i} fill={PIE_C[i % PIE_C.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v, currency)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: MARKETING ROI (Pro Only — full build next session)
// ═══════════════════════════════════════════════════════════════
function MarketingROI({ isPro, setShowPro, currency }) {
  const [campaigns, setCampaigns] = useState([
    { id: uid(), channel: "Zillow Premier Agent", spend: 1200, leads: 15, deals: 1, revenue: 8500 },
    { id: uid(), channel: "Facebook/IG Ads", spend: 800, leads: 22, deals: 0, revenue: 0 },
    { id: uid(), channel: "Open Houses", spend: 200, leads: 8, deals: 1, revenue: 6200 },
    { id: uid(), channel: "Referrals / SOI", spend: 50, leads: 5, deals: 2, revenue: 14000 },
  ]);
  const [newCamp, setNewCamp] = useState({ channel: "", spend: 0, leads: 0, deals: 0, revenue: 0 });

  if (!isPro) return <ProGate feature="Marketing ROI Tracker" setShowPro={setShowPro} />;

  const addCampaign = () => {
    if (!newCamp.channel) return;
    setCampaigns(prev => [...prev, { id: uid(), ...newCamp }]);
    setNewCamp({ channel: "", spend: 0, leads: 0, deals: 0, revenue: 0 });
  };
  const removeCamp = (id) => setCampaigns(prev => prev.filter(c => c.id !== id));

  const totals = useMemo(() => {
    const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
    const totalLeads = campaigns.reduce((s, c) => s + c.leads, 0);
    const totalDeals = campaigns.reduce((s, c) => s + c.deals, 0);
    const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
    const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
    const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const costPerDeal = totalDeals > 0 ? totalSpend / totalDeals : 0;
    return { totalSpend, totalLeads, totalDeals, totalRevenue, roi, costPerLead, costPerDeal };
  }, [campaigns]);

  const chartData = campaigns.map(c => ({
    name: c.channel.length > 15 ? c.channel.slice(0, 15) + "..." : c.channel,
    ROI: c.spend > 0 ? ((c.revenue - c.spend) / c.spend) * 100 : 0,
    Spend: c.spend,
    Revenue: c.revenue,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Total Spend" value={fmt(totals.totalSpend, currency)} color="#DC2626" bg="#FEE2E2" />
        <Stat icon={TrendingUp} label="Total Revenue" value={fmt(totals.totalRevenue, currency)} color="#16A34A" bg="#DCFCE7" />
        <Stat icon={Percent} label="Overall ROI" value={fp(totals.roi)} color={totals.roi > 0 ? "#16A34A" : "#DC2626"} />
        <Stat icon={Target} label="Cost / Lead" value={fmt(totals.costPerLead, currency)} sub={`${fmt(totals.costPerDeal, currency)}/deal`} />
      </div>

      {chartData.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #E0E3EA" }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: "#1A1A1A" }}>Revenue vs Spend by Channel</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => typeof v === "number" && v > 100 ? fmt(v, currency) : fp(v)} />
              <Bar dataKey="Spend" fill="#DC2626" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Revenue" fill="#16A34A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E0E3EA" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#0F1A2E", color: "#fff" }}>
              <th className="text-left px-3 py-2 font-medium">Channel</th>
              <th className="text-right px-3 py-2 font-medium">Spend</th>
              <th className="text-right px-3 py-2 font-medium">Leads</th>
              <th className="text-right px-3 py-2 font-medium">Deals</th>
              <th className="text-right px-3 py-2 font-medium">Revenue</th>
              <th className="text-right px-3 py-2 font-medium">ROI</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c, i) => {
              const roi = c.spend > 0 ? ((c.revenue - c.spend) / c.spend) * 100 : 0;
              return (
                <tr key={c.id} style={{ background: i % 2 === 0 ? "#fff" : "#F7F8FA" }}>
                  <td className="px-3 py-2 font-medium">{c.channel}</td>
                  <td className="px-3 py-2 text-right">{fmt(c.spend, currency)}</td>
                  <td className="px-3 py-2 text-right">{c.leads}</td>
                  <td className="px-3 py-2 text-right">{c.deals}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: "#16A34A" }}>{fmt(c.revenue, currency)}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: roi > 0 ? "#16A34A" : "#DC2626" }}>{fp(roi)}</td>
                  <td className="px-3 py-2 text-center"><button onClick={() => removeCamp(c.id)}><Trash2 size={14} className="text-red-400" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>Channel</label>
          <input type="text" value={newCamp.channel} onChange={e => setNewCamp(p => ({ ...p, channel: e.target.value }))}
            placeholder="e.g. Google Ads" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#E0E3EA" }} />
        </div>
        <Input label="Spend" value={newCamp.spend} onChange={v => setNewCamp(p => ({ ...p, spend: v }))} sm />
        <Input label="Leads" value={newCamp.leads} onChange={v => setNewCamp(p => ({ ...p, leads: v }))} pre="" sm />
        <Input label="Deals" value={newCamp.deals} onChange={v => setNewCamp(p => ({ ...p, deals: v }))} pre="" sm />
        <Input label="Revenue" value={newCamp.revenue} onChange={v => setNewCamp(p => ({ ...p, revenue: v }))} sm />
        <button onClick={addCampaign} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "#0F1A2E", color: "#fff" }}><Plus size={14} /></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 5: TEAM DASHBOARD (Pro Only — structure ready)
// ═══════════════════════════════════════════════════════════════
function TeamDashboard({ isPro, setShowPro, currency }) {
  const [agents, setAgents] = useState([
    { id: uid(), name: "Sarah Johnson", deals: 8, volume: 3200000, commission: 64000, cap: 25000, capUsed: 18000 },
    { id: uid(), name: "Mike Torres", deals: 12, volume: 4800000, commission: 96000, cap: 25000, capUsed: 25000 },
    { id: uid(), name: "Lisa Chen", deals: 5, volume: 2100000, commission: 42000, cap: 25000, capUsed: 12000 },
  ]);
  const [newAgent, setNewAgent] = useState({ name: "", deals: 0, volume: 0, commission: 0, cap: 25000, capUsed: 0 });

  if (!isPro) return <ProGate feature="Team Dashboard" setShowPro={setShowPro} />;

  const addAgent = () => {
    if (!newAgent.name) return;
    setAgents(prev => [...prev, { id: uid(), ...newAgent }]);
    setNewAgent({ name: "", deals: 0, volume: 0, commission: 0, cap: 25000, capUsed: 0 });
  };
  const removeAgent = (id) => setAgents(prev => prev.filter(a => a.id !== id));

  const totals = useMemo(() => ({
    agents: agents.length,
    deals: agents.reduce((s, a) => s + a.deals, 0),
    volume: agents.reduce((s, a) => s + a.volume, 0),
    commission: agents.reduce((s, a) => s + a.commission, 0),
    brokerageRevenue: agents.reduce((s, a) => s + Math.min(a.capUsed, a.cap), 0),
  }), [agents]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Users} label="Active Agents" value={totals.agents} />
        <Stat icon={Target} label="Team Deals" value={totals.deals} />
        <Stat icon={DollarSign} label="Team Volume" value={fmt(totals.volume, currency)} color="#2563EB" bg="#DBEAFE" />
        <Stat icon={PiggyBank} label="Brokerage Revenue" value={fmt(totals.brokerageRevenue, currency)} color="#16A34A" bg="#DCFCE7" sub="From cap splits" />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E0E3EA" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#0F1A2E", color: "#fff" }}>
              <th className="text-left px-3 py-2 font-medium">Agent</th>
              <th className="text-right px-3 py-2 font-medium">Deals</th>
              <th className="text-right px-3 py-2 font-medium">Volume</th>
              <th className="text-right px-3 py-2 font-medium">GCI</th>
              <th className="text-right px-3 py-2 font-medium">Cap Progress</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a, i) => {
              const capPct = a.cap > 0 ? Math.min(100, (a.capUsed / a.cap) * 100) : 0;
              return (
                <tr key={a.id} style={{ background: i % 2 === 0 ? "#fff" : "#F7F8FA" }}>
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2 text-right">{a.deals}</td>
                  <td className="px-3 py-2 text-right">{fmt(a.volume, currency)}</td>
                  <td className="px-3 py-2 text-right font-bold" style={{ color: "#16A34A" }}>{fmt(a.commission, currency)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "#E0E3EA" }}>
                        <div className="h-full rounded-full" style={{ width: `${capPct}%`, background: capPct >= 100 ? "#16A34A" : "#C9A54C" }} />
                      </div>
                      <span className="text-xs font-medium" style={{ color: capPct >= 100 ? "#16A34A" : "#6B7280" }}>
                        {capPct >= 100 ? "CAP" : `${capPct.toFixed(0)}%`}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center"><button onClick={() => removeAgent(a.id)}><Trash2 size={14} className="text-red-400" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium mb-1" style={{ color: "#6B7280" }}>Agent Name</label>
          <input type="text" value={newAgent.name} onChange={e => setNewAgent(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Jane Smith" className="w-full px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#E0E3EA" }} />
        </div>
        <Input label="Deals" value={newAgent.deals} onChange={v => setNewAgent(p => ({ ...p, deals: v }))} pre="" sm />
        <Input label="Volume" value={newAgent.volume} onChange={v => setNewAgent(p => ({ ...p, volume: v }))} sm />
        <Input label="GCI" value={newAgent.commission} onChange={v => setNewAgent(p => ({ ...p, commission: v }))} sm />
        <Input label="Cap Used" value={newAgent.capUsed} onChange={v => setNewAgent(p => ({ ...p, capUsed: v }))} sm />
        <button onClick={addAgent} className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: "#0F1A2E", color: "#fff" }}><Plus size={14} /></button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN AGENT HUB COMPONENT
// ═══════════════════════════════════════════════════════════════
const TABS = [
  { id: "commissions", label: "Commissions", icon: DollarSign, free: true },
  { id: "tax", label: "Tax Planner", icon: Receipt, free: false },
  { id: "netsheet", label: "Net Sheet", icon: Home, free: true },
  { id: "marketing", label: "Marketing ROI", icon: BarChart3, free: false },
  { id: "team", label: "Team", icon: Users, free: false },
];

export default function AgentHub({ t, isPro, setShowPro, user }) {
  const [tab, setTab] = useState("commissions");
  const currency = "USD"; // Phase 3.7 will make this dynamic

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#0F1A2E" }}>Agent Hub</h2>
          <p className="text-xs" style={{ color: "#6B7280" }}>Financial command center for real estate agents</p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: "#F5E6C8", color: "#8B7025" }}>Pro Feature</span>
      </div>

      {/* Free user banner */}
      {!isPro && (
        <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "#DBEAFE", border: "1.5px solid #2563EB" }}>
          <div className="flex items-center gap-2">
            <Lock size={14} style={{ color: "#2563EB" }} />
            <span className="text-xs font-medium" style={{ color: "#2563EB" }}>You're using the free preview. Upgrade to unlock all tabs and remove limits.</span>
          </div>
          <button onClick={() => setShowPro(true)} className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ background: "#2563EB", color: "#fff" }}>Upgrade</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
            style={{
              background: tab === tb.id ? "#0F1A2E" : "#fff",
              color: tab === tb.id ? "#fff" : "#6B7280",
              border: tab === tb.id ? "none" : "1px solid #E0E3EA",
            }}>
            <tb.icon size={14} /> {tb.label}
            {!tb.free && !isPro && <Lock size={10} style={{ marginLeft: 2, opacity: 0.6 }} />}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "commissions" && <CommissionTracker isPro={isPro} setShowPro={setShowPro} currency={currency} />}
      {tab === "tax" && <TaxPlanner isPro={isPro} setShowPro={setShowPro} currency={currency} />}
      {tab === "netsheet" && <ListingNetSheet isPro={isPro} setShowPro={setShowPro} currency={currency} />}
      {tab === "marketing" && <MarketingROI isPro={isPro} setShowPro={setShowPro} currency={currency} />}
      {tab === "team" && <TeamDashboard isPro={isPro} setShowPro={setShowPro} currency={currency} />}
    </div>
  );
}
