import React, { useEffect, useState } from 'react';
import {
  Plus,
  ArrowRightLeft,
  Search,
  Filter,
  Loader2,
  Edit2,
  Trash2,
  Settings,
  CalendarRange,
  BarChart3
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { supabase } from '../lib/supabase';
import { Asset, Category, Transaction, TransactionCategory } from '../types';

const DEFAULT_CATEGORIES: string[] = [
  'Food', 'Rent', 'Shopping', 'Utilities', 'Transport', 'Investment', 'Income', 'Transfer', 'Other'
];
const CHART_COLORS = ['#0f766e', '#f97316', '#2563eb', '#dc2626', '#7c3aed', '#ca8a04', '#059669', '#db2777'];

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [type, setType] = useState<'Income' | 'Expense' | 'Transfer'>('Expense');
  const [amount, setAmount] = useState('');
  const [assetId, setAssetId] = useState('');
  const [toAssetId, setToAssetId] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('Other');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'Income' | 'Expense'>('Expense');

  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assetsRes, transRes, catsRes] = await Promise.all([
        supabase.from('assets').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('categories').select('*')
      ]);

      if (assetsRes.error) throw assetsRes.error;
      if (transRes.error) throw transRes.error;
      if (catsRes.error) throw catsRes.error;

      setAssets(assetsRes.data || []);
      setTransactions(transRes.data || []);
      setCategories(catsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName) return;

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('categories').insert([
        { user_id: user.id, name: newCategoryName, type: newCategoryType }
      ]);
      if (error) throw error;

      setNewCategoryName('');
      fetchData();
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const numAmount = parseFloat(amount);

      if (editingTransaction) {
        const oldSourceAsset = assets.find((asset) => asset.id === editingTransaction.asset_id);
        if (oldSourceAsset) {
          let revertedValue = oldSourceAsset.value;
          if (editingTransaction.type === 'Income') revertedValue -= editingTransaction.amount;
          else revertedValue += editingTransaction.amount;
          await supabase.from('assets').update({ value: revertedValue }).eq('id', editingTransaction.asset_id);
        }

        if (editingTransaction.type === 'Transfer' && editingTransaction.to_asset_id) {
          const oldTargetAsset = assets.find((asset) => asset.id === editingTransaction.to_asset_id);
          if (oldTargetAsset) {
            await supabase
              .from('assets')
              .update({ value: oldTargetAsset.value - editingTransaction.amount })
              .eq('id', editingTransaction.to_asset_id);
          }
        }

        const { error: transError } = await supabase.from('transactions').update({
          asset_id: assetId,
          to_asset_id: type === 'Transfer' ? toAssetId : null,
          amount: numAmount,
          type,
          category: type === 'Transfer' ? 'Transfer' : category,
          description,
          date
        }).eq('id', editingTransaction.id);

        if (transError) throw transError;
      } else {
        const { error: transError } = await supabase.from('transactions').insert([
          {
            user_id: user.id,
            asset_id: assetId,
            to_asset_id: type === 'Transfer' ? toAssetId : null,
            amount: numAmount,
            type,
            category: type === 'Transfer' ? 'Transfer' : category,
            description,
            date
          }
        ]);

        if (transError) throw transError;
      }

      const sourceAsset = assets.find((asset) => asset.id === assetId);
      if (sourceAsset) {
        let newValue = sourceAsset.value;
        if (type === 'Income') newValue += numAmount;
        else newValue -= numAmount;

        await supabase.from('assets').update({ value: newValue }).eq('id', assetId);
      }

      if (type === 'Transfer' && toAssetId) {
        const targetAsset = assets.find((asset) => asset.id === toAssetId);
        if (targetAsset) {
          await supabase.from('assets').update({ value: targetAsset.value + numAmount }).eq('id', toAssetId);
        }
      }

      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Error saving transaction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTransaction = async (transaction: Transaction) => {
    try {
      const sourceAsset = assets.find((asset) => asset.id === transaction.asset_id);
      if (sourceAsset) {
        let revertedValue = sourceAsset.value;
        if (transaction.type === 'Income') revertedValue -= transaction.amount;
        else revertedValue += transaction.amount;
        await supabase.from('assets').update({ value: revertedValue }).eq('id', transaction.asset_id);
      }

      if (transaction.type === 'Transfer' && transaction.to_asset_id) {
        const targetAsset = assets.find((asset) => asset.id === transaction.to_asset_id);
        if (targetAsset) {
          await supabase.from('assets').update({ value: targetAsset.value - transaction.amount }).eq('id', transaction.to_asset_id);
        }
      }

      const { error } = await supabase.from('transactions').delete().eq('id', transaction.id);
      if (error) throw error;

      setDeletingTransaction(null);
      setSelectedTransactionId((currentId) => currentId === transaction.id ? null : currentId);
      fetchData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Error deleting transaction.');
      setDeletingTransaction(null);
    }
  };

  const openEditModal = (transaction: Transaction) => {
    setSelectedTransactionId(transaction.id);
    setEditingTransaction(transaction);
    setType(transaction.type);
    setAmount(transaction.amount.toString());
    setAssetId(transaction.asset_id);
    setToAssetId(transaction.to_asset_id || '');
    setCategory(transaction.category);
    setDescription(transaction.description);
    setDate(transaction.date);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingTransaction(null);
    setType('Expense');
    setAmount('');
    setAssetId('');
    setToAssetId('');
    setCategory('Other');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const getAssetName = (id?: string) => assets.find((asset) => asset.id === id)?.name || 'Unknown account';
  const getSignedAmount = (transaction: Transaction) => (
    transaction.type === 'Income' ? transaction.amount : -transaction.amount
  );
  const formatCurrency = (value: number) => `Rs${Math.abs(value).toLocaleString('en-IN')}`;
  const formatGroupDate = (value: string) => new Date(value).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const formatMonthLabel = (value: string) => new Date(`${value}-01`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  });
  const scopedAssetIds = new Set(
    selectedAccountId ? [selectedAccountId] : assets.map((asset) => asset.id)
  );
  const openingBalance = assets
    .filter((asset) => scopedAssetIds.has(asset.id))
    .reduce((sum, asset) => sum + asset.initial_value, 0);
  const getScopedTransactionImpact = (transaction: Transaction) => {
    let impact = 0;

    if (scopedAssetIds.has(transaction.asset_id)) {
      impact += getSignedAmount(transaction);
    }

    if (transaction.type === 'Transfer' && transaction.to_asset_id && scopedAssetIds.has(transaction.to_asset_id)) {
      impact += transaction.amount;
    }

    return impact;
  };

  const accountScopedTransactions = transactions.filter((transaction) => {
    const matchesAccount = !selectedAccountId
      || transaction.asset_id === selectedAccountId
      || transaction.to_asset_id === selectedAccountId;

    return matchesAccount;
  });

  const availableMonthKeys = Array.from(
    new Set(accountScopedTransactions.map((transaction) => transaction.date.slice(0, 7)))
  ).sort((left, right) => right.localeCompare(left));

  useEffect(() => {
    if (availableMonthKeys.length === 0) {
      if (selectedMonth) setSelectedMonth('');
      return;
    }

    if (!selectedMonth || !availableMonthKeys.includes(selectedMonth)) {
      setSelectedMonth(availableMonthKeys[0]);
    }
  }, [availableMonthKeys, selectedMonth]);

  const monthTransactions = accountScopedTransactions.filter((transaction) => (
    !selectedMonth || transaction.date.slice(0, 7) === selectedMonth
  ));

  const filteredTransactions = monthTransactions.filter((transaction) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      transaction.description,
      transaction.category,
      transaction.type,
      getAssetName(transaction.asset_id),
      getAssetName(transaction.to_asset_id)
    ].some((value) => value.toLowerCase().includes(query));
  });

  const selectedMonthStart = selectedMonth ? `${selectedMonth}-01` : '';
  const monthOpeningBalance = selectedMonth
    ? openingBalance + accountScopedTransactions
      .filter((transaction) => transaction.date < selectedMonthStart)
      .reduce((sum, transaction) => sum + getScopedTransactionImpact(transaction), 0)
    : openingBalance;
  const monthNet = monthTransactions.reduce((sum, transaction) => sum + getScopedTransactionImpact(transaction), 0);
  const monthClosingBalance = monthOpeningBalance + monthNet;
  const monthIncome = monthTransactions
    .filter((transaction) => transaction.type === 'Income')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthExpense = monthTransactions
    .filter((transaction) => transaction.type === 'Expense')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthTransferCount = monthTransactions.filter((transaction) => transaction.type === 'Transfer').length;
  const expenseAnalysisData = monthTransactions
    .filter((transaction) => transaction.type === 'Expense')
    .reduce((acc, transaction) => {
      const existing = acc.find((item) => item.name === transaction.category);
      if (existing) {
        existing.value += transaction.amount;
      } else {
        acc.push({ name: transaction.category, value: transaction.amount });
      }
      return acc;
    }, [] as { name: string; value: number }[])
    .sort((left, right) => right.value - left.value);
  const sortedFilteredTransactions = [...filteredTransactions].sort((left, right) => {
    if (left.date === right.date) return right.created_at.localeCompare(left.created_at);
    return right.date.localeCompare(left.date);
  });
  const selectedTransaction = selectedTransactionId
    ? filteredTransactions.find((transaction) => transaction.id === selectedTransactionId) || null
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500">Track your income, expenses, and transfers.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Settings size={18} />
            Manage Categories
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
          >
            <Plus size={20} />
            Add Transaction
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Opening Balance</p>
          <div className={`mt-2 text-2xl font-display font-bold ${monthOpeningBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
            {monthOpeningBalance >= 0 ? '' : '-'}{formatCurrency(monthOpeningBalance)}
          </div>
          <p className="mt-2 text-sm text-slate-500">Balance at the start of {selectedMonth ? formatMonthLabel(selectedMonth) : 'this period'}.</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Income vs Expense</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <div className="text-sm text-emerald-600 font-semibold">+{formatCurrency(monthIncome)}</div>
              <div className="text-sm text-red-600 font-semibold">-{formatCurrency(monthExpense)}</div>
            </div>
            <div className={`text-2xl font-display font-bold ${monthIncome - monthExpense >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {monthIncome - monthExpense >= 0 ? '+' : '-'}{formatCurrency(monthIncome - monthExpense)}
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-500">Net flow for the selected month.</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Closing Balance</p>
          <div className={`mt-2 text-2xl font-display font-bold ${monthClosingBalance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
            {monthClosingBalance >= 0 ? '' : '-'}{formatCurrency(monthClosingBalance)}
          </div>
          <p className="mt-2 text-sm text-slate-500">After all month activity across the selected scope.</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Activity</p>
          <div className="mt-2 text-2xl font-display font-bold text-slate-900">{monthTransactions.length}</div>
          <p className="mt-2 text-sm text-slate-500">{monthTransferCount} transfers and {expenseAnalysisData.length} expense categories in this month.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-900">
                <BarChart3 className="text-rose-500" size={18} />
                <h2 className="text-lg font-display font-bold">Expense Analysis</h2>
              </div>
              <p className="text-sm text-slate-500">Category split for {selectedMonth ? formatMonthLabel(selectedMonth) : 'the selected period'}.</p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Total Expense</div>
              <div className="text-xl font-display font-bold text-red-600">-{formatCurrency(monthExpense)}</div>
            </div>
          </div>

          {expenseAnalysisData.length > 0 ? (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px] gap-6 items-center">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseAnalysisData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={108}
                      paddingAngle={2}
                    >
                      {expenseAnalysisData.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                {expenseAnalysisData.slice(0, 6).map((item, index) => {
                  const share = monthExpense > 0 ? (item.value / monthExpense) * 100 : 0;

                  return (
                    <div key={item.name} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span className="font-medium text-slate-700 truncate">{item.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{share.toFixed(1)}% of monthly expenses</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <BarChart3 size={26} />
              </div>
              <h3 className="mt-4 text-lg font-display font-bold text-slate-900">No expenses in this month</h3>
              <p className="mt-1 text-sm text-slate-500">Pick a different month or add expense transactions to see the breakdown.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 text-slate-900">
            <CalendarRange className="text-blue-600" size={18} />
            <h2 className="text-lg font-display font-bold">Month View</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Select a month to focus the ledger and analytics.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl text-slate-700 px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {availableMonthKeys.map((monthKey) => (
                  <option key={monthKey} value={monthKey}>
                    {formatMonthLabel(monthKey)}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Visible transactions</span>
                <span className="font-semibold text-slate-900">{filteredTransactions.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Month total impact</span>
                <span className={`font-semibold ${monthNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {monthNet >= 0 ? '+' : '-'}{formatCurrency(monthNet)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">Top spend category</span>
                <span className="font-semibold text-slate-900">{expenseAnalysisData[0]?.name || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="relative min-w-[220px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full appearance-none bg-white border border-slate-200 rounded-xl text-slate-600 pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Accounts</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : sortedFilteredTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Account</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedFilteredTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    onClick={() => setSelectedTransactionId(transaction.id)}
                    className={`cursor-pointer transition-colors group ${
                      selectedTransactionId === transaction.id ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-4 py-4 text-sm text-slate-500 whitespace-nowrap">
                      {formatGroupDate(transaction.date)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{transaction.description}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                        {transaction.category}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {getAssetName(transaction.asset_id)}
                      {transaction.type === 'Transfer' && ` -> ${getAssetName(transaction.to_asset_id)}`}
                    </td>
                    <td
                      className={`px-4 py-4 text-right font-bold ${
                        transaction.type === 'Income'
                          ? 'text-emerald-600'
                          : transaction.type === 'Expense'
                            ? 'text-red-600'
                            : 'text-blue-600'
                      }`}
                    >
                      {transaction.type === 'Income' ? '+' : '-'}
                      Rs{transaction.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div
                        className={`flex justify-end gap-1 transition-opacity ${
                          selectedTransactionId === transaction.id ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(transaction);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                          aria-label={`Edit ${transaction.description}`}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTransactionId(transaction.id);
                            setDeletingTransaction(transaction);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                          aria-label={`Delete ${transaction.description}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <ArrowRightLeft size={32} />
            </div>
            <h3 className="text-lg font-display font-bold text-slate-900">
              {transactions.length > 0 ? 'No transactions in this month' : 'No transactions yet'}
            </h3>
            <p className="text-slate-500 mt-1">
              {transactions.length > 0 ? 'Try a different month, account, or search term.' : 'Start tracking your spending and income.'}
            </p>
          </div>
        )}
      </div>

      {selectedTransaction && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Selected Transaction</p>
            <div className="text-lg font-display font-bold text-slate-900">{selectedTransaction.description}</div>
            <div className="text-sm text-slate-500">
              {selectedTransaction.type} in {selectedTransaction.category} on {formatGroupDate(selectedTransaction.date)}
            </div>
            <div className="text-sm text-slate-500">
              {getAssetName(selectedTransaction.asset_id)}
              {selectedTransaction.type === 'Transfer' && ` -> ${getAssetName(selectedTransaction.to_asset_id)}`}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => openEditModal(selectedTransaction)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Edit2 size={16} />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setDeletingTransaction(selectedTransaction)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-display font-bold">{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</h2>
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

            <div className="flex p-1 bg-slate-100 mx-6 mt-6 rounded-xl">
              {(['Expense', 'Income', 'Transfer'] as const).map((transactionType) => (
                <button
                  type="button"
                  key={transactionType}
                  onClick={() => setType(transactionType)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    type === transactionType ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {transactionType}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount (Rs)</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {type === 'Transfer' ? 'From Account' : 'Account'}
                </label>
                <select
                  required
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select Account</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} (Rs{asset.value.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              {type === 'Transfer' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To Account</label>
                  <select
                    required
                    value={toAssetId}
                    onChange={(e) => setToAssetId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Select Target Account</option>
                    {assets.filter((asset) => asset.id !== assetId).map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {type !== 'Transfer' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <optgroup label="Default">
                      {DEFAULT_CATEGORIES.filter((defaultCategory) => defaultCategory !== 'Transfer').map((defaultCategory) => (
                        <option key={defaultCategory} value={defaultCategory}>
                          {defaultCategory}
                        </option>
                      ))}
                    </optgroup>
                    {categories.filter((customCategory) => customCategory.type === (type === 'Income' ? 'Income' : 'Expense')).length > 0 && (
                      <optgroup label="Custom">
                        {categories
                          .filter((customCategory) => customCategory.type === (type === 'Income' ? 'Income' : 'Expense'))
                          .map((customCategory) => (
                            <option key={customCategory.id} value={customCategory.name}>
                              {customCategory.name}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What was this for?"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : editingTransaction ? 'Update Transaction' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-display font-bold">Manage Categories</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-900">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <form onSubmit={handleAddCategory} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name..."
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <select
                    value={newCategoryType}
                    onChange={(e) => setNewCategoryType(e.target.value as 'Income' | 'Expense')}
                    className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    <option value="Expense">Expense</option>
                    <option value="Income">Income</option>
                  </select>
                  <button
                    type="submit"
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </form>

              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Custom Categories</h3>
                  {categories.length > 0 ? categories.map((customCategory) => (
                    <div key={customCategory.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${customCategory.type === 'Income' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="font-medium text-slate-900">{customCategory.name}</span>
                      </div>
                      <button
                        onClick={() => deleteCategory(customCategory.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-500 italic">No custom categories added yet.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Default Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_CATEGORIES.map((defaultCategory) => (
                      <span key={defaultCategory} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                        {defaultCategory}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {deletingTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center"
          >
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900">Delete Transaction?</h3>
            <p className="text-slate-500 mt-2">This action cannot be undone. The asset balances will be adjusted accordingly.</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setDeletingTransaction(null)}
                className="py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTransaction(deletingTransaction)}
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
