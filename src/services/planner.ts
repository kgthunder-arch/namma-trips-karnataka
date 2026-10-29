import type { Activity, Itinerary, PlannerInput, TripDay } from '../types';
import type { Destination } from '../types';

const money = (n: number) => Math.max(0, Math.round(n / 100) * 100);
const noRoute = 'Travel time omitted: no routing provider is configured and verified stop coordinates are unavailable.';

export function demoPlan(input: PlannerInput, destination: Destination): Itinerary {
  const group = Math.max(1, input.adults + input.children);
  const budgetTotal = input.budgetMode === 'per-person' ? input.budget * group : input.budget;
  const dailyAllowance = budgetTotal / input.days;
  const highlights = destination.highlights;
  const meal = (name: string, time: string, minutes: number, perPerson: number): Activity => ({
    kind: 'meal', name, description: 'Meal break; choose a nearby option that suits your food preferences. Venue, menu and current prices are not checked.',
    suggestedStartTime: time, durationMinutes: minutes, estimatedCost: money(Math.min(perPerson * group, dailyAllowance * 0.14)), sourceUrl: null,
    area: destination.name, travelNote: noRoute, routeTravelMinutes: null, routingProvider: null, tip: 'Confirm dietary options and the final bill locally.',
  });
  const attraction = (name: string, time: string, minutes: number): Activity => ({
    kind: 'attraction', name, description: 'Allow time to explore at your own pace. Verify current access and visitor information before departure.',
    suggestedStartTime: time, durationMinutes: minutes, estimatedCost: 0, sourceUrl: null, area: destination.name, travelNote: noRoute,
    routeTravelMinutes: null, routingProvider: null, tip: 'Entry fees and operating schedules are not verified; check official information before visiting.',
  });

  const days: TripDay[] = Array.from({ length: input.days }, (_, index) => {
    const dayNo = index + 1;
    const date = input.startDate ? (() => { const value = new Date(`${input.startDate}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + index); return value.toISOString().slice(0, 10); })() : null;
    const first = highlights[(index * 2) % highlights.length];
    const second = highlights[(index * 2 + 1) % highlights.length];
    const relaxed = input.pace.toLowerCase() === 'relaxed';
    const activities: Activity[] = [
      meal('Breakfast break', '08:00', 45, 180),
      attraction(first, '09:00', relaxed ? 150 : 120),
      meal('Lunch break', '12:00', 75, 350),
      ...(relaxed ? [{ kind: 'rest' as const, name: 'Rest and refresh', description: 'Keep the afternoon open for a slower pace or an unplanned local discovery.', suggestedStartTime: '14:00', durationMinutes: 90, estimatedCost: 0, sourceUrl: null, area: destination.name, travelNote: noRoute, routeTravelMinutes: null, routingProvider: null, tip: 'Take a break and check local conditions before continuing.' }] : [attraction(second, '14:00', 90)]),
      meal('Dinner break', '18:30', 60, 450),
    ];
    const dailyEstimate = money(Math.max(0, dailyAllowance * (input.accommodation === 'none' ? 0.66 : 0.88)));
    return {
      dayNumber: dayNo, date, location: destination.name, activities,
      accommodation: input.accommodation === 'none' ? 'No overnight stay selected; lodging excluded.' : `${input.accommodation} stay allowance near ${destination.name}; no property, rate or availability checked.`,
      estimatedDailyCost: dailyEstimate,
    };
  });

  const total = money(days.reduce((sum, day) => sum + day.estimatedDailyCost, 0));
  const budgetBasis = input.budgetMode === 'per-person' ? `${money(input.budget)} per person × ${group} travelers` : `${money(input.budget)} total for ${group} travelers`;
  return {
    tripTitle: `${destination.name} · ${input.days}-day ${input.style.toLowerCase()} escape`,
    summary: `A ${input.pace.toLowerCase()} paced starter plan from ${input.startCity}, shaped around ${input.interests.slice(0, 3).join(', ') || 'local highlights'}.`,
    currency: 'INR', estimatedTotal: total,
    assumptions: [
      `Budget basis: ${budgetBasis}. This is a rounded planning allowance, not a quote.`,
      `Accommodation: ${input.accommodation === 'none' ? 'excluded' : `${input.accommodation} allowance`}; exact room rates, taxes and availability are not checked.`,
      `Food: meal allowances for ${input.food.toLowerCase()} preferences; venue prices and taxes are not checked.`,
      'Attraction entry fees are excluded unless a verified current price is connected; zero shown for a stop means unknown/excluded, not free.',
      `Transport mode selected: ${input.transport}; fares, fuel, parking and tolls are not live-priced.`,
      noRoute,
      'Verify access, opening schedules, seasonal conditions and local rules before departure.',
    ],
    whySelected: `${destination.name} was selected because it fits the available ${input.days}-day window and your preferences. The plan stays within this destination cluster; it does not estimate intercity travel.`,
    days,
  };
}

export async function generatePlan(input: PlannerInput, destination: Destination): Promise<{ plan: Itinerary; source: 'gemini' | 'demo'; notice?: string }> {
  try {
    const response = await fetch('/api/plan', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...input, resolvedDestination: destination.name, candidateHighlights: destination.highlights }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'AI planner unavailable');
    return { plan: payload.plan as Itinerary, source: 'gemini' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI planner unavailable';
    return { plan: demoPlan(input, destination), source: 'demo', notice: `${message} A local demo itinerary is shown instead.` };
  }
}
