import { useState, useEffect, useMemo, useCallback, useRef, Component } from "react";
import { supabase } from "./supabase";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area,
} from "recharts";
import {
  Calculator, DollarSign, TrendingUp, Building2, AlertTriangle, ChevronDown, ChevronUp,
  Lock, Check, ArrowRight, BarChart3, PiggyBank, Clock, Percent, Home, Layers, Warehouse,
  Users, Star, Zap, FileText, GitCompare, Settings, Menu, X, Copy, Download, Plus, Trash2,
  ArrowUpRight, ArrowDownRight, Target, Shield, Award, Briefcase, Key, MapPin, Hash, Activity,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import BudgetPlanner from "./BudgetPlanner";
import AgentHub from "./AgentHub";
import PulseCheck from "./PulseCheck";
import { trackEvent, EVENTS } from "./utils/analytics";
import { fetchCloudDeals, saveCloudDeal, deleteCloudDeal, mergeLocalToCloud } from "./utils/dealSync";

// ═══════════════════════════════════════════════════════════════
// CONSTANTS & BRAND
// ═══════════════════════════════════════════════════════════════
const B = {
  pri: "#0F1A2E", priL: "#1B2D4A", acc: "#2A4066", accL: "#5A82AD",
  gold: "#C9A54C", goldL: "#F5E6C8", goldD: "#8B7025",
  red: "#DC2626", redL: "#FEE2E2", grn: "#16A34A", grnL: "#DCFCE7",
  blue: "#2563EB", blueL: "#DBEAFE", purple: "#7C3AED",
  bg: "#F7F8FA", card: "#FFFFFF", txt: "#1A1A1A", mut: "#6B7280", brd: "#E0E3EA",
};
const PIE_C = [B.pri, B.acc, B.gold, B.mut, B.red, B.blue, B.purple, "#EA580C", "#0D9488", "#BE185D", "#1B2D4A", "#C9A54C"];
const fmt = (n) => n == null || isNaN(n) ? "$0" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtK = (n) => n == null || isNaN(n) ? "$0" : Math.abs(n) >= 1000 ? `$${(n/1000).toFixed(0)}k` : fmt(n);
const fp = (n) => n == null || isNaN(n) ? "0%" : `${n.toFixed(1)}%`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// PRO_CODE moved to server-side (api/activate-pro.js) — no secrets in client code

// ═══════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("DealClarity Error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: B.bg, padding: 32 }}>
          <div style={{ maxWidth: 480, textAlign: "center", background: B.card, borderRadius: 16, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: B.pri, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ color: B.mut, fontSize: 14, marginBottom: 24 }}>DealClarity ran into an issue. Your data is safe — try refreshing the page.</p>
            <button onClick={() => window.location.reload()} style={{ background: B.gold, color: B.pri, border: "none", padding: "12px 32px", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════
// TOAST NOTIFICATION (replaces alert())
// ═══════════════════════════════════════════════════════════════
function Toast({ message, type = "error", onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const bg = type === "error" ? B.redL : type === "success" ? B.grnL : B.blueL;
  const color = type === "error" ? B.red : type === "success" ? B.grn : B.blue;
  const icon = type === "error" ? "⚠️" : type === "success" ? "✅" : "ℹ️";
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 10000, background: bg, border: `1px solid ${color}`, borderRadius: 12, padding: "12px 20px", maxWidth: 400, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", animation: "slideIn 0.3s ease" }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ color, fontSize: 13, fontWeight: 500, flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: "none", border: "none", color, cursor: "pointer", fontSize: 16, padding: 0 }}>✕</button>
    </div>
  );
}

// Input sanitizer — prevents negative values on financial fields
const sanitizeNum = (v, allowNeg = false) => {
  const n = parseFloat(v);
  if (isNaN(n)) return 0;
  return allowNeg ? n : Math.max(0, n);
};

// ═══════════════════════════════════════════════════════════════
// TRANSLATIONS (EN / ES)
// ═══════════════════════════════════════════════════════════════
const T = {
  en: {
    // Deal types
    flip: "Fix & Flip", flipD: "Flippers & Rehabbers",
    brrrr: "BRRRR", brrrrD: "Buy-Rehab-Rent-Refi-Repeat",
    rental: "Buy & Hold", rentalD: "Landlords & Rentals",
    str: "Short-Term Rental", strD: "Airbnb & VRBO",
    wholesale: "Wholesale", wholesaleD: "Assignment Deals",
    multi: "Multifamily", multiD: "Apartments & Syndication",
    mhp: "Mobile Home Park", mhpD: "MHP Operators",
    storage: "Self-Storage", storageD: "Storage Facilities",
    // Pages
    analyze: "Analyze", portfolio: "Portfolio", compare: "Compare", splits: "Splits", whatIf: "What-If", agentHub: "Agent Hub", pulseCheck: "Pulse Check",
    // Grades
    gradeAp: "Exceptional - move fast", gradeA: "Strong deal", gradeB: "Good, manageable risk",
    gradeC: "Marginal - proceed with caution", gradeD: "Weak - significant risk", gradeF: "Walk away",
    // Header
    tagline: "True Profitability for RE Operators", upgradePro: "Upgrade to Pro",
    // Buttons
    savePortfolio: "Save to Portfolio", saved: "Saved!", exportPdf: "Export PDF Report",
    pdfHint: "Report opened! Click 'Save as PDF' or use Ctrl+P / Cmd+P.",
    // Pro box
    goPro: "Go Pro", proPrice: "from $29/mo",
    proDesc: "PDF reports for lenders, unlimited what-if scenarios, CPA-ready annual summaries, deal sync across devices.",
    startTrial: "Start 7-Day Free Trial",
    // Pro modal
    proTitle: "DealClarity Pro", proSub: "The full toolkit for serious operators",
    trialNote: "Cancel anytime.", annualSave: "$249/year (save 29%)",
    lifetimeOffer: "$499 lifetime (one-time)", secureCheckout: "Secure checkout via Stripe. Cancel anytime.",
    getEarlyAccess: "Get Early Access", notifyLaunch: "We'll notify you when Pro launches.",
    enterEmail: "Enter your email to get notified", onTheList: "You're on the list!",
    notifyEmail: "We'll notify", whenLaunches: "when Pro launches.",
    backToAnalyzer: "Back to Analyzer",
    trialMonthly: "Monthly - $29/mo",
    trialAnnual: "Annual - $249/yr (save 27%)",
    trialLifetime: "Lifetime - $499 (one-time)",
    haveCode: "Have a Pro code?",
    // Pro features
    f1: "8 deal type analyzers", f2: "Save unlimited deals", f3: "Side-by-side comparison",
    f4: "What-if scenarios", f5: "Partnership splits", f6: "PDF lender reports",
    f7: "CPA-ready exports", f8: "Portfolio dashboard", f9: "Logo-branded reports",
    f10: "Multi-scenario modeling", f11: "Break-even analysis", f12: "Priority support",
    // Portfolio
    noDealsTitle: "No Saved Deals Yet", noDealsDesc: "Analyze a deal and click \"Save to Portfolio\" to start building your dashboard.",
    totalDeals: "TOTAL DEALS", totalInvested: "TOTAL INVESTED", annualCF: "ANNUAL CASH FLOW", avgScore: "AVG DEAL SCORE",
    dealsByType: "Deals by Type", dealScores: "Deal Scores", allDeals: "All Deals",
    // Compare
    needTwo: "Need 2+ Saved Deals", needTwoDesc: "Save at least two deals to compare side-by-side.",
    deal: "Deal", dealScore: "Deal Score", monthlyCF: "Monthly CF", cashInvested: "Cash Invested", roiCoC: "ROI / CoC",
    // Splits
    dealDetails: "Deal Details", totalProfit: "Total Profit / Annual Cash Flow",
    partner1: "Partner 1", partner2: "Partner 2", capitalPct: "Capital %",
    workEquity: "Work / Sweat Equity %", weighting: "Weighting",
    cashWeight: "Cash Weight (vs Work)", workWeight: "Work weight",
    // Sensitivity
    saveDealFirst: "Save a Deal First", whatIfDesc: "Run what-if analysis on saved deals.",
    variable: "Variable", range: "Range", whatIfTitle: "What If", changes: "Changes?",
    scoreImpact: "Score Impact", dataTable: "Data Table",
    change: "Change", profitCF: "Profit/CF", score: "Score",
    // Reality Check
    realityBad: "REALITY CHECK: Your Numbers Are Off", realityGood: "This Deal Checks Out",
    basicCalc: "Basic calculator says", trueNumber: "True number", hiddenCosts: "hidden costs",
    // Deal Score
    dealScoreLabel: "Deal Score",
    // Footer
    footer: "DealClarity by Profit Clarity Advantage — Because The Books Don't Lie.",
    // Sensitivity variables
    rehabCost: "Rehab Cost", purchasePrice: "Purchase Price", monthlyRent: "Monthly Rent",
    interestRate: "Interest Rate", holdPeriod: "Hold Period", vacancy: "Vacancy",
    // Section headers
    secDealDetails: "Deal Details", secAcquisition: "Acquisition", secProperty: "Property",
    secFacility: "Facility", secParkDetails: "Park Details", secDeal: "Deal",
    secFinancing: "Financing", secInitialLoan: "Initial Loan", secRefinance: "Refinance",
    secMonthlyCosts: "Monthly Holding Costs", secMonthlyHolding: "Monthly Holding Costs",
    secMonthlyCostsAfterRefi: "Monthly Costs (After Refi)", secMonthlyCostsPerUnit: "Monthly Costs (Per Unit)",
    secExitAssumptions: "Exit Assumptions", secRevenue: "Revenue", secYourCosts: "Your Costs",
    secCostBreakdown: "Cost Breakdown", secHoldingDetail: "Holding Cost Detail",
    secMonthlyExp: "Monthly Expenses", secMonthlyExpAfterRefi: "Monthly Expenses (After Refi)",
    secAnnualExp: "Annual Expenses", secValueAdd: "Value-Add Upside", secRevenueUpside: "Revenue Upside",
    secYearProj: "Year Projection", secFiveYearProj: "5-Year Projection",
    // Common input labels
    inDealName: "Deal Name (optional)", inPurchasePrice: "Purchase Price", inRehabCost: "Rehab Cost",
    inARV: "After Repair Value (ARV)", inMonthlyRent: "Monthly Rent", inClosingBuy: "Closing (Buy)",
    inClosingSell: "Closing (Sell)", inHoldPeriod: "Hold Period", inAgentComm: "Agent Commission",
    inLoanAmount: "Loan Amount", inInterestRate: "Interest Rate", inPoints: "Points",
    inDownPayment: "Down Payment", inRate: "Rate", inTerm: "Loan Term", inInsurance: "Insurance",
    inTaxes: "Property Tax", inMaintenance: "Maintenance", inCapEx: "CapEx Reserve",
    inPM: "PM Fee", inHOA: "HOA", inUtilities: "Utilities", inMisc: "Misc (lawn, security)",
    inVacancy: "Vacancy", inAppreciation: "Appreciation", inClosing: "Closing",
    // BRRRR-specific
    inHoldToRefi: "Hold to Refi", inRefiLTV: "Refi LTV", inRefiRate: "Refi Rate",
    inRefiTerm: "Refi Term", inRefiClosing: "Refi Closing",
    // STR-specific
    inFurnishing: "Furnishing Cost", inNightlyRate: "Nightly Rate", inOccupancy: "Occupancy",
    inCleaningFee: "Cleaning Fee", inAvgStay: "Avg Stay", inPlatformFee: "Platform Fee (Airbnb/VRBO)",
    inSupplies: "Supplies", tipAirDNA: "Use AirDNA or local comps for nightly rate and occupancy estimates.",
    // Wholesale-specific
    inContractPrice: "Contract Price", inAssignmentFee: "Assignment Fee",
    inEstRepairCost: "Estimated Repair Cost", inDaysToClose: "Days to Close",
    inEarnestMoney: "Earnest Money Deposit", inMarketingCost: "Marketing Cost",
    inClosingCosts: "Closing Costs", inInspection: "Inspection",
    // Multi-specific
    inTotalUnits: "Total Units", inAvgRentUnit: "Avg Rent/Unit", inInsPerUnit: "Insurance",
    inTaxPerUnit: "Taxes", inMaintPerUnit: "Maintenance", inCapExPerUnit: "CapEx",
    inCommonArea: "Common Area", inAnnAdmin: "Annual Admin", inExitCapRate: "Exit Cap Rate",
    inRentGrowth: "Rent Growth",
    // MHP-specific
    inTotalLots: "Total Lots", inOccupiedLots: "Occupied Lots", inLotRent: "Current Lot Rent",
    inMarketLotRent: "Market Lot Rent", inInfillCost: "Infill Cost/Lot",
    // Storage-specific
    inOccupied: "Occupied", inMarketRate: "Market Rate", inMarketing: "Marketing", inAdmin: "Admin",
    // Result labels
    rTrueProfit: "TRUE NET PROFIT", rROI: "ROI", rHoldingCosts: "HOLDING COSTS",
    rProfitMargin: "PROFIT MARGIN", rCashLeftInDeal: "CASH LEFT IN DEAL", rMonthlyCF: "MONTHLY CASH FLOW",
    rCashOnCash: "CASH-ON-CASH", rCashBackRefi: "CASH BACK AT REFI", rCapRate: "CAP RATE",
    rDSCR: "DSCR", rRevPerNight: "REV/NIGHT", rBreakEvenOcc: "BREAK-EVEN OCC.",
    rNetProfit: "NET PROFIT", rMaxOffer70: "MAX OFFER (70% ARV)", rSpread: "SPREAD",
    rAnnualCF: "ANNUAL CASH FLOW", rEquityMultiple: "EQUITY MULTIPLE", rPricePerUnit: "PRICE/UNIT",
    rPricePerLot: "PRICE/LOT", rOccupancy: "OCCUPANCY", rAnnCF: "ANNUAL CASH FLOW",
    // Result sub-labels
    subPerMonthHeld: "/month held", subAnnualized: "annualized", subPerMoXHold: "/mo x hold",
    subOnAllIn: "on all-in", subInfiniteROI: "INFINITE ROI", subInvested: "Invested",
    subPerYear: "/year", subAllCashRecovered: "All cash recovered", subOnCashLeft: "On cash left",
    subNightsPerMo: "nights/mo", subMinBreakEven: "Min to break even", subAfterAllCosts: "After all costs",
    subMAOMinusContract: "Minus repairs", subOverYears: "Over years", subExpRatio: "Exp ratio:",
    subEmptyLots: "empty lots", subEmpty: "empty",
    // RealityCheck
    naiveMoCF: "Naive monthly CF", trueCFMo: "True CF/mo", naiveMonthly: "Naive monthly CF",
    trueMonthly: "True monthly CF",
    // Section titles in results
    resCostBreakdown: "Cost Breakdown", resHoldingDetail: "Holding Cost Detail",
    resMonthlyExp: "Monthly Expenses", resMonthlyExpAfterRefi: "Monthly Expenses (After Refi)",
    resAnnualExp: "Annual Expenses", resValueAdd: "Value-Add Upside", resRevenueUpside: "Revenue Upside",
    resYearProj: "Year Projection",
    // Value-add text
    vaRentRaise: "Rent Raise to Market", vaInfillLots: "Infill", vaTotalUpside: "Total Upside",
    vaRateIncrease: "Rate Increase to Market", vaFillEmpty: "Fill",
    // Misc
    holdingCostTip: "Most calculators skip this. These costs eat profit every month you hold.",
    lenderReady: "Lender-ready", tight: "Tight", negCoverage: "Neg coverage",
  },
  es: {
    flip: "Compra y Reventa", flipD: "Inversores de Reventa",
    brrrr: "BRRRR", brrrrD: "Compra-Reforma-Alquila-Refinancia-Repite",
    rental: "Compra y Alquiler", rentalD: "Propietarios e Inquilinos",
    str: "Alquiler Vacacional", strD: "Airbnb y VRBO",
    wholesale: "Wholesale", wholesaleD: "Cesion de Contratos",
    multi: "Multifamiliar", multiD: "Apartamentos y Sindicacion",
    mhp: "Parque de Casas Moviles", mhpD: "Operadores de MHP",
    storage: "Autoalmacenamiento", storageD: "Instalaciones de Almacenaje",
    analyze: "Analizar", portfolio: "Portafolio", compare: "Comparar", splits: "Socios", whatIf: "Escenarios", agentHub: "Agent Hub", pulseCheck: "Pulse Check",
    gradeAp: "Excepcional - actua rapido", gradeA: "Buen negocio", gradeB: "Bueno, riesgo manejable",
    gradeC: "Marginal - procede con cautela", gradeD: "Debil - riesgo significativo", gradeF: "No lo hagas",
    tagline: "Rentabilidad Real para Operadores Inmobiliarios", upgradePro: "Hazte Pro",
    savePortfolio: "Guardar en Portafolio", saved: "Guardado!", exportPdf: "Exportar Informe PDF",
    pdfHint: "Informe abierto! Haz clic en 'Guardar como PDF' o usa Ctrl+P / Cmd+P.",
    goPro: "Hazte Pro", proPrice: "desde $9/mes",
    proDesc: "Informes PDF para prestamistas, escenarios ilimitados, resumenes anuales para contadores, sincronizacion entre dispositivos.",
    startTrial: "Prueba Gratis 7 Dias",
    proTitle: "DealClarity Pro", proSub: "El kit completo para operadores serios",
    trialNote: "Cancela cuando quieras.", annualSave: "$79/ano (ahorra 27%)",
    lifetimeOffer: "$199 de por vida (pago unico)", secureCheckout: "Pago seguro con Stripe. Cancela cuando quieras.",
    getEarlyAccess: "Acceso Anticipado", notifyLaunch: "Te notificaremos cuando Pro este listo.",
    enterEmail: "Ingresa tu email para ser notificado", onTheList: "Estas en la lista!",
    notifyEmail: "Notificaremos a", whenLaunches: "cuando Pro este listo.",
    backToAnalyzer: "Volver al Analizador",
    trialMonthly: "Mensual - $9/mes",
    haveCode: "Tienes un codigo Pro?",
    trialAnnual: "Anual - $79/ano (ahorra 27%)",
    trialLifetime: "De por Vida - $199 (pago unico)",
    f1: "8 tipos de analisis", f2: "Guarda deals ilimitados", f3: "Comparacion lado a lado",
    f4: "Escenarios hipoteticos", f5: "Division entre socios", f6: "Informes PDF para bancos",
    f7: "Exportaciones para contadores", f8: "Panel de portafolio", f9: "Informes con tu logo",
    f10: "Modelado multi-escenario", f11: "Analisis de punto de equilibrio", f12: "Soporte prioritario",
    noDealsTitle: "Sin Deals Guardados", noDealsDesc: "Analiza un deal y haz clic en \"Guardar en Portafolio\" para empezar.",
    totalDeals: "TOTAL DEALS", totalInvested: "TOTAL INVERTIDO", annualCF: "FLUJO DE CAJA ANUAL", avgScore: "PUNTAJE PROMEDIO",
    dealsByType: "Deals por Tipo", dealScores: "Puntajes de Deals", allDeals: "Todos los Deals",
    needTwo: "Necesitas 2+ Deals", needTwoDesc: "Guarda al menos dos deals para comparar lado a lado.",
    deal: "Deal", dealScore: "Puntaje del Deal", monthlyCF: "Flujo Mensual", cashInvested: "Capital Invertido", roiCoC: "ROI / CoC",
    dealDetails: "Detalles del Deal", totalProfit: "Ganancia Total / Flujo Anual",
    partner1: "Socio 1", partner2: "Socio 2", capitalPct: "Capital %",
    workEquity: "Trabajo / Sudor %", weighting: "Ponderacion",
    cashWeight: "Peso del Capital (vs Trabajo)", workWeight: "Peso del trabajo",
    saveDealFirst: "Guarda un Deal Primero", whatIfDesc: "Analiza escenarios hipoteticos con deals guardados.",
    variable: "Variable", range: "Rango", whatIfTitle: "Que Pasa Si", changes: "Cambia?",
    scoreImpact: "Impacto en Puntaje", dataTable: "Tabla de Datos",
    change: "Cambio", profitCF: "Ganancia/FC", score: "Puntaje",
    realityBad: "VERIFICACION: Tus Numeros Estan Mal", realityGood: "Este Deal Esta Bien",
    basicCalc: "Calculadora basica dice", trueNumber: "Numero real", hiddenCosts: "costos ocultos",
    dealScoreLabel: "Puntaje del Deal",
    footer: "DealClarity por Profit Clarity Advantage — Porque The Books Don't Lie.",
    rehabCost: "Costo de Reforma", purchasePrice: "Precio de Compra", monthlyRent: "Alquiler Mensual",
    interestRate: "Tasa de Interes", holdPeriod: "Periodo de Mantenimiento", vacancy: "Vacancia",
    // Section headers
    secDealDetails: "Detalles del Deal", secAcquisition: "Adquisicion", secProperty: "Propiedad",
    secFacility: "Instalacion", secParkDetails: "Detalles del Parque", secDeal: "Deal",
    secFinancing: "Financiamiento", secInitialLoan: "Prestamo Inicial", secRefinance: "Refinanciamiento",
    secMonthlyCosts: "Costos Mensuales de Tenencia", secMonthlyHolding: "Costos Mensuales de Tenencia",
    secMonthlyCostsAfterRefi: "Costos Mensuales (Despues Refi)", secMonthlyCostsPerUnit: "Costos Mensuales (Por Unidad)",
    secExitAssumptions: "Supuestos de Salida", secRevenue: "Ingresos", secYourCosts: "Tus Costos",
    secCostBreakdown: "Desglose de Costos", secHoldingDetail: "Detalle de Costos de Tenencia",
    secMonthlyExp: "Gastos Mensuales", secMonthlyExpAfterRefi: "Gastos Mensuales (Despues Refi)",
    secAnnualExp: "Gastos Anuales", secValueAdd: "Oportunidades de Valor", secRevenueUpside: "Oportunidades de Ingresos",
    secYearProj: "Proyeccion Anual", secFiveYearProj: "Proyeccion 5 Anos",
    // Common input labels
    inDealName: "Nombre del Deal (opcional)", inPurchasePrice: "Precio de Compra", inRehabCost: "Costo de Reforma",
    inARV: "Valor Despues de Reforma (ARV)", inMonthlyRent: "Alquiler Mensual", inClosingBuy: "Cierre (Compra)",
    inClosingSell: "Cierre (Venta)", inHoldPeriod: "Periodo de Tenencia", inAgentComm: "Comision del Agente",
    inLoanAmount: "Monto del Prestamo", inInterestRate: "Tasa de Interes", inPoints: "Puntos",
    inDownPayment: "Pago Inicial", inRate: "Tasa", inTerm: "Plazo del Prestamo", inInsurance: "Seguro",
    inTaxes: "Impuestos Inmobiliarios", inMaintenance: "Mantenimiento", inCapEx: "Reserva de CapEx",
    inPM: "Cuota de PM", inHOA: "HOA", inUtilities: "Servicios Basicos", inMisc: "Misc (cesped, seguridad)",
    inVacancy: "Vacancia", inAppreciation: "Apreciacion", inClosing: "Cierre",
    // BRRRR-specific
    inHoldToRefi: "Tenencia hasta Refi", inRefiLTV: "LTV Refi", inRefiRate: "Tasa Refi",
    inRefiTerm: "Plazo Refi", inRefiClosing: "Cierre Refi",
    // STR-specific
    inFurnishing: "Costo de Amueblamiento", inNightlyRate: "Tarifa Nocturna", inOccupancy: "Ocupacion",
    inCleaningFee: "Cuota de Limpieza", inAvgStay: "Estancia Promedio", inPlatformFee: "Cuota de Plataforma (Airbnb/VRBO)",
    inSupplies: "Suministros", tipAirDNA: "Usa AirDNA o comparables locales para estimar tarifa nocturna y ocupacion.",
    // Wholesale-specific
    inContractPrice: "Precio del Contrato", inAssignmentFee: "Cuota de Cesion",
    inEstRepairCost: "Costo Estimado de Reparacion", inDaysToClose: "Dias para Cerrar",
    inEarnestMoney: "Deposito de Dinero Serio", inMarketingCost: "Costo de Marketing",
    inClosingCosts: "Costos de Cierre", inInspection: "Inspeccion",
    // Multi-specific
    inTotalUnits: "Total de Unidades", inAvgRentUnit: "Alquiler Promedio/Unidad", inInsPerUnit: "Seguro",
    inTaxPerUnit: "Impuestos", inMaintPerUnit: "Mantenimiento", inCapExPerUnit: "CapEx",
    inCommonArea: "Area Comun", inAnnAdmin: "Admin Anual", inExitCapRate: "Tasa Cap de Salida",
    inRentGrowth: "Crecimiento de Alquiler",
    // MHP-specific
    inTotalLots: "Total de Lotes", inOccupiedLots: "Lotes Ocupados", inLotRent: "Alquiler Actual de Lotes",
    inMarketLotRent: "Alquiler de Mercado", inInfillCost: "Costo de Infill/Lote",
    // Storage-specific
    inOccupied: "Ocupadas", inMarketRate: "Tarifa de Mercado", inMarketing: "Marketing", inAdmin: "Administracion",
    // Result labels
    rTrueProfit: "GANANCIA NETA VERDADERA", rROI: "ROI", rHoldingCosts: "COSTOS DE TENENCIA",
    rProfitMargin: "MARGEN DE GANANCIA", rCashLeftInDeal: "EFECTIVO DEJADO EN EL DEAL", rMonthlyCF: "FLUJO DE CAJA MENSUAL",
    rCashOnCash: "RETORNO EN EFECTIVO", rCashBackRefi: "EFECTIVO DE VUELTA EN REFI", rCapRate: "TASA CAP",
    rDSCR: "DSCR", rRevPerNight: "INGRESO/NOCHE", rBreakEvenOcc: "OCUPACION PUNTO EQUILIBRIO",
    rNetProfit: "GANANCIA NETA", rMaxOffer70: "MAX OFERTA (70% ARV)", rSpread: "MARGEN",
    rAnnualCF: "FLUJO ANUAL", rEquityMultiple: "MULTIPLO DE EQUIDAD", rPricePerUnit: "PRECIO/UNIDAD",
    rPricePerLot: "PRECIO/LOTE", rOccupancy: "OCUPACION", rAnnCF: "FLUJO ANUAL",
    // Result sub-labels
    subPerMonthHeld: "/mes tenido", subAnnualized: "anualizado", subPerMoXHold: "/mes x tenencia",
    subOnAllIn: "sobre todo", subInfiniteROI: "ROI INFINITO", subInvested: "Invertido",
    subPerYear: "/ano", subAllCashRecovered: "Todo efectivo recuperado", subOnCashLeft: "Sobre efectivo restante",
    subNightsPerMo: "noches/mes", subMinBreakEven: "Min para punto equilibrio", subAfterAllCosts: "Despues de todos los costos",
    subMAOMinusContract: "Menos reparaciones", subOverYears: "Por anos", subExpRatio: "Razon de gastos:",
    subEmptyLots: "lotes vacios", subEmpty: "vacios",
    // RealityCheck
    naiveMoCF: "FC mensual ingenuo", trueCFMo: "CF verdadero/mes", naiveMonthly: "FC mensual ingenuo",
    trueMonthly: "CF mensual verdadero",
    // Section titles in results
    resCostBreakdown: "Desglose de Costos", resHoldingDetail: "Detalle de Costos de Tenencia",
    resMonthlyExp: "Gastos Mensuales", resMonthlyExpAfterRefi: "Gastos Mensuales (Despues Refi)",
    resAnnualExp: "Gastos Anuales", resValueAdd: "Oportunidades de Valor", resRevenueUpside: "Oportunidades de Ingresos",
    resYearProj: "Proyeccion Anual",
    // Value-add text
    vaRentRaise: "Aumento de Alquiler al Mercado", vaInfillLots: "Rellenar", vaTotalUpside: "Oportunidad Total",
    vaRateIncrease: "Aumento de Tarifa al Mercado", vaFillEmpty: "Llenar",
    // Misc
    holdingCostTip: "La mayoria de calculadoras omiten esto. Estos costos devoran ganancia cada mes que retienes.",
    lenderReady: "Listo para prestamista", tight: "Ajustado", negCoverage: "Cobertura negativa",
  },
};
const getDealTypes = (t) => [
  { id: "flip", label: t.flip, icon: Home, desc: t.flipD },
  { id: "brrrr", label: t.brrrr, icon: Zap, desc: t.brrrrD },
  { id: "rental", label: t.rental, icon: Key, desc: t.rentalD },
  { id: "str", label: t.str, icon: MapPin, desc: t.strD },
  { id: "wholesale", label: t.wholesale, icon: ArrowRight, desc: t.wholesaleD },
  { id: "multi", label: t.multi, icon: Layers, desc: t.multiD },
  { id: "mhp", label: t.mhp, icon: Warehouse, desc: t.mhpD },
  { id: "storage", label: t.storage, icon: Building2, desc: t.storageD },
];
const getPages = (t) => [
  { id: "analyze", label: t.analyze, icon: Calculator },
  { id: "portfolio", label: t.portfolio, icon: Briefcase },
  { id: "compare", label: t.compare, icon: GitCompare },
  { id: "splits", label: t.splits, icon: Users },
  { id: "sensitivity", label: t.whatIf, icon: Target },
  { id: "budget", label: "Budget", icon: PiggyBank },
  { id: "agent", label: t.agentHub, icon: Briefcase },
  { id: "pulse", label: t.pulseCheck, icon: Activity },
];
const getGrades = (t) => [
  { min: 90, grade: "A+", color: "#16A34A", bg: "#DCFCE7", label: t.gradeAp },
  { min: 80, grade: "A", color: "#16A34A", bg: "#DCFCE7", label: t.gradeA },
  { min: 70, grade: "B", color: "#2563EB", bg: "#DBEAFE", label: t.gradeB },
  { min: 60, grade: "C", color: "#D4A843", bg: "#F5E6C8", label: t.gradeC },
  { min: 50, grade: "D", color: "#EA580C", bg: "#FED7AA", label: t.gradeD },
  { min: 0, grade: "F", color: "#DC2626", bg: "#FEE2E2", label: t.gradeF },
];

const DEAL_TYPES = getDealTypes(T.en);
const PAGES = getPages(T.en);
const GRADES = getGrades(T.en);
const getGrade = (score) => GRADES.find(g => score >= g.min) || GRADES[GRADES.length - 1];

// ═══════════════════════════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════════════════════════
const Input = ({ label, value, onChange, pre = "$", suf, tip, sm, text, min, allowNeg }) => (
  <div className={sm ? "flex-1 min-w-0" : "w-full"}>
    <label className="block text-xs font-medium mb-1" style={{ color: B.mut }}>
      {label}{tip && <span className="ml-1 cursor-help" title={tip}>ℹ️</span>}
    </label>
    <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: B.brd, background: "#fff" }}>
      {pre && !text && <span className="px-2 text-sm font-medium" style={{ color: B.mut, background: "#F9FAFB", borderRight: `1px solid ${B.brd}`, padding: "8px 10px" }}>{pre}</span>}
      <input type={text ? "text" : "number"} value={value} min={min ?? (allowNeg ? undefined : 0)}
        onChange={e => text ? onChange(e.target.value) : onChange(sanitizeNum(e.target.value, allowNeg))}
        placeholder={text ? "e.g. 123 Main St Flip" : ""} className="w-full px-3 py-2 text-sm outline-none" style={{ color: B.txt }} />
      {suf && <span className="px-2 text-xs whitespace-nowrap" style={{ color: B.mut, background: "#F9FAFB", borderLeft: `1px solid ${B.brd}`, padding: "8px 10px" }}>{suf}</span>}
    </div>
  </div>
);

const Stat = ({ icon: I, label, value, sub, color, bg }) => (
  <div className="rounded-xl p-4 border" style={{ borderColor: B.brd, background: bg || B.card }}>
    <div className="flex items-center gap-2 mb-1">
      <I size={15} style={{ color: color || B.acc }} />
      <span className="text-xs font-medium" style={{ color: B.mut }}>{label}</span>
    </div>
    <div className="text-lg font-bold" style={{ color: color || B.txt }}>{value}</div>
    {sub && <div className="text-xs mt-0.5" style={{ color: B.mut }}>{sub}</div>}
  </div>
);

const Sec = ({ title, icon: I, children, col, open: dOpen = true }) => {
  const [open, setOpen] = useState(dOpen);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: B.brd, background: B.card }}>
      <div className={`flex items-center justify-between px-5 py-3 ${col ? "cursor-pointer" : ""}`}
        style={{ background: "#F9FAFB", borderBottom: open ? `1px solid ${B.brd}` : "none" }}
        onClick={() => col && setOpen(!open)}>
        <div className="flex items-center gap-2">
          {I && <I size={17} style={{ color: B.pri }} />}
          <h3 className="text-sm font-semibold" style={{ color: B.pri }}>{title}</h3>
        </div>
        {col && (open ? <ChevronUp size={15} style={{ color: B.mut }} /> : <ChevronDown size={15} style={{ color: B.mut }} />)}
      </div>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
};

