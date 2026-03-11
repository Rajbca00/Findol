import React, { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Wallet,
  Building2,
  Coins,
  Banknote,
  Briefcase,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Asset, AssetType } from '../types';

const ASSET_TYPES: AssetType[] = [
  'Real Estate',
  'Gold',
  'Cash',
  'Crypto',
  'Fixed Deposit',
  'PF/EPF',
  'Savings Account',
  'Other'
];

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  'Real Estate': Building2,
  'Gold': Coins,
  'Cash': Banknote,
  'Crypto': Wallet,
  'Fixed Deposit': Banknote,
  'PF/EPF': Briefcase,
  'Savings Account': Banknote,
  'Other': Wallet
};

type AssetTransaction = {
  asset_id: string;
  to_asset_id?: string | null;
  amount: number;
  type: 'Income' | 'Expense' | 'Transfer';
};

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('Savings Account');
  const [initialValue, setInitialValue] = useState('');
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshingAssetIds, setRefreshingAssetIds] = useState<string[]>([]);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets((data || []) as Asset[]);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAssetCurrentValue = (asset: Asset, transactions: AssetTransaction[]) => {
    return transactions.reduce((currentValue, transaction) => {
      if (transaction.asset_id === asset.id) {
        if (transaction.type === 'Income') return currentValue + transaction.amount;
        return currentValue - transaction.amount;
      }

      if (transaction.type === 'Transfer' && transaction.to_asset_id === asset.id) {
        return currentValue + transaction.amount;
      }

      return currentValue;
    }, asset.initial_value);
  };

  const refreshAssetBalances = async (assetIds?: string[]) => {
    const targetAssets = assetIds?.length
      ? assets.filter((asset) => assetIds.includes(asset.id))
      : assets;

    if (targetAssets.length === 0) return;

    if (assetIds?.length) setRefreshingAssetIds(assetIds);
    else setRefreshingAll(true);

    try {
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('asset_id, to_asset_id, amount, type');

      if (transactionsError) throw transactionsError;

      await Promise.all(
        targetAssets.map((asset) => (
          supabase
            .from('assets')
            .update({
              value: calculateAssetCurrentValue(asset, (transactions || []) as AssetTransaction[]),
              updated_at: new Date().toISOString()
            })
            .eq('id', asset.id)
        ))
      );

      await fetchAssets();
    } catch (error) {
      console.error('Error refreshing asset balances:', error);
      alert('Error refreshing balances. Please try again.');
    } finally {
      setRefreshingAssetIds([]);
      setRefreshingAll(false);
    }
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        name,
        type,
        initial_value: parseFloat(initialValue),
        value: parseFloat(value),
        updated_at: new Date().toISOString()
      };

      if (editingAsset) {
        const { error } = await supabase
          .from('assets')
          .update(payload)
          .eq('id', editingAsset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assets').insert([
          {
            user_id: user.id,
            name,
            type,
            initial_value: parseFloat(initialValue),
            value: parseFloat(value),
            currency: 'INR'
          }
        ]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      fetchAssets();
    } catch (error) {
      console.error('Error saving asset:', error);
      alert('Error saving asset. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingAsset(null);
    setName('');
    setType('Savings Account');
    setInitialValue('');
    setValue('');
  };

  const openEditModal = (asset: Asset) => {
    setEditingAsset(asset);
    setName(asset.name);
    setType(asset.type);
    setInitialValue(asset.initial_value.toString());
    setValue(asset.value.toString());
    setIsModalOpen(true);
  };

  const deleteAsset = async (id: string) => {
    try {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
      setDeletingId(null);
      fetchAssets();
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Error deleting asset. It might be linked to transactions.');
      setDeletingId(null);
    }
  };

  const filteredAssets = assets.filter((asset) => (
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
    || asset.type.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-zinc-900">Assets</h1>
          <p className="text-zinc-500">Manage your investments and holdings.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refreshAssetBalances()}
            disabled={refreshingAll || refreshingAssetIds.length > 0 || loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={refreshingAll ? 'animate-spin' : ''} size={18} />
            Refresh Balances
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
          >
            <Plus size={20} />
            Add New Asset
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors">
          <Filter size={18} />
          Filter
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
        </div>
      ) : filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredAssets.map((asset) => {
              const Icon = TYPE_ICONS[asset.type] || Wallet;
              const isRefreshingAsset = refreshingAssetIds.includes(asset.id);

              return (
                <motion.div
                  key={asset.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Icon size={24} />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          refreshAssetBalances([asset.id]);
                        }}
                        disabled={refreshingAll || isRefreshingAsset}
                        className="p-2 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={isRefreshingAsset ? 'animate-spin' : ''} size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(asset);
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(asset.id);
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{asset.type}</span>
                    <h3 className="text-lg font-display font-bold text-slate-900 mt-1">{asset.name}</h3>
                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-400">Initial Balance</p>
                        <p className="text-base font-semibold text-slate-700">Rs{asset.initial_value.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-slate-400">Current Balance</p>
                        <p className="text-2xl font-display font-bold text-blue-600">Rs{asset.value.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-zinc-200 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
            <Wallet size={32} />
          </div>
          <h3 className="text-lg font-display font-bold text-zinc-900">No assets found</h3>
          <p className="text-zinc-500 mt-1">Start by adding your first investment or account.</p>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="mt-6 inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add Asset
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-xl font-display font-bold">{editingAsset ? 'Edit Asset' : 'Add New Asset'}</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-zinc-400 hover:text-zinc-900"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveAsset} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Asset Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HDFC Bank, Zerodha Portfolio"
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Asset Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AssetType)}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {ASSET_TYPES.map((assetType) => (
                    <option key={assetType} value={assetType}>{assetType}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Initial Balance (Rs)</label>
                  <input
                    type="number"
                    required
                    value={initialValue}
                    onChange={(e) => setInitialValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Current Balance (Rs)</label>
                  <input
                    type="number"
                    required
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Use refresh to recalculate current balance from opening balance and all transactions for the account.
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="flex-1 py-2 border border-zinc-200 text-zinc-600 font-semibold rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : editingAsset ? 'Update Asset' : 'Save Asset'}
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
            <h3 className="text-xl font-display font-bold text-slate-900">Delete Asset?</h3>
            <p className="text-slate-500 mt-2">This action cannot be undone. All data associated with this asset will be lost.</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setDeletingId(null)}
                className="py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAsset(deletingId)}
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
