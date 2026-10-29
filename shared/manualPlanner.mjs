import { createBudgetBreakdown } from './budget.mjs';
const roundTo100 = (value) => Math.max(0, Math.round(value / 100) * 100);
const getTripDays = (input) => {
    if (!input.departureDate || !input.returnDate)
        return 1;
    const start = Date.parse(`${input.departureDate}T00:00:00Z`);
    const end = Date.parse(`${input.returnDate}T00:00:00Z`);
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.floor((end - start) / 86_400_000) + 1 : 1;
};
export function validateManualInput(input) {
    const errors = [];
    if (!input || typeof input.startCity !== 'string' || !input.startCity.trim()) errors.push('Add a starting city.');
    const start = input?.departureDate ? Date.parse(`${input.departureDate}T00:00:00Z`) : Number.NaN;
    const end = input?.returnDate ? Date.parse(`${input.returnDate}T00:00:00Z`) : Number.NaN;
    const days = Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.floor((end - start) / 86_400_000) + 1 : 0;
    if (!input?.departureDate || !input?.returnDate || days < 1 || days > 30) errors.push('Choose valid departure and return dates for a trip of 1–30 days.');
    if (!Number.isInteger(input?.travelers) || input.travelers < 1 || input.travelers > 12) errors.push('Choose between 1 and 12 travelers.');
    if (!Number.isFinite(input?.totalBudget) || input.totalBudget < 0) errors.push('Enter a valid total budget.');
    if (!Array.isArray(input?.interests) || !input.interests.every(item => typeof item === 'string')) errors.push('Choose valid interests.');
    if (!['Car', 'Bike', 'Bus', 'Train', 'Other'].includes(input?.transport)) errors.push('Choose a transport method.');
    if (!['None', 'Budget', 'Mid-range', 'Premium'].includes(input?.accommodation)) errors.push('Choose an accommodation preference.');
    if (!['Relaxed', 'Balanced', 'Packed'].includes(input?.pace)) errors.push('Choose a travel pace.');
    return errors;
}

