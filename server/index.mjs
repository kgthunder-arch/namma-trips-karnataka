import express from 'express';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validPlan, reconcilePlanTotal } from './itineraryValidation.mjs';

const app = express();
const port = Number(process.env.PORT || 8787);
const here = dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: '32kb' }));

const schema = {
  type: 'OBJECT', required: ['tripTitle','summary','currency','estimatedTotal','assumptions','whySelected','days'],
  properties: {
    tripTitle: { type: 'STRING' }, summary: { type: 'STRING' }, currency: { type: 'STRING', enum: ['INR'] }, estimatedTotal: { type: 'NUMBER' },
    assumptions: { type: 'ARRAY', items: { type: 'STRING' } }, whySelected: { type: 'STRING' },
    days: { type: 'ARRAY', items: { type: 'OBJECT', required: ['dayNumber','date','location','activities','accommodation','estimatedDailyCost'], properties: {
      dayNumber: { type: 'INTEGER' }, date: { type: 'STRING', nullable: true }, location: { type: 'STRING' }, accommodation: { type: 'STRING' }, estimatedDailyCost: { type: 'NUMBER' },
      activities: { type: 'ARRAY', items: { type: 'OBJECT', required: ['kind','name','description','suggestedStartTime','durationMinutes','estimatedCost','sourceUrl','area','travelNote','routeTravelMinutes','routingProvider','tip'], properties: {
        kind: { type: 'STRING', enum: ['attraction','meal','rest'] }, name: { type: 'STRING' }, description: { type: 'STRING' }, suggestedStartTime: { type: 'STRING' }, durationMinutes: { type: 'INTEGER' }, estimatedCost: { type: 'NUMBER' }, sourceUrl: { type: 'STRING', nullable: true }, area: { type: 'STRING' }, travelNote: { type: 'STRING' }, routeTravelMinutes: { type: 'INTEGER', nullable: true }, routingProvider: { type: 'STRING', nullable: true }, tip: { type: 'STRING' }
      } } }
    } } }
  }
};

const requestWindows = new Map();
function limitRequests(max, windowMs) {
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const bucket = requestWindows.get(key);
    if (!bucket || now - bucket.start >= windowMs) requestWindows.set(key, { start: now, count: 1 });
    else if (bucket.count >= max) return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    else bucket.count += 1;
    next();
  };
}

app.get('/api/health', (_req, res) => res.json({
  ok: true,
  aiConfigured: Boolean(process.env.GEMINI_API_KEY),
  routingProvider: process.env.GOOGLE_MAPS_API_KEY ? 'google-directions' : null,
  liveInformation: false,
  storage: 'local-demo',
}));
app.post('/api/plan', limitRequests(8, 60_000), async (req, res) => {
  const input = req.body;
  const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  const validParty = Number.isInteger(input?.adults) && input.adults >= 1 && input.adults <= 10 && Number.isInteger(input?.children) && input.children >= 0 && input.children <= 6;
  const validBudget = Number.isFinite(input?.budget) && input.budget >= 500 && input.budget <= 2_000_000;
  const validDate = value => value === '' || value === null || value === undefined || typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!input || typeof input !== 'object' || !Number.isInteger(input.days) || input.days < 1 || input.days > 14 || !validText(input.startCity, 100) || !validText(input.destination, 100) || !validText(input.resolvedDestination, 120) || !validParty || !validBudget || !validDate(input.startDate) || !['per-person','total'].includes(input.budgetMode) || !Array.isArray(input.candidateHighlights) || input.candidateHighlights.length > 30 || !input.candidateHighlights.every(item => validText(item, 150)) || !Array.isArray(input.interests) || input.interests.length > 20 || !input.interests.every(item => validText(item, 60))) return res.status(400).json({ error: 'Please check your trip details and try again.' });
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini is not configured. Use the built-in demo planner or add GEMINI_API_KEY to your environment.' });
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const prompt = `Create a practical Karnataka itinerary from this traveler input. Return only the requested JSON schema. Input: ${JSON.stringify(input)}. GEOGRAPHIC CONSTRAINT: keep every day in the one resolved destination ${input.resolvedDestination}. For attraction activities, use only exact names from candidateHighlights; do not add another town, region or distant site. Every activity area should be within this same destination. Never combine separate Karnataka regions into a short trip. SCHEDULE: every day must include distinct Breakfast, Lunch and Dinner meal activities, each 45-90 minutes; sequence all activities in chronological order without overlap. Keep sightseeing to 1-3 attraction activities per day, usually 60-150 minutes each, and include at least one rest/buffer block on long days. Use a relaxed plausible day, not a packed checklist. Route data: set routeTravelMinutes and routingProvider to null; travelNote must say travel times are omitted because no routing provider and verified stop coordinates are configured. Never infer or estimate travel durations or distances. BUDGET: provide rounded INR planning allowances, not quotations; state assumptions for party size, transport preference, accommodation, food, and which taxes/fares/fees are unverified or excluded. For attraction fees with no verified source, use zero to mean excluded/unknown, not free. Do not invent exact addresses, coordinates, opening hours, admission prices, schedules, room availability, live weather or road conditions. Set sourceUrl to null unless an official source is known (the server will hide attraction URLs because no verified link inventory is configured). Avoid unsafe or restricted suggestions.`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.6 } }),
      signal: AbortSignal.timeout(45000),
    });
    const result = await response.json();
    if (!response.ok) return res.status(response.status === 429 ? 429 : 502).json({ error: response.status === 429 ? 'The planner is busy. Please try again shortly.' : 'Gemini could not create this plan right now.' });
    const text = result.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
    let plan;
    try { plan = JSON.parse(text); } catch { return res.status(502).json({ error: 'The planner returned an incomplete response. Please try again.' }); }
    if (!validPlan(plan, input.days, input.candidateHighlights)) return res.status(502).json({ error: 'The generated plan did not pass schedule or destination-cluster validation. Please try the local demo plan.' });
    plan = reconcilePlanTotal(plan);
    // No attraction-level URL inventory is configured, so don't show unverified model-suggested links as official.
    const noRoute = 'Travel time omitted: no routing provider is configured and verified stop coordinates are unavailable.';
    for (const day of plan.days) {
      day.location = input.resolvedDestination;
      for (const activity of day.activities) {
        activity.area = input.resolvedDestination;
        activity.sourceUrl = null;
        activity.travelNote = noRoute;
        activity.routeTravelMinutes = null;
        activity.routingProvider = null;
      }
    }
    return res.json({ plan, source: 'gemini' });
  } catch (error) {
    console.error('Planner request failed:', error?.message || error);
    return res.status(502).json({ error: 'The planner is temporarily unavailable. Try the built-in demo plan.' });
  }
});

