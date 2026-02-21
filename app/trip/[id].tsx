import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
	Audio,
	type AVPlaybackStatus,
	InterruptionModeAndroid,
	InterruptionModeIOS,
} from "expo-av";
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
	Linking,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	TextInput,
	useWindowDimensions,
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
import type { Photo, User } from "../../src/types";
import { ParticipantPickerModal } from "../components/ParticipantPickerModal";

// 編集フォームの型定義
type TripFormData = {
	title: string;
	start_date: string;
	memo: string;
};

type ItunesSearchTrack = {
	trackId: number;
	trackName: string;
	artistName: string;
	previewUrl: string;
	artworkUrl100?: string | null;
	trackViewUrl?: string | null;
};

type ItunesSearchResponse = {
	results?: ItunesSearchTrack[];
};

const ITUNES_SEARCH_FUNCTION_NAME =
	process.env.EXPO_PUBLIC_ITUNES_SEARCH_FUNCTION_NAME ?? "itunes-search";
const MAX_SHARE_PHOTO_LINKS = 8;

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "object" && error != null) {
		const e = error as {
			message?: string;
			code?: string;
			details?: string;
			hint?: string;
		};
		const message = e.message ?? "不明なエラー";
		const parts = [message];
		if (e.code) parts.push(`code=${e.code}`);
		if (e.details) parts.push(`details=${e.details}`);
		if (e.hint) parts.push(`hint=${e.hint}`);
		return parts.join("\n");
	}

	return "不明なエラー";
}

async function getEdgeFunctionErrorDetail(error: unknown): Promise<string> {
	const fallback = getErrorMessage(error);

	if (
		typeof error !== "object" ||
		error == null ||
		!("context" in error) ||
		!(error.context instanceof Response)
	) {
		return fallback;
	}

	const context = (error as { context: Response }).context;
	const statusText = `status=${context.status}`;

	try {
		const text = await context.text();
		if (!text) {
			return `${fallback} (${statusText})`;
		}

		try {
			const json = JSON.parse(text) as { error?: string; message?: string };
			const detail = json.error ?? json.message ?? text;
			return `${detail} (${statusText})`;
		} catch {
			return `${text} (${statusText})`;
		}
	} catch {
		return `${fallback} (${statusText})`;
	}
}

