import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Colors } from "../src/constants/colors";

// 旅行プラン作成画面
export default function CreateScreen() {
	const router = useRouter();

	return (
		<View style={styles.container}>
			{/* タイトル入力欄 */}
			<Text style={styles.label}>タイトル（必須）</Text>
			<TextInput
				style={styles.input}
				placeholder="旅行のタイトルを入力"
				placeholderTextColor={Colors.grayLight}
			/>

			{/* 参加者追加ボタン */}
			<Text style={styles.label}>参加者</Text>
			<Pressable style={styles.addParticipantButton}>
				<Text style={styles.addParticipantText}>＋ 参加者を追加</Text>
			</Pressable>

			{/* 開始日入力 */}
			<Text style={styles.label}>開始日（必須）</Text>
			<TextInput
				style={styles.input}
				placeholder="2026-03-01"
				placeholderTextColor={Colors.grayLight}
			/>

			{/* メモ欄 */}
			<Text style={styles.label}>メモ（任意）</Text>
			<TextInput
				style={[styles.input, styles.memoInput]}
				placeholder="メモを入力"
				placeholderTextColor={Colors.grayLight}
				multiline
			/>

			{/* 作成完了ボタン */}
			<Pressable style={styles.button} onPress={() => router.back()}>
				<Text style={styles.buttonText}>作成</Text>
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
	memoInput: {
		height: 100,
		textAlignVertical: "top",
	},
	addParticipantButton: {
		borderWidth: 1,
		borderColor: Colors.grayLight,
		borderRadius: 8,
		borderStyle: "dashed",
		padding: 14,
		alignItems: "center",
		marginBottom: 20,
	},
	addParticipantText: {
		fontSize: 14,
		color: Colors.primary,
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
