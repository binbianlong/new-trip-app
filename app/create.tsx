import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { Colors } from "../src/constants/colors";

export default function CreateScreen() {
	const [title, setTitle] = useState("");
	const [startDate, setStartDate] = useState("");
	const [memo, setMemo] = useState("");
	const [participantQuery, setParticipantQuery] = useState("");
	const [participants, setParticipants] = useState<
		{ id: string; name: string; color: string }[]
	>([]);

	const addParticipant = () => {
		if (!participantQuery.trim()) return;
		const colors = ["#2196F3", "#E91E63", "#FF9800", "#9C27B0", "#00BCD4"];
		const newP = {
			id: `p-${Date.now()}`,
			name: participantQuery.trim(),
			color: colors[participants.length % colors.length],
		};
		setParticipants((prev) => [...prev, newP]);
		setParticipantQuery("");
	};

	const removeParticipant = (id: string) => {
		setParticipants((prev) => prev.filter((p) => p.id !== id));
	};

	const handleCreate = async () => {
		if (!title.trim()) {
			Alert.alert("エラー", "タイトルを入力してください");
			return;
		}
		if (!startDate.trim()) {
			Alert.alert("エラー", "開始日を入力してください");
			return;
		}

		const inviteLink = `https://trip-app.example.com/invite/${Date.now()}`;

		Alert.alert(
			"旅行プロジェクト作成",
			"作成しました！招待リンクを共有しますか？",
			[
				{ text: "あとで", style: "cancel" },
				{
					text: "共有する",
					onPress: async () => {
						try {
							await Share.share({
								message: `「${title}」に参加しよう！\n${inviteLink}`,
							});
						} catch {
							// share cancelled
						}
					},
				},
			],
		);

		setTitle("");
		setStartDate("");
		setMemo("");
		setParticipants([]);
	};

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				<Text style={styles.heading}>新しい旅行を作成</Text>
				<Text style={styles.headingSubtitle}>
					旅行プロジェクトを作って仲間を招待しよう
				</Text>

				{/* タイトル */}
				<Text style={styles.label}>
					タイトル <Text style={styles.required}>*</Text>
				</Text>
				<TextInput
					style={styles.input}
					placeholder="例: 京都日帰り旅行"
					placeholderTextColor={Colors.textLight}
					value={title}
					onChangeText={setTitle}
				/>

				{/* 開始日 */}
				<Text style={styles.label}>
					開始日 <Text style={styles.required}>*</Text>
				</Text>
				<TextInput
					style={styles.input}
					placeholder="例: 2026/03/20"
					placeholderTextColor={Colors.textLight}
					value={startDate}
					onChangeText={setStartDate}
					keyboardType="numbers-and-punctuation"
				/>

				{/* 参加者 */}
				<Text style={styles.label}>参加者</Text>
				<View style={styles.participantInput}>
					<Ionicons name="search" size={18} color={Colors.textSecondary} />
					<TextInput
						style={styles.participantTextInput}
						placeholder="IDで検索して追加"
						placeholderTextColor={Colors.textLight}
						value={participantQuery}
						onChangeText={setParticipantQuery}
						onSubmitEditing={addParticipant}
						returnKeyType="done"
					/>
					<TouchableOpacity onPress={addParticipant} style={styles.addButton}>
						<Ionicons name="add" size={20} color={Colors.white} />
					</TouchableOpacity>
				</View>

				{participants.length > 0 && (
					<View style={styles.participantList}>
						{participants.map((p) => (
							<View key={p.id} style={styles.participantChip}>
								<View
									style={[
										styles.participantAvatar,
										{ backgroundColor: p.color },
									]}
								>
									<Text style={styles.participantAvatarText}>
										{p.name.charAt(0)}
									</Text>
								</View>
								<Text style={styles.participantName}>{p.name}</Text>
								<TouchableOpacity onPress={() => removeParticipant(p.id)}>
									<Ionicons
										name="close-circle"
										size={18}
										color={Colors.textLight}
									/>
								</TouchableOpacity>
							</View>
						))}
					</View>
				)}

				{/* メモ */}
				<Text style={styles.label}>メモ（任意）</Text>
				<TextInput
					style={[styles.input, styles.textArea]}
					placeholder="旅行の予定やメモを自由に書いてください..."
					placeholderTextColor={Colors.textLight}
					value={memo}
					onChangeText={setMemo}
					multiline
					numberOfLines={4}
					textAlignVertical="top"
				/>

				{/* 作成ボタン */}
				<TouchableOpacity style={styles.createButton} onPress={handleCreate}>
					<Ionicons name="airplane" size={20} color={Colors.white} />
					<Text style={styles.createButtonText}>旅行プロジェクトを作成</Text>
				</TouchableOpacity>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
	},
	scrollContent: {
		padding: 20,
		paddingBottom: 40,
	},
	heading: {
		fontSize: 26,
		fontWeight: "800",
		color: Colors.text,
		marginBottom: 4,
	},
	headingSubtitle: {
		fontSize: 14,
		color: Colors.textSecondary,
		marginBottom: 28,
	},
	label: {
		fontSize: 14,
		fontWeight: "700",
		color: Colors.text,
		marginTop: 18,
		marginBottom: 8,
	},
	required: {
		color: Colors.error,
	},
	input: {
		backgroundColor: Colors.white,
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 15,
		color: Colors.text,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	textArea: {
		minHeight: 100,
	},
	participantInput: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: Colors.white,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 4,
		gap: 10,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	participantTextInput: {
		flex: 1,
		fontSize: 15,
		color: Colors.text,
		paddingVertical: 10,
	},
	addButton: {
		backgroundColor: Colors.primary,
		borderRadius: 8,
		width: 32,
		height: 32,
		justifyContent: "center",
		alignItems: "center",
	},
	participantList: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 10,
	},
	participantChip: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: Colors.white,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 20,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	participantAvatar: {
		width: 24,
		height: 24,
		borderRadius: 12,
		justifyContent: "center",
		alignItems: "center",
	},
	participantAvatarText: {
		color: Colors.white,
		fontSize: 12,
		fontWeight: "700",
	},
	participantName: {
		fontSize: 14,
		color: Colors.text,
	},
	createButton: {
		backgroundColor: Colors.primary,
		borderRadius: 14,
		paddingVertical: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		marginTop: 32,
		shadowColor: Colors.primary,
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 8,
		elevation: 4,
	},
	createButtonText: {
		color: Colors.white,
		fontSize: 16,
		fontWeight: "700",
	},
});
