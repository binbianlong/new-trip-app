import type {
	Notification,
	RoutePoint,
	TripPhoto,
	TripProject,
	User,
} from "../types";

export const mockUser: User = {
	id: "user-001",
	username: "tabi_taro",
	displayName: "旅太郎",
	tripsCount: 5,
	photosCount: 32,
};

export const mockTrips: TripProject[] = [
	{
		id: "trip-001",
		title: "京都日帰り旅行",
		startDate: "2026-02-15",
		memo: "伏見稲荷と清水寺を回る予定",
		status: "active",
		participants: [
			{ id: "user-001", displayName: "旅太郎", avatarColor: "#4CAF50" },
			{ id: "user-002", displayName: "鉄子", avatarColor: "#2196F3" },
		],
		inviteLink: "https://trip-app.example.com/invite/abc123",
		createdAt: "2026-02-10T10:00:00Z",
		ownerId: "user-001",
		latitude: 34.988,
		longitude: 135.775,
	},
	{
		id: "trip-002",
		title: "沖縄3泊4日",
		startDate: "2026-03-20",
		memo: "美ら海水族館、首里城、国際通り",
		status: "planned",
		participants: [
			{ id: "user-001", displayName: "旅太郎", avatarColor: "#4CAF50" },
			{ id: "user-003", displayName: "花子", avatarColor: "#E91E63" },
			{ id: "user-004", displayName: "次郎", avatarColor: "#FF9800" },
		],
		inviteLink: "https://trip-app.example.com/invite/def456",
		createdAt: "2026-02-08T14:00:00Z",
		ownerId: "user-001",
		latitude: 26.3344,
		longitude: 127.8015,
	},
	{
		id: "trip-003",
		title: "箱根温泉旅行",
		startDate: "2026-01-25",
		status: "completed",
		participants: [
			{ id: "user-001", displayName: "旅太郎", avatarColor: "#4CAF50" },
			{ id: "user-002", displayName: "鉄子", avatarColor: "#2196F3" },
		],
		createdAt: "2026-01-20T09:00:00Z",
		ownerId: "user-001",
		latitude: 35.2406,
		longitude: 139.0644,
	},
	{
		id: "trip-004",
		title: "北海道スキー旅行",
		startDate: "2025-12-28",
		memo: "ニセコでスキー！",
		status: "completed",
		participants: [
			{ id: "user-001", displayName: "旅太郎", avatarColor: "#4CAF50" },
		],
		createdAt: "2025-12-20T11:00:00Z",
		ownerId: "user-001",
		latitude: 42.8614,
		longitude: 140.6988,
	},
];

export const mockPhotos: TripPhoto[] = [
	{
		id: "photo-001",
		tripId: "trip-001",
		uri: "",
		latitude: 34.9671,
		longitude: 135.7727,
		takenAt: "2026-02-15T09:30:00Z",
		takenBy: "user-001",
		locationName: "伏見稲荷大社",
		caption: "千本鳥居を歩いた！朝早くて人が少なくて最高",
	},
	{
		id: "photo-002",
		tripId: "trip-001",
		uri: "",
		latitude: 34.9948,
		longitude: 135.785,
		takenAt: "2026-02-15T11:00:00Z",
		takenBy: "user-002",
		locationName: "清水寺",
		caption: "清水の舞台からの景色が絶景だった",
	},
	{
		id: "photo-003",
		tripId: "trip-001",
		uri: "",
		latitude: 35.0039,
		longitude: 135.7686,
		takenAt: "2026-02-15T13:30:00Z",
		takenBy: "user-001",
		locationName: "金閣寺",
		caption: "金色に輝く金閣寺と池の反射が美しい",
	},
	{
		id: "photo-004",
		tripId: "trip-003",
		uri: "",
		latitude: 35.2326,
		longitude: 139.107,
		takenAt: "2026-01-25T10:00:00Z",
		takenBy: "user-001",
		locationName: "箱根湯本駅",
		caption: "温泉旅行スタート！",
	},
	{
		id: "photo-005",
		tripId: "trip-003",
		uri: "",
		latitude: 35.2486,
		longitude: 139.0217,
		takenAt: "2026-01-25T14:00:00Z",
		takenBy: "user-002",
		locationName: "大涌谷",
		caption: "黒たまごを食べた！硫黄の匂いがすごい",
	},
];

export const TRIP_COLORS: Record<string, string> = {
	"trip-001": "#4CAF50",
	"trip-002": "#2196F3",
	"trip-003": "#FF9800",
	"trip-004": "#9C27B0",
};

export const mockRoutePoints: Record<string, RoutePoint[]> = {
	"trip-001": [
		{
			latitude: 34.9671,
			longitude: 135.7727,
			timestamp: "2026-02-15T09:00:00Z",
		},
		{
			latitude: 34.9948,
			longitude: 135.785,
			timestamp: "2026-02-15T10:30:00Z",
		},
		{
			latitude: 35.0039,
			longitude: 135.7686,
			timestamp: "2026-02-15T13:00:00Z",
		},
	],
	"trip-003": [
		{
			latitude: 35.2326,
			longitude: 139.107,
			timestamp: "2026-01-25T09:00:00Z",
		},
		{
			latitude: 35.2486,
			longitude: 139.0217,
			timestamp: "2026-01-25T12:00:00Z",
		},
	],
};

export const mockNotifications: Notification[] = [
	{
		id: "notif-001",
		type: "photo_reminder",
		title: "写真を撮ろう！",
		message: "最後の撮影から2時間が経ちました。思い出を記録しましょう！",
		read: false,
		createdAt: "2026-02-15T12:00:00Z",
		tripId: "trip-001",
	},
	{
		id: "notif-002",
		type: "trip_invite",
		title: "旅行に招待されました",
		message: "花子さんが「沖縄3泊4日」に招待しています。",
		read: false,
		createdAt: "2026-02-14T15:30:00Z",
		tripId: "trip-002",
	},
	{
		id: "notif-003",
		type: "trip_ended",
		title: "旅行が終了しました",
		message: "「箱根温泉旅行」の記録が完成しました！地図で振り返りましょう。",
		read: true,
		createdAt: "2026-01-26T18:00:00Z",
		tripId: "trip-003",
	},
	{
		id: "notif-004",
		type: "system",
		title: "ようこそ！",
		message: "旅行プロジェクトを作成して、仲間と旅の思い出を共有しましょう。",
		read: true,
		createdAt: "2026-01-15T12:00:00Z",
	},
];
