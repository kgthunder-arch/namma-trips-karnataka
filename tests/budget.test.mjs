import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetBreakdown, sumBudgetCategories } from '../shared/budget.mjs';

test('budget categories always reconcile to the displayed estimate', () => {
  const categories = createBudgetBreakdown(12550, [
    { kind: 'meal', estimatedCost: 450 },
    { kind: 'attraction', estimatedCost: 1200 },
  ]);
  assert.deepEqual(categories, { transport: 4250, accommodation: 4360, food: 450, entryFees: 1200, activities: 600, parkingTolls: 800, misc: 890 });
  assert.equal(sumBudgetCategories(categories), 12550);
});

test('day trips omit accommodation and unknown zero fees do not imply an included ticket price', () => {
  const categories = createBudgetBreakdown(1000, [
    { kind: 'meal', estimatedCost: 0 },
    { kind: 'attraction', estimatedCost: 0 },
  ], false);
  assert.equal(categories.accommodation, 0);
  assert.equal(sumBudgetCategories(categories), 1000);
});

test('small totals still reconcile after rounding category allowances', () => {
  for (const amount of [1, 9, 50, 99, 101, 501]) {
    assert.equal(sumBudgetCategories(createBudgetBreakdown(amount, [], true)), amount);
  }
});