const Pill = ({ active, children, onClick, icon: I }) => (
  <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
    style={{ background: active ? B.pri : "#F3F4F6", color: active ? "#fff" : B.mut }}>
    {I && <I size={13} />}{children}
  </button>
);

const RealityCheck = ({ naive, real, label1, label2, t }) => {
  const diff = naive - real;
  const bad = diff > 0 && real < naive;
  const l1 = label1 || t?.basicCalc || "Basic calculator says";
  const l2 = label2 || t?.trueNumber || "True number";
  return (
    <div className="rounded-xl p-5 border-2" style={{ borderColor: bad ? B.red : B.grn, background: bad ? "#FFF5F5" : B.grnL }}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={22} style={{ color: bad ? B.red : B.grn, flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1">
          <h3 className="font-bold text-sm mb-2" style={{ color: bad ? B.red : B.grn }}>
            {bad ? t?.realityBad || "REALITY CHECK: Your Numbers Are Off" : t?.realityGood || "This Deal Checks Out"}
          </h3>
          <div className="flex gap-4 text-xs">
            <div><span style={{ color: B.mut }}>{l1}: </span><span className="font-bold" style={{ color: B.mut }}>{fmt(naive)}</span></div>
            <span style={{ color: B.mut }}>→</span>
            <div><span style={{ color: B.mut }}>{l2}: </span><span className="font-bold" style={{ color: real >= 0 ? B.grn : B.red }}>{fmt(real)}</span></div>
            {bad && <div><span className="font-bold" style={{ color: B.red }}>({fmt(diff)} {t?.hiddenCosts || "hidden costs"})</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const DealScore = ({ score, t }) => {
  const g = getGrade(score);
  return (
    <div className="rounded-xl p-5 border-2 flex items-center gap-4" style={{ borderColor: g.color, background: g.bg }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center border-4" style={{ borderColor: g.color, background: "#fff" }}>
        <span className="text-2xl font-black" style={{ color: g.color }}>{g.grade}</span>
      </div>
      <div>
        <div className="text-sm font-bold" style={{ color: g.color }}>{t?.dealScoreLabel || "Deal Score"}: {Math.round(score)}/100</div>
        <div className="text-xs" style={{ color: B.mut }}>{g.label}</div>
        <div className="w-40 h-2 rounded-full mt-2" style={{ background: "#E5E7EB" }}>
          <div className="h-2 rounded-full transition-all" style={{ width: `${clamp(score, 0, 100)}%`, background: g.color }} />
        </div>
      </div>
    </div>
  );
};

const CostPie = ({ data, height = 200 }) => (
  <div className="flex flex-col md:flex-row items-center gap-4">
    <div style={{ width: 200, height }}>
      <ResponsiveContainer>
        <PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PIE_C[i % PIE_C.length]} />)}
        </Pie><Tooltip formatter={v => fmt(v)} /></PieChart>
      </ResponsiveContainer>
    </div>
    <div className="flex-1 space-y-1.5 min-w-0">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: PIE_C[i % PIE_C.length] }} />
            <span>{d.name}</span>
          </div>
          <span className="font-medium">{fmt(d.value)}</span>
        </div>
      ))}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// DEAL DEFAULTS & CALCULATORS
// ═══════════════════════════════════════════════════════════════
const DEFAULTS = {
  flip: { name: "", purchasePrice: 200000, rehabCost: 45000, arv: 310000, closingBuy: 3, closingSell: 8, holdMonths: 5, loanAmount: 180000, interestRate: 10, loanPoints: 2, monthlyInsurance: 150, monthlyTaxes: 250, monthlyUtilities: 200, monthlyHOA: 0, monthlyMisc: 100, agentCommission: 5 },
  brrrr: { name: "", purchasePrice: 150000, rehabCost: 40000, arv: 250000, refiLTV: 75, refiRate: 7, refiTerm: 30, monthlyRent: 2200, closingBuy: 3, closingRefi: 2, holdMonthsToRefi: 4, loanAmount: 135000, interestRate: 10, loanPoints: 2, monthlyInsurance: 130, monthlyTaxes: 200, monthlyMaintenance: 150, monthlyPM: 10, vacancyRate: 8, monthlyCapEx: 100 },
  rental: { name: "", purchasePrice: 250000, rehabCost: 15000, closingBuy: 3, downPayment: 25, loanRate: 7, loanTerm: 30, monthlyRent: 2200, vacancyRate: 8, monthlyInsurance: 150, monthlyTaxes: 300, monthlyMaintenance: 200, monthlyPM: 10, monthlyHOA: 0, monthlyCapEx: 150, appreciationRate: 3 },
  str: { name: "", purchasePrice: 350000, rehabCost: 30000, closingBuy: 3, downPayment: 25, loanRate: 7, loanTerm: 30, nightlyRate: 180, occupancyRate: 65, cleaningFee: 120, avgStayNights: 3, platformFee: 15, monthlyInsurance: 250, monthlyTaxes: 400, monthlyUtilities: 350, monthlyMaintenance: 300, monthlyPM: 20, monthlyHOA: 0, monthlyCapEx: 200, furnishingCost: 15000, monthlySupplies: 150, appreciationRate: 3 },
  wholesale: { name: "", contractPrice: 150000, assignmentFee: 15000, earnestMoney: 2000, marketingCost: 500, closingCost: 500, inspectionCost: 400, arv: 250000, estimatedRepairCost: 45000, holdingDays: 21 },
  multi: { name: "", purchasePrice: 1200000, units: 12, avgRentPerUnit: 1100, closingBuy: 3, downPayment: 25, loanRate: 6.5, loanTerm: 30, vacancyRate: 7, monthlyInsurancePerUnit: 80, monthlyTaxesPerUnit: 120, monthlyMaintenancePerUnit: 100, monthlyPMPercent: 8, monthlyCapExPerUnit: 75, monthlyCommonArea: 400, annualAdminCost: 6000, appreciationRate: 3, rentGrowthRate: 2, exitCapRate: 7, holdYears: 5 },
  mhp: { name: "", purchasePrice: 800000, lots: 50, occupiedLots: 40, lotRent: 350, closingBuy: 3, downPayment: 25, loanRate: 6.5, loanTerm: 25, vacancyRate: 10, monthlyInsurance: 800, monthlyTaxes: 1500, monthlyMaintenance: 1200, monthlyPMPercent: 8, monthlyUtilities: 600, monthlyAdmin: 500, monthlyCapEx: 500, infillCostPerLot: 15000, marketLotRent: 400, appreciationRate: 3 },
  storage: { name: "", purchasePrice: 600000, totalUnits: 100, occupiedUnits: 80, avgRentPerUnit: 95, closingBuy: 3, downPayment: 25, loanRate: 6.5, loanTerm: 25, monthlyInsurance: 500, monthlyTaxes: 800, monthlyMaintenance: 600, monthlyPMPercent: 8, monthlyUtilities: 400, monthlyMarketing: 300, monthlyAdmin: 400, monthlyCapEx: 400, appreciationRate: 3, marketRatePerUnit: 110 },
};

// ═══════════════════════════════════════════════════════════════
// DEAL TEMPLATES
// ═══════════════════════════════════════════════════════════════
const TEMPLATES = {
  flip: [
    { name: "Conservative Flip", data: { ...DEFAULTS.flip, purchasePrice: 150000, rehabCost: 25000, arv: 235000, holdMonths: 4, interestRate: 10, loanAmount: 120000 } },
    { name: "Value-Add Rehab", data: { ...DEFAULTS.flip, purchasePrice: 200000, rehabCost: 55000, arv: 360000, holdMonths: 5, interestRate: 10, loanAmount: 170000 } },
    { name: "Cosmetic Only", data: { ...DEFAULTS.flip, purchasePrice: 260000, rehabCost: 12000, arv: 365000, holdMonths: 3, interestRate: 10, loanAmount: 234000 } },
  ],
  brrrr: [
    { name: "Textbook BRRRR", data: { ...DEFAULTS.brrrr, purchasePrice: 120000, rehabCost: 30000, arv: 230000, refiLTV: 65, monthlyRent: 2200, refiRate: 7, loanAmount: 96000, interestRate: 10 } },
    { name: "High-Rent Market", data: { ...DEFAULTS.brrrr, purchasePrice: 200000, rehabCost: 45000, arv: 340000, refiLTV: 70, monthlyRent: 2800, refiRate: 6.5, loanAmount: 160000, interestRate: 10 } },
  ],
  rental: [
    { name: "Value-Add Rental", data: { ...DEFAULTS.rental, purchasePrice: 150000, monthlyRent: 1950, downPayment: 30, loanRate: 7 } },
    { name: "Mid-Market Rental", data: { ...DEFAULTS.rental, purchasePrice: 220000, monthlyRent: 2400, downPayment: 25, loanRate: 7 } },
    { name: "DSCR Loan Deal", data: { ...DEFAULTS.rental, purchasePrice: 300000, monthlyRent: 3200, downPayment: 25, loanRate: 7.5 } },
  ],
  str: [
    { name: "Mountain Cabin", data: { ...DEFAULTS.str, purchasePrice: 360000, nightlyRate: 195, occupancyRate: 62, furnishingCost: 18000, monthlyUtilities: 400 } },
    { name: "Beach House", data: { ...DEFAULTS.str, purchasePrice: 550000, nightlyRate: 320, occupancyRate: 60, furnishingCost: 25000 } },
    { name: "Urban STR", data: { ...DEFAULTS.str, purchasePrice: 280000, nightlyRate: 130, occupancyRate: 72, furnishingCost: 10000 } },
  ],
  wholesale: [
    { name: "Quick Assign", data: { ...DEFAULTS.wholesale, contractPrice: 120000, assignmentFee: 12000, arv: 200000, estimatedRepairCost: 30000, holdingDays: 14 } },
    { name: "Value Wholesale", data: { ...DEFAULTS.wholesale, contractPrice: 180000, assignmentFee: 20000, arv: 310000, estimatedRepairCost: 55000, holdingDays: 21 } },
  ],
  multi: [
    { name: "8-Unit Value Add", data: { ...DEFAULTS.multi, purchasePrice: 600000, units: 8, avgRentPerUnit: 950, vacancyRate: 8 } },
    { name: "20-Unit Stabilized", data: { ...DEFAULTS.multi, purchasePrice: 1800000, units: 20, avgRentPerUnit: 1200, vacancyRate: 5 } },
  ],
  mhp: [
    { name: "Small MHP", data: { ...DEFAULTS.mhp, purchasePrice: 500000, lots: 30, occupiedLots: 22, lotRent: 320, marketLotRent: 380 } },
    { name: "Value-Add Park", data: { ...DEFAULTS.mhp, purchasePrice: 1200000, lots: 80, occupiedLots: 55, lotRent: 280, marketLotRent: 400 } },
  ],
  storage: [
    { name: "Small Facility", data: { ...DEFAULTS.storage, purchasePrice: 350000, totalUnits: 60, occupiedUnits: 45, avgRentPerUnit: 80, marketRatePerUnit: 95 } },
    { name: "Value-Add Storage", data: { ...DEFAULTS.storage, purchasePrice: 900000, totalUnits: 150, occupiedUnits: 100, avgRentPerUnit: 75, marketRatePerUnit: 110 } },
  ],
};

function calcFlip(f) {
  const cBuy = f.purchasePrice * (f.closingBuy / 100), cSell = f.arv * (f.closingSell / 100);
  const agent = f.arv * (f.agentCommission / 100), pts = f.loanAmount * (f.loanPoints / 100);
  const moInt = f.loanAmount * (f.interestRate / 100 / 12), totInt = moInt * f.holdMonths;
  const moHold = f.monthlyInsurance + f.monthlyTaxes + f.monthlyUtilities + f.monthlyHOA + f.monthlyMisc + moInt;
  const totHold = moHold * f.holdMonths;
  const allIn = f.purchasePrice + f.rehabCost + cBuy + cSell + agent + pts + totHold;
  const cash = (f.purchasePrice - f.loanAmount) + f.rehabCost + cBuy + pts + moHold * f.holdMonths;
  const profit = f.arv - allIn;
  const naive = f.arv - f.purchasePrice - f.rehabCost - cBuy - cSell - agent;
  const roi = cash > 0 ? (profit / cash) * 100 : 0;
  const annRoi = f.holdMonths > 0 ? roi * (12 / f.holdMonths) : 0;
  const margin = f.arv > 0 ? (profit / f.arv) * 100 : 0;
  const score = clamp(40 + (margin > 0 ? margin * 1.5 : margin * 3) + (roi > 20 ? 15 : roi > 0 ? roi * 0.75 : roi * 1.5) + (f.holdMonths <= 4 ? 10 : f.holdMonths <= 6 ? 5 : 0), 0, 100);
  const costs = [{ name: "Purchase", value: f.purchasePrice }, { name: "Rehab", value: f.rehabCost }, { name: "Holding", value: totHold }, { name: "Closing (Buy)", value: cBuy }, { name: "Closing (Sell)", value: cSell }, { name: "Agent", value: agent }, { name: "Loan Points", value: pts }].filter(d => d.value > 0);
  const holding = [{ name: "Loan Interest", value: totInt }, { name: "Insurance", value: f.monthlyInsurance * f.holdMonths }, { name: "Tax", value: f.monthlyTaxes * f.holdMonths }, { name: "Utilities", value: f.monthlyUtilities * f.holdMonths }, { name: "HOA", value: f.monthlyHOA * f.holdMonths }, { name: "Misc", value: f.monthlyMisc * f.holdMonths }].filter(d => d.value > 0);
  return { profit, naive, roi, annRoi, allIn, cash, moHold, totHold, margin, score, costs, holding, profitPerMonth: f.holdMonths > 0 ? profit / f.holdMonths : 0, hidden: naive - profit };
}

