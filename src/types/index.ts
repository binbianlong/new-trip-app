export type TripStatus = "planned" | "active" | "completed";

export interface User {
	id: string;
	username: string | null;
	profile_name: string | null;
	email: string | null;
	avatar_url: string | null;
	created_at: string | null;
	update_at: string | null;
	deleted_at: string | null;
}

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
}

export interface TripMember {
	id: number;
	user_id: string | null;
	joined_at: string | null;
	created_at: string | null;
	updated_at: string | null;
	deleted_at: string | null;
	trip_id: string | null;
}

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
// データベース型定義

// ユーザー情報
export type User = {
	id: string;
	username: string;
	profile_name: string;
	email: string;
	avatar_url: string | null;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
};

// 旅行プラン
export type Trip = {
	id: string;
	title: string;
	start_date: string; // YYYY-MM-DD形式
	end_date: string | null; // YYYY-MM-DD形式
	status: "planned" | "started" | "finished";
	memo: string | null;
	owner_id: string;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
};

// 旅行参加者
export type TripMember = {
	id: string;
	trip_id: string;
	user_id: string;
	joined_at: string;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
};

// 写真
export type Photo = {
	id: string;
	trip_id: string;
	user_id: string;
	image_url: string;
	taken_at: string;
	lat: number;
	lng: number;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
};

// 通知
export type Notification = {
	id: string;
	trip_id: string;
	type: string;
	scheduled_at: string;
	sent_at: string | null;
	status: string;
	created_at: string;
	updated_at: string;
	deleted_at: string | null;
};
