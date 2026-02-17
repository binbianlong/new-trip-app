import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../src/constants/colors";

// サインアップ画面
export default function LoginScreen() {
	const router = useRouter();

	return (
		<View style={styles.container}>
			<Text style={styles.title}>旅行記録アプリ</Text>
			<Text style={styles.subtitle}>旅の思い出を地図に残そう</Text>

			{/* Google認証ボタン（仮） */}
			<Pressable
				style={styles.googleButton}
				onPress={() => router.replace("/onboarding")}
			>
				<Text style={styles.googleButtonText}>Googleでサインアップ</Text>
			</Pressable>

			{/* 仮：ホームへ直接遷移 */}
			<Pressable
				style={styles.skipButton}
				onPress={() => router.replace("/(tabs)")}
			>
				<Text style={styles.skipButtonText}>スキップ（開発用）</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.white,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
	title: {
		fontSize: 28,
		fontWeight: "bold",
		color: Colors.black,
	},
	subtitle: {
		fontSize: 16,
		color: Colors.gray,
		marginTop: 8,
		marginBottom: 48,
	},
	googleButton: {
		backgroundColor: Colors.white,
		borderWidth: 1,
		borderColor: Colors.grayLight,
		borderRadius: 8,
		paddingVertical: 14,
		paddingHorizontal: 24,
		width: "100%",
		alignItems: "center",
	},
	googleButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: Colors.black,
	},
	skipButton: {
		marginTop: 16,
		paddingVertical: 12,
	},
	skipButtonText: {
		fontSize: 14,
		color: Colors.gray,
		textDecorationLine: "underline",
	},
});
