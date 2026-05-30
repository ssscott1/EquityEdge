import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";

// ─── STRIPE ────────────────────────────────────────────────────────
const STRIPE_LINK = "YOUR_STRIPE_LINK_HERE";

// ─── STAMP DUTY ────────────────────────────────────────────────────
function calcStampDuty(price, state, isInvestment = true) {
  const p = +price;
  switch (state) {
    case "NSW": {
      let d = p <= 16000 ? p * 0.0125
        : p <= 35000  ? 200  + (p - 16000) * 0.015
        : p <= 93000  ? 475  + (p - 35000) * 0.0175
        : p <= 351000 ? 1490 + (p - 93000) * 0.035
        : p <= 1168000? 10530+ (p - 351000)* 0.045
        :               47295+ (p - 1168000)*0.055;
      if (isInvestment && p > 800000) d += (p - 800000) * 0.02;
      return Math.round(d);
    }
    case "VIC": {
      let d = p <= 25000  ? p * 0.014
        : p <= 130000 ? 350  + (p - 25000) * 0.024
        : p <= 960000 ? 2870 + (p - 130000)* 0.06
        :               52070+ (p - 960000) * 0.065;
      if (isInvestment) d *= 1.0;
      return Math.round(d);
    }
    case "QLD": {
      return Math.round(p <= 5000 ? 0
        : p <= 75000  ? (p - 5000) * 0.015
        : p <= 540000 ? 1050 + (p - 75000) * 0.035
        : p <= 1000000? 17325+ (p - 540000)* 0.045
        :               38025+ (p - 1000000)*0.0575);
    }
    case "WA": {
      return Math.round(p <= 80000  ? p * 0.019
        : p <= 100000 ? 1520 + (p - 80000) * 0.0285
        : p <= 250000 ? 2090 + (p - 100000)* 0.03
        : p <= 500000 ? 6590 + (p - 250000)* 0.0385
        :               16215+ (p - 500000) * 0.0475);
    }
    case "SA": {
      return Math.round(p <= 12000  ? p * 0.01
        : p <= 30000  ? 120  + (p - 12000) * 0.02
        : p <= 50000  ? 480  + (p - 30000) * 0.03
        : p <= 100000 ? 1080 + (p - 50000) * 0.035
        : p <= 200000 ? 2830 + (p - 100000)* 0.04
        : p <= 250000 ? 6830 + (p - 200000)* 0.0425
        : p <= 300000 ? 8955 + (p - 250000)* 0.0475
        :               11330+ (p - 300000) * 0.055);
    }
    default: return Math.round(p * 0.04);
  }
}

// ─── DEPRECIATION ─────────────────────────────────────────────────
function calcDepreciation(price, buildYear, propertyType) {
  const currentYear = 2026;
  const age = currentYear - buildYear;
  const buildCost = price * (propertyType === "unit" ? 0.55 : 0.40);
  const divisionB = age < 40 ? buildCost * 0.025 : 0;
  const divisionA = age <= 5 ? buildCost * 0.15 : buildCost * 0.08;
  return { divisionA: Math.round(divisionA), divisionB: Math.round(divisionB), total: Math.round(divisionA + divisionB) };
}

// ─── SERVICEABILITY ────────────────────────────────────────────────
function calcServiceability(grossIncome, existingDebt, existingRepayments, loanAmount) {
  const bufferRate = 0.09;
  const netIncome = grossIncome * 0.70;
  const existingStress = existingRepayments * 12;
  const newLoanAnnual = loanAmount * bufferRate;
  const totalCommitments = existingStress + newLoanAnnual;
  const dsr = totalCommitments / (netIncome || 1);
  const maxBorrow = Math.round((netIncome * 0.35 - existingStress) / bufferRate);
  return { dsr: Math.round(dsr * 100), maxBorrow: Math.max(0, maxBorrow), canService: dsr < 0.40 };
}

// ─── CGT ──────────────────────────────────────────────────────────
function calcCGT(purchasePrice, projectedValue, yearsHeld, marginalRate, isCompany = false) {
  const gain = projectedValue - purchasePrice;
  const discount = yearsHeld >= 1 ? 0.5 : 1.0;
  const taxableGain = gain * (isCompany ? 1.0 : discount);
  const cgtPayable = Math.round(taxableGain * (marginalRate / 100));
  const netProceeds = Math.round(projectedValue - cgtPayable - purchasePrice * 0.025);
  return { gain: Math.round(gain), taxableGain: Math.round(taxableGain), cgtPayable, netProceeds, effectiveRate: Math.round((cgtPayable / gain) * 100) };
}

// ─── RISK SCORE ────────────────────────────────────────────────────
function calcRiskScore(form, results) {
  let score = 100;
  const lvr = (results.loanAmount / +form.price) * 100;
  if (lvr > 90) score -= 25; else if (lvr > 80) score -= 15; else if (lvr > 70) score -= 8;
  if (results.weeklyNetCashflow < -200) score -= 20; else if (results.weeklyNetCashflow < 0) score -= 10;
  if (+form.vacancyRate > 5) score -= 10; else if (+form.vacancyRate > 3) score -= 5;
  if (+form.buildYear < 1990) score -= 8;
  if (+form.grossYield < 4) score -= 10; else if (+form.grossYield > 6) score += 5;
  score = Math.max(0, Math.min(100, score));
  const label = score >= 75 ? "Low Risk" : score >= 55 ? "Moderate Risk" : score >= 35 ? "Elevated Risk" : "High Risk";
  const color = score >= 75 ? "#22c55e" : score >= 55 ? "#f59e0b" : score >= 35 ? "#f97316" : "#ef4444";
  return { score, label, color };
}

