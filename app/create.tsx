import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
	Alert,
	Image,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native"; // Alertを追加
import { Colors } from "../src/constants/colors";
import { supabase } from "../src/lib/supabase";
import { ensureTripMembers } from "../src/lib/tripMembers";
import { fetchTrips } from "../src/store/tripStore";
import type { User } from "../src/types";
import { ParticipantPickerModal } from "./components/ParticipantPickerModal";

// フォームの型定義
type TripFormData = {
	title: string;
	start_date: string;
	memo: string;
};

// 旅行プラン作成画面
export default function CreateScreen() {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false); // ★送信中かどうかを管理
	const [participantModalVisible, setParticipantModalVisible] = useState(false);
	const [selectedParticipants, setSelectedParticipants] = useState<User[]>([]);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<TripFormData>({
		defaultValues: {
			title: "",
			start_date: "",
			memo: "",
		},
	});

	// 開始日ピッカーの表示状態
	const [showDatePicker, setShowDatePicker] = useState(false);

	useEffect(() => {
		void supabase.auth.getUser().then(({ data }) => {
			setCurrentUserId(data.user?.id ?? null);
		});
	}, []);

	const handleSelectParticipant = (user: User) => {
		setSelectedParticipants((prev) => {
			if (prev.some((participant) => participant.id === user.id)) {
				return prev;
			}
			return [...prev, user];
		});
	};

	const handleRemoveParticipant = (userId: string) => {
		setSelectedParticipants((prev) =>
			prev.filter((participant) => participant.id !== userId),
		);
	};

	// ★ ここを非同期(async)に書き換えます
	const onSubmit = async (data: TripFormData) => {
		if (isSubmitting) return;

		setIsSubmitting(true);
		try {
			// 1. 現在のログインユーザーを取得
			const { data: authData, error: authError } =
				await supabase.auth.getUser();
			if (authError || !authData.user) {
				throw new Error("ログイン情報が見つかりません。");
			}

			const { data: createdTrip, error } = await supabase
				.from("trips")
				.insert([
					{
						title: data.title,
						start_date: data.start_date,
						memo: data.memo,
						status: "planned",
						owner_user_id: authData.user.id,
					},
				])
				.select("id")
				.single();

			if (error) throw error;

			const participantIds = [
				authData.user.id,
				...selectedParticipants.map((participant) => participant.id),
			];
			const uniqueParticipantIds = [...new Set(participantIds)];
			await ensureTripMembers(createdTrip.id, uniqueParticipantIds);

			await fetchTrips();
			Alert.alert("作成完了", "旅行プランを保存しました！");
			router.back();
		} catch (error) {
			console.error(error);
			Alert.alert(
				"エラー",
				error instanceof Error ? error.message : "保存に失敗しました",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<KeyboardAvoidingView
			style={styles.keyboardView}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<ScrollView
				contentContainerStyle={styles.container}
				keyboardShouldPersistTaps="handled"
			>
				{/* タイトル入力欄 */}
				<View style={styles.field}>
					<Text style={styles.label}>タイトル（必須）</Text>
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
				</View>

				{/* 参加者追加ボタン */}
				<View style={styles.field}>
					<Text style={styles.label}>参加者</Text>
					{selectedParticipants.length > 0 && (
						<View style={styles.participants}>
							{selectedParticipants.map((user) => {
								const displayName =
									user.profile_name ?? user.username ?? "未設定";
								return (
									<View key={user.id} style={styles.participantItem}>
										{user.avatar_url ? (
											<Image
												source={{ uri: user.avatar_url }}
												style={styles.avatar}
											/>
										) : (
											<View style={styles.avatarFallback}>
												<Text style={styles.avatarInitial}>
													{displayName.charAt(0)}
												</Text>
											</View>
										)}
										<Text style={styles.participantName} numberOfLines={1}>
											{displayName}
										</Text>
										<Pressable
											onPress={() => handleRemoveParticipant(user.id)}
											style={styles.removeParticipantButton}
										>
											<Ionicons name="close" size={14} color={Colors.white} />
										</Pressable>
									</View>
								);
							})}
						</View>
					)}
					<Pressable
						style={styles.addParticipantButton}
						onPress={() => setParticipantModalVisible(true)}
					>
						<Ionicons
							name="person-add-outline"
							size={18}
							color={Colors.primary}
						/>
						<Text style={styles.addParticipantText}>参加者を追加</Text>
					</Pressable>
				</View>

				{/* 開始日入力 */}
				<View style={styles.field}>
					<Text style={styles.label}>開始日（必須）</Text>
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
						<Text style={styles.errorText}>{errors.start_date.message}</Text>
					)}
				</View>

				{/* メモ欄 */}
				<View style={styles.field}>
					<Text style={styles.label}>メモ（任意）</Text>
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
				</View>

				{/* 作成完了ボタン */}
				<Pressable
					style={[
						styles.button,
						isSubmitting && { opacity: 0.5 }, // 保存中はボタンを少し薄くする
					]}
					onPress={handleSubmit(onSubmit)}
					disabled={isSubmitting} // 保存中はボタンを押せなくする（二重登録防止）
				>
					<Text style={styles.buttonText}>
						{isSubmitting ? "保存中..." : "作成する"}
					</Text>
				</Pressable>
			</ScrollView>
			<ParticipantPickerModal
				visible={participantModalVisible}
				onClose={() => setParticipantModalVisible(false)}
				onSelectUser={handleSelectParticipant}
				selectedUserIds={selectedParticipants.map(
					(participant) => participant.id,
				)}
				excludeUserIds={currentUserId ? [currentUserId] : []}
			/>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	keyboardView: {
		flex: 1,
		backgroundColor: Colors.white,
	},
	container: {
		padding: 24,
		paddingBottom: 48,
	},
	field: {
		marginBottom: 24,
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
		gap: 12,
		marginBottom: 12,
	},
	participantItem: {
		alignItems: "center",
		maxWidth: 72,
		position: "relative",
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
		fontSize: 16,
		fontWeight: "700",
	},
	participantName: {
		marginTop: 6,
		fontSize: 12,
		color: Colors.black,
		textAlign: "center",
	},
	removeParticipantButton: {
		position: "absolute",
		top: -4,
		right: -4,
		width: 18,
		height: 18,
		borderRadius: 9,
		backgroundColor: Colors.gray,
		alignItems: "center",
		justifyContent: "center",
	},
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
	button: {
		backgroundColor: Colors.primary,
		borderRadius: 12,
		paddingVertical: 16,
		alignItems: "center",
		marginTop: 8,
	},
	buttonText: {
		color: Colors.white,
		fontSize: 16,
		fontWeight: "bold",
	},
});
