import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../../src/constants/colors";
import { mockTrips } from "../../src/data/mock";
import type { Trip } from "../../src/types";

// ホーム画面 - 旅行プランカード一覧
export default function HomeScreen() {
	const router = useRouter();

	// 日付をフォーマットする関数
	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
	};

	// ステータスに応じたラベルを返す関数
	const getStatusLabel = (status: Trip["status"]) => {
		switch (status) {
			case "planned":
				return "予定";
			case "started":
				return "旅行中";
			case "finished":
				return "完了";
			default:
				return "";
		}
	};

	// ステータスに応じた色を返す関数
	const getStatusColor = (status: Trip["status"]) => {
		switch (status) {
			case "planned":
				return Colors.primary;
			case "started":
				return "#FF9800"; // オレンジ
			case "finished":
				return Colors.gray;
			default:
				return Colors.gray;
		}
	};

	return (
		<View style={styles.container}>
			{/* 旅行プラン一覧 */}
			<FlatList
				data={mockTrips}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				renderItem={({ item }) => (
					<Pressable
						style={styles.card}
						onPress={() => router.push(`/trip/${item.id}`)}
					>
						{/* カードヘッダー */}
						<View style={styles.cardHeader}>
							<Text style={styles.cardTitle}>{item.title}</Text>
							<View
								style={[
									styles.statusBadge,
									{ backgroundColor: getStatusColor(item.status) },
								]}
							>
								<Text style={styles.statusText}>
									{getStatusLabel(item.status)}
								</Text>
							</View>
						</View>

						{/* 開始日 */}
						<View style={styles.cardInfo}>
							<Ionicons name="calendar-outline" size={16} color={Colors.gray} />
							<Text style={styles.cardDate}>{formatDate(item.start_date)}</Text>
						</View>

						{/* メモ（ある場合のみ表示） */}
						{item.memo && (
							<View style={styles.cardInfo}>
								<Ionicons
									name="document-text-outline"
									size={16}
									color={Colors.gray}
								/>
								<Text style={styles.cardMemo} numberOfLines={1}>
									{item.memo}
								</Text>
							</View>
						)}
					</Pressable>
				)}
				ListEmptyComponent={
					<View style={styles.emptyContainer}>
						<Ionicons name="airplane-outline" size={64} color={Colors.gray} />
						<Text style={styles.emptyText}>旅行プランがありません</Text>
						<Text style={styles.emptySubText}>
							右下のボタンから作成できます
						</Text>
					</View>
				}
			/>

			{/* 旅行プラン作成ボタン (FAB) */}
			<Pressable style={styles.fab} onPress={() => router.push("/create")}>
				<Ionicons name="add" size={28} color={Colors.white} />
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
	},
	list: {
		padding: 16,
		gap: 12,
	},
	card: {
		backgroundColor: Colors.white,
		borderRadius: 16,
		padding: 16,
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 8,
		elevation: 3,
		borderWidth: 1,
		borderColor: Colors.grayLighter,
	},
	cardHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 12,
	},
	cardTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: Colors.black,
		flex: 1,
	},
	statusBadge: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
		marginLeft: 8,
	},
	statusText: {
		fontSize: 12,
		fontWeight: "600",
		color: Colors.white,
	},
	cardInfo: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 8,
	},
	cardDate: {
		fontSize: 14,
		color: Colors.gray,
		marginLeft: 6,
	},
	cardMemo: {
		fontSize: 14,
		color: Colors.gray,
		marginLeft: 6,
		flex: 1,
	},
	emptyContainer: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 80,
	},
	emptyText: {
		fontSize: 18,
		fontWeight: "600",
		color: Colors.gray,
		marginTop: 16,
	},
	emptySubText: {
		fontSize: 14,
		color: Colors.grayLight,
		marginTop: 8,
	},
	fab: {
		position: "absolute",
		right: 20,
		bottom: 20,
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: Colors.primary,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 8,
	},
});