// 旅行プラン詳細・編集ポップアップ（モーダル）
export default function TripDetailModal() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const { height: viewportHeight } = useWindowDimensions();

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

	const resolveAvatarDisplayUrl = useCallback(async (raw: string | null) => {
		if (!raw) return null;
		const avatarBucket =
			process.env.EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET ?? "photos";
		if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
			const { data, error } = await supabase.storage
				.from(avatarBucket)
				.createSignedUrl(raw, 60 * 60);
			if (!error && data?.signedUrl) return data.signedUrl;
			if (error) {
				console.warn("Header createSignedUrl failed:", {
					bucket: avatarBucket,
					path: raw,
					message: error.message,
				});
			}
			const { data: publicData } = supabase.storage
				.from(avatarBucket)
				.getPublicUrl(raw);
			return publicData.publicUrl;
		}
		try {
			const parsed = new URL(raw);
			const match = parsed.pathname.match(
				/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
			);
			if (!match) return raw;
			const [, bucket, objectPathRaw] = match;
			const objectPath = decodeURIComponent(objectPathRaw);
			const { data, error } = await supabase.storage
				.from(bucket)
				.createSignedUrl(objectPath, 60 * 60);
			if (!error && data?.signedUrl) return data.signedUrl;
			if (error) {
				console.warn("Header createSignedUrl from URL failed:", {
					bucket,
					path: objectPath,
					message: error.message,
				});
			}
			const { data: publicData } = supabase.storage
				.from(bucket)
				.getPublicUrl(objectPath);
			return publicData.publicUrl;
		} catch {
			return raw;
		}
	}, []);

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
	const [isThemeModalVisible, setIsThemeModalVisible] = useState(false);
	const [themeKeyword, setThemeKeyword] = useState("");
	const [themeResults, setThemeResults] = useState<ItunesSearchTrack[]>([]);
	const [isThemeSearching, setIsThemeSearching] = useState(false);
	const [isThemeSaving, setIsThemeSaving] = useState(false);
	const [isSharingTrip, setIsSharingTrip] = useState(false);
	const [isHighlightMusicLoading, setIsHighlightMusicLoading] = useState(false);
	const [isHighlightMusicPlaying, setIsHighlightMusicPlaying] = useState(false);
	const [highlightMusicError, setHighlightMusicError] = useState<string | null>(
		null,
	);
	const highlightSoundRef = useRef<Audio.Sound | null>(null);

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

			if (resolvedUsers) {
				const resolvedData = await Promise.all(
					resolvedUsers.map(async (user) => {
						if (user.avatar_url) {
							const resolvedUrl = await resolveAvatarDisplayUrl(
								user.avatar_url,
							);
							return { ...user, avatar_url: resolvedUrl };
						}
						return user;
					}),
				);
				setParticipants(resolvedData);
			}
		} else {
			setParticipants([]);
		}
	}, [trip.id, trip.owner_user_id, resolveAvatarDisplayUrl]);

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
	const isCompactHighlight = viewportHeight <= 700;
	const highlightStageHeight = isCompactHighlight ? 300 : 430;
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

	useEffect(() => {
		if (!isThisTripFinished || isEditing) {
			setIsThemeModalVisible(false);
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

	const unloadHighlightSound = useCallback(async () => {
		const sound = highlightSoundRef.current;
		highlightSoundRef.current = null;
		setIsHighlightMusicPlaying(false);
		setIsHighlightMusicLoading(false);
		if (!sound) return;

		try {
			sound.setOnPlaybackStatusUpdate(null);
			await sound.stopAsync();
			await sound.unloadAsync();
		} catch (error) {
			console.error("unloadHighlightSound error:", error);
		}
	}, []);

	const ensureHighlightSound = useCallback(async (previewUrl: string) => {
		const current = highlightSoundRef.current;
		if (current) return current;

		await Audio.setAudioModeAsync({
			playsInSilentModeIOS: true,
			staysActiveInBackground: false,
			shouldDuckAndroid: true,
			playThroughEarpieceAndroid: false,
			interruptionModeIOS: InterruptionModeIOS.DuckOthers,
			interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
		});

		const { sound } = await Audio.Sound.createAsync(
			{ uri: previewUrl },
			{
				shouldPlay: false,
				positionMillis: 0,
				progressUpdateIntervalMillis: 300,
			},
			(status: AVPlaybackStatus) => {
				if (!status.isLoaded) return;

				if (status.didJustFinish) {
					setIsHighlightMusicPlaying(false);
					void highlightSoundRef.current?.setPositionAsync(0);
					return;
				}

				setIsHighlightMusicPlaying(Boolean(status.isPlaying));
			},
		);

		highlightSoundRef.current = sound;
		return sound;
	}, []);

	const playHighlightThemeMusic = useCallback(
		async (fromStart = false) => {
			const previewUrl = trip.theme_music_preview_url;
			if (!previewUrl) return;

			setHighlightMusicError(null);
			setIsHighlightMusicLoading(true);
			try {
				const sound = await ensureHighlightSound(previewUrl);
				if (fromStart) {
					await sound.setPositionAsync(0);
				}
				await sound.playAsync();
				setIsHighlightMusicPlaying(true);
			} catch (error) {
				console.error("playHighlightThemeMusic error:", error);
				const message = getErrorMessage(error);
				setHighlightMusicError(message);
				Alert.alert("再生エラー", `テーマ音楽の再生に失敗しました\n${message}`);
			} finally {
				setIsHighlightMusicLoading(false);
			}
		},
		[ensureHighlightSound, trip.theme_music_preview_url],
	);

	const pauseHighlightThemeMusic = useCallback(async () => {
		const sound = highlightSoundRef.current;
		if (!sound) return;

		try {
			await sound.pauseAsync();
			setIsHighlightMusicPlaying(false);
		} catch (error) {
			console.error("pauseHighlightThemeMusic error:", error);
		}
	}, []);

	const toggleHighlightThemeMusic = useCallback(async () => {
		if (isHighlightMusicLoading) return;
		if (isHighlightMusicPlaying) {
			await pauseHighlightThemeMusic();
			return;
		}
		await playHighlightThemeMusic(false);
	}, [
		isHighlightMusicLoading,
		isHighlightMusicPlaying,
		pauseHighlightThemeMusic,
		playHighlightThemeMusic,
	]);

	const handleShareTripMemories = useCallback(async () => {
		if (isSharingTrip) return;
		if (!isThisTripFinished) {
			Alert.alert("共有不可", "完了した旅行のみ共有できます");
			return;
		}

		const shareablePhotoUrls = tripPhotos
			.map((photo) => photo.image_url?.trim() ?? "")
			.filter((url) => url.length > 0);
		if (shareablePhotoUrls.length === 0) {
			Alert.alert(
				"写真がありません",
				"共有するには、この旅行に1枚以上の写真を追加してください",
			);
			return;
		}

		const hasThemeMusic =
			typeof trip.theme_music_title === "string" ||
			typeof trip.theme_music_preview_url === "string" ||
			typeof trip.theme_music_track_view_url === "string";
		if (!hasThemeMusic) {
			Alert.alert(
				"テーマ音楽が未設定です",
				"共有するにはテーマ音楽を設定してください",
			);
			return;
		}

		const tripTitle = trip.title?.trim() || "旅行の思い出";
		const themeTrackUrl =
			trip.theme_music_track_view_url ?? trip.theme_music_preview_url;
		const lines: string[] = [
			`${tripTitle} を共有します`,
			"",
			`開始日: ${trip.start_date ?? "未設定"}`,
		];

		const memoText = trip.memo?.trim();
		if (memoText) {
			lines.push(`メモ: ${memoText}`);
		}

		lines.push("");
		lines.push(
			`テーマ音楽: ${trip.theme_music_title ?? "未設定"}${
				trip.theme_music_artist ? ` / ${trip.theme_music_artist}` : ""
			}`,
		);
		if (themeTrackUrl) {
			lines.push(`テーマ音楽リンク: ${themeTrackUrl}`);
		}

		lines.push("");
		lines.push(`写真リンク (${shareablePhotoUrls.length}枚):`);
		for (const [index, photoUrl] of shareablePhotoUrls
			.slice(0, MAX_SHARE_PHOTO_LINKS)
			.entries()) {
			lines.push(`${index + 1}. ${photoUrl}`);
		}
		if (shareablePhotoUrls.length > MAX_SHARE_PHOTO_LINKS) {
			lines.push(
				`...ほか ${shareablePhotoUrls.length - MAX_SHARE_PHOTO_LINKS} 枚`,
			);
		}

		setIsSharingTrip(true);
		try {
			await Share.share({
				title: `${tripTitle}の共有`,
				message: lines.join("\n"),
			});
		} catch (error) {
			console.error("handleShareTripMemories error:", error);
			Alert.alert(
				"共有エラー",
				`共有に失敗しました\n${getErrorMessage(error)}`,
			);
		} finally {
			setIsSharingTrip(false);
		}
	}, [isSharingTrip, isThisTripFinished, trip, tripPhotos]);

	useEffect(() => {
		if (!isHighlightModalVisible) {
			void unloadHighlightSound();
			return;
		}

		if (!trip.theme_music_preview_url) {
			setHighlightMusicError("テーマ音楽が未設定です");
			return;
		}

		void playHighlightThemeMusic(true);
	}, [
		isHighlightModalVisible,
		playHighlightThemeMusic,
		trip.theme_music_preview_url,
		unloadHighlightSound,
	]);

	useEffect(() => {
		return () => {
			void unloadHighlightSound();
		};
	}, [unloadHighlightSound]);

	const openThemeModal = useCallback(() => {
		setThemeKeyword("");
		setThemeResults([]);
		setIsThemeModalVisible(true);
	}, []);

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
				void notifyMemberInvited(
					trip.title ?? "旅行",
					participantIdsToAdd,
					addedNames,
				);
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

	const openExternalUrl = useCallback(
		async (url: string | null | undefined, fallbackMessage: string) => {
			if (!url) {
				Alert.alert("未設定", "リンクが見つかりませんでした");
				return;
			}

			try {
				const canOpen = await Linking.canOpenURL(url);
				if (!canOpen) {
					Alert.alert("エラー", fallbackMessage);
					return;
				}
				await Linking.openURL(url);
			} catch (error) {
				console.error("openExternalUrl error:", error);
				Alert.alert("エラー", fallbackMessage);
			}
		},
		[],
	);

	const handleSearchThemeMusic = useCallback(async () => {
		const query = themeKeyword.trim();
		if (query.length < 2) {
			Alert.alert("入力不足", "2文字以上で検索してください");
			return;
		}

		setIsThemeSearching(true);
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();

			const { data, error } =
				await supabase.functions.invoke<ItunesSearchResponse>(
					ITUNES_SEARCH_FUNCTION_NAME,
					{
						headers: session?.access_token
							? { Authorization: `Bearer ${session.access_token}` }
							: undefined,
						body: {
							query,
							country: "JP",
							limit: 12,
						},
					},
				);

			if (error) {
				throw error;
			}

			const tracks = (data?.results ?? []).filter(
				(track): track is ItunesSearchTrack =>
					typeof track.trackId === "number" &&
					typeof track.trackName === "string" &&
					typeof track.artistName === "string" &&
					typeof track.previewUrl === "string" &&
					track.previewUrl.length > 0,
			);

			setThemeResults(tracks);
			if (tracks.length === 0) {
				Alert.alert("検索結果なし", "別のキーワードで再検索してください");
			}
		} catch (error) {
			console.error("handleSearchThemeMusic error:", error);
			const detail = await getEdgeFunctionErrorDetail(error);
			Alert.alert(
				"検索エラー",
				`曲の検索に失敗しました\nfunction=${ITUNES_SEARCH_FUNCTION_NAME}\n${detail}`,
			);
		} finally {
			setIsThemeSearching(false);
		}
	}, [themeKeyword]);

	const handleSelectThemeMusic = useCallback(
		async (track: ItunesSearchTrack) => {
			setIsThemeSaving(true);
			try {
				const updates = {
					theme_music_provider: "itunes",
					theme_music_track_id: track.trackId,
					theme_music_title: track.trackName,
					theme_music_artist: track.artistName,
					theme_music_preview_url: track.previewUrl,
					theme_music_artwork_url: track.artworkUrl100 ?? null,
					theme_music_track_view_url: track.trackViewUrl ?? null,
					theme_music_set_at: new Date().toISOString(),
				};

				const { error } = await supabase
					.from("trips")
					.update(updates)
					.eq("id", trip.id)
					.eq("status", "finished");

				if (error) {
					throw error;
				}

				setTrip((prev) => (prev ? { ...prev, ...updates } : prev));
				await fetchTrips();
				setIsThemeModalVisible(false);
				Alert.alert("設定完了", "テーマ音楽を設定しました");
			} catch (error) {
				console.error("handleSelectThemeMusic error:", error);
				Alert.alert(
					"保存エラー",
					`テーマ音楽の保存に失敗しました\n${getErrorMessage(error)}`,
				);
			} finally {
				setIsThemeSaving(false);
			}
		},
		[trip.id],
	);

	const handleClearThemeMusic = useCallback(() => {
		Alert.alert(
			"テーマ音楽を解除",
			"この旅行のテーマ音楽設定を解除しますか？",
			[
				{ text: "キャンセル", style: "cancel" },
				{
					text: "解除する",
					style: "destructive",
					onPress: async () => {
						setIsThemeSaving(true);
						try {
							const updates = {
								theme_music_provider: null,
								theme_music_track_id: null,
								theme_music_title: null,
								theme_music_artist: null,
								theme_music_preview_url: null,
								theme_music_artwork_url: null,
								theme_music_track_view_url: null,
								theme_music_set_at: null,
							};

							const { error } = await supabase
								.from("trips")
								.update(updates)
								.eq("id", trip.id)
								.eq("status", "finished");

							if (error) {
								throw error;
							}

							setTrip((prev) => (prev ? { ...prev, ...updates } : prev));
							await fetchTrips();
							Alert.alert("解除完了", "テーマ音楽を解除しました");
						} catch (error) {
							console.error("handleClearThemeMusic error:", error);
							Alert.alert(
								"解除エラー",
								`テーマ音楽の解除に失敗しました\n${getErrorMessage(error)}`,
							);
						} finally {
							setIsThemeSaving(false);
						}
					},
				},
			],
		);
	}, [trip.id]);

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
									<Ionicons name="sparkles" size={18} color="#2D9A5F" />
									<Text style={styles.highlightLaunchTitle}>
										全画面ハイライトを見る
									</Text>
								</View>
								<Ionicons name="expand" size={20} color="#2D9A5F" />
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

				{/* 完了済み旅行のテーマ音楽 */}
				{!isEditing && isThisTripFinished && (
					<View style={styles.field}>
						<Text style={styles.label}>テーマ音楽</Text>

						{trip.theme_music_title && trip.theme_music_preview_url ? (
							<View style={styles.themeCard}>
								<View style={styles.themeCardTop}>
									{trip.theme_music_artwork_url ? (
										<Image
											source={{ uri: trip.theme_music_artwork_url }}
											style={styles.themeArtwork}
										/>
									) : (
										<View style={styles.themeArtworkFallback}>
											<Ionicons
												name="musical-notes-outline"
												size={20}
												color={Colors.white}
											/>
										</View>
									)}
									<View style={styles.themeMeta}>
										<Text style={styles.themeTitle} numberOfLines={1}>
											{trip.theme_music_title}
										</Text>
										<Text style={styles.themeArtist} numberOfLines={1}>
											{trip.theme_music_artist ?? "アーティスト不明"}
										</Text>
									</View>
								</View>

								<View style={styles.themeActionRow}>
									<Pressable
										style={styles.themeActionButton}
										onPress={() => {
											void openExternalUrl(
												trip.theme_music_preview_url,
												"プレビューを開けませんでした",
											);
										}}
									>
										<Ionicons
											name="play-circle-outline"
											size={16}
											color={Colors.primary}
										/>
										<Text style={styles.themeActionButtonText}>試聴</Text>
									</Pressable>
									<Pressable
										style={styles.themeActionButton}
										onPress={() => {
											void openExternalUrl(
												trip.theme_music_track_view_url,
												"iTunesを開けませんでした",
											);
										}}
										disabled={!trip.theme_music_track_view_url}
									>
										<Ionicons
											name="open-outline"
											size={16}
											color={Colors.primary}
										/>
										<Text style={styles.themeActionButtonText}>
											iTunesで開く
										</Text>
									</Pressable>
								</View>

								<View style={styles.themeManageRow}>
									<Pressable
										style={styles.themeSecondaryButton}
										onPress={openThemeModal}
									>
										<Text style={styles.themeSecondaryButtonText}>変更</Text>
									</Pressable>
									<Pressable
										style={[
											styles.themeDangerButton,
											isThemeSaving && styles.themeButtonDisabled,
										]}
										onPress={handleClearThemeMusic}
										disabled={isThemeSaving}
									>
										<Text style={styles.themeDangerButtonText}>
											{isThemeSaving ? "処理中..." : "解除"}
										</Text>
									</Pressable>
								</View>

								<Text style={styles.themeAttribution}>
									provided courtesy of iTunes
								</Text>
							</View>
						) : (
							<Pressable style={styles.themeSetButton} onPress={openThemeModal}>
								<Ionicons
									name="search-outline"
									size={18}
									color={Colors.primary}
								/>
								<Text style={styles.themeSetButtonText}>
									曲を検索してテーマ音楽を設定
								</Text>
							</Pressable>
						)}
					</View>
				)}

				{!isEditing && isThisTripFinished && (
					<View style={styles.bottomShareWrap}>
						<Pressable
							style={[
								styles.bottomShareButton,
								(isSharingTrip || isPhotosLoading) &&
									styles.themeButtonDisabled,
							]}
							onPress={() => {
								void handleShareTripMemories();
							}}
							disabled={isSharingTrip || isPhotosLoading}
						>
							{isSharingTrip ? (
								<ActivityIndicator size="small" color={Colors.primary} />
							) : (
								<Ionicons
									name="share-social-outline"
									size={18}
									color={Colors.primary}
								/>
							)}
							<Text style={styles.bottomShareButtonText}>
								{isSharingTrip ? "共有中..." : "写真とテーマ音楽を友達に共有"}
							</Text>
						</Pressable>
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
					<Pressable style={styles.finishedButton} onPress={handleResume}>
						<Ionicons
							name="camera-outline"
							size={20}
							color={Colors.white}
							style={styles.startIcon}
						/>
						<Text style={styles.startButtonText}>完了済み旅行に写真を追加</Text>
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

			<Modal
				visible={isHighlightModalVisible || highlightModalReady}
				transparent
				animationType="none"
				onRequestClose={closeHighlightModal}
			>
				<View
					style={[
						styles.highlightModalOverlay,
						isCompactHighlight && styles.highlightModalOverlayCompact,
					]}
				>
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
							isCompactHighlight && styles.highlightModalBodyCompact,
							{
								opacity: highlightModalOpacity,
								transform: [
									{ scale: highlightModalScale },
									{ translateY: highlightModalTranslateY },
								],
							},
						]}
					>
						<ScrollView
							style={styles.highlightModalScroll}
							contentContainerStyle={[
								styles.highlightModalScrollContent,
								isCompactHighlight && styles.highlightModalScrollContentCompact,
							]}
							showsVerticalScrollIndicator={false}
							bounces={false}
						>
							<View style={styles.highlightModalHeader}>
								<Text style={styles.highlightModalTitle}>TRIP HIGHLIGHTS</Text>
								<Pressable
									onPress={closeHighlightModal}
									style={styles.highlightModalClose}
								>
									<Ionicons name="close" size={20} color="#1E6A3C" />
								</Pressable>
							</View>

							<View
								style={[
									styles.highlightMusicRow,
									isCompactHighlight && styles.highlightMusicRowCompact,
								]}
							>
								<View style={styles.highlightMusicMeta}>
									<Text style={styles.highlightMusicLabel}>Theme Music</Text>
									<Text style={styles.highlightMusicTitle} numberOfLines={1}>
										{trip.theme_music_title ?? "未設定"}
									</Text>
								</View>
								<Pressable
									style={[
										styles.highlightMusicButton,
										(!trip.theme_music_preview_url ||
											isHighlightMusicLoading) &&
											styles.themeButtonDisabled,
									]}
									onPress={() => {
										void toggleHighlightThemeMusic();
									}}
									disabled={
										!trip.theme_music_preview_url || isHighlightMusicLoading
									}
								>
									{isHighlightMusicLoading ? (
										<ActivityIndicator size="small" color={Colors.white} />
									) : (
										<Ionicons
											name={
												isHighlightMusicPlaying
													? "pause-circle-outline"
													: "play-circle-outline"
											}
											size={18}
											color={Colors.white}
										/>
									)}
									<Text style={styles.highlightMusicButtonText}>
										{isHighlightMusicPlaying ? "一時停止" : "再生"}
									</Text>
								</Pressable>
							</View>
							{highlightMusicError ? (
								<Text style={styles.highlightMusicError} numberOfLines={2}>
									{highlightMusicError}
								</Text>
							) : null}

							{tripPhotos.length > 0 ? (
								<>
									<View
										style={[
											styles.highlightStageWrap,
											{ height: highlightStageHeight },
											isCompactHighlight && styles.highlightStageWrapCompact,
										]}
									>
										<Pressable
											onPress={() => moveHighlight(-1)}
											style={[
												styles.highlightStageNavLeft,
												isCompactHighlight && styles.highlightStageNavCompact,
											]}
											hitSlop={10}
										>
											<Ionicons
												name="chevron-back"
												size={isCompactHighlight ? 24 : 28}
												color="#1E6A3C"
											/>
										</Pressable>
										<Animated.View
											style={[
												styles.highlightStageCard,
												isCompactHighlight && styles.highlightStageCardCompact,
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
											style={[
												styles.highlightStageNavRight,
												isCompactHighlight && styles.highlightStageNavCompact,
											]}
											hitSlop={10}
										>
											<Ionicons
												name="chevron-forward"
												size={isCompactHighlight ? 24 : 28}
												color="#1E6A3C"
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
						</ScrollView>
					</Animated.View>
				</View>
			</Modal>

			<Modal
				visible={isThemeModalVisible}
				transparent
				animationType="slide"
				onRequestClose={() => setIsThemeModalVisible(false)}
			>
				<View style={styles.themeModalOverlay}>
					<View style={styles.themeModalBody}>
						<View style={styles.themeModalHeader}>
							<Text style={styles.themeModalTitle}>テーマ音楽を選択</Text>
							<Pressable
								onPress={() => setIsThemeModalVisible(false)}
								style={styles.themeModalClose}
							>
								<Ionicons name="close" size={20} color={Colors.gray} />
							</Pressable>
						</View>
						<Text style={styles.themeModalCaption}>
							曲名やアーティスト名で検索して設定できます
						</Text>

						<View style={styles.themeSearchRow}>
							<TextInput
								style={styles.themeSearchInput}
								placeholder="例: Lemon 米津玄師"
								placeholderTextColor={Colors.grayLight}
								value={themeKeyword}
								onChangeText={setThemeKeyword}
								returnKeyType="search"
								onSubmitEditing={() => {
									void handleSearchThemeMusic();
								}}
							/>
							<Pressable
								style={[
									styles.themeSearchButton,
									(isThemeSearching || isThemeSaving) &&
										styles.themeButtonDisabled,
								]}
								onPress={() => {
									void handleSearchThemeMusic();
								}}
								disabled={isThemeSearching || isThemeSaving}
							>
								{isThemeSearching ? (
									<ActivityIndicator size="small" color={Colors.white} />
								) : (
									<Ionicons name="search" size={16} color={Colors.white} />
								)}
							</Pressable>
						</View>

						<ScrollView
							style={styles.themeResultList}
							contentContainerStyle={styles.themeResultContent}
							keyboardShouldPersistTaps="handled"
							showsVerticalScrollIndicator={false}
						>
							{themeResults.length === 0 && !isThemeSearching ? (
								<View style={styles.themeEmptyBox}>
									<Ionicons
										name="musical-notes-outline"
										size={22}
										color={Colors.grayLight}
									/>
									<Text style={styles.themeEmptyText}>
										キーワードを入力して曲を検索してください
									</Text>
								</View>
							) : (
								themeResults.map((track) => (
									<View key={track.trackId} style={styles.themeResultItem}>
										{track.artworkUrl100 ? (
											<Image
												source={{ uri: track.artworkUrl100 }}
												style={styles.themeResultArtwork}
											/>
										) : (
											<View style={styles.themeResultArtworkFallback}>
												<Ionicons
													name="musical-note-outline"
													size={18}
													color={Colors.gray}
												/>
											</View>
										)}
										<View style={styles.themeResultMeta}>
											<Text style={styles.themeResultTitle} numberOfLines={1}>
												{track.trackName}
											</Text>
											<Text style={styles.themeResultArtist} numberOfLines={1}>
												{track.artistName}
											</Text>
										</View>
										<Pressable
											style={styles.themeMiniButton}
											onPress={() => {
												void openExternalUrl(
													track.previewUrl,
													"プレビューを開けませんでした",
												);
											}}
										>
											<Text style={styles.themeMiniButtonText}>試聴</Text>
										</Pressable>
										<Pressable
											style={[
												styles.themePickButton,
												isThemeSaving && styles.themeButtonDisabled,
											]}
											onPress={() => {
												void handleSelectThemeMusic(track);
											}}
											disabled={isThemeSaving}
										>
											<Text style={styles.themePickButtonText}>
												{isThemeSaving ? "保存中..." : "設定"}
											</Text>
										</Pressable>
									</View>
								))
							)}
						</ScrollView>
					</View>
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
		backgroundColor: "#F6FFF9",
		borderWidth: 1,
		borderColor: "#79C79A",
	},
	highlightLaunchLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	highlightLaunchTitle: {
		color: "#1E6A3C",
		fontSize: 15,
		fontWeight: "700",
		letterSpacing: 0.2,
	},
	highlightModalOverlay: {
		flex: 1,
		backgroundColor: "rgba(30, 106, 60, 0.14)",
		paddingHorizontal: 16,
		paddingVertical: 36,
		justifyContent: "center",
	},
	highlightModalOverlayCompact: {
		paddingHorizontal: 10,
		paddingVertical: 14,
	},
	highlightAuraPrimary: {
		position: "absolute",
		width: 320,
		height: 320,
		borderRadius: 160,
		backgroundColor: "rgba(93, 201, 140, 0.28)",
		top: 40,
		left: -80,
	},
	highlightAuraSecondary: {
		position: "absolute",
		width: 280,
		height: 280,
		borderRadius: 140,
		backgroundColor: "rgba(175, 236, 201, 0.34)",
		bottom: 70,
		right: -60,
	},
	highlightModalBody: {
		borderRadius: 24,
		padding: 16,
		gap: 10,
		backgroundColor: "rgba(255, 255, 255, 0.97)",
		borderWidth: 1,
		borderColor: "rgba(122, 196, 153, 0.8)",
		shadowColor: "#246D44",
		shadowOffset: { width: 0, height: 16 },
		shadowOpacity: 0.22,
		shadowRadius: 28,
		elevation: 18,
		maxHeight: "94%",
	},
	highlightModalBodyCompact: {
		padding: 12,
		borderRadius: 20,
	},
	highlightModalScroll: {
		flexGrow: 0,
	},
	highlightModalScrollContent: {
		paddingBottom: 2,
	},
	highlightModalScrollContentCompact: {
		paddingBottom: 8,
	},
	highlightModalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	highlightModalTitle: {
		fontSize: 15,
		fontWeight: "800",
		color: "#1E6A3C",
		letterSpacing: 1.1,
	},
	highlightModalClose: {
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: "#E9F8EE",
		borderWidth: 1,
		borderColor: "#B7E4C8",
		alignItems: "center",
		justifyContent: "center",
	},
	highlightMusicRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: "#F4FCF7",
		borderWidth: 1,
		borderColor: "#D3EEDC",
		borderRadius: 12,
		paddingHorizontal: 10,
		paddingVertical: 8,
	},
	highlightMusicRowCompact: {
		paddingHorizontal: 8,
		paddingVertical: 7,
	},
	highlightMusicMeta: {
		flex: 1,
	},
	highlightMusicLabel: {
		fontSize: 11,
		color: "#5F9A79",
		letterSpacing: 0.8,
		textTransform: "uppercase",
	},
	highlightMusicTitle: {
		marginTop: 2,
		fontSize: 14,
		fontWeight: "700",
		color: "#144B2C",
	},
	highlightMusicButton: {
		minWidth: 92,
		height: 36,
		borderRadius: 18,
		paddingHorizontal: 12,
		backgroundColor: "#2D9A5F",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 5,
	},
	highlightMusicButtonText: {
		fontSize: 12,
		fontWeight: "700",
		color: Colors.white,
	},
	highlightMusicError: {
		fontSize: 12,
		color: "#BA4A4A",
	},
	highlightStageWrap: {
		height: 430,
		justifyContent: "center",
		alignItems: "center",
	},
	highlightStageWrapCompact: {
		marginTop: 2,
	},
	highlightStageNavCompact: {
		width: 34,
		height: 34,
		marginTop: -17,
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
		backgroundColor: "#F8FFF9",
		borderWidth: 1,
		borderColor: "#BFE4CD",
	},
	highlightStageCardCompact: {
		width: "90%",
	},
	highlightStageImage: {
		width: "100%",
		height: "100%",
	},
	highlightStagePlaceholder: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#EAF7EF",
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
		color: "#1E6A3C",
	},
	highlightMetaDate: {
		fontSize: 13,
		color: "#4A7B61",
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
		borderColor: "#2D9A5F",
	},
	highlightThumbImage: {
		width: "100%",
		height: "100%",
	},
	highlightThumbFallback: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "#EAF7EF",
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
		color: "#3E6E55",
	},
	themeCard: {
		borderRadius: 14,
		padding: 12,
		borderWidth: 1,
		borderColor: Colors.grayLight,
		backgroundColor: "#F8FAFC",
		gap: 10,
	},
	themeCardTop: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	themeArtwork: {
		width: 52,
		height: 52,
		borderRadius: 10,
	},
	themeArtworkFallback: {
		width: 52,
		height: 52,
		borderRadius: 10,
		backgroundColor: Colors.primary,
		alignItems: "center",
		justifyContent: "center",
	},
	themeMeta: {
		flex: 1,
		gap: 2,
	},
	themeTitle: {
		fontSize: 15,
		fontWeight: "700",
		color: Colors.black,
	},
	themeArtist: {
		fontSize: 13,
		color: Colors.gray,
	},
	themeActionRow: {
		flexDirection: "row",
		gap: 8,
	},
	themeActionButton: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		borderWidth: 1,
		borderColor: Colors.primary,
		borderRadius: 10,
		paddingVertical: 9,
	},
	themeActionButtonText: {
		fontSize: 13,
		fontWeight: "600",
		color: Colors.primary,
	},
	themeManageRow: {
		flexDirection: "row",
		gap: 8,
	},
	themeSecondaryButton: {
		flex: 1,
		borderRadius: 10,
		paddingVertical: 9,
		alignItems: "center",
		backgroundColor: Colors.white,
		borderWidth: 1,
		borderColor: Colors.grayLight,
	},
	themeSecondaryButtonText: {
		color: Colors.black,
		fontWeight: "600",
		fontSize: 13,
	},
	themeDangerButton: {
		flex: 1,
		borderRadius: 10,
		paddingVertical: 9,
		alignItems: "center",
		backgroundColor: "#FDECEC",
		borderWidth: 1,
		borderColor: "#F2B6B6",
	},
	themeDangerButtonText: {
		color: Colors.danger,
		fontWeight: "600",
		fontSize: 13,
	},
	themeAttribution: {
		fontSize: 11,
		color: Colors.gray,
	},
	themeSetButton: {
		borderRadius: 12,
		borderWidth: 1,
		borderColor: Colors.primary,
		borderStyle: "dashed",
		paddingVertical: 14,
		paddingHorizontal: 12,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
	},
	themeSetButtonText: {
		fontSize: 14,
		fontWeight: "600",
		color: Colors.primary,
	},
	themeButtonDisabled: {
		opacity: 0.5,
	},
	themeModalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.45)",
		justifyContent: "center",
		padding: 16,
	},
	themeModalBody: {
		backgroundColor: Colors.white,
		borderRadius: 16,
		padding: 16,
		maxHeight: "82%",
	},
	themeModalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	themeModalTitle: {
		fontSize: 17,
		fontWeight: "700",
		color: Colors.black,
	},
	themeModalClose: {
		padding: 4,
	},
	themeModalCaption: {
		fontSize: 12,
		color: Colors.gray,
		marginTop: 4,
		marginBottom: 12,
	},
	themeSearchRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	themeSearchInput: {
		flex: 1,
		borderWidth: 1,
		borderColor: Colors.grayLight,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 14,
		color: Colors.black,
	},
	themeSearchButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: Colors.primary,
		alignItems: "center",
		justifyContent: "center",
	},
	themeResultList: {
		marginTop: 12,
	},
	themeResultContent: {
		paddingBottom: 6,
		gap: 10,
	},
	themeEmptyBox: {
		borderWidth: 1,
		borderColor: Colors.grayLight,
		borderStyle: "dashed",
		borderRadius: 12,
		paddingVertical: 18,
		paddingHorizontal: 12,
		alignItems: "center",
		gap: 6,
	},
	themeEmptyText: {
		fontSize: 13,
		color: Colors.gray,
	},
	themeResultItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		padding: 10,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: Colors.grayLighter,
		backgroundColor: Colors.white,
	},
	themeResultArtwork: {
		width: 46,
		height: 46,
		borderRadius: 8,
	},
	themeResultArtworkFallback: {
		width: 46,
		height: 46,
		borderRadius: 8,
		backgroundColor: Colors.grayLighter,
		alignItems: "center",
		justifyContent: "center",
	},
	themeResultMeta: {
		flex: 1,
		gap: 2,
	},
	themeResultTitle: {
		fontSize: 14,
		fontWeight: "600",
		color: Colors.black,
	},
	themeResultArtist: {
		fontSize: 12,
		color: Colors.gray,
	},
	themeMiniButton: {
		borderRadius: 8,
		paddingVertical: 7,
		paddingHorizontal: 10,
		borderWidth: 1,
		borderColor: Colors.primary,
	},
	themeMiniButtonText: {
		fontSize: 12,
		fontWeight: "600",
		color: Colors.primary,
	},
	themePickButton: {
		borderRadius: 8,
		paddingVertical: 7,
		paddingHorizontal: 10,
		backgroundColor: Colors.primary,
	},
	themePickButtonText: {
		fontSize: 12,
		fontWeight: "700",
		color: Colors.white,
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
	bottomShareWrap: {
		marginBottom: 8,
	},
	bottomShareButton: {
		height: 48,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: Colors.primary,
		backgroundColor: Colors.white,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
	},
	bottomShareButtonText: {
		fontSize: 14,
		fontWeight: "700",
		color: Colors.primary,
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
