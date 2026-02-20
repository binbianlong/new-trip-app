import { mockTrips as initialTrips } from "../data/mock";
import type { Trip } from "../types";

let trips: Trip[] = initialTrips.map((t) => ({ ...t }));
let listeners: Array<() => void> = [];

function notify() {
	for (const listener of listeners) {
		listener();
	}
}

export function subscribe(listener: () => void): () => void {
	listeners.push(listener);
	return () => {
		listeners = listeners.filter((l) => l !== listener);
	};
}

export function getTrips(): Trip[] {
	return trips;
}

export function getTripById(id: string): Trip | undefined {
	return trips.find((t) => t.id === id);
}

export function getActiveTripId(): string | null {
	return trips.find((t) => t.status === "started")?.id ?? null;
}

export function updateTripStatus(tripId: string, status: string) {
	trips = trips.map((t) => (t.id === tripId ? { ...t, status } : t));
	notify();
}
