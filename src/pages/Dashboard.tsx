import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  ArrowUpRight, 
  Wallet, 
  PieChart as PieChartIcon,
  ChevronRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Asset, Investment } from '../types';

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

export default function Dashboard() {
  const navigate = useNavigate();
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
  const totalProfit = investmentsTotal - totalInvested;
  const profitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  // Generate dynamic history based on current total (mocking growth)
  const dynamicHistory = [
    { date: 'Oct', value: totalNetWorth * 0.85 },
    { date: 'Nov', value: totalNetWorth * 0.88 },
    { date: 'Dec', value: totalNetWorth * 0.92 },
    { date: 'Jan', value: totalNetWorth * 0.95 },
    { date: 'Feb', value: totalNetWorth * 0.98 },
    { date: 'Mar', value: totalNetWorth },
  ];

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-zinc-900">Dashboard</h1>
          <p className="text-zinc-500">Welcome back! Here's your financial overview.</p>
        </div>
        <button 
          onClick={() => navigate('/assets')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
        >
          <Plus size={20} />
          Add Asset
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet size={20} />
            </div>
            <span className={`text-sm font-medium flex items-center gap-1 ${profitPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {profitPercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(profitPercent).toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">Total Net Worth</p>
          <h2 className="text-2xl font-display font-bold mt-1">
            ₹{totalNetWorth.toLocaleString('en-IN')}
          </h2>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {totalProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
          </div>
          <p className="text-sm text-zinc-500 font-medium">Total Profit/Loss</p>
          <h2 className={`text-2xl font-display font-bold mt-1 ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalProfit >= 0 ? '+' : '-'}₹{Math.abs(totalProfit).toLocaleString('en-IN')}
          </h2>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <PieChartIcon size={20} />
            </div>
          </div>
          <p className="text-sm text-zinc-500 font-medium">Asset Classes</p>
          <h2 className="text-2xl font-display font-bold mt-1">
            {allocationData.length} Active
          </h2>
        </motion.div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Net Worth History */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display font-bold text-lg">Net Worth Growth</h3>
            <select className="text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 outline-none">
              <option>Last 6 Months</option>
              <option>Last Year</option>
              <option>All Time</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicHistory}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  hide 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                  }}
                  formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Net Worth']}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Asset Allocation */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="font-display font-bold text-lg mb-6">Asset Allocation</h3>
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="h-[250px] w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3">
              {allocationData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-sm text-zinc-600">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {totalNetWorth > 0 ? Math.round((item.value / totalNetWorth) * 100) : 0}%
                  </span>
                </div>
              ))}
              {allocationData.length === 0 && (
                <p className="text-sm text-zinc-400 italic">No assets to display.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Assets */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">Your Assets</h3>
          <button className="text-emerald-600 text-sm font-semibold hover:underline flex items-center gap-1">
            View All <ChevronRight size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Asset Name</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Value</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {assets.slice(0, 5).map((asset) => (
                <tr key={asset.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-zinc-900">{asset.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-md font-medium">
                      {asset.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    ₹{asset.value.toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-zinc-400 hover:text-emerald-600 transition-colors">
                      <ArrowUpRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500 italic">
                    No assets added yet.
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
