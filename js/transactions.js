/**
 * Transactions Module
 *
 * Pure financial calculation functions, validation, filtering, sorting,
 * formatting utilities, and Transaction History UI rendering.
 * Completely independent of LocalStorage implementation details.
 */

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './storage.js';

export const CATEGORY_COLORS = {
  Food: '#1D4ED8',
  Housing: '#0F766E',
  Transport: '#0284C7',
  Utilities: '#D97706',
  Healthcare: '#DC2626',
  Entertainment: '#7C3AED',
  Shopping: '#DB2777',
  Education: '#4F46E5',
  Salary: '#15803D',
  Freelance: '#0D9488',
  Investments: '#2563EB',
  Gift: '#9333EA',
  Refund: '#059669',
  Other: '#64748B',
};

const FALLBACK_COLORS = [
  '#1D4ED8',
  '#0F766E',
  '#D97706',
  '#0284C7',
  '#7C3AED',
  '#DC2626',
  '#4F46E5',
  '#64748B',
];

export function getCategoryColor(category, index = 0) {
  return CATEGORY_COLORS[category] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).split('-');
  if (parts.length !== 3) return dateStr;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const d = new Date(year, month, day);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

export function formatShortMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
  }).format(d);
}

export function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getCurrentMonthKey() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

/**
 * Dynamically computes Total Income, Total Expenses, and Total Balance.
 * Total Balance = Total Income - Total Expenses.
 */
export function calculateSummaryTotals(transactions) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalIncome += amt;
      incomeCount += 1;
    } else {
      totalExpenses += amt;
      expenseCount += 1;
    }
  }

  const roundedIncome = Number(totalIncome.toFixed(2));
  const roundedExpenses = Number(totalExpenses.toFixed(2));

  return {
    totalIncome: roundedIncome,
    totalExpenses: roundedExpenses,
    totalBalance: Number((roundedIncome - roundedExpenses).toFixed(2)),
    incomeCount,
    expenseCount,
    totalCount: transactions.length,
  };
}

/**
 * Validates transaction form input before saving.
 * Returns { isValid: boolean, errors: Record<string, string>, sanitized?: object }
 */
export function validateTransactionInput(input) {
  const errors = {};
  const title = String(input.title || '').trim();
  const amountNum = Number(input.amount);
  const category = String(input.category || '').trim();
  const type = input.type === 'income' ? 'income' : 'expense';
  const date = String(input.date || '').trim();
  const description = String(input.description || '').trim();

  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  }

  if (input.amount === '' || input.amount === null || input.amount === undefined) {
    errors.amount = 'Please enter an amount.';
  } else if (!Number.isFinite(amountNum) || amountNum <= 0) {
    errors.amount = 'Amount must be greater than $0.00.';
  } else if (amountNum > 100000000) {
    errors.amount = 'Amount exceeds maximum supported limit.';
  }

  if (!category) {
    errors.category = 'Please select a category.';
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  }

  if (description.length > 240) {
    errors.description = 'Description cannot exceed 240 characters.';
  }

  const isValid = Object.keys(errors).length === 0;
  return {
    isValid,
    errors,
    sanitized: isValid
      ? {
          title,
          amount: Number(amountNum.toFixed(2)),
          category,
          type,
          date,
          description,
        }
      : null,
  };
}

/**
 * Filters transactions by search term, type, and category.
 */
