import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManualItinerary, rankManualDestinations, validateManualInput, validateManualPlan } from '../shared/manualPlanner.mjs';
import { destinations } from './fixtures/destinations.mjs';

const input = overrides => ({ startCity: 'Bengaluru', destinationIds: ['mysuru'], departureDate: '2026-11-01', returnDate: '2026-11-02', travelers: 2, transport: 'Bus', totalBudget: 30000, accommodation: 'Budget', interests: ['Heritage', 'Food'], pace: 'Balanced', ...overrides });

test('rule-based recommendations prioritize interest, duration, budget, then a sample planning cluster', () => {
  const ranked = rankManualDestinations(input({ destinationIds: [], interests: ['Beaches'] }), destinations);
  assert.equal(ranked[0].destination.id, 'gokarna');
  assert.ok(ranked[0].reasons.some(reason => reason.includes('Beaches')));
  assert.ok(ranked[0].withinBudget);
});

test('manual trip generation needs no AI, respects dates, schedules meal breaks, and reconciles expense categories', async () => {
  const { sumBudgetCategories } = await import('../shared/budget.mjs');
  const plan = buildManualItinerary(input({ destinationIds: ['mysuru'] }), destinations);
  assert.equal(plan.planningMode, 'manual');
  assert.equal(plan.days.length, 2);
  assert.deepEqual(plan.days.map(day => day.date), ['2026-11-01', '2026-11-02']);
  assert.deepEqual(validateManualPlan(plan), []);
  assert.equal(sumBudgetCategories(plan.budgetCategories), plan.estimatedTotal);
});

test('manual validator warns about overpacked schedules and distinct destination areas on one day', () => {
  const plan = buildManualItinerary(input({ destinationIds: ['mysuru'] }), destinations);
  const day = plan.days[0];
  day.activities.push({ ...day.activities[1], name: 'Remote sample stop', area: 'Another region', suggestedStartTime: '16:00' }, { ...day.activities[1], name: 'Extra stop', area: 'Yet another region', suggestedStartTime: '17:30' });
  const warnings = validateManualPlan(plan);
  assert.ok(warnings.some(warning => warning.includes('sightseeing stops')));
  assert.ok(warnings.some(warning => warning.includes('different destination areas')));
});

test('packed pace adds a third sightseeing stop and triggers an ambition warning', () => {
  const plan = buildManualItinerary(input({ destinationIds: ['mysuru'], pace: 'Packed' }), destinations);
  assert.equal(plan.days[0].activities.filter(activity => activity.kind === 'attraction').length, 3);
  assert.ok(plan.manualWarnings.some(warning => warning.includes('sightseeing stops')));
});

test('manual input validation rejects invalid date ranges, traveler counts, and budgets', () => {
  assert.ok(validateManualInput(input({ departureDate: '2026-11-02', returnDate: '2026-11-01' })).some(message => message.includes('valid departure')));
  assert.ok(validateManualInput(input({ travelers: 0 })).some(message => message.includes('travelers')));
  assert.ok(validateManualInput(input({ totalBudget: Number.NaN })).some(message => message.includes('budget')));
  assert.throws(() => buildManualItinerary(input({ returnDate: '' }), destinations), /valid departure/);
});
