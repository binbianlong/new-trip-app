import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import {
	Image,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { Colors } from "../../src/constants/colors";
import { mockTripMembers, mockUsers } from "../../src/data/mock";
import { supabase } from "../../src/lib/supabase";
import {
	getActiveTripId,
	getTripById,
	getTrips,
	updateTripStatus,
} from "../../src/store/tripStore";

// 編集フォームの型定義
type TripFormData = {
	title: string;
	start_date: string;
	memo: string;
};

// 旅行プラン詳細・編集ポップアップ（モーダル）
export default function TripDetailModal() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();

	// ストアから該当旅行を取得（なければ先頭をフォールバック）
	const trip = getTripById(id) ?? getTrips()[0];
	const activeTripId = getActiveTripId();
	const isThisTripActive = trip.status === "started";
	const isOtherTripActive = activeTripId != null && activeTripId !== trip.id;

	// この旅行の参加者ユーザーを取得
	const participants = mockTripMembers
		.filter((m) => m.trip_id === trip.id)
		.map((m) => mockUsers.find((u) => u.id === m.user_id))
		.filter((u): u is NonNullable<typeof u> => u != null);

	// 編集モードの状態管理
	const [isEditing, setIsEditing] = useState(false);

	// react-hook-form（create.tsx と同じ実装）
	const {
		control,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<TripFormData>({
		defaultValues: {
			title: trip.title ?? "",
			start_date: trip.start_date ?? "",
			memo: trip.memo ?? "",
		},
	});

	// 開始日ピッカーの表示状態
	const [showDatePicker, setShowDatePicker] = useState(false);

	// 旅行を開始して旅行中画面へ遷移
	const handleStart = async () => {
		// ストアのステータスを更新
		updateTripStatus(trip.id, "started");

		// DB の status も更新を試行（モック ID の場合は失敗するが遷移は続行）
		const { error } = await supabase
			.from("trips")
			.update({ status: "started" })
			.eq("id", trip.id);

		if (error) {
			console.warn("Trip status update failed:", error.message);
		}

		router.dismiss();
		setTimeout(() => {
			router.push({
				pathname: "/trip/active",
				params: { tripId: trip.id },
			});
		}, 100);
	};

	// 旅行中画面を開く（既に開始済みの場合）
	const handleResume = () => {
		router.dismiss();
		setTimeout(() => {
			router.push({
				pathname: "/trip/active",
				params: { tripId: trip.id },
			});
		}, 100);
	};

	// 編集内容を保存（TODO: DB更新）
	const onSave: SubmitHandler<TripFormData> = (data) => {
		console.log("更新データ:", data);
		setIsEditing(false);
	};

	return (
		<KeyboardAvoidingView
			style={styles.keyboardView}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			{/* ドラッグハンドル */}
			<View style={styles.handle} />

			{/* ヘッダー */}
			<View style={styles.header}>
				{isEditing ? (
					<Pressable
						onPress={() => {
							reset();
							setIsEditing(false);
						}}
						style={styles.headerButton}
					>
						<Ionicons
							name="close-circle-outline"
							size={18}
							color={Colors.gray}
						/>
						<Text
							style={[styles.headerButtonText, styles.headerButtonTextCancel]}
						>
							キャンセル
						</Text>
					</Pressable>
				) : (
					<Pressable
						onPress={() => setIsEditing(true)}
						style={styles.headerButton}
					>
						<Ionicons name="pencil-outline" size={18} color={Colors.primary} />
						<Text style={styles.headerButtonText}>編集</Text>
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
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{/* タイトル */}
				<View style={styles.field}>
					<Text style={styles.label}>タイトル{isEditing && "（必須）"}</Text>
					{isEditing ? (
						<>
							<Controller
								control={control}
								name="title"
								rules={{ required: "タイトルは必須です" }}
								render={({ field: { onChange, onBlur, value } }) => (
									<TextInput
										style={[styles.input, errors.title && styles.inputError]}
										placeholder="旅行のタイトルを入力"
										placeholderTextColor={Colors.grayLight}
										onChangeText={onChange}
										onBlur={onBlur}
										value={value}
									/>
								)}
							/>
							{errors.title && (
								<Text style={styles.errorText}>{errors.title.message}</Text>
							)}
						</>
					) : (
						<Text style={styles.title}>{trip.title}</Text>
					)}
				</View>

				{/* 参加者 */}
				<View style={styles.field}>
					<Text style={styles.label}>参加者</Text>
					<View style={styles.participants}>
						{participants.map((user) => (
							<View key={user.id} style={styles.participantItem}>
								{user.avatar_url ? (
									<Image
										source={{ uri: user.avatar_url }}
										style={styles.avatar}
									/>
								) : (
									<View style={styles.avatarFallback}>
										<Text style={styles.avatarInitial}>
											{user.profile_name?.charAt(0) ?? "?"}
										</Text>
									</View>
								)}
								<Text style={styles.participantName}>{user.profile_name}</Text>
							</View>
						))}
					</View>
					{/* 編集中は参加者追加ボタンを表示 */}
					{isEditing && (
						<Pressable style={styles.addParticipantButton}>
							<Ionicons
								name="person-add-outline"
								size={18}
								color={Colors.primary}
							/>
							<Text style={styles.addParticipantText}>参加者を追加</Text>
						</Pressable>
					)}
				</View>

				{/* 開始日 */}
				<View style={styles.field}>
					<Text style={styles.label}>開始日{isEditing && "（必須）"}</Text>
					{isEditing ? (
						<>
							<Controller
								control={control}
								name="start_date"
								rules={{ required: "開始日は必須です" }}
								render={({ field: { onChange, value } }) => (
									<>
										<Pressable
											onPress={() => setShowDatePicker(true)}
											style={[
												styles.dateButton,
												errors.start_date && styles.inputError,
											]}
										>
											<Ionicons
												name="calendar-outline"
												size={18}
												color={Colors.primary}
											/>
											<Text
												style={value ? styles.dateText : styles.datePlaceholder}
											>
												{value || "日付を選択"}
											</Text>
										</Pressable>
										{showDatePicker && (
											<DateTimePicker
												value={value ? new Date(value) : new Date()}
												mode="date"
												display={Platform.OS === "ios" ? "spinner" : "default"}
												locale="ja"
												onChange={(_event, selectedDate) => {
													if (Platform.OS !== "ios") {
														setShowDatePicker(false);
													}
													if (selectedDate) {
														onChange(selectedDate.toISOString().split("T")[0]);
													}
												}}
											/>
										)}
										{Platform.OS === "ios" && showDatePicker && (
											<Pressable
												onPress={() => setShowDatePicker(false)}
												style={styles.dateDoneButton}
											>
												<Text style={styles.dateDoneText}>完了</Text>
											</Pressable>
										)}
									</>
								)}
							/>
							{errors.start_date && (
								<Text style={styles.errorText}>
									{errors.start_date.message}
								</Text>
							)}
						</>
					) : (
						<Text style={styles.value}>{trip.start_date}</Text>
					)}
				</View>

				{/* メモ */}
				<View style={styles.field}>
					<Text style={styles.label}>メモ{isEditing && "（任意）"}</Text>
					{isEditing ? (
						<Controller
							control={control}
							name="memo"
							render={({ field: { onChange, onBlur, value } }) => (
								<TextInput
									style={[styles.input, styles.memoInput]}
									placeholder="メモを入力"
									placeholderTextColor={Colors.grayLight}
									onChangeText={onChange}
									onBlur={onBlur}
									value={value}
									multiline
								/>
							)}
						/>
					) : (
						<Text style={styles.value}>{trip.memo || "なし"}</Text>
					)}
				</View>
			</ScrollView>

			{/* フッター */}
			<View style={styles.footer}>
				{isEditing ? (
					<Pressable style={styles.saveButton} onPress={handleSubmit(onSave)}>
						<Ionicons
							name="checkmark"
							size={22}
							color={Colors.white}
							style={styles.startIcon}
						/>
						<Text style={styles.startButtonText}>変更を保存する</Text>
					</Pressable>
				) : isThisTripActive ? (
					<Pressable style={styles.resumeButton} onPress={handleResume}>
						<Ionicons
							name="map-outline"
							size={20}
							color={Colors.white}
							style={styles.startIcon}
						/>
						<Text style={styles.startButtonText}>旅行中画面を開く</Text>
					</Pressable>
				) : isOtherTripActive ? (
					<View style={styles.lockedButton}>
						<Ionicons
							name="lock-closed"
							size={20}
							color={Colors.white}
							style={styles.startIcon}
						/>
						<Text style={styles.startButtonText}>他の旅行が進行中です</Text>
					</View>
				) : (
					<Pressable style={styles.startButton} onPress={handleStart}>
						<Ionicons
							name="airplane-outline"
							size={20}
							color={Colors.white}
							style={styles.startIcon}
						/>
						<Text style={styles.startButtonText}>旅行を開始する</Text>
					</Pressable>
				)}
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	keyboardView: {
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
	headerButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingVertical: 4,
		paddingHorizontal: 8,
	},
	headerButtonText: {
		fontSize: 14,
		color: Colors.primary,
		fontWeight: "600",
	},
	headerButtonTextCancel: {
		color: Colors.gray,
	},
	closeButton: {
		padding: 4,
	},
	content: {
		flex: 1,
	},
	contentContainer: {
		padding: 24,
		paddingBottom: 16,
	},
	// create.tsx と同じ field / label / input スタイル
	field: {
		marginBottom: 24,
	},
	label: {
		fontSize: 14,
		fontWeight: "600",
		color: Colors.black,
		marginBottom: 8,
	},
	title: {
		fontSize: 22,
		fontWeight: "bold",
		color: Colors.black,
	},
	value: {
		fontSize: 16,
		color: Colors.black,
	},
	input: {
		borderWidth: 1,
		borderColor: Colors.grayLight,
		borderRadius: 12,
		padding: 14,
		fontSize: 16,
		color: Colors.black,
	},
	dateButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		borderWidth: 1,
		borderColor: Colors.grayLight,
		borderRadius: 12,
		padding: 14,
	},
	dateText: {
		fontSize: 16,
		color: Colors.black,
	},
	datePlaceholder: {
		fontSize: 16,
		color: Colors.grayLight,
	},
	dateDoneButton: {
		alignSelf: "flex-end",
		paddingVertical: 8,
		paddingHorizontal: 4,
	},
	dateDoneText: {
		fontSize: 15,
		color: Colors.primary,
		fontWeight: "600",
	},
	inputError: {
		borderColor: Colors.danger,
	},
	errorText: {
		fontSize: 12,
		color: Colors.danger,
		marginTop: 6,
	},
	memoInput: {
		height: 120,
		textAlignVertical: "top",
	},
	participants: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 16,
		marginBottom: 12,
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
	// create.tsx と同じ dashed ボタン
	addParticipantButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		borderWidth: 1,
		borderColor: Colors.primary,
		borderRadius: 12,
		borderStyle: "dashed",
		padding: 14,
		justifyContent: "center",
	},
	addParticipantText: {
		fontSize: 15,
		color: Colors.primary,
		fontWeight: "600",
	},
	footer: {
		padding: 20,
		paddingBottom: 36,
		borderTopWidth: 1,
		borderTopColor: Colors.grayLighter,
	},
	saveButton: {
		backgroundColor: Colors.primaryDark,
		borderRadius: 12,
		paddingVertical: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	startButton: {
		backgroundColor: Colors.primary,
		borderRadius: 12,
		paddingVertical: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	resumeButton: {
		backgroundColor: "#FF9800",
		borderRadius: 12,
		paddingVertical: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	lockedButton: {
		backgroundColor: Colors.grayLight,
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