function calcBrrrr(b) {
  const cBuy = b.purchasePrice * (b.closingBuy / 100), pts = b.loanAmount * (b.loanPoints / 100);
  const moInt = b.loanAmount * (b.interestRate / 100 / 12);
  const holdCost = (b.monthlyInsurance + b.monthlyTaxes + moInt + b.monthlyMaintenance) * b.holdMonthsToRefi;
  const totalBefore = (b.purchasePrice - b.loanAmount) + b.rehabCost + cBuy + pts + holdCost;
  const refiAmount = b.arv * (b.refiLTV / 100), refiClosing = refiAmount * (b.closingRefi / 100);
  const cashBack = refiAmount - b.loanAmount - refiClosing;
  const cashLeft = totalBefore - cashBack;
  const refiMoRate = b.refiRate / 100 / 12, refiN = b.refiTerm * 12;
  const refiPayment = refiAmount > 0 && refiMoRate > 0 ? refiAmount * (refiMoRate * Math.pow(1 + refiMoRate, refiN)) / (Math.pow(1 + refiMoRate, refiN) - 1) : 0;
  const effRent = b.monthlyRent * (1 - b.vacancyRate / 100);
  const pm = effRent * (b.monthlyPM / 100);
  const moExp = refiPayment + b.monthlyInsurance + b.monthlyTaxes + b.monthlyMaintenance + pm + b.monthlyCapEx;
  const moCF = effRent - moExp;
  const annCF = moCF * 12;
  const coC = cashLeft > 0 ? (annCF / cashLeft) * 100 : (cashLeft <= 0 && moCF > 0 ? 999 : 0);
  const infinite = cashLeft <= 0 && moCF > 0;
  const naive = b.monthlyRent - refiPayment - b.monthlyInsurance - b.monthlyTaxes;
  const score = clamp(30 + (infinite ? 35 : cashLeft < totalBefore * 0.3 ? 20 : 10) + (moCF > 0 ? Math.min(25, moCF / 20) : moCF * 2) + (coC > 12 || infinite ? 15 : coC > 0 ? coC : coC * 1.5), 0, 100);
  const costs = [{ name: "Down + Rehab", value: totalBefore }, { name: "Refi Closing", value: refiClosing }].filter(d => d.value > 0);
  const expenses = [{ name: "Mortgage (Refi)", value: refiPayment }, { name: "Insurance", value: b.monthlyInsurance }, { name: "Taxes", value: b.monthlyTaxes }, { name: "Maintenance", value: b.monthlyMaintenance }, { name: "PM", value: pm }, { name: "CapEx", value: b.monthlyCapEx }].filter(d => d.value > 0);
  return { totalBefore, refiAmount, cashBack, cashLeft, refiPayment, effRent, moExp, moCF, annCF, coC, infinite, naive, score, costs, expenses, holdCost };
}

function calcRental(r) {
  const closingCost = r.purchasePrice * (r.closingBuy / 100);
  const downAmt = r.purchasePrice * (r.downPayment / 100);
  const loanAmt = r.purchasePrice - downAmt;
  const moRate = r.loanRate / 100 / 12, nPay = r.loanTerm * 12;
  const mortgage = loanAmt > 0 && moRate > 0 ? loanAmt * (moRate * Math.pow(1 + moRate, nPay)) / (Math.pow(1 + moRate, nPay) - 1) : 0;
  const effRent = r.monthlyRent * (1 - r.vacancyRate / 100);
  const pm = effRent * (r.monthlyPM / 100);
  const totExp = mortgage + r.monthlyInsurance + r.monthlyTaxes + r.monthlyMaintenance + pm + r.monthlyHOA + r.monthlyCapEx;
  const moCF = effRent - totExp;
  const annCF = moCF * 12;
  const cashIn = downAmt + r.rehabCost + closingCost;
  const coC = cashIn > 0 ? (annCF / cashIn) * 100 : 0;
  const noi = (effRent - r.monthlyInsurance - r.monthlyTaxes - r.monthlyMaintenance - pm - r.monthlyHOA - r.monthlyCapEx) * 12;
  const capRate = r.purchasePrice > 0 ? (noi / r.purchasePrice) * 100 : 0;
  const dscr = mortgage > 0 ? (noi / 12) / mortgage : 0;
  const naive = r.monthlyRent - mortgage - r.monthlyInsurance - r.monthlyTaxes - r.monthlyHOA;
  const score = clamp(30 + (coC > 10 ? 20 : coC > 0 ? coC * 2 : coC * 3) + (capRate > 8 ? 15 : capRate > 5 ? 10 : 5) + (dscr > 1.25 ? 15 : dscr > 1 ? 8 : 0) + (moCF > 200 ? 15 : moCF > 0 ? 10 : 0), 0, 100);
  const expenses = [{ name: "Mortgage", value: mortgage }, { name: "Insurance", value: r.monthlyInsurance }, { name: "Taxes", value: r.monthlyTaxes }, { name: "Maintenance", value: r.monthlyMaintenance }, { name: "PM", value: pm }, { name: "CapEx", value: r.monthlyCapEx }, { name: "HOA", value: r.monthlyHOA }].filter(d => d.value > 0);
  const proj = [];
  let eq = downAmt + r.rehabCost, pv = r.purchasePrice + r.rehabCost, rl = loanAmt;
  for (let y = 1; y <= 5; y++) {
    pv *= (1 + r.appreciationRate / 100);
    const yi = rl * (r.loanRate / 100), yp = (mortgage * 12) - yi;
    rl = Math.max(0, rl - yp); eq = pv - rl;
    proj.push({ year: `Yr ${y}`, cashFlow: Math.round(annCF), equity: Math.round(eq), value: Math.round(pv) });
  }
  return { mortgage, effRent, pm, totExp, moCF, annCF, cashIn, coC, noi, capRate, dscr, naive, score, expenses, proj, downAmt, loanAmt, closingCost, hidden: naive - moCF };
}

function calcSTR(s) {
  const closingCost = s.purchasePrice * (s.closingBuy / 100);
  const downAmt = s.purchasePrice * (s.downPayment / 100), loanAmt = s.purchasePrice - downAmt;
  const moRate = s.loanRate / 100 / 12, nPay = s.loanTerm * 12;
  const mortgage = loanAmt > 0 && moRate > 0 ? loanAmt * (moRate * Math.pow(1 + moRate, nPay)) / (Math.pow(1 + moRate, nPay) - 1) : 0;
  const nightsPerMonth = 30.4 * (s.occupancyRate / 100);
  const grossBooking = nightsPerMonth * s.nightlyRate;
  const turnovers = nightsPerMonth / Math.max(1, s.avgStayNights);
  const cleaningIncome = turnovers * s.cleaningFee;
  const grossRevenue = grossBooking + cleaningIncome;
  const platformCut = grossRevenue * (s.platformFee / 100);
  const netRevenue = grossRevenue - platformCut;
  const pm = netRevenue * (s.monthlyPM / 100);
  const cleaningCost = turnovers * s.cleaningFee; // paid to cleaner (offset by guest fee, but platform takes a cut)
  const totExp = mortgage + s.monthlyInsurance + s.monthlyTaxes + s.monthlyUtilities + s.monthlyMaintenance + pm + s.monthlyHOA + s.monthlyCapEx + s.monthlySupplies;
  const moCF = netRevenue - totExp;
  const annCF = moCF * 12;
  const cashIn = downAmt + s.rehabCost + closingCost + s.furnishingCost;
  const coC = cashIn > 0 ? (annCF / cashIn) * 100 : 0;
  const naive = grossBooking - mortgage - s.monthlyInsurance - s.monthlyTaxes;
  const revPerNight = nightsPerMonth > 0 ? netRevenue / nightsPerMonth : 0;
  const breakEvenOcc = grossBooking > 0 ? (totExp / (s.nightlyRate * 30.4)) * 100 : 0;
  const score = clamp(30 + (coC > 12 ? 20 : coC > 6 ? 15 : coC > 0 ? 8 : 0) + (moCF > 500 ? 20 : moCF > 200 ? 15 : moCF > 0 ? 8 : 0) + (s.occupancyRate > 70 ? 15 : s.occupancyRate > 50 ? 10 : 5) + (breakEvenOcc < 45 ? 15 : breakEvenOcc < 60 ? 10 : 5), 0, 100);
  const expenses = [{ name: "Mortgage", value: mortgage }, { name: "Insurance", value: s.monthlyInsurance }, { name: "Taxes", value: s.monthlyTaxes }, { name: "Utilities", value: s.monthlyUtilities }, { name: "Maintenance", value: s.monthlyMaintenance }, { name: "PM", value: pm }, { name: "CapEx", value: s.monthlyCapEx }, { name: "Supplies", value: s.monthlySupplies }, { name: "Platform Fee", value: platformCut }].filter(d => d.value > 0);
  return { grossRevenue, netRevenue, platformCut, moCF, annCF, cashIn, coC, naive, revPerNight, breakEvenOcc, score, expenses, nightsPerMonth, turnovers, mortgage, downAmt, closingCost, hidden: naive - moCF };
}

function calcWholesale(w) {
  const totalCost = w.earnestMoney + w.marketingCost + w.closingCost + w.inspectionCost;
  const profit = w.assignmentFee - w.marketingCost - w.closingCost - w.inspectionCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  const maxOffer = w.arv * 0.7 - w.estimatedRepairCost;
  const spread = maxOffer - w.contractPrice;
  const daysToProfit = w.holdingDays;
  const annRoi = daysToProfit > 0 ? roi * (365 / daysToProfit) : 0;
  const naive = w.assignmentFee;
  const score = clamp(30 + (profit > 10000 ? 20 : profit > 5000 ? 15 : profit > 0 ? 8 : 0) + (roi > 300 ? 20 : roi > 100 ? 15 : roi > 0 ? 8 : 0) + (spread > 20000 ? 15 : spread > 10000 ? 10 : spread > 0 ? 5 : 0) + (daysToProfit < 21 ? 15 : daysToProfit < 45 ? 10 : 5), 0, 100);
  const costs = [{ name: "Earnest Money", value: w.earnestMoney }, { name: "Marketing", value: w.marketingCost }, { name: "Closing", value: w.closingCost }, { name: "Inspection", value: w.inspectionCost }].filter(d => d.value > 0);
  return { profit, totalCost, roi, annRoi, maxOffer, spread, score, naive, costs };
}

function calcMulti(m) {
  const grossRent = m.units * m.avgRentPerUnit * 12;
  const effGross = grossRent * (1 - m.vacancyRate / 100);
  const annIns = m.monthlyInsurancePerUnit * m.units * 12, annTax = m.monthlyTaxesPerUnit * m.units * 12;
  const annMaint = m.monthlyMaintenancePerUnit * m.units * 12, annCapEx = m.monthlyCapExPerUnit * m.units * 12;
  const annCommon = m.monthlyCommonArea * 12, annPM = effGross * (m.monthlyPMPercent / 100);
  const opEx = annIns + annTax + annMaint + annCapEx + annCommon + annPM + m.annualAdminCost;
  const noi = effGross - opEx;
  const closingCost = m.purchasePrice * (m.closingBuy / 100);
  const downAmt = m.purchasePrice * (m.downPayment / 100), loanAmt = m.purchasePrice - downAmt;
  const moRate = m.loanRate / 100 / 12, nPay = m.loanTerm * 12;
  const mortgage = loanAmt > 0 && moRate > 0 ? loanAmt * (moRate * Math.pow(1 + moRate, nPay)) / (Math.pow(1 + moRate, nPay) - 1) : 0;
  const annDebt = mortgage * 12;
  const annCF = noi - annDebt;
  const moCF = annCF / 12;
  const cashIn = downAmt + closingCost;
  const coC = cashIn > 0 ? (annCF / cashIn) * 100 : 0;
  const entryCapRate = m.purchasePrice > 0 ? (noi / m.purchasePrice) * 100 : 0;
  const dscr = annDebt > 0 ? noi / annDebt : 0;
  const pricePerUnit = m.units > 0 ? m.purchasePrice / m.units : 0;
  const expenseRatio = effGross > 0 ? (opEx / effGross) * 100 : 0;
  const grm = grossRent > 0 ? m.purchasePrice / grossRent : 0;
  let totalCF = 0, rl = loanAmt, pv = m.purchasePrice, rent = m.avgRentPerUnit;
  const proj = [];
  for (let y = 1; y <= m.holdYears; y++) {
    rent *= (1 + m.rentGrowthRate / 100); pv *= (1 + m.appreciationRate / 100);
    const yGross = m.units * rent * 12 * (1 - m.vacancyRate / 100);
    const yOpEx = opEx * Math.pow(1.02, y - 1);
    const yNOI = yGross - yOpEx;
    const yCF = yNOI - annDebt;
    totalCF += yCF;
    const yi = rl * (m.loanRate / 100), yp = annDebt - yi; rl = Math.max(0, rl - yp);
    proj.push({ year: `Yr ${y}`, cashFlow: Math.round(yCF), noi: Math.round(yNOI), value: Math.round(pv) });
  }
  const exitValue = m.exitCapRate > 0 ? (proj[proj.length - 1]?.noi || noi) / (m.exitCapRate / 100) : pv;
  const exitProceeds = exitValue - rl - exitValue * 0.06;
  const totalReturn = totalCF + exitProceeds - cashIn;
  const equityMultiple = cashIn > 0 ? (totalCF + exitProceeds) / cashIn : 0;
  const avgAnnReturn = m.holdYears > 0 ? (totalReturn / cashIn / m.holdYears) * 100 : 0;
  const naive = (m.units * m.avgRentPerUnit) - mortgage - (m.monthlyInsurancePerUnit + m.monthlyTaxesPerUnit) * m.units;
  const score = clamp(25 + (coC > 8 ? 18 : coC > 4 ? 12 : coC > 0 ? 6 : 0) + (entryCapRate > 8 ? 15 : entryCapRate > 6 ? 10 : 5) + (dscr > 1.3 ? 15 : dscr > 1.15 ? 10 : 5) + (equityMultiple > 2 ? 15 : equityMultiple > 1.5 ? 10 : 5) + (expenseRatio < 50 ? 12 : expenseRatio < 60 ? 8 : 3), 0, 100);
  const expenses = [{ name: "Insurance", value: annIns }, { name: "Taxes", value: annTax }, { name: "Maintenance", value: annMaint }, { name: "PM", value: annPM }, { name: "CapEx", value: annCapEx }, { name: "Common Area", value: annCommon }, { name: "Admin", value: m.annualAdminCost }].filter(d => d.value > 0);
  return { noi, annCF, moCF, cashIn, coC, entryCapRate, dscr, pricePerUnit, expenseRatio, grm, mortgage, score, expenses, proj, exitValue, exitProceeds, totalReturn, equityMultiple, avgAnnReturn, naive, effGross, opEx, hidden: naive - moCF, downAmt, loanAmt };
}

function calcMHP(p) {
  const grossRent = p.occupiedLots * p.lotRent * 12;
  const potentialRent = p.lots * p.lotRent * 12;
  const effVac = 1 - (p.occupiedLots / Math.max(1, p.lots));
  const annIns = p.monthlyInsurance * 12, annTax = p.monthlyTaxes * 12;
  const annMaint = p.monthlyMaintenance * 12, annUtil = p.monthlyUtilities * 12;
  const annAdmin = p.monthlyAdmin * 12, annCapEx = p.monthlyCapEx * 12;
  const annPM = grossRent * (p.monthlyPMPercent / 100);
  const opEx = annIns + annTax + annMaint + annUtil + annAdmin + annCapEx + annPM;
  const noi = grossRent - opEx;
  const closingCost = p.purchasePrice * (p.closingBuy / 100);
  const downAmt = p.purchasePrice * (p.downPayment / 100), loanAmt = p.purchasePrice - downAmt;
  const moRate = p.loanRate / 100 / 12, nPay = p.loanTerm * 12;
  const mortgage = loanAmt > 0 && moRate > 0 ? loanAmt * (moRate * Math.pow(1 + moRate, nPay)) / (Math.pow(1 + moRate, nPay) - 1) : 0;
  const annDebt = mortgage * 12, annCF = noi - annDebt, moCF = annCF / 12;
  const cashIn = downAmt + closingCost;
  const coC = cashIn > 0 ? (annCF / cashIn) * 100 : 0;
  const capRate = p.purchasePrice > 0 ? (noi / p.purchasePrice) * 100 : 0;
  const dscr = annDebt > 0 ? noi / annDebt : 0;
  const pricePerLot = p.lots > 0 ? p.purchasePrice / p.lots : 0;
  const emptyLots = p.lots - p.occupiedLots;
  const infillTotal = emptyLots * p.infillCostPerLot;
  const infillNOI = emptyLots * p.marketLotRent * 12 * 0.9;
  const infillROI = infillTotal > 0 ? (infillNOI / infillTotal) * 100 : 0;
  const raisedNOI = p.occupiedLots * (p.marketLotRent - p.lotRent) * 12;
  const upside = infillNOI + raisedNOI;
  const naive = (p.occupiedLots * p.lotRent) - mortgage - p.monthlyInsurance - p.monthlyTaxes;
  const score = clamp(25 + (coC > 10 ? 18 : coC > 5 ? 12 : 5) + (capRate > 10 ? 15 : capRate > 7 ? 10 : 5) + (dscr > 1.3 ? 12 : dscr > 1 ? 8 : 0) + (emptyLots > 5 ? 12 : emptyLots > 0 ? 8 : 5) + (p.lotRent < p.marketLotRent ? 10 : 5) + (effVac < 0.15 ? 8 : effVac < 0.25 ? 5 : 0), 0, 100);
  const expenses = [{ name: "Insurance", value: annIns }, { name: "Taxes", value: annTax }, { name: "Maintenance", value: annMaint }, { name: "Utilities", value: annUtil }, { name: "PM", value: annPM }, { name: "CapEx", value: annCapEx }, { name: "Admin", value: annAdmin }].filter(d => d.value > 0);
  return { noi, annCF, moCF, cashIn, coC, capRate, dscr, pricePerLot, mortgage, score, expenses, emptyLots, infillTotal, infillNOI, infillROI, raisedNOI, upside, naive, grossRent, opEx, hidden: naive - moCF, effVac: effVac * 100, downAmt };
}

function calcStorage(s) {
  const grossRent = s.occupiedUnits * s.avgRentPerUnit * 12;
  const annIns = s.monthlyInsurance * 12, annTax = s.monthlyTaxes * 12;
  const annMaint = s.monthlyMaintenance * 12, annUtil = s.monthlyUtilities * 12;
  const annMktg = s.monthlyMarketing * 12, annAdmin = s.monthlyAdmin * 12, annCapEx = s.monthlyCapEx * 12;
  const annPM = grossRent * (s.monthlyPMPercent / 100);
  const opEx = annIns + annTax + annMaint + annUtil + annMktg + annAdmin + annCapEx + annPM;
  const noi = grossRent - opEx;
  const closingCost = s.purchasePrice * (s.closingBuy / 100);
  const downAmt = s.purchasePrice * (s.downPayment / 100), loanAmt = s.purchasePrice - downAmt;
  const moRate = s.loanRate / 100 / 12, nPay = s.loanTerm * 12;
  const mortgage = loanAmt > 0 && moRate > 0 ? loanAmt * (moRate * Math.pow(1 + moRate, nPay)) / (Math.pow(1 + moRate, nPay) - 1) : 0;
  const annDebt = mortgage * 12, annCF = noi - annDebt, moCF = annCF / 12;
  const cashIn = downAmt + closingCost;
  const coC = cashIn > 0 ? (annCF / cashIn) * 100 : 0;
  const capRate = s.purchasePrice > 0 ? (noi / s.purchasePrice) * 100 : 0;
  const dscr = annDebt > 0 ? noi / annDebt : 0;
  const pricePerUnit = s.totalUnits > 0 ? s.purchasePrice / s.totalUnits : 0;
  const occRate = s.totalUnits > 0 ? (s.occupiedUnits / s.totalUnits) * 100 : 0;
  const emptyUnits = s.totalUnits - s.occupiedUnits;
  const rateUpside = s.occupiedUnits * (s.marketRatePerUnit - s.avgRentPerUnit) * 12;
  const occUpside = emptyUnits * s.marketRatePerUnit * 12 * 0.85;
  const naive = (s.occupiedUnits * s.avgRentPerUnit) - mortgage - s.monthlyInsurance - s.monthlyTaxes;
  const score = clamp(25 + (coC > 10 ? 18 : coC > 5 ? 12 : 5) + (capRate > 9 ? 15 : capRate > 6 ? 10 : 5) + (dscr > 1.3 ? 12 : dscr > 1 ? 8 : 0) + (occRate > 85 ? 10 : occRate > 70 ? 7 : 3) + (s.avgRentPerUnit < s.marketRatePerUnit ? 10 : 5) + (emptyUnits > 10 ? 10 : emptyUnits > 0 ? 7 : 5), 0, 100);
  const expenses = [{ name: "Insurance", value: annIns }, { name: "Taxes", value: annTax }, { name: "Maintenance", value: annMaint }, { name: "Utilities", value: annUtil }, { name: "Marketing", value: annMktg }, { name: "PM", value: annPM }, { name: "CapEx", value: annCapEx }, { name: "Admin", value: annAdmin }].filter(d => d.value > 0);
  return { noi, annCF, moCF, cashIn, coC, capRate, dscr, pricePerUnit, occRate, mortgage, score, expenses, emptyUnits, rateUpside, occUpside, naive, grossRent, opEx, hidden: naive - moCF, downAmt };
}

const CALCS = { flip: calcFlip, brrrr: calcBrrrr, rental: calcRental, str: calcSTR, wholesale: calcWholesale, multi: calcMulti, mhp: calcMHP, storage: calcStorage };

