import { supabase } from "./supabase";

/**
 * Ensure the given users are active members of the trip.
 * - New users are inserted.
 * - Soft-deleted memberships are restored.
 */
export async function ensureTripMembers(
	tripId: string,
	userIds: string[],
): Promise<void> {
	const uniqueUserIds = [...new Set(userIds)];
	if (uniqueUserIds.length === 0) return;

	const now = new Date().toISOString();
	const { error: restoreError } = await supabase
		.from("trip_members")
		.update({
			deleted_at: null,
			joined_at: now,
		})
		.eq("trip_id", tripId)
		.in("user_id", uniqueUserIds)
		.not("deleted_at", "is", null);
	if (restoreError) {
		throw restoreError;
	}

	const rowsToInsert = uniqueUserIds.map((userId) => ({
		trip_id: tripId,
		user_id: userId,
		joined_at: now,
		deleted_at: null,
	}));
	const { error: upsertError } = await supabase
		.from("trip_members")
		.upsert(rowsToInsert, {
			onConflict: "trip_id,user_id",
			ignoreDuplicates: true,
		});
	if (upsertError) {
		throw upsertError;
	}
}
