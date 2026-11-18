/**
 * Expense Analytics Module
 *
 * Pure analytics calculations (Total Savings, Savings Rate, Highest Spending Category,
 * Monthly Income vs Expenses, Category Breakdown, Spending Distribution) and Chart.js rendering.
 */

import {
  calculateSummaryTotals,
  escapeHtml,
  formatCurrency,
  formatShortMonthLabel,
  getCategoryColor,
  getCurrentMonthKey,
} from './transactions.js';
import { getRecentMonthKeys } from './dashboard.js';

let incomeExpenseChartInstance = null;
let categoryBarChartInstance = null;
let distributionChartInstance = null;

/**
 * Filters transactions according to the analytics timeframe ('all' | '6m' | 'month').
 */
export function filterTransactionsByPeriod(transactions, period = 'all') {
  if (period === 'month') {
    const currentMonth = getCurrentMonthKey();
    return transactions.filter((tx) => tx.date.startsWith(currentMonth));
  }
  if (period === '6m') {
    const allowedMonths = new Set(getRecentMonthKeys(6));
    return transactions.filter((tx) => allowedMonths.has(tx.date.slice(0, 7)));
  }
  return transactions;
}

/**
 * Computes all analytics metrics independent of storage.
 */
export function computeAnalyticsMetrics(transactions, period = 'all') {
  const scoped = filterTransactionsByPeriod(transactions, period);
  const summary = calculateSummaryTotals(scoped);

  // Total Savings = Total Income - Total Expenses
  const totalSavings = summary.totalIncome - summary.totalExpenses;
  const savingsRate = summary.totalIncome > 0 ? (totalSavings / summary.totalIncome) * 100 : 0;

  // Group by month (YYYY-MM)
  const monthMap = new Map();
  for (const tx of scoped) {
    const key = tx.date ? tx.date.slice(0, 7) : '';
    if (!key) continue;
    const entry = monthMap.get(key) || { monthKey: key, income: 0, expense: 0 };
    if (tx.type === 'income') {
      entry.income += Number(tx.amount) || 0;
    } else {
      entry.expense += Number(tx.amount) || 0;
    }
    monthMap.set(key, entry);
  }

  // Ensure smooth contiguous 6 months if period === '6m' and data exists
  let monthlyComparison = [];
  if (period === '6m') {
    const keys = getRecentMonthKeys(6);
    monthlyComparison = keys.map((key) => {
      const existing = monthMap.get(key) || { monthKey: key, income: 0, expense: 0 };
      return {
        ...existing,
        label: formatShortMonthLabel(key),
      };
    });
  } else {
    monthlyComparison = Array.from(monthMap.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .map((item) => ({
        ...item,
        label: formatShortMonthLabel(item.monthKey),
      }));
  }

  // Category breakdown for expenses
  const categoryMap = new Map();
  for (const tx of scoped) {
    if (tx.type !== 'expense') continue;
    const cat = tx.category || 'Other';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + (Number(tx.amount) || 0));
  }

  const categories = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: summary.totalExpenses > 0 ? (amount / summary.totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const highestCategory = categories.length > 0 ? categories[0] : null;
  const averageExpense = summary.expenseCount > 0 ? summary.totalExpenses / summary.expenseCount : 0;
  const activeMonthsCount = monthMap.size;
  const averageMonthlySpend = activeMonthsCount > 0 ? summary.totalExpenses / activeMonthsCount : 0;

  return {
    summary,
    totalSavings,
    savingsRate,
    highestCategory,
    averageExpense,
    activeMonthsCount,
    averageMonthlySpend,
    monthlyComparison,
    categories,
  };
}

function renderIncomeVsExpenseChart(monthlyComparison) {
  const canvas = document.getElementById('analytics-income-expense-chart');
  const emptyEl = document.getElementById('analytics-ie-empty');
  if (!canvas) return;

  const hasData = monthlyComparison.some((m) => m.income > 0 || m.expense > 0);
  if (emptyEl) emptyEl.classList.toggle('hidden', hasData);

  if (incomeExpenseChartInstance) {
    incomeExpenseChartInstance.destroy();
    incomeExpenseChartInstance = null;
  }

  if (!hasData || typeof window.Chart !== 'function') return;

  const ctx = canvas.getContext('2d');
  incomeExpenseChartInstance = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthlyComparison.map((m) => m.label),
      datasets: [
        {
          label: 'Income',
          data: monthlyComparison.map((m) => Number(m.income.toFixed(2))),
          backgroundColor: '#15803D',
          borderRadius: 5,
          maxBarThickness: 32,
        },
        {
          label: 'Expenses',
          data: monthlyComparison.map((m) => Number(m.expense.toFixed(2))),
          backgroundColor: '#1D4ED8',
          borderRadius: 5,
          maxBarThickness: 32,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#475569',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
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

function renderCategoryBarChart(categories) {
  const canvas = document.getElementById('analytics-category-bar-chart');
  const emptyEl = document.getElementById('analytics-bar-empty');
  if (!canvas) return;

  const hasData = categories.length > 0;
  if (emptyEl) emptyEl.classList.toggle('hidden', hasData);

  if (categoryBarChartInstance) {
    categoryBarChartInstance.destroy();
    categoryBarChartInstance = null;
  }

  if (!hasData || typeof window.Chart !== 'function') return;

  const ctx = canvas.getContext('2d');
  categoryBarChartInstance = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories.map((c) => c.category),
      datasets: [
        {
          label: 'Total Spent',
          data: categories.map((c) => Number(c.amount.toFixed(2))),
          backgroundColor: categories.map((c, idx) => getCategoryColor(c.category, idx)),
          borderRadius: 5,
          maxBarThickness: 24,
        },
      ],
    },
    options: {
      indexAxis: 'y',
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
              const item = categories[context.dataIndex];
              return `${formatCurrency(context.parsed.x)} (${item.percentage.toFixed(1)}%)`;
            },
          },
        },
      },
      scales: {
        x: {
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
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: '#0F172A',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: '500' },
          },
        },
      },
    },
  });
}

