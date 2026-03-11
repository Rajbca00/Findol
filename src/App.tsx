import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Transactions from './pages/Transactions';
import Portfolio from './pages/Portfolio';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Loans from './pages/Loans';
import Layout from './components/Layout';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setConfigError(true);
      setLoading(false);
      return;
    }

    // Check active sessions and subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    }).catch(() => {
      setConfigError(true);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-zinc-200 text-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-display font-bold text-zinc-900 mb-2">Setup Required</h1>
          <p className="text-zinc-600 mb-6">
            To get started, you need to connect your Supabase project. Please set the following environment variables in the Secrets panel:
          </p>
          <div className="space-y-3 text-left mb-8">
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <code className="text-xs font-mono text-zinc-500 block mb-1 uppercase tracking-wider">Variable Name</code>
              <code className="text-sm font-mono font-bold text-zinc-900">SUPABASE_URL</code>
            </div>
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <code className="text-xs font-mono text-zinc-500 block mb-1 uppercase tracking-wider">Variable Name</code>
              <code className="text-sm font-mono font-bold text-zinc-900">SUPABASE_ANON_KEY</code>
            </div>
          </div>
          <a 
            href="https://supabase.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-emerald-600 font-semibold hover:underline"
          >
            Go to Supabase Dashboard <ExternalLink size={16} />
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/auth" 
          element={!session ? <Auth /> : <Navigate to="/" />} 
        />
        
        <Route 
          path="/" 
          element={
            session ? (
              <Layout>
                <Dashboard />
              </Layout>
            ) : (
              <Navigate to="/auth" />
            )
          } 
        />

        <Route 
          path="/assets" 
          element={
            session ? (
              <Layout>
                <Assets />
              </Layout>
            ) : (
              <Navigate to="/auth" />
            )
          } 
        />

        <Route 
          path="/transactions" 
          element={
            session ? (
              <Layout>
                <Transactions />
              </Layout>
            ) : (
              <Navigate to="/auth" />
            )
          } 
        />

        <Route 
          path="/portfolio" 
          element={
            session ? (
              <Layout>
                <Portfolio />
              </Layout>
            ) : (
              <Navigate to="/auth" />
            )
          } 
        />

        <Route 
          path="/loans" 
          element={
            session ? (
              <Layout>
                <Loans />
              </Layout>
            ) : (
              <Navigate to="/auth" />
            )
          } 
        />

        <Route 
          path="/analytics" 
          element={
            session ? (
              <Layout>
                <Analytics />
              </Layout>
            ) : (
              <Navigate to="/auth" />
            )
          } 
        />

        <Route 
          path="/settings" 
          element={
            session ? (
              <Layout>
                <Settings />
              </Layout>
            ) : (
              <Navigate to="/auth" />
            )
          } 
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
