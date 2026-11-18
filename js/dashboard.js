/**
 * Dashboard Module
 *
 * Computes and renders Dashboard KPIs, Monthly Spending Overview chart,
 * Expense Category Breakdown chart, and Recent Transactions table.
 */

import {
  calculateSummaryTotals,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  formatShortMonthLabel,
  getCategoryColor,
  getCurrentMonthKey,
  renderTransactionTable,
  sortTransactions,
} from './transactions.js';
import { buildBudgetAlertMarkup, computeBudgetStatus } from './budget.js';

let monthlyChartInstance = null;
let categoryChartInstance = null;

/**
 * Generates an ordered list of the last N month keys ("YYYY-MM"), oldest to newest.
 */
export function getRecentMonthKeys(count = 6) {
  const keys = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    keys.push(`${yyyy}-${mm}`);
  }
  return keys;
}

/**
 * Computes monthly spending overview and category breakdown independent of storage.
 */
export function computeDashboardMetrics(transactions, currentMonthKey, currentBudgetLimit) {
  const summary = calculateSummaryTotals(transactions);
  const budgetStatus = computeBudgetStatus(transactions, currentMonthKey, currentBudgetLimit);

  // Last 6 months spending series
  const monthKeys = getRecentMonthKeys(6);
  const monthlySeries = monthKeys.map((key) => {
    const spent = transactions
      .filter((tx) => tx.type === 'expense' && tx.date.startsWith(key))
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    return {
      monthKey: key,
      label: formatShortMonthLabel(key),
      spent,
    };
  });

  // All-time expense breakdown by category
  const categoryTotals = new Map();
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const cat = tx.category || 'Other';
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + (Number(tx.amount) || 0));
  }

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: summary.totalExpenses > 0 ? (amount / summary.totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const recentTransactions = sortTransactions(transactions, 'date-desc').slice(0, 6);

  return {
    summary,
    budgetStatus,
    monthlySeries,
    categoryBreakdown,
    recentTransactions,
  };
}

