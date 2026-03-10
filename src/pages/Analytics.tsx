import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  BarChart3, 
  PieChart as PieChartIcon, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Info
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
import { Asset, Investment } from '../types';

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

export default function Analytics() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assetsRes, invRes] = await Promise.all([
        supabase.from('assets').select('*'),
        supabase.from('investments').select('*')
      ]);
      
      if (assetsRes.error) throw assetsRes.error;
      if (invRes.error) throw invRes.error;

      setAssets(assetsRes.data || []);
      setInvestments(invRes.data || []);
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