export function filterTransactions(transactions, { search = '', type = 'all', category = 'all' } = {}) {
  const query = search.trim().toLowerCase();

  return transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) {
      return false;
    }
    if (category !== 'all' && tx.category !== category) {
      return false;
    }
    if (query) {
      const haystack = `${tx.title} ${tx.category} ${tx.description}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Sorts transactions by date or amount without mutating the source array.
 */
export function sortTransactions(transactions, sortBy = 'date-desc') {
  const copy = [...transactions];
  copy.sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount || b.date.localeCompare(a.date);
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount || b.date.localeCompare(a.date);
    }
    // Default: date-desc
    return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
  });
  return copy;
}

/**
 * Returns categories for a given transaction type (for form dropdowns)
 * or combined unique categories across active transactions + defaults (for filter dropdown).
 */
export function getCategoriesForType(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function getAllKnownCategories(transactions = []) {
  const set = new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]);
  for (const tx of transactions) {
    if (tx.category) set.add(tx.category);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Renders a responsive transaction table (desktop) + compact list (mobile)
 * inside the given container element.
 */
export function renderTransactionTable(containerEl, transactions, {
  onEdit,
  onDelete,
  emptyTitle = 'No transactions found',
  emptyDescription = 'Add an income or expense entry to begin tracking your finances.',
  emptyActionsHtml = '',
} = {}) {
  if (!containerEl) return;

  if (!transactions || transactions.length === 0) {
    containerEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="receipt"></i></div>
        <h3 class="empty-state-title">${escapeHtml(emptyTitle)}</h3>
        <p class="empty-state-text">${escapeHtml(emptyDescription)}</p>
        ${emptyActionsHtml ? `<div class="empty-state-actions">${emptyActionsHtml}</div>` : ''}
      </div>
    `;
    return;
  }

  const desktopRows = transactions
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'positive-text' : '';
      const typeLabel = isIncome ? 'Income' : 'Expense';
      return `
        <tr data-tx-id="${escapeHtml(tx.id)}">
          <td class="tabular-nums tx-meta-inline">${escapeHtml(formatDate(tx.date))}</td>
          <td>
            <div class="tx-title-cell">
              <span class="tx-title">${escapeHtml(tx.title)}</span>
              ${tx.description ? `<span class="tx-desc" title="${escapeHtml(tx.description)}">${escapeHtml(tx.description)}</span>` : ''}
            </div>
          </td>
          <td class="tx-meta-inline">${escapeHtml(tx.category)}</td>
          <td>
            <span class="tx-type-label ${isIncome ? 'income' : 'expense'}">${typeLabel}</span>
          </td>
          <td class="align-right tabular-nums tx-amount ${amountClass}">
            ${sign}${escapeHtml(formatCurrency(tx.amount))}
          </td>
          <td class="align-right">
            <div class="row-actions">
              <button type="button" class="icon-btn" data-action="edit" data-id="${escapeHtml(tx.id)}" aria-label="Edit ${escapeHtml(tx.title)}" title="Edit">
                <i data-lucide="pencil"></i>
              </button>
              <button type="button" class="icon-btn danger" data-action="delete" data-id="${escapeHtml(tx.id)}" aria-label="Delete ${escapeHtml(tx.title)}" title="Delete">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  const mobileItems = transactions
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'positive-text' : '';
      return `
        <div class="tx-mobile-item" data-tx-id="${escapeHtml(tx.id)}">
          <div class="tx-mobile-top">
            <div class="tx-title-cell">
              <span class="tx-title">${escapeHtml(tx.title)}</span>
              ${tx.description ? `<span class="tx-desc">${escapeHtml(tx.description)}</span>` : ''}
            </div>
            <span class="tabular-nums tx-amount ${amountClass}">${sign}${escapeHtml(formatCurrency(tx.amount))}</span>
          </div>
          <div class="tx-mobile-bottom">
            <span>${escapeHtml(tx.category)} · ${escapeHtml(formatDate(tx.date))} · ${isIncome ? 'Income' : 'Expense'}</span>
            <div class="row-actions">
              <button type="button" class="icon-btn" data-action="edit" data-id="${escapeHtml(tx.id)}" aria-label="Edit ${escapeHtml(tx.title)}">
                <i data-lucide="pencil"></i>
              </button>
              <button type="button" class="icon-btn danger" data-action="delete" data-id="${escapeHtml(tx.id)}" aria-label="Delete ${escapeHtml(tx.title)}">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  containerEl.innerHTML = `
    <div class="table-responsive data-table-desktop">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Transaction</th>
            <th>Category</th>
            <th>Type</th>
            <th class="align-right">Amount</th>
            <th class="align-right">Actions</th>
          </tr>
        </thead>
        <tbody>${desktopRows}</tbody>
      </table>
    </div>
    <div class="tx-mobile-list">${mobileItems}</div>
  `;

  // Delegate Edit and Delete clicks cleanly
  containerEl.onclick = (event) => {
    const actionBtn = event.target.closest('button[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;
    if (!id) return;

    if (action === 'edit' && typeof onEdit === 'function') {
      onEdit(id);
    } else if (action === 'delete' && typeof onDelete === 'function') {
      onDelete(id);
    }
  };
}

