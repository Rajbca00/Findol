import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Loader2,
  Landmark,
  Edit2,
  Trash2,
  CalendarRange,
  IndianRupee,
  Percent,
  WalletCards
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { Loan, LoanPayment } from '../types';

const formatCurrency = (value: number) => `Rs${Math.round(value).toLocaleString('en-IN')}`;
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);
const getMonthFromDate = (value: string) => value.slice(0, 7);
const formatMonth = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

const calculateAmortization = (principal: number, annualRate: number, emi: number) => {
  if (principal <= 0) {
    return { months: 0, totalInterest: 0, isPayoffPossible: true };
  }

  if (emi <= 0) {
    return { months: null, totalInterest: null, isPayoffPossible: false };
  }

  const monthlyRate = annualRate / 1200;

  if (monthlyRate <= 0) {
    return {
      months: Math.ceil(principal / emi),
      totalInterest: 0,
      isPayoffPossible: true
    };
  }

  if (emi <= principal * monthlyRate) {
    return { months: null, totalInterest: null, isPayoffPossible: false };
  }

  let balance = principal;
  let months = 0;
  let totalInterest = 0;

  while (balance > 0.01 && months < 1200) {
    const interest = balance * monthlyRate;
    const principalPaid = Math.min(emi - interest, balance);

    if (principalPaid <= 0) {
      return { months: null, totalInterest: null, isPayoffPossible: false };
    }

    totalInterest += interest;
    balance -= principalPaid;
    months += 1;
  }

  return {
    months,
    totalInterest: Math.max(totalInterest, 0),
    isPayoffPossible: true
  };
};

const formatTenure = (months: number | null) => {
  if (months === null) return 'Not closing';
  if (months <= 0) return '0 months';

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) return `${remainingMonths} month${remainingMonths === 1 ? '' : 's'}`;
  if (remainingMonths === 0) return `${years} year${years === 1 ? '' : 's'}`;

  return `${years}y ${remainingMonths}m`;
};

