import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../../src/constants/colors";

// 仮の旅行プランデータ
const mockTrips = [
	{ id: "1", title: "沖縄旅行", startDate: "2026-03-01" },
	{ id: "2", title: "北海道スキー", startDate: "2026-03-15" },
	{ id: "3", title: "京都散策", startDate: "2026-04-01" },
];

// ホーム画面 - 旅行プランカード一覧
export default function HomeScreen() {
	const router = useRouter();

	return (
		<View style={styles.container}>
			<FlatList
				data={mockTrips}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				renderItem={({ item }) => (
					<Pressable
						style={styles.card}
						onPress={() => router.push(`/trip/${item.id}`)}
					>
						<Text style={styles.cardTitle}>{item.title}</Text>
						<Text style={styles.cardDate}>{item.startDate}</Text>
					</Pressable>
				)}
			/>
			{/* 旅行プラン作成ボタン */}
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
		borderRadius: 12,
		padding: 16,
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 3,
	},
	cardTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: Colors.black,
	},
	cardDate: {
		fontSize: 14,
		color: Colors.gray,
		marginTop: 4,
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
		shadowRadius: 4,
		elevation: 5,
	},
});
