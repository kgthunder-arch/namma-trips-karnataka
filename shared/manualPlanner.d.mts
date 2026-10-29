import type { Activity, Destination, Itinerary, ManualPlannerInput } from '../src/types';
export type ManualDestinationScore = { destination: Destination; score: number; reasons: string[]; matched: string[]; inDuration: boolean; withinBudget: boolean };
export function rankManualDestinations(input: ManualPlannerInput, allDestinations: Destination[]): ManualDestinationScore[];
export function recommendManualDestinations(input: ManualPlannerInput, allDestinations: Destination[]): ManualDestinationScore[];
export function validateManualPlan(plan: Itinerary): string[];
export function buildManualItinerary(input: ManualPlannerInput, allDestinations: Destination[], destinationIds?: string[]): Itinerary;
export function validateManualInput(input: ManualPlannerInput): string[];
