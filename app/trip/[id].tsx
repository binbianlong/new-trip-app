import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
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
} from "react-native";
import { Colors } from "../../src/constants/colors";
import {
	notifyMemberInvited,
	scheduleMorningGreetings,
} from "../../src/lib/notifications";
import { supabase } from "../../src/lib/supabase";
import { ensureTripMembers } from "../../src/lib/tripMembers";
import {
	fetchTrips,
	getActiveTripId,
	getTripById,
	getTrips,
	subscribe,
	updateTripStatus,
} from "../../src/store/tripStore";
import type { User } from "../../src/types";
import { ParticipantPickerModal } from "../components/ParticipantPickerModal";

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

	// ストアから該当旅行を取得し、変更を監視
	const [trip, setTrip] = useState(() => getTripById(id) ?? getTrips()[0]);
	const [activeTripId, setActiveTripId] = useState(getActiveTripId);

	useEffect(() => {
		const unsubscribe = subscribe(() => {
			const updated = getTripById(id);
			if (updated) setTrip(updated);
			setActiveTripId(getActiveTripId());
		});
		return unsubscribe;
	}, [id]);

	const isThisTripActive = trip.status === "started";
	const isOtherTripActive = activeTripId != null && activeTripId !== trip.id;

	// この旅行の参加者ユーザーを Supabase から取得
	const [participants, setParticipants] = useState<User[]>([]);
	const [editingParticipants, setEditingParticipants] = useState<User[]>([]);
	const [participantModalVisible, setParticipantModalVisible] = useState(false);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	// 編集モードの状態管理
	const [isEditing, setIsEditing] = useState(false);

	useEffect(() => {
		void supabase.auth.getUser().then(({ data }) => {
			setCurrentUserId(data.user?.id ?? null);
		});
	}, []);

	const fetchParticipants = useCallback(async () => {
		const { data: members } = await supabase
			.from("trip_members")
			.select("user_id")
			.eq("trip_id", trip.id)
			.is("deleted_at", null);

		const memberUserIds = (members ?? [])
			.map((m) => m.user_id)
			.filter((uid): uid is string => uid != null);
		const userIds = [
			...new Set(
				[...memberUserIds, trip.owner_user_id].filter(
					(uid): uid is string => uid != null,
				),
			),
		];

		if (userIds.length > 0) {
			const { data: users } = await supabase
				.from("users")
				.select("*")
				.in("id", userIds);
			const usersById = new Map((users ?? []).map((user) => [user.id, user]));
			const resolvedUsers = userIds.map(
				(userId) =>
					usersById.get(userId) ?? {
						id: userId,
						username: null,
						profile_name: userId === trip.owner_user_id ? "作成者" : "未設定",
						email: null,
						avatar_url: null,
						created_at: null,
						updated_at: null,
						deleted_at: null,
					},
			);
			setParticipants(resolvedUsers);
		} else {
			setParticipants([]);
		}
	}, [trip.id, trip.owner_user_id]);

	useEffect(() => {
		fetchParticipants();
	}, [fetchParticipants]);

	useEffect(() => {
		if (!isEditing) {
			setEditingParticipants(participants);
		}
	}, [participants, isEditing]);

	const handleAddParticipant = useCallback(
		(user: User) => {
			if (
				editingParticipants.some((participant) => participant.id === user.id)
			) {
				Alert.alert("追加済み", "このユーザーは既に参加者です");
				return;
			}

			setEditingParticipants((prev) => [...prev, user]);
			setParticipantModalVisible(false);
		},
		[editingParticipants],
	);

	const handleRemoveParticipant = useCallback(
		(user: User) => {
			if (trip.owner_user_id != null && user.id === trip.owner_user_id) {
				Alert.alert("削除不可", "旅行作成者は参加者から削除できません");
				return;
			}

			setEditingParticipants((prev) =>
				prev.filter((participant) => participant.id !== user.id),
			);
		},
		[trip.owner_user_id],
	);

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
		const { error } = await supabase
			.from("trips")
			.update({ status: "started" })
			.eq("id", trip.id);

		if (error) {
			console.error("Trip status update failed:", error);
			Alert.alert("エラー", `旅行の開始に失敗しました\n${error.message}`);
			return;
		}

		updateTripStatus(trip.id, "started");
		await fetchTrips();

		if (trip.title) {
			void scheduleMorningGreetings(trip.id, trip.title);
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

	const [isSaving, setIsSaving] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDelete = useCallback(() => {
		Alert.alert("旅行計画を削除", "この旅行計画を削除しますか？", [
			{ text: "キャンセル", style: "cancel" },
			{
				text: "削除する",
				style: "destructive",
				onPress: async () => {
					setIsDeleting(true);
					try {
						const { error } = await supabase
							.from("trips")
							.update({ deleted_at: new Date().toISOString() })
							.eq("id", trip.id);

						if (error) {
							console.error("Trip delete error:", error);
							Alert.alert("エラー", `削除に失敗しました\n${error.message}`);
							return;
						}

						await fetchTrips();
						router.dismiss();
					} catch (error) {
						console.error("handleDelete error:", error);
						Alert.alert("エラー", "削除中にエラーが発生しました");
					} finally {
						setIsDeleting(false);
					}
				},
			},
		]);
	}, [trip.id, router]);

	const onSave: SubmitHandler<TripFormData> = async (data) => {
		setIsSaving(true);
		try {
			const { error: tripUpdateError } = await supabase
				.from("trips")
				.update({
					title: data.title,
					start_date: data.start_date,
					memo: data.memo,
				})
				.eq("id", trip.id);

			if (tripUpdateError) {
				console.error("Trip update error:", tripUpdateError);
				Alert.alert("エラー", `保存に失敗しました\n${tripUpdateError.message}`);
				return;
			}

			const { data: currentMembers, error: currentMembersError } =
				await supabase
					.from("trip_members")
					.select("id,user_id")
					.eq("trip_id", trip.id);
			if (currentMembersError) {
				throw currentMembersError;
			}

			const currentParticipantIds = new Set(
				(currentMembers ?? [])
					.map((member) => member.user_id)
					.filter((userId): userId is string => userId != null),
			);
			const nextParticipantIds = new Set(
				editingParticipants.map((participant) => participant.id),
			);

			const participantIdsToAdd = [...nextParticipantIds].filter(
				(userId) => !currentParticipantIds.has(userId),
			);
			const participantIdsToRemove = [...currentParticipantIds].filter(
				(userId) => !nextParticipantIds.has(userId),
			);
			const memberRowIdsToRemove = (currentMembers ?? [])
				.filter((member) => {
					return (
						member.user_id != null &&
						participantIdsToRemove.includes(member.user_id)
					);
				})
				.map((member) => member.id)
				.filter((memberId): memberId is number => memberId != null);

			if (participantIdsToAdd.length > 0) {
				await ensureTripMembers(trip.id, participantIdsToAdd);

				const addedNames = editingParticipants
					.filter((p) => participantIdsToAdd.includes(p.id))
					.map((p) => p.profile_name ?? p.username ?? "ユーザー");
				void notifyMemberInvited(trip.title ?? "旅行", addedNames);
			}

			if (memberRowIdsToRemove.length > 0) {
				const { data: removedRows, error: removeError } = await supabase
					.from("trip_members")
					.delete()
					.in("id", memberRowIdsToRemove)
					.select("id");
				if (removeError) {
					throw removeError;
				}
				if ((removedRows?.length ?? 0) !== memberRowIdsToRemove.length) {
					throw new Error(
						"参加者の削除が反映されませんでした。trip_members の DELETE 権限（RLS）を確認してください。",
					);
				}
			}

			await fetchParticipants();
			await fetchTrips();
			setIsEditing(false);
			Alert.alert("保存完了", "変更を保存しました");
		} catch (error) {
			console.error("onSave error:", error);
			Alert.alert("エラー", "保存中にエラーが発生しました");
		} finally {
			setIsSaving(false);
		}
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
				<View style={styles.headerLeft}>
					{isEditing ? (
						<Pressable
							onPress={() => {
								reset();
								setEditingParticipants(participants);
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
							onPress={() => {
								setEditingParticipants(participants);
								setIsEditing(true);
							}}
							style={styles.headerButton}
						>
							<Ionicons
								name="pencil-outline"
								size={18}
								color={Colors.primary}
							/>
							<Text style={styles.headerButtonText}>編集</Text>
						</Pressable>
					)}
					{!isEditing && !isThisTripActive && (
						<Pressable
							style={[
								styles.headerDeleteButton,
								isDeleting && { opacity: 0.5 },
							]}
							onPress={handleDelete}
							disabled={isDeleting}
						>
							<Ionicons
								name="trash-outline"
								size={16}
								color={Colors.danger}
								style={styles.headerDeleteIcon}
							/>
							<Text style={styles.headerDeleteText}>
								{isDeleting ? "削除中..." : "削除"}
							</Text>
						</Pressable>
					)}
				</View>
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
						{(isEditing ? editingParticipants : participants).map((user) => {
							const displayName =
								user.profile_name ?? user.username ?? "未設定";
							const canRemove =
								isEditing &&
								(trip.owner_user_id == null || user.id !== trip.owner_user_id);

							return (
								<View key={user.id} style={styles.participantItem}>
									<View style={styles.avatarWrap}>
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
										{canRemove && (
											<Pressable
												onPress={() => handleRemoveParticipant(user)}
												style={styles.removeParticipantButton}
												hitSlop={8}
											>
												<Ionicons name="close" size={11} color={Colors.white} />
											</Pressable>
										)}
									</View>
									<Text style={styles.participantName}>{displayName}</Text>
								</View>
							);
						})}
					</View>
					{/* 編集中は参加者追加ボタンを表示 */}
					{isEditing && (
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
					<Pressable
						style={[styles.saveButton, isSaving && { opacity: 0.5 }]}
						onPress={handleSubmit(onSave)}
						disabled={isSaving}
					>
						<Ionicons
							name="checkmark"
							size={22}
							color={Colors.white}
							style={styles.startIcon}
						/>
						<Text style={styles.startButtonText}>
							{isSaving ? "保存中..." : "変更を保存する"}
						</Text>
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
			<ParticipantPickerModal
				visible={participantModalVisible}
				onClose={() => setParticipantModalVisible(false)}
				onSelectUser={handleAddParticipant}
				selectedUserIds={editingParticipants.map(
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
	headerLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
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
	avatarWrap: {
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
		fontSize: 18,
		fontWeight: "bold",
	},
	participantName: {
		fontSize: 12,
		color: Colors.black,
		textAlign: "center",
		maxWidth: 60,
	},
	removeParticipantButton: {
		position: "absolute",
		top: -4,
		right: -4,
		width: 18,
		height: 18,
		borderRadius: 9,
		backgroundColor: Colors.danger,
		borderWidth: 1,
		borderColor: Colors.white,
		alignItems: "center",
		justifyContent: "center",
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
		gap: 12,
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
	headerDeleteButton: {
		paddingVertical: 4,
		paddingHorizontal: 8,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	headerDeleteIcon: {
		marginRight: 4,
	},
	headerDeleteText: {
		color: Colors.danger,
		fontSize: 13,
		fontWeight: "600",
	},
});
