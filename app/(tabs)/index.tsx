import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
	FlatList,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import { Colors } from "../../src/constants/colors";
import { mockTrips } from "../../src/data/mock";
import type { TripProject, TripStatus } from "../../src/types";

const STATUS_CONFIG: Record<
	TripStatus,
	{
		label: string;
		color: string;
		bg: string;
		icon: keyof typeof Ionicons.glyphMap;
	}
> = {
	active: {
		label: "旅行中",
		color: "#2E7D32",
		bg: "#E8F5E9",
		icon: "navigate-circle",
	},
	planned: {
		label: "予定",
		color: "#1565C0",
		bg: "#E3F2FD",
		icon: "calendar",
	},
	completed: {
		label: "完了",
		color: "#757575",
		bg: "#F5F5F5",
		icon: "checkmark-circle",
	},
};

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export default function HomeScreen() {
	const router = useRouter();

	const activeTrips = mockTrips.filter((t) => t.status === "active");
	const plannedTrips = mockTrips.filter((t) => t.status === "planned");
	const completedTrips = mockTrips.filter((t) => t.status === "completed");
	const sortedTrips = [...activeTrips, ...plannedTrips, ...completedTrips];

	const renderTrip = ({ item }: { item: TripProject }) => {
		const config = STATUS_CONFIG[item.status];

		return (
			<TouchableOpacity
				style={styles.tripCard}
				onPress={() => router.push(`/trip/${item.id}`)}
				activeOpacity={0.7}
			>
				<View style={styles.tripHeader}>
					<View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
						<Ionicons name={config.icon} size={14} color={config.color} />
						<Text style={[styles.statusText, { color: config.color }]}>
							{config.label}
						</Text>
					</View>
					<Text style={styles.tripDate}>{formatDate(item.startDate)}</Text>
				</View>

				<Text style={styles.tripTitle}>{item.title}</Text>

				{item.memo && (
					<Text style={styles.tripMemo} numberOfLines={2}>
						{item.memo}
					</Text>
				)}

				<View style={styles.tripFooter}>
					<View style={styles.participantsRow}>
						{item.participants.map((p) => (
							<View
								key={p.id}
								style={[
									styles.participantDot,
									{ backgroundColor: p.avatarColor },
								]}
							>
								<Text style={styles.participantInitial}>
									{p.displayName.charAt(0)}
								</Text>
							</View>
						))}
						<Text style={styles.participantCount}>
							{item.participants.length}人
						</Text>
					</View>
					<Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
				</View>
			</TouchableOpacity>
		);
	};

	return (
		<View style={styles.container}>
			{/* ヘッダー */}
			<View style={styles.topBar}>
				<Text style={styles.topBarTitle}>旅シェア</Text>
				<View style={styles.topBarActions}>
					<TouchableOpacity
						style={styles.topBarButton}
						onPress={() => router.push("/notifications")}
					>
						<Ionicons
							name="notifications-outline"
							size={22}
							color={Colors.text}
						/>
						<View style={styles.badge}>
							<Text style={styles.badgeText}>2</Text>
						</View>
					</TouchableOpacity>
					<TouchableOpacity
						style={styles.topBarButton}
						onPress={() => router.push("/profile")}
					>
						<Ionicons
							name="person-circle-outline"
							size={24}
							color={Colors.text}
						/>
					</TouchableOpacity>
				</View>
			</View>

			<FlatList
				data={sortedTrips}
				keyExtractor={(item) => item.id}
				renderItem={renderTrip}
				contentContainerStyle={styles.list}
				ItemSeparatorComponent={() => <View style={styles.separator} />}
				ListHeaderComponent={
					<View style={styles.header}>
						<Text style={styles.headerTitle}>旅行プロジェクト</Text>
						<Text style={styles.headerSubtitle}>
							{activeTrips.length > 0
								? `${activeTrips.length}件の旅行が進行中`
								: "新しい旅行を作成しましょう"}
						</Text>
					</View>
				}
				ListEmptyComponent={
					<View style={styles.empty}>
						<Ionicons
							name="airplane-outline"
							size={56}
							color={Colors.textLight}
						/>
						<Text style={styles.emptyText}>旅行プロジェクトがありません</Text>
						<TouchableOpacity
							style={styles.emptyButton}
							onPress={() => router.push("/create")}
						>
							<Text style={styles.emptyButtonText}>旅行を作成する</Text>
						</TouchableOpacity>
					</View>
				}
			/>

			{/* 旅行作成FAB */}
			<TouchableOpacity
				style={styles.fab}
				onPress={() => router.push("/create")}
				activeOpacity={0.85}
			>
				<Ionicons name="add" size={28} color={Colors.white} />
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
	},
	topBar: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingTop: 56,
		paddingBottom: 12,
		backgroundColor: Colors.white,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border,
	},
	topBarTitle: {
		fontSize: 22,
		fontWeight: "800",
		color: Colors.primary,
	},
	topBarActions: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	topBarButton: {
		position: "relative",
		padding: 4,
	},
	badge: {
		position: "absolute",
		top: 0,
		right: 0,
		backgroundColor: Colors.error,
		borderRadius: 8,
		minWidth: 16,
		height: 16,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 4,
	},
	badgeText: {
		color: Colors.white,
		fontSize: 10,
		fontWeight: "700",
	},
	list: {
		padding: 16,
		paddingBottom: 100,
	},
	header: {
		marginBottom: 20,
	},
	headerTitle: {
		fontSize: 28,
		fontWeight: "800",
		color: Colors.text,
		marginBottom: 4,
	},
	headerSubtitle: {
		fontSize: 14,
		color: Colors.textSecondary,
	},
	tripCard: {
		backgroundColor: Colors.white,
		borderRadius: 16,
		padding: 18,
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06,
		shadowRadius: 8,
		elevation: 2,
	},
	tripHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 10,
	},
	statusBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
	},
	statusText: {
		fontSize: 12,
		fontWeight: "700",
	},
	tripDate: {
		fontSize: 13,
		color: Colors.textSecondary,
	},
	tripTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: Colors.text,
		marginBottom: 6,
	},
	tripMemo: {
		fontSize: 13,
		color: Colors.textSecondary,
		lineHeight: 20,
		marginBottom: 12,
	},
	tripFooter: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginTop: 8,
	},
	participantsRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	participantDot: {
		width: 28,
		height: 28,
		borderRadius: 14,
		justifyContent: "center",
		alignItems: "center",
		marginRight: -6,
		borderWidth: 2,
		borderColor: Colors.white,
	},
	participantInitial: {
		color: Colors.white,
		fontSize: 12,
		fontWeight: "700",
	},
	participantCount: {
		fontSize: 12,
		color: Colors.textSecondary,
		marginLeft: 12,
	},
	separator: {
		height: 12,
	},
	empty: {
		alignItems: "center",
		justifyContent: "center",
		paddingTop: 80,
		gap: 12,
	},
	emptyText: {
		fontSize: 16,
		color: Colors.textSecondary,
	},
	emptyButton: {
		backgroundColor: Colors.primary,
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 10,
		marginTop: 8,
	},
	emptyButtonText: {
		color: Colors.white,
		fontWeight: "700",
		fontSize: 15,
	},
	fab: {
		position: "absolute",
		bottom: 104,
		right: 20,
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: Colors.primary,
		justifyContent: "center",
		alignItems: "center",
		shadowColor: Colors.primary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 6,
	},
});
