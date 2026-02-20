import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../../src/constants/colors";
import { Ionicons } from "@expo/vector-icons";

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

			{/* 参加者 */}
			<Text style={styles.sectionLabel}>参加者</Text>
			<View style={styles.participants}>
				{mockTripDetail.participants.map((participant, index) => (
					<View key={index} style={styles.participantContainer}> 
						<View style={styles.participantCircle} /> 
						<Text style={styles.participantName}>{participant}</Text>
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
		fontSize: 36,
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
		fontSize: 18,
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
        flexDirection: "row", // 参加者同士は横に並べる
        flexWrap: "wrap",
        gap: 16,               // 参加者ごとの間隔
    },
    participantContainer: {
        alignItems: "center", // 中身（丸と名前）を中央に揃える
    },
    participantCircle: {
        width: 48,            // 丸の幅
        height: 48,           // 丸の高さ
        borderRadius: 24,     // 半分の数値で正円にする
        backgroundColor: Colors.grayLighter, // 丸の色
        marginBottom: 4,      // 丸と下の名前の間の隙間
    },
    participantName: {
        fontSize: 12,
        color: Colors.black,
    },
	startButton: {
        backgroundColor: "#C6FFCA",
        borderRadius: 100,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: "auto",
        marginBottom: 16,
        paddingHorizontal: 32,
		shadowColor: "#000",
    	shadowOffset: {
        	width: 0,
        	height: 4,
    	},
    	shadowOpacity: 0.3,
    	shadowRadius: 4.65,
    	elevation: 8,
    },
    startButtonText: {
        color: Colors.black,
        fontSize: 36,
        fontWeight: "bold",
    },
});
