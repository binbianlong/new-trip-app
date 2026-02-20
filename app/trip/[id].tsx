import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { Colors } from "../../src/constants/colors";
import { mockTripMembers, mockTrips, mockUsers } from "../../src/data/mock";

// 旅行プラン詳細・編集ポップアップ（モーダル）
export default function TripDetailModal() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();

	// モックデータから該当旅行を取得（なければ先頭をフォールバック）
	const trip = mockTrips.find((t) => t.id === id) ?? mockTrips[0];

	// この旅行の参加者ユーザーを取得
	const participants = mockTripMembers
		.filter((m) => m.trip_id === trip.id)
		.map((m) => mockUsers.find((u) => u.id === m.user_id))
		.filter((u): u is NonNullable<typeof u> => u != null);

	// 編集モードの状態管理
	const [isEditing, setIsEditing] = useState(false);
	const [title, setTitle] = useState(trip.title);
	const [startDate, setStartDate] = useState(trip.start_date);
	const [memo, setMemo] = useState(trip.memo ?? "");

	// 旅行を開始してマップへ遷移
	const handleStart = () => {
		router.dismiss();
		router.push("/(tabs)/map");
	};

	// 編集内容を保存（TODO: DB更新）
	const handleSave = () => {
		setIsEditing(false);
	};

	return (
		<View style={styles.container}>
			{/* ドラッグハンドル */}
			<View style={styles.handle} />

			{/* ヘッダー */}
			<View style={styles.header}>
				{isEditing ? (
					<Pressable onPress={handleSave} style={styles.editButton}>
						<Text style={styles.editButtonText}>保存</Text>
					</Pressable>
				) : (
					<Pressable
						onPress={() => setIsEditing(true)}
						style={styles.editButton}
					>
						<Ionicons name="pencil-outline" size={18} color={Colors.primary} />
						<Text style={styles.editButtonText}>編集</Text>
					</Pressable>
				)}
				{/* 閉じるボタン */}
				<Pressable onPress={() => router.dismiss()} style={styles.closeButton}>
					<Ionicons name="close" size={24} color={Colors.gray} />
				</Pressable>
			</View>

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.contentContainer}
				showsVerticalScrollIndicator={false}
			>
				{/* タイトル */}
				{isEditing ? (
					<TextInput
						style={styles.titleInput}
						value={title}
						onChangeText={setTitle}
						autoFocus
					/>
				) : (
					<Text style={styles.title}>{title}</Text>
				)}

				{/* 参加者 */}
				<Text style={styles.sectionLabel}>参加者</Text>
				<View style={styles.participants}>
					{participants.map((user) => (
						<View key={user.id} style={styles.participantItem}>
							{/* アバターアイコン */}
							{user.avatar_url ? (
								<Image
									source={{ uri: user.avatar_url }}
									style={styles.avatar}
								/>
							) : (
								<View style={styles.avatarFallback}>
									<Text style={styles.avatarInitial}>
										{user.profile_name.charAt(0)}
									</Text>
								</View>
							)}
							<Text style={styles.participantName}>{user.profile_name}</Text>
						</View>
					))}
				</View>

				{/* 開始日 */}
				<Text style={styles.sectionLabel}>開始日</Text>
				{isEditing ? (
					<TextInput
						style={styles.input}
						value={startDate}
						onChangeText={setStartDate}
						placeholder="YYYY-MM-DD"
					/>
				) : (
					<Text style={styles.value}>{startDate}</Text>
				)}

				{/* メモ */}
				<Text style={styles.sectionLabel}>メモ</Text>
				{isEditing ? (
					<TextInput
						style={[styles.input, styles.memoInput]}
						value={memo}
						onChangeText={setMemo}
						multiline
						placeholder="メモを入力"
					/>
				) : (
					<Text style={styles.value}>{memo || "なし"}</Text>
				)}
			</ScrollView>

			{/* 旅行開始ボタン */}
			<View style={styles.footer}>
				<Pressable style={styles.startButton} onPress={handleStart}>
					<Ionicons
						name="airplane-outline"
						size={20}
						color={Colors.white}
						style={styles.startIcon}
					/>
					<Text style={styles.startButtonText}>旅行を開始する</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.white,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
	},
	handle: {
		width: 40,
		height: 4,
		backgroundColor: Colors.grayLighter,
		borderRadius: 2,
		alignSelf: "center",
		marginTop: 12,
		marginBottom: 4,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: Colors.grayLighter,
	},
	editButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingVertical: 4,
		paddingHorizontal: 8,
	},
	editButtonText: {
		fontSize: 14,
		color: Colors.primary,
		fontWeight: "600",
	},
	closeButton: {
		padding: 4,
	},
	content: {
		flex: 1,
	},
	contentContainer: {
		padding: 24,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: Colors.black,
	},
	titleInput: {
		fontSize: 24,
		fontWeight: "bold",
		color: Colors.black,
		borderBottomWidth: 2,
		borderBottomColor: Colors.primary,
		paddingBottom: 4,
	},
	sectionLabel: {
		fontSize: 14,
		fontWeight: "600",
		color: Colors.gray,
		marginBottom: 12,
		marginTop: 20,
	},
	value: {
		fontSize: 16,
		color: Colors.black,
	},
	input: {
		fontSize: 16,
		color: Colors.black,
		borderWidth: 1,
		borderColor: Colors.grayLighter,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		backgroundColor: Colors.background,
	},
	memoInput: {
		minHeight: 80,
		textAlignVertical: "top",
	},
	participants: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 16,
	},
	participantItem: {
		alignItems: "center",
		gap: 6,
	},
	avatar: {
		width: 48,
		height: 48,
		borderRadius: 24,
	},
	avatarFallback: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: Colors.primary,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarInitial: {
		color: Colors.white,
		fontSize: 18,
		fontWeight: "bold",
	},
	participantName: {
		fontSize: 12,
		color: Colors.black,
		textAlign: "center",
		maxWidth: 60,
	},
	footer: {
		padding: 20,
		paddingBottom: 36,
		borderTopWidth: 1,
		borderTopColor: Colors.grayLighter,
	},
	startButton: {
		backgroundColor: Colors.primary,
		borderRadius: 12,
		paddingVertical: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	startIcon: {
		marginRight: 8,
	},
	startButtonText: {
		color: Colors.white,
		fontSize: 18,
		fontWeight: "bold",
	},
});
