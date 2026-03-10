import React, { useEffect, useState } from 'react';
import { 
  User, 
  Bell, 
  Shield, 
  Database, 
  LogOut, 
  ChevronRight,
  CreditCard,
  Globe,
  Moon,
  Sun,
  Mail,
  Smartphone,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    weekly: true
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-display font-bold text-zinc-900">Settings</h1>
        <p className="text-zinc-500">Manage your account preferences and security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Navigation */}
        <div className="space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-semibold transition-colors">
            <User size={20} />
            <span>Profile</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Bell size={20} />
            <span>Notifications</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Shield size={20} />
            <span>Security</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Database size={20} />
            <span>Data & Privacy</span>
          </button>
          <div className="pt-4 border-t border-slate-100 mt-4">
            <button 
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors"
            >
              <LogOut size={20} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Section */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{user?.email?.split('@')[0]}</h3>
                <p className="text-sm text-slate-500">{user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500">
                  <Mail size={16} />
                  <span>{user?.email}</span>
                  <CheckCircle2 size={16} className="text-emerald-500 ml-auto" />
                </div>
              </div>
            </div>
          </section>

          {/* Preferences Section */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-900">Preferences</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Globe size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Currency</p>
                    <p className="text-xs text-slate-500">Indian Rupee (INR)</p>
                  </div>
                </div>
                <button className="text-sm font-semibold text-blue-600 hover:underline">Change</button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    {isDarkMode ? <Moon size={18} className="text-indigo-600" /> : <Sun size={18} className="text-amber-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Appearance</p>
                    <p className="text-xs text-slate-500">{isDarkMode ? 'Dark' : 'Light'} Mode</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Notifications Section */}
          <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-slate-900">Notifications</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">Email Notifications</p>
                  <p className="text-xs text-slate-500">Receive weekly summaries and alerts</p>
                </div>
                <button 
                  onClick={() => toggleNotification('email')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${notifications.email ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications.email ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">Push Notifications</p>
                  <p className="text-xs text-slate-500">Real-time alerts on your devices</p>
                </div>
                <button 
                  onClick={() => toggleNotification('push')}
                  className={`w-12 h-6 rounded-full transition-colors relative ${notifications.push ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications.push ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-red-50 p-6 rounded-2xl border border-red-100 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={20} />
              <h3 className="text-lg font-bold">Danger Zone</h3>
            </div>
            <p className="text-sm text-red-600/80">Once you delete your account, there is no going back. Please be certain.</p>
            <button className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-sm">
              Delete Account
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