// ─── CORE CALCULATIONS ─────────────────────────────────────────────
function runCalcs(form) {
  const price       = +form.price || 0;
  const deposit     = +form.deposit || 20;
  const rate        = +form.rate || 6.5;
  const rent        = +form.weeklyRent || 0;
  const expenses    = +form.annualExpenses || 0;
  const income      = +form.ownerIncome || 80000;
  const vacRate     = +form.vacancyRate || 3;
  const growthRate  = +form.growthRate || 5;
  const horizon     = +form.horizon || 10;
  const taxRate     = +form.marginalRate || 37;
  const buildYear   = +form.buildYear || 2000;

  const loanAmount      = price * (1 - deposit / 100);
  const stampDuty       = calcStampDuty(price, form.state || "VIC", true);
  const legalCosts      = Math.round(price * 0.006);
  const totalCashIn     = Math.round(price * (deposit / 100) + stampDuty + legalCosts + 2000);

  const monthlyRate     = rate / 100 / 12;
  const months          = 30 * 12;
  const monthlyRepay    = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  const annualRepay     = monthlyRepay * 12;

  const effectiveRent   = rent * 52 * (1 - vacRate / 100);
  const grossYield      = price > 0 ? (rent * 52 / price) * 100 : 0;
  const netRentalIncome = effectiveRent - expenses;
  const interestOnly    = loanAmount * (rate / 100);
  const propertyIncome  = netRentalIncome - interestOnly;
  const taxableIncome   = income + propertyIncome;
  const baseTax         = income * (taxRate / 100);
  const newTax          = taxableIncome * (taxRate / 100);
  const taxBenefit      = propertyIncome < 0 ? Math.max(0, baseTax - newTax) : 0;
  const weeklyNetCashflow = ((netRentalIncome - annualRepay + taxBenefit) / 52);
  const weeklyIOCashflow  = ((netRentalIncome - interestOnly + taxBenefit) / 52);
  const breakEvenRent   = annualRepay > 0 ? Math.round((annualRepay + expenses) / 52) : 0;

  const projections = Array.from({ length: horizon + 1 }, (_, i) => {
    const val   = price * Math.pow(1 + growthRate / 100, i);
    const debt  = loanAmount * Math.pow(1 - 0.01, i);
    const equity = val - debt;
    const cumCashflow = weeklyNetCashflow * 52 * i;
    return {
      year: i === 0 ? "Now" : `Yr ${i}`,
      value: Math.round(val),
      equity: Math.round(equity),
      cashflow: Math.round(cumCashflow),
    };
  });

  const exitValue  = projections[horizon].value;
  const depr       = calcDepreciation(price, buildYear, form.propertyType || "house");
  const cgt        = calcCGT(price, exitValue, horizon, taxRate);
  const service    = calcServiceability(income, 0, 0, loanAmount);
  const risk       = calcRiskScore(form, { loanAmount, weeklyNetCashflow, grossYield });

  return {
    price, loanAmount, stampDuty, legalCosts, totalCashIn,
    monthlyRepay: Math.round(monthlyRepay),
    annualRepay: Math.round(annualRepay),
    effectiveRent: Math.round(effectiveRent),
    grossYield: grossYield.toFixed(2),
    netYield: ((netRentalIncome / price) * 100).toFixed(2),
    netRentalIncome: Math.round(netRentalIncome),
    interestOnly: Math.round(interestOnly),
    taxBenefit: Math.round(taxBenefit),
    weeklyNetCashflow: Math.round(weeklyNetCashflow),
    weeklyIOCashflow: Math.round(weeklyIOCashflow),
    breakEvenRent, projections,
    exitValue, depr, cgt, service, risk,
    isNegativelyGeared: propertyIncome < 0,
    annualNegGearingBenefit: Math.round(taxBenefit),
  };
}

// ─── AI SUBURB INSIGHT ─────────────────────────────────────────────
async function fetchSuburbInsight(suburb, state, price) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `Search for current Australian property market data for ${suburb}, ${state}. Return a JSON object only — no markdown, no backticks — with these exact keys:
{
  "medianPrice": number (current median house/unit price in AUD),
  "medianRent": number (median weekly rent AUD),
  "vacancyRate": number (vacancy rate as percentage),
  "annualGrowth": number (12-month capital growth percentage),
  "suburbOutlook": string (2-3 sentence investment outlook),
  "keyRisks": string (1-2 sentence key risks),
  "daysOnMarket": number (average days on market),
  "rentalYield": number (median gross rental yield percentage)
}
Property price for context: $${price.toLocaleString()}. Use real current data from CoreLogic, Domain, REA, SQM Research or similar.`
        }]
      })
    });
    const data = await res.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (e) {}
  return null;
}

