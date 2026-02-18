export type TripStatus = "planned" | "active" | "completed";

export interface TripProject {
	id: string;
	title: string;
	startDate: string;
	memo?: string;
	status: TripStatus;
	participants: Participant[];
	inviteLink?: string;
	createdAt: string;
	ownerId: string;
	/** 旅行の代表地点（地図上のピン位置） */
	latitude?: number;
	longitude?: number;
}

export interface Participant {
	id: string;
	displayName: string;
	avatarColor: string;
}

export interface TripPhoto {
	id: string;
	tripId: string;
	uri: string;
	latitude: number;
	longitude: number;
	takenAt: string;
	takenBy: string;
	locationName?: string;
	caption?: string;
}

export interface RoutePoint {
	latitude: number;
	longitude: number;
	timestamp: string;
}

export interface User {
	id: string;
	username: string;
	displayName: string;
	avatarUri?: string;
	tripsCount: number;
	photosCount: number;
}

export interface Notification {
	id: string;
	type: "trip_invite" | "photo_reminder" | "trip_ended" | "system";
	title: string;
	message: string;
	read: boolean;
	createdAt: string;
	tripId?: string;
}
