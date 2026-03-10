import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowRightLeft,
  Search,
  Filter,
  Loader2,
  Calendar,
  Tag,
  Wallet,
  Edit2,
  Trash2,
  Settings
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Asset, Transaction, TransactionCategory, Category } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const DEFAULT_CATEGORIES: string[] = [
  'Food', 'Rent', 'Shopping', 'Utilities', 'Transport', 'Investment', 'Income', 'Transfer', 'Other'
];

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  
  // Form state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [type, setType] = useState<'Income' | 'Expense' | 'Transfer'>('Expense');
  const [amount, setAmount] = useState('');
  const [assetId, setAssetId] = useState('');
  const [toAssetId, setToAssetId] = useState('');
  const [category, setCategory] = useState<TransactionCategory>('Other');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  // Category management state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'Income' | 'Expense'>('Expense');

  // Delete confirmation state
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

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
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const numAmount = parseFloat(amount);
      
      if (editingTransaction) {
        // 1. Revert old transaction impact on assets
        const oldSourceAsset = assets.find(a => a.id === editingTransaction.asset_id);
        if (oldSourceAsset) {
          let revertedValue = oldSourceAsset.value;
          if (editingTransaction.type === 'Income') revertedValue -= editingTransaction.amount;
          else revertedValue += editingTransaction.amount;
          await supabase.from('assets').update({ value: revertedValue }).eq('id', editingTransaction.asset_id);
        }

        if (editingTransaction.type === 'Transfer' && editingTransaction.to_asset_id) {
          const oldTargetAsset = assets.find(a => a.id === editingTransaction.to_asset_id);
          if (oldTargetAsset) {
            await supabase.from('assets').update({ value: oldTargetAsset.value - editingTransaction.amount }).eq('id', editingTransaction.to_asset_id);
          }
        }

        // 2. Update Transaction
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
        // 1. Insert Transaction
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

      // 3. Apply new transaction impact on assets
      // Note: This is a simplified approach. In production, use database triggers or RPC.
      const sourceAsset = assets.find(a => a.id === assetId);
      if (sourceAsset) {
        let newValue = sourceAsset.value;
        if (type === 'Income') newValue += numAmount;
        else newValue -= numAmount;

        await supabase.from('assets').update({ value: newValue }).eq('id', assetId);
      }

      if (type === 'Transfer' && toAssetId) {
        const targetAsset = assets.find(a => a.id === toAssetId);
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
      // 1. Revert transaction impact on assets
      const sourceAsset = assets.find(a => a.id === transaction.asset_id);
      if (sourceAsset) {
        let revertedValue = sourceAsset.value;
        if (transaction.type === 'Income') revertedValue -= transaction.amount;
        else revertedValue += transaction.amount;
        await supabase.from('assets').update({ value: revertedValue }).eq('id', transaction.asset_id);
      }

      if (transaction.type === 'Transfer' && transaction.to_asset_id) {
        const targetAsset = assets.find(a => a.id === transaction.to_asset_id);
        if (targetAsset) {
          await supabase.from('assets').update({ value: targetAsset.value - transaction.amount }).eq('id', transaction.to_asset_id);
        }
      }

      // 2. Delete transaction
      const { error } = await supabase.from('transactions').delete().eq('id', transaction.id);
      if (error) throw error;
      
      setDeletingTransaction(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Error deleting transaction.');
      setDeletingTransaction(null);
    }
  };

  const openEditModal = (transaction: Transaction) => {
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
    setAmount('');
    setAssetId('');
    setToAssetId('');
    setCategory('Other');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
  };

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

      {/* Transactions List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search transactions..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
              <Filter size={18} />
              Filter
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Description</th>
                  <th className="px-6 py-4 font-semibold">Category</th>
                  <th className="px-6 py-4 font-semibold">Account</th>
                  <th className="px-6 py-4 font-semibold text-right">Amount</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{t.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {assets.find(a => a.id === t.asset_id)?.name}
                      {t.type === 'Transfer' && ` → ${assets.find(a => a.id === t.to_asset_id)?.name}`}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${
                      t.type === 'Income' ? 'text-emerald-600' : 
                      t.type === 'Expense' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {t.type === 'Income' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(t);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingTransaction(t);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
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
            <h3 className="text-lg font-display font-bold text-slate-900">No transactions yet</h3>
            <p className="text-slate-500 mt-1">Start tracking your spending and income.</p>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
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
              {(['Expense', 'Income', 'Transfer'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                    type === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
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
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (₹{a.value.toLocaleString('en-IN')})</option>
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
                    {assets.filter(a => a.id !== assetId).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
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
                      {DEFAULT_CATEGORIES.filter(c => c !== 'Transfer').map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                    {categories.filter(c => c.type === (type === 'Income' ? 'Income' : 'Expense')).length > 0 && (
                      <optgroup label="Custom">
                        {categories
                          .filter(c => c.type === (type === 'Income' ? 'Income' : 'Expense'))
                          .map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))
                        }
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
      {/* Category Management Modal */}
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
              {/* Add New Category */}
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

              {/* Categories List */}
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Custom Categories</h3>
                  {categories.length > 0 ? categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${cat.type === 'Income' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="font-medium text-slate-900">{cat.name}</span>
                      </div>
                      <button 
                        onClick={() => deleteCategory(cat.id)}
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
                    {DEFAULT_CATEGORIES.map(cat => (
                      <span key={cat} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
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
