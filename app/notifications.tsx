import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
	FlatList,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { Colors } from "../src/constants/colors";
import { mockNotifications } from "../src/data/mock";
import type { Notification } from "../src/types";

const NOTIFICATION_ICONS: Record<
	Notification["type"],
	{ name: keyof typeof Ionicons.glyphMap; color: string }
> = {
	trip_invite: { name: "mail-open", color: "#2196F3" },
	photo_reminder: { name: "camera", color: Colors.secondary },
	trip_ended: { name: "flag", color: Colors.primary },
	system: { name: "information-circle", color: "#9E9E9E" },
};

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffHours / 24);

	if (diffHours < 1) return "たった今";
	if (diffHours < 24) return `${diffHours}時間前`;
	if (diffDays < 7) return `${diffDays}日前`;
	return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function NotificationsScreen() {
	const router = useRouter();
	const unreadCount = mockNotifications.filter((n) => !n.read).length;

	const renderNotification = ({ item }: { item: Notification }) => {
		const icon = NOTIFICATION_ICONS[item.type];

		return (
			<TouchableOpacity
				style={[styles.notifItem, !item.read && styles.notifUnread]}
				onPress={() => {
					if (item.tripId) {
						router.push(`/trip/${item.tripId}`);
					}
				}}
				activeOpacity={0.7}
			>
				<View
					style={[styles.iconContainer, { backgroundColor: `${icon.color}18` }]}
				>
					<Ionicons name={icon.name} size={22} color={icon.color} />
				</View>
				<View style={styles.content}>
					<View style={styles.titleRow}>
						<Text style={styles.title}>{item.title}</Text>
						{!item.read && <View style={styles.unreadDot} />}
					</View>
					<Text style={styles.message} numberOfLines={2}>
						{item.message}
					</Text>
					<Text style={styles.time}>{formatDate(item.createdAt)}</Text>
				</View>
			</TouchableOpacity>
		);
	};

	return (
		<View style={styles.container}>
			{unreadCount > 0 && (
				<View style={styles.banner}>
					<Text style={styles.bannerText}>{unreadCount}件の未読通知</Text>
				</View>
			)}

			<FlatList
				data={mockNotifications}
				keyExtractor={(item) => item.id}
				renderItem={renderNotification}
				contentContainerStyle={styles.list}
				ItemSeparatorComponent={() => <View style={styles.separator} />}
				ListEmptyComponent={
					<View style={styles.empty}>
						<Ionicons
							name="notifications-off-outline"
							size={48}
							color={Colors.textLight}
						/>
						<Text style={styles.emptyText}>通知はありません</Text>
					</View>
				}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
	},
	banner: {
		backgroundColor: Colors.primary,
		paddingVertical: 8,
		alignItems: "center",
	},
	bannerText: {
		color: Colors.white,
		fontSize: 13,
		fontWeight: "600",
	},
	list: {
		padding: 16,
	},
	notifItem: {
		flexDirection: "row",
		backgroundColor: Colors.white,
		borderRadius: 12,
		padding: 16,
		gap: 14,
	},
	notifUnread: {
		backgroundColor: "#E8F5E9",
	},
	iconContainer: {
		width: 44,
		height: 44,
		borderRadius: 22,
		justifyContent: "center",
		alignItems: "center",
	},
	content: {
		flex: 1,
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		marginBottom: 4,
	},
	title: {
		fontSize: 15,
		fontWeight: "700",
		color: Colors.text,
	},
	unreadDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: Colors.primary,
	},
	message: {
		fontSize: 13,
		color: Colors.textSecondary,
		lineHeight: 18,
		marginBottom: 6,
	},
	time: {
		fontSize: 11,
		color: Colors.textLight,
	},
	separator: {
		height: 8,
	},
	empty: {
		alignItems: "center",
		justifyContent: "center",
		paddingTop: 80,
		gap: 12,
	},
	emptyText: {
		fontSize: 15,
		color: Colors.textSecondary,
	},
});
