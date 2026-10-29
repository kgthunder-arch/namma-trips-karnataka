export type BudgetActivity = { kind: 'attraction' | 'meal' | 'rest'; estimatedCost: number };
export type BudgetCategories = Record<'transport' | 'accommodation' | 'food' | 'entryFees' | 'activities' | 'parkingTolls' | 'misc', number>;
export function sumBudgetCategories(categories: Record<string, number>): number;
export function createBudgetBreakdown(total: number, activities: BudgetActivity[], accommodationNeeded?: boolean): BudgetCategories;
