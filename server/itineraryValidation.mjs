const asText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export function validPlan(plan, maxDays, candidateHighlights) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.days) || plan.days.length !== maxDays) return false;
  if (!asText(plan.tripTitle, 120) || !asText(plan.summary, 500) || !asText(plan.whySelected, 500) || plan.currency !== 'INR') return false;
  if (!Number.isFinite(plan.estimatedTotal) || plan.estimatedTotal < 0 || plan.estimatedTotal > 20_000_000) return false;
  if (!Array.isArray(plan.assumptions) || plan.assumptions.length > 20 || !plan.assumptions.every(item => asText(item, 500))) return false;
  if (!Array.isArray(candidateHighlights) || candidateHighlights.length === 0) return false;

  const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  return plan.days.every((day, i) => {
    if (!day || !Number.isInteger(day.dayNumber) || day.dayNumber !== i + 1 || !asText(day.location, 120) || !asText(day.accommodation, 300)) return false;
    if (!Array.isArray(day.activities) || day.activities.length < 3 || day.activities.length > 12 || !Number.isFinite(day.estimatedDailyCost) || day.estimatedDailyCost < 0 || day.estimatedDailyCost > 5_000_000) return false;
    if (day.date !== null && (typeof day.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.date))) return false;

    let previousEnd = -1;
    const mealIndexes = { breakfast: [], lunch: [], dinner: [] };
    for (const activity of day.activities) {
      if (!activity || !['attraction', 'meal', 'rest'].includes(activity.kind) || !asText(activity.name, 120) || !asText(activity.description, 500)) return false;
      if (!asText(activity.area, 120) || !asText(activity.travelNote, 300) || !asText(activity.tip, 300)) return false;
      if (!Number.isInteger(activity.durationMinutes) || activity.durationMinutes < 20 || activity.durationMinutes > 240 || !Number.isFinite(activity.estimatedCost) || activity.estimatedCost < 0 || activity.estimatedCost > 1_000_000 || !validTime(activity.suggestedStartTime)) return false;
      if (activity.sourceUrl !== null && typeof activity.sourceUrl !== 'string') return false;
      if (activity.routeTravelMinutes !== null && (!Number.isInteger(activity.routeTravelMinutes) || activity.routeTravelMinutes < 0)) return false;
      if (activity.routingProvider !== null && typeof activity.routingProvider !== 'string') return false;
      if (activity.kind === 'attraction' && !candidateHighlights.some(item => item.toLowerCase() === activity.name.trim().toLowerCase())) return false;
      if (activity.kind === 'meal' && (activity.durationMinutes < 30 || activity.durationMinutes > 120)) return false;
      if (activity.kind === 'attraction' && (activity.durationMinutes < 45 || activity.durationMinutes > 210)) return false;

      const [hours, minutes] = activity.suggestedStartTime.split(':').map(Number);
      const start = hours * 60 + minutes;
      const end = start + activity.durationMinutes;
      if (start < previousEnd || end > 24 * 60) return false;
      previousEnd = end;
      if (activity.kind === 'meal') {
        const mealName = activity.name.toLowerCase();
        if (mealName.includes('breakfast') && (start < 6 * 60 || start > 10 * 60 + 30)) return false;
        if (mealName.includes('lunch') && (start < 11 * 60 || start > 15 * 60)) return false;
        if (mealName.includes('dinner') && (start < 17 * 60 || start > 21 * 60 + 30)) return false;
        for (const meal of Object.keys(mealIndexes)) if (activity.name.toLowerCase().includes(meal)) mealIndexes[meal].push({ index: day.activities.indexOf(activity), start });
      }
    }

    const breakfast = mealIndexes.breakfast[0];
    const lunch = mealIndexes.lunch[0];
    const dinner = mealIndexes.dinner[0];
    if (!breakfast || !lunch || !dinner || mealIndexes.breakfast.length !== 1 || mealIndexes.lunch.length !== 1 || mealIndexes.dinner.length !== 1) return false;
    return breakfast.index < lunch.index && lunch.index < dinner.index && breakfast.start < lunch.start && lunch.start < dinner.start;
  });
}

export function reconcilePlanTotal(plan) {
  const dailyTotal = plan.days.reduce((sum, day) => sum + day.estimatedDailyCost, 0);
  return { ...plan, estimatedTotal: Math.round(dailyTotal) };
}
