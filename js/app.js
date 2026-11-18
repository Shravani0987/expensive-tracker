/**
 * Application Entry Point & UI Controller
 *
 * Coordinates navigation, modals, event listeners, and connects
 * storage.js with dashboard.js, transactions.js, analytics.js, and budget.js.
 */

import {
  addTransaction,
  clearAllData,
  deleteBudget,
  deleteTransaction,
  getBudgetForMonth,
  getTransactions,
  initializeStorage,
  resetToSampleData,
  saveBudget,
  updateTransaction,
} from './storage.js';

import {
  escapeHtml,
  exportTransactionsToCsv,
  getCategoriesForType,
  getCurrentMonthKey,
  getTodayDateString,
  renderTransactionsView,
  validateTransactionInput,
} from './transactions.js';

import { renderDashboardView } from './dashboard.js';
import { renderAnalyticsView } from './analytics.js';
import { renderBudgetView, validateBudgetInput } from './budget.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  analytics: 'Analytics',
  budget: 'Budget',
};

const appState = {
  activeView: 'dashboard',
  txFilters: {
    search: '',
    type: 'all',
    category: 'all',
    sortBy: 'date-desc',
  },
  analyticsPeriod: 'all',
  budgetMonth: getCurrentMonthKey(),
  editingTransactionId: null,
  confirmAction: null,
};

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, variant = 'default') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${variant === 'error' ? 'error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

/* ==========================================================================
   Sidebar & Navigation
   ========================================================================== */

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuBtn = document.getElementById('mobile-menu-btn');
  if (sidebar) sidebar.classList.add('open');
  if (backdrop) backdrop.classList.add('visible');
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuBtn = document.getElementById('mobile-menu-btn');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('visible');
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
}

function navigateToView(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  appState.activeView = viewName;

  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    const isActive = btn.dataset.view === viewName;
    btn.classList.toggle('active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  document.querySelectorAll('.view-section').forEach((section) => {
    section.classList.toggle('active', section.id === `view-${viewName}`);
  });

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) {
    titleEl.textContent = VIEW_TITLES[viewName];
  }

  closeMobileSidebar();
  renderActiveView();
}

/* ==========================================================================
   Central View Rendering
   ========================================================================== */

function renderActiveView() {
  const transactions = getTransactions();
  const currentMonthKey = getCurrentMonthKey();

  const commonCallbacks = {
    onEdit: openEditTransactionModal,
    onDelete: promptDeleteTransaction,
    onAddNew: openAddTransactionModal,
    onNavigate: navigateToView,
    onResetSample: () => {
      resetToSampleData();
      renderActiveView();
      showToast('Sample transactions and budget restored.');
    },
  };

  if (appState.activeView === 'dashboard') {
    const currentBudget = getBudgetForMonth(currentMonthKey);
    renderDashboardView(transactions, currentBudget, commonCallbacks);
  } else if (appState.activeView === 'transactions') {
    renderTransactionsView(transactions, appState.txFilters, {
      ...commonCallbacks,
      onClearFilters: resetTransactionFilters,
    });
  } else if (appState.activeView === 'analytics') {
    renderAnalyticsView(transactions, appState.analyticsPeriod);
  } else if (appState.activeView === 'budget') {
    const selectedBudget = getBudgetForMonth(appState.budgetMonth);
    renderBudgetView(transactions, appState.budgetMonth, selectedBudget, commonCallbacks);
  }

  refreshIcons();
}

/* ==========================================================================
   Add / Edit Transaction Modal
   ========================================================================== */

function populateCategoryOptions(type, selectedCategory = '') {
  const selectEl = document.getElementById('tx-category-input');
  if (!selectEl) return;

  const categories = [...getCategoriesForType(type)];
  if (selectedCategory && !categories.includes(selectedCategory)) {
    categories.push(selectedCategory);
  }

  selectEl.innerHTML = categories
    .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    .join('');

  if (selectedCategory && categories.includes(selectedCategory)) {
    selectEl.value = selectedCategory;
  } else if (categories.length > 0) {
    selectEl.value = categories[0];
  }
}

function setFormType(type, preserveCategory = false) {
  const normalizedType = type === 'income' ? 'income' : 'expense';
  const typeInput = document.getElementById('tx-type-input');
  const categorySelect = document.getElementById('tx-category-input');
  const currentCategory = preserveCategory && categorySelect ? categorySelect.value : '';

  if (typeInput) typeInput.value = normalizedType;

  document.querySelectorAll('[data-form-type]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.formType === normalizedType);
  });

  populateCategoryOptions(normalizedType, currentCategory);
}

