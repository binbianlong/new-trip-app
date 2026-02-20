import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Image,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../src/constants/colors";
import { mockTripMembers, mockTrips, mockUsers } from "../../src/data/mock";
import { supabase } from "../../src/lib/supabase";
import { updateTripStatus } from "../../src/store/tripStore";
import type { Photo, Trip, User } from "../../src/types";

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

	// --- データ取得（Supabase → モックデータのフォールバック） ---
	const fetchTripData = useCallback(async () => {
		if (!tripId) return;

		try {
			const [tripResult, membersResult, photosResult] = await Promise.all([
				supabase.from("trips").select("*").eq("id", tripId).single(),
				supabase.from("trip_members").select("user_id").eq("trip_id", tripId),
				supabase
					.from("photos")
					.select("*")
					.eq("trip_id", tripId)
					.is("deleted_at", null)
					.order("created_at", { ascending: true }),
			]);

			if (tripResult.data) {
				setTrip(tripResult.data);
				setPhotos(photosResult.data ?? []);

				const userIds = (membersResult.data ?? [])
					.map((m) => m.user_id)
					.filter((id): id is string => id != null);

				if (userIds.length > 0) {
					const { data: users } = await supabase
						.from("users")
						.select("*")
						.in("id", userIds);
					setParticipants(users ?? []);
				}
			} else {
				// Supabase にデータがない場合はモックデータにフォールバック
				const mockTrip = mockTrips.find((t) => t.id === tripId);
				if (mockTrip) {
					setTrip({ ...mockTrip, status: "started" });
					const mockParticipants = mockTripMembers
						.filter((m) => m.trip_id === tripId)
						.map((m) => mockUsers.find((u) => u.id === m.user_id))
						.filter((u): u is User => u != null);
					setParticipants(mockParticipants);
				}
			}
		} catch {
			// ネットワークエラー時もモックデータにフォールバック
			const mockTrip = mockTrips.find((t) => t.id === tripId);
			if (mockTrip) {
				setTrip({ ...mockTrip, status: "started" });
				const mockParticipants = mockTripMembers
					.filter((m) => m.trip_id === tripId)
					.map((m) => mockUsers.find((u) => u.id === m.user_id))
					.filter((u): u is User => u != null);
				setParticipants(mockParticipants);
			}
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
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user || !tripId) return;

			const fileName = `${tripId}/${Date.now()}.jpg`;

			const formData = new FormData();
			formData.append("file", {
				uri: imageUri,
				type: "image/jpeg",
				name: fileName,
			} as unknown as Blob);

			const { error: uploadError } = await supabase.storage
				.from("photos")
				.upload(fileName, formData);

			if (uploadError) {
				Alert.alert("エラー", "写真のアップロードに失敗しました");
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
				Alert.alert("エラー", "写真データの保存に失敗しました");
				return;
			}

			await fetchTripData();
		},
		[tripId, fetchTripData],
	);

	// --- カメラ撮影 ---
	const handleTakePhoto = useCallback(async () => {
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
	}, [savePhoto]);

	// --- 旅行終了 ---
	const handleEndTrip = useCallback(() => {
		Alert.alert("旅行終了", "旅行を終了しますか？", [
			{ text: "キャンセル", style: "cancel" },
			{
				text: "終了する",
				style: "destructive",
				onPress: async () => {
					// ストアのステータスを更新
					if (tripId) {
						updateTripStatus(tripId, "finished");
					}

					// DB も更新を試行
					const { error } = await supabase
						.from("trips")
						.update({ status: "finished" })
						.eq("id", tripId);

					if (error) {
						console.warn("Trip status update failed:", error.message);
					}

					router.back();
				},
			},
		]);
	}, [tripId, router]);

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

	/* 写真ピン */
	photoPin: {
		width: 34,
		height: 34,
		borderRadius: 17,
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
		width: 28,
		height: 28,
		borderRadius: 14,
	},
});
