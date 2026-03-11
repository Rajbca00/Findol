import React, { useMemo, useRef, useState } from 'react';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Asset, Investment, Loan, LoanPayment, Transaction } from '../types';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const parseJsonSafely = (value: string) => {
  if (!value || !value.trim()) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const starterPrompts = [
  'Can I afford an extra loan prepayment this month?',
  'Is my spending too high compared with my income?',
  'How should I balance debt payoff vs investing?',
];

export default function FinancialCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Ask about cashflow, debt payoff, loan prepayments, or portfolio tradeoffs. I will use your app data as context.'
    }
  ]);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canSend = input.trim().length > 0 && !submitting;

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  const buildFinancialContext = async () => {
    const [assetsRes, investmentsRes, transactionsRes, loansRes, loanPaymentsRes] = await Promise.allSettled([
      supabase.from('assets').select('name,type,value,initial_value'),
      supabase.from('investments').select('name,type,current_value,invested_value'),
      supabase.from('transactions').select('type,amount,category,description,date').order('date', { ascending: false }).limit(50),
      supabase.from('loans').select('name,lender,loan_amount,interest_rate,emi_amount,status'),
      supabase.from('loan_payments').select('loan_id,month,emi_amount,principal_component,interest_component,prepayment_amount,payment_date').order('payment_date', { ascending: false }).limit(24)
    ]);

    const assets = assetsRes.status === 'fulfilled' ? ((assetsRes.value.data || []) as Pick<Asset, 'name' | 'type' | 'value' | 'initial_value'>[]) : [];
    const investments = investmentsRes.status === 'fulfilled' ? ((investmentsRes.value.data || []) as Pick<Investment, 'name' | 'type' | 'current_value' | 'invested_value'>[]) : [];
    const transactions = transactionsRes.status === 'fulfilled' ? ((transactionsRes.value.data || []) as Pick<Transaction, 'type' | 'amount' | 'category' | 'description' | 'date'>[]) : [];
    const loans = loansRes.status === 'fulfilled' ? ((loansRes.value.data || []) as Pick<Loan, 'name' | 'lender' | 'loan_amount' | 'interest_rate' | 'emi_amount' | 'status'>[]) : [];
    const loanPayments = loanPaymentsRes.status === 'fulfilled' ? ((loanPaymentsRes.value.data || []) as Pick<LoanPayment, 'loan_id' | 'month' | 'emi_amount' | 'principal_component' | 'interest_component' | 'prepayment_amount' | 'payment_date'>[]) : [];

    const assetTotal = assets.reduce((sum, asset) => sum + asset.value, 0);
    const investmentTotal = investments.reduce((sum, investment) => sum + investment.current_value, 0);
    const monthlyTransactions = transactions.reduce<Record<string, { income: number; expense: number }>>((acc, transaction) => {
      const month = transaction.date.slice(0, 7);
      if (!acc[month]) acc[month] = { income: 0, expense: 0 };
      if (transaction.type === 'Income') acc[month].income += transaction.amount;
      if (transaction.type === 'Expense') acc[month].expense += transaction.amount;
      return acc;
    }, {});

    return {
      snapshot: {
        totalAssets: assetTotal,
        totalInvestments: investmentTotal,
        netWorthApprox: assetTotal + investmentTotal,
        loanCount: loans.length
      },
      assets,
      investments,
      recentTransactions: transactions.slice(0, 15),
      monthlyCashflow: Object.entries(monthlyTransactions)
        .sort((left, right) => right[0].localeCompare(left[0]))
        .slice(0, 6)
        .map(([month, values]) => ({ month, ...values, net: values.income - values.expense })),
      loans,
      recentLoanPayments: loanPayments
    };
  };

  const sendMessage = async (messageText?: string) => {
    const nextText = (messageText || input).trim();
    if (!nextText) return;

    const nextMessages = [...messages, { role: 'user' as const, content: nextText }];
    setMessages(nextMessages);
    setInput('');
    setSubmitting(true);
    scrollToBottom();

    try {
      const context = await buildFinancialContext();
      const response = await fetch('/api/financial-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          context
        })
      });
      const rawBody = await response.text();
      const data = parseJsonSafely(rawBody);
      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error || rawBody || 'Chat request failed');
      }
      if (!data || typeof data !== 'object' || !('reply' in data)) {
        throw new Error('Chat service returned an invalid response.');
      }

      setMessages((current) => [...current, { role: 'assistant', content: String((data as { reply: string }).reply) }]);
      scrollToBottom();
    } catch (error) {
      console.error('Financial copilot error:', error);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'I could not complete that request.'
        }
      ]);
    } finally {
      setSubmitting(false);
      scrollToBottom();
    }
  };

  const promptButtons = useMemo(
    () => starterPrompts.map((prompt) => (
      <button
        key={prompt}
        type="button"
        onClick={() => sendMessage(prompt)}
        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
      >
        {prompt}
      </button>
    )),
    [messages, submitting]
  );

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-4 z-[70] w-[min(420px,calc(100vw-2rem))] rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-950 px-5 py-4 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="font-display text-lg font-bold">FinDol Copilot</p>
                <p className="text-xs text-slate-300">ChatGPT-powered financial guidance inside your app</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
            Educational guidance only. Use your judgment for high-stakes financial decisions.
          </div>

          <div ref={scrollRef} className="max-h-[55vh] min-h-[320px] space-y-4 overflow-y-auto px-5 py-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            {submitting && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Thinking
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 px-5 py-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {promptButtons}
            </div>
            <div className="flex items-end gap-3">
              <textarea
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about cashflow, loans, investments, or tradeoffs..."
                className="min-h-[84px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                disabled={!canSend}
                onClick={() => sendMessage()}
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-6 right-4 z-[70] inline-flex items-center gap-3 rounded-full bg-slate-950 px-5 py-4 text-white shadow-2xl shadow-slate-900/20 hover:bg-slate-900 transition-colors"
      >
        {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        <span className="text-sm font-semibold">Ask FinDol Copilot</span>
        <Bot size={18} className="text-blue-300" />
      </button>
    </>
  );
}
