import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import {
	ActivityIndicator,
	Alert,
	Animated,
	Easing,
	Image,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { Colors } from "../../src/constants/colors";
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
import type { Photo, User } from "../../src/types";
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
	const isThisTripFinished = trip.status === "finished";
	const isOtherTripActive = activeTripId != null && activeTripId !== trip.id;

	const [tripPhotos, setTripPhotos] = useState<Photo[]>([]);
	const [isPhotosLoading, setIsPhotosLoading] = useState(false);
	const [highlightIndex, setHighlightIndex] = useState(0);
	const [isHighlightModalVisible, setIsHighlightModalVisible] = useState(false);
	const [highlightModalReady, setHighlightModalReady] = useState(false);
	const modalProgress = useRef(new Animated.Value(0)).current;
	const auraProgress = useRef(new Animated.Value(0)).current;
	const highlightAnim = useRef(new Animated.Value(1)).current;

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

	const fetchTripPhotos = useCallback(async () => {
		if (!isThisTripFinished) {
			setTripPhotos([]);
			setHighlightIndex(0);
			return;
		}

		setIsPhotosLoading(true);
		try {
			const { data, error } = await supabase
				.from("photos")
				.select("*")
				.eq("trip_id", trip.id)
				.order("created_at", { ascending: true });

			if (error) {
				console.error("Trip photos fetch error:", error);
				setTripPhotos([]);
				return;
			}

			setTripPhotos(data ?? []);
			setHighlightIndex(0);
		} catch (error) {
			console.error("fetchTripPhotos error:", error);
			setTripPhotos([]);
		} finally {
			setIsPhotosLoading(false);
		}
	}, [isThisTripFinished, trip.id]);

	useEffect(() => {
		fetchTripPhotos();
	}, [fetchTripPhotos]);

	useEffect(() => {
		if (tripPhotos.length === 0) {
			setHighlightIndex(0);
			return;
		}
		if (highlightIndex >= tripPhotos.length) {
			setHighlightIndex(0);
		}
	}, [highlightIndex, tripPhotos.length]);

	const moveHighlight = useCallback(
		(direction: -1 | 1) => {
			setHighlightIndex((prev) => {
				if (tripPhotos.length === 0) return 0;
				return (prev + direction + tripPhotos.length) % tripPhotos.length;
			});
		},
		[tripPhotos.length],
	);

	const currentHighlightPhoto = tripPhotos[highlightIndex] ?? null;
	const currentHighlightKey = currentHighlightPhoto?.id ?? null;
	const highlightModalOpacity = modalProgress.interpolate({
		inputRange: [0, 1],
		outputRange: [0, 1],
	});
	const highlightModalScale = modalProgress.interpolate({
		inputRange: [0, 1],
		outputRange: [0.86, 1],
	});
	const highlightModalTranslateY = modalProgress.interpolate({
		inputRange: [0, 1],
		outputRange: [38, 0],
	});
	const auraRotate = auraProgress.interpolate({
		inputRange: [0, 1],
		outputRange: ["0deg", "360deg"],
	});
	const auraDriftX = auraProgress.interpolate({
		inputRange: [0, 0.5, 1],
		outputRange: [-26, 22, -26],
	});
	const auraDriftY = auraProgress.interpolate({
		inputRange: [0, 0.5, 1],
		outputRange: [14, -20, 14],
	});

	useEffect(() => {
		if (currentHighlightKey == null) return;

		highlightAnim.setValue(0.88);
		Animated.spring(highlightAnim, {
			toValue: 1,
			useNativeDriver: true,
			friction: 8,
			tension: 85,
		}).start();
	}, [currentHighlightKey, highlightAnim]);

	useEffect(() => {
		if (!isHighlightModalVisible) {
			modalProgress.stopAnimation();
			auraProgress.stopAnimation();
			return;
		}

		modalProgress.setValue(0);
		auraProgress.setValue(0);
		setHighlightModalReady(true);

		Animated.timing(modalProgress, {
			toValue: 1,
			duration: 420,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();

		const loop = Animated.loop(
			Animated.timing(auraProgress, {
				toValue: 1,
				duration: 5200,
				easing: Easing.linear,
				useNativeDriver: true,
			}),
		);
		loop.start();

		return () => loop.stop();
	}, [auraProgress, isHighlightModalVisible, modalProgress]);

	useEffect(() => {
		if (!isThisTripFinished || isEditing) {
			setIsHighlightModalVisible(false);
			setHighlightModalReady(false);
		}
	}, [isEditing, isThisTripFinished]);

	const openHighlightModal = useCallback(() => {
		if (tripPhotos.length === 0 || isPhotosLoading) return;
		setIsHighlightModalVisible(true);
	}, [isPhotosLoading, tripPhotos.length]);

	const closeHighlightModal = useCallback(() => {
		Animated.timing(modalProgress, {
			toValue: 0,
			duration: 260,
			easing: Easing.in(Easing.cubic),
			useNativeDriver: true,
		}).start(({ finished }) => {
			if (!finished) return;
			setIsHighlightModalVisible(false);
			setHighlightModalReady(false);
		});
	}, [modalProgress]);

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

				{/* 完了済み旅行の写真ハイライト */}
				{!isEditing && isThisTripFinished && (
					<View style={styles.field}>
						<View style={styles.highlightHeaderRow}>
							<Text style={styles.label}>旅のハイライト</Text>
							<Text style={styles.highlightCounter}>
								{tripPhotos.length > 0
									? `${highlightIndex + 1}/${tripPhotos.length}`
									: "0/0"}
							</Text>
						</View>

						{isPhotosLoading ? (
							<View style={styles.highlightLoadingBox}>
								<ActivityIndicator size="small" color={Colors.primary} />
								<Text style={styles.highlightLoadingText}>
									写真を読み込み中...
								</Text>
							</View>
						) : tripPhotos.length > 0 ? (
							<Pressable
								style={styles.highlightLaunchButton}
								onPress={openHighlightModal}
							>
								<View style={styles.highlightLaunchLeft}>
									<Ionicons name="sparkles" size={18} color={Colors.white} />
									<Text style={styles.highlightLaunchTitle}>
										全画面ハイライトを見る
									</Text>
								</View>
								<Ionicons name="expand" size={20} color={Colors.white} />
							</Pressable>
						) : (
							<View style={styles.highlightEmptyBox}>
								<Ionicons
									name="camera-outline"
									size={20}
									color={Colors.grayLight}
								/>
								<Text style={styles.highlightEmptyText}>
									この旅行の写真はまだありません
								</Text>
							</View>
						)}
					</View>
				)}
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
				) : isThisTripFinished ? (
					<View style={styles.finishedButton}>
						<Ionicons
							name="flag-outline"
							size={20}
							color={Colors.white}
							style={styles.startIcon}
						/>
						<Text style={styles.startButtonText}>この旅行は完了済みです</Text>
					</View>
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

			<Modal
				visible={isHighlightModalVisible || highlightModalReady}
				transparent
				animationType="none"
				onRequestClose={closeHighlightModal}
			>
				<View style={styles.highlightModalOverlay}>
					<Animated.View
						pointerEvents="none"
						style={[
							styles.highlightAuraPrimary,
							{
								opacity: highlightModalOpacity,
								transform: [
									{ translateX: auraDriftX },
									{ translateY: auraDriftY },
									{ rotate: auraRotate },
								],
							},
						]}
					/>
					<Animated.View
						pointerEvents="none"
						style={[
							styles.highlightAuraSecondary,
							{
								opacity: highlightModalOpacity.interpolate({
									inputRange: [0, 1],
									outputRange: [0, 0.68],
								}),
								transform: [
									{
										rotate: auraProgress.interpolate({
											inputRange: [0, 1],
											outputRange: ["360deg", "0deg"],
										}),
									},
								],
							},
						]}
					/>

					<Animated.View
						style={[
							styles.highlightModalBody,
							{
								opacity: highlightModalOpacity,
								transform: [
									{ scale: highlightModalScale },
									{ translateY: highlightModalTranslateY },
								],
							},
						]}
					>
						<View style={styles.highlightModalHeader}>
							<Text style={styles.highlightModalTitle}>TRIP HIGHLIGHTS</Text>
							<Pressable
								onPress={closeHighlightModal}
								style={styles.highlightModalClose}
							>
								<Ionicons name="close" size={20} color={Colors.white} />
							</Pressable>
						</View>

						{tripPhotos.length > 0 ? (
							<>
								<View style={styles.highlightStageWrap}>
									<Pressable
										onPress={() => moveHighlight(-1)}
										style={styles.highlightStageNavLeft}
										hitSlop={10}
									>
										<Ionicons
											name="chevron-back"
											size={28}
											color={Colors.white}
										/>
									</Pressable>
									<Animated.View
										style={[
											styles.highlightStageCard,
											{
												opacity: highlightAnim,
												transform: [
													{ perspective: 920 },
													{
														rotateY: highlightAnim.interpolate({
															inputRange: [0.88, 1],
															outputRange: ["14deg", "0deg"],
														}),
													},
													{ scale: highlightAnim },
												],
											},
										]}
									>
										{currentHighlightPhoto?.image_url ? (
											<Image
												source={{ uri: currentHighlightPhoto.image_url }}
												style={styles.highlightStageImage}
											/>
										) : (
											<View style={styles.highlightStagePlaceholder}>
												<Ionicons
													name="image-outline"
													size={42}
													color={Colors.grayLight}
												/>
											</View>
										)}
									</Animated.View>
									<Pressable
										onPress={() => moveHighlight(1)}
										style={styles.highlightStageNavRight}
										hitSlop={10}
									>
										<Ionicons
											name="chevron-forward"
											size={28}
											color={Colors.white}
										/>
									</Pressable>
								</View>

								<View style={styles.highlightMetaRow}>
									<Text style={styles.highlightMetaCount}>
										{highlightIndex + 1} / {tripPhotos.length}
									</Text>
									{currentHighlightPhoto?.created_at && (
										<Text style={styles.highlightMetaDate}>
											{new Date(
												currentHighlightPhoto.created_at,
											).toLocaleString("ja-JP", {
												month: "short",
												day: "numeric",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</Text>
									)}
								</View>

								<ScrollView
									horizontal
									showsHorizontalScrollIndicator={false}
									contentContainerStyle={styles.highlightThumbList}
								>
									{tripPhotos.map((photo, index) => {
										const isActive = index === highlightIndex;
										return (
											<Pressable
												key={photo.id}
												onPress={() => setHighlightIndex(index)}
												style={[
													styles.highlightThumbButton,
													isActive && styles.highlightThumbButtonActive,
												]}
											>
												{photo.image_url ? (
													<Image
														source={{ uri: photo.image_url }}
														style={styles.highlightThumbImage}
													/>
												) : (
													<View style={styles.highlightThumbFallback}>
														<Ionicons
															name="camera-outline"
															size={14}
															color={Colors.gray}
														/>
													</View>
												)}
											</Pressable>
										);
									})}
								</ScrollView>
							</>
						) : (
							<View style={styles.highlightModalEmpty}>
								<Ionicons
									name="camera-outline"
									size={28}
									color={Colors.grayLight}
								/>
								<Text style={styles.highlightModalEmptyText}>
									表示できる写真がありません
								</Text>
							</View>
						)}
					</Animated.View>
				</View>
			</Modal>

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
	highlightHeaderRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	highlightCounter: {
		fontSize: 12,
		fontWeight: "700",
		color: Colors.gray,
	},
	highlightLoadingBox: {
		height: 180,
		borderRadius: 18,
		backgroundColor: Colors.grayLighter,
		justifyContent: "center",
		alignItems: "center",
		gap: 10,
	},
	highlightLoadingText: {
		fontSize: 13,
		color: Colors.gray,
	},
	highlightLaunchButton: {
		height: 62,
		borderRadius: 14,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		backgroundColor: "#182D48",
		borderWidth: 1,
		borderColor: "#2D4F80",
	},
	highlightLaunchLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	highlightLaunchTitle: {
		color: Colors.white,
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 0.2,
	},
	highlightModalOverlay: {
		flex: 1,
		backgroundColor: "#060A16",
		paddingHorizontal: 16,
		paddingVertical: 36,
		justifyContent: "center",
	},
	highlightAuraPrimary: {
		position: "absolute",
		width: 320,
		height: 320,
		borderRadius: 160,
		backgroundColor: "rgba(46, 168, 255, 0.28)",
		top: 40,
		left: -80,
	},
	highlightAuraSecondary: {
		position: "absolute",
		width: 280,
		height: 280,
		borderRadius: 140,
		backgroundColor: "rgba(255, 113, 184, 0.24)",
		bottom: 70,
		right: -60,
	},
	highlightModalBody: {
		borderRadius: 24,
		padding: 16,
		backgroundColor: "rgba(13, 20, 36, 0.88)",
		borderWidth: 1,
		borderColor: "rgba(144, 186, 255, 0.35)",
		shadowColor: "#000B24",
		shadowOffset: { width: 0, height: 16 },
		shadowOpacity: 0.46,
		shadowRadius: 28,
		elevation: 18,
	},
	highlightModalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	highlightModalTitle: {
		fontSize: 15,
		fontWeight: "800",
		color: "#BFE1FF",
		letterSpacing: 1.1,
	},
	highlightModalClose: {
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: "rgba(255,255,255,0.16)",
		alignItems: "center",
		justifyContent: "center",
	},
	highlightStageWrap: {
		height: 430,
		justifyContent: "center",
		alignItems: "center",
	},
	highlightStageNavLeft: {
		position: "absolute",
		left: 2,
		top: "50%",
		marginTop: -24,
		zIndex: 2,
	},
	highlightStageNavRight: {
		position: "absolute",
		right: 2,
		top: "50%",
		marginTop: -24,
		zIndex: 2,
	},
	highlightStageCard: {
		width: "84%",
		height: "100%",
		borderRadius: 24,
		overflow: "hidden",
		backgroundColor: "#101829",
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.16)",
	},
	highlightStageImage: {
		width: "100%",
		height: "100%",
	},
	highlightStagePlaceholder: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#151D2E",
	},
	highlightMetaRow: {
		marginTop: 12,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	highlightMetaCount: {
		fontSize: 15,
		fontWeight: "700",
		color: Colors.white,
	},
	highlightMetaDate: {
		fontSize: 13,
		color: "#B6C4DA",
	},
	highlightThumbList: {
		gap: 8,
		paddingTop: 14,
		paddingBottom: 4,
	},
	highlightThumbButton: {
		width: 56,
		height: 56,
		borderRadius: 12,
		overflow: "hidden",
		borderWidth: 2,
		borderColor: "transparent",
		backgroundColor: Colors.grayLighter,
	},
	highlightThumbButtonActive: {
		borderColor: Colors.primary,
	},
	highlightThumbImage: {
		width: "100%",
		height: "100%",
	},
	highlightThumbFallback: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#192133",
	},
	highlightEmptyBox: {
		borderWidth: 1,
		borderStyle: "dashed",
		borderColor: Colors.grayLight,
		borderRadius: 14,
		paddingVertical: 18,
		alignItems: "center",
		gap: 8,
	},
	highlightEmptyText: {
		fontSize: 13,
		color: Colors.gray,
	},
	highlightModalEmpty: {
		height: 320,
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
	},
	highlightModalEmptyText: {
		fontSize: 14,
		color: "#AFC4DF",
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
	finishedButton: {
		backgroundColor: "#5C6B73",
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
