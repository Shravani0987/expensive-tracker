/**
 * Budget Management Module
 *
 * Pure budget calculations (monthly spending, remaining budget,
 * utilization %, 80% warning & exceeded thresholds) and Budget UI rendering.
 */

import {
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getCurrentMonthKey,
  getCategoryColor,
} from './transactions.js';

/**
 * Computes all budget metrics for a given monthKey ("YYYY-MM") and limit.
 * Independent of storage implementation.
 */
export function computeBudgetStatus(transactions, monthKey, budgetLimit) {
  const monthExpenses = transactions.filter(
    (tx) => tx.type === 'expense' && typeof tx.date === 'string' && tx.date.startsWith(monthKey)
  );

  const rawSpent = monthExpenses.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const spent = Number(rawSpent.toFixed(2));
  const hasBudget = typeof budgetLimit === 'number' && Number.isFinite(budgetLimit) && budgetLimit > 0;

  let remaining = 0;
  let utilization = 0;
  let status = 'unset'; // 'unset' | 'healthy' | 'warning' | 'exceeded'

  if (hasBudget) {
    remaining = Number((budgetLimit - spent).toFixed(2));
    utilization = Number(((spent / budgetLimit) * 100).toFixed(2));

    if (spent > budgetLimit) {
      status = 'exceeded';
    } else if (utilization >= 80) {
      status = 'warning';
    } else {
      status = 'healthy';
    }
  }

  // Group category expenses for this month
  const categoryMap = new Map();
  for (const tx of monthExpenses) {
    const cat = tx.category || 'Other';
    const current = categoryMap.get(cat) || { category: cat, amount: 0, count: 0 };
    current.amount += Number(tx.amount) || 0;
    current.count += 1;
    categoryMap.set(cat, current);
  }

  const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);

  return {
    monthKey,
    budgetLimit: hasBudget ? budgetLimit : null,
    spent,
    remaining,
    utilization,
    status,
    hasBudget,
    expenseCount: monthExpenses.length,
    categoryBreakdown,
  };
}

/**
 * Generates accessible HTML for budget warning (>=80%) or exceeded (>100%) banners.
 */
export function buildBudgetAlertMarkup(budgetStatus, { includeManageLink = false } = {}) {
  if (!budgetStatus || !budgetStatus.hasBudget) return null;

  const monthLabel = formatMonthLabel(budgetStatus.monthKey);
  const pct = budgetStatus.utilization.toFixed(1);

  if (budgetStatus.status === 'exceeded') {
    const overAmount = formatCurrency(Math.abs(budgetStatus.remaining));
    return {
      variant: 'danger',
      html: `
        <div class="alert-banner-content">
          <i data-lucide="alert-octagon"></i>
          <div>
            <span class="alert-banner-title">Budget Exceeded</span>
            <span class="alert-banner-desc">
              You have spent ${escapeHtml(formatCurrency(budgetStatus.spent))} (${escapeHtml(pct)}%) in ${escapeHtml(monthLabel)}, exceeding your limit by ${escapeHtml(overAmount)}.
            </span>
          </div>
        </div>
        ${includeManageLink ? '<button type="button" class="btn btn-secondary" data-jump-budget>Adjust Budget</button>' : ''}
      `,
    };
  }

  if (budgetStatus.status === 'warning') {
    const remainingText = formatCurrency(budgetStatus.remaining);
    return {
      variant: 'warning',
      html: `
        <div class="alert-banner-content">
          <i data-lucide="alert-triangle"></i>
          <div>
            <span class="alert-banner-title">80% Budget Warning</span>
            <span class="alert-banner-desc">
              You have used ${escapeHtml(pct)}% of your ${escapeHtml(monthLabel)} budget. ${escapeHtml(remainingText)} remaining.
            </span>
          </div>
        </div>
        ${includeManageLink ? '<button type="button" class="btn btn-secondary" data-jump-budget>View Budget</button>' : ''}
      `,
    };
  }

  return null;
}

