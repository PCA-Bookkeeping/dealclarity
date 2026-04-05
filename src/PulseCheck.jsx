// ═══════════════════════════════════════════════════════════════
// DEALCLARITY — PULSE CHECK (5-Number Business Snapshot)
// Monthly health check for RE operators
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  DollarSign, TrendingUp, PiggyBank, Plus, Trash2, ChevronDown,
  ChevronUp, BarChart3, Target, Shield, AlertTriangle, Check,
  ArrowUpRight, ArrowDownRight, Calendar, Activity, Briefcase,
  BookOpen,
} from "lucide-react";

// ── Brand (matches DealClarity)
const B = {
  pri: "#0F1A2E", priL: "#1B2D4A", acc: "#2A4066", accL: "#5A82AD",
  gold: "#C9A54C", goldL: "#F5E6C8", goldD: "#8B7025",
  red: "#DC2626", redL: "#FEE2E2", grn: "#16A34A", grnL: "#DCFCE7",
  blue: "#2563EB", blueL: "#DBEAFE", purple: "#7C3AED",
  bg: "#F7F8FA", card: "#FFFFFF", txt: "#1A1A1A", mut: "#6B7280", brd: "#E0E3EA",
};
const PIE_C = [B.pri, B.acc, B.gold, "#EA580C", "#0D9488", B.purple, "#BE185D", B.blue];
const fmt = (n) => n == null || isNaN(n) ? "$0" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fp = (n) => n == null || isNaN(n) ? "0%" : `${(+n).toFixed(1)}%`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Verdict logic
function getVerdict(profitMargin, runway) {
  if (profitMargin >= 25 && runway >= 6) return { text: "Strong — profitable with solid reserves", color: B.grn, bg: B.grnL, icon: Check };
  if (profitMargin >= 15 && runway >= 3) return { text: "Healthy — good margins, adequate runway", color: B.blue, bg: B.blueL, icon: Shield };
  if (profitMargin >= 5 && runway >= 1.5) return { text: "Tight — profitable but thin reserves", color: B.gold, bg: B.goldL, icon: AlertTriangle };
  if (profitMargin > 0) return { text: "Warning — barely profitable, rebuild cash reserves", color: "#EA580C", bg: "#FFF7ED", icon: AlertTriangle };
  return { text: "Critical — operating at a loss, take action now", color: B.red, bg: B.redL, icon: AlertTriangle };
}

// ── Shared UI
const Card = ({ children, style }) => (
  <div className="rounded-xl border" style={{ background: B.card, borderColor: B.brd, ...style }}>{children}</div>
);
const KPI = ({ icon: I, label, value, sub, color, bg }) => (
  <div className="rounded-xl p-4 border" style={{ borderColor: B.brd, background: bg || B.card }}>
    <div className="flex items-center gap-2 mb-1">
      <I size={15} style={{ color: color || B.acc }} />
      <span className="text-xs font-medium" style={{ color: B.mut }}>{label}</span>
    </div>
    <div className="text-xl font-bold" style={{ color: color || B.txt }}>{value}</div>
    {sub && <div className="text-xs mt-0.5" style={{ color: B.mut }}>{sub}</div>}
  </div>
);

// ── Shared Input (module-level to avoid re-mount on state change)
const PulseInput = ({ label, value, onChange, type = "text", pre, placeholder }) => (
  <div className="flex-1 min-w-0">
    <label className="block text-xs font-medium mb-1" style={{ color: B.mut }}>{label}</label>
    <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: B.brd }}>
      {pre && <span className="px-2 text-xs font-medium" style={{ color: B.mut, background: "#F9FAFB" }}>{pre}</span>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full px-2 py-1.5 text-sm outline-none" style={{ color: B.txt }} />
    </div>
  </div>
);

