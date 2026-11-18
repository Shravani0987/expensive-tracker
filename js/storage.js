/**
 * Centralized Data Storage Module (LocalStorage Adapter)
 *
 * Designed with clean CRUD methods so LocalStorage calls can be replaced
 * with REST API calls (e.g., Node.js / Express / SQL) without modifying
 * UI or financial calculation modules.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'ledgerly_transactions_v1',
  BUDGETS: 'ledgerly_budgets_v1',
  INITIALIZED: 'ledgerly_initialized_v1',
};

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Gift',
  'Refund',
  'Other',
];

/**
 * Generates a unique transaction ID.
 * Uses crypto.randomUUID when available with a timestamp-random fallback.
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Normalizes a transaction object to ensure strict schema consistency.
 * Schema: { id, title, amount, category, type, date, description }
 */
function normalizeTransaction(raw) {
  return {
    id: String(raw.id || generateId()),
    title: String(raw.title || '').trim(),
    amount: Number(Number(raw.amount || 0).toFixed(2)),
    category: String(raw.category || 'Other').trim(),
    type: raw.type === 'income' ? 'income' : 'expense',
    date: String(raw.date || ''),
    description: String(raw.description || '').trim(),
  };
}

/**
 * Formats a Year-Month offset relative to the current date for initial sample data.
 */
function buildOffsetDate(monthsAgo, dayOfMonth) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, dayOfMonth), maxDay);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(safeDay).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildMonthKey(monthsAgo = 0) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function createSampleTransactions() {
  return [
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: buildOffsetDate(0, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: buildOffsetDate(0, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Grocery Shopping',
      amount: 245.5,
      category: 'Food',
      type: 'expense',
      date: buildOffsetDate(0, 6),
      description: 'Weekly groceries and produce',
    },
    {
      id: generateId(),
      title: 'Electric & Internet Bill',
      amount: 168.4,
      category: 'Utilities',
      type: 'expense',
      date: buildOffsetDate(0, 9),
      description: 'Monthly electricity and fiber internet',
    },
    {
      id: generateId(),
      title: 'UI Consulting Retainer',
      amount: 850,
      category: 'Freelance',
      type: 'income',
      date: buildOffsetDate(0, 11),
      description: 'Client design system audit',
    },
    {
      id: generateId(),
      title: 'Transit Pass & Fuel',
      amount: 112,
      category: 'Transport',
      type: 'expense',
      date: buildOffsetDate(0, 13),
      description: 'Monthly commuter pass and fuel refill',
    },
    {
      id: generateId(),
      title: 'Dental Checkup',
      amount: 195,
      category: 'Healthcare',
      type: 'expense',
      date: buildOffsetDate(0, 15),
      description: 'Routine cleaning co-pay',
    },
    {
      id: generateId(),
      title: 'Neighborhood Bistro',
      amount: 78.25,
      category: 'Food',
      type: 'expense',
      date: buildOffsetDate(0, 17),
      description: 'Dinner with colleagues',
    },
    // Previous Month (-1)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: buildOffsetDate(1, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: buildOffsetDate(1, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Whole Foods & Market',
      amount: 492,
      category: 'Food',
      type: 'expense',
      date: buildOffsetDate(1, 10),
      description: 'Monthly household groceries',
    },
    {
      id: generateId(),
      title: 'Utilities & Water',
      amount: 174,
      category: 'Utilities',
      type: 'expense',
      date: buildOffsetDate(1, 14),
      description: 'Electricity, gas, and water',
    },
    {
      id: generateId(),
      title: 'Office Chair Upgrade',
      amount: 340,
      category: 'Shopping',
      type: 'expense',
      date: buildOffsetDate(1, 19),
      description: 'Ergonomic home desk equipment',
    },
    {
      id: generateId(),
      title: 'Concert Tickets',
      amount: 135,
      category: 'Entertainment',
      type: 'expense',
      date: buildOffsetDate(1, 24),
      description: 'Weekend live jazz performance',
    },
    // 2 Months Ago (-2)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: buildOffsetDate(2, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Dividend Payout',
      amount: 320,
      category: 'Investments',
      type: 'income',
      date: buildOffsetDate(2, 18),
      description: 'Quarterly index fund distribution',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: buildOffsetDate(2, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Dining',
      amount: 465,
      category: 'Food',
      type: 'expense',
      date: buildOffsetDate(2, 12),
      description: 'Food and dining expenses',
    },
    {
      id: generateId(),
      title: 'Annual Tech Course',
      amount: 210,
      category: 'Education',
      type: 'expense',
      date: buildOffsetDate(2, 21),
      description: 'Frontend architecture workshop',
    },
    // 3 Months Ago (-3)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: buildOffsetDate(3, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: buildOffsetDate(3, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Market',
      amount: 410,
      category: 'Food',
      type: 'expense',
      date: buildOffsetDate(3, 14),
      description: 'Supermarket runs',
    },
    {
      id: generateId(),
      title: 'Car Maintenance & Fuel',
      amount: 285,
      category: 'Transport',
      type: 'expense',
      date: buildOffsetDate(3, 20),
      description: 'Tire rotation and fuel',
    },
    // 4 Months Ago (-4)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: buildOffsetDate(4, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: buildOffsetDate(4, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Food & Household',
      amount: 390,
      category: 'Food',
      type: 'expense',
      date: buildOffsetDate(4, 16),
      description: 'Groceries and household essentials',
    },
    {
      id: generateId(),
      title: 'Utilities & Streaming',
      amount: 195,
      category: 'Utilities',
      type: 'expense',
      date: buildOffsetDate(4, 22),
      description: 'Monthly utility bills',
    },
  ];
}