/**
 * Validates monthly budget form input.
 */
export function validateBudgetInput(monthKey, amountRaw) {
  const errors = {};
  const amount = Number(amountRaw);

  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    errors.amount = 'Please select a valid target month.';
  } else if (amountRaw === '' || amountRaw === null || amountRaw === undefined) {
    errors.amount = 'Please enter a monthly budget amount.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Budget limit must be greater than $0.00.';
  } else if (amount > 100000000) {
    errors.amount = 'Budget limit exceeds maximum supported amount.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedAmount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
  };
}

/**
 * Renders the Budget Management view.
 */
export function renderBudgetView(transactions, selectedMonth, budgetLimit, callbacks) {
  const monthInput = document.getElementById('budget-month-input');
  const amountInput = document.getElementById('budget-amount-input');
  const removeBtn = document.getElementById('budget-remove-btn');
  const bannerEl = document.getElementById('budget-status-banner');

  const activeMonth = selectedMonth || getCurrentMonthKey();
  const status = computeBudgetStatus(transactions, activeMonth, budgetLimit);
  const monthLabel = formatMonthLabel(activeMonth);

  if (monthInput && monthInput.value !== activeMonth) {
    monthInput.value = activeMonth;
  }

  if (amountInput && document.activeElement !== amountInput) {
    amountInput.value = status.hasBudget ? String(status.budgetLimit) : '';
  }

  if (removeBtn) {
    removeBtn.classList.toggle('hidden', !status.hasBudget);
  }

  // Render alert banner at 80% warning or >100% exceeded
  if (bannerEl) {
    const alertInfo = buildBudgetAlertMarkup(status, { includeManageLink: false });
    if (alertInfo) {
      bannerEl.className = `alert-banner ${alertInfo.variant}`;
      bannerEl.innerHTML = alertInfo.html;
    } else {
      bannerEl.className = 'alert-banner hidden';
      bannerEl.innerHTML = '';
    }
  }

  // Update Progress Card
  const titleEl = document.getElementById('budget-progress-title');
  const subtitleEl = document.getElementById('budget-progress-subtitle');
  const statusLabelEl = document.getElementById('budget-status-label');
  const limitDisplayEl = document.getElementById('budget-limit-display');
  const spentDisplayEl = document.getElementById('budget-spent-display');
  const remainingLabelEl = document.getElementById('budget-remaining-label');
  const remainingDisplayEl = document.getElementById('budget-remaining-display');
  const utilizationDisplayEl = document.getElementById('budget-utilization-display');
  const progressBarTrack = document.getElementById('budget-progress-bar-track');
  const progressFill = document.getElementById('budget-progress-fill');

  if (titleEl) titleEl.textContent = `${monthLabel} Utilization`;
  if (subtitleEl) {
    subtitleEl.textContent = status.hasBudget
      ? `${status.expenseCount} expense ${status.expenseCount === 1 ? 'entry' : 'entries'} recorded this month`
      : 'Set a monthly budget target on the left to track spending limits';
  }

  if (statusLabelEl) {
    const labelMap = {
      unset: { text: 'Not Configured', cls: 'status-text' },
      healthy: { text: 'On Track', cls: 'status-text healthy' },
      warning: { text: 'Approaching Limit', cls: 'status-text warning' },
      exceeded: { text: 'Budget Exceeded', cls: 'status-text exceeded' },
    };
    const cfg = labelMap[status.status];
    statusLabelEl.textContent = cfg.text;
    statusLabelEl.className = cfg.cls;
  }

  if (limitDisplayEl) {
    limitDisplayEl.textContent = status.hasBudget ? formatCurrency(status.budgetLimit) : 'Not set';
  }

  if (spentDisplayEl) {
    spentDisplayEl.textContent = formatCurrency(status.spent);
  }

  if (remainingLabelEl && remainingDisplayEl) {
    if (!status.hasBudget) {
      remainingLabelEl.textContent = 'Remaining Budget';
      remainingDisplayEl.textContent = '—';
      remainingDisplayEl.className = 'budget-metric-value tabular-nums';
    } else if (status.remaining < 0) {
      remainingLabelEl.textContent = 'Over Budget By';
      remainingDisplayEl.textContent = formatCurrency(Math.abs(status.remaining));
      remainingDisplayEl.className = 'budget-metric-value tabular-nums negative-text';
    } else {
      remainingLabelEl.textContent = 'Remaining Budget';
      remainingDisplayEl.textContent = formatCurrency(status.remaining);
      remainingDisplayEl.className = 'budget-metric-value tabular-nums positive-text';
    }
  }

  if (utilizationDisplayEl) {
    utilizationDisplayEl.textContent = status.hasBudget ? `${status.utilization.toFixed(1)}%` : '0.0%';
    utilizationDisplayEl.className = 'budget-metric-value tabular-nums';
    if (status.status === 'warning') utilizationDisplayEl.classList.add('warning-text');
    if (status.status === 'exceeded') utilizationDisplayEl.classList.add('negative-text');
  }

  if (progressFill && progressBarTrack) {
    const clampedWidth = status.hasBudget ? Math.min(status.utilization, 100) : 0;
    progressFill.style.width = `${clampedWidth.toFixed(1)}%`;
    progressFill.className = 'progress-fill';
    if (status.status === 'warning') progressFill.classList.add('warning');
    if (status.status === 'exceeded') progressFill.classList.add('exceeded');
    progressBarTrack.setAttribute('aria-valuenow', String(Math.round(status.utilization)));
  }

  // Category breakdown table for selected month
  const categorySubtitleEl = document.getElementById('budget-category-subtitle');
  const categoryTableEl = document.getElementById('budget-category-table');

  if (categorySubtitleEl) {
    categorySubtitleEl.textContent = `Expenses contributing to ${monthLabel}`;
  }

  if (categoryTableEl) {
    if (status.categoryBreakdown.length === 0) {
      categoryTableEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i data-lucide="calendar"></i></div>
          <h3 class="empty-state-title">No expenses in ${escapeHtml(monthLabel)}</h3>
          <p class="empty-state-text">Record an expense dated in ${escapeHtml(monthLabel)} to see category budget consumption.</p>
          <div class="empty-state-actions">
            <button type="button" class="btn btn-primary" id="budget-empty-add-btn">Add Expense</button>
          </div>
        </div>
      `;
      const emptyBtn = document.getElementById('budget-empty-add-btn');
      if (emptyBtn && typeof callbacks?.onAddNew === 'function') {
        emptyBtn.addEventListener('click', callbacks.onAddNew);
      }
      return;
    }

    const rowsHtml = status.categoryBreakdown
      .map((item, idx) => {
        const shareOfSpend = status.spent > 0 ? (item.amount / status.spent) * 100 : 0;
        const shareOfBudget = status.hasBudget ? (item.amount / status.budgetLimit) * 100 : null;
        const color = getCategoryColor(item.category, idx);
        return `
          <tr>
            <td>
              <div class="legend-left">
                <span class="legend-swatch" style="background-color: ${escapeHtml(color)}"></span>
                <span>${escapeHtml(item.category)}</span>
              </div>
            </td>
            <td class="align-right tabular-nums">${item.count}</td>
            <td class="align-right tabular-nums">${escapeHtml(formatCurrency(item.amount))}</td>
            <td class="align-right tabular-nums">${shareOfSpend.toFixed(1)}%</td>
            <td class="align-right tabular-nums">${shareOfBudget !== null ? `${shareOfBudget.toFixed(1)}%` : '—'}</td>
          </tr>
        `;
      })
      .join('');

    categoryTableEl.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th class="align-right">Transactions</th>
              <th class="align-right">Amount Spent</th>
              <th class="align-right">Share of Spend</th>
              <th class="align-right">% of Monthly Budget</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }
}
