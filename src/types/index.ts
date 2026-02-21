export type TripStatus = "planned" | "started" | "finished";

// ユーザー情報
export interface User {
	id: string;
	username: string | null;
	profile_name: string | null;
	email: string | null;
	avatar_url: string | null;
	created_at: string | null;
	updated_at: string | null;
	deleted_at: string | null;
}

// 旅行プラン
export interface Trip {
	id: string;
	title: string | null;
	created_at: string | null;
	start_date: string | null;
	end_date: string | null;
	status: string | null;
	memo: string | null;
	owner_id: number | null;
	owner_user_id: string | null;
	theme_music_provider?: string | null;
	theme_music_track_id?: number | null;
	theme_music_title?: string | null;
	theme_music_artist?: string | null;
	theme_music_preview_url?: string | null;
	theme_music_artwork_url?: string | null;
	theme_music_track_view_url?: string | null;
	theme_music_set_at?: string | null;
	updated_at: string | null;
	deleted_at: string | null;
}

// 旅行参加者
export interface TripMember {
	id: number;
	user_id: string | null;
	joined_at: string | null;
	created_at: string | null;
	updated_at: string | null;
	deleted_at: string | null;
	trip_id: string | null;
}

// 写真
export interface Photo {
	id: number;
	user_id: string | null;
	trip_id: string | null;
	image_url: string | null;
	lat: number | null;
	lng: number | null;
	created_at: string | null;
	updated_at: string | null;
	deleted_at: string | null;
}

// 通知
export interface Notification {
	id: string;
	trip_id: string | null;
	type: string | null;
	scheduled_at: string | null;
	sent_at: string | null;
	status: string | null;
	created_at: string | null;
	updated_at: string | null;
	deleted_at: string | null;
}
