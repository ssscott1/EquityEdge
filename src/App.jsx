import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

// ═══════════════════════════════════════════════════════════════════
// CONFIG — paste your Stripe links here once ready
// ═══════════════════════════════════════════════════════════════════
const STRIPE_DEAL_LINK      = "YOUR_STRIPE_DEAL_LINK_HERE";       // $20 deal report
const STRIPE_PORTFOLIO_LINK = "YOUR_STRIPE_PORTFOLIO_LINK_HERE";  // $49 portfolio unlock

// ═══════════════════════════════════════════════════════════════════
// STAMP DUTY  (progressive brackets per state, investment property)
// ═══════════════════════════════════════════════════════════════════
function stampDuty(price, state) {
  const p = +price;
  if (state === "NSW") {
    if (p <= 16000)   return p * 0.0125;
    if (p <= 35000)   return 200  + (p - 16000)  * 0.015;
    if (p <= 93000)   return 475  + (p - 35000)  * 0.0175;
    if (p <= 351000)  return 1490 + (p - 93000)  * 0.035;
    if (p <= 1168000) return 10530 + (p - 351000) * 0.045;
    return 47295 + (p - 1168000) * 0.055;
  }
  if (state === "VIC") {
    if (p <= 25000)  return p * 0.014;
    if (p <= 130000) return 350  + (p - 25000)  * 0.024;
    if (p <= 960000) return 2870 + (p - 130000) * 0.06;
    return 52670 + (p - 960000) * 0.065;
  }
  if (state === "QLD") {
    if (p <= 5000)    return 0;
    if (p <= 75000)   return (p - 5000)  * 0.015;
    if (p <= 540000)  return 1050  + (p - 75000)  * 0.035;
    if (p <= 1000000) return 17325 + (p - 540000) * 0.045;
    return 38025 + (p - 1000000) * 0.0575;
  }
  if (state === "WA") {
    if (p <= 80000)  return p * 0.019;
    if (p <= 100000) return 1520 + (p - 80000)  * 0.0285;
    if (p <= 250000) return 2090 + (p - 100000) * 0.0385;
    if (p <= 500000) return 7865 + (p - 250000) * 0.0475;
    return 19740 + (p - 500000) * 0.051;
  }
  if (state === "SA") {
    if (p <= 12000)  return p * 0.01;
    if (p <= 30000)  return 120  + (p - 12000)  * 0.02;
    if (p <= 50000)  return 480  + (p - 30000)  * 0.03;
    if (p <= 100000) return 1080 + (p - 50000)  * 0.035;
    if (p <= 200000) return 2830 + (p - 100000) * 0.04;
    if (p <= 250000) return 6830 + (p - 200000) * 0.0425;
    if (p <= 300000) return 8955 + (p - 250000) * 0.045;
    if (p <= 500000) return 11205 + (p - 300000) * 0.05;
    return 21205 + (p - 500000) * 0.055;
  }
  if (state === "TAS") {
    if (p <= 3000)   return 50;
    if (p <= 25000)  return 50   + (p - 3000)   * 0.0175;
    if (p <= 75000)  return 435  + (p - 25000)  * 0.025;
    if (p <= 200000) return 1685 + (p - 75000)  * 0.03;
    if (p <= 375000) return 5435 + (p - 200000) * 0.035;
    if (p <= 725000) return 11560 + (p - 375000) * 0.04;
    return 25560 + (p - 725000) * 0.045;
  }
  return p * 0.046; // ACT / NT approximation
}