// ─── STYLES ───────────────────────────────────────────────────────
const S = {
  app: {
    minHeight: "100vh",
    background: "#0B0F0E",
    color: "#E8E6E0",
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    padding: "0 0 80px",
  },
  header: {
    background: "linear-gradient(135deg, #0B0F0E 0%, #111A17 100%)",
    borderBottom: "1px solid #1E2924",
    padding: "28px 40px 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    display: "flex", alignItems: "center", gap: 12,
  },
  logoMark: {
    width: 38, height: 38,
    background: "linear-gradient(135deg, #2DD4BF, #059669)",
    borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 16, fontWeight: 800, color: "#0B0F0E",
  },
  logoText: {
    fontSize: 18, fontWeight: 700, color: "#E8E6E0", letterSpacing: "-0.3px",
  },
  logoDot: { color: "#2DD4BF" },
  badge: {
    fontSize: 10, fontWeight: 700, letterSpacing: 2,
    textTransform: "uppercase", color: "#2DD4BF",
    border: "1px solid #2DD4BF33", borderRadius: 4,
    padding: "3px 10px",
  },
  wrap: { maxWidth: 1100, margin: "0 auto", padding: "0 24px" },
  hero: {
    padding: "48px 0 32px",
    borderBottom: "1px solid #1E2924",
  },
  heroLabel: {
    fontSize: 11, fontWeight: 700, letterSpacing: 3,
    textTransform: "uppercase", color: "#2DD4BF", marginBottom: 12,
  },
  heroTitle: {
    fontSize: 36, fontWeight: 800, color: "#E8E6E0",
    letterSpacing: "-0.8px", lineHeight: 1.15, marginBottom: 12,
  },
  heroSub: {
    fontSize: 14, color: "#6B7F78", lineHeight: 1.6, maxWidth: 600,
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
  formSection: {
    background: "#111A17",
    border: "1px solid #1E2924",
    borderRadius: 12,
    padding: 28,
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, letterSpacing: 3,
    textTransform: "uppercase", color: "#2DD4BF",
    marginBottom: 20, display: "flex", alignItems: "center", gap: 8,
  },
  fieldLabel: {
    fontSize: 11, fontWeight: 600, color: "#6B7F78",
    marginBottom: 6, letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  input: {
    width: "100%", background: "#0B0F0E",
    border: "1px solid #1E2924", borderRadius: 8,
    padding: "11px 14px", color: "#E8E6E0",
    fontSize: 14, fontWeight: 500, outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  select: {
    width: "100%", background: "#0B0F0E",
    border: "1px solid #1E2924", borderRadius: 8,
    padding: "11px 14px", color: "#E8E6E0",
    fontSize: 14, fontWeight: 500, outline: "none",
    boxSizing: "border-box", appearance: "none",
  },
  btn: {
    background: "linear-gradient(135deg, #2DD4BF, #059669)",
    color: "#0B0F0E", border: "none", borderRadius: 10,
    padding: "14px 32px", fontSize: 15, fontWeight: 800,
    cursor: "pointer", width: "100%", marginTop: 20,
    letterSpacing: "-0.2px",
    transition: "opacity 0.2s, transform 0.1s",
  },
  card: {
    background: "#111A17", border: "1px solid #1E2924",
    borderRadius: 12, padding: 20,
  },
  metricCard: {
    background: "#111A17", border: "1px solid #1E2924",
    borderRadius: 10, padding: "16px 18px",
  },
  metricLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: 2,
    textTransform: "uppercase", color: "#6B7F78", marginBottom: 6,
  },
  metricValue: {
    fontSize: 24, fontWeight: 800, color: "#E8E6E0",
    letterSpacing: "-0.5px", lineHeight: 1,
  },
  metricSub: {
    fontSize: 11, color: "#4A5F58", marginTop: 4,
  },
  positive: { color: "#22c55e" },
  negative: { color: "#ef4444" },
  neutral: { color: "#f59e0b" },
  divider: { borderTop: "1px solid #1E2924", margin: "20px 0" },
  paywallWrap: {
    background: "linear-gradient(180deg, #111A17 0%, #0E1812 100%)",
    border: "1px solid #2DD4BF33",
    borderRadius: 16, padding: "48px 40px",
    textAlign: "center", marginTop: 24,
    position: "relative", overflow: "hidden",
  },
  paywallTitle: {
    fontSize: 26, fontWeight: 800, color: "#E8E6E0",
    letterSpacing: "-0.5px", marginBottom: 10,
  },
  paywallSub: {
    fontSize: 14, color: "#6B7F78", marginBottom: 32, lineHeight: 1.6,
  },
  unlockBtn: {
    background: "linear-gradient(135deg, #2DD4BF, #059669)",
    color: "#0B0F0E", border: "none", borderRadius: 10,
    padding: "16px 40px", fontSize: 16, fontWeight: 800,
    cursor: "pointer", letterSpacing: "-0.3px",
    transition: "opacity 0.2s",
  },
  featureRow: {
    display: "flex", alignItems: "center", gap: 10,
    fontSize: 13, color: "#9BB5AE", marginBottom: 10, textAlign: "left",
  },
  tick: { color: "#2DD4BF", fontWeight: 800, fontSize: 15 },
  sectionHeader: {
    fontSize: 13, fontWeight: 700, color: "#9BB5AE",
    letterSpacing: 1, textTransform: "uppercase",
    marginBottom: 16, marginTop: 28, paddingBottom: 8,
    borderBottom: "1px solid #1E2924",
    display: "flex", alignItems: "center", gap: 8,
  },
  riskBar: {
    height: 8, borderRadius: 4,
    background: "#1E2924", overflow: "hidden", marginTop: 10,
  },
  aiCard: {
    background: "linear-gradient(135deg, #111A17, #0E1812)",
    border: "1px solid #2DD4BF22",
    borderRadius: 12, padding: 24, marginTop: 4,
  },
  aiLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: 2,
    textTransform: "uppercase", color: "#2DD4BF",
    marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
  },
  blurBox: {
    filter: "blur(5px)", userSelect: "none", pointerEvents: "none",
    opacity: 0.5,
  },
};

// ─── FIELD ────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <div style={S.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

// ─── FMT ──────────────────────────────────────────────────────────
const fmt = (n) => n == null ? "—" : `$${Math.abs(Math.round(n)).toLocaleString()}`;
const fmtPct = (n) => n == null ? "—" : `${n}%`;
const cfColor = (n) => n >= 0 ? "#22c55e" : "#ef4444";

// ─── METRIC CARD ──────────────────────────────────────────────────
function Metric({ label, value, sub, color, large }) {
  return (
    <div style={S.metricCard}>
      <div style={S.metricLabel}>{label}</div>
      <div style={{ ...S.metricValue, color: color || "#E8E6E0", fontSize: large ? 28 : 22 }}>{value}</div>
      {sub && <div style={S.metricSub}>{sub}</div>}
    </div>
  );
}

// ─── FREEMIUM SUMMARY ─────────────────────────────────────────────
function FreemiumSummary({ results, form }) {
  const { price, stampDuty, legalCosts, totalCashIn, grossYield } = results;
  return (
    <div style={{ marginTop: 24 }}>
      <div style={S.sectionHeader}>
        <span>📊</span> Deal Summary
      </div>
      <div style={{ ...S.grid3, marginBottom: 16 }}>
        <Metric label="Purchase Price" value={fmt(price)} sub="Your entered price" />
        <Metric label="Stamp Duty" value={fmt(stampDuty)} sub={`${form.state || "VIC"} investment rate`} />
        <Metric label="Total Cash Required" value={fmt(totalCashIn)} sub="Deposit + stamp duty + legals" color="#2DD4BF" large />
      </div>
      <div style={S.grid2}>
        <Metric label="Legal & Conveyancing Est." value={fmt(legalCosts)} sub="~0.6% estimate" />
        <Metric label="Gross Rental Yield" value={`${grossYield}%`} sub="Annual rent ÷ purchase price" color={+grossYield >= 5 ? "#22c55e" : +grossYield >= 4 ? "#f59e0b" : "#ef4444"} />
      </div>
      <div style={{ ...S.card, marginTop: 16, background: "#0E1812", border: "1px solid #2DD4BF22" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#2DD4BF", marginBottom: 4 }}>ℹ️ Free Tier</div>
        <div style={{ fontSize: 13, color: "#6B7F78", lineHeight: 1.6 }}>
          You're viewing the free summary. Unlock the full report for $20 to see cashflow analysis, 10-year projections, tax breakdown, depreciation schedule, CGT estimate, serviceability, risk score, and AI-powered suburb insights.
        </div>
      </div>
    </div>
  );
}

// ─── PAYWALL ──────────────────────────────────────────────────────
function Paywall({ onSimulate }) {
  const features = [
    "After-tax weekly cashflow (P&I and interest-only)",
    "Negative gearing tax benefit breakdown",
    "Break-even rent calculation",
    "Net yield vs gross yield comparison",
    "10-year equity & cashflow projection chart",
    "Depreciation schedule (Div 40 + Div 43 estimate)",
    "Capital gains tax estimate on exit",
    "Debt serviceability & max borrowing power",
    "Risk score & deal rating (0–100)",
    "AI-powered suburb market context (live data)",
    "Rent vs. buy comparison analysis",
  ];
  return (
    <div style={S.paywallWrap}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, #2DD4BF08 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#2DD4BF", marginBottom: 12 }}>
        Full Investment Analysis
      </div>
      <div style={S.paywallTitle}>Unlock Your Complete Deal Report</div>
      <div style={S.paywallSub}>
        Everything a serious property investor needs — in one comprehensive report.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", maxWidth: 560, margin: "0 auto 32px", textAlign: "left" }}>
        {features.map((f, i) => (
          <div key={i} style={S.featureRow}>
            <span style={S.tick}>✓</span> {f}
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 38, fontWeight: 900, color: "#E8E6E0", letterSpacing: "-1px" }}>$20</span>
        <span style={{ fontSize: 14, color: "#6B7F78", marginLeft: 6 }}>one-time · instant unlock</span>
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <button style={S.unlockBtn} onClick={() => window.open(STRIPE_LINK, "_blank")}>
          Unlock Full Report — $20
        </button>
        <button style={{ ...S.unlockBtn, background: "transparent", color: "#2DD4BF", border: "1px solid #2DD4BF44" }} onClick={onSimulate}>
          Preview (Demo)
        </button>
      </div>
      <div style={{ fontSize: 11, color: "#4A5F58", marginTop: 16 }}>Secure payment via Stripe · Instant access · No subscription</div>
    </div>
  );
}

// ─── FULL REPORT ──────────────────────────────────────────────────
function FullReport({ results, form, suburbData, suburbLoading }) {
  const r = results;
  const projection10 = r.projections[r.projections.length - 1];

  return (
    <div style={{ marginTop: 28 }}>

      {/* CASHFLOW */}
      <div style={S.sectionHeader}><span>💸</span> Cashflow Analysis</div>
      <div style={S.grid4}>
        <Metric label="Weekly Cashflow (P&I)" value={`${r.weeklyNetCashflow >= 0 ? "+" : ""}${fmt(r.weeklyNetCashflow)}`} sub="After tax, all costs" color={cfColor(r.weeklyNetCashflow)} large />
        <Metric label="Weekly Cashflow (IO)" value={`${r.weeklyIOCashflow >= 0 ? "+" : ""}${fmt(r.weeklyIOCashflow)}`} sub="Interest-only scenario" color={cfColor(r.weeklyIOCashflow)} />
        <Metric label="Break-even Rent" value={`${fmt(r.breakEvenRent)}/wk`} sub="To cover all P&I costs" />
        <Metric label="Net Rental Yield" value={`${r.netYield}%`} sub="After expenses" color={+r.netYield >= 4 ? "#22c55e" : "#f59e0b"} />
      </div>

      {/* TAX */}
      <div style={S.sectionHeader}><span>🧾</span> Tax Breakdown</div>
      <div style={S.grid3}>
        <Metric label="Annual Interest Cost" value={fmt(r.interestOnly)} sub="At current rate" />
        <Metric label={r.isNegativelyGeared ? "Neg. Gearing Benefit" : "Rental Surplus"} value={fmt(r.annualNegGearingBenefit)} sub={r.isNegativelyGeared ? `${form.marginalRate || 37}% marginal rate` : "Positively geared"} color={r.isNegativelyGeared ? "#22c55e" : "#2DD4BF"} />
        <Metric label="Monthly Repayment (P&I)" value={fmt(r.monthlyRepay)} sub="Principal & interest" />
      </div>

      {/* DEPRECIATION */}
      <div style={S.sectionHeader}><span>🏗️</span> Depreciation Schedule Estimate</div>
      <div style={S.grid3}>
        <Metric label="Division 43 (Building)" value={fmt(r.depr.divisionB)} sub="2.5% p.a. construction write-off" color="#2DD4BF" />
        <Metric label="Division 40 (Plant & Fittings)" value={fmt(r.depr.divisionA)} sub="Fixtures, appliances, carpets" color="#2DD4BF" />
        <Metric label="Total Annual Deduction" value={fmt(r.depr.total)} sub={`≈ ${fmt(r.depr.total * (+form.marginalRate || 37) / 100)}/yr tax saving`} color="#22c55e" />
      </div>
      <div style={{ ...S.card, marginTop: 8, background: "#0B0F0E", border: "1px solid #1E2924", fontSize: 12, color: "#6B7F78", lineHeight: 1.6 }}>
        ⚠️ Estimates only. A quantity surveyor report (ATO-compliant) is required for ATO claims. Buildings pre-1987 attract no Div 43. New properties attract higher Div 40. These figures are indicative based on the build year and property type entered.
      </div>

      {/* CGT */}
      <div style={S.sectionHeader}><span>📈</span> Capital Gains Tax (Exit Analysis)</div>
      <div style={S.grid4}>
        <Metric label="Projected Value" value={fmt(r.exitValue)} sub={`In ${form.horizon || 10} years at ${form.growthRate || 5}% p.a.`} color="#2DD4BF" />
        <Metric label="Capital Gain" value={fmt(r.cgt.gain)} sub="Gross profit on exit" />
        <Metric label="Taxable Gain (50% disc.)" value={fmt(r.cgt.taxableGain)} sub="After CGT discount (≥12 months)" />
        <Metric label="Est. CGT Payable" value={fmt(r.cgt.cgtPayable)} sub={`At ${form.marginalRate || 37}% marginal rate`} color="#ef4444" />
      </div>
      <div style={{ ...S.grid2, marginTop: 12 }}>
        <Metric label="Net Proceeds (After CGT)" value={fmt(r.cgt.netProceeds)} sub="After CGT + ~2.5% selling costs" color="#22c55e" large />
        <Metric label="Effective CGT Rate on Gain" value={`${r.cgt.effectiveRate}%`} sub="Total CGT ÷ total gain" />
      </div>
      <div style={{ ...S.card, marginTop: 8, background: "#0B0F0E", border: "1px solid #1E2924", fontSize: 12, color: "#6B7F78", lineHeight: 1.6 }}>
        ⚠️ Assumes 50% CGT discount (asset held 12+ months, individual taxpayer). SMSF and company structures have different rates. This is a general estimate — consult your accountant for personalised advice.
      </div>

      {/* SERVICEABILITY */}
      <div style={S.sectionHeader}><span>🏦</span> Debt Serviceability</div>
      <div style={S.grid3}>
        <Metric label="Est. Max Borrowing Power" value={fmt(r.service.maxBorrow)} sub="Based on 9% buffer rate (APRA)" color="#2DD4BF" large />
        <Metric label="Debt Service Ratio" value={`${r.service.dsr}%`} sub="Of net income (< 40% is comfortable)" color={r.service.dsr <= 35 ? "#22c55e" : r.service.dsr <= 45 ? "#f59e0b" : "#ef4444"} />
        <Metric label="Serviceability" value={r.service.canService ? "✓ Serviceable" : "✗ Tight"} sub={r.service.canService ? "Within normal lender parameters" : "May need to reduce loan or boost income"} color={r.service.canService ? "#22c55e" : "#ef4444"} />
      </div>
      <div style={{ ...S.card, marginTop: 8, background: "#0B0F0E", border: "1px solid #1E2924", fontSize: 12, color: "#6B7F78", lineHeight: 1.6 }}>
        ℹ️ APRA requires lenders to test serviceability at a minimum 3% above the loan rate. Max borrowing power is an estimate based on income entered and a 35% DSR ceiling. It does not account for HECs debt, other liabilities, living expenses, or individual lender policies. Use as a guide only.
      </div>

      {/* RENT VS BUY */}
      <div style={S.sectionHeader}><span>🔄</span> Rent vs. Buy Comparison</div>
      <div style={S.grid3}>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>Annual Cost to Own</div>
          <div style={{ ...S.metricValue, fontSize: 20, color: "#ef4444" }}>{fmt(r.annualRepay + (+form.annualExpenses || 0))}</div>
          <div style={S.metricSub}>P&I repayments + running costs</div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>Annual Rental Income</div>
          <div style={{ ...S.metricValue, fontSize: 20, color: "#22c55e" }}>{fmt(r.effectiveRent)}</div>
          <div style={S.metricSub}>After vacancy allowance</div>
        </div>
        <div style={S.metricCard}>
          <div style={S.metricLabel}>10-Yr Equity Created</div>
          <div style={{ ...S.metricValue, fontSize: 20, color: "#2DD4BF" }}>{fmt(projection10.equity - results.loanAmount * (1 - results.price / (results.price || 1)))}</div>
          <div style={S.metricSub}>vs renting equivalent property</div>
        </div>
      </div>
      <div style={{ ...S.card, marginTop: 12, background: "#0B0F0E", border: "1px solid #1E2924" }}>
        <div style={{ fontSize: 12, color: "#9BB5AE", lineHeight: 1.7 }}>
          <strong style={{ color: "#E8E6E0" }}>Buying vs renting equivalent:</strong> Owning this property as an investment creates projected equity of {fmt(projection10.equity)} in {form.horizon || 10} years. After CGT on exit, net proceeds are estimated at {fmt(r.cgt.netProceeds)}. The annual cost to own ({fmt(r.annualRepay + (+form.annualExpenses || 0))}) is partially offset by rental income ({fmt(r.effectiveRent)}) and tax benefits ({fmt(r.annualNegGearingBenefit)}), resulting in a {r.weeklyNetCashflow >= 0 ? "net positive" : "net negative"} weekly cashflow of {fmt(Math.abs(r.weeklyNetCashflow))}/wk.
        </div>
      </div>

      {/* RISK SCORE */}
      <div style={S.sectionHeader}><span>⚡</span> Risk Score & Deal Rating</div>
      <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
        <div style={{ ...S.card, flexShrink: 0, width: 200, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 64, fontWeight: 900, color: r.risk.color, lineHeight: 1, letterSpacing: "-2px" }}>{r.risk.score}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: r.risk.color, marginTop: 6 }}>{r.risk.label}</div>
          <div style={S.riskBar}>
            <div style={{ height: "100%", width: `${r.risk.score}%`, background: r.risk.color, borderRadius: 4, transition: "width 1s ease" }} />
          </div>
          <div style={{ fontSize: 10, color: "#4A5F58", marginTop: 8 }}>out of 100</div>
        </div>
        <div style={{ ...S.card, flex: 1 }}>
          <div style={{ fontSize: 12, color: "#9BB5AE", lineHeight: 1.8 }}>
            {[
              { label: "LVR", val: `${Math.round((r.loanAmount / results.price) * 100)}%`, ok: (r.loanAmount / results.price) <= 0.8 },
              { label: "Weekly Cashflow", val: `${r.weeklyNetCashflow >= 0 ? "+" : ""}${fmt(r.weeklyNetCashflow)}/wk`, ok: r.weeklyNetCashflow >= -100 },
              { label: "Gross Yield", val: `${r.grossYield}%`, ok: +r.grossYield >= 4.5 },
              { label: "Vacancy Rate", val: `${form.vacancyRate || 3}%`, ok: +form.vacancyRate <= 3 },
              { label: "Property Age", val: `${2026 - (+form.buildYear || 2000)} years`, ok: 2026 - (+form.buildYear || 2000) < 20 },
              { label: "Serviceability", val: r.service.canService ? "Pass" : "Tight", ok: r.service.canService },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #1E2924" }}>
                <span style={{ color: "#6B7F78" }}>{item.label}</span>
                <span style={{ fontWeight: 700, color: item.ok ? "#22c55e" : "#ef4444" }}>
                  {item.ok ? "✓" : "✗"} {item.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI SUBURB */}
      <div style={S.sectionHeader}><span>🤖</span> AI Suburb Market Intelligence</div>
      <div style={S.aiCard}>
        <div style={S.aiLabel}>
          <span>◈</span> Live Market Data — {form.suburb || "Suburb"}, {form.state || "VIC"}
        </div>
        {suburbLoading ? (
          <div style={{ color: "#6B7F78", fontSize: 13, padding: "16px 0" }}>
            <span style={{ color: "#2DD4BF" }}>⟳</span> Searching live market data for {form.suburb || "your suburb"}...
          </div>
        ) : suburbData ? (
          <>
            <div style={S.grid4}>
              {[
                { label: "Median Price", value: fmt(suburbData.medianPrice) },
                { label: "Median Weekly Rent", value: `${fmt(suburbData.medianRent)}/wk` },
                { label: "Vacancy Rate", value: `${suburbData.vacancyRate}%`, color: suburbData.vacancyRate <= 2 ? "#22c55e" : "#f59e0b" },
                { label: "12-Month Growth", value: `${suburbData.annualGrowth}%`, color: suburbData.annualGrowth > 0 ? "#22c55e" : "#ef4444" },
              ].map((m, i) => (
                <div key={i} style={{ padding: "12px 0", borderBottom: "1px solid #1E2924" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#4A5F58", marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: m.color || "#E8E6E0" }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ ...S.divider, margin: "16px 0" }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2DD4BF", marginBottom: 6 }}>Market Outlook</div>
            <div style={{ fontSize: 13, color: "#9BB5AE", lineHeight: 1.7, marginBottom: 12 }}>{suburbData.suburbOutlook}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>Key Risks</div>
            <div style={{ fontSize: 13, color: "#9BB5AE", lineHeight: 1.7, marginBottom: 12 }}>{suburbData.keyRisks}</div>
            <div style={{ display: "flex", gap: 24 }}>
              <span style={{ fontSize: 12, color: "#6B7F78" }}>Days on Market: <strong style={{ color: "#E8E6E0" }}>{suburbData.daysOnMarket}</strong></span>
              <span style={{ fontSize: 12, color: "#6B7F78" }}>Suburb Gross Yield: <strong style={{ color: "#E8E6E0" }}>{suburbData.rentalYield}%</strong></span>
            </div>
          </>
        ) : (
          <div style={{ color: "#6B7F78", fontSize: 13, padding: "8px 0" }}>
            {form.suburb ? "Could not load live suburb data. Check suburb name and try again." : "Enter a suburb above to load live market context."}
          </div>
        )}
      </div>

      {/* 10-YEAR PROJECTION */}
      <div style={S.sectionHeader}><span>📊</span> 10-Year Projection</div>
      <div style={S.grid3}>
        <Metric label="Projected Value" value={fmt(projection10.value)} sub={`In ${form.horizon || 10} years at ${form.growthRate || 5}% p.a.`} color="#2DD4BF" large />
        <Metric label="Projected Equity" value={fmt(projection10.equity)} sub="Value minus remaining loan" color="#22c55e" large />
        <Metric label="Cumulative Cashflow" value={`${projection10.cashflow >= 0 ? "+" : ""}${fmt(projection10.cashflow)}`} sub="Total net cashflow over period" color={cfColor(projection10.cashflow)} large />
      </div>
      <div style={{ height: 240, marginTop: 20 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={r.projections} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2DD4BF" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2DD4BF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2924" />
            <XAxis dataKey="year" tick={{ fill: "#4A5F58", fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fill: "#4A5F58", fontSize: 11 }} />
            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: "#111A17", border: "1px solid #1E2924", borderRadius: 8, color: "#E8E6E0" }} />
            <Area type="monotone" dataKey="value" name="Property Value" stroke="#2DD4BF" strokeWidth={2} fill="url(#gv)" />
            <Area type="monotone" dataKey="equity" name="Your Equity" stroke="#22c55e" strokeWidth={2} fill="url(#ge)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* DISCLAIMER */}
      <div style={{ ...S.card, marginTop: 24, background: "#0B0F0E", border: "1px solid #1E2924" }}>
        <div style={{ fontSize: 11, color: "#4A5F58", lineHeight: 1.7 }}>
          <strong style={{ color: "#6B7F78" }}>General information only.</strong> This report is an estimate based on the inputs you provided and does not constitute financial, tax, or legal advice. Projections are not guaranteed. Property values, rental income, and tax rules can all change materially. Always consult a licensed financial adviser, accountant, and solicitor before making investment decisions.
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────
export default function App() {
  const [form, setForm] = useState({
    price: "", deposit: "20", rate: "6.5", weeklyRent: "",
    annualExpenses: "", ownerIncome: "100000", vacancyRate: "3",
    growthRate: "6", horizon: "10", state: "VIC", suburb: "",
    buildYear: "2005", propertyType: "house", marginalRate: "37",
  });
  const [results, setResults]         = useState(null);
  const [paid, setPaid]               = useState(false);
  const [suburbData, setSuburbData]   = useState(null);
  const [suburbLoading, setSuburbLoading] = useState(false);
  const [hasAnalysed, setHasAnalysed] = useState(false);
  const resultsRef = useRef(null);

  // detect Stripe return
  useEffect(() => {
    if (window.location.search.includes("paid=true")) setPaid(true);
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const analyse = async () => {
    if (!form.price || !form.weeklyRent) return;
    const r = runCalcs(form);
    setResults(r);
    setHasAnalysed(true);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    if (paid && form.suburb) {
      setSuburbLoading(true);
      setSuburbData(null);
      const d = await fetchSuburbInsight(form.suburb, form.state, +form.price);
      setSuburbData(d);
      setSuburbLoading(false);
    }
  };

  const inputStyle = (focused) => ({
    ...S.input,
    borderColor: focused ? "#2DD4BF44" : "#1E2924",
  });

  return (
    <div style={S.app}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logo}>
          <div style={S.logoMark}>E</div>
          <div>
            <div style={S.logoText}>Equity<span style={S.logoDot}>Edge</span></div>
            <div style={{ fontSize: 10, color: "#4A5F58", letterSpacing: 1 }}>PROPERTY INVESTMENT ANALYSER</div>
          </div>
        </div>
        <div style={S.badge}>Deal Analyser</div>
      </div>

      <div style={S.wrap}>
        {/* HERO */}
        <div style={S.hero}>
          <div style={S.heroLabel}>Australian Property Investment</div>
          <div style={S.heroTitle}>Analyse any deal.<br />In seconds.</div>
          <div style={S.heroSub}>
            Enter your property's numbers and get an instant snapshot — free. Unlock the comprehensive investment report for $20 and get everything a serious investor needs to make a confident decision.
          </div>
        </div>

        {/* FORM */}
        <div style={S.formSection}>
          <div style={S.sectionTitle}><span>🏠</span> Property Details</div>
          <div style={{ ...S.grid3, marginBottom: 16 }}>
            <Field label="Purchase Price">
              <input style={S.input} type="number" placeholder="750000" value={form.price} onChange={set("price")} />
            </Field>
            <Field label="State">
              <select style={S.select} value={form.state} onChange={set("state")}>
                {["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"].map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Suburb">
              <input style={S.input} placeholder="e.g. Glen Waverley" value={form.suburb} onChange={set("suburb")} />
            </Field>
          </div>
          <div style={{ ...S.grid4, marginBottom: 16 }}>
            <Field label="Property Type">
              <select style={S.select} value={form.propertyType} onChange={set("propertyType")}>
                <option value="house">House</option>
                <option value="unit">Unit / Apartment</option>
                <option value="townhouse">Townhouse</option>
              </select>
            </Field>
            <Field label="Build Year">
              <input style={S.input} type="number" placeholder="2005" value={form.buildYear} onChange={set("buildYear")} />
            </Field>
            <Field label="Deposit (%)">
              <input style={S.input} type="number" placeholder="20" value={form.deposit} onChange={set("deposit")} />
            </Field>
            <Field label="Interest Rate (%)">
              <input style={S.input} type="number" placeholder="6.5" value={form.rate} onChange={set("rate")} />
            </Field>
          </div>

          <div style={{ ...S.divider }} />
          <div style={S.sectionTitle}><span>💰</span> Rental & Costs</div>
          <div style={{ ...S.grid3, marginBottom: 16 }}>
            <Field label="Weekly Rent ($)">
              <input style={S.input} type="number" placeholder="600" value={form.weeklyRent} onChange={set("weeklyRent")} />
            </Field>
            <Field label="Vacancy Rate (%)">
              <input style={S.input} type="number" placeholder="3" value={form.vacancyRate} onChange={set("vacancyRate")} />
            </Field>
            <Field label="Annual Expenses ($)">
              <input style={S.input} type="number" placeholder="8000" value={form.annualExpenses} onChange={set("annualExpenses")} />
            </Field>
          </div>

          <div style={{ ...S.divider }} />
          <div style={S.sectionTitle}><span>👤</span> Your Financial Position</div>
          <div style={{ ...S.grid4, marginBottom: 4 }}>
            <Field label="Gross Annual Income ($)">
              <input style={S.input} type="number" placeholder="100000" value={form.ownerIncome} onChange={set("ownerIncome")} />
            </Field>
            <Field label="Marginal Tax Rate (%)">
              <select style={S.select} value={form.marginalRate} onChange={set("marginalRate")}>
                <option value="19">19%</option>
                <option value="32.5">32.5%</option>
                <option value="37">37%</option>
                <option value="45">45%</option>
              </select>
            </Field>
            <Field label="Growth Assumption (%)">
              <input style={S.input} type="number" placeholder="6" value={form.growthRate} onChange={set("growthRate")} />
            </Field>
            <Field label="Projection Horizon (yrs)">
              <input style={S.input} type="number" placeholder="10" value={form.horizon} onChange={set("horizon")} />
            </Field>
          </div>

          <button style={S.btn} onClick={analyse}>
            Analyse This Deal →
          </button>
        </div>

        {/* RESULTS */}
        {hasAnalysed && results && (
          <div ref={resultsRef}>
            <FreemiumSummary results={results} form={form} />

            {!paid ? (
              <Paywall onSimulate={() => setPaid(true)} />
            ) : (
              <FullReport results={results} form={form} suburbData={suburbData} suburbLoading={suburbLoading} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}