export function rankManualDestinations(input, allDestinations) {
    const days = getTripDays(input);
    const party = Math.max(1, input.travelers);
    const perPersonDayBudget = input.totalBudget / party / Math.max(1, days);
    const interests = input.interests.map(item => item.toLowerCase());
    const ranked = allDestinations.map(destination => {
        const matched = destination.interests.filter(item => interests.some(interest => item.toLowerCase().includes(interest) || interest.includes(item.toLowerCase())));
        const inDuration = days >= destination.suggestedVisitDays;
        const withinBudget = perPersonDayBudget >= destination.costPerPersonDay.low;
        const score = matched.length * 4 + (inDuration ? 2 : 0) + (withinBudget ? 2 : -2);
        const reasons = [
            matched.length ? `Matches your interest in ${matched.slice(0, 2).join(' and ')}.` : 'A flexible option if you want to broaden your interests.',
            inDuration ? `A ${days}-day window fits its suggested ${destination.suggestedVisitDays}-day visit.` : `Suggested stay is ${destination.suggestedVisitDays} days; your shorter window may feel rushed.`,
            withinBudget ? 'Its sample lower daily allowance fits the budget you entered.' : 'Its sample lower daily allowance is above the budget you entered.',
        ];
        return { destination, score, reasons, matched, inDuration, withinBudget };
    }).sort((a, b) => b.score - a.score || a.destination.name.localeCompare(b.destination.name));
    const preferredCluster = ranked[0]?.destination.suggestionCluster;
    return [...ranked.filter(item => item.destination.suggestionCluster === preferredCluster), ...ranked.filter(item => item.destination.suggestionCluster !== preferredCluster)];
}
export function recommendManualDestinations(input, allDestinations) {
    const days = getTripDays(input);
    const maxSuggestions = days <= 2 ? 3 : days <= 4 ? 4 : 5;
    return rankManualDestinations(input, allDestinations).slice(0, maxSuggestions);
}
function makeActivity(kind, name, description, time, durationMinutes, cost, area) {
    return { kind, name, description, suggestedStartTime: time, durationMinutes, estimatedCost: cost, sourceUrl: null, area, travelNote: 'No route duration added to this activity. Use the provider route preview when available.', routeTravelMinutes: null, routingProvider: null, tip: 'Check current access, schedules, and local guidance before travel.' };
}
export function validateManualPlan(plan) {
    const warnings = [];
    if (!plan.days.length)
        warnings.push('Add at least one travel day.');
    for (const day of plan.days) {
        const attractions = day.activities.filter(activity => activity.kind === 'attraction');
        if (attractions.length > 2)
            warnings.push(`Day ${day.dayNumber} has ${attractions.length} sightseeing stops. Consider moving a stop to another day.`);
        const areas = new Set(attractions.map(activity => activity.area.trim().toLowerCase()));
        if (areas.size > 1)
            warnings.push(`Day ${day.dayNumber} combines different destination areas. Split the day or check a route; no travel distance is assumed.`);
        let previousEnd = -1;
        for (const activity of day.activities) {
            if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(activity.suggestedStartTime) || !Number.isFinite(activity.durationMinutes) || activity.durationMinutes < 15 || activity.durationMinutes > 300 || !Number.isFinite(activity.estimatedCost) || activity.estimatedCost < 0) {
                warnings.push(`Day ${day.dayNumber} has an activity with an invalid time, duration, or expense.`);
                break;
            }
            const [hour, minute] = activity.suggestedStartTime.split(':').map(Number);
            const start = hour * 60 + minute;
            if (start < previousEnd) {
                warnings.push(`Day ${day.dayNumber} has overlapping or out-of-order activities.`);
                break;
            }
            previousEnd = start + activity.durationMinutes;
        }
        const meals = day.activities.filter(activity => activity.kind === 'meal').map(activity => activity.name.toLowerCase());
        for (const meal of ['breakfast', 'lunch', 'dinner'])
            if (!meals.some(name => name.includes(meal)))
                warnings.push(`Day ${day.dayNumber} has no ${meal} break.`);
    }
    if (!Number.isFinite(plan.estimatedTotal) || plan.estimatedTotal < 0)
        warnings.push('The trip total is invalid.');
    if (plan.manualInput && plan.estimatedTotal > plan.manualInput.totalBudget)
        warnings.push(`The sample estimate of ₹${plan.estimatedTotal.toLocaleString('en-IN')} is above your ₹${plan.manualInput.totalBudget.toLocaleString('en-IN')} budget.`);
    return [...new Set(warnings)];
}
export function buildManualItinerary(input, allDestinations, destinationIds = input.destinationIds) {
    const inputErrors = validateManualInput(input);
    if (inputErrors.length) throw new Error(inputErrors[0]);
    const daysCount = getTripDays(input);
    const selected = destinationIds.map(id => allDestinations.find(destination => destination.id === id)).filter((destination) => Boolean(destination));
    const recommendations = recommendManualDestinations(input, allDestinations);
    const destinations = (selected.length ? selected.slice(0, daysCount) : recommendations.slice(0, 1).map(item => item.destination));
    if (!destinations.length)
        throw new Error('Choose a destination to start your trip.');
    const travelers = Math.max(1, input.travelers);
    const attractionsPerDay = input.pace === 'Relaxed' ? 1 : input.pace === 'Packed' ? 3 : 2;
    const days = Array.from({ length: daysCount }, (_, index) => {
        const groupIndex = Math.min(destinations.length - 1, Math.floor(index * destinations.length / daysCount));
        const destination = destinations[groupIndex];
        const highlights = destination.highlights;
        const attractionActivities = Array.from({ length: attractionsPerDay }, (_, stopIndex) => {
            const name = highlights[(index + stopIndex) % highlights.length];
            return makeActivity('attraction', name, `Manual stop from the ${destination.name} sample destination record. Confirm the exact venue and current visitor information before departure.`, stopIndex === 0 ? '09:00' : stopIndex === 1 ? '14:00' : '16:15', stopIndex === 0 ? 120 : stopIndex === 1 ? 90 : 60, 0, destination.name);
        });
        const dailyFood = roundTo100(650 * travelers);
        const activities = [
            makeActivity('meal', 'Breakfast break', 'Planning allowance only; choose a venue that suits your group.', '08:00', 45, roundTo100(150 * travelers), destination.name),
            attractionActivities[0],
            makeActivity('meal', 'Lunch break', 'Planning allowance only; local venue prices are not checked.', '12:00', 60, roundTo100(250 * travelers), destination.name),
            ...(input.pace === 'Relaxed' ? [makeActivity('rest', 'Rest and refresh', 'Leave this time open for a slower pace or an unplanned pause.', '14:00', 90, 0, destination.name)] : attractionActivities.slice(1)),
            makeActivity('meal', 'Dinner break', 'Planning allowance only; current menu prices and taxes are not checked.', '18:30', 60, Math.max(0, dailyFood - roundTo100(400 * travelers)), destination.name),
        ];
        const departure = input.departureDate ? new Date(`${input.departureDate}T00:00:00Z`) : null;
        if (departure)
            departure.setUTCDate(departure.getUTCDate() + index);
        return {
            dayNumber: index + 1,
            date: departure ? departure.toISOString().slice(0, 10) : null,
            location: destination.name,
            activities,
            accommodation: input.accommodation === 'None' ? 'No overnight stay selected; lodging excluded.' : `${input.accommodation} stay allowance near ${destination.name}; no property, rate, taxes, or availability checked.`,
            estimatedDailyCost: roundTo100(input.accommodation === 'None' ? destination.costPerPersonDay.low * 0.65 : input.accommodation === 'Budget' ? destination.costPerPersonDay.low + (destination.costPerPersonDay.high - destination.costPerPersonDay.low) * 0.15 : input.accommodation === 'Premium' ? destination.costPerPersonDay.high : destination.costPerPersonDay.low + (destination.costPerPersonDay.high - destination.costPerPersonDay.low) * 0.5) * travelers,
        };
    });
    const estimatedTotal = days.reduce((sum, day) => sum + day.estimatedDailyCost, 0);
    const budgetCategories = createBudgetBreakdown(estimatedTotal, days.flatMap(day => day.activities), input.accommodation !== 'None');
    const plan = {
        tripTitle: `${destinations.map(destination => destination.name).join(' + ')} · ${daysCount}-day manual trip`,
        summary: `A manually built ${input.pace.toLowerCase()} ${daysCount}-day plan from ${input.startCity}, with ${travelers} traveler${travelers === 1 ? '' : 's'} and ${input.transport.toLowerCase()} transport.`,
        currency: 'INR', estimatedTotal, budgetCategories, planningMode: 'manual', manualInput: { ...input, destinationIds: destinations.map(destination => destination.id) },
        assumptions: [
            `Destination cost ranges in this sample dataset are per-person daily planning estimates multiplied by ${travelers} traveler${travelers === 1 ? '' : 's'}; they are not verified current prices.`,
            `Transport: ${input.transport}; actual fares, fuel, parking, and toll costs are not live-priced.`,
            `Accommodation: ${input.accommodation}; Budget uses the lower sample band, Mid-range uses its midpoint, Premium the upper band, and None applies a reduced no-overnight scenario. Nightly rates, taxes, and availability are not checked.`,
            'Attraction fees are unknown and excluded unless you add a current value in the budget calculator; zero does not mean free.',
            'Food allowances are illustrative. Taxes, current meal prices, tickets and activity fees may be additional.',
            'No distances or travel durations are fabricated. Confirm route feasibility, access, hours, and seasonal conditions before departure.',
        ],
        whySelected: recommendations.filter(item => destinations.some(destination => destination.id === item.destination.id)).map(item => `${item.destination.name}: ${item.reasons.join(' ')}`).join(' ') || `${destinations.map(destination => destination.name).join(', ')} selected manually by you.`,
        days,
    };
    plan.manualWarnings = validateManualPlan(plan);
    if (selected.length > daysCount)
        plan.manualWarnings.push(`You selected ${selected.length} destinations for ${daysCount} days. One destination per day is included; review the selection to reduce rushing.`);
    if (new Set(destinations.map(destination => destination.suggestionCluster)).size > 1)
        plan.manualWarnings.push('Your selected destinations span different sample planning clusters. No distances are assumed; check route feasibility before travel.');
    return plan;
}
