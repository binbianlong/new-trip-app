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
		console.log("[fetchTrips] No authenticated user");
		trips = [];
		notify();
		return;
	}
	console.log("[fetchTrips] user.id:", user.id);

	const { data: memberRows, error: memberError } = await supabase
		.from("trip_members")
		.select("trip_id")
		.eq("user_id", user.id)
		.is("deletead_at", null);
	console.log("[fetchTrips] trip_members:", memberRows, "error:", memberError);

	const tripIds = (memberRows ?? [])
		.map((r) => r.trip_id)
		.filter((id): id is string => id != null);

	const { data: ownedTrips, error: ownedError } = await supabase
		.from("trips")
		.select("*")
		.eq("owner_user_id", user.id)
		.is("deleted_at", null);
	console.log("[fetchTrips] ownedTrips:", ownedTrips, "error:", ownedError);

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