// ═══════════════════════════════════════════════════════════════════
// DEAL CALCULATIONS
// ═══════════════════════════════════════════════════════════════════
function calcDeal(f) {
  const price        = +f.price;
  const loan         = price * (1 - +f.deposit / 100);
  const annualInt    = loan * (+f.interestRate / 100);
  const annualRent   = +f.weeklyRent * 52;
  const effRent      = annualRent * (1 - +f.mgmtFee / 100);
  const maint        = +f.maintenance;
  const depr         = +f.depreciation;
  const taxRate      = +f.taxRate / 100;
  const growth       = +f.growthRate / 100;
  const netRental    = effRent - maint;
  const taxableInc   = netRental - annualInt - depr;
  const taxBenefit   = taxableInc < 0 ? Math.abs(taxableInc) * taxRate : 0;
  const taxPayable   = taxableInc > 0 ? taxableInc * taxRate : 0;
  const annualCF     = netRental - annualInt + taxBenefit - taxPayable;
  const duty         = stampDuty(price, f.state);
  const cashRequired = price * (+f.deposit / 100) + duty + 2000;
  const breakEven    = (maint + annualInt) / (52 * (1 - +f.mgmtFee / 100));
  const projection   = Array.from({ length: 10 }, (_, i) => {
    const yr  = i + 1;
    const val = price * (1 + growth) ** yr;
    return {
      year: `Yr ${yr}`,
      "Value ($k)":    Math.round(val / 1000),
      "Equity ($k)":   Math.round((val - loan) / 1000),
      "Cashflow ($k)": Math.round((annualCF * yr) / 1000),
    };
  });
  return {
    loan, annualInt, annualRent, effRent, netRental, taxableInc,
    taxBenefit, taxPayable, annualCF, duty, cashRequired, breakEven, projection,
    weeklyCF:        annualCF / 52,
    grossYield:      (annualRent / price) * 100,
    netYield:        (netRental / price) * 100,
    negativelyGeared: taxableInc < 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
// FORMATTERS
// ═══════════════════════════════════════════════════════════════════
const aud = (n) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency", currency: "AUD", maximumFractionDigits: 0,
  }).format(n);
const pct   = (n) => `${Number(n).toFixed(2)}%`;

// ═══════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════
const DEFAULT_FORM = {
  state: "VIC", price: "650000", deposit: "20", interestRate: "6.5",
  weeklyRent: "550", mgmtFee: "8", maintenance: "3000",
  depreciation: "5000", taxRate: "37", growthRate: "6",
};
const BLANK_PROP = { name: "", value: "", loan: "", rate: "6.5", weeklyRent: "" };

