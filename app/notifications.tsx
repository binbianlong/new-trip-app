import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../src/constants/colors";
import {
	getNotificationHistory,
	markAllNotificationsAsRead,
	markNotificationAsRead,
	type NotificationRecord,
} from "../src/lib/notifications";

const ICON_MAP: Record<string, { name: string; color: string }> = {
	photo_reminder: { name: "camera", color: "#FF9800" },
	morning_greeting: { name: "sunny", color: "#FFC107" },
	anniversary: { name: "heart", color: "#E91E63" },
	member_invited: { name: "person-add", color: Colors.primary },
	unknown: { name: "notifications", color: Colors.gray },
};

const TYPE_LABEL: Record<string, string> = {
	photo_reminder: "写真リマインダー",
	morning_greeting: "おはよう通知",
	anniversary: "記念日",
	member_invited: "参加者招待",
};

function formatTimeAgo(dateString: string): string {
	const now = new Date();
	const date = new Date(dateString);
	const diffMs = now.getTime() - date.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHour = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHour / 24);

	if (diffMin < 1) return "たった今";
	if (diffMin < 60) return `${diffMin}分前`;
	if (diffHour < 24) return `${diffHour}時間前`;
	if (diffDay < 7) return `${diffDay}日前`;
	return date.toLocaleDateString("ja-JP", {
		month: "short",
		day: "numeric",
	});
}

function NotificationItem({
	item,
	onPress,
}: {
	item: NotificationRecord;
	onPress: () => void;
}) {
	const iconInfo = ICON_MAP[item.type] ?? ICON_MAP.unknown;
	const typeLabel = TYPE_LABEL[item.type] ?? "";

	return (
		<Pressable
			style={[styles.item, !item.read && styles.itemUnread]}
			onPress={onPress}
		>
			<View
				style={[
					styles.iconContainer,
					{ backgroundColor: `${iconInfo.color}18` },
				]}
			>
				<Ionicons
					name={iconInfo.name as keyof typeof Ionicons.glyphMap}
					size={22}
					color={iconInfo.color}
				/>
			</View>
			<View style={styles.itemContent}>
				<View style={styles.itemHeader}>
					{typeLabel !== "" && (
						<Text style={[styles.typeLabel, { color: iconInfo.color }]}>
							{typeLabel}
						</Text>
					)}
					<Text style={styles.timeText}>{formatTimeAgo(item.receivedAt)}</Text>
				</View>
				<Text style={[styles.titleText, !item.read && styles.titleTextUnread]}>
					{item.title}
				</Text>
				<Text style={styles.bodyText} numberOfLines={2}>
					{item.body}
				</Text>
			</View>
			{!item.read && <View style={styles.unreadDot} />}
		</Pressable>
	);
}

export default function NotificationsScreen() {
	const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
	const [loading, setLoading] = useState(true);

	const loadNotifications = useCallback(async () => {
		setLoading(true);
		const history = await getNotificationHistory();
		setNotifications(history);
		setLoading(false);
	}, []);

	useFocusEffect(
		useCallback(() => {
			loadNotifications();
		}, [loadNotifications]),
	);

	const handlePressItem = async (id: string) => {
		await markNotificationAsRead(id);
		setNotifications((prev) =>
			prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
		);
	};

	const handleMarkAllRead = async () => {
		await markAllNotificationsAsRead();
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
	};

	const unreadCount = notifications.filter((n) => !n.read).length;

	if (!loading && notifications.length === 0) {
		return (
			<View style={styles.emptyContainer}>
				<Ionicons
					name="notifications-off-outline"
					size={64}
					color={Colors.grayLight}
				/>
				<Text style={styles.emptyTitle}>通知はまだありません</Text>
				<Text style={styles.emptySubtitle}>旅行を始めると通知が届きます</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			{unreadCount > 0 && (
				<Pressable style={styles.markAllButton} onPress={handleMarkAllRead}>
					<Ionicons name="checkmark-done" size={18} color={Colors.primary} />
					<Text style={styles.markAllText}>すべて既読にする</Text>
				</Pressable>
			)}
			<FlatList
				data={notifications}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<NotificationItem
						item={item}
						onPress={() => handlePressItem(item.id)}
					/>
				)}
				contentContainerStyle={styles.list}
				ItemSeparatorComponent={() => <View style={styles.separator} />}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
	},
	list: {
		paddingBottom: 32,
	},
	markAllButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-end",
		gap: 4,
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: Colors.white,
		borderBottomWidth: 1,
		borderBottomColor: Colors.grayLighter,
	},
	markAllText: {
		fontSize: 13,
		color: Colors.primary,
		fontWeight: "600",
	},
	item: {
		flexDirection: "row",
		alignItems: "flex-start",
		paddingHorizontal: 16,
		paddingVertical: 14,
		backgroundColor: Colors.white,
	},
	itemUnread: {
		backgroundColor: "#F0F9F0",
	},
	iconContainer: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 12,
	},
	itemContent: {
		flex: 1,
	},
	itemHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 2,
	},
	typeLabel: {
		fontSize: 11,
		fontWeight: "700",
	},
	timeText: {
		fontSize: 11,
		color: Colors.gray,
	},
	titleText: {
		fontSize: 15,
		color: Colors.black,
		marginBottom: 2,
	},
	titleTextUnread: {
		fontWeight: "700",
	},
	bodyText: {
		fontSize: 13,
		color: Colors.gray,
		lineHeight: 18,
	},
	unreadDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: Colors.primary,
		marginTop: 6,
		marginLeft: 8,
	},
	separator: {
		height: 1,
		backgroundColor: Colors.grayLighter,
		marginLeft: 72,
	},
	emptyContainer: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.background,
		paddingHorizontal: 32,
	},
	emptyTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: Colors.black,
		marginTop: 16,
	},
	emptySubtitle: {
		fontSize: 14,
		color: Colors.gray,
		marginTop: 8,
		textAlign: "center",
	},
});