function clearTransactionFormErrors() {
  const fields = [
    { input: 'tx-title-input', error: 'tx-title-error' },
    { input: 'tx-amount-input', error: 'tx-amount-error' },
    { input: 'tx-category-input', error: 'tx-category-error' },
    { input: 'tx-date-input', error: 'tx-date-error' },
    { input: 'tx-description-input', error: 'tx-description-error' },
  ];

  for (const field of fields) {
    const inputEl = document.getElementById(field.input);
    const errorEl = document.getElementById(field.error);
    if (inputEl) {
      inputEl.classList.remove('invalid');
      inputEl.removeAttribute('aria-invalid');
    }
    if (errorEl) errorEl.textContent = '';
  }
}

function displayTransactionFormErrors(errors) {
  const map = {
    title: { input: 'tx-title-input', error: 'tx-title-error' },
    amount: { input: 'tx-amount-input', error: 'tx-amount-error' },
    category: { input: 'tx-category-input', error: 'tx-category-error' },
    date: { input: 'tx-date-input', error: 'tx-date-error' },
    description: { input: 'tx-description-input', error: 'tx-description-error' },
  };

  for (const [key, message] of Object.entries(errors)) {
    const target = map[key];
    if (!target) continue;
    const inputEl = document.getElementById(target.input);
    const errorEl = document.getElementById(target.error);
    if (inputEl) {
      inputEl.classList.add('invalid');
      inputEl.setAttribute('aria-invalid', 'true');
    }
    if (errorEl) errorEl.textContent = message;
  }
}

function openAddTransactionModal() {
  appState.editingTransactionId = null;
  clearTransactionFormErrors();

  const modal = document.getElementById('transaction-modal');
  const titleEl = document.getElementById('tx-modal-title');
  const submitBtn = document.getElementById('submit-tx-btn');
  const idInput = document.getElementById('tx-id-input');
  const nameInput = document.getElementById('tx-title-input');
  const amountInput = document.getElementById('tx-amount-input');
  const dateInput = document.getElementById('tx-date-input');
  const descInput = document.getElementById('tx-description-input');

  if (titleEl) titleEl.textContent = 'Add Transaction';
  if (submitBtn) submitBtn.textContent = 'Save Transaction';
  if (idInput) idInput.value = '';
  if (nameInput) nameInput.value = '';
  if (amountInput) amountInput.value = '';
  if (dateInput) dateInput.value = getTodayDateString();
  if (descInput) descInput.value = '';

  setFormType('expense', false);

  if (modal) modal.classList.remove('hidden');
  if (nameInput) nameInput.focus();
  refreshIcons();
}

function openEditTransactionModal(id) {
  const transactions = getTransactions();
  const tx = transactions.find((item) => item.id === id);
  if (!tx) {
    showToast('Transaction could not be found.', 'error');
    return;
  }

  appState.editingTransactionId = id;
  clearTransactionFormErrors();

  const modal = document.getElementById('transaction-modal');
  const titleEl = document.getElementById('tx-modal-title');
  const submitBtn = document.getElementById('submit-tx-btn');
  const idInput = document.getElementById('tx-id-input');
  const nameInput = document.getElementById('tx-title-input');
  const amountInput = document.getElementById('tx-amount-input');
  const dateInput = document.getElementById('tx-date-input');
  const descInput = document.getElementById('tx-description-input');

  if (titleEl) titleEl.textContent = 'Edit Transaction';
  if (submitBtn) submitBtn.textContent = 'Update Transaction';
  if (idInput) idInput.value = tx.id;
  if (nameInput) nameInput.value = tx.title;
  if (amountInput) amountInput.value = String(tx.amount);
  if (dateInput) dateInput.value = tx.date;
  if (descInput) descInput.value = tx.description || '';

  setFormType(tx.type, false);
  populateCategoryOptions(tx.type, tx.category);

  if (modal) modal.classList.remove('hidden');
  if (nameInput) nameInput.focus();
  refreshIcons();
}

function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (modal) modal.classList.add('hidden');
  appState.editingTransactionId = null;
  clearTransactionFormErrors();
}

