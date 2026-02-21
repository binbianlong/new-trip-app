import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const STORAGE_PREFIX = "notification_";
const PHOTO_REMINDER_KEY = (tripId: string) =>
	`${STORAGE_PREFIX}photo_reminder_${tripId}`;
const MORNING_GREETING_KEY = (tripId: string, day: number) =>
	`${STORAGE_PREFIX}morning_${tripId}_day${day}`;
const ANNIVERSARY_KEY = (tripId: string) =>
	`${STORAGE_PREFIX}anniversary_${tripId}`;

const PHOTO_REMINDER_SECONDS = 7200; // 2時間
const MAX_MORNING_DAYS = 14;
const MORNING_HOUR = 9;
const MORNING_MINUTE = 0;

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
	}),
});

export async function setupNotifications(): Promise<string | null> {
	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync("default", {
			name: "デフォルト",
			importance: Notifications.AndroidImportance.HIGH,
			vibrationPattern: [0, 250, 250, 250],
			lightColor: "#4CAF50",
		});
	}

	if (!Device.isDevice) {
		console.log("通知は実機でのみ動作します");
		return null;
	}

	const { status: existingStatus } = await Notifications.getPermissionsAsync();
	let finalStatus = existingStatus;

	if (existingStatus !== "granted") {
		const { status } = await Notifications.requestPermissionsAsync();
		finalStatus = status;
	}

	if (finalStatus !== "granted") {
		console.log("通知の許可が得られませんでした");
		return null;
	}

	return finalStatus;
}

// --- ヘルパー ---

async function saveNotificationId(key: string, id: string): Promise<void> {
	await AsyncStorage.setItem(key, id);
}

async function cancelNotificationByKey(key: string): Promise<void> {
	const id = await AsyncStorage.getItem(key);
	if (id) {
		await Notifications.cancelScheduledNotificationAsync(id);
		await AsyncStorage.removeItem(key);
	}
}

// --- 1. 写真リマインダー通知 ---

export async function schedulePhotoReminder(
	tripId: string,
	tripTitle: string,
): Promise<void> {
	await cancelPhotoReminder(tripId);

	const id = await Notifications.scheduleNotificationAsync({
		content: {
			title: "写真を撮ろう！📸",
			body: `「${tripTitle}」の最後の写真から2時間経ったよ！今何してる？`,
			data: { tripId, type: "photo_reminder" },
			sound: "default",
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
			seconds: PHOTO_REMINDER_SECONDS,
		},
	});

	await saveNotificationId(PHOTO_REMINDER_KEY(tripId), id);
}

export async function cancelPhotoReminder(tripId: string): Promise<void> {
	await cancelNotificationByKey(PHOTO_REMINDER_KEY(tripId));
}

// --- 2. おはよう通知 ---

export async function scheduleMorningGreetings(
	tripId: string,
	tripTitle: string,
): Promise<void> {
	await cancelMorningGreetings(tripId);

	const now = new Date();
	for (let day = 1; day <= MAX_MORNING_DAYS; day++) {
		const triggerDate = new Date(now);
		triggerDate.setDate(triggerDate.getDate() + day);
		triggerDate.setHours(MORNING_HOUR, MORNING_MINUTE, 0, 0);

		if (triggerDate <= now) continue;

		const dayLabel = day + 1;
		const id = await Notifications.scheduleNotificationAsync({
			content: {
				title: `おはよう！🌅 ${dayLabel}日目`,
				body: `「${tripTitle}」今日もたくさん写真を撮ろう！`,
				data: { tripId, type: "morning_greeting", day: dayLabel },
				sound: "default",
			},
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.DATE,
				date: triggerDate,
			},
		});

		await saveNotificationId(MORNING_GREETING_KEY(tripId, day), id);
	}
}

export async function cancelMorningGreetings(tripId: string): Promise<void> {
	for (let day = 1; day <= MAX_MORNING_DAYS; day++) {
		await cancelNotificationByKey(MORNING_GREETING_KEY(tripId, day));
	}
}

// --- 3. 記念日通知 ---

export async function scheduleAnniversary(
	tripId: string,
	tripTitle: string,
	startDate: string,
): Promise<void> {
	await cancelAnniversary(tripId);

	const anniversary = new Date(startDate);
	anniversary.setFullYear(anniversary.getFullYear() + 1);
	anniversary.setHours(10, 0, 0, 0);

	if (anniversary <= new Date()) return;

	const id = await Notifications.scheduleNotificationAsync({
		content: {
			title: "1年前の今日… 🎉",
			body: `「${tripTitle}」に行ったよ！あの時の写真を見返そう`,
			data: { tripId, type: "anniversary" },
			sound: "default",
		},
		trigger: {
			type: Notifications.SchedulableTriggerInputTypes.DATE,
			date: anniversary,
		},
	});

	await saveNotificationId(ANNIVERSARY_KEY(tripId), id);
}

export async function cancelAnniversary(tripId: string): Promise<void> {
	await cancelNotificationByKey(ANNIVERSARY_KEY(tripId));
}

// --- 4. 参加者招待通知（即時） ---

export async function notifyMemberInvited(
	tripTitle: string,
	addedNames: string[],
): Promise<void> {
	if (addedNames.length === 0) return;

	const names = addedNames.join("、");
	await Notifications.scheduleNotificationAsync({
		content: {
			title: "参加者を追加しました",
			body: `「${tripTitle}」に${names}さんを招待しました`,
			data: { type: "member_invited" },
			sound: "default",
		},
		trigger: null,
	});
}

// --- 旅行終了時の一括キャンセル ---

export async function cancelAllTripNotifications(
	tripId: string,
): Promise<void> {
	await cancelPhotoReminder(tripId);
	await cancelMorningGreetings(tripId);
}

// --- 通知履歴の管理 ---

const NOTIFICATION_HISTORY_KEY = "notification_history";

export interface NotificationRecord {
	id: string;
	title: string;
	body: string;
	type: string;
	tripId?: string;
	receivedAt: string;
	read: boolean;
}

export async function saveNotificationToHistory(
	notification: Notifications.Notification,
): Promise<void> {
	const content = notification.request.content;
	const data = content.data as Record<string, unknown> | undefined;

	const record: NotificationRecord = {
		id: notification.request.identifier,
		title: content.title ?? "",
		body: content.body ?? "",
		type: (data?.type as string) ?? "unknown",
		tripId: (data?.tripId as string) ?? undefined,
		receivedAt: new Date().toISOString(),
		read: false,
	};

	const history = await getNotificationHistory();
	history.unshift(record);
	const trimmed = history.slice(0, 100);
	await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(trimmed));
}

export async function getNotificationHistory(): Promise<NotificationRecord[]> {
	const raw = await AsyncStorage.getItem(NOTIFICATION_HISTORY_KEY);
	if (!raw) return [];
	try {
		return JSON.parse(raw) as NotificationRecord[];
	} catch {
		return [];
	}
}

export async function markNotificationAsRead(id: string): Promise<void> {
	const history = await getNotificationHistory();
	const updated = history.map((n) => (n.id === id ? { ...n, read: true } : n));
	await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
}

export async function markAllNotificationsAsRead(): Promise<void> {
	const history = await getNotificationHistory();
	const updated = history.map((n) => ({ ...n, read: true }));
	await AsyncStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(updated));
}

export async function getUnreadCount(): Promise<number> {
	const history = await getNotificationHistory();
	return history.filter((n) => !n.read).length;
}
