import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../../src/constants/colors";

// 仮の旅行詳細データ
const mockTripDetail = {
	title: "沖縄旅行",
	participants: ["ユーザーA", "ユーザーB"],
	startDate: "2026-03-01",
	memo: "美ら海水族館に行きたい",
};

// 旅行プラン詳細画面
export default function TripDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();

	return (
		<View style={styles.container}>
			{/* タイトル */}
			<Text style={styles.title}>{mockTripDetail.title}</Text>
			<Text style={styles.tripId}>ID: {id}</Text>

			{/* 参加者 */}
			<Text style={styles.sectionLabel}>参加者</Text>
			<View style={styles.participants}>
				{mockTripDetail.participants.map((name) => (
					<View key={name} style={styles.participantChip}>
						<Text style={styles.participantText}>{name}</Text>
					</View>
				))}
			</View>

			{/* 開始日 */}
			<Text style={styles.sectionLabel}>開始日</Text>
			<Text style={styles.value}>{mockTripDetail.startDate}</Text>

			{/* メモ */}
			<Text style={styles.sectionLabel}>メモ</Text>
			<Text style={styles.value}>{mockTripDetail.memo}</Text>

			{/* 旅行開始ボタン */}
			<Pressable
				style={styles.startButton}
				onPress={() => router.push("/(tabs)/map")}
			>
				<Text style={styles.startButtonText}>旅行を開始する</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.white,
		padding: 24,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: Colors.black,
	},
	tripId: {
		fontSize: 12,
		color: Colors.gray,
		marginTop: 4,
		marginBottom: 24,
	},
	sectionLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: Colors.gray,
		marginBottom: 8,
		marginTop: 16,
	},
	value: {
		fontSize: 16,
		color: Colors.black,
	},
	participants: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	participantChip: {
		backgroundColor: Colors.grayLighter,
		borderRadius: 16,
		paddingVertical: 6,
		paddingHorizontal: 12,
	},
	participantText: {
		fontSize: 14,
		color: Colors.black,
	},
	startButton: {
		backgroundColor: Colors.primary,
		borderRadius: 8,
		paddingVertical: 16,
		alignItems: "center",
		marginTop: "auto",
		marginBottom: 16,
	},
	startButtonText: {
		color: Colors.white,
		fontSize: 18,
		fontWeight: "bold",
	},
});
