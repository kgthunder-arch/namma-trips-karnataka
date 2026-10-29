export type Destination = {
  id: string; name: string; kannada: string; tagline: string; category: string; image: string; imageAlt: string;
  duration: string; budget: string; season: string; description: string; highlights: string[]; officialUrl: string;
  interests: string[]; suggestedVisitDays: number; suggestionCluster: string; costPerPersonDay: { low: number; high: number }; costAssumptions: string;
  verification: 'demo'; verifiedAddress: string | null; coordinates: { lat: number; lng: number } | null; source: string; lastVerified: string | null;
};
export type Activity = { kind: 'attraction' | 'meal' | 'rest'; name: string; description: string; suggestedStartTime: string; durationMinutes: number; estimatedCost: number; sourceUrl: string | null; area: string; travelNote: string; routeTravelMinutes: number | null; routingProvider: string | null; tip: string };
export type TripDay = { dayNumber: number; date: string | null; location: string; activities: Activity[]; accommodation: string; estimatedDailyCost: number };
export type BudgetCategories = Record<'transport' | 'accommodation' | 'food' | 'entryFees' | 'activities' | 'parkingTolls' | 'misc', number>;
export type ManualPlannerInput = { startCity: string; destinationIds: string[]; departureDate: string; returnDate: string; travelers: number; transport: 'Car' | 'Bike' | 'Bus' | 'Train' | 'Other'; totalBudget: number; accommodation: 'None' | 'Budget' | 'Mid-range' | 'Premium'; interests: string[]; pace: 'Relaxed' | 'Balanced' | 'Packed' };
export type Itinerary = { tripTitle: string; summary: string; currency: 'INR'; estimatedTotal: number; assumptions: string[]; whySelected: string; days: TripDay[]; planningMode?: 'manual' | 'ai'; manualInput?: ManualPlannerInput; manualWarnings?: string[]; budgetCategories?: BudgetCategories };
export type PlannerInput = { startCity: string; destination: string; startDate: string; days: number; adults: number; children: number; budget: number; budgetMode: 'per-person' | 'total'; style: string; transport: string; accommodation: string; pace: string; food: string; language: string; interests: string[]; accessibility: string };
export type RouteLeg = { startAddress: string; endAddress: string; distanceMeters: number; distanceText: string; durationSeconds: number; durationText: string };
export type RoutePreview = { provider: string; retrievedAt: string; trafficIncluded: boolean; legs: RouteLeg[]; totalDistanceMeters: number; totalDurationSeconds: number; externalMapUrl: string };
