export type AssetType = 
  | 'Real Estate' 
  | 'Gold' 
  | 'Cash' 
  | 'Crypto' 
  | 'Fixed Deposit' 
  | 'PF/EPF' 
  | 'Savings Account'
  | 'Other';

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  type: AssetType;
  initial_value: number; // Opening Balance
  value: number; // Current Value
  invested_value?: number; // For Stocks/Mutual Funds
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: 'Income' | 'Expense';
  created_at: string;
}

export interface Investment {
  id: string;
  user_id: string;
  name: string;
  ticker: string;
  type: 'Stock' | 'Mutual Fund' | 'Gold Mutual Fund';
  quantity: number;
  buy_price: number;
  current_price: number;
  invested_value: number;
  current_value: number;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  name: string;
  lender: string;
  loan_amount: number;
  interest_rate: number;
  emi_amount: number;
  start_date: string;
  status: 'Active' | 'Closed';
  created_at: string;
  updated_at: string;
}

export interface LoanPayment {
  id: string;
  user_id: string;
  loan_id: string;
  month: string;
  payment_date: string;
  emi_amount: number;
  principal_component: number;
  interest_component: number;
  prepayment_amount: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type TransactionCategory = string; // Now dynamic

export interface Transaction {
  id: string;
  user_id: string;
  asset_id: string; // Account/Asset involved
  to_asset_id?: string; // For transfers
  amount: number;
  type: 'Income' | 'Expense' | 'Transfer';
  category: TransactionCategory;
  description: string;
  date: string;
  created_at: string;
}
