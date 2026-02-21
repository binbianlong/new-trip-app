import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../../src/constants/colors";
import {
	fetchTrips,
	getActiveTripId,
	getTrips,
	subscribe,
} from "../../src/store/tripStore";
import type { Trip } from "../../src/types";
import { SplashScreen } from "../components/User/SplashScreen";

// ホーム画面 - 旅行プランカード一覧
export default function HomeScreen() {
	const router = useRouter();
	const [trips, setTrips] = useState(getTrips);
	const [activeTripId, setActiveTripId] = useState(getActiveTripId);
	const [isLoading, setIsLoading] = useState(true); // 2. 初期状態を読み込み中に設定

	// ストアの変更を監視 + 画面フォーカス時に Supabase から再取得
	useFocusEffect(
		useCallback(() => {
			// 状態更新をまとめた関数
			const updateState = () => {
				setTrips(getTrips());
				setActiveTripId(getActiveTripId());
			};

			// 非同期でデータを読み込む関数
			const loadData = async () => {
				try {
					// 1. Supabaseからデータを取得するまで「待機」
					await fetchTrips();
					// 2. 取得できたら画面のデータを更新
					updateState();
				} catch (error) {
					console.error("データの取得に失敗しました:", error);
				} finally {
					// 3. 成功しても失敗しても、通信が終わったらローディングを終了
					setIsLoading(false);
				}
			};

			// 実行
			loadData();

			// ストアの購読（リアルタイム更新用）
			const unsubscribe = subscribe(() => {
				updateState();
			});

			return unsubscribe;
		}, []),
	);

	if (isLoading) {
		return <SplashScreen />;
	}

	const formatDate = (dateString: string | null) => {
		if (!dateString) return "";
		const date = new Date(dateString);
		return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
	};

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

	const getStatusColor = (status: Trip["status"]) => {
		switch (status) {
			case "planned":
				return Colors.primary;
			case "started":
				return "#FF9800";
			case "finished":
				return Colors.gray;
			default:
				return Colors.gray;
		}
	};

	const handleCardPress = (item: Trip) => {
		if (item.status === "started") {
			router.push({ pathname: "/trip/active", params: { tripId: item.id } });
		} else {
			router.push(`/trip/${item.id}`);
		}
	};

	return (
		<View style={styles.container}>
			<FlatList
				data={trips}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				renderItem={({ item }) => {
					const isActive = item.id === activeTripId;
					const isLocked =
						activeTripId != null && !isActive && item.status !== "finished";

					return (
						<Pressable
							style={[
								styles.card,
								isActive && styles.cardActive,
								isLocked && styles.cardLocked,
							]}
							onPress={() => handleCardPress(item)}
							disabled={isLocked}
						>
							<View style={styles.cardHeader}>
								<Text
									style={[styles.cardTitle, isLocked && styles.cardTitleLocked]}
								>
									{item.title}
								</Text>
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

							<View style={styles.cardInfo}>
								<Ionicons
									name="calendar-outline"
									size={16}
									color={isLocked ? Colors.grayLight : Colors.gray}
								/>
								<Text
									style={[styles.cardDate, isLocked && styles.cardTextLocked]}
								>
									{formatDate(item.start_date)}
								</Text>
							</View>

							{item.memo && (
								<View style={styles.cardInfo}>
									<Ionicons
										name="document-text-outline"
										size={16}
										color={isLocked ? Colors.grayLight : Colors.gray}
									/>
									<Text
										style={[styles.cardMemo, isLocked && styles.cardTextLocked]}
										numberOfLines={1}
									>
										{item.memo}
									</Text>
								</View>
							)}

							{isLocked && (
								<View style={styles.lockedBanner}>
									<Ionicons
										name="lock-closed"
										size={14}
										color={Colors.grayLight}
									/>
									<Text style={styles.lockedText}>他の旅行が進行中です</Text>
								</View>
							)}
						</Pressable>
					);
				}}
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
	cardActive: {
		borderColor: "#FF9800",
		borderWidth: 2,
	},
	cardLocked: {
		opacity: 0.5,
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
	cardTitleLocked: {
		color: Colors.grayLight,
	},
	cardTextLocked: {
		color: Colors.grayLight,
	},
	lockedBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 12,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: Colors.grayLighter,
	},
	lockedText: {
		fontSize: 12,
		color: Colors.grayLight,
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