// ═══════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #080f1a; }
  input, select {
    background: #101d31; border: 1px solid #1e3252; color: #ede8de;
    padding: 10px 12px; border-radius: 8px; width: 100%;
    font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  input:focus, select:focus {
    border-color: #c9963b;
    box-shadow: 0 0 0 3px rgba(201,150,59,0.12);
  }
  select option { background: #101d31; }
  input::placeholder { color: #4d6580; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: #080f1a; }
  ::-webkit-scrollbar-thumb { background: #1e3252; border-radius: 3px; }
  .recharts-text { fill: #5a7898 !important; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11px; }
  .recharts-cartesian-grid line { stroke: #1a2e4a; }
`;

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [tab,            setTab]           = useState("analyser");
  const [form,           setForm]          = useState(DEFAULT_FORM);
  const [results,        setResults]       = useState(null);
  const [paidDeal,       setPaidDeal]      = useState(true);
  const [paidPortfolio,  setPaidPortfolio] = useState(true);
  const [properties,     setProperties]    = useState([]);
  const [showAdd,        setShowAdd]       = useState(false);
  const [newProp,        setNewProp]       = useState(BLANK_PROP);
  const [income,         setIncome]        = useState("120000");
  const [targetPrice,    setTargetPrice]   = useState("700000");

  // Detect Stripe redirect ?paid=true / ?portfolio_paid=true
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("paid") === "true")            setPaidDeal(true);
    if (p.get("portfolio_paid") === "true")  setPaidPortfolio(true);
  }, []);

  const onFieldChange  = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const onCalculate    = ()  => setResults(calcDeal(form));

  // Portfolio totals
  const totalValue    = properties.reduce((s, p) => s + +p.value, 0);
  const totalLoan     = properties.reduce((s, p) => s + +p.loan, 0);
  const totalEquity   = totalValue - totalLoan;
  const avgLVR        = totalValue > 0 ? (totalLoan / totalValue) * 100 : 0;
  const weeklyRentAll = properties.reduce((s, p) => s + +p.weeklyRent, 0);
  const weeklyIntAll  = properties.reduce((s, p) => s + (+p.loan * +p.rate / 100 / 52), 0);
  const weeklyNetCF   = weeklyRentAll * 0.92 - weeklyIntAll;

  // Next purchase
  const usableEquity      = totalValue * 0.8 - totalLoan;
  const borrowingCapacity = +income * 6;
  const depositNeeded     = +targetPrice * 0.2;
  const canBuy            = usableEquity >= depositNeeded && borrowingCapacity >= +targetPrice * 0.8;
  const equityGap         = Math.max(0, depositNeeded - usableEquity);

  const addProperty = () => {
    if (!newProp.name || !newProp.value || !newProp.loan) return;
    setProperties(ps => [...ps, { ...newProp, id: Date.now() }]);
    setNewProp(BLANK_PROP);
    setShowAdd(false);
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#080f1a", minHeight: "100vh", color: "#ede8de" }}>
      <style>{CSS}</style>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header style={{
        background: "linear-gradient(180deg,#0a1728 0%,#080f1a 100%)",
        borderBottom: "1px solid #1a2e4a", padding: "24px 24px 0",
      }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 38, height: 38,
              background: "linear-gradient(135deg,#c9963b,#e8b84b)",
              borderRadius: 9, display: "flex", alignItems: "center",
              justifyContent: "center", fontWeight: 800, fontSize: 19, color: "#080f1a",
              fontFamily: "'DM Serif Display', serif",
            }}>E</div>
            <span style={{
              fontFamily: "'DM Serif Display', serif", fontSize: 28,
              letterSpacing: "-0.5px", color: "#ede8de",
            }}>EquityEdge</span>
          </div>
          <p style={{ color: "#4d6580", fontSize: 13, marginBottom: 22, marginLeft: 50 }}>
            Australian Property Investment Intelligence
          </p>

          {/* Tab Nav */}
          <div style={{ display: "flex", gap: 3 }}>
            {[["analyser","Deal Analyser"],["portfolio","My Portfolio"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: "10px 22px", border: "none", cursor: "pointer",
                background:    tab === id ? "#080f1a"    : "transparent",
                color:         tab === id ? "#c9963b"    : "#4d6580",
                borderRadius:  "8px 8px 0 0",
                borderTop:     tab === id ? "1px solid #1a2e4a" : "1px solid transparent",
                borderLeft:    tab === id ? "1px solid #1a2e4a" : "1px solid transparent",
                borderRight:   tab === id ? "1px solid #1a2e4a" : "1px solid transparent",
                fontFamily: "inherit", fontSize: 14, fontWeight: 600,
                position: "relative", bottom: -1, transition: "all 0.2s",
              }}>
                {label}
                {id === "portfolio" && !paidPortfolio && (
                  <span style={{
                    marginLeft: 7, background: "#c9963b", color: "#080f1a",
                    fontSize: 9, fontWeight: 800, padding: "2px 7px",
                    borderRadius: 10, letterSpacing: 0.5,
                  }}>PRO</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── MAIN ───────────────────────────────────────────── */}
      <main style={{ maxWidth: 920, margin: "0 auto", padding: "36px 24px 60px" }}>

        {/* ══ DEAL ANALYSER TAB ══ */}
        {tab === "analyser" && (
          <>
            <SectionHeader
              title="Deal Analyser"
              sub="Enter your property numbers. Your gross yield is free — unlock the full report for the complete picture."
            />

            {/* Form grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20, marginBottom: 28 }}>
              <Card title="Property Details">
                <Field label="State">
                  <select name="state" value={form.state} onChange={onFieldChange}>
                    {["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Purchase Price ($)">
                  <PrefixInput prefix="$" name="price" value={form.price} onChange={onFieldChange} placeholder="650000" />
                </Field>
                <Field label="Deposit (%)">
                  <input name="deposit" value={form.deposit} onChange={onFieldChange} type="number" placeholder="20" />
                </Field>
                <Field label="Interest Rate (%)">
                  <input name="interestRate" value={form.interestRate} onChange={onFieldChange} type="number" step="0.1" placeholder="6.5" />
                </Field>
              </Card>

              <Card title="Rental Income & Costs">
                <Field label="Weekly Rent ($)">
                  <PrefixInput prefix="$" name="weeklyRent" value={form.weeklyRent} onChange={onFieldChange} placeholder="550" />
                </Field>
                <Field label="Property Management Fee (%)">
                  <input name="mgmtFee" value={form.mgmtFee} onChange={onFieldChange} type="number" step="0.5" placeholder="8" />
                </Field>
                <Field label="Annual Maintenance & Insurance ($)">
                  <PrefixInput prefix="$" name="maintenance" value={form.maintenance} onChange={onFieldChange} placeholder="3000" />
                </Field>
                <Field label="Annual Depreciation Estimate ($)">
                  <PrefixInput prefix="$" name="depreciation" value={form.depreciation} onChange={onFieldChange} placeholder="5000" />
                </Field>
              </Card>

              <Card title="Tax & Growth">
                <Field label="Marginal Tax Rate">
                  <select name="taxRate" value={form.taxRate} onChange={onFieldChange}>
                    <option value="0">0% — No income tax</option>
                    <option value="19">19% — Up to $45,000</option>
                    <option value="32.5">32.5% — $45k – $120k</option>
                    <option value="37">37% — $120k – $180k</option>
                    <option value="45">45% — Over $180k</option>
                  </select>
                </Field>
                <Field label="Assumed Annual Capital Growth (%)">
                  <input name="growthRate" value={form.growthRate} onChange={onFieldChange} type="number" step="0.5" placeholder="6" />
                </Field>
                <div style={{
                  background: "#0a1525", borderRadius: 8, padding: "12px 14px",
                  border: "1px solid #1a2e4a", marginTop: 4,
                }}>
                  <p style={{ fontSize: 12, color: "#4d6580", lineHeight: 1.6 }}>
                    💡 Depreciation reduces your taxable income. Ask your accountant for a quantity surveyor's report for an accurate figure.
                  </p>
                </div>
              </Card>
            </div>

            <button onClick={onCalculate} style={{
              width: "100%", padding: "17px",
              background: "linear-gradient(135deg,#c9963b,#e0b04c)",
              border: "none", borderRadius: 11, color: "#080f1a",
              fontFamily: "inherit", fontWeight: 700, fontSize: 16,
              cursor: "pointer", letterSpacing: "0.2px",
              boxShadow: "0 6px 24px rgba(201,150,59,0.35)",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}>
              Calculate My Report →
            </button>

            {/* ── RESULTS ── */}
            {results && (
              <div style={{ marginTop: 44 }}>
                <Divider label="Your Results" />

                {/* FREE TEASER — Gross Yield */}
                <div style={{
                  background: "linear-gradient(135deg,#101d31,#0d1828)",
                  border: "1px solid #c9963b33",
                  borderRadius: 16, padding: "36px 32px", textAlign: "center", marginBottom: 24,
                }}>
                  <p style={{ color: "#4d6580", fontSize: 11, textTransform: "uppercase", letterSpacing: 2.5, marginBottom: 14 }}>
                    Gross Rental Yield
                  </p>
                  <div style={{
                    fontFamily: "'DM Serif Display', serif", fontSize: 72, lineHeight: 1, marginBottom: 14,
                    color: results.grossYield >= 5 ? "#4cb87a" : results.grossYield >= 3.5 ? "#c9963b" : "#e05050",
                  }}>
                    {pct(results.grossYield)}
                  </div>
                  <p style={{ color: "#4d6580", fontSize: 13 }}>
                    {results.grossYield >= 5
                      ? "Strong yield — this deal is worth analysing in full"
                      : results.grossYield >= 3.5
                      ? "Average yield — capital growth may justify the gap"
                      : "Low yield — this deal is dependent on capital growth"}
                  </p>
                </div>

                <PurchaseBanner price={20} stripeLink={STRIPE_DEAL_LINK} label="Deal Analyser — Full Access" />
                <FullReport results={results} form={form} />
              </div>
            )}
          </>
        )}

        {/* ══ PORTFOLIO TAB ══ */}
        {tab === "portfolio" && (
          <>
            <SectionHeader
              title="My Portfolio"
              sub="Track all your properties, see your real equity position, and know exactly when you can buy again."
            />

            <>
              <PurchaseBanner price={49} stripeLink={STRIPE_PORTFOLIO_LINK} label="Portfolio Tracker — Full Access" badge="ONE-TIME UNLOCK" />
              <>
                {/* Portfolio Summary Cards */}
                {properties.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 28 }}>
                    {[
                      { label: "Total Value",    value: aud(totalValue),    color: "#ede8de" },
                      { label: "Total Debt",     value: aud(totalLoan),     color: "#e05050" },
                      { label: "Total Equity",   value: aud(totalEquity),   color: "#4cb87a" },
                      { label: "Portfolio LVR",  value: pct(avgLVR),        color: avgLVR < 70 ? "#4cb87a" : avgLVR < 80 ? "#c9963b" : "#e05050" },
                      { label: "Weekly Rent",    value: aud(weeklyRentAll) + "/wk", color: "#ede8de" },
                      { label: "Net Cashflow",   value: aud(weeklyNetCF)  + "/wk", color: weeklyNetCF >= 0 ? "#4cb87a" : "#e05050" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{
                        background: "#101d31", border: "1px solid #1a2e4a",
                        borderRadius: 12, padding: "16px 14px",
                      }}>
                        <p style={{ color: "#4d6580", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>{label}</p>
                        <p style={{ color, fontSize: 17, fontWeight: 700 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Property rows */}
                {properties.length === 0 && (
                  <div style={{ textAlign: "center", padding: "48px 24px", color: "#4d6580" }}>
                    <p style={{ fontSize: 36, marginBottom: 12 }}>🏠</p>
                    <p style={{ fontSize: 15, marginBottom: 4 }}>No properties yet</p>
                    <p style={{ fontSize: 13 }}>Add your first property below to get started</p>
                  </div>
                )}

                {properties.map(p => (
                  <div key={p.id} style={{
                    background: "#101d31", border: "1px solid #1a2e4a",
                    borderRadius: 12, padding: "16px 20px", marginBottom: 12,
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", flexWrap: "wrap", gap: 12,
                  }}>
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: 3 }}>{p.name}</p>
                      <p style={{ color: "#4d6580", fontSize: 12 }}>
                        Loan: {aud(+p.loan)} @ {p.rate}% p.a.
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                      {[
                        ["Value",  aud(+p.value),            "#ede8de"],
                        ["Equity", aud(+p.value - +p.loan),  "#4cb87a"],
                        ["Rent",   aud(+p.weeklyRent) + "/wk","#ede8de"],
                      ].map(([l, v, c]) => (
                        <div key={l} style={{ textAlign: "right" }}>
                          <p style={{ color: "#4d6580", fontSize: 10, marginBottom: 2 }}>{l}</p>
                          <p style={{ color: c, fontWeight: 600, fontSize: 14 }}>{v}</p>
                        </div>
                      ))}
                      <button onClick={() => setProperties(ps => ps.filter(x => x.id !== p.id))} style={{
                        background: "transparent", border: "1px solid #1a2e4a",
                        color: "#4d6580", padding: "5px 12px", borderRadius: 6,
                        cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                      }}>Remove</button>
                    </div>
                  </div>
                ))}

                {/* Add property */}
                {!showAdd ? (
                  <button onClick={() => setShowAdd(true)} style={{
                    width: "100%", padding: "14px",
                    background: "transparent", border: "2px dashed #1a2e4a",
                    borderRadius: 12, color: "#c9963b", fontFamily: "inherit",
                    fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 36,
                  }}>+ Add Property</button>
                ) : (
                  <div style={{
                    background: "#101d31", border: "1px solid #1a2e4a",
                    borderRadius: 12, padding: 20, marginBottom: 36,
                  }}>
                    <p style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>Add a Property</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 16 }}>
                      {[
                        ["name",       "Property Name / Address",    "text"],
                        ["value",      "Current Estimated Value ($)", "number"],
                        ["loan",       "Loan Balance ($)",            "number"],
                        ["rate",       "Interest Rate (%)",           "number"],
                        ["weeklyRent", "Weekly Rent ($)",             "number"],
                      ].map(([name, label, type]) => (
                        <Field key={name} label={label}>
                          <input
                            type={type} value={newProp[name]} placeholder={label}
                            onChange={e => setNewProp(p => ({ ...p, [name]: e.target.value }))}
                          />
                        </Field>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={addProperty} style={{
                        flex: 1, padding: "13px",
                        background: "linear-gradient(135deg,#c9963b,#e0b04c)",
                        border: "none", borderRadius: 8, color: "#080f1a",
                        fontFamily: "inherit", fontWeight: 700, cursor: "pointer",
                      }}>Add Property</button>
                      <button onClick={() => { setShowAdd(false); setNewProp(BLANK_PROP); }} style={{
                        padding: "13px 20px", background: "transparent",
                        border: "1px solid #1a2e4a", borderRadius: 8,
                        color: "#4d6580", fontFamily: "inherit", cursor: "pointer",
                      }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* When Can I Buy Again */}
                {properties.length > 0 && (
                  <Card title="When Can I Buy Again?">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12, marginBottom: 20 }}>
                      <Field label="Your Annual Gross Income ($)">
                        <PrefixInput prefix="$" value={income} onChange={e => setIncome(e.target.value)} placeholder="120000" />
                      </Field>
                      <Field label="Target Next Purchase Price ($)">
                        <PrefixInput prefix="$" value={targetPrice} onChange={e => setTargetPrice(e.target.value)} placeholder="700000" />
                      </Field>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 20 }}>
                      {[
                        { label: "Usable Equity (80% LVR)",    value: aud(usableEquity),      color: usableEquity > 0 ? "#4cb87a" : "#e05050" },
                        { label: "Est. Borrowing Capacity",    value: aud(borrowingCapacity),  color: "#ede8de" },
                        { label: "Deposit Required (20%)",     value: aud(depositNeeded),      color: "#ede8de" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: "#0d1828", borderRadius: 10, padding: "14px" }}>
                          <p style={{ color: "#4d6580", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>{label}</p>
                          <p style={{ color, fontSize: 17, fontWeight: 700 }}>{value}</p>
                        </div>
                      ))}
                    </div>

                    <div style={{
                      background: canBuy ? "#4cb87a10" : "#e0505010",
                      border: `1px solid ${canBuy ? "#4cb87a30" : "#e0505030"}`,
                      borderRadius: 12, padding: "18px 20px",
                      display: "flex", alignItems: "center", gap: 16,
                    }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%",
                        background: canBuy ? "#4cb87a" : "#e05050",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, flexShrink: 0, fontWeight: 700, color: "#fff",
                      }}>{canBuy ? "✓" : "↻"}</div>
                      <div>
                        <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 15, color: canBuy ? "#4cb87a" : "#e05050" }}>
                          {canBuy ? "You're ready to buy!" : "Not quite yet — keep building"}
                        </p>
                        <p style={{ fontSize: 13, color: "#4d6580", lineHeight: 1.5 }}>
                          {canBuy
                            ? `You have ${aud(usableEquity)} usable equity and ~${aud(borrowingCapacity)} estimated borrowing capacity. Talk to your mortgage broker.`
                            : `You need ${aud(equityGap)} more usable equity. At your current portfolio growth rate, review this in 12–24 months.`}
                        </p>
                      </div>
                    </div>

                    <p style={{ fontSize: 11, color: "#4d6580", marginTop: 14, lineHeight: 1.5 }}>
                      * Borrowing capacity is estimated at 6× gross income. Actual figures depend on your full financial position, existing commitments, and lender policy. General information only — not financial advice.
                    </p>
                  </Card>
                )}
              </>
            </>
          </>
        )}
      </main>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid #1a2e4a", padding: "22px 24px",
        textAlign: "center", color: "#4d6580", fontSize: 12, lineHeight: 1.6,
      }}>
        EquityEdge provides general information only and does not constitute financial advice.
        Always seek advice from a qualified financial adviser before making investment decisions.
        <br />© 2025 EquityEdge — Built for Australian property investors.
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FULL REPORT (unlocked)
// ═══════════════════════════════════════════════════════════════════
function FullReport({ results: r, form }) {
  return (
    <div>
      {/* Key metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 22 }}>
        {[
          {
            label: "Weekly Cashflow (after tax)",
            value: `${r.weeklyCF >= 0 ? "+" : ""}${aud(r.weeklyCF)}/wk`,
            sub:   r.weeklyCF >= 0 ? "Positively geared" : "Negative gearing",
            color: r.weeklyCF >= 0 ? "#4cb87a" : "#e05050",
            big: true,
          },
          {
            label: "Annual Tax Benefit",
            value: r.negativelyGeared ? aud(r.taxBenefit) : "N/A",
            sub:   r.negativelyGeared ? `${form.taxRate}% rate applied` : "Positively geared",
            color: r.negativelyGeared ? "#4cb87a" : "#4d6580",
          },
          {
            label: "Net Yield",
            value: pct(r.netYield),
            sub:   `Gross: ${pct(r.grossYield)}`,
            color: "#ede8de",
          },
          {
            label: "Stamp Duty (" + form.state + ")",
            value: aud(r.duty),
            sub:   "Investment property rate",
            color: "#e05050",
          },
          {
            label: "Total Cash Required",
            value: aud(r.cashRequired),
            sub:   "Deposit + duty + ~$2k costs",
            color: "#ede8de",
          },
          {
            label: "Break-even Rent",
            value: aud(r.breakEven) + "/wk",
            sub:   "Cashflow neutral threshold",
            color: "#c9963b",
          },
        ].map(({ label, value, sub, color, big }) => (
          <div key={label} style={{
            background: "#101d31", border: "1px solid #1a2e4a",
            borderRadius: 12, padding: "18px 16px",
          }}>
            <p style={{ color: "#4d6580", fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>{label}</p>
            <p style={{ color, fontSize: big ? 22 : 18, fontWeight: 700, marginBottom: sub ? 4 : 0 }}>{value}</p>
            {sub && <p style={{ color: "#4d6580", fontSize: 11 }}>{sub}</p>}
          </div>
        ))}
      </div>

      {/* Tax breakdown */}
      <div style={{
        background: "#101d31", border: "1px solid #1a2e4a",
        borderRadius: 12, padding: "20px 22px", marginBottom: 22,
      }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: "#c9963b", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 18 }}>
          Income & Tax Breakdown
        </h3>
        {[
          ["Annual rental income (gross)",          aud(r.annualRent),                           "#ede8de"],
          ["Less: Management fees & maintenance",   `−${aud(r.annualRent - r.netRental)}`,        "#e05050"],
          ["Less: Loan interest (interest-only)",   `−${aud(r.annualInt)}`,                       "#e05050"],
          ["Less: Depreciation allowance",          `−${aud(+form.depreciation)}`,                "#e05050"],
          ["Taxable income / loss",                 aud(r.taxableInc),                            r.taxableInc < 0 ? "#4cb87a" : "#e05050"],
          [
            r.negativelyGeared ? `Tax refund (negative gearing @ ${form.taxRate}%)` : `Tax payable @ ${form.taxRate}%`,
            r.negativelyGeared ? `+${aud(r.taxBenefit)}` : `−${aud(r.taxPayable)}`,
            r.negativelyGeared ? "#4cb87a" : "#e05050",
          ],
          ["Net annual cashflow",                   `${r.annualCF >= 0 ? "+" : ""}${aud(r.annualCF)}`, r.annualCF >= 0 ? "#4cb87a" : "#e05050"],
        ].map(([label, value, color], i, arr) => (
          <div key={label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0",
            borderBottom: i < arr.length - 1 ? "1px solid #1a2e4a" : "none",
            fontWeight: i === arr.length - 1 ? 700 : 400,
          }}>
            <span style={{ color: "#ede8de", fontSize: 13 }}>{label}</span>
            <span style={{ color, fontWeight: 600, fontSize: 13 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* 10-year chart */}
      <div style={{
        background: "#101d31", border: "1px solid #1a2e4a",
        borderRadius: 12, padding: "20px 22px",
      }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: "#c9963b", textTransform: "uppercase", letterSpacing: 1.8, marginBottom: 6 }}>
          10-Year Projection
        </h3>
        <p style={{ color: "#4d6580", fontSize: 12, marginBottom: 20 }}>
          Values in $000s — interest-only loan, {form.growthRate}% annual capital growth assumed
        </p>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={r.projection} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gValue"    x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#c9963b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#c9963b" stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="gEquity"   x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4cb87a" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4cb87a" stopOpacity={0}    />
              </linearGradient>
              <linearGradient id="gCashflow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#4a90d9" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4a90d9" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip
              contentStyle={{
                background: "#101d31", border: "1px solid #1a2e4a",
                borderRadius: 8, color: "#ede8de", fontSize: 12,
              }}
              formatter={(v) => [`$${v}k`]}
            />
            <Area type="monotone" dataKey="Value ($k)"    stroke="#c9963b" fill="url(#gValue)"    strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Equity ($k)"   stroke="#4cb87a" fill="url(#gEquity)"   strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="Cashflow ($k)" stroke="#4a90d9" fill="url(#gCashflow)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 14 }}>
          {[["#c9963b","Property Value"],["#4cb87a","Equity"],["#4a90d9","Cumulative Cashflow"]].map(([color, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
              <span style={{ color: "#4d6580", fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>
        <p style={{ textAlign: "center", color: "#4d6580", fontSize: 11, marginTop: 12 }}>
          Projections are illustrative only and not a guarantee of future performance.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PAYWALL
// ═══════════════════════════════════════════════════════════════════
function Paywall({ title, subtitle, price, stripeLink, onSimulate, features, badge }) {
  return (
    <div style={{
      background: "linear-gradient(135deg,#101d31,#0a1525)",
      border: "1px solid #c9963b25", borderRadius: 18,
      padding: "44px 36px", textAlign: "center",
    }}>
      {badge && (
        <div style={{
          display: "inline-block", background: "#c9963b14",
          border: "1px solid #c9963b35", color: "#c9963b",
          fontSize: 10, fontWeight: 800, letterSpacing: 2.5,
          padding: "6px 18px", borderRadius: 20, marginBottom: 22,
        }}>{badge}</div>
      )}
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, marginBottom: 10 }}>{title}</h2>
      <p style={{ color: "#4d6580", fontSize: 14, marginBottom: 32 }}>{subtitle}</p>

      <div style={{ textAlign: "left", maxWidth: 380, margin: "0 auto 36px" }}>
        {features.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
            <span style={{ color: "#c9963b", fontSize: 14, flexShrink: 0, marginTop: 1 }}>✦</span>
            <span style={{ fontSize: 14, color: "#ede8de", lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => window.open(stripeLink, "_blank")}
        style={{
          width: "100%", padding: "17px", marginBottom: 12,
          background: "linear-gradient(135deg,#c9963b,#e0b04c)",
          border: "none", borderRadius: 11, color: "#080f1a",
          fontFamily: "inherit", fontWeight: 700, fontSize: 17,
          cursor: "pointer", letterSpacing: "0.2px",
          boxShadow: "0 6px 28px rgba(201,150,59,0.45)",
        }}
      >
        Unlock for ${price} AUD
      </button>

      <button
        onClick={onSimulate}
        style={{
          width: "100%", padding: "12px",
          background: "transparent", border: "1px solid #1a2e4a",
          borderRadius: 8, color: "#4d6580", fontFamily: "inherit",
          fontSize: 12, cursor: "pointer",
        }}
      >
        🔧 Demo mode — simulate payment (remove before going live)
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PURCHASE BANNER (non-blocking — shows Stripe CTA without gating content)
// ═══════════════════════════════════════════════════════════════════
function PurchaseBanner({ price, stripeLink, label, badge }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 14,
      background: "linear-gradient(135deg,#1a2e10,#0f2010)",
      border: "1px solid #c9963b55",
      borderRadius: 12, padding: "16px 22px", marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: "linear-gradient(135deg,#c9963b,#e8b84b)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>✦</div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{label}</p>
          <p style={{ color: "#4d6580", fontSize: 12 }}>
            {badge ? badge + " · " : ""}Like what you see? Secure your access now.
          </p>
        </div>
      </div>
      <button
        onClick={() => window.open(stripeLink, "_blank")}
        style={{
          padding: "10px 24px", flexShrink: 0,
          background: "linear-gradient(135deg,#c9963b,#e0b04c)",
          border: "none", borderRadius: 8, color: "#080f1a",
          fontFamily: "inherit", fontWeight: 700, fontSize: 14,
          cursor: "pointer", whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(201,150,59,0.35)",
        }}
      >
        Buy Now — ${price} AUD
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
function Card({ title, children }) {
  return (
    <div style={{ background: "#101d31", border: "1px solid #1a2e4a", borderRadius: 14, padding: "20px" }}>
      <h3 style={{ fontSize: 10, fontWeight: 800, color: "#c9963b", textTransform: "uppercase", letterSpacing: 2, marginBottom: 16 }}>
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#4d6580", marginBottom: 6 }}>{label}</p>
      {children}
    </div>
  );
}

function PrefixInput({ prefix, ...props }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#4d6580", fontSize: 14 }}>
        {prefix}
      </span>
      <input style={{ paddingLeft: 26 }} type="number" {...props} />
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, marginBottom: 8 }}>{title}</h1>
      <p style={{ color: "#4d6580", fontSize: 14, lineHeight: 1.6 }}>{sub}</p>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
      <div style={{ flex: 1, height: 1, background: "#1a2e4a" }} />
      <span style={{ color: "#4d6580", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "#1a2e4a" }} />
    </div>
  );
}