/**
 * Renders the full Transaction History view with live search, filters, and sort.
 */
export function renderTransactionsView(transactions, filterState, callbacks) {
  const categorySelect = document.getElementById('tx-category-filter');
  const resultsSummary = document.getElementById('tx-results-summary');
  const filteredTotalsEl = document.getElementById('tx-filtered-totals');
  const tableContainer = document.getElementById('tx-table-container');

  // Sync category dropdown options while preserving selected value
  if (categorySelect) {
    const categories = getAllKnownCategories(transactions);
    const currentValue = filterState.category || 'all';
    categorySelect.innerHTML = [
      '<option value="all">All Categories</option>',
      ...categories.map(
        (cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
      ),
    ].join('');
    categorySelect.value = categories.includes(currentValue) || currentValue === 'all'
      ? currentValue
      : 'all';
  }

  const filtered = filterTransactions(transactions, filterState);
  const sorted = sortTransactions(filtered, filterState.sortBy);
  const totals = calculateSummaryTotals(sorted);

  if (resultsSummary) {
    const countLabel = sorted.length === 1 ? '1 transaction' : `${sorted.length} transactions`;
    const totalContext =
      sorted.length !== transactions.length
        ? `Showing ${countLabel} (filtered from ${transactions.length})`
        : `Showing ${countLabel}`;
    resultsSummary.textContent = totalContext;
  }

  if (filteredTotalsEl) {
    filteredTotalsEl.innerHTML = `
      <span>Income: <strong class="positive-text">${escapeHtml(formatCurrency(totals.totalIncome))}</strong></span>
      <span>Expenses: <strong>${escapeHtml(formatCurrency(totals.totalExpenses))}</strong></span>
      <span>Net: <strong>${escapeHtml(formatCurrency(totals.totalBalance))}</strong></span>
    `;
  }

  const hasActiveFilters =
    Boolean(filterState.search?.trim()) ||
    filterState.type !== 'all' ||
    filterState.category !== 'all';

  const emptyActionsHtml = hasActiveFilters
    ? '<button type="button" class="btn btn-secondary" id="tx-clear-filters-btn">Clear Filters</button>'
    : '<button type="button" class="btn btn-primary" id="tx-empty-add-btn">Add Transaction</button>';

  renderTransactionTable(tableContainer, sorted, {
    onEdit: callbacks.onEdit,
    onDelete: callbacks.onDelete,
    emptyTitle: hasActiveFilters ? 'No matching transactions' : 'No transactions recorded',
    emptyDescription: hasActiveFilters
      ? 'Try adjusting your search query, category, or type filter.'
      : 'Record your first income or expense entry to build your financial ledger.',
    emptyActionsHtml,
  });

  const clearBtn = document.getElementById('tx-clear-filters-btn');
  if (clearBtn && typeof callbacks.onClearFilters === 'function') {
    clearBtn.addEventListener('click', callbacks.onClearFilters);
  }

  const emptyAddBtn = document.getElementById('tx-empty-add-btn');
  if (emptyAddBtn && typeof callbacks.onAddNew === 'function') {
    emptyAddBtn.addEventListener('click', callbacks.onAddNew);
  }
}

/**
 * Generates and downloads a clean CSV export of transactions.
 */
export function exportTransactionsToCsv(transactions) {
  const sorted = sortTransactions(transactions, 'date-desc');
  const header = ['Date', 'Title', 'Type', 'Category', 'Amount', 'Description'];
  const escapeCsvCell = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = sorted.map((tx) =>
    [tx.date, tx.title, tx.type, tx.category, tx.amount.toFixed(2), tx.description]
      .map(escapeCsvCell)
      .join(',')
  );

  const csvContent = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ledgerly-transactions-${getTodayDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
