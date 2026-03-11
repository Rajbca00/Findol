import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3, 
  PieChart as PieChartIcon, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Wallet
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Asset, Investment, Transaction } from '../types';

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];
const MONTHS_TO_SHOW = 12;

const formatCurrency = (value: number) => `Rs${value.toLocaleString('en-IN')}`;
const getMonthKey = (value: string) => value.slice(0, 7);
const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};
const buildRecentMonthKeys = (count: number) => {
  const current = new Date();
  current.setDate(1);
  current.setHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const month = new Date(current.getFullYear(), current.getMonth() - (count - 1 - index), 1);
    return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  });
};

export default function Analytics() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [excludeInvestments, setExcludeInvestments] = useState(true);
  const [excludePrepayments, setExcludePrepayments] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assetsRes, invRes, transactionsRes] = await Promise.all([
        supabase.from('assets').select('*'),
        supabase.from('investments').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: true })
      ]);
      
      if (assetsRes.error) throw assetsRes.error;
      if (invRes.error) throw invRes.error;
      if (transactionsRes.error) throw transactionsRes.error;

      setAssets(assetsRes.data || []);
      setInvestments(invRes.data || []);
      setTransactions(transactionsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const assetsTotal = assets.reduce((sum, asset) => sum + asset.value, 0);
  const investmentsTotal = investments.reduce((sum, inv) => sum + inv.current_value, 0);
  const totalInvested = investments.reduce((sum, inv) => sum + (inv.invested_value || 0), 0);
  const totalNetWorth = assetsTotal + investmentsTotal;

  // Group by type for allocation
  const allocationData = [
    ...assets.reduce((acc: any[], asset) => {
      const existing = acc.find(a => a.name === asset.type);
      if (existing) existing.value += asset.value;
      else acc.push({ name: asset.type, value: asset.value });
      return acc;
    }, []),
    ...investments.reduce((acc: any[], inv) => {
      const existing = acc.find(a => a.name === inv.type);
      if (existing) existing.value += inv.current_value;
      else acc.push({ name: inv.type, value: inv.current_value });
      return acc;
    }, [])
  ].sort((a, b) => b.value - a.value);

  // Performance data for investments
  const performanceData = investments.map(inv => ({
    name: inv.name,
    invested: inv.invested_value || 0,
    current: inv.current_value,
    profit: inv.current_value - (inv.invested_value || 0),
    percent: (inv.invested_value || 0) > 0 ? ((inv.current_value - inv.invested_value!) / inv.invested_value!) * 100 : 0
  })).sort((a, b) => b.profit - a.profit);

  // Calculate dynamic insights
  const totalProfit = performanceData.reduce((sum, d) => sum + d.profit, 0);
  const profitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  
  // Risk Profile calculation: High risk if > 70% in Stocks/Mutual Funds
  const equityValue = investments.reduce((sum, inv) => sum + inv.current_value, 0);
  const equityRatio = totalNetWorth > 0 ? (equityValue / totalNetWorth) : 0;
  let riskProfile = 'Low';
  if (equityRatio > 0.7) riskProfile = 'Aggressive';
  else if (equityRatio > 0.4) riskProfile = 'Moderate';
  else if (equityRatio > 0.1) riskProfile = 'Conservative';

  // Mock historical data (since we don't have a history table yet)
  const historicalData = [
    { month: 'Oct', netWorth: totalNetWorth * 0.85, investments: investmentsTotal * 0.8 },
    { month: 'Nov', netWorth: totalNetWorth * 0.88, investments: investmentsTotal * 0.82 },
    { month: 'Dec', netWorth: totalNetWorth * 0.92, investments: investmentsTotal * 0.85 },
    { month: 'Jan', netWorth: totalNetWorth * 0.95, investments: investmentsTotal * 0.9 },
    { month: 'Feb', netWorth: totalNetWorth * 0.98, investments: investmentsTotal * 0.95 },
    { month: 'Mar', netWorth: totalNetWorth, investments: investmentsTotal },
  ];

  const isInvestmentTransaction = (transaction: Transaction) => transaction.category.toLowerCase() === 'investment';
  const isPrepaymentTransaction = (transaction: Transaction) => {
    const combined = `${transaction.category} ${transaction.description}`.toLowerCase();
    return combined.includes('prepayment') || combined.includes('pre-pay');
  };
  const isIncludedInCashflow = (transaction: Transaction) => {
    if (transaction.type === 'Transfer') return false;
    if (excludeInvestments && isInvestmentTransaction(transaction)) return false;
    if (excludePrepayments && isPrepaymentTransaction(transaction)) return false;
    return true;
  };

  const monthKeys = buildRecentMonthKeys(MONTHS_TO_SHOW);
  const monthlyCashflowData = monthKeys.map((monthKey) => {
    const monthTransactions = transactions.filter((transaction) => getMonthKey(transaction.date) === monthKey);
    const includedTransactions = monthTransactions.filter(isIncludedInCashflow);
    const income = includedTransactions
      .filter((transaction) => transaction.type === 'Income')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const spend = includedTransactions
      .filter((transaction) => transaction.type === 'Expense')
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const excludedInvestmentAmount = excludeInvestments
      ? monthTransactions.filter(isInvestmentTransaction).reduce((sum, transaction) => sum + transaction.amount, 0)
      : 0;
    const excludedPrepaymentAmount = excludePrepayments
      ? monthTransactions.filter(isPrepaymentTransaction).reduce((sum, transaction) => sum + transaction.amount, 0)
      : 0;

    return {
      month: formatMonthLabel(monthKey),
      monthKey,
      income,
      spend,
      net: income - spend,
      excludedInvestmentAmount,
      excludedPrepaymentAmount
    };
  });

  const latestMonthData = [...monthlyCashflowData].reverse().find((item) => item.income > 0 || item.spend > 0) || monthlyCashflowData[monthlyCashflowData.length - 1];
  const avgMonthlyIncome = monthlyCashflowData.reduce((sum, month) => sum + month.income, 0) / monthlyCashflowData.length;
  const avgMonthlySpend = monthlyCashflowData.reduce((sum, month) => sum + month.spend, 0) / monthlyCashflowData.length;
  const bestNetMonth = monthlyCashflowData.reduce((best, current) => current.net > best.net ? current : best, monthlyCashflowData[0]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-display font-bold text-zinc-900">Analytics</h1>
        <p className="text-zinc-500">Deep dive into your financial performance and allocation.</p>
      </div>

      {/* Top Insights */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Assets</p>
          <h3 className="text-xl font-display font-bold text-slate-900">₹{assetsTotal.toLocaleString('en-IN')}</h3>
          <div className="mt-2 flex items-center gap-1 text-emerald-600 text-xs font-semibold">
            <TrendingUp size={12} />
            <span>{assets.length} Active assets</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Investments</p>
          <h3 className="text-xl font-display font-bold text-zinc-900">₹{investmentsTotal.toLocaleString('en-IN')}</h3>
          <div className="mt-2 flex items-center gap-1 text-blue-600 text-xs font-semibold">
            <Info size={12} />
            <span>{investments.length} Active holdings</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Overall Profit</p>
          <h3 className={`text-xl font-display font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ₹{totalProfit.toLocaleString('en-IN')}
          </h3>
          <div className={`mt-2 flex items-center gap-1 text-xs font-semibold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalProfit >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{profitPercent.toFixed(1)}% overall return</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Risk Profile</p>
          <h3 className="text-xl font-display font-bold text-amber-600">{riskProfile}</h3>
          <div className="mt-2 flex items-center gap-1 text-slate-500 text-xs">
            <Target size={12} />
            <span>{Math.round(equityRatio * 100)}% Equity exposure</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="text-blue-600" size={20} />
              <h3 className="font-display font-bold text-lg">Monthly Income vs Spend</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Last {MONTHS_TO_SHOW} months of transaction cashflow. Transfers are excluded automatically.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 bg-slate-50">
              <input
                type="checkbox"
                checked={excludeInvestments}
                onChange={(e) => setExcludeInvestments(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Exclude investment
            </label>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 bg-slate-50">
              <input
                type="checkbox"
                checked={excludePrepayments}
                onChange={(e) => setExcludePrepayments(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Exclude prepayments
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-6 pt-6">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Average Monthly Income</p>
            <p className="mt-2 text-2xl font-display font-bold text-emerald-700">{formatCurrency(Math.round(avgMonthlyIncome))}</p>
          </div>
          <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">Average Monthly Spend</p>
            <p className="mt-2 text-2xl font-display font-bold text-red-700">{formatCurrency(Math.round(avgMonthlySpend))}</p>
          </div>
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Best Net Month</p>
            <p className="mt-2 text-2xl font-display font-bold text-blue-700">{bestNetMonth.month}</p>
            <p className="mt-1 text-sm text-blue-700/80">{formatCurrency(bestNetMonth.net)}</p>
          </div>
        </div>

        <div className="h-[340px] w-full px-4 pb-4 pt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyCashflowData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `Rs${(value / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number, name: string) => [formatCurrency(value), name === 'income' ? 'Income' : name === 'spend' ? 'Spend' : 'Net']}
              />
              <Legend />
              <Bar dataKey="income" fill="#10b981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="spend" fill="#ef4444" radius={[8, 8, 0, 0]} />
              <Bar dataKey="net" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border-t border-slate-100 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Latest Active Month</p>
              <h4 className="mt-2 text-xl font-display font-bold text-slate-900">{latestMonthData.month}</h4>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-slate-400">Income</p>
                  <p className="font-semibold text-emerald-600">{formatCurrency(latestMonthData.income)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Spend</p>
                  <p className="font-semibold text-red-600">{formatCurrency(latestMonthData.spend)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Net</p>
                  <p className={`font-semibold ${latestMonthData.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(latestMonthData.net)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Applied Filters</p>
              <p className="mt-2">
                Investment exclusion removes transactions with category <span className="font-semibold text-slate-700">Investment</span>.
              </p>
              <p className="mt-1">
                Prepayment exclusion removes transactions where category or description contains <span className="font-semibold text-slate-700">prepayment</span>.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Net Worth Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-blue-600" size={20} />
              <h3 className="font-display font-bold text-lg">Net Worth Trend</h3>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="colorNW" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `₹${(val/100000).toFixed(1)}L`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Net Worth']}
                />
                <Area type="monotone" dataKey="netWorth" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorNW)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Asset Allocation Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="text-indigo-600" size={20} />
            <h3 className="font-display font-bold text-lg">Asset Allocation</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {allocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Investment Performance */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="text-emerald-600" size={20} />
            <h3 className="font-display font-bold text-lg">Investment Performance (Profit/Loss)</h3>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={100}
                  tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Profit/Loss']}
                />
                <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                  {performanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-display font-bold text-lg">Monthly Cashflow Table</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Month</th>
                <th className="px-6 py-4 font-semibold">Income</th>
                <th className="px-6 py-4 font-semibold">Spend</th>
                <th className="px-6 py-4 font-semibold">Net</th>
                <th className="px-6 py-4 font-semibold">Excluded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...monthlyCashflowData].reverse().map((month) => (
                <tr key={month.monthKey} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{month.month}</td>
                  <td className="px-6 py-4 text-emerald-600 font-semibold">{formatCurrency(month.income)}</td>
                  <td className="px-6 py-4 text-red-600 font-semibold">{formatCurrency(month.spend)}</td>
                  <td className={`px-6 py-4 font-semibold ${month.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(month.net)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {month.excludedInvestmentAmount > 0 && <span>Investment: {formatCurrency(month.excludedInvestmentAmount)} </span>}
                    {month.excludedPrepaymentAmount > 0 && <span>Prepayment: {formatCurrency(month.excludedPrepaymentAmount)}</span>}
                    {month.excludedInvestmentAmount === 0 && month.excludedPrepaymentAmount === 0 && <span>None</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-display font-bold text-lg">Asset Performance Matrix</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Asset</th>
                <th className="px-6 py-4 font-semibold">Invested</th>
                <th className="px-6 py-4 font-semibold">Current Value</th>
                <th className="px-6 py-4 font-semibold">P&L</th>
                <th className="px-6 py-4 font-semibold text-right">Returns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {performanceData.map((item) => (
                <tr key={item.name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                  <td className="px-6 py-4 text-slate-600">₹{item.invested.toLocaleString('en-IN')}</td>
                  <td className="px-6 py-4 text-slate-900 font-semibold">₹{item.current.toLocaleString('en-IN')}</td>
                  <td className={`px-6 py-4 font-medium ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {item.profit >= 0 ? '+' : ''}₹{item.profit.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${item.percent >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {item.percent >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {Math.abs(item.percent).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
              {performanceData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500 italic">
                    No investment data available for performance analysis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
