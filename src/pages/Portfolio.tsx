import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  Briefcase,
  Target,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Investment } from '../types';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

export default function Portfolio() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [type, setType] = useState<'Stock' | 'Mutual Fund' | 'Gold Mutual Fund'>('Stock');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Calculated values for display in form
  const investedValue = (parseFloat(quantity) || 0) * (parseFloat(buyPrice) || 0);
  const currentValue = (parseFloat(quantity) || 0) * (parseFloat(currentPrice) || 0);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchingTicker, setSearchingTicker] = useState(false);
  const [lastSearchedName, setLastSearchedName] = useState('');

  useEffect(() => {
    fetchInvestments();
  }, []);

  // Auto-lookup ticker when name changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (name.trim() && name.length > 2 && name !== lastSearchedName && !ticker) {
        lookupTicker();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [name]);

  const fetchInvestments = async () => {
    try {
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setInvestments(data || []);
    } catch (error) {
      console.error('Error fetching investments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        user_id: user.id,
        name,
        ticker,
        type,
        quantity: parseFloat(quantity),
        buy_price: parseFloat(buyPrice),
        current_price: parseFloat(currentPrice),
        invested_value: investedValue,
        current_value: currentValue,
        updated_at: new Date().toISOString()
      };

      if (editingInvestment) {
        const { error } = await supabase
          .from('investments')
          .update(payload)
          .eq('id', editingInvestment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('investments').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      fetchInvestments();
    } catch (error) {
      console.error('Error saving investment:', error);
      alert('Error saving investment.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteInvestment = async (id: string) => {
    try {
      const { error } = await supabase.from('investments').delete().eq('id', id);
      if (error) throw error;
      setDeletingId(null);
      fetchInvestments();
    } catch (error) {
      console.error('Error deleting investment:', error);
      alert('Error deleting investment.');
      setDeletingId(null);
    }
  };

  const refreshPrices = async () => {
    if (investments.length === 0) return;
    setRefreshing(true);
    
    try {
      const tickers = Array.from(new Set(investments.map(inv => inv.ticker).filter(Boolean)));
      if (tickers.length === 0) {
        alert('No tickers found to refresh.');
        return;
      }

      // Call our new backend API
      const response = await fetch(`/api/prices?tickers=${tickers.join(',')}`);
      if (!response.ok) throw new Error('Failed to fetch prices');
      
      const priceData = await response.json();

      // Update each investment with new price
      const updates = investments.map(inv => {
        const match = priceData.find((p: any) => p.ticker === inv.ticker && !p.error);
        if (match) {
          const newPrice = parseFloat(match.price);
          return supabase
            .from('investments')
            .update({
              current_price: newPrice,
              current_value: inv.quantity * newPrice,
              updated_at: new Date().toISOString()
            })
            .eq('id', inv.id);
        }
        return null;
      }).filter(Boolean);

      if (updates.length > 0) {
        await Promise.all(updates);
        fetchInvestments();
        alert('Prices updated successfully using Yahoo Finance!');
      } else {
        alert('No price updates found for your tickers.');
      }
    } catch (error) {
      console.error('Error refreshing prices:', error);
      alert('Failed to refresh prices. Please try again later.');
    } finally {
      setRefreshing(false);
    }
  };

  const resetForm = () => {
    setEditingInvestment(null);
    setName('');
    setTicker('');
    setType('Stock');
    setQuantity('');
    setBuyPrice('');
    setCurrentPrice('');
    setLastSearchedName('');
  };

  const openEditModal = (inv: Investment) => {
    setEditingInvestment(inv);
    setName(inv.name);
    setTicker(inv.ticker || '');
    setType(inv.type);
    setQuantity(inv.quantity?.toString() || '');
    setBuyPrice(inv.buy_price?.toString() || '');
    setCurrentPrice(inv.current_price?.toString() || '');
    setIsModalOpen(true);
  };

  const lookupTicker = async () => {
    if (!name.trim()) {
      alert('Please enter an investment name first.');
      return;
    }

    setSearchingTicker(true);
    setLastSearchedName(name);
    try {
      const response = await fetch(`/api/search-ticker?q=${encodeURIComponent(name)}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Ticker not found');
      }
      
      if (data.ticker) {
        setTicker(data.ticker);
        // Also update name if it was a generic search
        if (data.name && name.length < data.name.length) {
          setName(data.name);
        }
        
        // Optionally fetch current price immediately
        const priceResponse = await fetch(`/api/prices?tickers=${data.ticker}`);
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          if (priceData[0] && !priceData[0].error) {
            setCurrentPrice(priceData[0].price.toString());
          }
        }
      }
    } catch (error: any) {
      console.error('Error looking up ticker:', error);
      alert(`Could not find ticker: ${error.message}. Please enter it manually.`);
    } finally {
      setSearchingTicker(false);
    }
  };

  const totalInvested = investments.reduce((sum, inv) => sum + (inv.invested_value || 0), 0);
  const currentTotal = investments.reduce((sum, inv) => sum + inv.current_value, 0);
  const totalPL = currentTotal - totalInvested;
  const plPercentage = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const chartData = investments.map(inv => ({
    name: inv.name,
    value: inv.current_value
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Portfolio</h1>
          <p className="text-slate-500">Track your stock and mutual fund performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={refreshPrices}
            disabled={refreshing || investments.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Prices'}
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
          >
            <Plus size={20} />
            Add Investment
          </button>
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Briefcase size={20} />
            </div>
          </div>
          <p className="text-sm text-slate-500 font-medium">Total Invested</p>
          <h2 className="text-2xl font-display font-bold mt-1">
            ₹{totalInvested.toLocaleString('en-IN')}
          </h2>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Target size={20} />
            </div>
          </div>
          <p className="text-sm text-slate-500 font-medium">Current Value</p>
          <h2 className="text-2xl font-display font-bold mt-1">
            ₹{currentTotal.toLocaleString('en-IN')}
          </h2>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalPL >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {totalPL >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <span className={`text-sm font-bold flex items-center gap-1 ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalPL >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(plPercentage).toFixed(2)}%
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">Total P&L</p>
          <h2 className={`text-2xl font-display font-bold mt-1 ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalPL >= 0 ? '+' : '-'}₹{Math.abs(totalPL).toLocaleString('en-IN')}
          </h2>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allocation Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-display font-bold mb-6">Portfolio Allocation</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Individual Performance */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-display font-bold mb-6">Asset Performance</h3>
          <div className="space-y-4">
            {investments.map((inv, index) => {
              const pl = inv.current_value - (inv.invested_value || 0);
              const percent = (inv.invested_value || 0) > 0 ? (pl / (inv.invested_value || 0)) * 100 : 0;
              
              return (
                <div key={inv.id} className="group flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <div>
                      <h4 className="font-semibold text-slate-900">{inv.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">{inv.ticker}</span>
                        <span className="text-xs text-slate-500">{inv.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-slate-900">₹{inv.current_value.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-400">{inv.quantity} @ ₹{inv.current_price}</p>
                      <p className={`text-xs font-bold flex items-center justify-end gap-1 ${pl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {pl >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(percent).toFixed(1)}%
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditModal(inv)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setDeletingId(inv.id)}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {investments.length === 0 && (
              <div className="py-10 text-center text-slate-500">
                No investments found. Add your first Stock or Mutual Fund.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Investment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-display font-bold">{editingInvestment ? 'Edit Investment' : 'Add New Investment'}</h2>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }} 
                className="text-slate-400 hover:text-slate-900"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveInvestment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Investment Name</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Reliance"
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={lookupTicker}
                      disabled={searchingTicker || !name.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-semibold shadow-sm"
                    >
                      {searchingTicker ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                      <span>Lookup</span>
                    </button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ticker / Symbol</label>
                  <input 
                    type="text"
                    required
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="e.g. RELIANCE.NS"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Use .NS for NSE (India), e.g., RELIANCE.NS</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select 
                    value={type}
                    onChange={(e) => setType(e.target.value as 'Stock' | 'Mutual Fund' | 'Gold Mutual Fund')}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Stock">Stock</option>
                    <option value="Mutual Fund">Mutual Fund</option>
                    <option value="Gold Mutual Fund">Gold Mutual Fund</option>
                  </select>
                </div>
                <div className="col-span-2 grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                    <input 
                      type="number"
                      step="any"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Buy Price (₹)</label>
                    <input 
                      type="number"
                      step="any"
                      required
                      value={buyPrice}
                      onChange={(e) => setBuyPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Current Price (₹)</label>
                    <input 
                      type="number"
                      step="any"
                      required
                      value={currentPrice}
                      onChange={(e) => setCurrentPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Invested Value:</span>
                  <span className="font-bold text-slate-900">₹{investedValue.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Current Value:</span>
                  <span className="font-bold text-blue-600">₹{currentValue.toLocaleString('en-IN')}</span>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : (editingInvestment ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center"
          >
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900">Delete Investment?</h3>
            <p className="text-slate-500 mt-2">This action cannot be undone.</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button 
                onClick={() => setDeletingId(null)}
                className="py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => deleteInvestment(deletingId)}
                className="py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
