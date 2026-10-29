import test from 'node:test';
import assert from 'node:assert/strict';
import { validPlan, reconcilePlanTotal } from '../server/itineraryValidation.mjs';

const makePlan = () => ({
  tripTitle: 'Mysuru day', summary: 'A gentle city day.', currency: 'INR', estimatedTotal: 99999, assumptions: ['Planning estimate only.'], whySelected: 'A compact culture trip.',
  days: [{ dayNumber: 1, date: null, location: 'Mysuru', accommodation: 'No overnight stay', estimatedDailyCost: 1800, activities: [
    { kind: 'meal', name: 'Breakfast', description: 'A relaxed local breakfast.', suggestedStartTime: '08:00', durationMinutes: 45, estimatedCost: 150, sourceUrl: null, area: 'Mysuru', travelNote: 'No route data.', routeTravelMinutes: null, routingProvider: null, tip: 'Confirm local access.' },
    { kind: 'attraction', name: 'Mysuru Palace', description: 'Explore the palace area.', suggestedStartTime: '09:00', durationMinutes: 100, estimatedCost: 0, sourceUrl: null, area: 'Mysuru', travelNote: 'No route data.', routeTravelMinutes: null, routingProvider: null, tip: 'Check current visitor guidance.' },
    { kind: 'meal', name: 'Lunch', description: 'Pause for lunch.', suggestedStartTime: '12:00', durationMinutes: 60, estimatedCost: 250, sourceUrl: null, area: 'Mysuru', travelNote: 'No route data.', routeTravelMinutes: null, routingProvider: null, tip: 'Choose a place to suit your needs.' },
    { kind: 'attraction', name: 'Devaraja Market', description: 'Browse the market area.', suggestedStartTime: '13:30', durationMinutes: 60, estimatedCost: 0, sourceUrl: null, area: 'Mysuru', travelNote: 'No route data.', routeTravelMinutes: null, routingProvider: null, tip: 'Be respectful when taking photos.' },
    { kind: 'meal', name: 'Dinner', description: 'End with dinner.', suggestedStartTime: '19:00', durationMinutes: 60, estimatedCost: 300, sourceUrl: null, area: 'Mysuru', travelNote: 'No route data.', routeTravelMinutes: null, routingProvider: null, tip: 'Plan a safe return.' },
  ] }],
});

test('accepts a clustered, sequenced day with realistic meal breaks', () => {
  const plan = makePlan();
  assert.equal(validPlan(plan, 1, ['Mysuru Palace', 'Devaraja Market']), true);
  assert.equal(reconcilePlanTotal(plan).estimatedTotal, 1800);
});

test('rejects uncurated attractions, overlapping times, and missing meal breaks', () => {
  const outsideCluster = makePlan(); outsideCluster.days[0].activities[1].name = 'Distant uncurated attraction';
  assert.equal(validPlan(outsideCluster, 1, ['Mysuru Palace', 'Devaraja Market']), false);
  const overlap = makePlan(); overlap.days[0].activities[1].suggestedStartTime = '08:30';
  assert.equal(validPlan(overlap, 1, ['Mysuru Palace', 'Devaraja Market']), false);
  const noLunch = makePlan(); noLunch.days[0].activities[2].name = 'Coffee break';
  assert.equal(validPlan(noLunch, 1, ['Mysuru Palace', 'Devaraja Market']), false);
  const implausibleMeal = makePlan(); implausibleMeal.days[0].activities[2].suggestedStartTime = '16:30';
  assert.equal(validPlan(implausibleMeal, 1, ['Mysuru Palace', 'Devaraja Market']), false);
});
