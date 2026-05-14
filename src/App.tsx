/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, ChangeEvent, useEffect } from 'react';
import { 
  Tooltip, 
  ResponsiveContainer, 
} from 'recharts';
import { Home, PoundSterling, Wallet, Calculator, Info, LayoutDashboard, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Inputs {
  valuation: string;
  askingPrice: string;
  offerValue: string;
  offerMode: 'cash' | 'percent';
  availableCash: string;
  currentHomeValue: string;
  currentHomeMortgage: string;
  interestRate: string;
  renovations: string;
  legalFees: string;
  mortgageTerm: string;
  includeTaxInMortgage: boolean;
  includeFeesInMortgage: boolean;
  includeRenoInMortgage: boolean;
}

interface Calculations {
  finalOffer: number;
  lbtt: number;
  valuationGap: number;
  monthlyPayment: number;
  propertyEquity: number;
  totalFunds: number;
  totalCashNeeded: number;
  balance: number;
  ltv: number;
  mortgageRequired: number;
  totalAcquisitionCost: number;
  isAffordable: boolean;
  totalRepayable: number;
  // Metadata for breakdown
  taxInCash: boolean;
  feesInCash: boolean;
  renoInCash: boolean;
  mortgageBreakdown: { label: string; value: number }[];
  cashBreakdown: { label: string; value: number }[];
}

const STORAGE_KEY = 'robin_bear_property_inputs';

export default function App() {
  // --- Helpers ---
  const formatNumberWithCommas = (value: string) => {
    const cleanValue = value.replace(/[^\d.]/g, '');
    const [int, dec] = cleanValue.split('.');
    const formattedInt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return dec !== undefined ? `${formattedInt}.${dec}` : formattedInt;
  };

  const stripCommas = (value: string) => value.replace(/,/g, '');

  // --- State Management ---
  const [inputs, setInputs] = useState<Inputs>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure initial format for saved inputs
        return {
          ...parsed,
          valuation: formatNumberWithCommas(parsed.valuation),
          askingPrice: formatNumberWithCommas(parsed.askingPrice || ''),
          offerValue: formatNumberWithCommas(parsed.offerValue || ''),
          availableCash: formatNumberWithCommas(parsed.availableCash || ''),
          currentHomeValue: formatNumberWithCommas(parsed.currentHomeValue || ''),
          currentHomeMortgage: formatNumberWithCommas(parsed.currentHomeMortgage || ''),
          renovations: formatNumberWithCommas(parsed.renovations || ''),
          legalFees: formatNumberWithCommas(parsed.legalFees || ''),
        };
      } catch (e) {
        console.error('Failed to parse saved inputs', e);
      }
    }
    return {
      valuation: '',
      askingPrice: '',
      offerValue: '',
      offerMode: 'cash',
      availableCash: '',
      currentHomeValue: '',
      currentHomeMortgage: '',
      interestRate: '',
      renovations: '',
      legalFees: '',
      mortgageTerm: '25',
      includeTaxInMortgage: false,
      includeFeesInMortgage: false,
      includeRenoInMortgage: false,
    };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  }, [inputs]);

  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    const valNum = parseFloat(stripCommas(inputs.valuation)) || 0;
    const overValPercent = valNum > 0 ? ((calculations.finalOffer / valNum - 1) * 100).toFixed(1) : '0';
    
    const text = `🏠 Property Purchase Summary - Property affordability Checker
---------------------------------------
Valuation: ${formatCurrency(valNum)}
Offer Price: ${formatCurrency(calculations.finalOffer)} (${overValPercent}% over)
${calculations.valuationGap > 0 ? `Valuation Gap (Cash Only): ${formatCurrency(calculations.valuationGap)}\n` : ''}
💰 Capital & Financing
Equity: ${formatCurrency(calculations.propertyEquity)}
Savings: ${formatCurrency(parseFloat(stripCommas(inputs.availableCash)) || 0)}
Total Available Capital: ${formatCurrency(calculations.totalFunds)}

🏗️ Project Details
LBTT: ${formatCurrency(calculations.lbtt)}
Legal Fees: ${formatCurrency(parseFloat(stripCommas(inputs.legalFees)) || 0)}
Renovations: ${formatCurrency(parseFloat(stripCommas(inputs.renovations)) || 0)}
Total Project Cost: ${formatCurrency(calculations.totalAcquisitionCost)}

🏦 Mortgage Summary
Mortgage Required: ${formatCurrency(calculations.mortgageRequired)} (LTV: ${calculations.ltv.toFixed(1)}%)
Term: ${inputs.mortgageTerm} years @ ${inputs.interestRate}%
Estimated Monthly Payment: ${formatCurrency(calculations.monthlyPayment, 2)}

💵 Upfront Cash Needed: ${formatCurrency(calculations.totalCashNeeded)}
---------------------------------------
Calculated via Property affordability Checker`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // --- Handlers ---
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // For numeric fields we want commas, apply formatting
    const numericFields = [
      'valuation', 'askingPrice', 'offerValue', 'availableCash', 
      'currentHomeValue', 'currentHomeMortgage', 'renovations', 'legalFees'
    ];

    if (numericFields.includes(name)) {
      const formattedValue = formatNumberWithCommas(value);
      setInputs(prev => ({ ...prev, [name]: formattedValue }));
    } else {
      setInputs(prev => ({ ...prev, [name]: value }));
    }
  };

  const toggleOfferMode = (mode: 'cash' | 'percent') => {
    setInputs(prev => ({ ...prev, offerMode: mode, offerValue: '' }));
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setInputs({
      valuation: '',
      askingPrice: '',
      offerValue: '',
      offerMode: 'cash',
      availableCash: '',
      currentHomeValue: '',
      currentHomeMortgage: '',
      interestRate: '',
      renovations: '',
      legalFees: '',
      mortgageTerm: '',
      includeTaxInMortgage: false,
      includeFeesInMortgage: false,
      includeRenoInMortgage: false,
    });
  };

  // --- Financial Logic ---
  const calculations = useMemo<Calculations>(() => {
    const val = parseFloat(stripCommas(inputs.valuation)) || 0;
    const asking = parseFloat(stripCommas(inputs.askingPrice)) || 0;
    const offVal = parseFloat(stripCommas(inputs.offerValue)) || 0;
    const cash = parseFloat(stripCommas(inputs.availableCash)) || 0;
    const salePrice = parseFloat(stripCommas(inputs.currentHomeValue)) || 0;
    const remainingMortgage = parseFloat(stripCommas(inputs.currentHomeMortgage)) || 0;
    const rate = (parseFloat(stripCommas(inputs.interestRate)) || 0) / 100 / 12;
    const reno = parseFloat(stripCommas(inputs.renovations)) || 0;
    const fees = parseFloat(stripCommas(inputs.legalFees)) || 0;
    const termYears = parseFloat(inputs.mortgageTerm) || 0;

    // 1. Calculate Equity
    const propertyEquity = Math.max(0, salePrice - remainingMortgage);

    // 2. Determine Final Offer Price
    const finalOffer = inputs.offerMode === 'cash' 
      ? offVal 
      : val * (1 + offVal / 100);

    const valuationGap = Math.max(0, finalOffer - val);

    // 3. Scottish LBTT Calculation (Standard Main Residence)
    const calculateLBTT = (price: number) => {
      const bands = [
        { min: 0, max: 145000, rate: 0 },
        { min: 145000, max: 250000, rate: 0.02 },
        { min: 250000, max: 325000, rate: 0.05 },
        { min: 325000, max: 750000, rate: 0.10 },
        { min: 750000, max: Infinity, rate: 0.12 }
      ];

      return bands.map(band => {
        const taxableAmount = Math.max(0, Math.min(price, band.max) - band.min);
        return {
          ...band,
          tax: taxableAmount * band.rate,
          amount: taxableAmount
        };
      });
    };

    const lbttBreakdown = calculateLBTT(finalOffer);
    const lbtt = lbttBreakdown.reduce((sum, b) => sum + b.tax, 0);

    // 4. Totals & Requirements
    const totalAcquisitionCost = finalOffer + lbtt + fees + reno;
    const totalCapital = cash + propertyEquity;
    
    // Financing Strategy Logic:
    const totalProjectCosts = lbtt + fees + reno;

    // Property Deposit Strategy:
    const capitalAvailableForPurchase = Math.max(0, totalCapital - totalProjectCosts);
    
    // In Scotland, you must cover the valuation gap in cash as banks only lend on valuation.
    const gapCoveredByCash = Math.min(valuationGap, capitalAvailableForPurchase);
    const baseDepositOnValuation = Math.max(0, Math.min(val, capitalAvailableForPurchase - gapCoveredByCash));
    
    // Total cash used for property purchase (Internal sum for mortgage calculation)
    const houseDeposit = gapCoveredByCash + baseDepositOnValuation;

    const financedCosts = (inputs.includeTaxInMortgage ? lbtt : 0) + 
                          (inputs.includeFeesInMortgage ? fees : 0) + 
                          (inputs.includeRenoInMortgage ? reno : 0);

    const cashOutlays = (inputs.includeTaxInMortgage ? 0 : lbtt) + 
                        (inputs.includeFeesInMortgage ? 0 : fees) + 
                        (inputs.includeRenoInMortgage ? 0 : reno);

    // Total Mortgage Required = (Offer Price - Cash Used for Purchase) + Financed Fees
    // NOTE: This mortgage amount will be validated against Val * 0.95 later.
    const mortgageRequired = Math.max(0, (finalOffer - houseDeposit) + financedCosts);

    // Dynamic Breakdown Logic:
    const houseLoan = Math.max(0, finalOffer - houseDeposit);
    
    const mortgageBreakdown: { label: string; value: number }[] = [];
    if (houseLoan > 0) mortgageBreakdown.push({ label: 'Property Loan Amount', value: houseLoan });
    if (inputs.includeTaxInMortgage && lbtt > 0) mortgageBreakdown.push({ label: 'LBTT (Financed)', value: lbtt });
    if (inputs.includeFeesInMortgage && fees > 0) mortgageBreakdown.push({ label: 'Legal Fees (Financed)', value: fees });
    if (inputs.includeRenoInMortgage && reno > 0) mortgageBreakdown.push({ label: 'Renovations (Financed)', value: reno });

    const cashBreakdown = [
      ...(valuationGap > 0 ? [{ label: 'Valuation Gap (Cash Only)', value: valuationGap }] : []),
      { label: 'Deposit (On Valuation)', value: baseDepositOnValuation },
      ...(!inputs.includeTaxInMortgage ? [{ label: 'LBTT', value: lbtt }] : []),
      ...(!inputs.includeFeesInMortgage ? [{ label: 'Legal Fees', value: fees }] : []),
      ...(!inputs.includeRenoInMortgage ? [{ label: 'Renovations', value: reno }] : []),
    ].filter(item => item.value >= 0);

    // 5. Monthly Repayment
    const n = termYears * 12;
    const monthlyPayment = (rate > 0 && mortgageRequired > 0 && n > 0)
      ? (mortgageRequired * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)
      : 0;
    
    const totalRepayable = monthlyPayment * n;

    // Affordability Check:
    // 1. Is the mortgage required within a typical 95% LTV limit of the property valuation?
    const isWithinLendingLimit = mortgageRequired <= (val * 0.95);
    // 2. Can the user cover their chosen cash outlays with their available capital?
    const isAffordable = isWithinLendingLimit && (totalCapital >= (totalAcquisitionCost - mortgageRequired));
    
    return {
      finalOffer,
      lbtt,
      lbttBreakdown,
      valuationGap,
      monthlyPayment,
      propertyEquity,
      totalFunds: totalCapital,
      totalCashNeeded: cashOutlays + (finalOffer - (mortgageRequired - financedCosts)), // Actual cash usage
      balance: totalCapital - (cashOutlays + (finalOffer - (mortgageRequired - financedCosts))),
      ltv: val > 0 ? (mortgageRequired / val) * 100 : 0,
      mortgageRequired,
      totalAcquisitionCost,
      isAffordable,
      totalRepayable,
      taxInCash: !inputs.includeTaxInMortgage,
      feesInCash: !inputs.includeFeesInMortgage,
      renoInCash: !inputs.includeRenoInMortgage,
      mortgageBreakdown,
      cashBreakdown
    };
  }, [inputs]);

  const formatCurrency = (val: number, decimals: number = 0) => 
    new Intl.NumberFormat('en-GB', { 
      style: 'currency', 
      currency: 'GBP', 
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    }).format(val);

  return (
    <div id="app-container" className="min-h-screen text-gray-300 font-sans selection:bg-teal-500/30">
      <header id="app-header" className="max-w-7xl mx-auto px-6 pt-12 pb-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center space-y-2"
        >
          <div className="bg-teal-500 p-2.5 rounded-xl mb-4 shadow-xl shadow-teal-500/20">
            <Home className="text-white" size={32} />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl uppercase italic text-center leading-tight">
            Property affordability
          </h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-teal-500 font-bold">
            Checker
          </p>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap justify-center gap-3 mt-6"
          >
            <button
              onClick={handleExport}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 border ${
                copied 
                  ? 'bg-teal-500/20 border-teal-500 text-teal-400' 
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20 hover:text-white'
              }`}
            >
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              {copied ? 'Copied' : 'Export Summary'}
            </button>
            
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 border bg-white/5 border-white/10 text-gray-500 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
            >
              Clear All
            </button>
          </motion.div>
        </motion.div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Panel: Inputs */}
          <div id="input-controls" className="lg:col-span-4 space-y-6">
            <motion.section 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass p-6 rounded-2xl shadow-2xl"
            >
              <h2 className="flex items-center gap-2 font-bold text-xs uppercase tracking-widest text-teal-400 mb-6 pb-3 border-b border-white/5">
                <LayoutDashboard size={16} /> 
                Property Details
              </h2>
              <div className="space-y-5">
                <div id="field-valuation">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Survey / Home Report Valuation</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">£</span>
                    <input 
                      type="text" 
                      name="valuation" 
                      value={inputs.valuation} 
                      onChange={handleInputChange} 
                      className="input-bg w-full pl-7 p-2.5 rounded-lg font-mono font-semibold" 
                      placeholder="0" 
                    />
                  </div>
                </div>
                <div id="field-asking">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Asking Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">£</span>
                    <input 
                      type="text" 
                      name="askingPrice" 
                      value={inputs.askingPrice} 
                      onChange={handleInputChange} 
                      className="input-bg w-full pl-7 p-2.5 rounded-lg font-mono font-semibold" 
                      placeholder="0" 
                    />
                  </div>
                </div>
                <div id="offer-strategy" className="pt-2">
                  <div className="flex gap-2 p-1 bg-white/5 rounded-xl mb-4 border border-white/5">
                    <button 
                      onClick={() => toggleOfferMode('cash')} 
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${inputs.offerMode === 'cash' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Flat £
                    </button>
                    <button 
                      onClick={() => toggleOfferMode('percent')} 
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${inputs.offerMode === 'percent' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      % Over
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      Your Offer {inputs.offerMode === 'percent' ? '(%)' : '(£)'}
                    </label>
                    <span className="text-[10px] font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full font-mono">
                      {((calculations.finalOffer / (parseFloat(stripCommas(inputs.valuation)) || 1) - 1) * 100).toFixed(1)}% over valuation
                    </span>
                  </div>

                  <div className="relative mb-4">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                      {inputs.offerMode === 'percent' ? '%' : '£'}
                    </span>
                    <input 
                      type="text" 
                      name="offerValue" 
                      value={inputs.offerValue} 
                      onChange={handleInputChange} 
                      className={`input-bg w-full pl-7 p-2.5 rounded-lg font-mono font-semibold ${inputs.offerMode === 'cash' ? 'border-teal-500/30' : ''}`} 
                      placeholder="0" 
                    />
                  </div>

                  <div className="space-y-2 mb-2">
                    <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      <span>Adjust % Over Valuation</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="40" 
                      step="0.5"
                      value={(calculations.finalOffer / (parseFloat(stripCommas(inputs.valuation)) || 1) - 1) * 100}
                      onChange={(e) => {
                        const pct = parseFloat(e.target.value);
                        const baseVal = parseFloat(stripCommas(inputs.valuation)) || 0;
                        if (inputs.offerMode === 'percent') {
                          setInputs(prev => ({ ...prev, offerValue: pct.toString() }));
                        } else {
                          const total = baseVal * (1 + pct / 100);
                          setInputs(prev => ({ ...prev, offerValue: formatNumberWithCommas(Math.round(total).toString()) }));
                        }
                      }}
                      className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-teal-500" 
                    />
                    <div className="flex justify-between text-[8px] text-gray-600 font-bold uppercase tracking-tighter">
                      <span>0%</span>
                      <span>10%</span>
                      <span>20%</span>
                      <span>30%</span>
                      <span>40%</span>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {calculations.finalOffer > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="p-3 bg-teal-500/5 border border-teal-500/10 rounded-xl space-y-1"
                      >
                        <p className="text-[10px] text-teal-400 font-bold uppercase tracking-[0.1em] flex items-center gap-1">
                          <Info size={10} /> Total Purchase Price
                        </p>
                        <p className="text-lg font-black text-white font-mono">
                          {formatCurrency(calculations.finalOffer)}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.section>

            <motion.section 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass p-6 rounded-2xl shadow-2xl relative overflow-hidden"
            >
              <h2 className="flex items-center gap-2 font-bold text-xs uppercase tracking-widest text-teal-400 mb-6 pb-3 border-b border-white/5">
                <Wallet size={16} /> 
                Capital & Financing
              </h2>
              <div className="space-y-6 relative z-10 font-mono">
                {/* 1. Property Equity Calculator */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Property Equity Calculator</span>
                    <span className="text-sm font-black text-teal-400">{formatCurrency(calculations.propertyEquity)}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-1">Estimate Sale Price</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">£</span>
                        <input 
                          type="text" 
                          name="currentHomeValue" 
                          value={inputs.currentHomeValue} 
                          onChange={handleInputChange} 
                          className="input-bg w-full pl-6 p-2 rounded-lg text-xs" 
                          placeholder="0" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-gray-500 uppercase tracking-wider mb-1">Remaining Mortgage</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">£</span>
                        <input 
                          type="text" 
                          name="currentHomeMortgage" 
                          value={inputs.currentHomeMortgage} 
                          onChange={handleInputChange} 
                          className="input-bg w-full pl-6 p-2 rounded-lg text-xs" 
                          placeholder="0" 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Cash Savings */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Other Cash Savings</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">£</span>
                    <input 
                      type="text" 
                      name="availableCash" 
                      value={inputs.availableCash} 
                      onChange={handleInputChange} 
                      className="input-bg w-full pl-7 p-2.5 rounded-lg text-xs" 
                      placeholder="0" 
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/10 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Total Available Capital</span>
                  <span className="text-sm font-black text-white">{formatCurrency(calculations.totalFunds)}</span>
                </div>

                {/* 2. Financing Decisons */}
                <div className="space-y-5 pt-2 border-t border-white/5">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-4">Financing Strategy</span>
                  
                  {/* LBTT */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      <span>Scottish Tax (LBTT)</span>
                      <span className="text-white italic">{formatCurrency(calculations.lbtt)}</span>
                    </div>

                    {/* LBTT Breakdown Tooltip/Mini-info */}
                    <div className="bg-black/20 rounded-xl p-3 border border-white/5 space-y-2">
                       <div className="flex justify-between text-[8px] font-black text-gray-600 uppercase tracking-widest pb-1 border-b border-white/5">
                          <span>Band</span>
                          <span>Tax</span>
                       </div>
                       {calculations.lbttBreakdown.filter(b => b.amount > 0).map((band, i) => (
                         <div key={i} className="flex justify-between text-[9px] font-mono">
                            <span className="text-gray-500">
                              {band.max === Infinity ? `Over £${band.min.toLocaleString('en-GB')}` : `£${band.min.toLocaleString('en-GB')} - £${band.max.toLocaleString('en-GB')}`}
                              <span className="ml-1 text-teal-500/50">({band.rate * 100}%)</span>
                            </span>
                            <span className={band.tax > 0 ? "text-teal-400 font-bold" : "text-gray-600"}>
                              {formatCurrency(band.tax)}
                            </span>
                         </div>
                       ))}
                    </div>

                    <div className="flex bg-white/5 p-1 rounded-lg gap-1">
                      <button 
                        onClick={() => setInputs(prev => ({ ...prev, includeTaxInMortgage: false }))}
                        className={`flex-1 py-1.5 text-[8px] font-bold uppercase rounded-md transition-all ${!inputs.includeTaxInMortgage ? 'bg-teal-500 text-black shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
                      >
                        Pay in Cash
                      </button>
                      <button 
                        onClick={() => setInputs(prev => ({ ...prev, includeTaxInMortgage: true }))}
                        className={`flex-1 py-1.5 text-[8px] font-bold uppercase rounded-md transition-all ${inputs.includeTaxInMortgage ? 'bg-teal-500 text-black shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
                      >
                        Add to Mortgage
                      </button>
                    </div>
                  </div>

                  {/* Legal Fees */}
                  <div className="space-y-2 pt-2">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Manual Legal Fees</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-xs">£</span>
                        <input 
                          type="text" 
                          name="legalFees" 
                          value={inputs.legalFees} 
                          onChange={handleInputChange} 
                          className="input-bg w-full pl-7 p-2.5 rounded-lg text-xs font-mono font-bold" 
                          placeholder="0" 
                        />
                      </div>
                    </div>
                    <div className="flex bg-white/5 p-1 rounded-lg gap-1">
                      <button 
                        onClick={() => setInputs(prev => ({ ...prev, includeFeesInMortgage: false }))}
                        className={`flex-1 py-1.5 text-[8px] font-bold uppercase rounded-md transition-all ${!inputs.includeFeesInMortgage ? 'bg-teal-500 text-black shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
                      >
                        Pay in Cash
                      </button>
                      <button 
                        onClick={() => setInputs(prev => ({ ...prev, includeFeesInMortgage: true }))}
                        className={`flex-1 py-1.5 text-[8px] font-bold uppercase rounded-md transition-all ${inputs.includeFeesInMortgage ? 'bg-teal-500 text-black shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
                      >
                        Add to Mortgage
                      </button>
                    </div>
                  </div>

                  {/* Renovations */}
                  <div className="space-y-2 pt-2">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Manual Renovation Budget</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-xs">£</span>
                        <input 
                          type="text" 
                          name="renovations" 
                          value={inputs.renovations} 
                          onChange={handleInputChange} 
                          className="input-bg w-full pl-7 p-2.5 rounded-lg text-xs font-mono font-bold" 
                          placeholder="0" 
                        />
                      </div>
                    </div>
                    <div className="flex bg-white/5 p-1 rounded-lg gap-1">
                      <button 
                        onClick={() => setInputs(prev => ({ ...prev, includeRenoInMortgage: false }))}
                        className={`flex-1 py-1.5 text-[8px] font-bold uppercase rounded-md transition-all ${!inputs.includeRenoInMortgage ? 'bg-teal-500 text-black shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
                      >
                        Pay in Cash
                      </button>
                      <button 
                        onClick={() => setInputs(prev => ({ ...prev, includeRenoInMortgage: true }))}
                        className={`flex-1 py-1.5 text-[8px] font-bold uppercase rounded-md transition-all ${inputs.includeRenoInMortgage ? 'bg-teal-500 text-black shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
                      >
                        Add to Mortgage
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          </div>

          {/* Right Panel: Dashboard */}
          <div id="results-dashboard" className="lg:col-span-8 space-y-8">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
              {/* Column 1: Affordability & Acquisition */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass p-8 rounded-2xl flex flex-col"
              >
                <div className="mb-6 pb-4 border-b border-white/5">
                  <h3 className="text-teal-400 text-[10px] font-black uppercase tracking-[0.2em]">Total Acquisition Cost Breakdown</h3>
                  <p className="text-2xl font-extrabold text-white font-mono mt-1">
                    {formatCurrency(calculations.totalAcquisitionCost)}
                    <span className="text-[10px] text-gray-500 ml-2 uppercase tracking-tighter italic">Total Project Cost</span>
                  </p>
                </div>

                <div className="space-y-3 mb-8 flex-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Final Purchase Price</span>
                    <span className="font-bold text-white font-mono">{formatCurrency(calculations.finalOffer)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 flex items-center gap-2">
                      Scottish Tax (LBTT)
                      {!calculations.taxInCash ? 
                        <span className="text-[8px] bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded uppercase font-bold">Financed</span> : 
                        <span className="text-[8px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded uppercase font-bold">Cash Outlay</span>
                      }
                    </span>
                    <span className="font-bold text-white font-mono">{formatCurrency(calculations.lbtt)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 flex items-center gap-2">
                      Legal Fees
                      {!calculations.feesInCash ? 
                        <span className="text-[8px] bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded uppercase font-bold">Financed</span> : 
                        <span className="text-[8px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded uppercase font-bold">Cash Outlay</span>
                      }
                    </span>
                    <span className="font-bold text-white font-mono">{formatCurrency(parseFloat(stripCommas(inputs.legalFees)) || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-white/5 pb-3">
                    <span className="text-gray-400 flex items-center gap-2">
                      Renovations
                      {!calculations.renoInCash ? 
                        <span className="text-[8px] bg-teal-500/10 text-teal-400 px-1.5 py-0.5 rounded uppercase font-bold">Financed</span> : 
                        <span className="text-[8px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded uppercase font-bold">Cash Outlay</span>
                      }
                    </span>
                    <span className="font-bold text-white font-mono">{formatCurrency(parseFloat(stripCommas(inputs.renovations)) || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2">
                    <span className="font-black text-white uppercase tracking-wider">Total Project Cost</span>
                    <span className="font-black text-white font-mono">{formatCurrency(calculations.totalAcquisitionCost)}</span>
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 shadow-inner flex flex-col">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] uppercase font-black text-teal-400 tracking-[0.15em] leading-none">Total Mortgage Loan</span>
                        <Calculator size={12} className="text-teal-400" />
                      </div>
                      <p className="text-xl font-black text-white font-mono">
                        {formatCurrency(calculations.mortgageRequired)}
                      </p>
                      
                      <div className="mt-3 pt-3 border-t border-teal-400/10 space-y-1">
                        {calculations.mortgageBreakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[8px] font-bold uppercase tracking-wider">
                            <span className="text-teal-400/60">{item.label}</span>
                            <span className="text-white/80">{formatCurrency(item.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border shadow-inner flex flex-col transition-colors ${
                      (calculations.totalAcquisitionCost - calculations.mortgageRequired) > calculations.totalFunds 
                        ? 'bg-red-500/10 border-red-500/20' 
                        : 'bg-white/5 border-white/10'
                    }`}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex flex-col">
                          <span className={`text-[9px] uppercase font-black tracking-[0.15em] leading-none ${
                            (calculations.totalAcquisitionCost - calculations.mortgageRequired) > calculations.totalFunds ? 'text-red-400' : 'text-gray-400'
                          }`}>Total Upfront Capital</span>
                          {calculations.valuationGap > 0 && (
                            <span className="text-[7px] text-teal-400/70 font-bold uppercase mt-1">Includes {formatCurrency(calculations.valuationGap)} Over Valuation</span>
                          )}
                        </div>
                        <Wallet size={12} className={(calculations.totalAcquisitionCost - calculations.mortgageRequired) > calculations.totalFunds ? 'text-red-400' : 'text-gray-400'} />
                      </div>
                      <p className={`text-xl font-black font-mono ${
                        (calculations.totalAcquisitionCost - calculations.mortgageRequired) > calculations.totalFunds ? 'text-red-400' : 'text-white'
                      }`}>
                        {formatCurrency(calculations.totalAcquisitionCost - calculations.mortgageRequired)}
                      </p>

                      <div className={`mt-3 pt-3 border-t space-y-1 ${
                        (calculations.totalAcquisitionCost - calculations.mortgageRequired) > calculations.totalFunds ? 'border-red-400/10' : 'border-white/5'
                      }`}>
                        {calculations.cashBreakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[8px] font-bold uppercase tracking-wider">
                            <span className={(calculations.totalAcquisitionCost - calculations.mortgageRequired) > calculations.totalFunds ? 'text-red-400/60' : 'text-gray-500'}>{item.label}</span>
                            <span className={(calculations.totalAcquisitionCost - calculations.mortgageRequired) > calculations.totalFunds ? 'text-red-300' : 'text-gray-300'}>{formatCurrency(item.value)}</span>
                          </div>
                        ))}
                      </div>
                      
                      {(calculations.totalAcquisitionCost - calculations.mortgageRequired) > calculations.totalFunds && (
                        <p className="text-[7px] text-red-500 font-bold uppercase mt-2 tracking-tighter italic">Exceeds available capital</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/10">
                    <p className="text-[8px] text-teal-400/50 uppercase font-bold tracking-widest italic text-center">
                      Gap calculation based on selected financing strategy
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Column 2: Mortgage & Efficiency */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="glass p-8 rounded-2xl flex flex-col border border-white/5 relative overflow-hidden"
              >
                {/* Background Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 blur-3xl rounded-full -mr-16 -mt-16" />
                
                <div className="mb-0 relative z-10">
                  <h3 className="text-teal-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Monthly Repayment</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white font-mono tracking-tighter">
                      {formatCurrency(calculations.monthlyPayment, 2)}
                    </span>
                  </div>
                  
                  {/* Mortgage Terms (Moved here) */}
                  <div className="mt-6 mb-6 p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] block border-b border-white/5 pb-2">Loan Terms</span>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none">Term (Years)</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            name="mortgageTerm" 
                            value={inputs.mortgageTerm} 
                            onChange={handleInputChange} 
                            className="bg-[#1a1a1a]/50 w-full p-2 rounded-lg text-xs font-mono font-bold text-teal-400 border border-white/5 focus:border-teal-500/50 outline-none" 
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none">Interest Rate</label>
                        <div className="relative">
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-[9px]">%</span>
                          <input 
                            type="text" 
                            name="interestRate" 
                            value={inputs.interestRate} 
                            onChange={handleInputChange} 
                            className="bg-[#1a1a1a]/50 w-full p-2 pr-5 rounded-lg text-xs font-mono font-bold text-teal-400 border border-white/5 focus:border-teal-500/50 outline-none" 
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Mortgage Amount</p>
                    <p className="text-lg font-black text-white font-mono leading-none">
                      {formatCurrency(calculations.mortgageRequired)}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Total Repayable</p>
                    <p className="text-lg font-black text-white font-mono leading-none">
                      {formatCurrency(calculations.totalRepayable || 0, 2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 flex-1 relative z-10">
                  <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest leading-none">Loan to Value (LTV)</span>
                      <span className="text-xl font-black text-white font-mono">{calculations.ltv.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

              </motion.div>
            </div>
          </div>
        </div>

      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
          <p>© 2026 Property affordability Checker</p>
          <div className="flex gap-8">
            <span className="hover:text-teal-400 transition-colors cursor-help italic">
              Computational Methodology
            </span>
            <span className="hover:text-teal-400 transition-colors cursor-help italic">
              LBTT Standards 2026
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