function handleTransactionFormSubmit(event) {
  event.preventDefault();
  clearTransactionFormErrors();

  const rawInput = {
    type: document.getElementById('tx-type-input')?.value,
    title: document.getElementById('tx-title-input')?.value,
    amount: document.getElementById('tx-amount-input')?.value,
    category: document.getElementById('tx-category-input')?.value,
    date: document.getElementById('tx-date-input')?.value,
    description: document.getElementById('tx-description-input')?.value,
  };

  const validation = validateTransactionInput(rawInput);
  if (!validation.isValid) {
    displayTransactionFormErrors(validation.errors);
    return;
  }

  try {
    if (appState.editingTransactionId) {
      updateTransaction(appState.editingTransactionId, validation.sanitized);
      showToast('Transaction updated.');
    } else {
      addTransaction(validation.sanitized);
      showToast('Transaction added.');
    }
    closeTransactionModal();
    renderActiveView();
  } catch (err) {
    console.error(err);
    showToast('Failed to save transaction.', 'error');
  }
}

/* ==========================================================================
   Confirmation Modal (Delete, Reset, Clear)
   ========================================================================== */

function openConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm }) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl = document.getElementById('confirm-modal-message');
  const acceptBtn = document.getElementById('accept-confirm-btn');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (acceptBtn) acceptBtn.textContent = confirmLabel;

  appState.confirmAction = onConfirm;
  if (modal) modal.classList.remove('hidden');
  if (acceptBtn) acceptBtn.focus();
  refreshIcons();
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (modal) modal.classList.add('hidden');
  appState.confirmAction = null;
}

function promptDeleteTransaction(id) {
  const tx = getTransactions().find((item) => item.id === id);
  if (!tx) return;

  openConfirmModal({
    title: 'Delete Transaction',
    message: `Are you sure you want to delete "${tx.title}"? This action cannot be undone.`,
    confirmLabel: 'Delete',
    onConfirm: () => {
      deleteTransaction(id);
      renderActiveView();
      showToast('Transaction deleted.');
    },
  });
}

/* ==========================================================================
   Filters, Analytics Period & Budget Handlers
   ========================================================================== */

function resetTransactionFilters() {
  appState.txFilters = {
    search: '',
    type: 'all',
    category: 'all',
    sortBy: 'date-desc',
  };

  const searchInput = document.getElementById('tx-search-input');
  const categorySelect = document.getElementById('tx-category-filter');
  const sortSelect = document.getElementById('tx-sort-select');

  if (searchInput) searchInput.value = '';
  if (categorySelect) categorySelect.value = 'all';
  if (sortSelect) sortSelect.value = 'date-desc';

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.typeFilter === 'all');
  });

  renderActiveView();
}

function handleBudgetFormSubmit(event) {
  event.preventDefault();
  const monthInput = document.getElementById('budget-month-input');
  const amountInput = document.getElementById('budget-amount-input');
  const errorEl = document.getElementById('budget-amount-error');

  if (amountInput) amountInput.classList.remove('invalid');
  if (errorEl) errorEl.textContent = '';

  const monthKey = monthInput?.value || appState.budgetMonth;
  const validation = validateBudgetInput(monthKey, amountInput?.value);

  if (!validation.isValid) {
    if (amountInput) amountInput.classList.add('invalid');
    if (errorEl) errorEl.textContent = validation.errors.amount;
    return;
  }

  try {
    appState.budgetMonth = monthKey;
    saveBudget(monthKey, validation.sanitizedAmount);
    renderActiveView();
    showToast('Monthly budget saved.');
  } catch (err) {
    console.error(err);
    showToast('Unable to save budget.', 'error');
  }
}

/* ==========================================================================
   Event Wiring & Bootstrap
   ========================================================================== */