app.post('/api/route-preview', limitRequests(20, 60_000), async (req, res) => {
  if (!process.env.GOOGLE_MAPS_API_KEY) return res.status(503).json({ error: 'Google Maps Directions is not configured. Stop distances and durations are omitted.' });
  const { origin, destination, waypoints = [] } = req.body || {};
  const validPlace = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 180;
  if (!validPlace(origin) || !validPlace(destination) || !Array.isArray(waypoints) || waypoints.length > 8 || !waypoints.every(validPlace)) return res.status(400).json({ error: 'Choose valid itinerary stops to preview a route.' });
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    if (waypoints.length) url.searchParams.set('waypoints', waypoints.join('|'));
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return res.status(502).json({ error: 'Google Maps could not calculate this route right now.' });
    const payload = await response.json();
    if (payload.status !== 'OK' || !payload.routes?.[0]?.legs?.length) return res.status(502).json({ error: 'Google Maps did not return a usable route for these stops.' });
    const legs = payload.routes[0].legs.map(leg => {
      if (!Number.isFinite(leg.distance?.value) || !Number.isFinite(leg.duration?.value)) throw new Error('Route response is missing distance or duration.');
      return { startAddress: leg.start_address, endAddress: leg.end_address, distanceMeters: leg.distance.value, distanceText: leg.distance.text, durationSeconds: leg.duration.value, durationText: leg.duration.text };
    });
    const maps = new URL('https://www.google.com/maps/dir/');
    maps.searchParams.set('api', '1');
    maps.searchParams.set('origin', origin);
    maps.searchParams.set('destination', destination);
    if (waypoints.length) maps.searchParams.set('waypoints', waypoints.join('|'));
    return res.json({ provider: 'Google Maps Directions', retrievedAt: new Date().toISOString(), trafficIncluded: false, legs, totalDistanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0), totalDurationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0), externalMapUrl: maps.toString() });
  } catch (error) {
    console.error('Route preview failed:', error?.message || error);
    return res.status(502).json({ error: 'Route preview is temporarily unavailable. No travel duration is shown.' });
  }
});

// Production serves the built frontend from the same process. In development, Vite runs separately.
const dist = resolve(here, '../dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/.*/, async (_req, res) => res.type('html').send(await readFile(resolve(dist, 'index.html'), 'utf8')));
}
app.listen(port, () => console.log(`Namma Trips API listening on http://localhost:${port}`));
