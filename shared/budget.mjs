const roundRupees = value => Math.max(0, Math.round(value));
const roundToTen = value => Math.max(0, Math.round(value / 10) * 10);

export function sumBudgetCategories(categories) {
  return Object.values(categories).reduce((sum, value) => sum + (Number.isFinite(value) ? Math.max(0, value) : 0), 0);
}

export function createBudgetBreakdown(total, activities, accommodationNeeded = true) {
  const safeTotal = roundRupees(Number.isFinite(total) ? total : 0);
  const food = Math.min(safeTotal, activities.filter(item => item.kind === 'meal').reduce((sum, item) => sum + Math.max(0, item.estimatedCost || 0), 0));
  const entryFees = Math.min(safeTotal - food, activities.filter(item => item.kind === 'attraction').reduce((sum, item) => sum + Math.max(0, item.estimatedCost || 0), 0));
  let remaining = safeTotal - food - entryFees;
  const accommodation = accommodationNeeded ? Math.min(remaining, roundToTen(remaining * 0.4)) : 0;
  remaining -= accommodation;
  const transport = Math.min(remaining, roundToTen(remaining * 0.65));
  remaining -= transport;
  const parkingTolls = Math.min(remaining, roundToTen(remaining * 0.35));
  remaining -= parkingTolls;
  const activitiesAllowance = Math.min(remaining, roundToTen(remaining * 0.4));
  remaining -= activitiesAllowance;
  const misc = remaining;
  return { transport, accommodation, food, entryFees, activities: activitiesAllowance, parkingTolls, misc };
}