// ═══════════════════════════════════════════════════════════════
// DEAL INPUT FORMS
// ═══════════════════════════════════════════════════════════════
const FlipInputs = ({ d, u, t }) => (<div className="space-y-4">
  <Sec title={t?.secDealDetails || "Deal Details"} icon={Building2}><div className="space-y-3">
    <Input label={t?.inDealName || "Deal Name (optional)"} value={d.name || ""} onChange={v => u("name", v)} pre="" text />
    <Input label={t?.inPurchasePrice || "Purchase Price"} value={d.purchasePrice} onChange={v => u("purchasePrice", v)} />
    <Input label={t?.inRehabCost || "Rehab Cost"} value={d.rehabCost} onChange={v => u("rehabCost", v)} />
    <Input label={t?.inARV || "After Repair Value (ARV)"} value={d.arv} onChange={v => u("arv", v)} />
    <div className="flex gap-3"><Input sm label={t?.inHoldPeriod || "Hold Period"} value={d.holdMonths} onChange={v => u("holdMonths", v)} pre="" suf="months" /><Input sm label={t?.inAgentComm || "Agent Commission"} value={d.agentCommission} onChange={v => u("agentCommission", v)} pre="" suf="%" /></div>
    <div className="flex gap-3"><Input sm label={t?.inClosingBuy || "Closing (Buy)"} value={d.closingBuy} onChange={v => u("closingBuy", v)} pre="" suf="%" /><Input sm label={t?.inClosingSell || "Closing (Sell)"} value={d.closingSell} onChange={v => u("closingSell", v)} pre="" suf="%" /></div>
  </div></Sec>
  <Sec title={t?.secFinancing || "Financing"} icon={DollarSign} col><div className="space-y-3">
    <Input label={t?.inLoanAmount || "Loan Amount"} value={d.loanAmount} onChange={v => u("loanAmount", v)} />
    <div className="flex gap-3"><Input sm label={t?.inInterestRate || "Interest Rate"} value={d.interestRate} onChange={v => u("interestRate", v)} pre="" suf="%" /><Input sm label={t?.inPoints || "Points"} value={d.loanPoints} onChange={v => u("loanPoints", v)} pre="" suf="%" /></div>
  </div></Sec>
  <Sec title={t?.secMonthlyCosts || "Monthly Holding Costs"} icon={Clock} col><div className="space-y-3">
    <div className="text-xs px-2 py-2 rounded-lg" style={{ background: B.grnL, color: B.pri, fontWeight: 500 }}>⚡ {t?.holdingCostTip || "Most calculators skip this. These costs eat profit every month you hold."}</div>
    <div className="flex gap-3"><Input sm label={t?.inInsurance || "Insurance"} value={d.monthlyInsurance} onChange={v => u("monthlyInsurance", v)} suf="/mo" /><Input sm label={t?.inTaxes || "Property Tax"} value={d.monthlyTaxes} onChange={v => u("monthlyTaxes", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inUtilities || "Utilities"} value={d.monthlyUtilities} onChange={v => u("monthlyUtilities", v)} suf="/mo" /><Input sm label={t?.inHOA || "HOA"} value={d.monthlyHOA} onChange={v => u("monthlyHOA", v)} suf="/mo" /></div>
    <Input label={t?.inMisc || "Misc (lawn, security)"} value={d.monthlyMisc} onChange={v => u("monthlyMisc", v)} suf="/mo" />
  </div></Sec>
</div>);

const BrrrrInputs = ({ d, u, t }) => (<div className="space-y-4">
  <Sec title={t?.secAcquisition || "Acquisition"} icon={Building2}><div className="space-y-3">
    <Input label={t?.inDealName || "Deal Name (optional)"} value={d.name || ""} onChange={v => u("name", v)} pre="" text />
    <Input label={t?.inPurchasePrice || "Purchase Price"} value={d.purchasePrice} onChange={v => u("purchasePrice", v)} />
    <Input label={t?.inRehabCost || "Rehab Cost"} value={d.rehabCost} onChange={v => u("rehabCost", v)} />
    <Input label={t?.inARV || "ARV (After Repair Value)"} value={d.arv} onChange={v => u("arv", v)} />
    <Input label={t?.inMonthlyRent || "Monthly Rent (After Rehab)"} value={d.monthlyRent} onChange={v => u("monthlyRent", v)} />
    <div className="flex gap-3"><Input sm label={t?.inHoldToRefi || "Hold to Refi"} value={d.holdMonthsToRefi} onChange={v => u("holdMonthsToRefi", v)} pre="" suf="months" /><Input sm label={t?.inVacancy || "Vacancy"} value={d.vacancyRate} onChange={v => u("vacancyRate", v)} pre="" suf="%" /></div>
    <Input label={t?.inClosingBuy || "Closing (Buy)"} value={d.closingBuy} onChange={v => u("closingBuy", v)} pre="" suf="%" />
  </div></Sec>
  <Sec title={t?.secInitialLoan || "Initial Loan"} icon={DollarSign} col><div className="space-y-3">
    <Input label={t?.inLoanAmount || "Loan Amount"} value={d.loanAmount} onChange={v => u("loanAmount", v)} />
    <div className="flex gap-3"><Input sm label={t?.inInterestRate || "Interest Rate"} value={d.interestRate} onChange={v => u("interestRate", v)} pre="" suf="%" /><Input sm label={t?.inPoints || "Points"} value={d.loanPoints} onChange={v => u("loanPoints", v)} pre="" suf="%" /></div>
  </div></Sec>
  <Sec title={t?.secRefinance || "Refinance"} icon={TrendingUp} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inRefiLTV || "Refi LTV"} value={d.refiLTV} onChange={v => u("refiLTV", v)} pre="" suf="%" /><Input sm label={t?.inRefiRate || "Refi Rate"} value={d.refiRate} onChange={v => u("refiRate", v)} pre="" suf="%" /></div>
    <div className="flex gap-3"><Input sm label={t?.inRefiTerm || "Refi Term"} value={d.refiTerm} onChange={v => u("refiTerm", v)} pre="" suf="years" /><Input sm label={t?.inRefiClosing || "Refi Closing"} value={d.closingRefi} onChange={v => u("closingRefi", v)} pre="" suf="%" /></div>
  </div></Sec>
  <Sec title={t?.secMonthlyCostsAfterRefi || "Monthly Costs (After Refi)"} icon={Clock} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inInsurance || "Insurance"} value={d.monthlyInsurance} onChange={v => u("monthlyInsurance", v)} suf="/mo" /><Input sm label={t?.inTaxes || "Taxes"} value={d.monthlyTaxes} onChange={v => u("monthlyTaxes", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inMaintenance || "Maintenance"} value={d.monthlyMaintenance} onChange={v => u("monthlyMaintenance", v)} suf="/mo" /><Input sm label={t?.inPM || "PM Fee"} value={d.monthlyPM} onChange={v => u("monthlyPM", v)} pre="" suf="% of rent" /></div>
    <Input label={t?.inCapEx || "CapEx Reserve"} value={d.monthlyCapEx} onChange={v => u("monthlyCapEx", v)} suf="/mo" />
  </div></Sec>
</div>);

const RentalInputs = ({ d, u, t }) => (<div className="space-y-4">
  <Sec title={t?.secProperty || "Property"} icon={Building2}><div className="space-y-3">
    <Input label={t?.inDealName || "Deal Name (optional)"} value={d.name || ""} onChange={v => u("name", v)} pre="" text />
    <Input label={t?.inPurchasePrice || "Purchase Price"} value={d.purchasePrice} onChange={v => u("purchasePrice", v)} />
    <Input label={t?.inRehabCost || "Rehab Cost"} value={d.rehabCost} onChange={v => u("rehabCost", v)} />
    <Input label={t?.inMonthlyRent || "Monthly Rent"} value={d.monthlyRent} onChange={v => u("monthlyRent", v)} />
    <div className="flex gap-3"><Input sm label={t?.inClosing || "Closing Costs"} value={d.closingBuy} onChange={v => u("closingBuy", v)} pre="" suf="%" /><Input sm label={t?.inVacancy || "Vacancy"} value={d.vacancyRate} onChange={v => u("vacancyRate", v)} pre="" suf="%" /></div>
  </div></Sec>
  <Sec title={t?.secFinancing || "Financing"} icon={DollarSign} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inDownPayment || "Down Payment"} value={d.downPayment} onChange={v => u("downPayment", v)} pre="" suf="%" /><Input sm label={t?.inRate || "Rate"} value={d.loanRate} onChange={v => u("loanRate", v)} pre="" suf="%" /></div>
    <Input label={t?.inTerm || "Loan Term"} value={d.loanTerm} onChange={v => u("loanTerm", v)} pre="" suf="years" />
  </div></Sec>
  <Sec title={t?.secMonthlyExp || "Monthly Costs"} icon={Clock} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inInsurance || "Insurance"} value={d.monthlyInsurance} onChange={v => u("monthlyInsurance", v)} suf="/mo" /><Input sm label={t?.inTaxes || "Taxes"} value={d.monthlyTaxes} onChange={v => u("monthlyTaxes", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inMaintenance || "Maintenance"} value={d.monthlyMaintenance} onChange={v => u("monthlyMaintenance", v)} suf="/mo" /><Input sm label={t?.inCapEx || "CapEx"} value={d.monthlyCapEx} onChange={v => u("monthlyCapEx", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inPM || "PM Fee"} value={d.monthlyPM} onChange={v => u("monthlyPM", v)} pre="" suf="% rent" /><Input sm label={t?.inHOA || "HOA"} value={d.monthlyHOA} onChange={v => u("monthlyHOA", v)} suf="/mo" /></div>
    <Input label={t?.inAppreciation || "Appreciation"} value={d.appreciationRate} onChange={v => u("appreciationRate", v)} pre="" suf="% /yr" />
  </div></Sec>
</div>);

const STRInputs = ({ d, u, t }) => (<div className="space-y-4">
  <Sec title={t?.secProperty || "Property"} icon={MapPin}><div className="space-y-3">
    <Input label={t?.inDealName || "Deal Name (optional)"} value={d.name || ""} onChange={v => u("name", v)} pre="" text />
    <Input label={t?.inPurchasePrice || "Purchase Price"} value={d.purchasePrice} onChange={v => u("purchasePrice", v)} />
    <Input label={t?.inRehabCost || "Rehab Cost"} value={d.rehabCost} onChange={v => u("rehabCost", v)} />
    <Input label={t?.inFurnishing || "Furnishing Cost"} value={d.furnishingCost} onChange={v => u("furnishingCost", v)} />
    <Input label={t?.inClosing || "Closing"} value={d.closingBuy} onChange={v => u("closingBuy", v)} pre="" suf="%" />
  </div></Sec>
  <Sec title={t?.secRevenue || "Revenue"} icon={TrendingUp}><div className="space-y-3">
    <div className="text-xs px-2 py-2 rounded-lg" style={{ background: B.blueL, color: B.blue, fontWeight: 500 }}>{t?.tipAirDNA || "Use AirDNA or local comps for nightly rate and occupancy estimates."}</div>
    <div className="flex gap-3"><Input sm label={t?.inNightlyRate || "Nightly Rate"} value={d.nightlyRate} onChange={v => u("nightlyRate", v)} suf="/night" /><Input sm label={t?.inOccupancy || "Occupancy"} value={d.occupancyRate} onChange={v => u("occupancyRate", v)} pre="" suf="%" /></div>
    <div className="flex gap-3"><Input sm label={t?.inCleaningFee || "Cleaning Fee"} value={d.cleaningFee} onChange={v => u("cleaningFee", v)} suf="/turnover" /><Input sm label={t?.inAvgStay || "Avg Stay"} value={d.avgStayNights} onChange={v => u("avgStayNights", v)} pre="" suf="nights" /></div>
    <Input label={t?.inPlatformFee || "Platform Fee (Airbnb/VRBO)"} value={d.platformFee} onChange={v => u("platformFee", v)} pre="" suf="%" />
  </div></Sec>
  <Sec title={t?.secFinancing || "Financing"} icon={DollarSign} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inDownPayment || "Down Payment"} value={d.downPayment} onChange={v => u("downPayment", v)} pre="" suf="%" /><Input sm label={t?.inRate || "Rate"} value={d.loanRate} onChange={v => u("loanRate", v)} pre="" suf="%" /></div>
    <Input label={t?.inTerm || "Term"} value={d.loanTerm} onChange={v => u("loanTerm", v)} pre="" suf="years" />
  </div></Sec>
  <Sec title={t?.secMonthlyExp || "Monthly Costs"} icon={Clock} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inInsurance || "Insurance"} value={d.monthlyInsurance} onChange={v => u("monthlyInsurance", v)} suf="/mo" /><Input sm label={t?.inTaxes || "Taxes"} value={d.monthlyTaxes} onChange={v => u("monthlyTaxes", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inUtilities || "Utilities"} value={d.monthlyUtilities} onChange={v => u("monthlyUtilities", v)} suf="/mo" /><Input sm label={t?.inMaintenance || "Maintenance"} value={d.monthlyMaintenance} onChange={v => u("monthlyMaintenance", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inPM || "PM"} value={d.monthlyPM} onChange={v => u("monthlyPM", v)} pre="" suf="% net" /><Input sm label={t?.inSupplies || "Supplies"} value={d.monthlySupplies} onChange={v => u("monthlySupplies", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inCapEx || "CapEx"} value={d.monthlyCapEx} onChange={v => u("monthlyCapEx", v)} suf="/mo" /><Input sm label={t?.inHOA || "HOA"} value={d.monthlyHOA} onChange={v => u("monthlyHOA", v)} suf="/mo" /></div>
  </div></Sec>
</div>);

const WholesaleInputs = ({ d, u, t }) => (<div className="space-y-4">
  <Sec title={t?.secDeal || "Deal"} icon={ArrowRight}><div className="space-y-3">
    <Input label={t?.inDealName || "Deal Name (optional)"} value={d.name || ""} onChange={v => u("name", v)} pre="" text />
    <Input label={t?.inContractPrice || "Contract Price"} value={d.contractPrice} onChange={v => u("contractPrice", v)} />
    <Input label={t?.inAssignmentFee || "Assignment Fee"} value={d.assignmentFee} onChange={v => u("assignmentFee", v)} />
    <Input label={t?.inARV || "ARV"} value={d.arv} onChange={v => u("arv", v)} />
    <Input label={t?.inEstRepairCost || "Estimated Repair Cost"} value={d.estimatedRepairCost} onChange={v => u("estimatedRepairCost", v)} />
    <Input label={t?.inDaysToClose || "Days to Close"} value={d.holdingDays} onChange={v => u("holdingDays", v)} pre="" suf="days" />
  </div></Sec>
  <Sec title={t?.secYourCosts || "Your Costs"} icon={DollarSign}><div className="space-y-3">
    <Input label={t?.inEarnestMoney || "Earnest Money Deposit"} value={d.earnestMoney} onChange={v => u("earnestMoney", v)} />
    <Input label={t?.inMarketingCost || "Marketing Cost"} value={d.marketingCost} onChange={v => u("marketingCost", v)} />
    <Input label={t?.inClosingCosts || "Closing Costs"} value={d.closingCost} onChange={v => u("closingCost", v)} />
    <Input label={t?.inInspection || "Inspection"} value={d.inspectionCost} onChange={v => u("inspectionCost", v)} />
  </div></Sec>
</div>);

const MultiInputs = ({ d, u, t }) => (<div className="space-y-4">
  <Sec title={t?.secProperty || "Property"} icon={Layers}><div className="space-y-3">
    <Input label={t?.inDealName || "Deal Name (optional)"} value={d.name || ""} onChange={v => u("name", v)} pre="" text />
    <Input label={t?.inPurchasePrice || "Purchase Price"} value={d.purchasePrice} onChange={v => u("purchasePrice", v)} />
    <div className="flex gap-3"><Input sm label={t?.inTotalUnits || "Total Units"} value={d.units} onChange={v => u("units", v)} pre="" suf="units" /><Input sm label={t?.inAvgRentUnit || "Avg Rent/Unit"} value={d.avgRentPerUnit} onChange={v => u("avgRentPerUnit", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inVacancy || "Vacancy"} value={d.vacancyRate} onChange={v => u("vacancyRate", v)} pre="" suf="%" /><Input sm label={t?.inClosing || "Closing"} value={d.closingBuy} onChange={v => u("closingBuy", v)} pre="" suf="%" /></div>
  </div></Sec>
  <Sec title={t?.secFinancing || "Financing"} icon={DollarSign} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inDownPayment || "Down Payment"} value={d.downPayment} onChange={v => u("downPayment", v)} pre="" suf="%" /><Input sm label={t?.inRate || "Rate"} value={d.loanRate} onChange={v => u("loanRate", v)} pre="" suf="%" /></div>
    <Input label={t?.inTerm || "Term"} value={d.loanTerm} onChange={v => u("loanTerm", v)} pre="" suf="years" />
  </div></Sec>
  <Sec title={t?.secMonthlyCostsPerUnit || "Monthly Costs (Per Unit)"} icon={Clock} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inInsPerUnit || "Insurance"} value={d.monthlyInsurancePerUnit} onChange={v => u("monthlyInsurancePerUnit", v)} suf="/unit" /><Input sm label={t?.inTaxPerUnit || "Taxes"} value={d.monthlyTaxesPerUnit} onChange={v => u("monthlyTaxesPerUnit", v)} suf="/unit" /></div>
    <div className="flex gap-3"><Input sm label={t?.inMaintPerUnit || "Maintenance"} value={d.monthlyMaintenancePerUnit} onChange={v => u("monthlyMaintenancePerUnit", v)} suf="/unit" /><Input sm label={t?.inCapExPerUnit || "CapEx"} value={d.monthlyCapExPerUnit} onChange={v => u("monthlyCapExPerUnit", v)} suf="/unit" /></div>
    <div className="flex gap-3"><Input sm label={t?.inPM || "PM"} value={d.monthlyPMPercent} onChange={v => u("monthlyPMPercent", v)} pre="" suf="% EGI" /><Input sm label={t?.inCommonArea || "Common Area"} value={d.monthlyCommonArea} onChange={v => u("monthlyCommonArea", v)} suf="/mo" /></div>
    <Input label={t?.inAnnAdmin || "Annual Admin"} value={d.annualAdminCost} onChange={v => u("annualAdminCost", v)} suf="/yr" />
  </div></Sec>
  <Sec title={t?.secExitAssumptions || "Exit Assumptions"} icon={Target} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inHoldPeriod || "Hold Period"} value={d.holdYears} onChange={v => u("holdYears", v)} pre="" suf="years" /><Input sm label={t?.inExitCapRate || "Exit Cap Rate"} value={d.exitCapRate} onChange={v => u("exitCapRate", v)} pre="" suf="%" /></div>
    <div className="flex gap-3"><Input sm label={t?.inAppreciation || "Appreciation"} value={d.appreciationRate} onChange={v => u("appreciationRate", v)} pre="" suf="% /yr" /><Input sm label={t?.inRentGrowth || "Rent Growth"} value={d.rentGrowthRate} onChange={v => u("rentGrowthRate", v)} pre="" suf="% /yr" /></div>
  </div></Sec>
</div>);