function renderDistributionChart(categories) {
  const canvas = document.getElementById('analytics-distribution-chart');
  const emptyEl = document.getElementById('analytics-dist-empty');
  const tableEl = document.getElementById('analytics-distribution-table');
  if (!canvas) return;

  const hasData = categories.length > 0;
  if (emptyEl) emptyEl.classList.toggle('hidden', hasData);

  if (distributionChartInstance) {
    distributionChartInstance.destroy();
    distributionChartInstance = null;
  }

  if (tableEl) {
    if (!hasData) {
      tableEl.innerHTML = '';
    } else {
      tableEl.innerHTML = categories
        .map((item, idx) => {
          const color = getCategoryColor(item.category, idx);
          return `
            <div class="category-legend-item">
              <div class="legend-left">
                <span class="legend-swatch" style="background-color: ${escapeHtml(color)}"></span>
                <span class="legend-name">${escapeHtml(item.category)}</span>
              </div>
              <div class="legend-right tabular-nums">
                <span class="legend-amount">${escapeHtml(formatCurrency(item.amount))}</span>
                <span class="legend-pct">${item.percentage.toFixed(1)}%</span>
              </div>
            </div>
          `;
        })
        .join('');
    }
  }

  if (!hasData || typeof window.Chart !== 'function') return;

  const ctx = canvas.getContext('2d');
  distributionChartInstance = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories.map((c) => c.category),
      datasets: [
        {
          data: categories.map((c) => Number(c.amount.toFixed(2))),
          backgroundColor: categories.map((c, idx) => getCategoryColor(c.category, idx)),
          borderWidth: 2,
          borderColor: '#FFFFFF',
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label(context) {
              const item = categories[context.dataIndex];
              return `${context.label}: ${item.percentage.toFixed(1)}% (${formatCurrency(context.parsed)})`;
            },
          },
        },
      },
    },
  });
}

/**
 * Renders the Analytics view.
 */
export function renderAnalyticsView(transactions, period = 'all') {
  const metrics = computeAnalyticsMetrics(transactions, period);

  const savingsEl = document.getElementById('analytics-total-savings');
  const savingsRateEl = document.getElementById('analytics-savings-rate');
  const topCatEl = document.getElementById('analytics-top-category');
  const topCatMetaEl = document.getElementById('analytics-top-category-meta');
  const avgExpEl = document.getElementById('analytics-avg-expense');
  const txCountEl = document.getElementById('analytics-tx-count');
  const monthlyAvgEl = document.getElementById('analytics-monthly-avg');
  const activeMonthsEl = document.getElementById('analytics-active-months');

  if (savingsEl) {
    savingsEl.textContent = formatCurrency(metrics.totalSavings);
    savingsEl.classList.toggle('positive-text', metrics.totalSavings > 0);
    savingsEl.classList.toggle('negative-text', metrics.totalSavings < 0);
  }
  if (savingsRateEl) {
    savingsRateEl.textContent =
      metrics.summary.totalIncome > 0
        ? `${metrics.savingsRate.toFixed(1)}% of income saved`
        : 'No income recorded in period';
  }

  if (topCatEl && topCatMetaEl) {
    if (metrics.highestCategory) {
      topCatEl.textContent = metrics.highestCategory.category;
      topCatMetaEl.textContent = `${formatCurrency(metrics.highestCategory.amount)} · ${metrics.highestCategory.percentage.toFixed(1)}% of expenses`;
    } else {
      topCatEl.textContent = '—';
      topCatMetaEl.textContent = 'No expense data';
    }
  }

  if (avgExpEl) {
    avgExpEl.textContent = formatCurrency(metrics.averageExpense);
  }
  if (txCountEl) {
    const n = metrics.summary.totalCount;
    txCountEl.textContent = `${n} total ${n === 1 ? 'transaction' : 'transactions'}`;
  }

  if (monthlyAvgEl) {
    monthlyAvgEl.textContent = formatCurrency(metrics.averageMonthlySpend);
  }
  if (activeMonthsEl) {
    const m = metrics.activeMonthsCount;
    activeMonthsEl.textContent = `Across ${m} active ${m === 1 ? 'month' : 'months'}`;
  }

  renderIncomeVsExpenseChart(metrics.monthlyComparison);
  renderCategoryBarChart(metrics.categories);
  renderDistributionChart(metrics.categories);
}
