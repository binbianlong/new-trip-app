import { supabase } from "../lib/supabase";
import type { Trip } from "../types";

let trips: Trip[] = [];
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

export async function fetchTrips(): Promise<void> {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		trips = [];
		notify();
		return;
	}

	const { data: memberRows } = await supabase
		.from("trip_members")
		.select("trip_id")
		.eq("user_id", user.id)
		.is("deletead_at", null);

	const tripIds = (memberRows ?? [])
		.map((r) => r.trip_id)
		.filter((id): id is string => id != null);

	const { data: ownedTrips } = await supabase
		.from("trips")
		.select("*")
		.eq("owner_user_id", user.id)
		.is("deleted_at", null);

	const ownedIds = new Set((ownedTrips ?? []).map((t) => t.id));
	const memberOnlyIds = tripIds.filter((id) => !ownedIds.has(id));

	let memberTrips: Trip[] = [];
	if (memberOnlyIds.length > 0) {
		const { data } = await supabase
			.from("trips")
			.select("*")
			.in("id", memberOnlyIds)
			.is("deleted_at", null);
		memberTrips = data ?? [];
	}

	trips = [...(ownedTrips ?? []), ...memberTrips].sort(
		(a, b) =>
			new Date(b.created_at ?? "").getTime() -
			new Date(a.created_at ?? "").getTime(),
	);
	notify();
}