export default function PulseCheck({ isPro, setShowPro }) {
  // ── State
  const [snapshots, setSnapshots] = useState(() => {
    try {
      const s = localStorage.getItem("dc_pulse_snapshots");
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    period: "", businessType: "", activeProjects: "",
    revenue: "", opex: "", cash: "", profitPerProject: "", ownerPay: "",
    projects: [{ id: uid(), name: "", revenue: "" }],
  });

  // ── Persist
  useEffect(() => {
    try { localStorage.setItem("dc_pulse_snapshots", JSON.stringify(snapshots)); } catch {}
  }, [snapshots]);

  // ── Current snapshot (most recent)
  const current = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;

  // ── Computed metrics
  const getMetrics = (snap) => {
    if (!snap) return null;
    const revenue = parseFloat(snap.revenue) || 0;
    const opex = parseFloat(snap.opex) || 0;
    const cash = parseFloat(snap.cash) || 0;
    const ownerPay = parseFloat(snap.ownerPay) || 0;
    const profitPerProject = parseFloat(snap.profitPerProject) || 0;
    const netProfit = revenue - opex;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const monthlyOpex = opex / 12;
    const runway = monthlyOpex > 0 ? cash / monthlyOpex : 999;
    const verdict = getVerdict(profitMargin, runway);
    return { revenue, opex, cash, ownerPay, profitPerProject, netProfit, profitMargin, monthlyOpex, runway, verdict };
  };

  const metrics = getMetrics(current);
  const prevMetrics = getMetrics(prev);

  // ── Form handlers
  const updateForm = (key, val) => setForm(p => ({ ...p, [key]: val }));
  const addProject = () => setForm(p => ({ ...p, projects: [...p.projects, { id: uid(), name: "", revenue: "" }] }));
  const removeProject = (id) => setForm(p => ({ ...p, projects: p.projects.filter(pr => pr.id !== id) }));
  const updateProject = (id, key, val) => setForm(p => ({ ...p, projects: p.projects.map(pr => pr.id === id ? { ...pr, [key]: val } : pr) }));

  const saveSnapshot = () => {
    const revenue = parseFloat(form.revenue) || 0;
    if (!form.period || revenue <= 0) return;
    const snap = {
      id: uid(),
      date: new Date().toISOString(),
      period: form.period,
      businessType: form.businessType,
      activeProjects: parseInt(form.activeProjects) || 0,
      revenue,
      opex: parseFloat(form.opex) || 0,
      cash: parseFloat(form.cash) || 0,
      profitPerProject: parseFloat(form.profitPerProject) || 0,
      ownerPay: parseFloat(form.ownerPay) || 0,
      projects: form.projects.filter(p => p.name && p.revenue),
    };
    setSnapshots(p => [...p, snap]);
    setForm({ period: "", businessType: "", activeProjects: "", revenue: "", opex: "", cash: "", profitPerProject: "", ownerPay: "", projects: [{ id: uid(), name: "", revenue: "" }] });
    setShowForm(false);
  };

  const deleteSnapshot = (id) => setSnapshots(p => p.filter(s => s.id !== id));

  // ── Pro gate
  if (!isPro) {
    return (
      <div className="space-y-6 text-center py-16">
        <div style={{ fontSize: 48 }}>📊</div>
        <div>
          <h3 className="text-xl font-bold mb-2" style={{ color: B.txt }}>Pulse Check is a Pro Feature</h3>
          <p className="text-sm max-w-md mx-auto" style={{ color: B.mut }}>
            Track 5 critical business numbers monthly. Know your profit margin, runway, and operator pay at a glance.
          </p>
        </div>
        <button onClick={() => setShowPro(true)} className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ background: B.gold, color: B.pri }}>Upgrade to Pro</button>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold" style={{ color: B.pri }}>Pulse Check</h2>
          <p className="text-xs" style={{ color: B.mut }}>5 numbers. Every month. Know your business health.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: B.goldL, color: B.goldD }}>Pro Feature</span>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg"
            style={{ background: B.gold, color: B.pri }}>
            <Plus size={13} /> New Snapshot
          </button>
        </div>
      </div>

      {/* New snapshot form */}
      {showForm && (
        <Card>
          <div className="px-4 py-3 border-b" style={{ borderColor: B.brd, background: B.goldL }}>
            <span className="font-semibold text-sm" style={{ color: B.goldD }}>New Monthly Snapshot</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Business info */}
            <div className="flex flex-wrap gap-3">
              <PulseInput label="Period (e.g. Jan-Dec 2026)" value={form.period} onChange={e => updateForm("period", e.target.value)} placeholder="Q1 2026" />
              <PulseInput label="Business Type" value={form.businessType} onChange={e => updateForm("businessType", e.target.value)} placeholder="Flips & Rentals" />
              <PulseInput label="Active Projects" value={form.activeProjects} onChange={e => updateForm("activeProjects", e.target.value)} type="number" pre="#" />
            </div>

            {/* Core 5 numbers */}
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: B.pri }}>THE 5 NUMBERS</p>
              <div className="flex flex-wrap gap-3">
                <PulseInput label="1. Revenue (last 12 months)" value={form.revenue} onChange={e => updateForm("revenue", e.target.value)} type="number" pre="$" />
                <PulseInput label="2. Operating Expenses" value={form.opex} onChange={e => updateForm("opex", e.target.value)} type="number" pre="$" />
                <PulseInput label="3. Cash Position" value={form.cash} onChange={e => updateForm("cash", e.target.value)} type="number" pre="$" />
              </div>
              <div className="flex flex-wrap gap-3 mt-3">
                <PulseInput label="4. Avg Profit per Project" value={form.profitPerProject} onChange={e => updateForm("profitPerProject", e.target.value)} type="number" pre="$" />
                <PulseInput label="5. Owner Cash Paid Out (12mo)" value={form.ownerPay} onChange={e => updateForm("ownerPay", e.target.value)} type="number" pre="$" />
              </div>
            </div>

            {/* Revenue by project */}
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: B.pri }}>REVENUE BY PROJECT (optional)</p>
              {form.projects.map((pr, i) => (
                <div key={pr.id} className="flex gap-2 mb-2 items-end">
                  <PulseInput label={i === 0 ? "Project Name" : ""} value={pr.name} onChange={e => updateProject(pr.id, "name", e.target.value)} placeholder="123 Main St flip" />
                  <PulseInput label={i === 0 ? "Revenue" : ""} value={pr.revenue} onChange={e => updateProject(pr.id, "revenue", e.target.value)} type="number" pre="$" />
                  {form.projects.length > 1 && (
                    <button onClick={() => removeProject(pr.id)} className="p-1.5 rounded hover:bg-red-50 mb-0.5">
                      <Trash2 size={13} style={{ color: B.red }} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addProject} className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg mt-1"
                style={{ background: "#F3F4F6", color: B.mut }}>
                <Plus size={12} /> Add Project
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={saveSnapshot} className="px-5 py-2 rounded-lg text-xs font-bold"
                style={{ background: B.gold, color: B.pri }}>Save Snapshot</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ color: B.mut }}>Cancel</button>
            </div>
          </div>
        </Card>
      )}

      {/* Dashboard — only if we have data */}
      {metrics && current && (
        <>
          {/* Verdict banner */}
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: metrics.verdict.bg, border: `1.5px solid ${metrics.verdict.color}` }}>
            <metrics.verdict.icon size={20} style={{ color: metrics.verdict.color, flexShrink: 0 }} />
            <div>
              <p className="text-sm font-bold" style={{ color: metrics.verdict.color }}>{metrics.verdict.text}</p>
              <p className="text-xs mt-0.5" style={{ color: B.mut }}>
                {current.period} · {current.activeProjects || "—"} active projects · {current.businessType || "—"}
              </p>
            </div>
          </div>

          {/* 5 KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPI icon={DollarSign} label="1. Revenue" value={fmt(metrics.revenue)} color={B.pri} />
            <KPI icon={TrendingUp} label="2. Operating Expenses" value={fmt(metrics.opex)} color={B.red} />
            <KPI icon={PiggyBank} label="3. Cash Position" value={fmt(metrics.cash)} color={B.blue} />
            <KPI icon={Briefcase} label="4. Profit/Project" value={fmt(metrics.profitPerProject)} color={B.gold} />
            <KPI icon={DollarSign} label="5. Owner Pay" value={fmt(metrics.ownerPay)} color={B.purple} />
          </div>

          {/* Computed metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI icon={TrendingUp} label="Net Profit" value={fmt(metrics.netProfit)} color={metrics.netProfit >= 0 ? B.grn : B.red} bg={metrics.netProfit >= 0 ? B.grnL : B.redL} />
            <KPI icon={Target} label="Profit Margin" value={fp(metrics.profitMargin)} color={metrics.profitMargin >= 15 ? B.grn : metrics.profitMargin > 0 ? B.gold : B.red} />
            <KPI icon={Shield} label="Months of Runway" value={metrics.runway >= 999 ? "∞" : metrics.runway.toFixed(1)} sub={metrics.runway < 3 ? "⚠ Below 3 months" : "Healthy"} color={metrics.runway >= 3 ? B.grn : B.red} />
            <KPI icon={Activity} label="Monthly Burn" value={fmt(metrics.monthlyOpex)} sub="OpEx ÷ 12" color={B.acc} />
          </div>

          {/* Revenue by project chart */}
          {current.projects && current.projects.length > 0 && (
            <Card>
              <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
                <span className="font-semibold text-sm" style={{ color: B.pri }}>Revenue by Project</span>
              </div>
              <div className="p-4" style={{ height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={current.projects.map(p => ({ name: p.name.length > 15 ? p.name.slice(0, 15) + "..." : p.name, Revenue: parseFloat(p.revenue) || 0 }))} margin={{ left: 5, right: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Bar dataKey="Revenue" fill={B.gold} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Expense breakdown pie */}
          {metrics.opex > 0 && metrics.ownerPay > 0 && (
            <Card>
              <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
                <span className="font-semibold text-sm" style={{ color: B.pri }}>Where the Money Goes</span>
              </div>
              <div className="p-4" style={{ height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={[
                      { name: "Operating Expenses", value: metrics.opex },
                      { name: "Owner Pay", value: metrics.ownerPay },
                      { name: "Retained Profit", value: Math.max(0, metrics.netProfit - metrics.ownerPay) },
                    ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                      {[B.red, B.purple, B.grn].map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Trend chart (if multiple snapshots) */}
          {snapshots.length > 1 && (
            <Card>
              <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
                <span className="font-semibold text-sm" style={{ color: B.pri }}>Trend Over Time</span>
              </div>
              <div className="p-4" style={{ height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={snapshots.map(s => {
                    const r = parseFloat(s.revenue) || 0, o = parseFloat(s.opex) || 0;
                    return { period: s.period, Revenue: r, "Net Profit": r - o, Cash: parseFloat(s.cash) || 0 };
                  })} margin={{ left: 5, right: 5 }}>
                    <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="Revenue" stroke={B.pri} fill={B.priL} fillOpacity={0.2} strokeWidth={2} />
                    <Area type="monotone" dataKey="Net Profit" stroke={B.grn} fill={B.grnL} fillOpacity={0.3} strokeWidth={2} />
                    <Area type="monotone" dataKey="Cash" stroke={B.blue} fill={B.blueL} fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Book nudge — subtle, contextual */}
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "#FAFBFC", border: `1px solid ${B.brd}` }}>
            <BookOpen size={18} style={{ color: B.gold, flexShrink: 0 }} />
            <p className="text-xs" style={{ color: B.mut }}>
              The 5-Number Snapshot is from <a href="https://www.amazon.com/dp/B0GPXXDQP2" target="_blank" rel="noopener noreferrer" style={{ color: B.pri, fontWeight: 700, textDecoration: "underline" }}>The Books Don't Lie</a> by Fabian Janiszewski — the framework behind DealClarity.
              {" "}<a href="https://profitclarityadvantage.com" target="_blank" rel="noopener noreferrer" style={{ color: B.gold, fontWeight: 600, textDecoration: "none" }}>Learn more →</a>
            </p>
          </div>
        </>
      )}

      {/* Snapshot history */}
      {snapshots.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b" style={{ borderColor: B.brd }}>
            <span className="font-semibold text-sm" style={{ color: B.pri }}>Snapshot History ({snapshots.length})</span>
          </div>
          <div className="divide-y" style={{ borderColor: B.brd }}>
            {[...snapshots].reverse().map(snap => {
              const r = parseFloat(snap.revenue) || 0, o = parseFloat(snap.opex) || 0;
              const margin = r > 0 ? ((r - o) / r) * 100 : 0;
              const c = parseFloat(snap.cash) || 0;
              const mo = o / 12;
              const run = mo > 0 ? c / mo : 999;
              const v = getVerdict(margin, run);
              return (
                <div key={snap.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.color }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: B.pri }}>{snap.period}</p>
                      <p className="text-xs" style={{ color: B.mut }}>
                        Rev {fmt(r)} · Margin {fp(margin)} · Runway {run >= 999 ? "∞" : run.toFixed(1)}mo
                      </p>
                    </div>
                  </div>
                  <button onClick={() => deleteSnapshot(snap.id)} className="p-1.5 rounded hover:bg-red-50 opacity-40 hover:opacity-100 flex-shrink-0">
                    <Trash2 size={13} style={{ color: B.red }} />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {snapshots.length === 0 && !showForm && (
        <div className="text-center py-16" style={{ color: B.mut }}>
          <Activity size={48} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
          <h3 className="text-lg font-bold mb-2" style={{ color: B.txt }}>No snapshots yet</h3>
          <p className="text-sm max-w-sm mx-auto mb-4">
            Track 5 numbers every month to see your business health at a glance. Revenue, expenses, cash, profit per project, and owner pay.
          </p>
          <button onClick={() => setShowForm(true)} className="px-5 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: B.gold, color: B.pri }}>
            <Plus size={14} style={{ display: "inline", verticalAlign: -2 }} /> Create First Snapshot
          </button>
        </div>
      )}
    </div>
  );
}