export default function Loans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<LoanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [loanName, setLoanName] = useState('');
  const [lender, setLender] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [loanStatus, setLoanStatus] = useState<'Active' | 'Closed'>('Active');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<LoanPayment | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentEmiAmount, setPaymentEmiAmount] = useState('');
  const [principalComponent, setPrincipalComponent] = useState('');
  const [interestComponent, setInterestComponent] = useState('');
  const [prepaymentAmount, setPrepaymentAmount] = useState('0');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [calculatorPrepayment, setCalculatorPrepayment] = useState('');
  const [calculatorEmi, setCalculatorEmi] = useState('');

  const [submittingLoan, setSubmittingLoan] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [deletingLoanId, setDeletingLoanId] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [loansRes, paymentsRes] = await Promise.all([
        supabase.from('loans').select('*').order('created_at', { ascending: false }),
        supabase.from('loan_payments').select('*').order('month', { ascending: false })
      ]);

      if (loansRes.error) throw loansRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const nextLoans = loansRes.data || [];
      const nextPayments = paymentsRes.data || [];

      setLoans(nextLoans);
      setPayments(nextPayments);
      setSelectedLoanId((current) => {
        if (current && nextLoans.some((loan) => loan.id === current)) return current;
        return nextLoans[0]?.id || null;
      });
    } catch (error) {
      console.error('Error fetching loans data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedLoan = loans.find((loan) => loan.id === selectedLoanId) || null;
  const selectedLoanPayments = useMemo(
    () => payments
      .filter((payment) => payment.loan_id === selectedLoanId)
      .sort((left, right) => right.month.localeCompare(left.month)),
    [payments, selectedLoanId]
  );

  const loanSummaries = useMemo(() => {
    return loans.map((loan) => {
      const loanPayments = payments.filter((payment) => payment.loan_id === loan.id);
      const totalPrincipalPaid = loanPayments.reduce((sum, payment) => sum + payment.principal_component, 0);
      const totalInterestPaid = loanPayments.reduce((sum, payment) => sum + payment.interest_component, 0);
      const totalPrepaid = loanPayments.reduce((sum, payment) => sum + payment.prepayment_amount, 0);
      const totalPaid = loanPayments.reduce((sum, payment) => sum + payment.emi_amount + payment.prepayment_amount, 0);
      const outstanding = Math.max(loan.loan_amount - totalPrincipalPaid - totalPrepaid, 0);
      const latestPayment = loanPayments.sort((a, b) => b.month.localeCompare(a.month))[0] || null;
      const regularEmi = loan.emi_amount;
      const latestEmi = latestPayment?.emi_amount || regularEmi;
      const outstandingWithoutPrepayment = Math.max(loan.loan_amount - totalPrincipalPaid, 0);
      const remainingRegularPlan = calculateAmortization(outstanding, loan.interest_rate, regularEmi);
      const remainingLatestPlan = calculateAmortization(outstanding, loan.interest_rate, latestEmi);
      const remainingWithoutPrepayment = calculateAmortization(outstandingWithoutPrepayment, loan.interest_rate, regularEmi);
      const interestSavedThroughPrepayment = remainingWithoutPrepayment.totalInterest !== null && remainingRegularPlan.totalInterest !== null
        ? Math.max(remainingWithoutPrepayment.totalInterest - remainingRegularPlan.totalInterest, 0)
        : null;

      return {
        loan,
        totalPrincipalPaid,
        totalInterestPaid,
        totalPrepaid,
        totalPaid,
        outstanding,
        latestPayment,
        regularEmi,
        latestEmi,
        remainingRegularPlan,
        remainingLatestPlan,
        interestSavedThroughPrepayment
      };
    });
  }, [loans, payments]);

  const selectedLoanSummary = loanSummaries.find((summary) => summary.loan.id === selectedLoanId) || null;

  useEffect(() => {
    if (!selectedLoanSummary) {
      setCalculatorPrepayment('');
      setCalculatorEmi('');
      return;
    }

    setCalculatorPrepayment('');
    setCalculatorEmi(selectedLoanSummary.latestEmi.toString());
  }, [selectedLoanId, selectedLoanSummary?.latestEmi]);

  const prepaymentProjection = useMemo(() => {
    if (!selectedLoanSummary) return null;

    const extraPrepayment = Math.max(parseFloat(calculatorPrepayment || '0') || 0, 0);
    const projectedEmi = Math.max(parseFloat(calculatorEmi || '0') || 0, 0);
    const reducedOutstanding = Math.max(selectedLoanSummary.outstanding - extraPrepayment, 0);
    const currentPlan = calculateAmortization(
      selectedLoanSummary.outstanding,
      selectedLoan.interest_rate,
      selectedLoanSummary.latestEmi
    );
    const projectedPlan = calculateAmortization(
      reducedOutstanding,
      selectedLoan.interest_rate,
      projectedEmi
    );

    const monthsSaved = currentPlan.months !== null && projectedPlan.months !== null
      ? Math.max(currentPlan.months - projectedPlan.months, 0)
      : null;
    const incrementalInterestSaved = currentPlan.totalInterest !== null && projectedPlan.totalInterest !== null
      ? Math.max(currentPlan.totalInterest - projectedPlan.totalInterest, 0)
      : null;

    return {
      extraPrepayment,
      projectedEmi,
      reducedOutstanding,
      currentPlan,
      projectedPlan,
      monthsSaved,
      incrementalInterestSaved
    };
  }, [calculatorEmi, calculatorPrepayment, selectedLoan, selectedLoanSummary]);

  const resetLoanForm = () => {
    setEditingLoan(null);
    setLoanName('');
    setLender('');
    setLoanAmount('');
    setInterestRate('');
    setEmiAmount('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setLoanStatus('Active');
  };

  const resetPaymentForm = () => {
    setEditingPayment(null);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentEmiAmount(selectedLoan?.emi_amount?.toString() || '');
    setPrincipalComponent('');
    setInterestComponent('');
    setPrepaymentAmount('0');
    setPaymentNotes('');
  };

  const openEditLoanModal = (loan: Loan) => {
    setEditingLoan(loan);
    setLoanName(loan.name);
    setLender(loan.lender);
    setLoanAmount(loan.loan_amount.toString());
    setInterestRate(loan.interest_rate.toString());
    setEmiAmount(loan.emi_amount.toString());
    setStartDate(loan.start_date);
    setLoanStatus(loan.status);
    setIsLoanModalOpen(true);
  };

  const openEditPaymentModal = (payment: LoanPayment) => {
    setEditingPayment(payment);
    setPaymentDate(payment.payment_date);
    setPaymentEmiAmount(payment.emi_amount.toString());
    setPrincipalComponent(payment.principal_component.toString());
    setInterestComponent(payment.interest_component.toString());
    setPrepaymentAmount(payment.prepayment_amount.toString());
    setPaymentNotes(payment.notes || '');
    setIsPaymentModalOpen(true);
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLoan(true);

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        name: loanName,
        lender,
        loan_amount: parseFloat(loanAmount),
        interest_rate: parseFloat(interestRate),
        emi_amount: parseFloat(emiAmount),
        start_date: startDate,
        status: loanStatus
      };

      if (editingLoan) {
        const { error } = await supabase.from('loans').update(payload).eq('id', editingLoan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('loans').insert([{ user_id: user.id, ...payload }]);
        if (error) throw error;
      }

      setIsLoanModalOpen(false);
      resetLoanForm();
      fetchData();
    } catch (error) {
      console.error('Error saving loan:', error);
      alert('Error saving loan.');
    } finally {
      setSubmittingLoan(false);
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    setSubmittingPayment(true);

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const emiValue = parseFloat(paymentEmiAmount);
      const principalValue = parseFloat(principalComponent);
      const interestValue = parseFloat(interestComponent);
      const prepaymentValue = parseFloat(prepaymentAmount || '0');
      const paymentMonth = getMonthFromDate(paymentDate);

      if (Number.isNaN(emiValue) || Number.isNaN(principalValue) || Number.isNaN(interestValue) || Number.isNaN(prepaymentValue)) {
        throw new Error('Invalid payment values');
      }

      const duplicateMonthPayment = payments.find((payment) => (
        payment.loan_id === selectedLoan.id
        && payment.month === paymentMonth
        && payment.id !== editingPayment?.id
      ));
      if (duplicateMonthPayment) {
        throw new Error(`A payment entry already exists for ${formatMonth(paymentMonth)}.`);
      }

      const payload = {
        loan_id: selectedLoan.id,
        month: paymentMonth,
        payment_date: paymentDate,
        emi_amount: emiValue,
        principal_component: principalValue,
        interest_component: interestValue,
        prepayment_amount: prepaymentValue,
        notes: paymentNotes
      };

      if (editingPayment) {
        const { error } = await supabase.from('loan_payments').update(payload).eq('id', editingPayment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('loan_payments').insert([{ user_id: user.id, ...payload }]);
        if (error) throw error;
      }

      setIsPaymentModalOpen(false);
      resetPaymentForm();
      fetchData();
    } catch (error) {
      console.error('Error saving loan payment:', error);
      alert(error instanceof Error ? error.message : 'Error saving loan payment.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const deleteLoan = async (loanId: string) => {
    try {
      const { error } = await supabase.from('loans').delete().eq('id', loanId);
      if (error) throw error;
      setDeletingLoanId(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting loan:', error);
      alert('Error deleting loan.');
      setDeletingLoanId(null);
    }
  };

  const deletePayment = async (paymentId: string) => {
    try {
      const { error } = await supabase.from('loan_payments').delete().eq('id', paymentId);
      if (error) throw error;
      setDeletingPaymentId(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting loan payment:', error);
      alert('Error deleting payment.');
      setDeletingPaymentId(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Loans</h1>
          <p className="text-slate-500">Track multiple loans, monthly EMI entries, principal, interest, and prepayments.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              resetLoanForm();
              setIsLoanModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
          >
            <Plus size={18} />
            Add Loan
          </button>
          <button
            type="button"
            disabled={!selectedLoan}
            onClick={() => {
              resetPaymentForm();
              setIsPaymentModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <CalendarRange size={18} />
            Add Monthly Payment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[320px]">
          <Loader2 className="animate-spin text-blue-600" size={30} />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-fit">
            <div className="p-5 border-b border-slate-100">
              <h2 className="font-display font-bold text-lg text-slate-900">Your Loans</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {loanSummaries.map((summary) => (
                <button
                  type="button"
                  key={summary.loan.id}
                  onClick={() => setSelectedLoanId(summary.loan.id)}
                  className={`w-full text-left p-4 transition-colors ${
                    selectedLoanId === summary.loan.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{summary.loan.name}</p>
                      <p className="text-sm text-slate-500">{summary.loan.lender}</p>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      summary.loan.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {summary.loan.status}
                    </span>
                  </div>
                  <div className="mt-3 text-sm text-slate-500">
                    Outstanding: <span className="font-semibold text-slate-900">{formatCurrency(summary.outstanding)}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    EMI: <span className="font-semibold text-slate-900">{formatCurrency(summary.loan.emi_amount)}</span>
                  </div>
                </button>
              ))}
              {loanSummaries.length === 0 && (
                <div className="p-6 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                    <Landmark size={28} />
                  </div>
                  <p className="font-semibold text-slate-900">No loans added</p>
                  <p className="mt-1 text-sm text-slate-500">Create your first loan to start tracking EMI and prepayments.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {selectedLoan && selectedLoanSummary ? (
              <>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-2xl font-display font-bold text-slate-900">{selectedLoan.name}</h2>
                      <p className="text-slate-500">{selectedLoan.lender}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditLoanModal(selectedLoan)}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Edit2 size={16} />
                        Edit Loan
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingLoanId(selectedLoan.id)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                      >
                        <Trash2 size={16} />
                        Delete Loan
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
                    <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                      <div className="flex items-center gap-2 text-blue-700">
                        <IndianRupee size={16} />
                        <p className="text-xs font-bold uppercase tracking-wider">Outstanding</p>
                      </div>
                      <p className="mt-2 text-2xl font-display font-bold text-blue-700">{formatCurrency(selectedLoanSummary.outstanding)}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                      <div className="flex items-center gap-2 text-emerald-700">
                        <WalletCards size={16} />
                        <p className="text-xs font-bold uppercase tracking-wider">Principal Paid</p>
                      </div>
                      <p className="mt-2 text-2xl font-display font-bold text-emerald-700">{formatCurrency(selectedLoanSummary.totalPrincipalPaid)}</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                      <div className="flex items-center gap-2 text-amber-700">
                        <Percent size={16} />
                        <p className="text-xs font-bold uppercase tracking-wider">Interest Paid</p>
                      </div>
                      <p className="mt-2 text-2xl font-display font-bold text-amber-700">{formatCurrency(selectedLoanSummary.totalInterestPaid)}</p>
                    </div>
                    <div className="rounded-2xl bg-violet-50 border border-violet-100 p-4">
                      <div className="flex items-center gap-2 text-violet-700">
                        <CalendarRange size={16} />
                        <p className="text-xs font-bold uppercase tracking-wider">Prepaid</p>
                      </div>
                      <p className="mt-2 text-2xl font-display font-bold text-violet-700">{formatCurrency(selectedLoanSummary.totalPrepaid)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 text-sm">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-slate-400">Loan Amount</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatCurrency(selectedLoan.loan_amount)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-slate-400">Interest Rate</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedLoan.interest_rate}%</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-slate-400">Current EMI</p>
                      <p className="mt-1 font-semibold text-slate-900">{formatCurrency(selectedLoan.emi_amount)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-slate-400">Latest Paid Month</p>
                      <p className="mt-1 font-semibold text-slate-900">{selectedLoanSummary.latestPayment ? formatMonth(selectedLoanSummary.latestPayment.month) : 'None yet'}</p>
                    </div>
                  </div>
                </div>

                {prepaymentProjection && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                      <div>
                        <h3 className="font-display font-bold text-lg text-slate-900">Prepayment Calculator</h3>
                        <p className="text-sm text-slate-500">Try an extra prepayment for this loan before adding an actual monthly payment entry.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Extra Prepayment</label>
                        <input
                          type="number"
                          min="0"
                          value={calculatorPrepayment}
                          onChange={(e) => setCalculatorPrepayment(e.target.value)}
                          placeholder="50000"
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">EMI After Prepayment</label>
                        <input
                          type="number"
                          min="0"
                          value={calculatorEmi}
                          onChange={(e) => setCalculatorEmi(e.target.value)}
                          placeholder={selectedLoanSummary.latestEmi.toString()}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Outstanding After Prepay</p>
                        <p className="mt-2 text-2xl font-display font-bold text-slate-900">{formatCurrency(prepaymentProjection.reducedOutstanding)}</p>
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Revised Tenure</p>
                        <p className="mt-2 text-2xl font-display font-bold text-blue-700">{formatTenure(prepaymentProjection.projectedPlan.months)}</p>
                        <p className="mt-1 text-sm text-blue-700/80">With EMI of {formatCurrency(prepaymentProjection.projectedEmi)}</p>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Tenure Reduced</p>
                        <p className="mt-2 text-2xl font-display font-bold text-emerald-700">
                          {prepaymentProjection.monthsSaved === null ? 'N/A' : formatTenure(prepaymentProjection.monthsSaved)}
                        </p>
                        <p className="mt-1 text-sm text-emerald-700/80">Compared with current payoff path</p>
                      </div>
                      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-violet-700">Extra Interest Saved</p>
                        <p className="mt-2 text-2xl font-display font-bold text-violet-700">
                          {prepaymentProjection.incrementalInterestSaved === null
                            ? 'N/A'
                            : formatCurrency(prepaymentProjection.incrementalInterestSaved)}
                        </p>
                        <p className="mt-1 text-sm text-violet-700/80">Incremental saving from this scenario</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-display font-bold text-lg text-slate-900">Monthly Payments</h3>
                      <p className="text-sm text-slate-500">Each month stores EMI, interest, principal, and optional prepayment.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        resetPaymentForm();
                        setIsPaymentModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                    >
                      <Plus size={16} />
                      Add Month
                    </button>
                  </div>

                  <div className="max-h-[520px] overflow-auto">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                          <th className="px-6 py-4 font-semibold">Month</th>
                          <th className="px-6 py-4 font-semibold">EMI</th>
                          <th className="px-6 py-4 font-semibold">Principal</th>
                          <th className="px-6 py-4 font-semibold">Interest</th>
                          <th className="px-6 py-4 font-semibold">Prepayment</th>
                          <th className="px-6 py-4 font-semibold">Paid On</th>
                          <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedLoanPayments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900">{formatMonth(payment.month)}</td>
                            <td className="px-6 py-4 text-slate-600">{formatCurrency(payment.emi_amount)}</td>
                            <td className="px-6 py-4 text-emerald-600 font-semibold">{formatCurrency(payment.principal_component)}</td>
                            <td className="px-6 py-4 text-amber-600 font-semibold">{formatCurrency(payment.interest_component)}</td>
                            <td className="px-6 py-4 text-violet-600 font-semibold">{formatCurrency(payment.prepayment_amount)}</td>
                            <td className="px-6 py-4 text-slate-500">{new Date(payment.payment_date).toLocaleDateString('en-IN')}</td>
                            <td className="px-6 py-4">
                              <div className="flex justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditPaymentModal(payment)}
                                  className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingPaymentId(payment.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {selectedLoanPayments.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                              No monthly payments recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                  <Landmark size={30} />
                </div>
                <h2 className="text-xl font-display font-bold text-slate-900">No loan selected</h2>
                <p className="mt-2 text-slate-500">Add a loan to track EMI, principal, interest, and prepayment month by month.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoanModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-display font-bold text-slate-900">{editingLoan ? 'Edit Loan' : 'Add Loan'}</h2>
              <button
                type="button"
                onClick={() => {
                  setIsLoanModalOpen(false);
                  resetLoanForm();
                }}
                className="text-slate-400 hover:text-slate-900"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Loan Name</label>
                  <input
                    required
                    value={loanName}
                    onChange={(e) => setLoanName(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Home Loan"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lender</label>
                  <input
                    required
                    value={lender}
                    onChange={(e) => setLender(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="HDFC Bank"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Loan Amount</label>
                  <input
                    type="number"
                    required
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interest Rate %</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">EMI Amount</label>
                  <input
                    type="number"
                    required
                    value={emiAmount}
                    onChange={(e) => setEmiAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={loanStatus}
                    onChange={(e) => setLoanStatus(e.target.value as 'Active' | 'Closed')}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoanModalOpen(false);
                    resetLoanForm();
                  }}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLoan}
                  className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingLoan ? <Loader2 className="animate-spin" size={18} /> : editingLoan ? 'Update Loan' : 'Save Loan'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isPaymentModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-900">{editingPayment ? 'Edit Monthly Payment' : 'Add Monthly Payment'}</h2>
                <p className="text-sm text-slate-500 mt-1">{selectedLoan.name}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  resetPaymentForm();
                }}
                className="text-slate-400 hover:text-slate-900"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Month</label>
                  <div className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600">
                    {formatMonth(getMonthFromDate(paymentDate))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">EMI Amount</label>
                  <input
                    type="number"
                    required
                    value={paymentEmiAmount}
                    onChange={(e) => setPaymentEmiAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prepayment</label>
                  <input
                    type="number"
                    min="0"
                    value={prepaymentAmount}
                    onChange={(e) => setPrepaymentAmount(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Principal Component</label>
                  <input
                    type="number"
                    required
                    value={principalComponent}
                    onChange={(e) => setPrincipalComponent(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interest Component</label>
                  <input
                    type="number"
                    required
                    value={interestComponent}
                    onChange={(e) => setInterestComponent(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional notes for this month"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                EMI split this month: <span className="font-semibold text-slate-900">{formatCurrency((parseFloat(principalComponent) || 0) + (parseFloat(interestComponent) || 0))}</span>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsPaymentModalOpen(false);
                    resetPaymentForm();
                  }}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="flex-1 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingPayment ? <Loader2 className="animate-spin" size={18} /> : editingPayment ? 'Update Payment' : 'Save Payment'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {deletingLoanId && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-display font-bold text-slate-900">Delete Loan?</h3>
            <p className="mt-2 text-sm text-slate-500">This will also remove monthly payment history if your database uses the provided cascade setup.</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button type="button" onClick={() => setDeletingLoanId(null)} className="py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="button" onClick={() => deleteLoan(deletingLoanId)} className="py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </motion.div>
        </div>
      )}

      {deletingPaymentId && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
            <h3 className="text-xl font-display font-bold text-slate-900">Delete Payment?</h3>
            <p className="mt-2 text-sm text-slate-500">The monthly payment row will be removed from this loan's stats.</p>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button type="button" onClick={() => setDeletingPaymentId(null)} className="py-2 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="button" onClick={() => deletePayment(deletingPaymentId)} className="py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">Delete</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