function createSampleBudgets() {
  return {
    [buildMonthKey(0)]: 2800,
    [buildMonthKey(1)]: 2800,
  };
}

/**
 * Seeds initial sample data only once on first launch.
 */
export function initializeStorage() {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      const sampleTransactions = createSampleTransactions().map(normalizeTransaction);
      const sampleBudgets = createSampleBudgets();
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sampleTransactions));
      localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(sampleBudgets));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  } catch (err) {
    console.error('Failed to initialize storage:', err);
  }
}

/**
 * Retrieves all transactions from LocalStorage.
 */
export function getTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTransaction);
  } catch (err) {
    console.error('Failed to read transactions from LocalStorage:', err);
    return [];
  }
}

/**
 * Persists the full transactions array to LocalStorage.
 */
export function saveTransactions(transactions) {
  try {
    const normalized = Array.isArray(transactions)
      ? transactions.map(normalizeTransaction)
      : [];
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(normalized));
    return normalized;
  } catch (err) {
    console.error('Failed to save transactions to LocalStorage:', err);
    throw err;
  }
}

/**
 * Creates and persists a new transaction.
 */
export function addTransaction(transactionData) {
  const existing = getTransactions();
  const newTx = normalizeTransaction({
    ...transactionData,
    id: generateId(),
  });
  existing.push(newTx);
  saveTransactions(existing);
  return newTx;
}

/**
 * Updates an existing transaction by ID.
 */
export function updateTransaction(id, updates) {
  const existing = getTransactions();
  const index = existing.findIndex((tx) => tx.id === id);
  if (index === -1) {
    throw new Error(`Transaction with id "${id}" not found.`);
  }
  const updated = normalizeTransaction({
    ...existing[index],
    ...updates,
    id,
  });
  existing[index] = updated;
  saveTransactions(existing);
  return updated;
}

/**
 * Deletes a transaction by ID.
 */
export function deleteTransaction(id) {
  const existing = getTransactions();
  const next = existing.filter((tx) => tx.id !== id);
  saveTransactions(next);
  return next;
}

/**
 * Retrieves all monthly budget targets keyed by "YYYY-MM".
 */
export function getBudgets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGETS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('Failed to read budgets from LocalStorage:', err);
    return {};
  }
}

/**
 * Retrieves the configured monthly budget for a specific "YYYY-MM" month key.
 */
export function getBudgetForMonth(monthKey) {
  const budgets = getBudgets();
  const value = budgets[monthKey];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Saves or updates a monthly budget limit for a given "YYYY-MM" month key.
 */
export function saveBudget(monthKey, limitAmount) {
  const budgets = getBudgets();
  const numeric = Number(Number(limitAmount).toFixed(2));
  if (!monthKey || !Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('Invalid budget month or amount.');
  }
  budgets[monthKey] = numeric;
  localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
  return numeric;
}

/**
 * Removes the budget limit for a given "YYYY-MM" month key.
 */
export function deleteBudget(monthKey) {
  const budgets = getBudgets();
  delete budgets[monthKey];
  localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
  return budgets;
}

/**
 * Restores realistic sample transactions and budget data.
 */
export function resetToSampleData() {
  const sampleTransactions = createSampleTransactions().map(normalizeTransaction);
  const sampleBudgets = createSampleBudgets();
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sampleTransactions));
  localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(sampleBudgets));
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  return { transactions: sampleTransactions, budgets: sampleBudgets };
}

/**
 * Clears all transactions and budgets while keeping initialized flag so empty state remains.
 */
export function clearAllData() {
  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify({}));
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}
