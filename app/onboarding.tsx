import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Colors } from "../src/constants/colors";

// ユーザー情報入力画面
export default function OnboardingScreen() {
	const router = useRouter();

	return (
		<View style={styles.container}>
			{/* アイコン入力（仮置き） */}
			<Pressable style={styles.avatarPlaceholder}>
				<Text style={styles.avatarText}>📷</Text>
				<Text style={styles.avatarLabel}>アイコンを設定</Text>
			</Pressable>

			{/* ユーザーネーム入力欄 */}
			<Text style={styles.label}>ユーザーネーム</Text>
			<TextInput
				style={styles.input}
				placeholder="表示名を入力"
				placeholderTextColor={Colors.grayLight}
			/>

			{/* ユーザーID入力欄 */}
			<Text style={styles.label}>ユーザーID</Text>
			<TextInput
				style={styles.input}
				placeholder="@username"
				placeholderTextColor={Colors.grayLight}
				autoCapitalize="none"
			/>

			{/* 完了ボタン */}
			<Pressable
				style={styles.button}
				onPress={() => router.replace("/(tabs)")}
			>
				<Text style={styles.buttonText}>完了</Text>
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
	avatarPlaceholder: {
		width: 100,
		height: 100,
		borderRadius: 50,
		backgroundColor: Colors.grayLighter,
		alignItems: "center",
		justifyContent: "center",
		alignSelf: "center",
		marginTop: 24,
		marginBottom: 32,
	},
	avatarText: {
		fontSize: 32,
	},
	avatarLabel: {
		fontSize: 10,
		color: Colors.gray,
		marginTop: 4,
	},
	label: {
		fontSize: 14,
		fontWeight: "600",
		color: Colors.black,
		marginBottom: 8,
	},
	input: {
		borderWidth: 1,
		borderColor: Colors.grayLight,
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		marginBottom: 20,
		color: Colors.black,
	},
	button: {
		backgroundColor: Colors.primary,
		borderRadius: 8,
		paddingVertical: 14,
		alignItems: "center",
		marginTop: 12,
	},
	buttonText: {
		color: Colors.white,
		fontSize: 16,
		fontWeight: "bold",
	},
});
