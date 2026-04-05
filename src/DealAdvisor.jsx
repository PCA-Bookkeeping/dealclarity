// ═══════════════════════════════════════════════════════════════
// DealClarity – Phase 4: AI Deal Advisor & Intelligence
// 4.1: Deal Advisor (score explanation, recommendations, red flags)
// 4.2: Market Intelligence (benchmarks, neighborhood scoring)
// 4.3: Smart Alerts (threshold monitoring, portfolio health)
// 4.4: AI Report Generator (investor-ready PDF)
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useCallback, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, PieChart, Pie, Cell,
} from "recharts";
import {
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Shield, Target,
  DollarSign, Award, Zap, Lock, Brain, FileText, Download, ChevronDown,
  ChevronUp, MapPin, BarChart3, Bell, Eye, Lightbulb, XCircle, ArrowRight,
  Building2, Clock, Percent, Star, AlertCircle,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { B } from "./utils/brand";
import { fmt, fp, clamp } from "./utils/formatters";

// ═══════════════════════════════════════════════════════════════
// 4.1: DEAL ADVISOR ENGINE
// ═══════════════════════════════════════════════════════════════

const BENCHMARKS = {
  flip: { minMargin: 15, goodMargin: 25, minROI: 20, goodROI: 40, maxHold: 6, goodHold: 4, minProfit: 25000 },
  brrrr: { minCoC: 8, goodCoC: 15, minCF: 200, goodCF: 400, maxCashLeft: 0.3, infGoal: true },
  rental: { minCoC: 8, goodCoC: 12, minCF: 200, goodCF: 400, maxExpRatio: 55, minDSCR: 1.25, goodDSCR: 1.5, maxVacancy: 10 },
  str: { minCoC: 10, goodCoC: 18, minCF: 500, goodCF: 1000, maxExpRatio: 50, minOcc: 60, goodOcc: 75 },
  wholesale: { minFee: 5000, goodFee: 15000, minMargin: 5, goodMargin: 15 },
  multi: { minCoC: 8, goodCoC: 14, minCF: 100, goodCF: 250, maxExpRatio: 55, minDSCR: 1.2, minCapRate: 6 },
  mhp: { minCoC: 10, goodCoC: 18, minCF: 3000, goodCF: 6000, maxExpRatio: 45, minCapRate: 8 },
  storage: { minCoC: 10, goodCoC: 16, minCF: 2000, goodCF: 5000, maxExpRatio: 40, minCapRate: 8 },
};

function generateRedFlags(type, calc, inputs) {
  const flags = [];
  const b = BENCHMARKS[type] || {};

  // Universal flags
  if (calc.score < 35) flags.push({ severity: "critical", msg: "Deal score is in the danger zone. This deal has fundamental problems that need addressing before moving forward.", icon: XCircle });
  if (calc.score >= 35 && calc.score < 50) flags.push({ severity: "warning", msg: "Deal score is marginal. There's potential here, but the numbers need to get tighter before you commit capital.", icon: AlertTriangle });

  // Flip specific
  if (type === "flip") {
    if (calc.margin < 10) flags.push({ severity: "critical", msg: `Profit margin of ${calc.margin?.toFixed(1)}% leaves almost no room for error. One unexpected plumbing issue or permit delay and you're underwater. Most experienced flippers won't touch anything under 15%.`, icon: XCircle });
    else if (calc.margin < b.minMargin) flags.push({ severity: "warning", msg: `Profit margin of ${calc.margin?.toFixed(1)}% is below the ${b.minMargin}% threshold. You can make this work, but your rehab budget and timeline need to be airtight.`, icon: AlertTriangle });
    if (inputs.holdMonths > b.maxHold) flags.push({ severity: "warning", msg: `${inputs.holdMonths}-month hold timeline is long for a flip. Every extra month is carrying costs eating your profit. Can you tighten the rehab schedule?`, icon: Clock });
    if (calc.profit < b.minProfit) flags.push({ severity: "warning", msg: `${fmt(calc.profit)} profit on a flip isn't worth the risk, stress, and opportunity cost. Most operators need at least ${fmt(b.minProfit)} per flip to justify the work.`, icon: DollarSign });
    if (calc.hidden > 5000) flags.push({ severity: "info", msg: `There's ${fmt(calc.hidden)} in hidden costs that a basic calculator wouldn't show you. This is the gap between what people think they'll make and what they actually take home.`, icon: Eye });
  }

  // BRRRR specific
  if (type === "brrrr") {
    if (calc.moCF < 0) flags.push({ severity: "critical", msg: `Negative cash flow of ${fmt(calc.moCF)}/mo after refi. This deal costs you money every month. Either your ARV needs to be higher, your refi LTV lower, or your rent estimate higher.`, icon: XCircle });
    else if (calc.moCF < b.minCF) flags.push({ severity: "warning", msg: `${fmt(calc.moCF)}/mo cash flow is thin for a BRRRR. One vacancy or repair and you're negative. Target at least ${fmt(b.minCF)}/mo for a comfortable buffer.`, icon: AlertTriangle });
    if (!calc.infinite && calc.cashLeft > 0 && calc.coC < b.minCoC) flags.push({ severity: "warning", msg: `Cash-on-cash of ${calc.coC?.toFixed(1)}% with ${fmt(calc.cashLeft)} still in the deal. The whole point of BRRRR is getting your capital back. Review your ARV and refi terms.`, icon: Percent });
    if (calc.infinite) flags.push({ severity: "success", msg: "Infinite return achieved. You've pulled all your capital out and still have positive cash flow. This is the BRRRR dream scenario.", icon: Star });
  }

  // Rental specific
  if (type === "rental") {
    if (calc.moCF < 0) flags.push({ severity: "critical", msg: `Negative cash flow of ${fmt(calc.moCF)}/mo. This property costs you money every single month. Either purchase price is too high, rents too low, or expenses are out of control.`, icon: XCircle });
    else if (calc.moCF < b.minCF) flags.push({ severity: "warning", msg: `${fmt(calc.moCF)}/mo cash flow gives you very little buffer. One HVAC repair or a month of vacancy wipes out several months of profit.`, icon: AlertTriangle });
    if (calc.dscr && calc.dscr < b.minDSCR) flags.push({ severity: "warning", msg: `DSCR of ${calc.dscr?.toFixed(2)} is below the ${b.minDSCR} minimum most lenders require. This deal may not qualify for conventional financing.`, icon: Shield });
    if (calc.expenseRatio > b.maxExpRatio) flags.push({ severity: "warning", msg: `Expense ratio of ${calc.expenseRatio?.toFixed(0)}% is higher than the ${b.maxExpRatio}% benchmark. Review your line items for costs you can reduce or eliminate.`, icon: BarChart3 });
    if (calc.coC < b.minCoC && calc.coC > 0) flags.push({ severity: "warning", msg: `Cash-on-cash of ${calc.coC?.toFixed(1)}% is below the ${b.minCoC}% threshold most operators target. Compare against other investment vehicles before committing.`, icon: Percent });
  }

  // STR specific
  if (type === "str") {
    if (calc.moCF < 0) flags.push({ severity: "critical", msg: `Negative cash flow of ${fmt(calc.moCF)}/mo. Short-term rental economics aren't working here. Check your nightly rate, occupancy assumptions, and cleaning costs.`, icon: XCircle });
    if (inputs.occupancy && inputs.occupancy < 50) flags.push({ severity: "warning", msg: `${inputs.occupancy}% occupancy is risky. Many STR operators overestimate bookings in year one. Start with conservative assumptions and adjust up.`, icon: AlertTriangle });
    if (calc.coC > b.goodCoC) flags.push({ severity: "success", msg: `Strong ${calc.coC?.toFixed(1)}% cash-on-cash for an STR. This property is performing well above benchmark.`, icon: Star });
  }

  // Multi-family
  if (type === "multi") {
    if (calc.capRate && calc.capRate < b.minCapRate) flags.push({ severity: "warning", msg: `Cap rate of ${calc.capRate?.toFixed(1)}% is below the ${b.minCapRate}% minimum for multifamily. Either the purchase price is too high or NOI needs to increase.`, icon: Percent });
    if (calc.moCF < 0) flags.push({ severity: "critical", msg: `Negative cash flow across units. The property isn't covering its own expenses. Review rent rolls, vacancy, and operating costs.`, icon: XCircle });
  }

  // Wholesale
  if (type === "wholesale") {
    if (calc.fee && calc.fee < b.minFee) flags.push({ severity: "warning", msg: `${fmt(calc.fee)} wholesale fee is low. After marketing and earnest money risk, you need at least ${fmt(b.minFee)} per deal to make wholesaling sustainable.`, icon: DollarSign });
    if (calc.profit && calc.profit > 50000) flags.push({ severity: "success", msg: `${fmt(calc.profit)} is an excellent wholesale margin. Make sure your buyer's numbers still work with your fee included.`, icon: Star });
  }

  // Universal positive
  if (calc.score >= 80 && flags.filter(f => f.severity === "critical").length === 0) {
    flags.push({ severity: "success", msg: "Strong fundamentals across the board. The numbers support moving forward. Now do your due diligence on the physical property and neighborhood.", icon: CheckCircle2 });
  }

  return flags;
}

function generateRecommendations(type, calc, inputs) {
  const recs = [];

  // Flip recommendations
  if (type === "flip") {
    if (calc.margin < 20) recs.push({ action: "Negotiate purchase price down", impact: "high", detail: `Reducing purchase by ${fmt(inputs.purchasePrice * 0.05)} would add ~5 points to your margin. That's the difference between a risky flip and a solid one.` });
    if (inputs.holdMonths > 5) recs.push({ action: "Tighten rehab timeline", impact: "high", detail: `Every month saved reduces holding costs by ~${fmt(calc.moHold || 0)}. Get your contractor to commit to milestones with penalties.` });
    if (calc.roi < 30) recs.push({ action: "Reduce rehab scope", impact: "medium", detail: "Focus on high-ROI improvements: kitchen, bathrooms, curb appeal. Skip cosmetic upgrades that don't move the ARV needle." });
    if (inputs.agentCommission > 5) recs.push({ action: "Negotiate agent commission", impact: "medium", detail: `At ${inputs.agentCommission}%, you're paying ${fmt(inputs.arv * inputs.agentCommission / 100)} in agent fees. Consider a flat-fee listing or negotiate a lower rate.` });
  }

  // BRRRR recommendations
  if (type === "brrrr") {
    if (!calc.infinite && calc.cashLeft > 0) recs.push({ action: "Increase ARV through value-add", impact: "high", detail: `You need ${fmt(calc.cashLeft)} more in appraised value to achieve an infinite return. Can you add square footage, an ADU, or a bedroom?` });
    if (calc.moCF < 400 && calc.moCF > 0) recs.push({ action: "Explore rent optimization", impact: "medium", detail: `Current cash flow of ${fmt(calc.moCF)}/mo has room to grow. Consider: rent premiums for pet-friendly units, storage rentals, or covered parking fees.` });
    if (inputs.refiLTV < 75) recs.push({ action: "Shop refi terms aggressively", impact: "high", detail: `At ${inputs.refiLTV}% LTV, you're leaving equity on the table. Many lenders will go to 75-80% LTV on investment properties.` });
  }

  // Rental recommendations
  if (type === "rental") {
    if (calc.moCF < 300 && calc.moCF > 0) recs.push({ action: "Reduce operating expenses", impact: "high", detail: "Self-manage to eliminate PM fees. Shop insurance annually. Consider a higher deductible to lower premiums." });
    if (inputs.downPayment > 25) recs.push({ action: "Optimize financing structure", impact: "medium", detail: `${inputs.downPayment}% down is conservative. At 20-25% down, you free up capital for additional deals while maintaining good terms.` });
    if (calc.coC < 8 && calc.moCF > 0) recs.push({ action: "Negotiate purchase price", impact: "high", detail: `A ${fp(2)} price reduction would meaningfully improve your cash-on-cash. Present your analysis to the seller as justification.` });
  }

  // Universal recommendations
  if (calc.score >= 70) recs.push({ action: "Move to due diligence", impact: "high", detail: "Numbers look good. Get inspections, verify rent comps with 3 local PMs, and confirm your exit strategy timeline." });
  if (calc.score >= 50 && calc.score < 70) recs.push({ action: "Renegotiate before committing", impact: "high", detail: "This deal is close but not quite there. Use your analysis to negotiate better terms on the areas flagged above." });
  if (calc.score < 50) recs.push({ action: "Walk away or restructure completely", impact: "critical", detail: "The fundamentals don't support this deal in its current form. Either the price needs to drop significantly, or you need a different strategy." });

  return recs;
}

function generateScoreBreakdown(type, calc, inputs) {
  const factors = [];

  if (type === "flip") {
    const marginPts = calc.margin > 0 ? Math.min(30, calc.margin * 1.5) : Math.max(-20, calc.margin * 3);
    const roiPts = calc.roi > 20 ? 15 : calc.roi > 0 ? calc.roi * 0.75 : Math.max(-15, calc.roi * 1.5);
    const holdPts = inputs.holdMonths <= 4 ? 10 : inputs.holdMonths <= 6 ? 5 : 0;
    factors.push({ name: "Profit Margin", points: Math.round(marginPts), max: 30, detail: `${calc.margin?.toFixed(1)}% margin`, color: marginPts > 15 ? B.grn : marginPts > 5 ? B.gold : B.red });
    factors.push({ name: "Return on Investment", points: Math.round(roiPts), max: 15, detail: `${calc.roi?.toFixed(1)}% ROI`, color: roiPts > 10 ? B.grn : roiPts > 5 ? B.gold : B.red });
    factors.push({ name: "Hold Timeline", points: holdPts, max: 10, detail: `${inputs.holdMonths} months`, color: holdPts >= 10 ? B.grn : holdPts >= 5 ? B.gold : B.red });
    factors.push({ name: "Base Score", points: 40, max: 40, detail: "Starting baseline", color: B.acc });
  } else if (type === "brrrr") {
    const infinitePts = calc.infinite ? 35 : calc.cashLeft < calc.totalBefore * 0.3 ? 20 : 10;
    const cfPts = calc.moCF > 0 ? Math.min(25, calc.moCF / 20) : Math.max(-20, calc.moCF * 2);
    const cocPts = (calc.coC > 12 || calc.infinite) ? 15 : calc.coC > 0 ? Math.min(15, calc.coC) : Math.max(-15, calc.coC * 1.5);
    factors.push({ name: "Capital Recovery", points: Math.round(infinitePts), max: 35, detail: calc.infinite ? "Infinite return" : `${fmt(calc.cashLeft)} left in deal`, color: infinitePts > 20 ? B.grn : infinitePts > 10 ? B.gold : B.red });
    factors.push({ name: "Monthly Cash Flow", points: Math.round(cfPts), max: 25, detail: `${fmt(calc.moCF)}/mo`, color: cfPts > 15 ? B.grn : cfPts > 5 ? B.gold : B.red });
    factors.push({ name: "Cash-on-Cash", points: Math.round(cocPts), max: 15, detail: calc.infinite ? "Infinite" : fp(calc.coC), color: cocPts > 10 ? B.grn : cocPts > 5 ? B.gold : B.red });
    factors.push({ name: "Base Score", points: 30, max: 30, detail: "Starting baseline", color: B.acc });
  } else {
    // Generic breakdown for rental/STR/multi/etc.
    const cfPts = (calc.moCF || 0) > 0 ? Math.min(30, (calc.moCF || 0) / 15) : Math.max(-20, (calc.moCF || 0) / 10);
    const cocPts = (calc.coC || 0) > 8 ? Math.min(25, (calc.coC || 0) * 1.5) : Math.max(-15, ((calc.coC || 0) - 8) * 3);
    const scorePts = calc.score - 30 - Math.round(cfPts) - Math.round(cocPts);
    factors.push({ name: "Cash Flow", points: Math.round(cfPts), max: 30, detail: `${fmt(calc.moCF || 0)}/mo`, color: cfPts > 15 ? B.grn : cfPts > 5 ? B.gold : B.red });
    factors.push({ name: "Cash-on-Cash Return", points: Math.round(cocPts), max: 25, detail: fp(calc.coC || 0), color: cocPts > 15 ? B.grn : cocPts > 5 ? B.gold : B.red });
    factors.push({ name: "Other Factors", points: Math.max(0, Math.round(scorePts)), max: 15, detail: "DSCR, cap rate, expenses", color: B.acc });
    factors.push({ name: "Base Score", points: 30, max: 30, detail: "Starting baseline", color: B.acc });
  }

  return factors;
}

// ═══════════════════════════════════════════════════════════════
// 4.3: SMART ALERTS ENGINE
// ═══════════════════════════════════════════════════════════════

function generatePortfolioAlerts(portfolio) {
  const alerts = [];
  if (portfolio.length === 0) return alerts;

  const scores = portfolio.map(d => d.calc?.score || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const lowScorers = portfolio.filter(d => (d.calc?.score || 0) < 50);
  const highScorers = portfolio.filter(d => (d.calc?.score || 0) >= 80);
  const negCF = portfolio.filter(d => (d.calc?.moCF || d.calc?.profitPerMonth || 0) < 0);
  const totalMoCF = portfolio.reduce((s, d) => s + (d.calc?.moCF || d.calc?.profitPerMonth || 0), 0);

  if (avgScore < 50) alerts.push({ type: "warning", title: "Portfolio Average Below 50", detail: `Your average deal score is ${avgScore.toFixed(0)}/100. Consider replacing your weakest performers.` });
  if (avgScore >= 75) alerts.push({ type: "success", title: "Strong Portfolio Health", detail: `Average score of ${avgScore.toFixed(0)}/100. Your portfolio is performing above benchmark.` });
  if (lowScorers.length > 0) alerts.push({ type: "warning", title: `${lowScorers.length} Weak Deal${lowScorers.length > 1 ? "s" : ""}`, detail: `${lowScorers.map(d => d.data?.name || d.type).join(", ")} scored below 50. Review or replace these.` });
  if (negCF.length > 0) alerts.push({ type: "danger", title: `${negCF.length} Deal${negCF.length > 1 ? "s" : ""} Bleeding Cash`, detail: `${negCF.map(d => `${d.data?.name || d.type} (${fmt(d.calc?.moCF || d.calc?.profitPerMonth || 0)}/mo)`).join(", ")}` });
  if (totalMoCF > 0) alerts.push({ type: "info", title: "Total Monthly Cash Flow", detail: `Your portfolio generates ${fmt(totalMoCF)}/mo across ${portfolio.length} deal${portfolio.length > 1 ? "s" : ""}.` });
  if (portfolio.length >= 5 && highScorers.length / portfolio.length > 0.6) alerts.push({ type: "success", title: "Portfolio Diversification", detail: `${((highScorers.length / portfolio.length) * 100).toFixed(0)}% of your deals are A-grade. Strong foundation for scaling.` });

  return alerts;
}

// ═══════════════════════════════════════════════════════════════
// 4.4: AI REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════

function generateInvestorPDF(deal, type, calc, inputs, flags, recs, scoreBreakdown, dealTypes) {
  const doc = new jsPDF();
  const typeName = dealTypes?.find(dt => dt.id === type)?.label || type;
  const dealName = inputs.name || `${typeName} Deal`;

  // Header
  doc.setFillColor(15, 26, 46); // B.pri
  doc.rect(0, 0, 210, 40, "F");
  doc.setTextColor(201, 165, 76); // B.gold
  doc.setFontSize(22);
  doc.text("DealClarity", 15, 18);
  doc.setFontSize(10);
  doc.setTextColor(163, 184, 212);
  doc.text("AI Deal Intelligence Report", 15, 26);
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(dealName, 15, 35);

  // Grade badge
  const grade = calc.score >= 80 ? "A" : calc.score >= 65 ? "B" : calc.score >= 50 ? "C" : calc.score >= 35 ? "D" : "F";
  const gradeColor = grade === "A" ? [22, 163, 74] : grade === "B" ? [37, 99, 235] : grade === "C" ? [201, 165, 76] : [220, 38, 38];
  doc.setFillColor(...gradeColor);
  doc.roundedRect(170, 10, 25, 25, 3, 3, "F");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(grade, 178, 27);

  let y = 50;

  // Deal Type & Score
  doc.setTextColor(15, 26, 46);
  doc.setFontSize(11);
  doc.text(`Deal Type: ${typeName}`, 15, y);
  doc.text(`Score: ${Math.round(calc.score)}/100`, 120, y);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, y + 7);
  y += 18;

  // Key Metrics Table
  doc.setFontSize(13);
  doc.setTextColor(15, 26, 46);
  doc.text("Key Metrics", 15, y);
  y += 5;

  const metrics = [];
  if (calc.profit != null) metrics.push(["Total Profit", fmt(calc.profit)]);
  if (calc.moCF != null) metrics.push(["Monthly Cash Flow", fmt(calc.moCF)]);
  if (calc.annCF != null) metrics.push(["Annual Cash Flow", fmt(calc.annCF)]);
  if (calc.roi != null) metrics.push(["ROI", fp(calc.roi)]);
  if (calc.coC != null) metrics.push(["Cash-on-Cash", calc.infinite ? "Infinite" : fp(calc.coC)]);
  if (calc.margin != null) metrics.push(["Profit Margin", fp(calc.margin)]);
  if (calc.cashIn != null || calc.cash != null || calc.cashLeft != null) metrics.push(["Cash Invested", fmt(calc.cashIn || calc.cash || calc.cashLeft || 0)]);
  if (calc.dscr != null) metrics.push(["DSCR", calc.dscr.toFixed(2)]);
  if (calc.capRate != null) metrics.push(["Cap Rate", fp(calc.capRate)]);

  if (metrics.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: metrics,
      theme: "grid",
      headStyles: { fillColor: [15, 26, 46], textColor: [201, 165, 76], fontSize: 10 },
      bodyStyles: { fontSize: 10 },
      columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
      margin: { left: 15, right: 15 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Score Breakdown
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.text("Score Breakdown", 15, y);
  y += 5;
  const sbRows = scoreBreakdown.map(f => [f.name, `${f.points > 0 ? "+" : ""}${f.points}`, `/ ${f.max}`, f.detail]);
  autoTable(doc, {
    startY: y,
    head: [["Factor", "Points", "Max", "Detail"]],
    body: sbRows,
    theme: "grid",
    headStyles: { fillColor: [15, 26, 46], textColor: [201, 165, 76], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });
  y = doc.lastAutoTable.finalY + 10;

  // Red Flags & Insights
  if (flags.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("Insights & Flags", 15, y);
    y += 5;
    const flagRows = flags.map(f => [f.severity === "critical" ? "CRITICAL" : f.severity === "warning" ? "WARNING" : f.severity === "success" ? "STRONG" : "INFO", f.msg]);
    autoTable(doc, {
      startY: y,
      head: [["Level", "Detail"]],
      body: flagRows,
      theme: "grid",
      headStyles: { fillColor: [15, 26, 46], textColor: [201, 165, 76], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 25, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
      margin: { left: 15, right: 15 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          const val = data.cell.raw;
          if (val === "CRITICAL") data.cell.styles.textColor = [220, 38, 38];
          else if (val === "WARNING") data.cell.styles.textColor = [234, 88, 12];
          else if (val === "STRONG") data.cell.styles.textColor = [22, 163, 74];
        }
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Recommendations
  if (recs.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("Recommendations", 15, y);
    y += 5;
    const recRows = recs.map(r => [r.impact.toUpperCase(), r.action, r.detail]);
    autoTable(doc, {
      startY: y,
      head: [["Priority", "Action", "Detail"]],
      body: recRows,
      theme: "grid",
      headStyles: { fillColor: [15, 26, 46], textColor: [201, 165, 76], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 22, fontStyle: "bold" }, 1: { cellWidth: 40 }, 2: { cellWidth: "auto" } },
      margin: { left: 15, right: 15 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text("Generated by DealClarity | dealclarity.vercel.app | Because The Books Don't Lie.", 15, 287);
    doc.text(`Page ${i} of ${pageCount}`, 180, 287);
  }

  doc.save(`DealClarity_Report_${dealName.replace(/\s/g, "_")}.pdf`);
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT: Deal Advisor Panel
// ═══════════════════════════════════════════════════════════════

export default function DealAdvisor({ deal, dealType, calc, inputs, isPro, setShowPro, portfolio, dealTypes }) {
  const [activeTab, setActiveTab] = useState("advisor");
  const [expandedFlag, setExpandedFlag] = useState(null);
  const [expandedRec, setExpandedRec] = useState(null);
  const [expandedAlert, setExpandedAlert] = useState(null);

  if (!isPro) return (
    <div className="text-center py-12">
      <Brain size={48} style={{ color: B.brd, margin: "0 auto 12px" }} />
      <h3 className="text-lg font-bold mb-2">AI Deal Advisor</h3>
      <p className="text-sm mb-4" style={{ color: B.mut }}>Get intelligent analysis, red flag detection, score breakdowns, smart alerts, and investor-ready PDF reports for every deal.</p>
      <button onClick={() => setShowPro(true)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ background: B.gold }}>Upgrade to Pro</button>
    </div>
  );

  if (!calc || !dealType) return (
    <div className="text-center py-12">
      <Brain size={48} style={{ color: B.brd, margin: "0 auto 12px" }} />
      <h3 className="text-lg font-bold mb-2">Analyze a Deal First</h3>
      <p className="text-sm" style={{ color: B.mut }}>Run your numbers in the Analyze tab, then come here for AI-powered insights.</p>
    </div>
  );

  const flags = useMemo(() => generateRedFlags(dealType, calc, inputs), [dealType, calc, inputs]);
  const recs = useMemo(() => generateRecommendations(dealType, calc, inputs), [dealType, calc, inputs]);
  const scoreBreakdown = useMemo(() => generateScoreBreakdown(dealType, calc, inputs), [dealType, calc, inputs]);
  const portfolioAlerts = useMemo(() => generatePortfolioAlerts(portfolio || []), [portfolio]);

  const criticalCount = flags.filter(f => f.severity === "critical").length;
  const warningCount = flags.filter(f => f.severity === "warning").length;
  const successCount = flags.filter(f => f.severity === "success").length;

  // Radar chart data for score breakdown
  const radarData = scoreBreakdown.filter(f => f.name !== "Base Score").map(f => ({
    factor: f.name,
    score: Math.max(0, Math.round((f.points / f.max) * 100)),
    benchmark: 70,
  }));

  const TABS = [
    { id: "advisor", label: "Advisor", icon: Brain },
    { id: "alerts", label: "Alerts", icon: Bell, badge: portfolioAlerts.filter(a => a.type === "danger" || a.type === "warning").length },
    { id: "report", label: "Report", icon: FileText },
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: B.bg }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg"
            style={{ background: activeTab === tab.id ? B.card : "transparent", color: activeTab === tab.id ? B.pri : B.mut, boxShadow: activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
            <tab.icon size={14} />
            {tab.label}
            {tab.badge > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: B.redL, color: B.red, fontSize: 10 }}>{tab.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── ADVISOR TAB ── */}
      {activeTab === "advisor" && (
        <div className="space-y-5">
          {/* Quick status banner */}
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{
            background: criticalCount > 0 ? B.redL : warningCount > 0 ? B.goldL : B.grnL,
            border: `1px solid ${criticalCount > 0 ? B.red : warningCount > 0 ? B.gold : B.grn}22`
          }}>
            {criticalCount > 0 ? <XCircle size={22} style={{ color: B.red }} /> : warningCount > 0 ? <AlertTriangle size={22} style={{ color: B.gold }} /> : <CheckCircle2 size={22} style={{ color: B.grn }} />}
            <div>
              <span className="text-sm font-bold" style={{ color: criticalCount > 0 ? B.red : warningCount > 0 ? B.goldD : B.grn }}>
                {criticalCount > 0 ? `${criticalCount} Critical Issue${criticalCount > 1 ? "s" : ""} Found` : warningCount > 0 ? `${warningCount} Area${warningCount > 1 ? "s" : ""} Need Attention` : "Deal Looks Strong"}
              </span>
              <span className="text-xs ml-2" style={{ color: B.mut }}>
                {flags.length} insight{flags.length !== 1 ? "s" : ""} | {recs.length} recommendation{recs.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="p-4 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Target size={14} style={{ color: B.pri }} /> Score Breakdown</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Factor bars */}
              <div className="space-y-3">
                {scoreBreakdown.map((f, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{f.name}</span>
                      <span style={{ color: f.color }}>{f.points > 0 ? "+" : ""}{f.points} / {f.max}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full" style={{ background: B.bg }}>
                      <div className="h-2.5 rounded-full transition-all" style={{ width: `${clamp((f.points / f.max) * 100, 0, 100)}%`, background: f.color }} />
                    </div>
                    <span className="text-xs" style={{ color: B.mut }}>{f.detail}</span>
                  </div>
                ))}
                <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: B.brd }}>
                  <span className="text-sm font-bold">Total Score</span>
                  <span className="text-lg font-black" style={{ color: calc.score >= 70 ? B.grn : calc.score >= 50 ? B.gold : B.red }}>{Math.round(calc.score)}/100</span>
                </div>
              </div>
              {/* Radar */}
              {radarData.length >= 2 && (
                <div>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke={B.brd} />
                      <PolarAngleAxis dataKey="factor" tick={{ fontSize: 10, fill: B.mut }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="score" stroke={B.pri} fill={B.pri} fillOpacity={0.15} strokeWidth={2} />
                      <Radar dataKey="benchmark" stroke={B.gold} fill="none" strokeWidth={1} strokeDasharray="5 5" />
                    </RadarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-center" style={{ color: B.mut }}>Solid = your deal | Dashed = benchmark (70%)</p>
                </div>
              )}
            </div>
          </div>

          {/* Red Flags & Insights */}
          <div className="p-4 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><AlertCircle size={14} style={{ color: B.pri }} /> Insights & Flags</h4>
            <div className="space-y-2">
              {flags.map((f, i) => {
                const colors = { critical: { bg: B.redL, border: B.red, text: B.red }, warning: { bg: B.goldL, border: B.gold, text: B.goldD }, success: { bg: B.grnL, border: B.grn, text: B.grn }, info: { bg: B.blueL, border: B.blue, text: B.blue } };
                const c = colors[f.severity] || colors.info;
                return (
                  <div key={i} className="p-3 rounded-xl cursor-pointer" onClick={() => setExpandedFlag(expandedFlag === i ? null : i)}
                    style={{ background: c.bg, border: `1px solid ${c.border}22` }}>
                    <div className="flex items-start gap-2">
                      <f.icon size={16} style={{ color: c.text, flexShrink: 0, marginTop: 2 }} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: c.text }}>{f.severity}</span>
                          {expandedFlag === i ? <ChevronUp size={14} style={{ color: c.text }} /> : <ChevronDown size={14} style={{ color: c.text }} />}
                        </div>
                        {expandedFlag === i && <p className="text-sm mt-2" style={{ color: B.txt }}>{f.msg}</p>}
                        {expandedFlag !== i && <p className="text-xs mt-1 truncate" style={{ color: B.txt }}>{f.msg}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recommendations */}
          <div className="p-4 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Lightbulb size={14} style={{ color: B.gold }} /> Recommendations</h4>
            <div className="space-y-2">
              {recs.map((r, i) => {
                const impactColor = r.impact === "critical" ? B.red : r.impact === "high" ? B.grn : B.gold;
                return (
                  <div key={i} className="p-3 rounded-xl border cursor-pointer" onClick={() => setExpandedRec(expandedRec === i ? null : i)}
                    style={{ borderColor: B.brd }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: `${impactColor}18`, color: impactColor }}>{r.impact}</span>
                        <span className="text-sm font-medium">{r.action}</span>
                      </div>
                      {expandedRec === i ? <ChevronUp size={14} style={{ color: B.mut }} /> : <ChevronDown size={14} style={{ color: B.mut }} />}
                    </div>
                    {expandedRec === i && <p className="text-xs mt-2" style={{ color: B.mut }}>{r.detail}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── ALERTS TAB ── */}
      {activeTab === "alerts" && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><Bell size={14} style={{ color: B.pri }} /> Portfolio Alerts ({portfolio?.length || 0} deals)</h4>
            {portfolioAlerts.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: B.mut }}>Save deals to your portfolio to see smart alerts and health monitoring.</p>
            ) : (
              <div className="space-y-2">
                {portfolioAlerts.map((a, i) => {
                  const colors = { danger: { bg: B.redL, text: B.red }, warning: { bg: B.goldL, text: B.goldD }, success: { bg: B.grnL, text: B.grn }, info: { bg: B.blueL, text: B.blue } };
                  const c = colors[a.type] || colors.info;
                  return (
                    <div key={i} className="p-3 rounded-xl cursor-pointer" onClick={() => setExpandedAlert(expandedAlert === i ? null : i)}
                      style={{ background: c.bg }}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold" style={{ color: c.text }}>{a.title}</span>
                        {expandedAlert === i ? <ChevronUp size={14} style={{ color: c.text }} /> : <ChevronDown size={14} style={{ color: c.text }} />}
                      </div>
                      {expandedAlert === i && <p className="text-xs mt-2" style={{ color: B.txt }}>{a.detail}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Portfolio snapshot */}
          {portfolio && portfolio.length > 0 && (
            <div className="p-4 rounded-xl" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
              <h4 className="text-sm font-bold mb-3">Portfolio Health Snapshot</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg" style={{ background: B.bg }}>
                  <span className="text-xs block" style={{ color: B.mut }}>Avg Score</span>
                  <span className="text-lg font-bold">{(portfolio.reduce((s, d) => s + (d.calc?.score || 0), 0) / portfolio.length).toFixed(0)}</span>
                </div>
                <div className="p-3 rounded-lg" style={{ background: B.bg }}>
                  <span className="text-xs block" style={{ color: B.mut }}>Total Monthly CF</span>
                  <span className="text-lg font-bold" style={{ color: B.grn }}>{fmt(portfolio.reduce((s, d) => s + (d.calc?.moCF || d.calc?.profitPerMonth || 0), 0))}</span>
                </div>
                <div className="p-3 rounded-lg" style={{ background: B.bg }}>
                  <span className="text-xs block" style={{ color: B.mut }}>Total Cash In</span>
                  <span className="text-lg font-bold">{fmt(portfolio.reduce((s, d) => s + (d.calc?.cashIn || d.calc?.cash || d.calc?.cashLeft || 0), 0))}</span>
                </div>
                <div className="p-3 rounded-lg" style={{ background: B.bg }}>
                  <span className="text-xs block" style={{ color: B.mut }}>Deals</span>
                  <span className="text-lg font-bold">{portfolio.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REPORT TAB ── */}
      {activeTab === "report" && (
        <div className="space-y-5">
          <div className="p-6 rounded-xl text-center" style={{ background: B.card, border: `1px solid ${B.brd}` }}>
            <FileText size={48} style={{ color: B.gold, margin: "0 auto 12px" }} />
            <h3 className="text-lg font-bold mb-2">Investor-Ready Deal Report</h3>
            <p className="text-sm mb-4" style={{ color: B.mut }}>Generate a professional PDF with your deal analysis, score breakdown, red flags, and recommendations. Perfect for partners, lenders, and your own records.</p>
            <button
              onClick={() => generateInvestorPDF(deal, dealType, calc, inputs, flags, recs, scoreBreakdown, dealTypes)}
              className="flex items-center gap-2 mx-auto px-6 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90"
              style={{ background: B.pri }}>
              <Download size={16} /> Generate PDF Report
            </button>
          </div>

          {/* Preview what's in the report */}
          <div className="p-4 rounded-xl" style={{ background: B.bg, border: `1px solid ${B.brd}` }}>
            <h4 className="text-sm font-bold mb-2">Report Contents</h4>
            <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: B.mut }}>
              {[
                "Deal overview & grade",
                "Key financial metrics",
                "Score breakdown by factor",
                `${flags.length} insights & flags`,
                `${recs.length} recommendations`,
                "Professional formatting",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 size={12} style={{ color: B.grn }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Book promo */}
          <div className="p-3 rounded-xl text-center" style={{ background: B.bg, border: `1px solid ${B.brd}` }}>
            <p className="text-xs" style={{ color: B.mut }}>
              Learn to build your own deal analysis framework. <a href="https://www.amazon.com/dp/B0GPXXDQP2" target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: B.gold }}>"The Books Don't Lie"</a> on Amazon.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