const MHPInputs = ({ d, u, t }) => (<div className="space-y-4">
  <Sec title={t?.secParkDetails || "Park Details"} icon={Warehouse}><div className="space-y-3">
    <Input label={t?.inDealName || "Deal Name (optional)"} value={d.name || ""} onChange={v => u("name", v)} pre="" text />
    <Input label={t?.inPurchasePrice || "Purchase Price"} value={d.purchasePrice} onChange={v => u("purchasePrice", v)} />
    <div className="flex gap-3"><Input sm label={t?.inTotalLots || "Total Lots"} value={d.lots} onChange={v => u("lots", v)} pre="" suf="lots" /><Input sm label={t?.inOccupiedLots || "Occupied Lots"} value={d.occupiedLots} onChange={v => u("occupiedLots", v)} pre="" suf="lots" /></div>
    <div className="flex gap-3"><Input sm label={t?.inLotRent || "Current Lot Rent"} value={d.lotRent} onChange={v => u("lotRent", v)} suf="/mo" /><Input sm label={t?.inMarketLotRent || "Market Lot Rent"} value={d.marketLotRent} onChange={v => u("marketLotRent", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inClosing || "Closing"} value={d.closingBuy} onChange={v => u("closingBuy", v)} pre="" suf="%" /><Input sm label={t?.inInfillCost || "Infill Cost/Lot"} value={d.infillCostPerLot} onChange={v => u("infillCostPerLot", v)} suf="/lot" /></div>
  </div></Sec>
  <Sec title={t?.secFinancing || "Financing"} icon={DollarSign} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inDownPayment || "Down Payment"} value={d.downPayment} onChange={v => u("downPayment", v)} pre="" suf="%" /><Input sm label={t?.inRate || "Rate"} value={d.loanRate} onChange={v => u("loanRate", v)} pre="" suf="%" /></div>
    <Input label={t?.inTerm || "Term"} value={d.loanTerm} onChange={v => u("loanTerm", v)} pre="" suf="years" />
  </div></Sec>
  <Sec title={t?.secMonthlyExp || "Monthly Costs"} icon={Clock} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inInsurance || "Insurance"} value={d.monthlyInsurance} onChange={v => u("monthlyInsurance", v)} suf="/mo" /><Input sm label={t?.inTaxes || "Taxes"} value={d.monthlyTaxes} onChange={v => u("monthlyTaxes", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inMaintenance || "Maintenance"} value={d.monthlyMaintenance} onChange={v => u("monthlyMaintenance", v)} suf="/mo" /><Input sm label={t?.inUtilities || "Utilities"} value={d.monthlyUtilities} onChange={v => u("monthlyUtilities", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inPM || "PM"} value={d.monthlyPMPercent} onChange={v => u("monthlyPMPercent", v)} pre="" suf="%" /><Input sm label={t?.inAdmin || "Admin"} value={d.monthlyAdmin} onChange={v => u("monthlyAdmin", v)} suf="/mo" /></div>
    <Input label={t?.inCapEx || "CapEx Reserve"} value={d.monthlyCapEx} onChange={v => u("monthlyCapEx", v)} suf="/mo" />
  </div></Sec>
</div>);

const StorageInputs = ({ d, u, t }) => (<div className="space-y-4">
  <Sec title={t?.secFacility || "Facility"} icon={Building2}><div className="space-y-3">
    <Input label={t?.inDealName || "Deal Name (optional)"} value={d.name || ""} onChange={v => u("name", v)} pre="" text />
    <Input label={t?.inPurchasePrice || "Purchase Price"} value={d.purchasePrice} onChange={v => u("purchasePrice", v)} />
    <div className="flex gap-3"><Input sm label={t?.inTotalUnits || "Total Units"} value={d.totalUnits} onChange={v => u("totalUnits", v)} pre="" /><Input sm label={t?.inOccupied || "Occupied"} value={d.occupiedUnits} onChange={v => u("occupiedUnits", v)} pre="" /></div>
    <div className="flex gap-3"><Input sm label={t?.inAvgRent || "Avg Rent/Unit"} value={d.avgRentPerUnit} onChange={v => u("avgRentPerUnit", v)} suf="/mo" /><Input sm label={t?.inMarketRate || "Market Rate"} value={d.marketRatePerUnit} onChange={v => u("marketRatePerUnit", v)} suf="/mo" /></div>
    <Input label={t?.inClosing || "Closing"} value={d.closingBuy} onChange={v => u("closingBuy", v)} pre="" suf="%" />
  </div></Sec>
  <Sec title={t?.secFinancing || "Financing"} icon={DollarSign} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inDownPayment || "Down Payment"} value={d.downPayment} onChange={v => u("downPayment", v)} pre="" suf="%" /><Input sm label={t?.inRate || "Rate"} value={d.loanRate} onChange={v => u("loanRate", v)} pre="" suf="%" /></div>
    <Input label={t?.inTerm || "Term"} value={d.loanTerm} onChange={v => u("loanTerm", v)} pre="" suf="years" />
  </div></Sec>
  <Sec title={t?.secMonthlyExp || "Monthly Costs"} icon={Clock} col><div className="space-y-3">
    <div className="flex gap-3"><Input sm label={t?.inInsurance || "Insurance"} value={d.monthlyInsurance} onChange={v => u("monthlyInsurance", v)} suf="/mo" /><Input sm label={t?.inTaxes || "Taxes"} value={d.monthlyTaxes} onChange={v => u("monthlyTaxes", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inMaintenance || "Maintenance"} value={d.monthlyMaintenance} onChange={v => u("monthlyMaintenance", v)} suf="/mo" /><Input sm label={t?.inUtilities || "Utilities"} value={d.monthlyUtilities} onChange={v => u("monthlyUtilities", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inMarketing || "Marketing"} value={d.monthlyMarketing} onChange={v => u("monthlyMarketing", v)} suf="/mo" /><Input sm label={t?.inAdmin || "Admin"} value={d.monthlyAdmin} onChange={v => u("monthlyAdmin", v)} suf="/mo" /></div>
    <div className="flex gap-3"><Input sm label={t?.inPM || "PM"} value={d.monthlyPMPercent} onChange={v => u("monthlyPMPercent", v)} pre="" suf="%" /><Input sm label={t?.inCapEx || "CapEx"} value={d.monthlyCapEx} onChange={v => u("monthlyCapEx", v)} suf="/mo" /></div>
  </div></Sec>
</div>);

const INPUTS = { flip: FlipInputs, brrrr: BrrrrInputs, rental: RentalInputs, str: STRInputs, wholesale: WholesaleInputs, multi: MultiInputs, mhp: MHPInputs, storage: StorageInputs };

// ═══════════════════════════════════════════════════════════════
// DEAL KILLER DETECTOR
// ═══════════════════════════════════════════════════════════════
const DEAL_KILLERS = {
  flip: (c, d) => {
    const flags = [];
    if (c.roi < 10) flags.push({ level: "red", msg: `ROI is only ${c.roi?.toFixed(1)}%. Most lenders want 15%+ on a flip. Cut rehab by ${fmt(Math.abs((c.allIn * 0.15 - c.profit)))} or push ARV.` });
    if (c.totHold > c.profit * 0.4) flags.push({ level: "red", msg: `Holding costs (${fmt(c.totHold)}) are eating ${((c.totHold / (c.profit + c.totHold)) * 100).toFixed(0)}% of your gross. Either reduce hold time or renegotiate the purchase price.` });
    if (c.margin < 10) flags.push({ level: "red", msg: `Profit margin is under 10%. One surprise rehab line-item wipes this deal out.` });
    if (d.holdPeriod > 9) flags.push({ level: "yellow", msg: `Hold period of ${d.holdPeriod} months is long. Carrying costs compound fast — model a 12-month scenario.` });
    if (c.profit > 0 && c.roi >= 15 && c.margin >= 15) flags.push({ level: "green", msg: `Clean flip. Margins hold even if rehab runs 10% over or hold extends a month.` });
    return flags;
  },
  brrrr: (c, d) => {
    const flags = [];
    if (c.moCF < 0) flags.push({ level: "red", msg: `Negative cash flow of ${fmt(c.moCF)}/mo after refi. Your tenant is not covering the mortgage. Fix the rent, the refi terms, or walk.` });
    if (c.cashLeft > c.totalBefore * 0.6) flags.push({ level: "red", msg: `You're leaving ${fmt(c.cashLeft)} in the deal — ${((c.cashLeft / c.totalBefore) * 100).toFixed(0)}% of your original investment. This defeats the BRRRR strategy. Push the refi LTV or find a better lender.` });
    if (d.refiLTV > 80) flags.push({ level: "yellow", msg: `80%+ LTV refi is aggressive. Most lenders cap at 75% on non-owner occupied. Model 70% to see the real downside.` });
    if (c.coC < 6 && !c.infinite) flags.push({ level: "yellow", msg: `Cash-on-cash of ${c.coC?.toFixed(1)}% is below the 8% threshold most operators target. Compare against a straight rental before committing.` });
    if (c.infinite || (c.cashLeft <= 0 && c.moCF > 0)) flags.push({ level: "green", msg: `All cash recovered at refi with positive cash flow. Textbook BRRRR execution.` });
    return flags;
  },
  rental: (c, d) => {
    const flags = [];
    if (c.dscr < 1.0) flags.push({ level: "red", msg: `DSCR of ${c.dscr?.toFixed(2)} means your rental income doesn't cover the mortgage. No conventional lender will touch this. You need more rent or a lower purchase price.` });
    if (c.moCF < 100) flags.push({ level: "red", msg: `Cash flow of ${fmt(c.moCF)}/mo leaves zero buffer. One vacancy month and you're out of pocket. Target $200+ minimum.` });
    if (c.capRate < 4) flags.push({ level: "red", msg: `Cap rate of ${fp(c.capRate)} is below 4%. You're paying appreciation-market prices in a cash flow calculator. Either you're buying for equity growth (own that) or this is mispriced.` });
    if (c.coC < 6) flags.push({ level: "yellow", msg: `Cash-on-cash of ${fp(c.coC)} is below most operators' 8% threshold. Check if a higher down payment or lower price changes the picture.` });
    if (c.dscr >= 1.25 && c.moCF >= 200 && c.coC >= 8) flags.push({ level: "green", msg: `Strong lender profile. DSCR above 1.25, solid cash flow, and CoC above 8%. This deal gets financed.` });
    return flags;
  },
  str: (c, d) => {
    const flags = [];
    if (c.breakEvenOcc > 70) flags.push({ level: "red", msg: `You need ${c.breakEvenOcc?.toFixed(0)}% occupancy just to break even. That leaves almost no margin for slow season or platform algorithm changes.` });
    if (c.moCF < 0) flags.push({ level: "red", msg: `Negative cash flow at current occupancy assumptions. STR income is not guaranteed — a single bad review month could deepen this.` });
    if (d.occupancyRate > 85) flags.push({ level: "yellow", msg: `85%+ occupancy is aggressive for most STR markets. Use AirDNA comps for your specific zip before relying on this number.` });
    if (c.breakEvenOcc < 45 && c.moCF > 300) flags.push({ level: "green", msg: `Low break-even occupancy with strong projected cash flow. This deal has real downside protection.` });
    return flags;
  },
  wholesale: (c, d) => {
    const flags = [];
    if (c.spread < 0) flags.push({ level: "red", msg: `Negative spread — you're paying more than the 70% ARV rule allows. Your end buyer has no margin. This deal won't assign.` });
    if (c.profit < 5000) flags.push({ level: "yellow", msg: `Assignment fee under $5k. After your time and marketing cost, this barely makes sense. Push the fee or find a better deal.` });
    if (d.holdingDays > 45) flags.push({ level: "yellow", msg: `45+ days to close increases the chance the deal falls apart or the seller gets cold feet. Tighten your buyer pipeline.` });
    if (c.profit >= 10000 && c.spread > 15000) flags.push({ level: "green", msg: `Strong spread with a real fee. Your end buyer has room to make money — this one should move fast.` });
    return flags;
  },
  multi: (c, d) => {
    const flags = [];
    if (c.dscr < 1.25) flags.push({ level: "red", msg: `DSCR of ${c.dscr?.toFixed(2)} is below the 1.25x minimum most commercial lenders require. This deal won't get financed as-is.` });
    if (c.expenseRatio > 60) flags.push({ level: "red", msg: `Expense ratio of ${c.expenseRatio?.toFixed(0)}% is dangerously high. Industry standard for multifamily is 45-55%. Check your PM fee and maintenance estimates.` });
    if (c.entryCapRate < 5) flags.push({ level: "yellow", msg: `Entry cap rate under 5% means you're buying on appreciation hopes, not cash flow. Know which game you're playing.` });
    if (c.dscr >= 1.3 && c.coC >= 8 && c.expenseRatio < 55) flags.push({ level: "green", msg: `Lender-ready profile. Strong DSCR, healthy expense ratio, and solid CoC. This underwrites well.` });
    return flags;
  },
  mhp: (c, d) => {
    const flags = [];
    if (c.dscr < 1.2) flags.push({ level: "red", msg: `MHP DSCR of ${c.dscr?.toFixed(2)} is tight. Community banks and credit unions (your likely lenders here) want 1.2x minimum.` });
    if (c.capRate < 7) flags.push({ level: "yellow", msg: `Cap rate under 7% on a mobile home park means you're paying up. MHP deals typically trade at 8-12%. Check your purchase price.` });
    if (c.effVac > 25) flags.push({ level: "red", msg: `Over 25% vacancy is a management problem, not just a value-add opportunity. Understand why lots are empty before closing.` });
    if (c.capRate >= 8 && c.dscr >= 1.25 && c.upside > 0) flags.push({ level: "green", msg: `Solid cap rate with real value-add upside. MHP operators love this profile.` });
    return flags;
  },
  storage: (c, d) => {
    const flags = [];
    if (c.dscr < 1.25) flags.push({ level: "red", msg: `DSCR of ${c.dscr?.toFixed(2)} won't satisfy most commercial lenders on a storage deal. Target 1.25x minimum.` });
    if (c.capRate < 6) flags.push({ level: "yellow", msg: `Self-storage typically trades at 6-9% cap rates. Under 6% means you're paying for upside that may not materialize.` });
    const occRate = c.occRate || 0;
    if (occRate < 70) flags.push({ level: "yellow", msg: `Below 70% occupancy is below stabilized. Budget 12-18 months to reach 85%+ before your numbers look like this projection.` });
    if (c.capRate >= 7 && c.dscr >= 1.3) flags.push({ level: "green", msg: `Clean storage deal. Stabilized cap rate and strong debt coverage.` });
    return flags;
  },
};

const TemplateSelector = ({ dealType, onLoad }) => {
  const templates = TEMPLATES[dealType] || [];
  if (!templates.length) return null;
  return (
    <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: B.gold, background: B.goldL }}>
      <div className="px-4 py-2 flex items-center gap-2" style={{ background: B.goldL, borderBottom: `1px solid ${B.gold}` }}>
        <Zap size={14} style={{ color: B.goldD }} />
        <span className="text-xs font-semibold" style={{ color: B.goldD }}>Quick Templates</span>
      </div>
      <div className="p-3 flex flex-wrap gap-2">
        {templates.map((tmpl, i) => (
          <button key={i} onClick={() => onLoad(tmpl.data)} className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-80" style={{ background: "#fff", borderColor: B.gold, color: B.goldD }}>
            {tmpl.name}
          </button>
        ))}
        <button onClick={() => onLoad({ ...DEFAULTS[dealType] })} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80" style={{ background: "transparent", color: B.mut }}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
};
const DealKillerDetector = ({ dealType, calc, dealData, t }) => {
  const killerFn = DEAL_KILLERS[dealType];
  if (!killerFn || !calc) return null;
  const flags = killerFn(calc, dealData);
  if (!flags.length) return null;
  const reds = flags.filter(f => f.level === "red");
  const yellows = flags.filter(f => f.level === "yellow");
  const greens = flags.filter(f => f.level === "green");
  return (
    <div className="space-y-2">
      {reds.map((f, i) => (
        <div key={i} className="rounded-xl p-4 flex gap-3" style={{ background: "#FFF1F1", border: `1.5px solid ${B.red}` }}>
          <AlertTriangle size={18} style={{ color: B.red, flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-xs font-bold mb-0.5" style={{ color: B.red }}>DEAL KILLER</p>
            <p className="text-xs" style={{ color: "#7F1D1D" }}>{f.msg}</p>
          </div>
        </div>
      ))}
      {yellows.map((f, i) => (
        <div key={i} className="rounded-xl p-4 flex gap-3" style={{ background: "#FFFBEB", border: `1.5px solid ${B.gold}` }}>
          <AlertTriangle size={18} style={{ color: B.gold, flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-xs font-bold mb-0.5" style={{ color: B.goldD }}>WATCH OUT</p>
            <p className="text-xs" style={{ color: "#78350F" }}>{f.msg}</p>
          </div>
        </div>
      ))}
      {greens.map((f, i) => (
        <div key={i} className="rounded-xl p-4 flex gap-3" style={{ background: B.grnL, border: `1.5px solid ${B.grn}` }}>
          <Check size={18} style={{ color: B.grn, flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-xs font-bold mb-0.5" style={{ color: B.grn }}>DEAL CHECKS OUT</p>
            <p className="text-xs" style={{ color: "#14532D" }}>{f.msg}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DEAL RESULTS
// ═══════════════════════════════════════════════════════════════
const FlipResults = ({ c, t }) => (<div className="space-y-4">
  <RealityCheck naive={c.naive} real={c.profit} t={t} />
  <DealScore score={c.score} t={t} />
  <DealKillerDetector dealType="flip" calc={c} dealData={c._inputs || c} t={t} />
  <div className="grid grid-cols-2 gap-3">
    <Stat icon={DollarSign} label={t?.outTrueNetProfit || "TRUE NET PROFIT"} value={fmt(c.profit)} color={c.profit >= 0 ? B.grn : B.red} bg={c.profit >= 0 ? B.grnL : B.redL} sub={`${fmt(c.profitPerMonth)}/month held`} />
    <Stat icon={TrendingUp} label={t?.outROI || "ROI"} value={fp(c.roi)} color={c.roi >= 0 ? B.pri : B.red} sub={`${fp(c.annRoi)} annualized`} />
    <Stat icon={Clock} label={t?.outHoldingCosts || "HOLDING COSTS"} value={fmt(c.totHold)} color={B.gold} sub={`${fmt(c.moHold)}/mo x hold`} />
    <Stat icon={Percent} label={t?.outProfitMargin || "PROFIT MARGIN"} value={fp(c.margin)} sub={`On ${fmt(c.allIn)} all-in`} />
  </div>
  <Sec title={t?.secCostBreakdown || "Cost Breakdown"} icon={BarChart3}><CostPie data={c.costs} /></Sec>
  <Sec title={t?.secHoldingCostDetail || "Holding Cost Detail"} icon={Clock} col><CostPie data={c.holding} height={180} /></Sec>
</div>);

const BrrrrResults = ({ c, t }) => (<div className="space-y-4">
  <RealityCheck naive={c.naive} real={c.moCF} label1={t?.naiveMonthCF || "Naive monthly CF"} label2={t?.trueCFMo || "True CF/mo"} t={t} />
  <DealScore score={c.score} t={t} />
  <DealKillerDetector dealType="brrrr" calc={c} dealData={c._inputs || c} t={t} />
  <div className="grid grid-cols-2 gap-3">
    <Stat icon={DollarSign} label={t?.outCashLeftInDeal || "CASH LEFT IN DEAL"} value={c.cashLeft <= 0 ? "$0 (ALL OUT!)" : fmt(c.cashLeft)} color={c.cashLeft <= 0 ? B.grn : B.gold} bg={c.cashLeft <= 0 ? B.grnL : B.goldL} sub={c.infinite ? "INFINITE ROI" : `Invested ${fmt(c.totalBefore)}`} />
    <Stat icon={TrendingUp} label={t?.outMonthlyCF || "MONTHLY CASH FLOW"} value={fmt(c.moCF)} color={c.moCF >= 0 ? B.grn : B.red} bg={c.moCF >= 0 ? B.grnL : B.redL} sub={`${fmt(c.annCF)}/year`} />
    <Stat icon={Percent} label={t?.outCashOnCash || "CASH-ON-CASH"} value={c.infinite ? "Infinite" : fp(c.coC)} color={B.pri} sub={c.infinite ? "All cash recovered" : "On cash left"} />
    <Stat icon={PiggyBank} label={t?.outCashBackAtRefi || "CASH BACK AT REFI"} value={fmt(c.cashBack)} color={c.cashBack > 0 ? B.grn : B.red} sub={`Refi: ${fmt(c.refiAmount)}`} />
  </div>
  <Sec title={t?.secMonthlyExpAfterRefi || "Monthly Expenses (After Refi)"} icon={BarChart3}><CostPie data={c.expenses} /></Sec>
</div>);

const RentalResults = ({ c, t }) => (<div className="space-y-4">
  <RealityCheck naive={c.naive} real={c.moCF} label1={t?.naiveMonthCF || "Naive monthly CF"} label2={t?.trueMonthCF || "True monthly CF"} t={t} />
  <DealScore score={c.score} t={t} />
  <DealKillerDetector dealType="rental" calc={c} dealData={c._inputs || c} t={t} />
  <div className="grid grid-cols-2 gap-3">
    <Stat icon={DollarSign} label={t?.outMonthlyCF || "MONTHLY CASH FLOW"} value={fmt(c.moCF)} color={c.moCF >= 0 ? B.grn : B.red} bg={c.moCF >= 0 ? B.grnL : B.redL} sub={`${fmt(c.annCF)}/year`} />
    <Stat icon={Percent} label={t?.outCashOnCash || "CASH-ON-CASH"} value={fp(c.coC)} color={c.coC >= 8 ? B.grn : B.gold} sub={`${fmt(c.cashIn)} invested`} />
    <Stat icon={TrendingUp} label={t?.outCapRate || "CAP RATE"} value={fp(c.capRate)} color={B.pri} sub={`NOI: ${fmt(c.noi)}/yr`} />
    <Stat icon={Shield} label={t?.outDSCR || "DSCR"} value={c.dscr.toFixed(2)} color={c.dscr >= 1.25 ? B.grn : c.dscr >= 1 ? B.gold : B.red} sub={c.dscr >= 1.25 ? "Lender-ready" : c.dscr >= 1 ? "Tight" : "Neg coverage"} />
  </div>
  <Sec title={t?.secMonthlyExp || "Monthly Expenses"} icon={BarChart3}><CostPie data={c.expenses} /></Sec>
  {c.proj && <Sec title={t?.sec5YearProj || "5-Year Projection"} icon={TrendingUp} col>
    <div style={{ height: 200 }}><ResponsiveContainer><BarChart data={c.proj} margin={{ left: 5, right: 5 }}>
      <XAxis dataKey="year" tick={{ fontSize: 11 }} /><YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 11 }} />
      <Tooltip formatter={v => fmt(v)} /><Legend />
      <Bar dataKey="equity" name={t?.equity || "Equity"} fill={B.pri} radius={[3, 3, 0, 0]} />
      <Bar dataKey="cashFlow" name={t?.cashFlow || "Cash Flow"} fill={B.gold} radius={[3, 3, 0, 0]} />
    </BarChart></ResponsiveContainer></div>
  </Sec>}
</div>);

const STRResults = ({ c, t }) => (<div className="space-y-4">
  <RealityCheck naive={c.naive} real={c.moCF} label1={t?.naiveMonthCF || "Naive monthly CF"} label2={t?.trueMonthCF || "True monthly CF"} t={t} />
  <DealScore score={c.score} t={t} />
  <DealKillerDetector dealType="str" calc={c} dealData={c._inputs || c} t={t} />
  <div className="grid grid-cols-2 gap-3">
    <Stat icon={DollarSign} label={t?.outMonthlyCF || "MONTHLY CASH FLOW"} value={fmt(c.moCF)} color={c.moCF >= 0 ? B.grn : B.red} bg={c.moCF >= 0 ? B.grnL : B.redL} sub={`${fmt(c.annCF)}/year`} />
    <Stat icon={Percent} label={t?.outCashOnCash || "CASH-ON-CASH"} value={fp(c.coC)} color={c.coC >= 10 ? B.grn : B.gold} sub={`${fmt(c.cashIn)} invested`} />
    <Stat icon={TrendingUp} label={t?.outRevPerNight || "REV/NIGHT"} value={fmt(c.revPerNight)} color={B.pri} sub={`${Math.round(c.nightsPerMonth)} nights/mo`} />
    <Stat icon={Target} label={t?.outBreakEvenOcc || "BREAK-EVEN OCC."} value={fp(c.breakEvenOcc)} color={c.breakEvenOcc < 50 ? B.grn : B.gold} sub={t?.minBreakEven || "Min to break even"} />
  </div>
  <Sec title={t?.secMonthlyExp || "Monthly Expenses"} icon={BarChart3}><CostPie data={c.expenses} /></Sec>
</div>);

const WholesaleResults = ({ c, t }) => (<div className="space-y-4">
  <DealScore score={c.score} t={t} />
  <DealKillerDetector dealType="wholesale" calc={c} dealData={c._inputs || c} t={t} />
  <div className="grid grid-cols-2 gap-3">
    <Stat icon={DollarSign} label={t?.outNetProfit || "NET PROFIT"} value={fmt(c.profit)} color={c.profit >= 0 ? B.grn : B.red} bg={c.profit >= 0 ? B.grnL : B.redL} sub={t?.afterAllCosts || "After all costs"} />
    <Stat icon={TrendingUp} label={t?.outROI || "ROI"} value={fp(c.roi)} color={B.pri} sub={`${fp(c.annRoi)} annualized`} />
    <Stat icon={Target} label={t?.outMaxOffer || "MAX OFFER (70% ARV)"} value={fmt(c.maxOffer)} color={B.pri} sub={t?.minusRepairs || "Minus repairs"} />
    <Stat icon={PiggyBank} label={t?.outSpread || "SPREAD"} value={fmt(c.spread)} color={c.spread > 0 ? B.grn : B.red} sub={t?.spreadMAOContract || "MAO - contract"} />
  </div>
  <Sec title={t?.secYourCosts || "Your Costs"} icon={BarChart3}><CostPie data={c.costs} /></Sec>
</div>);

const MultiResults = ({ c, t }) => (<div className="space-y-4">
  <RealityCheck naive={c.naive} real={c.moCF} label1={t?.naiveMonthCF || "Naive monthly CF"} label2={t?.trueMonthCF || "True monthly CF"} t={t} />
  <DealScore score={c.score} t={t} />
  <DealKillerDetector dealType="multi" calc={c} dealData={c._inputs || c} t={t} />
  <div className="grid grid-cols-2 gap-3">
    <Stat icon={DollarSign} label={t?.outAnnualCF || "ANNUAL CASH FLOW"} value={fmt(c.annCF)} color={c.annCF >= 0 ? B.grn : B.red} bg={c.annCF >= 0 ? B.grnL : B.redL} sub={`${fmt(c.moCF)}/month`} />
    <Stat icon={Percent} label={t?.outCashOnCash || "CASH-ON-CASH"} value={fp(c.coC)} color={c.coC >= 8 ? B.grn : B.gold} sub={`${fmt(c.cashIn)} invested`} />
    <Stat icon={TrendingUp} label={t?.outCapRate || "CAP RATE"} value={fp(c.entryCapRate)} color={B.pri} sub={`NOI: ${fmt(c.noi)}/yr`} />
    <Stat icon={Shield} label={t?.outDSCR || "DSCR"} value={c.dscr.toFixed(2)} color={c.dscr >= 1.25 ? B.grn : B.gold} />
    <Stat icon={Award} label={t?.outEquityMult || "EQUITY MULTIPLE"} value={`${c.equityMultiple.toFixed(2)}x`} color={c.equityMultiple >= 2 ? B.grn : B.gold} sub={`Over ${c.proj?.length || 5} years`} />
    <Stat icon={Hash} label={t?.outPricePerUnit || "PRICE/UNIT"} value={fmt(c.pricePerUnit)} sub={`Exp ratio: ${fp(c.expenseRatio)}`} />
  </div>
  <Sec title={t?.secAnnualExp || "Annual Expenses"} icon={BarChart3}><CostPie data={c.expenses} /></Sec>
  {c.proj && <Sec title={`${c.proj.length}-${t?.yearProj || "Year Projection"}`} icon={TrendingUp} col>
    <div style={{ height: 200 }}><ResponsiveContainer><BarChart data={c.proj} margin={{ left: 5, right: 5 }}>
      <XAxis dataKey="year" tick={{ fontSize: 11 }} /><YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 11 }} />
      <Tooltip formatter={v => fmt(v)} /><Legend />
      <Bar dataKey="noi" name={t?.NOI || "NOI"} fill={B.pri} radius={[3, 3, 0, 0]} />
      <Bar dataKey="cashFlow" name={t?.cashFlow || "Cash Flow"} fill={B.gold} radius={[3, 3, 0, 0]} />
    </BarChart></ResponsiveContainer></div>
    <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
      <div className="p-3 rounded-lg" style={{ background: B.grnL }}><span style={{ color: B.mut }}>{t?.exitValue || "Exit Value"}: </span><span className="font-bold" style={{ color: B.grn }}>{fmt(c.exitValue)}</span></div>
      <div className="p-3 rounded-lg" style={{ background: B.grnL }}><span style={{ color: B.mut }}>{t?.totalReturn || "Total Return"}: </span><span className="font-bold" style={{ color: B.grn }}>{fmt(c.totalReturn)}</span></div>
    </div>
  </Sec>}
</div>);

const MHPResults = ({ c, t }) => (<div className="space-y-4">
  <RealityCheck naive={c.naive} real={c.moCF} label1={t?.naiveMonthCF || "Naive monthly CF"} label2={t?.trueMonthCF || "True monthly CF"} t={t} />
  <DealScore score={c.score} t={t} />
  <DealKillerDetector dealType="mhp" calc={c} dealData={c._inputs || c} t={t} />
  <div className="grid grid-cols-2 gap-3">
    <Stat icon={DollarSign} label={t?.outAnnualCF || "ANNUAL CASH FLOW"} value={fmt(c.annCF)} color={c.annCF >= 0 ? B.grn : B.red} bg={c.annCF >= 0 ? B.grnL : B.redL} sub={`${fmt(c.moCF)}/month`} />
    <Stat icon={Percent} label={t?.outCapRate || "CAP RATE"} value={fp(c.capRate)} color={c.capRate >= 8 ? B.grn : B.gold} sub={`NOI: ${fmt(c.noi)}/yr`} />
    <Stat icon={TrendingUp} label={t?.outCashOnCash || "CASH-ON-CASH"} value={fp(c.coC)} sub={`${fmt(c.cashIn)} invested`} />
    <Stat icon={Hash} label={t?.outPricePerLot || "PRICE/LOT"} value={fmt(c.pricePerLot)} sub={`${c.emptyLots} empty lots`} />
  </div>
  <Sec title={t?.secValueAddUpside || "Value-Add Upside"} icon={Zap}>
    <div className="space-y-2 text-xs">
      <div className="flex justify-between p-2 rounded" style={{ background: B.grnL }}><span>{t?.rentRaiseMarket || "Rent Raise to Market"}</span><span className="font-bold" style={{ color: B.grn }}>+{fmt(c.raisedNOI)}/yr</span></div>
      <div className="flex justify-between p-2 rounded" style={{ background: B.blueL }}><span>{t?.infillLots || `Infill ${c.emptyLots} Lots`} ({fmt(c.infillTotal)} cost)</span><span className="font-bold" style={{ color: B.blue }}>+{fmt(c.infillNOI)}/yr ({fp(c.infillROI)} ROI)</span></div>
      <div className="flex justify-between p-2 rounded font-bold" style={{ background: B.goldL }}><span>{t?.totalUpside || "Total Upside"}</span><span style={{ color: B.goldD }}>+{fmt(c.upside)}/yr</span></div>
    </div>
  </Sec>
  <Sec title={t?.secAnnualExp || "Annual Expenses"} icon={BarChart3}><CostPie data={c.expenses} /></Sec>
</div>);

const StorageResults = ({ c, t }) => (<div className="space-y-4">
  <RealityCheck naive={c.naive} real={c.moCF} label1={t?.naiveMonthCF || "Naive monthly CF"} label2={t?.trueMonthCF || "True monthly CF"} t={t} />
  <DealScore score={c.score} t={t} />
  <DealKillerDetector dealType="storage" calc={c} dealData={c._inputs || c} t={t} />
  <div className="grid grid-cols-2 gap-3">
    <Stat icon={DollarSign} label={t?.outAnnualCF || "ANNUAL CASH FLOW"} value={fmt(c.annCF)} color={c.annCF >= 0 ? B.grn : B.red} bg={c.annCF >= 0 ? B.grnL : B.redL} sub={`${fmt(c.moCF)}/month`} />
    <Stat icon={Percent} label={t?.outCapRate || "CAP RATE"} value={fp(c.capRate)} color={c.capRate >= 8 ? B.grn : B.gold} />
    <Stat icon={TrendingUp} label={t?.outCashOnCash || "CASH-ON-CASH"} value={fp(c.coC)} sub={`${fmt(c.cashIn)} invested`} />
    <Stat icon={Hash} label={t?.outOccupancy || "OCCUPANCY"} value={fp(c.occRate)} sub={`${c.emptyUnits} empty`} />
  </div>
  <Sec title={t?.secRevenueUpside || "Revenue Upside"} icon={Zap}>
    <div className="space-y-2 text-xs">
      <div className="flex justify-between p-2 rounded" style={{ background: B.grnL }}><span>{t?.rateIncreaseMarket || "Rate Increase to Market"}</span><span className="font-bold" style={{ color: B.grn }}>+{fmt(c.rateUpside)}/yr</span></div>
      <div className="flex justify-between p-2 rounded" style={{ background: B.blueL }}><span>{t?.fillEmptyUnits || `Fill ${c.emptyUnits} Empty Units`}</span><span className="font-bold" style={{ color: B.blue }}>+{fmt(c.occUpside)}/yr</span></div>
    </div>
  </Sec>
  <Sec title={t?.secAnnualExp || "Annual Expenses"} icon={BarChart3}><CostPie data={c.expenses} /></Sec>
</div>);

const RESULTS = { flip: FlipResults, brrrr: BrrrrResults, rental: RentalResults, str: STRResults, wholesale: WholesaleResults, multi: MultiResults, mhp: MHPResults, storage: StorageResults };

// ═══════════════════════════════════════════════════════════════
// PAGE: PORTFOLIO
// ═══════════════════════════════════════════════════════════════
const Portfolio = ({ deals, removeDeal, editDeal, exportPDF, t, getGradeL, localDealTypes }) => {
  if (!deals.length) return (<div className="text-center py-16"><Briefcase size={48} style={{ color: B.brd, margin: "0 auto 12px" }} /><h3 className="text-lg font-bold mb-2" style={{ color: B.txt }}>{t.noDealsTitle}</h3><p className="text-sm" style={{ color: B.mut }}>{t.noDealsDesc}</p></div>);
  const totalInvested = deals.reduce((s, d) => s + (d.calc.cashIn || d.calc.cash || d.calc.totalCost || 0), 0);
  const totalCF = deals.reduce((s, d) => s + (d.calc.annCF || d.calc.profit || 0), 0);
  const avgScore = deals.reduce((s, d) => s + d.calc.score, 0) / deals.length;
  const byType = {}; deals.forEach(d => { byType[d.type] = (byType[d.type] || 0) + 1; });
  const typeData = Object.entries(byType).map(([k, v]) => ({ name: localDealTypes.find(dt => dt.id === k)?.label || k, value: v }));
  return (<div className="space-y-6">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat icon={Briefcase} label={t.totalDeals} value={deals.length} />
      <Stat icon={DollarSign} label={t.totalInvested} value={fmt(totalInvested)} />
      <Stat icon={TrendingUp} label={t.annualCF} value={fmt(totalCF)} color={totalCF >= 0 ? B.grn : B.red} />
      <Stat icon={Award} label={t.avgScore} value={Math.round(avgScore)} color={getGradeL(avgScore).color} />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Sec title={t.dealsByType} icon={BarChart3}><CostPie data={typeData} height={180} /></Sec>
      <Sec title={t.dealScores} icon={Award}><div style={{ height: 180 }}><ResponsiveContainer><BarChart data={deals.map(d => ({ name: d.data.name || `${d.type}`, score: Math.round(d.calc.score) }))} margin={{ left: 5, right: 5 }}><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="score" fill={B.pri} radius={[3, 3, 0, 0]}>{deals.map((d, i) => <Cell key={i} fill={getGradeL(d.calc.score).color} />)}</Bar></BarChart></ResponsiveContainer></div></Sec>
    </div>
    <Sec title={t.allDeals} icon={FileText}><div className="space-y-2">{deals.map((d) => { const g = getGradeL(d.calc.score); const type = localDealTypes.find(dt => dt.id === d.type); return (<div key={d.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: B.brd }}><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black" style={{ background: g.bg, color: g.color }}>{g.grade}</div><div><div className="text-sm font-medium" style={{ color: B.txt }}>{d.data.name || `${type?.label} Deal`}</div><div className="text-xs" style={{ color: B.mut }}>{type?.label} | {d.calc.moCF != null ? `${fmt(d.calc.moCF)}/mo` : d.calc.profit != null ? fmt(d.calc.profit) : ""}</div></div></div><div className="flex items-center gap-1"><button onClick={() => exportPDF(d)} title={t.exportPdf} className="p-1.5 rounded hover:opacity-70" style={{ color: B.gold }}><Download size={14} /></button><button onClick={() => editDeal(d)} title="Edit Deal" className="p-1.5 rounded hover:opacity-70" style={{ color: B.acc }}><Settings size={14} /></button><button onClick={() => removeDeal(d.id)} className="p-1.5 rounded hover:bg-red-50"><Trash2 size={14} style={{ color: B.red }} /></button></div></div>); })}</div></Sec>
      </div>);
};

// ═══════════════════════════════════════════════════════════════
// PAGE: COMPARE
// ═══════════════════════════════════════════════════════════════
const Compare = ({ deals, t, localDealTypes }) => {
  const [sel, setSel] = useState([0, 1]);
  if (deals.length < 2) return (<div className="text-center py-16"><GitCompare size={48} style={{ color: B.brd, margin: "0 auto 12px" }} /><h3 className="text-lg font-bold mb-2">{t.needTwo}</h3><p className="text-sm" style={{ color: B.mut }}>{t.needTwoDesc}</p></div>);
  const d1 = deals[sel[0]] || deals[0], d2 = deals[sel[1]] || deals[1];
  const metrics = [
    { label: t.dealScore, v1: Math.round(d1.calc.score), v2: Math.round(d2.calc.score), f: v => `${v}/100`, better: "higher" },
    { label: t.monthlyCF, v1: d1.calc.moCF || d1.calc.profitPerMonth || 0, v2: d2.calc.moCF || d2.calc.profitPerMonth || 0, f: v => fmt(v), better: "higher" },
    { label: t.cashInvested, v1: d1.calc.cashIn || d1.calc.cash || 0, v2: d2.calc.cashIn || d2.calc.cash || 0, f: v => fmt(v), better: "lower" },
    { label: t.roiCoC, v1: d1.calc.coC || d1.calc.roi || 0, v2: d2.calc.coC || d2.calc.roi || 0, f: v => fp(v), better: "higher" },
  ];
  return (<div className="space-y-6">
    <div className="flex gap-4">{[0, 1].map(idx => (<div key={idx} className="flex-1"><label className="text-xs font-medium mb-1 block" style={{ color: B.mut }}>{t.deal} {idx + 1}</label><select value={sel[idx]} onChange={e => { const n = [...sel]; n[idx] = Number(e.target.value); setSel(n); }} className="w-full p-2 rounded-lg border text-sm" style={{ borderColor: B.brd }}>{deals.map((d, i) => <option key={d.id} value={i}>{d.data.name || `${localDealTypes.find(dt => dt.id === d.type)?.label} Deal`}</option>)}</select></div>))}</div>
    <div className="space-y-2">{metrics.map(m => { const w = m.better === "higher" ? (m.v1 > m.v2 ? 1 : m.v2 > m.v1 ? 2 : 0) : (m.v1 < m.v2 ? 1 : m.v2 < m.v1 ? 2 : 0); return (<div key={m.label} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: B.brd }}><div className="w-32 text-xs font-medium" style={{ color: B.mut }}>{m.label}</div><div className={`flex-1 text-center text-sm font-bold ${w === 1 ? "rounded-lg py-1" : ""}`} style={{ color: w === 1 ? B.grn : B.txt, background: w === 1 ? B.grnL : "transparent" }}>{m.f(m.v1)} {w === 1 && "✓"}</div><div className="text-xs" style={{ color: B.mut }}>vs</div><div className={`flex-1 text-center text-sm font-bold ${w === 2 ? "rounded-lg py-1" : ""}`} style={{ color: w === 2 ? B.grn : B.txt, background: w === 2 ? B.grnL : "transparent" }}>{m.f(m.v2)} {w === 2 && "✓"}</div></div>); })}</div>
  </div>);
};

// ═══════════════════════════════════════════════════════════════
// PAGE: SPLITS (UPGRADED - multi-partner, saved deal linking, pie chart)
// ═══════════════════════════════════════════════════════════════
const SPLIT_COLORS = [B.pri, B.gold, B.blue, B.purple, B.grn];
const SPLIT_BGS = [B.grnL, B.goldL, B.blueL, "#EDE9FE", B.grnL];

const Splits = ({ t, portfolio = [], localDealTypes = [] }) => {
  const [linkedDeal, setLinkedDeal] = useState("");
  const [partners, setPartners] = useState([
    { name: "You", cashPct: 70, workPct: 80 },
    { name: "Partner", cashPct: 30, workPct: 20 },
  ]);
  const [totalProfit, setTotalProfit] = useState(100000);
  const [cashWeight, setCashWeight] = useState(50);
  const [splitType, setSplitType] = useState("weighted");

  // Link to saved deal: auto-populate profit
  const linkDeal = (dealId) => {
    setLinkedDeal(dealId);
    if (dealId) {
      const deal = portfolio.find(d => d.id === dealId);
      if (deal?.calc) {
        const p = deal.calc.profit || deal.calc.annCF || (deal.calc.moCF || 0) * 12;
        setTotalProfit(Math.round(p));
      }
    }
  };

  const addPartner = () => {
    if (partners.length >= 5) return;
    setPartners([...partners, { name: `Partner ${partners.length}`, cashPct: 0, workPct: 0 }]);
  };
  const removePartner = (i) => {
    if (partners.length <= 2) return;
    setPartners(partners.filter((_, idx) => idx !== i));
  };
  const updatePartner = (i, key, val) => {
    const next = [...partners];
    next[i] = { ...next[i], [key]: val };
    setPartners(next);
  };

  // Calculate splits
  const workWeight = 100 - cashWeight;
  const results = partners.map(p => {
    if (splitType === "equal") return { ...p, share: 100 / partners.length };
    if (splitType === "capital") return { ...p, share: p.cashPct };
    // weighted (default)
    return { ...p, score: (p.cashPct * cashWeight / 100) + (p.workPct * workWeight / 100) };
  });

  if (splitType === "weighted") {
    const totalScore = results.reduce((s, r) => s + (r.score || 0), 0);
    results.forEach(r => { r.share = totalScore > 0 ? ((r.score || 0) / totalScore) * 100 : 100 / partners.length; });
  }

  results.forEach(r => { r.amount = totalProfit * (r.share / 100); });
  const totalCash = partners.reduce((s, p) => s + p.cashPct, 0);
  const totalWork = partners.reduce((s, p) => s + p.workPct, 0);
  const pieData = results.map((r, i) => ({ name: r.name, value: Math.round(r.share * 100) / 100 }));

  return (
    <div className="space-y-6">
      {/* Deal linking */}
      {portfolio.length > 0 && (
        <div className="rounded-xl p-4 flex items-center gap-3 flex-wrap" style={{ background: B.blueL, border: `1px solid ${B.blue}30` }}>
          <FileText size={16} style={{ color: B.blue, flexShrink: 0 }} />
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium block mb-1" style={{ color: B.blue }}>Link to a saved deal (auto-fill profit)</label>
            <select value={linkedDeal} onChange={e => linkDeal(e.target.value)} className="w-full p-2 rounded-lg border text-sm" style={{ borderColor: B.brd }}>
              <option value="">Manual entry</option>
              {portfolio.map(d => <option key={d.id} value={d.id}>{d.data.name || localDealTypes.find(dt => dt.id === d.type)?.label || "Deal"} - {fmt(d.calc?.profit || d.calc?.annCF || 0)}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Deal details */}
      <Sec title={t.dealDetails} icon={Users}>
        <div className="space-y-3">
          <Input label={t.totalProfit} value={totalProfit} onChange={v => setTotalProfit(v)} />
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: B.mut }}>Split Method</label>
            <div className="flex gap-2">
              {[["weighted", "Weighted"], ["equal", "Equal"], ["capital", "Capital Only"]].map(([k, l]) => (
                <button key={k} onClick={() => setSplitType(k)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all" style={{ background: splitType === k ? B.pri : "transparent", color: splitType === k ? "#fff" : B.mut, border: `1px solid ${splitType === k ? B.pri : B.brd}` }}>{l}</button>
              ))}
            </div>
          </div>
        </div>
      </Sec>

      {/* Partners */}
      <Sec title="Partners" icon={Users}>
        <div className="space-y-4">
          {partners.map((p, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ borderColor: SPLIT_COLORS[i % 5] + "40", background: SPLIT_BGS[i % 5] + "60" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: SPLIT_COLORS[i % 5] }} />
                  <input type="text" value={p.name} onChange={e => updatePartner(i, "name", e.target.value)} className="bg-transparent text-sm font-bold outline-none border-b border-transparent focus:border-current" style={{ color: SPLIT_COLORS[i % 5], maxWidth: 140 }} />
                </div>
                {partners.length > 2 && <button onClick={() => removePartner(i)} className="text-xs px-2 py-1 rounded hover:opacity-70" style={{ color: B.red }}><Trash2 size={14} /></button>}
              </div>
              {splitType !== "equal" && (
                <div className="flex gap-3">
                  <div className="flex-1"><label className="text-[10px] font-medium block mb-1" style={{ color: B.mut }}>Capital %</label><input type="number" value={p.cashPct} onChange={e => updatePartner(i, "cashPct", Number(e.target.value))} className="w-full p-2 rounded-lg border text-sm text-center" style={{ borderColor: B.brd }} /></div>
                  {splitType === "weighted" && <div className="flex-1"><label className="text-[10px] font-medium block mb-1" style={{ color: B.mut }}>Work/Sweat Equity %</label><input type="number" value={p.workPct} onChange={e => updatePartner(i, "workPct", Number(e.target.value))} className="w-full p-2 rounded-lg border text-sm text-center" style={{ borderColor: B.brd }} /></div>}
                </div>
              )}
            </div>
          ))}
          {partners.length < 5 && (
            <button onClick={addPartner} className="w-full py-2.5 rounded-xl text-xs font-medium border-2 border-dashed flex items-center justify-center gap-1 transition-all hover:opacity-70" style={{ borderColor: B.brd, color: B.mut }}>
              <Plus size={14} /> Add Partner (up to 5)
            </button>
          )}
        </div>
      </Sec>

      {/* Weighting slider (only for weighted mode) */}
      {splitType === "weighted" && (
        <Sec title={t.weighting} icon={Target}>
          <Input label={t.cashWeight} value={cashWeight} onChange={v => setCashWeight(v)} pre="" suf="%" tip="Higher = capital contribution matters more than work" />
          <div className="flex justify-between mt-2">
            <span className="text-[10px] font-medium" style={{ color: B.mut }}>Work weight: {workWeight}%</span>
            <span className="text-[10px] font-medium" style={{ color: B.mut }}>Cash weight: {cashWeight}%</span>
          </div>
          <div className="w-full h-2 rounded-full mt-1 overflow-hidden" style={{ background: B.brd }}>
            <div className="h-full rounded-full" style={{ width: `${cashWeight}%`, background: `linear-gradient(90deg, ${B.gold}, ${B.pri})` }} />
          </div>
        </Sec>
      )}

      {/* Validation warnings */}
      {totalCash !== 100 && splitType !== "equal" && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: B.goldL, border: `1px solid ${B.gold}` }}>
          <AlertTriangle size={14} style={{ color: B.goldD, flexShrink: 0 }} />
          <p className="text-xs" style={{ color: B.goldD }}>Capital percentages total {totalCash}% (should be 100%). Adjust so the math is clean.</p>
        </div>
      )}

      {/* Pie chart */}
      <div className="rounded-xl p-5 border" style={{ borderColor: B.brd }}>
        <h3 className="text-sm font-bold mb-3 text-center" style={{ color: B.txt }}>Split Breakdown</h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                {pieData.map((_, i) => <Cell key={i} fill={SPLIT_COLORS[i % 5]} />)}
              </Pie>
              <Tooltip formatter={v => `${v.toFixed(1)}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Result cards */}
      <div className={`grid gap-4 ${partners.length <= 3 ? `grid-cols-${partners.length}` : "grid-cols-2"}`} style={{ gridTemplateColumns: partners.length <= 3 ? `repeat(${partners.length}, 1fr)` : "repeat(2, 1fr)" }}>
        {results.map((r, i) => (
          <div key={i} className="rounded-xl p-5 text-center border-2" style={{ borderColor: SPLIT_COLORS[i % 5], background: SPLIT_BGS[i % 5] }}>
            <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xs font-bold" style={{ background: SPLIT_COLORS[i % 5] }}>{r.name.charAt(0)}</div>
            <div className="text-xs font-medium mb-1" style={{ color: B.mut }}>{r.name}</div>
            <div className="text-2xl font-black" style={{ color: SPLIT_COLORS[i % 5] }}>{fp(r.share)}</div>
            <div className="text-lg font-bold" style={{ color: r.amount >= 0 ? B.grn : B.red }}>{fmt(Math.round(r.amount))}</div>
            {splitType === "weighted" && <div className="text-[10px] mt-1" style={{ color: B.mut }}>Cash: {r.cashPct}% | Work: {r.workPct}%</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PAGE: SENSITIVITY (UPGRADED - supports all 8 deal types)
// ═══════════════════════════════════════════════════════════════
const SENSITIVITY_VARS = {
  flip: [
    { key: "rehabCost", label: "Rehab Cost" }, { key: "purchasePrice", label: "Purchase Price" },
    { key: "arv", label: "ARV" }, { key: "interestRate", label: "Interest Rate" },
    { key: "holdMonths", label: "Hold Period (months)" }, { key: "agentCommission", label: "Agent Commission" },
  ],
  brrrr: [
    { key: "rehabCost", label: "Rehab Cost" }, { key: "purchasePrice", label: "Purchase Price" },
    { key: "monthlyRent", label: "Monthly Rent" }, { key: "refiLTV", label: "Refi LTV" },
    { key: "refiRate", label: "Refi Rate" }, { key: "interestRate", label: "Interest Rate" },
    { key: "vacancyRate", label: "Vacancy Rate" },
  ],
  rental: [
    { key: "purchasePrice", label: "Purchase Price" }, { key: "monthlyRent", label: "Monthly Rent" },
    { key: "loanRate", label: "Interest Rate" }, { key: "vacancyRate", label: "Vacancy Rate" },
    { key: "downPayment", label: "Down Payment %" }, { key: "rehabCost", label: "Rehab Cost" },
  ],
  str: [
    { key: "nightlyRate", label: "Nightly Rate" }, { key: "occupancyRate", label: "Occupancy Rate" },
    { key: "purchasePrice", label: "Purchase Price" }, { key: "loanRate", label: "Interest Rate" },
    { key: "platformFee", label: "Platform Fee" }, { key: "furnishingCost", label: "Furnishing Cost" },
  ],
  wholesale: [
    { key: "assignmentFee", label: "Assignment Fee" }, { key: "contractPrice", label: "Contract Price" },
    { key: "arv", label: "ARV" }, { key: "estimatedRepairCost", label: "Repair Cost" },
  ],
  multi: [
    { key: "avgRentPerUnit", label: "Avg Rent / Unit" }, { key: "purchasePrice", label: "Purchase Price" },
    { key: "vacancyRate", label: "Vacancy Rate" }, { key: "loanRate", label: "Interest Rate" },
    { key: "exitCapRate", label: "Exit Cap Rate" }, { key: "units", label: "Total Units" },
  ],
  mhp: [
    { key: "lotRent", label: "Lot Rent" }, { key: "purchasePrice", label: "Purchase Price" },
    { key: "occupiedLots", label: "Occupied Lots" }, { key: "loanRate", label: "Interest Rate" },
    { key: "marketLotRent", label: "Market Lot Rent" }, { key: "infillCostPerLot", label: "Infill Cost / Lot" },
  ],
  storage: [
    { key: "avgRentPerUnit", label: "Avg Rent / Unit" }, { key: "purchasePrice", label: "Purchase Price" },
    { key: "occupiedUnits", label: "Occupied Units" }, { key: "loanRate", label: "Interest Rate" },
    { key: "marketRatePerUnit", label: "Market Rate / Unit" },
  ],
};

const Sensitivity = ({ deals, t, getGradeL, localDealTypes }) => {
  const [si, setSi] = useState(0);
  const [varIdx, setVarIdx] = useState(0);
  const [range, setRange] = useState(30);

  if (!deals.length) return (
    <div className="text-center py-16">
      <Target size={48} style={{ color: B.brd, margin: "0 auto 12px" }} />
      <h3 className="text-lg font-bold mb-2">{t.saveDealFirst}</h3>
      <p className="text-sm" style={{ color: B.mut }}>{t.whatIfDesc}</p>
    </div>
  );

  const deal = deals[si] || deals[0];
  const vars = (SENSITIVITY_VARS[deal.type] || []).filter(v => deal.data[v.key] !== undefined && deal.data[v.key] !== 0);
  const v = vars[varIdx] || vars[0];
  if (!v) return null;

  const bv = deal.data[v.key];
  const calc = CALCS[deal.type];
  const isPercent = v.key.includes("Rate") || v.key.includes("vacancy") || v.key.includes("Percent") || v.key.includes("LTV") || v.key.includes("Fee") || v.key.includes("downPayment") || v.key.includes("Commission") || v.key.includes("occupancy");
  const isInteger = v.key.includes("Months") || v.key.includes("months") || v.key.includes("Lots") || v.key.includes("lots") || v.key.includes("Units") || v.key.includes("units") || v.key.includes("Days");

  const pts = [];
  const steps = 11;
  for (let i = 0; i < steps; i++) {
    const p = -range + (2 * range * i) / (steps - 1);
    const adjVal = bv * (1 + p / 100);
    const adj = { ...deal.data, [v.key]: isInteger ? Math.round(adjVal) : adjVal };
    const r = calc(adj);
    const profit = r.profit != null ? r.profit : (r.annCF != null ? r.annCF : (r.moCF || 0) * 12);
    pts.push({
      label: `${p >= 0 ? "+" : ""}${Math.round(p)}%`,
      pct: Math.round(p),
      value: isInteger ? Math.round(adjVal) : adjVal,
      profit: Math.round(profit),
      moCF: r.moCF != null ? Math.round(r.moCF) : null,
      score: Math.round(r.score),
      roi: r.roi != null ? r.roi : (r.coC != null ? r.coC : null),
    });
  }

  const baseIdx = Math.floor(steps / 2);
  const baseProfit = pts[baseIdx]?.profit || 0;
  const baseScore = pts[baseIdx]?.score || 0;
  const worstProfit = Math.min(...pts.map(p => p.profit));
  const bestProfit = Math.max(...pts.map(p => p.profit));
  const breakEvenIdx = pts.findIndex((p, i) => i > 0 && ((pts[i-1].profit >= 0 && p.profit < 0) || (pts[i-1].profit < 0 && p.profit >= 0)));

  return (
    <div className="space-y-6">
      {/* Header with deal summary */}
      <div className="rounded-xl p-4" style={{ background: B.pri }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">{deal.data.name || localDealTypes.find(dt => dt.id === deal.type)?.label || "Deal"}</h3>
            <p className="text-xs" style={{ color: B.accL }}>Sensitivity Analysis - How does your deal hold up?</p>
          </div>
          <div className="flex gap-3">
            <div className="text-center px-3 py-1 rounded-lg" style={{ background: B.acc }}>
              <div className="text-xs" style={{ color: B.accL }}>Base Profit</div>
              <div className="text-sm font-bold text-white">{fmt(baseProfit)}</div>
            </div>
            <div className="text-center px-3 py-1 rounded-lg" style={{ background: B.acc }}>
              <div className="text-xs" style={{ color: B.accL }}>Score</div>
              <div className="text-sm font-bold" style={{ color: B.gold }}>{baseScore}/100</div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-medium mb-1 block" style={{ color: B.mut }}>{t.deal}</label>
          <select value={si} onChange={e => { setSi(Number(e.target.value)); setVarIdx(0); }} className="w-full p-2.5 rounded-lg border text-sm" style={{ borderColor: B.brd }}>
            {deals.map((d, i) => <option key={d.id} value={i}>{d.data.name || localDealTypes.find(dt => dt.id === d.type)?.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-medium mb-1 block" style={{ color: B.mut }}>{t.variable}</label>
          <select value={varIdx} onChange={e => setVarIdx(Number(e.target.value))} className="w-full p-2.5 rounded-lg border text-sm" style={{ borderColor: B.brd }}>
            {vars.map((vr, i) => <option key={vr.key} value={i}>{vr.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[100px]">
          <label className="text-xs font-medium mb-1 block" style={{ color: B.mut }}>{t.range}</label>
          <select value={range} onChange={e => setRange(Number(e.target.value))} className="w-full p-2.5 rounded-lg border text-sm" style={{ borderColor: B.brd }}>
            {[10, 20, 30, 50].map(r => <option key={r} value={r}>+/- {r}%</option>)}
          </select>
        </div>
      </div>

      {/* Quick insight strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ background: B.redL, border: `1px solid ${B.red}30` }}>
          <div className="text-[10px] font-medium" style={{ color: B.red }}>WORST CASE (-{range}%)</div>
          <div className="text-sm font-bold" style={{ color: worstProfit >= 0 ? B.grn : B.red }}>{fmt(worstProfit)}</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: B.goldL, border: `1px solid ${B.gold}30` }}>
          <div className="text-[10px] font-medium" style={{ color: B.goldD }}>CURRENT</div>
          <div className="text-sm font-bold" style={{ color: B.pri }}>{fmt(baseProfit)}</div>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: B.grnL, border: `1px solid ${B.grn}30` }}>
          <div className="text-[10px] font-medium" style={{ color: B.grn }}>BEST CASE (+{range}%)</div>
          <div className="text-sm font-bold" style={{ color: B.grn }}>{fmt(bestProfit)}</div>
        </div>
      </div>

      {breakEvenIdx > -1 && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: B.redL, border: `1px solid ${B.red}` }}>
          <AlertTriangle size={16} style={{ color: B.red, flexShrink: 0 }} />
          <p className="text-xs font-medium" style={{ color: "#7F1D1D" }}>
            Break-even threshold: This deal turns negative around {pts[breakEvenIdx]?.label} change in {v.label.toLowerCase()}. Know your floor before committing.
          </p>
        </div>
      )}

      {/* Profit/CF chart */}
      <Sec title={`${v.label}: Impact on Profit / Cash Flow`} icon={Target}>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <AreaChart data={pts} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={v2 => fmtK(v2)} tick={{ fontSize: 10 }} />
              <Tooltip formatter={v2 => fmt(v2)} labelFormatter={l => `${v.label} ${l}`} />
              <Area type="monotone" dataKey="profit" name={t.profitCF} stroke={B.pri} fill={B.acc} fillOpacity={0.3} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Sec>

      {/* Score impact chart */}
      <Sec title="Deal Score Sensitivity" icon={Award}>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={pts} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip formatter={v2 => [`${v2}/100`, "Score"]} labelFormatter={l => `${v.label} ${l}`} />
              <Bar dataKey="score" name={t.score} radius={[4, 4, 0, 0]}>
                {pts.map((p, i) => <Cell key={i} fill={getGradeL(p.score).color} fillOpacity={p.pct === 0 ? 1 : 0.7} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Sec>

      {/* Data table */}
      <Sec title={t.dataTable} icon={FileText}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                <th className="p-2 text-left font-medium" style={{ color: B.mut }}>{t.change}</th>
                <th className="p-2 text-right font-medium" style={{ color: B.mut }}>{v.label}</th>
                <th className="p-2 text-right font-medium" style={{ color: B.mut }}>{t.profitCF}</th>
                <th className="p-2 text-right font-medium" style={{ color: B.mut }}>vs. Base</th>
                <th className="p-2 text-right font-medium" style={{ color: B.mut }}>{t.score}</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p, i) => {
                const diff = p.profit - baseProfit;
                return (
                  <tr key={i} className="border-t" style={{ borderColor: B.brd, background: p.pct === 0 ? B.goldL : "transparent", fontWeight: p.pct === 0 ? 600 : 400 }}>
                    <td className="p-2">{p.label}{p.pct === 0 ? " (current)" : ""}</td>
                    <td className="p-2 text-right">{isPercent ? `${p.value.toFixed(1)}%` : isInteger ? p.value : fmt(p.value)}</td>
                    <td className="p-2 text-right font-medium" style={{ color: p.profit >= 0 ? B.grn : B.red }}>{fmt(p.profit)}</td>
                    <td className="p-2 text-right" style={{ color: diff > 0 ? B.grn : diff < 0 ? B.red : B.mut }}>
                      {p.pct === 0 ? "-" : `${diff >= 0 ? "+" : ""}${fmt(diff)}`}
                    </td>
                    <td className="p-2 text-right">
                      <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: getGradeL(p.score).bg, color: getGradeL(p.score).color }}>
                        {getGradeL(p.score).grade} ({p.score})
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Sec>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PDF REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════
function generateReport(deal) {
  const t = DEAL_TYPES.find(dt => dt.id === deal.type);
  const c = deal.calc;
  const g = getGrade(c.score);
  const name = deal.data.name || `${t?.label || "Deal"} Analysis`;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const metricRows = [];
  if (c.profit != null) metricRows.push(["Net Profit", fmt(c.profit)]);
  if (c.moCF != null) metricRows.push(["Monthly Cash Flow", fmt(c.moCF)]);
  if (c.annCF != null) metricRows.push(["Annual Cash Flow", fmt(c.annCF)]);
  if (c.roi != null) metricRows.push(["ROI", fp(c.roi)]);
  if (c.coC != null) metricRows.push(["Cash-on-Cash Return", c.infinite ? "Infinite" : fp(c.coC)]);
  if (c.capRate != null) metricRows.push(["Cap Rate", fp(c.capRate)]);
  if (c.dscr != null) metricRows.push(["DSCR", c.dscr.toFixed(2)]);
  if (c.noi != null) metricRows.push(["NOI", fmt(c.noi)]);
  if (c.cashIn != null) metricRows.push(["Cash Invested", fmt(c.cashIn)]);
  if (c.cash != null) metricRows.push(["Cash Out of Pocket", fmt(c.cash)]);
  if (c.allIn != null) metricRows.push(["Total All-In Cost", fmt(c.allIn)]);
  if (c.totHold != null) metricRows.push(["Total Holding Costs", fmt(c.totHold)]);
  if (c.moHold != null) metricRows.push(["Monthly Holding Cost", fmt(c.moHold)]);
  if (c.cashLeft != null) metricRows.push(["Cash Left in Deal", c.cashLeft <= 0 ? "$0 (All Out)" : fmt(c.cashLeft)]);
  if (c.refiAmount != null) metricRows.push(["Refinance Amount", fmt(c.refiAmount)]);
  if (c.cashBack != null) metricRows.push(["Cash Back at Refi", fmt(c.cashBack)]);
  if (c.equityMultiple != null) metricRows.push(["Equity Multiple", `${c.equityMultiple.toFixed(2)}x`]);
  if (c.exitValue != null) metricRows.push(["Projected Exit Value", fmt(c.exitValue)]);
  if (c.totalReturn != null) metricRows.push(["Total Return", fmt(c.totalReturn)]);
  if (c.pricePerUnit != null) metricRows.push(["Price per Unit", fmt(c.pricePerUnit)]);
  if (c.pricePerLot != null) metricRows.push(["Price per Lot", fmt(c.pricePerLot)]);
  if (c.breakEvenOcc != null) metricRows.push(["Break-Even Occupancy", fp(c.breakEvenOcc)]);
  if (c.maxOffer != null) metricRows.push(["Max Allowable Offer", fmt(c.maxOffer)]);
  if (c.spread != null) metricRows.push(["Spread", fmt(c.spread)]);
  if (c.margin != null) metricRows.push(["Profit Margin", fp(c.margin)]);

  const naive = c.naive != null ? fmt(c.naive) : null;
  const real = c.moCF != null ? fmt(c.moCF) : c.profit != null ? fmt(c.profit) : null;
  const hidden = c.hidden != null && c.hidden > 0 ? fmt(c.hidden) : null;

  const expRows = (c.expenses || c.costs || c.holding || []).map(e => `<tr><td style="padding:6px 12px;border-bottom:1px solid #E0E3EA;font-size:13px;">${e.name}</td><td style="padding:6px 12px;border-bottom:1px solid #E0E3EA;text-align:right;font-size:13px;font-weight:600;">${fmt(e.value)}</td></tr>`).join("");

  const inputRows = Object.entries(deal.data).filter(([k, v]) => k !== "name" && v !== 0 && v !== "").map(([k, v]) => {
    const label = k.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
    const val = typeof v === "number" ? (k.includes("Rate") || k.includes("Percent") || k.includes("PM") || k.includes("vacancy") || k.includes("occupancy") || k.includes("downPayment") || k.includes("closingBuy") || k.includes("closingSell") || k.includes("closingRefi") || k.includes("agentCommission") || k.includes("loanPoints") || k.includes("platformFee") || k.includes("appreciationRate") || k.includes("rentGrowthRate") || k.includes("exitCapRate") || k.includes("refiLTV") ? `${v}%` : k.includes("Months") || k.includes("Years") || k.includes("Days") || k.includes("Term") || k.includes("lots") || k.includes("units") || k.includes("Lots") || k.includes("Units") || k.includes("Nights") ? v : fmt(v)) : v;
    return `<tr><td style="padding:4px 12px;font-size:12px;color:#6B7280;">${label}</td><td style="padding:4px 12px;text-align:right;font-size:12px;">${val}</td></tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name} - DealClarity Report</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;color:#1A1A1A;background:#fff}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}</style></head><body>
<div style="max-width:700px;margin:0 auto;padding:40px 30px;">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid ${B.gold};">
<div><div style="font-size:24px;font-weight:800;color:${B.pri};">DealClarity</div><div style="font-size:11px;color:#6B7280;">True Profitability Report</div></div>
<div style="text-align:right;"><div style="font-size:12px;color:#6B7280;">${date}</div><div style="font-size:11px;color:#6B7280;">Profit Clarity Advantage</div></div></div>
<div style="margin-bottom:24px;"><h1 style="font-size:22px;font-weight:700;color:${B.pri};margin-bottom:4px;">${name}</h1><div style="font-size:13px;color:#6B7280;">${t?.label} Analysis | ${t?.desc}</div></div>
<div style="display:flex;gap:16px;margin-bottom:24px;">
<div style="flex:1;padding:16px;border-radius:12px;background:${g.bg};border:2px solid ${g.color};text-align:center;">
<div style="font-size:36px;font-weight:900;color:${g.color};">${g.grade}</div><div style="font-size:11px;color:#6B7280;">Deal Score: ${Math.round(c.score)}/100</div><div style="font-size:11px;color:${g.color};font-weight:600;">${g.label}</div></div>
${naive && real ? `<div style="flex:2;padding:16px;border-radius:12px;background:${hidden ? '#FFF5F5' : '#DCFCE7'};border:1px solid ${hidden ? '#DC2626' : '#16A34A'};">
<div style="font-size:13px;font-weight:700;color:${hidden ? '#DC2626' : '#16A34A'};margin-bottom:8px;">${hidden ? 'REALITY CHECK' : 'DEAL CHECKS OUT'}</div>
<div style="font-size:12px;color:#6B7280;">Basic calculator: <strong>${naive}</strong></div>
<div style="font-size:12px;color:#6B7280;">True number: <strong style="color:${hidden ? '#DC2626' : '#16A34A'};">${real}</strong></div>
${hidden ? `<div style="font-size:12px;color:#DC2626;font-weight:600;margin-top:4px;">${hidden} in hidden costs</div>` : ''}</div>` : ''}</div>
<h2 style="font-size:15px;font-weight:700;color:${B.pri};margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #E0E3EA;">Key Metrics</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${metricRows.map(([l, v]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #E0E3EA;font-size:13px;color:#6B7280;">${l}</td><td style="padding:8px 12px;border-bottom:1px solid #E0E3EA;text-align:right;font-size:14px;font-weight:700;">${v}</td></tr>`).join("")}</table>
${expRows ? `<h2 style="font-size:15px;font-weight:700;color:${B.pri};margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #E0E3EA;">Cost / Expense Breakdown</h2><table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${expRows}</table>` : ""}
<h2 style="font-size:15px;font-weight:700;color:${B.pri};margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #E0E3EA;">Deal Inputs</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">${inputRows}</table>
<div style="margin-top:30px;padding-top:16px;border-top:2px solid ${B.gold};text-align:center;">
<div style="font-size:11px;color:#6B7280;">Generated by DealClarity — dealclarity.vercel.app</div>
<div style="font-size:11px;color:#6B7280;">Profit Clarity Advantage | Because The Books Don't Lie.</div></div>
<div class="no-print" style="text-align:center;margin-top:20px;"><button onclick="window.print()" style="padding:12px 32px;background:${B.pri};color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Save as PDF / Print</button></div>
</div></body></html>`;
  return html;
}

// ═══════════════════════════════════════════════════════════════
// STRIPE CONFIG (checkout handled server-side via /api/create-checkout)
// ═══════════════════════════════════════════════════════════════
const PLANS = { monthly: "Monthly", annual: "Annual", lifetime: "Lifetime" };
const hasStripe = true; // Checkout goes through API, always available

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
const ProGate = ({ feature, onUnlock, setShowPro, t }) => (
  <div className="space-y-6 text-center py-12">
    <div style={{ fontSize: 48 }}>🔒</div>
    <div>
      <h3 className="text-xl font-bold mb-2" style={{ color: B.txt }}>{t?.proFeatureTitle || `${feature} is a Pro Feature`}</h3>
      <p className="text-sm" style={{ color: B.mut }}>{t?.proFeatureDesc || "Unlock advanced analysis and premium features with DealClarity Pro."}</p>
    </div>
    <button onClick={() => setShowPro(true)} className="px-6 py-3 rounded-xl font-semibold text-sm transition-all text-white" style={{ background: B.gold, color: B.pri }}>Upgrade to Pro</button>
  </div>
);

export default function DealClarity() {
  const [page, setPage] = useState("analyze");
  const [dealType, setDealType] = useState("flip");
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("dc_lang") || "en"; } catch { return "en"; } });
  const t = T[lang];
  const localDealTypes = useMemo(() => getDealTypes(t), [lang]);
  const localPages = useMemo(() => getPages(t), [lang]);
  const localGrades = useMemo(() => getGrades(t), [lang]);
  const getGradeL = (score) => localGrades.find(g => score >= g.min) || localGrades[localGrades.length - 1];
  const toggleLang = () => { const n = lang === "en" ? "es" : "en"; setLang(n); try { localStorage.setItem("dc_lang", n); } catch {} trackEvent(EVENTS.LANGUAGE_TOGGLED, { lang: n }); };
  const [dealData, setDealData] = useState(() => { const d = {}; DEAL_TYPES.forEach(dt => { d[dt.id] = { ...DEFAULTS[dt.id] }; }); return d; });
  const [portfolio, setPortfolio] = useState(() => {
    try { const s = localStorage.getItem("dc_portfolio"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [mm, setMM] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null); // stores deal id being edited
  const [saved, setSaved] = useState(false);
  const [showPro, setShowPro] = useState(false);
  const [email, setEmail] = useState("");
  const [emailDone, setEmailDone] = useState(false);
  const [pdfMsg, setPdfMsg] = useState("");
  const [isPro, setIsPro] = useState(false); // Always starts false — verified from Supabase via onAuthStateChange
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }
  const showToast = useCallback((message, type = "error") => setToast({ message, type }), []);
  const [proCode, setProCode] = useState("");
  const [proMsg, setProMsg] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState(null);
  const trialDaysLeft = useMemo(() => {
    if (!trialEndsAt) return null;
    const diff = new Date(trialEndsAt) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [trialEndsAt]);

  // Persist portfolio to localStorage whenever it changes
  const saveToStorage = useCallback((p) => {
    try { localStorage.setItem("dc_portfolio", JSON.stringify(p)); } catch {}
  }, []);

  // ── Auth state listener: auto-detect login/logout, sync deals from cloud ──
  const syncedRef = useRef(false); // prevent double cloud sync
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        setUser(session.user);
        const { data: profile } = await supabase.from("profiles").select("is_pro, pro_type, trial_ends_at").eq("id", session.user.id).single();
        // Check trial expiry
        let proStatus = profile?.is_pro || false;
        if (profile?.pro_type === "trial" && profile?.trial_ends_at) {
          const expired = new Date(profile.trial_ends_at) < new Date();
          if (expired) {
            proStatus = false;
            supabase.from("profiles").update({ is_pro: false, pro_type: null }).eq("id", session.user.id);
          } else {
            setTrialEndsAt(profile.trial_ends_at);
          }
        }
        setIsPro(proStatus);
        if (proStatus && !syncedRef.current) {
          syncedRef.current = true;
          // Sync: merge any local deals to cloud, then load cloud portfolio
          setSyncing(true);
          try {
            const localRaw = localStorage.getItem("dc_portfolio");
            const localDeals = localRaw ? JSON.parse(localRaw) : [];
            const { deals, newUploads } = await mergeLocalToCloud(localDeals, session.user.id);
            setPortfolio(deals);
            if (newUploads > 0) showToast(`${newUploads} local deal${newUploads > 1 ? "s" : ""} synced to cloud!`, "success");
            try { localStorage.removeItem("dc_portfolio"); } catch {}
          } catch (err) {
            console.error("Cloud sync error:", err);
          }
          setSyncing(false);
        } else if (!proStatus) {
          // Free user — load local deals
          try {
            const localRaw = localStorage.getItem("dc_portfolio");
            if (localRaw) setPortfolio(JSON.parse(localRaw));
          } catch {}
        }
      } else if (event === "SIGNED_OUT") {
        syncedRef.current = false;
        setUser(null);
        setIsPro(false);
        setTrialEndsAt(null);
        setPortfolio([]);
        try { localStorage.removeItem("dc_portfolio"); localStorage.removeItem("dc_pro"); } catch {}
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Check ?upgraded=true after Stripe redirect ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      // Refresh Pro status from Supabase
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase.from("profiles").select("is_pro, pro_type").eq("id", session.user.id).single();
          if (profile?.is_pro) {
            setIsPro(true);
            try { localStorage.setItem("dc_pro", "true"); } catch {}
            showToast("Pro activated! Welcome to DealClarity Pro.", "success");
          }
        }
      })();
    }
  }, [showToast]);

  // ── Refresh Pro status on window focus (e.g., returning from Stripe) ──
  useEffect(() => {
    const handleFocus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: profile } = await supabase.from("profiles").select("is_pro, pro_type").eq("id", session.user.id).single();
        if (profile?.is_pro && !isPro) {
          setIsPro(true);
          try { localStorage.setItem("dc_pro", "true"); } catch {}
          showToast("Pro status synced!", "success");
        }
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [isPro, showToast]);

  const activatePro = async (code) => {
    if (!user) { setProMsg("Please sign in first to activate a code."); setTimeout(() => setProMsg(""), 3000); return; }
    setProMsg("Validating...");
    try {
      const res = await fetch("/api/activate-pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email: user.email }),
      });
      const data = await res.json();
      if (data.success) {
        setIsPro(true);
        setProMsg("Pro activated! Full access unlocked.");
        trackEvent(EVENTS.PRO_ACTIVATED, { method: "code" });
        setTimeout(() => { setProMsg(""); setShowPro(false); }, 2000);
      } else {
        setProMsg(data.error || "Invalid code. Please check and try again.");
        setTimeout(() => setProMsg(""), 3000);
      }
    } catch {
      setProMsg("Connection error. Please try again.");
      setTimeout(() => setProMsg(""), 3000);
    }
  };

  const handleAuth = async () => {
    setAuthError(""); setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        // Start 7-day trial on signup — use upsert to avoid race with DB trigger
        if (signUpData?.user) {
          const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          await supabase.from("profiles").upsert({
            id: signUpData.user.id,
            trial_started: true,
            trial_ends_at: trialEnd,
            is_pro: true,
            pro_type: "trial",
          });
        }
        setAuthError("Check your email to confirm your account. You'll get 7 days of Pro free!");
        trackEvent(EVENTS.AUTH_SIGNUP);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        trackEvent(EVENTS.AUTH_SIGNIN);
        // onAuthStateChange handles setUser, setIsPro, sync — just close the modal
        setShowAuth(false);
      }
    } catch (e) { setAuthError(e.message); }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange handles cleanup — but set state directly for immediate UI update
    setUser(null); setIsPro(false); setPortfolio([]); setTrialEndsAt(null);
    try { localStorage.removeItem("dc_portfolio"); localStorage.removeItem("dc_pro"); } catch {}
  };

  const handleManageSubscription = async () => {
    if (!user) return;
    try {
      const { data: profile } = await supabase.from("profiles").select("stripe_customer_id").eq("id", user.id).single();
      const res = await fetch("/api/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: profile?.stripe_customer_id, email: user.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else showToast(data.error || "Could not open subscription management.", "error");
    } catch {
      showToast("Connection error. Please try again.", "error");
    }
  };

  const cd = dealData[dealType];
  const uf = useCallback((k, v) => setDealData(p => {
    const next = { ...p, [dealType]: { ...p[dealType], [k]: v } };
    // Auto-adjust loan amount for BRRRR/flip when purchase price changes
    if (k === "purchasePrice" && (dealType === "brrrr" || dealType === "flip")) {
      const def = DEFAULTS[dealType];
      const ratio = def.purchasePrice > 0 ? def.loanAmount / def.purchasePrice : 0.9;
      next[dealType].loanAmount = Math.round(v * ratio);
    }
    return next;
  }), [dealType]);
  const calc = useMemo(() => {
  const result = CALCS[dealType]?.(cd);
  if (result) result._inputs = cd;
  return result;
}, [dealType, cd]);
  const saveDeal = async () => {
  if (editingDeal) {
    const editedDeal = portfolio.find(d => d.id === editingDeal);
    const next = portfolio.map(d =>
      d.id === editingDeal ? { ...d, data: { ...cd }, calc } : d
    );
    setPortfolio(next);
    // Pro: update in cloud; Free: update in localStorage
    if (isPro && user && editedDeal?.cloudId) {
      saveCloudDeal({ ...editedDeal, data: { ...cd }, calc }, user.id);
    } else {
      saveToStorage(next);
    }
    setEditingDeal(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    return;
  }
  if (!isPro && portfolio.length >= 2) { setShowPro(true); trackEvent(EVENTS.PRO_MODAL_OPENED, { trigger: "save_limit" }); return; }
  const newDeal = { id: uid(), type: dealType, data: { ...cd }, calc };
  // Pro: save to cloud and get the cloud ID back
  if (isPro && user) {
    const saved = await saveCloudDeal(newDeal, user.id);
    if (saved) {
      newDeal.id = saved.id;
      newDeal.cloudId = saved.id;
    }
  }
  const next = [...portfolio, newDeal];
  setPortfolio(next);
  if (!isPro) saveToStorage(next); // Free users still use localStorage
  setSaved(true);
  trackEvent(EVENTS.DEAL_SAVED, { dealType, portfolioSize: next.length, cloud: !!isPro });
  setTimeout(() => setSaved(false), 2000);
};
  const removeDeal = async (id) => {
    const deal = portfolio.find(d => d.id === id);
    if (isPro && deal?.cloudId) { await deleteCloudDeal(deal.cloudId); }
    const next = portfolio.filter(d => d.id !== id);
    setPortfolio(next);
    if (!isPro) saveToStorage(next);
    trackEvent(EVENTS.DEAL_REMOVED);
  };
  const editDeal = (deal) => {
  setDealType(deal.type);
  setDealData(prev => ({ ...prev, [deal.type]: { ...deal.data } }));
  setEditingDeal(deal.id);
  setPage("analyze");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

  // PDF export
  const handleCheckout = async (plan) => {
  if (!user) { setShowAuth(true); return; }
  trackEvent(EVENTS.CHECKOUT_STARTED, { plan });
  try {
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, email: user.email }),
    });
    const data = await res.json();
    if (data.error) { showToast(data.error); return; }
    if (data.url) window.location.href = data.url;
  } catch (e) {
    showToast("Checkout error. Please check your connection and try again.");
  }
};
  const exportPDF = (deal) => {
  if (!isPro) { setShowPro(true); trackEvent(EVENTS.PRO_MODAL_OPENED, { trigger: "pdf_export" }); return; }
  trackEvent(EVENTS.PDF_EXPORTED, { dealType: deal?.type || dealType });
  const dealObj = deal || { type: dealType, data: { ...cd }, calc };
  const tDeal = DEAL_TYPES.find(dt => dt.id === dealObj.type);
  const c = dealObj.calc;
  const g = getGrade(c.score);
  const name = dealObj.data.name || `${tDeal?.label || "Deal"} Analysis`;
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const doc = new jsPDF();
  const gradeRGB = {
    "A+": [22,163,74], "A": [22,163,74], "B": [37,99,235],
    "C": [212,168,67], "D": [234,88,12], "F": [220,38,38]
  };
  const gc = gradeRGB[g.grade] || [107,114,128];

  // ── Header bar
  doc.setFillColor(15, 26, 46);
  doc.rect(0, 0, 210, 38, "F");
  doc.setDrawColor(201, 165, 76);
  doc.setLineWidth(1);
  doc.line(0, 38, 210, 38);

  doc.setTextColor(201, 165, 76);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("DealClarity", 15, 18);

  doc.setTextColor(163, 184, 212);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("True Profitability Report  |  Profit Clarity Advantage", 15, 26);
  doc.text("dealclarity.vercel.app", 15, 32);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.text(date, 195, 26, { align: "right" });

  // ── Deal name block
  doc.setTextColor(15, 26, 46);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(name, 15, 52);

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${tDeal?.label} Analysis  |  ${tDeal?.desc}`, 15, 59);

  // ── Grade badge
  doc.setFillColor(...gc);
  doc.roundedRect(15, 64, 42, 26, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(g.grade, 36, 81, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`${Math.round(c.score)}/100`, 36, 87, { align: "center" });

  // ── Reality check box
  const isHidden = c.hidden != null && c.hidden > 0;
  if (c.naive != null) {
    doc.setFillColor(...(isHidden ? [255,241,241] : [220,252,231]));
    doc.roundedRect(62, 64, 133, 26, 3, 3, "F");
    doc.setTextColor(...(isHidden ? [220,38,38] : [22,163,74]));
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(isHidden ? "REALITY CHECK" : "DEAL CHECKS OUT", 68, 74);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.text(`Basic calculator: ${fmt(c.naive)}`, 68, 81);
    const trueVal = c.moCF != null ? fmt(c.moCF) : fmt(c.profit);
    doc.text(`True number: ${trueVal}`, 68, 87);
    if (isHidden) {
      doc.setTextColor(220, 38, 38);
      doc.setFont("helvetica", "bold");
      doc.text(`${fmt(c.hidden)} in hidden costs`, 140, 87);
    }
  }

  // ── Key metrics table
  const metrics = [];
  if (c.profit != null)       metrics.push(["Net Profit", fmt(c.profit)]);
  if (c.moCF != null)         metrics.push(["Monthly Cash Flow", fmt(c.moCF)]);
  if (c.annCF != null)        metrics.push(["Annual Cash Flow", fmt(c.annCF)]);
  if (c.roi != null)          metrics.push(["ROI", fp(c.roi)]);
  if (c.annRoi != null)       metrics.push(["Annualized ROI", fp(c.annRoi)]);
  if (c.coC != null)          metrics.push(["Cash-on-Cash", c.infinite ? "Infinite" : fp(c.coC)]);
  if (c.capRate != null)      metrics.push(["Cap Rate", fp(c.capRate)]);
  if (c.entryCapRate != null) metrics.push(["Entry Cap Rate", fp(c.entryCapRate)]);
  if (c.dscr != null)         metrics.push(["DSCR", c.dscr.toFixed(2)]);
  if (c.noi != null)          metrics.push(["NOI", fmt(c.noi)]);
  if (c.cashIn != null)       metrics.push(["Cash Invested", fmt(c.cashIn)]);
  if (c.cash != null)         metrics.push(["Cash Out of Pocket", fmt(c.cash)]);
  if (c.allIn != null)        metrics.push(["Total All-In Cost", fmt(c.allIn)]);
  if (c.totHold != null)      metrics.push(["Total Holding Costs", fmt(c.totHold)]);
  if (c.cashLeft != null)     metrics.push(["Cash Left in Deal", c.cashLeft <= 0 ? "$0 (All Out)" : fmt(c.cashLeft)]);
  if (c.cashBack != null)     metrics.push(["Cash Back at Refi", fmt(c.cashBack)]);
  if (c.margin != null)       metrics.push(["Profit Margin", fp(c.margin)]);
  if (c.equityMultiple != null) metrics.push(["Equity Multiple", `${c.equityMultiple.toFixed(2)}x`]);
  if (c.exitValue != null)    metrics.push(["Projected Exit Value", fmt(c.exitValue)]);
  if (c.totalReturn != null)  metrics.push(["Total Return", fmt(c.totalReturn)]);
  if (c.breakEvenOcc != null) metrics.push(["Break-Even Occupancy", fp(c.breakEvenOcc)]);
  if (c.spread != null)       metrics.push(["Spread", fmt(c.spread)]);
  if (c.pricePerUnit != null) metrics.push(["Price per Unit", fmt(c.pricePerUnit)]);
  if (c.pricePerLot != null)  metrics.push(["Price per Lot", fmt(c.pricePerLot)]);

  autoTable(doc, {
    startY: 98,
    head: [["Metric", "Value"]],
    body: metrics,
    theme: "striped",
    headStyles: { fillColor: [15,26,46], textColor: [255,255,255], fontSize: 10, fontStyle: "bold" },
    bodyStyles: { fontSize: 10 },
    alternateRowStyles: { fillColor: [247,248,250] },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 15, right: 15 },
  });

  // ── Expenses table
  const expData = c.expenses || c.costs || c.holding || [];
  if (expData.length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Cost / Expense Item", "Amount"]],
      body: expData.map(e => [e.name, fmt(e.value)]),
      theme: "striped",
      headStyles: { fillColor: [42,64,102], textColor: [255,255,255], fontSize: 10, fontStyle: "bold" },
      bodyStyles: { fontSize: 10 },
      alternateRowStyles: { fillColor: [247,248,250] },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      margin: { left: 15, right: 15 },
    });
  }

  // ── Deal Killer flags in report
  const killerFn = DEAL_KILLERS[dealObj.type];
  const inputs = dealObj.data;
  if (killerFn && inputs) {
    const flags = killerFn(c, inputs);
    if (flags.length > 0) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        head: [["⚠ Deal Analysis Flags"]],
        body: flags.map(f => [`[${f.level === "red" ? "DEAL KILLER" : f.level === "yellow" ? "WATCH OUT" : "CHECKS OUT"}]  ${f.msg}`]),
        theme: "plain",
        headStyles: { fillColor: [201,165,76], textColor: [15,26,46], fontSize: 10, fontStyle: "bold" },
        bodyStyles: { fontSize: 9, cellPadding: 4 },
        margin: { left: 15, right: 15 },
      });
    }
  }

  // ── Footer on every page
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(201, 165, 76);
    doc.setLineWidth(0.5);
    doc.line(15, 282, 195, 282);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "normal");
    doc.text("Generated by DealClarity — dealclarity.vercel.app", 15, 288);
    doc.text("Profit Clarity Advantage | Because The Books Don't Lie.", 15, 293);
    doc.text(`Page ${i} of ${pageCount}`, 195, 288, { align: "right" });
  }

  const filename = `DealClarity-${name.replace(/[^a-z0-9]/gi, "-")}-Report.pdf`;
  doc.save(filename);
  setPdfMsg("PDF downloaded!");
  setTimeout(() => setPdfMsg(""), 3000);
};
  const IC = INPUTS[dealType], RC = RESULTS[dealType];

  return (
    <ErrorBoundary>
    <div style={{ background: B.bg, minHeight: "100vh", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      <header style={{ background: B.pri, borderBottom: `3px solid ${B.gold}` }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: B.gold }}><Calculator size={20} color={B.pri} /></div>
            <div><h1 className="text-lg font-bold text-white tracking-tight">DealClarity</h1><p className="text-xs" style={{ color: "#A3B8D4" }}>{t.tagline}</p></div>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {localPages.map(p => (<button key={p.id} onClick={() => setPage(p.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all" style={{ background: page === p.id ? "rgba(255,255,255,0.15)" : "transparent", color: page === p.id ? "#fff" : "#A3B8D4" }}><p.icon size={14} />{p.label}{p.id === "portfolio" && portfolio.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full" style={{ background: B.gold, color: B.pri, fontSize: 10 }}>{portfolio.length}</span>}</button>))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleLang} className="px-2 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80 hidden md:block" style={{ background: "rgba(255,255,255,0.12)", color: "#A3B8D4" }}>{lang === "en" ? "ES" : "EN"}</button>
            {trialDaysLeft != null && trialDaysLeft > 0 && (
              <span className="px-2 py-1 rounded-lg text-xs font-semibold hidden md:inline-block" style={{ background: trialDaysLeft <= 2 ? B.redL : B.goldL, color: trialDaysLeft <= 2 ? B.red : B.goldD }}>
                {trialDaysLeft}d left on trial
              </span>
            )}
            {syncing && <span className="text-xs hidden md:inline-block" style={{ color: B.goldL }}>Syncing...</span>}
            <button onClick={() => setShowPro(true)} className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 hidden md:block" style={{ background: B.gold, color: B.pri }}>{isPro ? "Pro" : t.upgradePro}</button>
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(255,255,255,0.15)", color: "#A3B8D4" }}>{user.email?.[0]?.toUpperCase() || "U"}</div>
                <button onClick={handleSignOut} className="text-xs font-medium hover:opacity-80" style={{ color: "#A3B8D4" }}>Sign Out</button>
              </div>
            ) : (
              <button onClick={() => setShowAuth(true)} className="hidden md:block px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>Sign In</button>
            )}
            <button className="md:hidden p-2" onClick={() => setMM(!mm)}>{mm ? <X size={20} color="#fff" /> : <Menu size={20} color="#fff" />}</button>
          </div>
        </div>
        {mm && <div className="md:hidden px-4 pb-3 flex flex-wrap gap-2">{localPages.map(p => (<button key={p.id} onClick={() => { setPage(p.id); setMM(false); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: page === p.id ? "rgba(255,255,255,0.15)" : "transparent", color: page === p.id ? "#fff" : "#A3B8D4" }}><p.icon size={14} />{p.label}</button>))}<button onClick={toggleLang} className="px-3 py-2 rounded-lg text-xs font-medium" style={{ background: "rgba(255,255,255,0.12)", color: "#A3B8D4" }}>{lang === "en" ? "Espanol" : "English"}</button>{user ? (<button onClick={() => { handleSignOut(); setMM(false); }} className="px-3 py-2 rounded-lg text-xs font-medium" style={{ background: "rgba(220,38,38,0.15)", color: "#FCA5A5" }}>Sign Out ({user.email?.split("@")[0]})</button>) : (<button onClick={() => { setShowAuth(true); setMM(false); }} className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>Sign In / Sign Up</button>)}</div>}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {page === "analyze" && (<>
          <div className="mb-6"><div className="flex flex-wrap gap-2 justify-center">{localDealTypes.map(dt => (<button key={dt.id} onClick={() => setDealType(dt.id)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all border" style={{ background: dealType === dt.id ? B.pri : B.card, color: dealType === dt.id ? "#fff" : B.txt, borderColor: dealType === dt.id ? B.pri : B.brd }}><dt.icon size={15} /><div className="text-left"><div className="font-semibold">{dt.label}</div><div className="text-xs opacity-70">{dt.desc}</div></div></button>))}</div></div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
  <TemplateSelector dealType={dealType} onLoad={(data) => setDealData(prev => ({ ...prev, [dealType]: data }))} />
  {IC && <IC d={cd} u={uf} t={t} />}
</div>
            <div className="lg:col-span-3 space-y-4">
              {RC && calc && <RC c={calc} t={t} />}
              <button
  onClick={saveDeal}
  className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
  style={{ background: saved ? B.grn : editingDeal ? B.gold : B.pri, color: editingDeal ? B.pri : "#fff" }}
>
  {saved ? (
  <><Check size={16} /> {t.saved}</>
) : editingDeal ? (
  <><Check size={16} /> Update Deal</>
) : (
  <><Plus size={16} /> {t.savePortfolio}</>
)}
</button>
{editingDeal && (
  <button
    onClick={() => setEditingDeal(null)}
    className="w-full py-2 rounded-xl text-xs font-medium"
    style={{ color: B.mut }}
  >
    Cancel Edit
  </button>
)}
              <button onClick={() => exportPDF()} className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 border-2" style={{ borderColor: B.gold, color: B.goldD, background: B.goldL }}><Download size={16} /> {t.exportPdf}</button>
              {pdfMsg && <p className="text-xs text-center font-medium" style={{ color: B.grn }}>{pdfMsg}</p>}
              <div className="rounded-xl p-5 border-2 border-dashed" style={{ borderColor: B.gold, background: B.goldL }}><div className="flex items-start gap-3"><Star size={20} style={{ color: B.goldD, flexShrink: 0, marginTop: 2 }} /><div><h3 className="font-bold text-sm mb-1" style={{ color: B.goldD }}>{t.goPro} — {t.proPrice}</h3><p className="text-xs mb-3" style={{ color: "#6B5A1E" }}>{t.proDesc}</p><button onClick={() => setShowPro(true)} className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90" style={{ background: B.pri, color: "#fff" }}>{t.startTrial} →</button></div></div></div>
            </div>
          </div>
        </>)}
        {page === "portfolio" && <Portfolio deals={portfolio} removeDeal={removeDeal} editDeal={editDeal} exportPDF={exportPDF} t={t} getGradeL={getGradeL} localDealTypes={localDealTypes} />}
        {page === "compare" && <Compare deals={portfolio} t={t} localDealTypes={localDealTypes} />}
        {page === "splits" && <Splits t={t} portfolio={portfolio} localDealTypes={localDealTypes} />}
        {page === "sensitivity" && (isPro ? <Sensitivity deals={portfolio} t={t} getGradeL={getGradeL} localDealTypes={localDealTypes} /> : <ProGate feature="Sensitivity Analysis" onUnlock={() => setShowPro(false)} setShowPro={setShowPro} t={t} />)}
        {page === "budget" && <BudgetPlanner isPro={isPro} setShowPro={setShowPro} />}
        {page === "agent" && <AgentHub t={t} isPro={isPro} setShowPro={setShowPro} user={user} />}
        {page === "pulse" && <PulseCheck isPro={isPro} setShowPro={setShowPro} />}
        <footer className="text-center py-6 mt-8 border-t" style={{ borderColor: B.brd }}><p className="text-xs" style={{ color: B.mut }}>{t.footer}</p></footer>
      </main>

      {showAuth && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowAuth(false)}>
    <div className="rounded-2xl max-w-sm w-full overflow-hidden" style={{ background: B.card }} onClick={e => e.stopPropagation()}>
      <div className="p-6" style={{ background: B.pri }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{authMode === "signup" ? "Create Account" : "Sign In"}</h2>
          <button onClick={() => setShowAuth(false)} className="text-white hover:opacity-70">✕</button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: B.mut }}>Email</label>
          <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@email.com" className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2" style={{ borderColor: B.brd }} />
        </div>
        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: B.mut }}>Password</label>
          <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2" style={{ borderColor: B.brd }} />
        </div>
        {authError && <p className="text-xs text-center font-medium" style={{ color: authError.includes("Check") ? B.grn : B.red }}>{authError}</p>}
        <button onClick={handleAuth} disabled={authLoading} className="w-full py-3 rounded-xl font-bold text-sm hover:opacity-90 disabled:opacity-50" style={{ background: B.pri, color: "#fff" }}>
          {authLoading ? "Please wait..." : authMode === "signup" ? "Create Account" : "Sign In"}
        </button>
        <p className="text-xs text-center" style={{ color: B.mut }}>
          {authMode === "signup" ? "Already have an account? " : "No account yet? "}
          <button onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthError(""); }} className="font-semibold underline" style={{ color: B.blue }}>
            {authMode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
        {user && (
          <div className="pt-2 border-t text-center" style={{ borderColor: B.brd }}>
            <p className="text-xs mb-2" style={{ color: B.mut }}>Signed in as {user.email}</p>
            <div className="flex gap-3 justify-center">
              {isPro && <button onClick={handleManageSubscription} className="text-xs underline" style={{ color: B.blue }}>Manage Subscription</button>}
              <button onClick={handleSignOut} className="text-xs underline" style={{ color: B.red }}>Sign out</button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}
      {showPro && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowPro(false)}><div className="rounded-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto" style={{ background: B.card }} onClick={e => e.stopPropagation()}>
        <div className="p-6" style={{ background: B.pri }}><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-white">{t.proTitle || "Unlock DealClarity Pro"}</h2><p className="text-xs" style={{ color: "#A3B8D4" }}>{t.proSub || "Unlock all premium features"}</p></div><button onClick={() => setShowPro(false)} className="text-white text-xl hover:opacity-70">x</button></div></div>
        <div className="p-6">
          {isPro ? (
            <div className="text-center py-8"><div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: B.grnL }}><Check size={32} style={{ color: B.grn }} /></div><h3 className="text-lg font-bold mb-2" style={{ color: B.pri }}>Pro Activated!</h3><p className="text-sm" style={{ color: B.mut }}>You have full access to all premium features.</p><button onClick={() => setShowPro(false)} className="mt-4 px-6 py-2 rounded-lg text-sm font-medium" style={{ background: B.pri, color: "#fff" }}>Close</button></div>
          ) : (
            <div className="space-y-5">
              {/* Pro Features */}
              <div className="grid grid-cols-2 gap-2">
                {[t.f1, t.f2, t.f3, t.f4, t.f5, t.f6, t.f7, t.f8].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs" style={{ color: B.txt }}><Check size={14} style={{ color: B.grn }} />{f}</div>
                ))}
              </div>
              {/* Stripe Purchase Buttons */}
              <div className="space-y-2">
  {!user && (
    <div className="rounded-xl p-3 mb-3 text-center" style={{ background: B.blueL }}>
      <p className="text-xs mb-2 font-medium" style={{ color: B.blue }}>Sign in to purchase and sync your Pro status across devices</p>
      <button onClick={() => { setShowPro(false); setShowAuth(true); }} className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90" style={{ background: B.blue, color: "#fff" }}>Sign In / Create Account</button>
    </div>
  )}
  <button onClick={() => handleCheckout("monthly")} className="block w-full text-center py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90" style={{ background: B.gold, color: B.pri }}>Monthly Plan — $29/mo</button>
  <button onClick={() => handleCheckout("annual")} className="block w-full text-center py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 border-2" style={{ borderColor: B.gold, color: B.gold }}>Annual Plan — $199/yr (save 43%)</button>
  <button onClick={() => handleCheckout("lifetime")} className="block w-full text-center py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 border-2" style={{ borderColor: B.accL, color: B.accL }}>Lifetime Access — $299 once</button>
  <p className="text-xs text-center" style={{ color: B.mut }}>Secure checkout via Stripe. Cancel anytime.</p>
</div>
              {/* Code Activation */}
              <div style={{ borderTop: `1px solid ${B.brd}`, paddingTop: 16 }}>
                <h3 className="font-bold mb-2 text-sm" style={{ color: B.txt }}>{t.haveCode || "Have a Pro code?"}</h3>
                <div className="flex gap-2">
                  <input type="text" placeholder="Enter code..." value={proCode} onChange={e => setProCode(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: B.brd }} />
                  <button onClick={() => activatePro(proCode)} className="px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90" style={{ background: B.gold, color: B.pri }}>Activate</button>
                </div>
                {proMsg && <p className={`text-xs mt-2 text-center`} style={{ color: proMsg.includes("Invalid") ? B.red : B.grn }}>{proMsg}</p>}
              </div>
              {/* Free Tier Info */}
              <div style={{ borderTop: `1px solid ${B.brd}`, paddingTop: 12 }}>
                <h3 className="font-bold mb-2 text-xs" style={{ color: B.mut }}>Free Tier Includes</h3>
                <div className="text-xs space-y-1" style={{ color: B.mut }}>
                  <div>All 8 calculators + 2 deal saves. Upgrade for unlimited saves, PDF export, and sensitivity analysis.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div></div>)}
    </div>
    </ErrorBoundary>
  );
}
