import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Briefcase,
  Target,
  Plus,
  Edit2,
  Trash2,
  Search,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Investment } from '../types';
import { motion } from 'motion/react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip
} from 'recharts';

const COLORS = ['#0f766e', '#2563eb', '#0891b2', '#f59e0b', '#dc2626', '#7c3aed', '#4f46e5', '#059669'];

type AllocationDatum = {
  name: string;
  value: number;
  percentage: number;
};

export default function Portfolio() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<'new' | 'existing'>('new');
  const [selectedInvestmentId, setSelectedInvestmentId] = useState('');

  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [type, setType] = useState<'Stock' | 'Mutual Fund' | 'Gold Mutual Fund'>('Stock');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const investedValue = (parseFloat(quantity) || 0) * (parseFloat(buyPrice) || 0);
  const currentValue = (parseFloat(quantity) || 0) * (parseFloat(currentPrice) || 0);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchingTicker, setSearchingTicker] = useState(false);
  const [lastSearchedName, setLastSearchedName] = useState('');

  useEffect(() => {
    fetchInvestments();
  }, []);

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
      const {
        data: { user }
      } = await supabase.auth.getUser();
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
      } else if (formMode === 'existing') {
        const existingInvestment = investments.find((investment) => investment.id === selectedInvestmentId);
        if (!existingInvestment) throw new Error('Select an existing fund');

        const additionalQuantity = parseFloat(quantity);
        const additionalInvestedValue = investedValue;
        const mergedQuantity = (existingInvestment.quantity || 0) + additionalQuantity;
        const mergedInvestedValue = (existingInvestment.invested_value || 0) + additionalInvestedValue;
        const mergedCurrentPrice = parseFloat(currentPrice);
        const mergedBuyPrice = mergedQuantity > 0 ? mergedInvestedValue / mergedQuantity : 0;

        const { error } = await supabase
          .from('investments')
          .update({
            quantity: mergedQuantity,
            buy_price: mergedBuyPrice,
            current_price: mergedCurrentPrice,
            invested_value: mergedInvestedValue,
            current_value: mergedQuantity * mergedCurrentPrice,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingInvestment.id);
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
      const tickers = Array.from(new Set(investments.map((investment) => investment.ticker).filter(Boolean)));
      if (tickers.length === 0) {
        alert('No tickers found to refresh.');
        return;
      }

      const response = await fetch(`/api/prices?tickers=${tickers.join(',')}`);
      if (!response.ok) throw new Error('Failed to fetch prices');

      const priceData = await response.json();

      const updates = investments
        .map((investment) => {
          const match = priceData.find((price: any) => price.ticker === investment.ticker && !price.error);
          if (!match) return null;

          const newPrice = parseFloat(match.price);
          return supabase
            .from('investments')
            .update({
              current_price: newPrice,
              current_value: investment.quantity * newPrice,
              updated_at: new Date().toISOString()
            })
            .eq('id', investment.id);
        })
        .filter(Boolean);

      if (updates.length > 0) {
        await Promise.all(updates);
        fetchInvestments();
        alert('Prices updated successfully using Yahoo Finance.');
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
    setFormMode('new');
    setSelectedInvestmentId('');
    setName('');
    setTicker('');
    setType('Stock');
    setQuantity('');
    setBuyPrice('');
    setCurrentPrice('');
    setLastSearchedName('');
  };

  const openEditModal = (investment: Investment) => {
    setEditingInvestment(investment);
    setFormMode('new');
    setSelectedInvestmentId('');
    setName(investment.name);
    setTicker(investment.ticker || '');
    setType(investment.type);
    setQuantity(investment.quantity?.toString() || '');
    setBuyPrice(investment.buy_price?.toString() || '');
    setCurrentPrice(investment.current_price?.toString() || '');
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

        if (data.name && name.length < data.name.length) {
          setName(data.name);
        }

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

  const totalInvested = investments.reduce((sum, investment) => sum + (investment.invested_value || 0), 0);
  const currentTotal = investments.reduce((sum, investment) => sum + investment.current_value, 0);
  const totalPL = currentTotal - totalInvested;
  const plPercentage = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  const chartData: AllocationDatum[] = investments
    .filter((investment) => investment.current_value > 0)
    .sort((left, right) => right.current_value - left.current_value)
    .map((investment) => ({
      name: investment.name,
      value: investment.current_value,
      percentage: currentTotal > 0 ? (investment.current_value / currentTotal) * 100 : 0
    }));
  const selectedInvestment = investments.find((investment) => investment.id === selectedInvestmentId) || null;

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div whileHover={{ y: -4 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Briefcase size={20} />
            </div>
          </div>
          <p className="text-sm text-slate-500 font-medium">Total Invested</p>
          <h2 className="text-2xl font-display font-bold mt-1">Rs{totalInvested.toLocaleString('en-IN')}</h2>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Target size={20} />
            </div>
          </div>
          <p className="text-sm text-slate-500 font-medium">Current Value</p>
          <h2 className="text-2xl font-display font-bold mt-1">Rs{currentTotal.toLocaleString('en-IN')}</h2>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalPL >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              {totalPL >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <span className={`text-sm font-bold flex items-center gap-1 ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalPL >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(plPercentage).toFixed(2)}%
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">Total P&amp;L</p>
          <h2 className={`text-2xl font-display font-bold mt-1 ${totalPL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalPL >= 0 ? '+' : '-'}Rs{Math.abs(totalPL).toLocaleString('en-IN')}
          </h2>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-display font-bold mb-6">Portfolio Allocation</h3>
          {chartData.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-6 items-center">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={108}
                      paddingAngle={2}
                      stroke="none"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number, _name, item: any) => [
                        `Rs${value.toLocaleString('en-IN')} (${item?.payload?.percentage?.toFixed(1) || '0.0'}%)`,
                        item?.payload?.name || 'Holding'
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {chartData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="truncate text-sm font-medium text-slate-700">{entry.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-slate-900">{entry.percentage.toFixed(1)}%</div>
                      <div className="text-xs text-slate-500">Rs{entry.value.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 text-sm">
              Add investments with a current value above zero to view allocation.
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-display font-bold mb-6">Asset Performance</h3>
          <div className="space-y-4">
            {investments.map((investment, index) => {
              const pl = investment.current_value - (investment.invested_value || 0);
              const percent = (investment.invested_value || 0) > 0 ? (pl / (investment.invested_value || 0)) * 100 : 0;

              return (
                <div key={investment.id} className="group flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <div>
                      <h4 className="font-semibold text-slate-900">{investment.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-600">{investment.ticker}</span>
                        <span className="text-xs text-slate-500">{investment.type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-bold text-slate-900">Rs{investment.current_value.toLocaleString('en-IN')}</p>
                      <p className="text-[10px] text-slate-400">{investment.quantity} @ Rs{investment.current_price}</p>
                      <p className={`text-xs font-bold flex items-center justify-end gap-1 ${pl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {pl >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(percent).toFixed(1)}%
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(investment)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeletingId(investment.id)}
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
              {!editingInvestment && (
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFormMode('new');
                      setSelectedInvestmentId('');
                    }}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      formMode === 'new' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    New Investment
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMode('existing')}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      formMode === 'existing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Add To Existing
                  </button>
                </div>
              )}

              {!editingInvestment && formMode === 'existing' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Existing Fund</label>
                  <select
                    required
                    value={selectedInvestmentId}
                    onChange={(e) => {
                      const investment = investments.find((item) => item.id === e.target.value);
                      setSelectedInvestmentId(e.target.value);
                      if (!investment) return;
                      setName(investment.name);
                      setTicker(investment.ticker || '');
                      setType(investment.type);
                      setCurrentPrice(investment.current_price?.toString() || '');
                    }}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select existing investment</option>
                    {investments.map((investment) => (
                      <option key={investment.id} value={investment.id}>
                        {investment.name} ({investment.ticker})
                      </option>
                    ))}
                  </select>
                  {selectedInvestment && (
                    <p className="mt-2 text-xs text-slate-500">
                      Existing qty: {selectedInvestment.quantity} | Avg buy: Rs{selectedInvestment.buy_price.toLocaleString('en-IN')} | Current: Rs{selectedInvestment.current_price.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              )}

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
                      disabled={!editingInvestment && formMode === 'existing'}
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={lookupTicker}
                      disabled={searchingTicker || !name.trim() || (!editingInvestment && formMode === 'existing')}
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
                    disabled={!editingInvestment && formMode === 'existing'}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Use .NS for NSE (India), e.g. RELIANCE.NS</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'Stock' | 'Mutual Fund' | 'Gold Mutual Fund')}
                    disabled={!editingInvestment && formMode === 'existing'}
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Buy Price (Rs)</label>
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Current Price (Rs)</label>
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
                  <span className="text-slate-600">
                    {formMode === 'existing' && !editingInvestment ? 'Additional Invested Value:' : 'Invested Value:'}
                  </span>
                  <span className="font-bold text-slate-900">Rs{investedValue.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">
                    {formMode === 'existing' && !editingInvestment ? 'Additional Current Value:' : 'Current Value:'}
                  </span>
                  <span className="font-bold text-blue-600">Rs{currentValue.toLocaleString('en-IN')}</span>
                </div>
                {formMode === 'existing' && !editingInvestment && selectedInvestment && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Merged Quantity:</span>
                      <span className="font-bold text-slate-900">
                        {((selectedInvestment.quantity || 0) + (parseFloat(quantity) || 0)).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Merged Current Value:</span>
                      <span className="font-bold text-blue-600">
                        Rs{((((selectedInvestment.quantity || 0) + (parseFloat(quantity) || 0)) * (parseFloat(currentPrice) || 0))).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </>
                )}
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
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : editingInvestment ? 'Update' : formMode === 'existing' ? 'Add To Fund' : 'Save'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

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
