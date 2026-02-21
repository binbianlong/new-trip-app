import { Ionicons } from "@expo/vector-icons";
import { File as ExpoFile } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Animated,
	Dimensions,
	type FlatList,
	Image,
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../src/constants/colors";
import { supabase } from "../../src/lib/supabase";
import { fetchTrips, updateTripStatus } from "../../src/store/tripStore";
import type { Photo, Trip, User } from "../../src/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.52;
const CARD_SPACING = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_SPACING;
const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

const JAPAN_REGION: Region = {
	latitude: 36.5,
	longitude: 137.0,
	latitudeDelta: 14,
	longitudeDelta: 14,
};

export default function ActiveTripScreen() {
	const { tripId } = useLocalSearchParams<{ tripId: string }>();
	const router = useRouter();
	const mapRef = useRef<MapView>(null);

	const [trip, setTrip] = useState<Trip | null>(null);
	const [participants, setParticipants] = useState<User[]>([]);
	const [photos, setPhotos] = useState<Photo[]>([]);
	const [loading, setLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [focusedPhotoId, setFocusedPhotoId] = useState<number | null>(null);
	const photoListRef = useRef<FlatList<Photo>>(null);
	const scrollX = useRef(new Animated.Value(0)).current;

	// --- データ取得（Supabase） ---
	const fetchTripData = useCallback(async () => {
		if (!tripId) return;

		try {
			const [tripResult, membersResult, photosResult] = await Promise.all([
				supabase.from("trips").select("*").eq("id", tripId).single(),
				supabase
					.from("trip_members")
					.select("user_id")
					.eq("trip_id", tripId)
					.is("deleted_at", null),
				supabase
					.from("photos")
					.select("*")
					.eq("trip_id", tripId)
					.order("created_at", { ascending: true }),
			]);

			if (tripResult.data) {
				setTrip(tripResult.data);
			}

			if (photosResult.error) {
				console.error("Photos fetch error:", photosResult.error);
			}
			console.log(
				"Photos fetched:",
				photosResult.data?.length ?? 0,
				"items",
				JSON.stringify(
					photosResult.data?.map((p) => ({
						id: p.id,
						lat: p.lat,
						lng: p.lng,
						image_url: p.image_url?.substring(0, 60),
					})),
				),
			);
			setPhotos(photosResult.data ?? []);

			const memberUserIds = (membersResult.data ?? [])
				.map((m) => m.user_id)
				.filter((id): id is string => id != null);
			const userIds = [
				...new Set(
					[...memberUserIds, tripResult.data?.owner_user_id].filter(
						(id): id is string => id != null,
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
							profile_name:
								userId === tripResult.data?.owner_user_id ? "作成者" : "未設定",
							email: null,
							avatar_url: null,
							created_at: null,
							updated_at: null,
							deleted_at: null,
						},
				);
				setParticipants(resolvedUsers);
			}
		} catch (error) {
			console.error("fetchTripData error:", error);
		} finally {
			setLoading(false);
		}
	}, [tripId]);

	useEffect(() => {
		fetchTripData();
	}, [fetchTripData]);

	// --- データ保存 ---
	const savePhoto = useCallback(
		async (imageUri: string, lat: number, lng: number) => {
			if (!tripId) return;

			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				Alert.alert(
					"ログインが必要です",
					"写真を保存するにはログインしてください",
				);
				return;
			}

			const fileName = `${tripId}/${Date.now()}.jpg`;

			const file = new ExpoFile(imageUri);
			const arrayBuffer = await file.arrayBuffer();

			const { error: uploadError } = await supabase.storage
				.from("photos")
				.upload(fileName, arrayBuffer, {
					contentType: "image/jpeg",
					upsert: false,
				});

			if (uploadError) {
				console.error("Storage upload error:", uploadError);
				Alert.alert(
					"アップロードエラー",
					`写真のアップロードに失敗しました\n${uploadError.message}`,
				);
				return;
			}

			const { data: urlData } = supabase.storage
				.from("photos")
				.getPublicUrl(fileName);

			const { error: insertError } = await supabase.from("photos").insert({
				trip_id: tripId,
				user_id: user.id,
				image_url: urlData.publicUrl,
				lat,
				lng,
			});

			if (insertError) {
				console.error("Photos insert error:", insertError);
				Alert.alert(
					"保存エラー",
					`写真データの保存に失敗しました\n${insertError.message}`,
				);
				return;
			}

			await fetchTripData();

			mapRef.current?.animateToRegion(
				{
					latitude: lat,
					longitude: lng,
					latitudeDelta: 0.005,
					longitudeDelta: 0.005,
				},
				500,
			);
		},
		[tripId, fetchTripData],
	);

	// --- カメラ撮影 ---
	const handleTakePhoto = useCallback(async () => {
		try {
			const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
			if (!cameraPerm.granted) {
				Alert.alert("権限エラー", "カメラの使用を許可してください");
				return;
			}

			const locationPerm = await Location.requestForegroundPermissionsAsync();
			if (!locationPerm.granted) {
				Alert.alert("権限エラー", "位置情報の使用を許可してください");
				return;
			}

			const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
			if (result.canceled) return;

			const imageUri = result.assets[0].uri;

			const location = await Location.getCurrentPositionAsync({
				accuracy: Location.Accuracy.High,
			});
			const { latitude, longitude } = location.coords;

			setIsSaving(true);
			try {
				await savePhoto(imageUri, latitude, longitude);
			} finally {
				setIsSaving(false);
			}
		} catch (error) {
			console.error("handleTakePhoto error:", error);
			Alert.alert(
				"エラー",
				"写真の撮影・保存中にエラーが発生しました。もう一度お試しください。",
			);
			setIsSaving(false);
		}
	}, [savePhoto]);

	// --- 旅行終了 ---
	const handleEndTrip = useCallback(() => {
		Alert.alert("旅行終了", "旅行を終了しますか？", [
			{ text: "キャンセル", style: "cancel" },
			{
				text: "終了する",
				style: "destructive",
				onPress: async () => {
					const { error } = await supabase
						.from("trips")
						.update({ status: "finished" })
						.eq("id", tripId);

					if (error) {
						console.error("Trip status update failed:", error);
						Alert.alert("エラー", `旅行の終了に失敗しました\n${error.message}`);
						return;
					}

					if (tripId) {
						updateTripStatus(tripId, "finished");
					}
					await fetchTrips();
					router.back();
				},
			},
		]);
	}, [tripId, router]);

	const onViewableItemsChanged = useCallback(
		({ viewableItems }: { viewableItems: Array<{ item: Photo }> }) => {
			if (viewableItems.length === 0) return;
			const centerItem = viewableItems[Math.floor(viewableItems.length / 2)];
			if (!centerItem) return;
			const photo = centerItem.item;
			setFocusedPhotoId(photo.id);
			if (photo.lat != null && photo.lng != null) {
				mapRef.current?.animateToRegion(
					{
						latitude: photo.lat,
						longitude: photo.lng,
						latitudeDelta: 0.005,
						longitudeDelta: 0.005,
					},
					300,
				);
			}
		},
		[],
	);

	const viewabilityConfig = useMemo(
		() => ({ itemVisiblePercentThreshold: 60 }),
		[],
	);

	const renderPhotoCard = useCallback(
		({ item, index }: { item: Photo; index: number }) => {
			const inputRange = [
				(index - 1) * SNAP_INTERVAL,
				index * SNAP_INTERVAL,
				(index + 1) * SNAP_INTERVAL,
			];
			const scale = scrollX.interpolate({
				inputRange,
				outputRange: [0.78, 1, 0.78],
				extrapolate: "clamp",
			});
			const opacity = scrollX.interpolate({
				inputRange,
				outputRange: [0.35, 1, 0.35],
				extrapolate: "clamp",
			});
			const rotateY = scrollX.interpolate({
				inputRange,
				outputRange: ["25deg", "0deg", "-25deg"],
				extrapolate: "clamp",
			});
			const translateY = scrollX.interpolate({
				inputRange,
				outputRange: [18, -6, 18],
				extrapolate: "clamp",
			});
			const translateX = scrollX.interpolate({
				inputRange,
				outputRange: [20, 0, -20],
				extrapolate: "clamp",
			});
			return (
				<Animated.View
					style={{
						width: CARD_WIDTH,
						transform: [
							{ perspective: 600 },
							{ scale },
							{ rotateY },
							{ translateY },
							{ translateX },
						],
						opacity,
					}}
				>
					<TouchableOpacity
						style={styles.photoCard}
						onPress={() => {
							const idx = photos.findIndex((p) => p.id === item.id);
							if (idx >= 0) {
								photoListRef.current?.scrollToIndex({
									index: idx,
									animated: true,
									viewPosition: 0.5,
								});
							}
						}}
						activeOpacity={0.9}
					>
						<View style={styles.photoCardImage}>
							{item.image_url ? (
								<Image
									source={{ uri: item.image_url }}
									style={styles.photoCardImageFull}
								/>
							) : (
								<View style={styles.photoCardPlaceholder}>
									<Ionicons
										name="image-outline"
										size={32}
										color={Colors.grayLight}
									/>
								</View>
							)}
						</View>
						{item.created_at && (
							<Text style={styles.photoCardDate} numberOfLines={1}>
								{new Date(item.created_at).toLocaleString("ja-JP", {
									month: "short",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</Text>
						)}
					</TouchableOpacity>
				</Animated.View>
			);
		},
		[scrollX, photos],
	);

	if (loading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color={Colors.primary} />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			{/* 地図（全面表示） */}
			<MapView
				ref={mapRef}
				style={StyleSheet.absoluteFillObject}
				initialRegion={JAPAN_REGION}
				showsUserLocation
				followsUserLocation
			>
				{/* 撮影済み写真のピン */}
				{photos
					.filter((p) => p.lat != null && p.lng != null)
					.map((photo) => (
						<Marker
							key={photo.id}
							coordinate={{
								latitude: photo.lat as number,
								longitude: photo.lng as number,
							}}
						>
							<View style={styles.photoPin}>
								{photo.image_url ? (
									<Image
										source={{ uri: photo.image_url }}
										style={styles.photoPinImage}
									/>
								) : (
									<Ionicons name="camera" size={14} color={Colors.white} />
								)}
							</View>
						</Marker>
					))}
			</MapView>

			{/* 上部オーバーレイ（戻るボタン + トリップ情報カード） */}
			<SafeAreaView style={styles.overlay} pointerEvents="box-none">
				<Pressable style={styles.backButton} onPress={() => router.back()}>
					<Ionicons name="arrow-back" size={24} color={Colors.black} />
				</Pressable>

				{trip && (
					<View style={styles.tripCard}>
						<Text style={styles.tripTitle}>{trip.title}</Text>
						<Text style={styles.tripDate}>
							{trip.start_date ? `${trip.start_date}〜` : ""}
						</Text>
						{participants.length > 0 && (
							<View style={styles.avatarRow}>
								{participants.map((user) =>
									user.avatar_url ? (
										<Image
											key={user.id}
											source={{ uri: user.avatar_url }}
											style={styles.avatar}
										/>
									) : (
										<View
											key={user.id}
											style={[styles.avatar, styles.avatarFallback]}
										>
											<Text style={styles.avatarInitial}>
												{user.profile_name?.charAt(0) ?? "?"}
											</Text>
										</View>
									),
								)}
							</View>
						)}
					</View>
				)}
			</SafeAreaView>

			{/* 写真カード一覧 */}
			{photos.length > 0 && (
				<View style={styles.photoPanel}>
					<Animated.FlatList
						ref={photoListRef}
						data={photos}
						keyExtractor={(item) => String(item.id)}
						renderItem={renderPhotoCard}
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.photoList}
						ItemSeparatorComponent={() => (
							<View style={styles.photoSeparator} />
						)}
						snapToInterval={SNAP_INTERVAL}
						decelerationRate="fast"
						onScroll={Animated.event(
							[{ nativeEvent: { contentOffset: { x: scrollX } } }],
							{ useNativeDriver: true },
						)}
						scrollEventThrottle={16}
						onViewableItemsChanged={onViewableItemsChanged}
						viewabilityConfig={viewabilityConfig}
						getItemLayout={(_, index) => ({
							length: SNAP_INTERVAL,
							offset: SNAP_INTERVAL * index,
							index,
						})}
					/>
				</View>
			)}

			{/* 下部フローティングボタン */}
			<View style={styles.bottomActions}>
				<Pressable style={styles.endButton} onPress={handleEndTrip}>
					<Text style={styles.endButtonText}>終了</Text>
				</Pressable>

				<Pressable
					style={[styles.cameraButton, isSaving && styles.buttonDisabled]}
					onPress={handleTakePhoto}
					disabled={isSaving}
				>
					{isSaving ? (
						<ActivityIndicator size="small" color={Colors.black} />
					) : (
						<Ionicons name="camera-outline" size={36} color={Colors.black} />
					)}
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.background,
	},

	/* 上部オーバーレイ */
	overlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
	},
	backButton: {
		marginLeft: 16,
		marginTop: 8,
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: Colors.white,
		justifyContent: "center",
		alignItems: "center",
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 4,
		elevation: 4,
	},

	/* トリップ情報カード */
	tripCard: {
		marginHorizontal: 16,
		marginTop: 12,
		backgroundColor: Colors.white,
		borderRadius: 16,
		padding: 16,
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 4,
		borderWidth: 1,
		borderColor: Colors.grayLighter,
	},
	tripTitle: {
		fontSize: 20,
		fontWeight: "bold",
		color: Colors.black,
	},
	tripDate: {
		fontSize: 14,
		color: Colors.gray,
		marginTop: 4,
	},
	avatarRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		marginTop: 12,
	},
	avatar: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: Colors.grayLight,
	},
	avatarFallback: {
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.primary,
	},
	avatarInitial: {
		color: Colors.white,
		fontSize: 14,
		fontWeight: "bold",
	},

	/* 下部アクションボタン */
	bottomActions: {
		position: "absolute",
		bottom: 56,
		left: 0,
		right: 0,
		flexDirection: "row",
		justifyContent: "center",
		gap: 48,
	},
	endButton: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: "#E8F5E9",
		justifyContent: "center",
		alignItems: "center",
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 6,
		elevation: 4,
	},
	endButtonText: {
		fontSize: 18,
		fontWeight: "bold",
		color: Colors.black,
	},
	cameraButton: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: "#E8F5E9",
		justifyContent: "center",
		alignItems: "center",
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 6,
		elevation: 4,
	},
	buttonDisabled: {
		opacity: 0.5,
	},

	/* 写真カード一覧 */
	photoPanel: {
		position: "absolute",
		bottom: 160,
		left: 0,
		right: 0,
		backgroundColor: "transparent",
	},
	photoList: {
		paddingHorizontal: SIDE_PADDING,
		alignItems: "center" as const,
	},
	photoSeparator: {
		width: CARD_SPACING,
	},
	photoCard: {
		width: CARD_WIDTH,
		borderRadius: 18,
		backgroundColor: Colors.white,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 14 },
		shadowOpacity: 0.4,
		shadowRadius: 24,
		elevation: 16,
		borderWidth: 0.5,
		borderColor: "rgba(255,255,255,0.5)",
	},
	photoCardImage: {
		width: "100%",
		height: CARD_WIDTH * 0.78,
		borderTopLeftRadius: 18,
		borderTopRightRadius: 18,
		overflow: "hidden" as const,
	},
	photoCardImageFull: {
		width: "100%",
		height: "100%",
	},
	photoCardPlaceholder: {
		width: "100%",
		height: "100%",
		justifyContent: "center" as const,
		alignItems: "center" as const,
		backgroundColor: Colors.grayLighter,
	},
	photoCardDate: {
		fontSize: 12,
		fontWeight: "600" as const,
		color: Colors.gray,
		paddingHorizontal: 12,
		paddingVertical: 8,
		textAlign: "center" as const,
		letterSpacing: 0.3,
	},

	/* 写真ピン */
	photoPin: {
		width: 52,
		height: 52,
		borderRadius: 26,
		overflow: "hidden",
		borderWidth: 3,
		borderColor: Colors.white,
		backgroundColor: Colors.gray,
		justifyContent: "center",
		alignItems: "center",
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 4,
	},
	photoPinImage: {
		width: 46,
		height: 46,
		borderRadius: 23,
	},
});