function renderMonthlySpendingChart(monthlySeries) {
  const canvas = document.getElementById('dash-monthly-chart');
  const emptyEl = document.getElementById('dash-monthly-empty');
  if (!canvas) return;

  const hasAnySpend = monthlySeries.some((m) => m.spent > 0);
  if (emptyEl) {
    emptyEl.classList.toggle('hidden', hasAnySpend);
  }

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
    monthlyChartInstance = null;
  }

  if (!hasAnySpend || typeof window.Chart !== 'function') {
    return;
  }

  const ctx = canvas.getContext('2d');
  monthlyChartInstance = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthlySeries.map((m) => m.label),
      datasets: [
        {
          label: 'Monthly Spending',
          data: monthlySeries.map((m) => Number(m.spent.toFixed(2))),
          backgroundColor: monthlySeries.map((_, idx) =>
            idx === monthlySeries.length - 1 ? '#1D4ED8' : '#CBD5E1'
          ),
          hoverBackgroundColor: '#1E40AF',
          borderRadius: 6,
          maxBarThickness: 40,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label(context) {
              return `Spending: ${formatCurrency(context.parsed.y)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: '#64748B',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#F1F5F9' },
          ticks: {
            color: '#64748B',
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
            callback(value) {
              return `$${Number(value).toLocaleString('en-US')}`;
            },
          },
        },
      },
    },
  });
}

function renderCategoryDoughnutChart(categoryBreakdown) {
  const canvas = document.getElementById('dash-category-chart');
  const emptyEl = document.getElementById('dash-category-empty');
  const legendListEl = document.getElementById('dash-category-list');

  if (!canvas) return;

  const hasData = categoryBreakdown.length > 0;
  if (emptyEl) {
    emptyEl.classList.toggle('hidden', hasData);
  }

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }

  if (legendListEl) {
    if (!hasData) {
      legendListEl.innerHTML = '';
    } else {
      const topCategories = categoryBreakdown.slice(0, 6);
      legendListEl.innerHTML = topCategories
        .map((item, idx) => {
          const color = getCategoryColor(item.category, idx);
          return `
            <li class="category-legend-item">
              <div class="legend-left">
                <span class="legend-swatch" style="background-color: ${escapeHtml(color)}"></span>
                <span class="legend-name">${escapeHtml(item.category)}</span>
              </div>
              <div class="legend-right tabular-nums">
                <span class="legend-amount">${escapeHtml(formatCurrency(item.amount))}</span>
                <span class="legend-pct">${item.percentage.toFixed(0)}%</span>
              </div>
            </li>
          `;
        })
        .join('');
    }
  }

  if (!hasData || typeof window.Chart !== 'function') {
    return;
  }

  const ctx = canvas.getContext('2d');
  categoryChartInstance = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categoryBreakdown.map((c) => c.category),
      datasets: [
        {
          data: categoryBreakdown.map((c) => Number(c.amount.toFixed(2))),
          backgroundColor: categoryBreakdown.map((c, idx) => getCategoryColor(c.category, idx)),
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '66%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label(context) {
              const value = context.parsed;
              const item = categoryBreakdown[context.dataIndex];
              return `${context.label}: ${formatCurrency(value)} (${item.percentage.toFixed(1)}%)`;
            },
          },
        },
      },
    },
  });
}

/**
 * Renders the Dashboard view.
 */
export function renderDashboardView(transactions, currentBudgetLimit, callbacks) {
  const currentMonthKey = getCurrentMonthKey();
  const metrics = computeDashboardMetrics(transactions, currentMonthKey, currentBudgetLimit);

  // KPI Elements
  const balanceEl = document.getElementById('dash-total-balance');
  const balanceMetaEl = document.getElementById('dash-balance-meta');
  const incomeEl = document.getElementById('dash-total-income');
  const incomeMetaEl = document.getElementById('dash-income-meta');
  const expensesEl = document.getElementById('dash-total-expenses');
  const expensesMetaEl = document.getElementById('dash-expenses-meta');
  const monthlyEl = document.getElementById('dash-monthly-spending');
  const monthlyMetaEl = document.getElementById('dash-monthly-meta');
  const alertEl = document.getElementById('dashboard-budget-alert');

  if (balanceEl) {
    balanceEl.textContent = formatCurrency(metrics.summary.totalBalance);
    balanceEl.classList.toggle('negative-text', metrics.summary.totalBalance < 0);
  }
  if (balanceMetaEl) {
    balanceMetaEl.textContent =
      metrics.summary.totalCount === 0
        ? 'No entries recorded yet'
        : `Across ${metrics.summary.totalCount} total transactions`;
  }

  if (incomeEl) {
    incomeEl.textContent = formatCurrency(metrics.summary.totalIncome);
  }
  if (incomeMetaEl) {
    const n = metrics.summary.incomeCount;
    incomeMetaEl.textContent = `${n} income ${n === 1 ? 'entry' : 'entries'}`;
  }

  if (expensesEl) {
    expensesEl.textContent = formatCurrency(metrics.summary.totalExpenses);
  }
  if (expensesMetaEl) {
    const n = metrics.summary.expenseCount;
    expensesMetaEl.textContent = `${n} expense ${n === 1 ? 'entry' : 'entries'}`;
  }

  if (monthlyEl) {
    monthlyEl.textContent = formatCurrency(metrics.budgetStatus.spent);
  }
  if (monthlyMetaEl) {
    const monthLabel = formatMonthLabel(currentMonthKey);
    if (metrics.budgetStatus.hasBudget) {
      monthlyMetaEl.textContent = `${monthLabel} · ${metrics.budgetStatus.utilization.toFixed(1)}% of budget`;
    } else {
      monthlyMetaEl.textContent = `${monthLabel} · No budget set`;
    }
  }

  // Budget Warning / Alert Banner
  if (alertEl) {
    const alertInfo = buildBudgetAlertMarkup(metrics.budgetStatus, { includeManageLink: true });
    if (alertInfo) {
      alertEl.className = `alert-banner ${alertInfo.variant}`;
      alertEl.innerHTML = alertInfo.html;
      const jumpBtn = alertEl.querySelector('[data-jump-budget]');
      if (jumpBtn && typeof callbacks?.onNavigate === 'function') {
        jumpBtn.addEventListener('click', () => callbacks.onNavigate('budget'));
      }
    } else {
      alertEl.className = 'alert-banner hidden';
      alertEl.innerHTML = '';
    }
  }

  // Charts
  renderMonthlySpendingChart(metrics.monthlySeries);
  renderCategoryDoughnutChart(metrics.categoryBreakdown);

  // Recent Transactions Table
  const recentContainer = document.getElementById('dash-recent-container');
  renderTransactionTable(recentContainer, metrics.recentTransactions, {
    onEdit: callbacks.onEdit,
    onDelete: callbacks.onDelete,
    emptyTitle: 'No transactions recorded yet',
    emptyDescription: 'Start by adding your first income or expense transaction, or load sample records to explore.',
    emptyActionsHtml: `
      <button type="button" class="btn btn-primary" id="dash-empty-add-btn">Add Transaction</button>
      <button type="button" class="btn btn-secondary" id="dash-empty-sample-btn">Load Sample Data</button>
    `,
  });

  const emptyAddBtn = document.getElementById('dash-empty-add-btn');
  if (emptyAddBtn && typeof callbacks?.onAddNew === 'function') {
    emptyAddBtn.addEventListener('click', callbacks.onAddNew);
  }

  const emptySampleBtn = document.getElementById('dash-empty-sample-btn');
  if (emptySampleBtn && typeof callbacks?.onResetSample === 'function') {
    emptySampleBtn.addEventListener('click', callbacks.onResetSample);
  }
}