function bindEvents() {
  // Sidebar navigation
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => navigateToView(btn.dataset.view));
  });

  const brandLink = document.querySelector('.brand-link[data-nav]');
  if (brandLink) {
    brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      navigateToView(brandLink.dataset.nav);
    });
  }

  // Mobile sidebar controls
  document.getElementById('mobile-menu-btn')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Dashboard "View all" button
  document.getElementById('view-all-transactions-btn')?.addEventListener('click', () => {
    navigateToView('transactions');
  });

  // Top bar Add Transaction button
  document.getElementById('open-add-modal-btn')?.addEventListener('click', openAddTransactionModal);

  // Transaction Modal controls
  document.getElementById('close-tx-modal-btn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('cancel-tx-modal-btn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('transaction-form')?.addEventListener('submit', handleTransactionFormSubmit);

  document.getElementById('transaction-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'transaction-modal') closeTransactionModal();
  });

  document.querySelectorAll('[data-form-type]').forEach((btn) => {
    btn.addEventListener('click', () => setFormType(btn.dataset.formType, false));
  });

  // Confirmation Modal controls
  document.getElementById('close-confirm-modal-btn')?.addEventListener('click', closeConfirmModal);
  document.getElementById('cancel-confirm-btn')?.addEventListener('click', closeConfirmModal);
  document.getElementById('confirm-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'confirm-modal') closeConfirmModal();
  });

  document.getElementById('accept-confirm-btn')?.addEventListener('click', () => {
    const fn = appState.confirmAction;
    closeConfirmModal();
    if (typeof fn === 'function') fn();
  });

  // Keyboard Escape handler for modals & drawer
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const txModal = document.getElementById('transaction-modal');
    const confirmModal = document.getElementById('confirm-modal');
    if (confirmModal && !confirmModal.classList.contains('hidden')) {
      closeConfirmModal();
    } else if (txModal && !txModal.classList.contains('hidden')) {
      closeTransactionModal();
    } else {
      closeMobileSidebar();
    }
  });

  // Transaction History Filters & Search
  document.getElementById('tx-search-input')?.addEventListener('input', (e) => {
    appState.txFilters.search = e.target.value;
    renderActiveView();
  });

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.txFilters.type = btn.dataset.typeFilter;
      document.querySelectorAll('[data-type-filter]').forEach((item) => {
        item.classList.toggle('active', item === btn);
      });
      renderActiveView();
    });
  });

  document.getElementById('tx-category-filter')?.addEventListener('change', (e) => {
    appState.txFilters.category = e.target.value;
    renderActiveView();
  });

  document.getElementById('tx-sort-select')?.addEventListener('change', (e) => {
    appState.txFilters.sortBy = e.target.value;
    renderActiveView();
  });

  // Analytics Period Selector
  document.querySelectorAll('[data-analytics-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.analyticsPeriod = btn.dataset.analyticsPeriod;
      document.querySelectorAll('[data-analytics-period]').forEach((item) => {
        item.classList.toggle('active', item === btn);
      });
      renderActiveView();
    });
  });

  // Budget Form & Month Selector
  document.getElementById('budget-form')?.addEventListener('submit', handleBudgetFormSubmit);

  document.getElementById('budget-month-input')?.addEventListener('change', (e) => {
    if (e.target.value) {
      appState.budgetMonth = e.target.value;
      const errorEl = document.getElementById('budget-amount-error');
      const amountInput = document.getElementById('budget-amount-input');
      if (errorEl) errorEl.textContent = '';
      if (amountInput) {
        amountInput.classList.remove('invalid');
        const existing = getBudgetForMonth(appState.budgetMonth);
        amountInput.value = existing ? String(existing) : '';
      }
      renderActiveView();
    }
  });

  document.getElementById('budget-remove-btn')?.addEventListener('click', () => {
    const month = appState.budgetMonth;
    openConfirmModal({
      title: 'Remove Monthly Budget',
      message: `Remove the configured budget limit for ${month}?`,
      confirmLabel: 'Remove',
      onConfirm: () => {
        deleteBudget(month);
        const amountInput = document.getElementById('budget-amount-input');
        if (amountInput) amountInput.value = '';
        renderActiveView();
        showToast('Monthly budget removed.');
      },
    });
  });

  // Sidebar Data Utilities
  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    const transactions = getTransactions();
    if (transactions.length === 0) {
      showToast('No transactions available to export.', 'error');
      return;
    }
    exportTransactionsToCsv(transactions);
    showToast('Transactions exported as CSV.');
  });

  document.getElementById('reset-demo-btn')?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Reset Sample Data',
      message: 'This will replace your current transactions and budgets with the default sample dataset.',
      confirmLabel: 'Reset Data',
      onConfirm: () => {
        resetToSampleData();
        renderActiveView();
        showToast('Sample data restored.');
      },
    });
  });

  document.getElementById('clear-data-btn')?.addEventListener('click', () => {
    openConfirmModal({
      title: 'Clear All Data',
      message: 'This will permanently delete all recorded transactions and monthly budgets from LocalStorage.',
      confirmLabel: 'Clear Everything',
      onConfirm: () => {
        clearAllData();
        renderActiveView();
        showToast('All data cleared.');
      },
    });
  });
}

function bootstrap() {
  initializeStorage();
  bindEvents();
  renderActiveView();
}

// Wait until deferred CDN scripts (Chart.js, Lucide) have executed
if (document.readyState === 'complete') {
  bootstrap();
} else {
  window.addEventListener('load', bootstrap);
}
