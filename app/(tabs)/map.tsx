import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Dimensions,
	FlatList,
	Image,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { Colors } from "../../src/constants/colors";
import { supabase } from "../../src/lib/supabase";
import type { Photo, Trip } from "../../src/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PHOTO_CARD_WIDTH = SCREEN_WIDTH * 0.4;

const JAPAN_REGION: Region = {
	latitude: 36.5,
	longitude: 137.0,
	latitudeDelta: 14,
	longitudeDelta: 14,
};

const TRIP_COLORS = [
	"#4A90D9",
	"#E74C3C",
	"#2ECC71",
	"#F39C12",
	"#9B59B6",
	"#1ABC9C",
	"#E67E22",
	"#3498DB",
];

function getTripColor(index: number): string {
	return TRIP_COLORS[index % TRIP_COLORS.length];
}

/** 写真群の中心座標を算出 */
function getCenterOfPhotos(
	photos: Photo[],
): { latitude: number; longitude: number } | null {
	const valid = photos.filter((p) => p.lat != null && p.lng != null);
	if (valid.length === 0) return null;
	const sumLat = valid.reduce((s, p) => s + (p.lat as number), 0);
	const sumLng = valid.reduce((s, p) => s + (p.lng as number), 0);
	return {
		latitude: sumLat / valid.length,
		longitude: sumLng / valid.length,
	};
}

export default function MapScreen() {
	const mapRef = useRef<MapView>(null);
	const photoListRef = useRef<FlatList<Photo>>(null);

	const [trips, setTrips] = useState<Trip[]>([]);
	const [photos, setPhotos] = useState<Photo[]>([]);
	const [loading, setLoading] = useState(true);

	const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
	const [focusedPhotoId, setFocusedPhotoId] = useState<number | null>(null);

	const tripColorMap = useMemo(() => {
		const map: Record<string, string> = {};
		for (let i = 0; i < trips.length; i++) {
			map[trips[i].id] = getTripColor(i);
		}
		return map;
	}, [trips]);

	/** 旅行ごとの写真 */
	const photosByTrip = useMemo(() => {
		const map: Record<string, Photo[]> = {};
		for (const p of photos) {
			if (!p.trip_id) continue;
			if (!map[p.trip_id]) map[p.trip_id] = [];
			map[p.trip_id].push(p);
		}
		return map;
	}, [photos]);

	/** 旅行ごとの代表座標（写真の中心） */
	const tripPositions = useMemo(() => {
		const map: Record<string, { latitude: number; longitude: number }> = {};
		for (const [tripId, tripPhotos] of Object.entries(photosByTrip)) {
			const center = getCenterOfPhotos(tripPhotos);
			if (center) map[tripId] = center;
		}
		return map;
	}, [photosByTrip]);

	const selectedPhotos = useMemo(
		() => (selectedTripId ? (photosByTrip[selectedTripId] ?? []) : []),
		[photosByTrip, selectedTripId],
	);

	const selectedTrip = useMemo(
		() => trips.find((t) => t.id === selectedTripId) ?? null,
		[trips, selectedTripId],
	);

	/** 写真を時系列順に並べて経路として使う */
	const photoRouteByTrip = useMemo(() => {
		const map: Record<string, { latitude: number; longitude: number }[]> = {};
		for (const [tripId, tripPhotos] of Object.entries(photosByTrip)) {
			const sorted = [...tripPhotos]
				.filter((p) => p.lat != null && p.lng != null)
				.sort(
					(a, b) =>
						new Date(a.created_at ?? "").getTime() -
						new Date(b.created_at ?? "").getTime(),
				);
			if (sorted.length > 1) {
				map[tripId] = sorted.map((p) => ({
					latitude: p.lat as number,
					longitude: p.lng as number,
				}));
			}
		}
		return map;
	}, [photosByTrip]);

	// --- データ取得 ---
	const fetchMapData = useCallback(async () => {
		setLoading(true);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!user) {
				setLoading(false);
				return;
			}

			// 自分が参加している旅行IDを取得（フレンド参加含む）
			const { data: members } = await supabase
				.from("trip_members")
				.select("trip_id")
				.eq("user_id", user.id);

			const tripIds = (members ?? [])
				.map((m) => m.trip_id)
				.filter((id): id is string => id != null);

			if (tripIds.length === 0) {
				setLoading(false);
				return;
			}

			// 旅行・写真を並行取得
			const [tripsResult, photosResult] = await Promise.all([
				supabase
					.from("trips")
					.select("*")
					.in("id", tripIds)
					.order("start_date", { ascending: false }),
				supabase
					.from("photos")
					.select("*")
					.in("trip_id", tripIds)
					.is("deleted_at", null)
					.order("created_at", { ascending: true }),
			]);

			setTrips(tripsResult.data ?? []);
			setPhotos(photosResult.data ?? []);
		} catch {
			// ネットワークエラー等
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchMapData();
	}, [fetchMapData]);

	const handleTripPinPress = useCallback(
		(tripId: string) => {
			if (selectedTripId === tripId) {
				setSelectedTripId(null);
				setFocusedPhotoId(null);
			} else {
				setSelectedTripId(tripId);
				setFocusedPhotoId(null);
			}
		},
		[selectedTripId],
	);

	const handlePhotoCardPress = useCallback(
		(photo: Photo) => {
			if (photo.lat == null || photo.lng == null) return;
			if (focusedPhotoId === photo.id) {
				setFocusedPhotoId(null);
			} else {
				setFocusedPhotoId(photo.id);
				mapRef.current?.animateToRegion(
					{
						latitude: photo.lat,
						longitude: photo.lng,
						latitudeDelta: 0.02,
						longitudeDelta: 0.02,
					},
					400,
				);
			}
		},
		[focusedPhotoId],
	);

	const handleMapPress = useCallback(() => {
		setFocusedPhotoId(null);
	}, []);

	const onViewableItemsChanged = useCallback(
		({ viewableItems }: { viewableItems: Array<{ item: Photo }> }) => {
			if (viewableItems.length === 0) return;
			const centerItem = viewableItems[Math.floor(viewableItems.length / 2)];
			if (!centerItem) return;
			const photo = centerItem.item;
			if (photo.lat == null || photo.lng == null) return;
			setFocusedPhotoId(photo.id);
			mapRef.current?.animateToRegion(
				{
					latitude: photo.lat,
					longitude: photo.lng,
					latitudeDelta: 0.02,
					longitudeDelta: 0.02,
				},
				300,
			);
		},
		[],
	);

	const viewabilityConfig = useMemo(
		() => ({ itemVisiblePercentThreshold: 50 }),
		[],
	);

	const renderPhotoCard = useCallback(
		({ item }: { item: Photo }) => {
			const isFocused = item.id === focusedPhotoId;
			const color = tripColorMap[item.trip_id ?? ""] ?? Colors.primary;
			return (
				<TouchableOpacity
					style={[
						styles.photoCard,
						isFocused && { borderColor: color, borderWidth: 2 },
					]}
					onPress={() => handlePhotoCardPress(item)}
					activeOpacity={0.85}
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
			);
		},
		[focusedPhotoId, tripColorMap, handlePhotoCardPress],
	);

	if (loading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color={Colors.primary} />
				<Text style={styles.loadingText}>データを読み込み中...</Text>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			{/* 地図 */}
			<View style={styles.mapArea}>
				<MapView
					ref={mapRef}
					style={styles.map}
					initialRegion={JAPAN_REGION}
					onPress={handleMapPress}
				>
					{/* 旅行間の経路線（旅行ピンをつなぐ） */}
					{(() => {
						const coords = trips
							.filter((t) => tripPositions[t.id])
							.map((t) => tripPositions[t.id]);
						if (coords.length < 2) return null;
						return (
							<Polyline
								coordinates={coords}
								strokeColor={Colors.grayLight}
								strokeWidth={2}
								lineDashPattern={[12, 6]}
							/>
						);
					})()}

					{/* 旅行ごとの経路（写真の位置を時系列で結ぶ） */}
					{Object.entries(photoRouteByTrip).map(([tripId, coords]) => (
						<Polyline
							key={tripId}
							coordinates={coords}
							strokeColor={tripColorMap[tripId] ?? Colors.primary}
							strokeWidth={3}
						/>
					))}

					{/* 旅行ピン */}
					{trips.map((trip) => {
						const pos = tripPositions[trip.id];
						if (!pos) return null;
						const color = tripColorMap[trip.id] ?? Colors.primary;
						const isSelected = trip.id === selectedTripId;
						const photoCount = (photosByTrip[trip.id] ?? []).length;

						return (
							<Marker
								key={trip.id}
								coordinate={pos}
								onPress={() => handleTripPinPress(trip.id)}
							>
								<View
									style={[
										styles.tripPin,
										{ backgroundColor: color },
										isSelected && styles.tripPinSelected,
									]}
								>
									<Ionicons name="location" size={16} color={Colors.white} />
									{photoCount > 0 && (
										<View style={styles.tripPinBadge}>
											<Text style={styles.tripPinBadgeText}>{photoCount}</Text>
										</View>
									)}
								</View>
								<View style={styles.tripPinLabel}>
									<Text
										style={[
											styles.tripPinLabelText,
											isSelected && { fontWeight: "800", color },
										]}
										numberOfLines={1}
									>
										{trip.title ?? "無題"}
									</Text>
								</View>
							</Marker>
						);
					})}

					{/* 選択中の旅行の写真ピン */}
					{selectedPhotos
						.filter((p) => p.lat != null && p.lng != null)
						.map((photo) => (
							<Marker
								key={photo.id}
								coordinate={{
									latitude: photo.lat as number,
									longitude: photo.lng as number,
								}}
								onPress={() => handlePhotoCardPress(photo)}
							>
								<View
									style={[
										styles.photoPin,
										photo.id === focusedPhotoId && styles.photoPinFocused,
									]}
								>
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
			</View>

			{/* 下部パネル */}
			<View style={styles.bottomPanel}>
				{selectedTrip ? (
					<>
						<View style={styles.tripHeader}>
							<View style={styles.tripHeaderLeft}>
								<View
									style={[
										styles.tripHeaderDot,
										{
											backgroundColor:
												tripColorMap[selectedTrip.id] ?? Colors.primary,
										},
									]}
								/>
								<View>
									<Text style={styles.tripTitle}>
										{selectedTrip.title ?? "無題"}
									</Text>
									<Text style={styles.tripDate}>
										{selectedTrip.start_date ?? ""}
									</Text>
								</View>
							</View>
						</View>

						{selectedPhotos.length > 0 ? (
							<FlatList
								ref={photoListRef}
								data={selectedPhotos}
								keyExtractor={(item) => String(item.id)}
								renderItem={renderPhotoCard}
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={styles.photoList}
								ItemSeparatorComponent={() => (
									<View style={styles.photoSeparator} />
								)}
								onViewableItemsChanged={onViewableItemsChanged}
								viewabilityConfig={viewabilityConfig}
								getItemLayout={(_, index) => ({
									length: PHOTO_CARD_WIDTH + 10,
									offset: (PHOTO_CARD_WIDTH + 10) * index,
									index,
								})}
							/>
						) : (
							<View style={styles.noPhotos}>
								<Ionicons
									name="camera-outline"
									size={24}
									color={Colors.grayLight}
								/>
								<Text style={styles.noPhotosText}>まだ写真がありません</Text>
							</View>
						)}

						{/* フォーカス中の写真の詳細 */}
						{focusedPhotoId != null &&
							(() => {
								const photo = selectedPhotos.find(
									(p) => p.id === focusedPhotoId,
								);
								if (!photo) return null;
								return (
									<View style={styles.photoDetail}>
										<View style={styles.photoDetailDivider} />
										{photo.lat != null && photo.lng != null && (
											<View style={styles.photoDetailRow}>
												<Ionicons
													name="location"
													size={14}
													color={
														tripColorMap[photo.trip_id ?? ""] ?? Colors.primary
													}
												/>
												<Text style={styles.photoDetailLocation}>
													{photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
												</Text>
											</View>
										)}
										{photo.created_at && (
											<Text style={styles.photoDetailMeta}>
												{new Date(photo.created_at).toLocaleString("ja-JP", {
													year: "numeric",
													month: "short",
													day: "numeric",
													hour: "2-digit",
													minute: "2-digit",
												})}
											</Text>
										)}
									</View>
								);
							})()}
					</>
				) : (
					<View style={styles.emptyPanel}>
						<Ionicons name="map-outline" size={28} color={Colors.grayLight} />
						<Text style={styles.emptyPanelText}>
							{trips.length > 0
								? "旅行のピンをタップして写真を見よう"
								: "旅行がまだありません"}
						</Text>
					</View>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.white,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.background,
		gap: 12,
	},
	loadingText: {
		fontSize: 14,
		color: Colors.gray,
	},

	/* 地図 */
	mapArea: {
		flex: 1,
	},
	map: {
		flex: 1,
	},

	/* 旅行ピン */
	tripPin: {
		width: 36,
		height: 36,
		borderRadius: 18,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 3,
		borderColor: Colors.white,
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 5,
	},
	tripPinSelected: {
		transform: [{ scale: 1.25 }],
	},
	tripPinBadge: {
		position: "absolute",
		top: -4,
		right: -6,
		backgroundColor: Colors.white,
		borderRadius: 8,
		minWidth: 16,
		height: 16,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 3,
		borderWidth: 1,
		borderColor: Colors.grayLighter,
	},
	tripPinBadgeText: {
		fontSize: 9,
		fontWeight: "800",
		color: Colors.black,
	},
	tripPinLabel: {
		marginTop: 2,
		backgroundColor: "rgba(255,255,255,0.9)",
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
		alignSelf: "center",
	},
	tripPinLabelText: {
		fontSize: 10,
		fontWeight: "600",
		color: Colors.gray,
		maxWidth: 80,
		textAlign: "center",
	},

	/* 写真ピン */
	photoPin: {
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: Colors.gray,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 3,
		borderColor: Colors.white,
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
		elevation: 4,
	},
	photoPinFocused: {
		borderColor: Colors.primary,
		transform: [{ scale: 1.2 }],
	},
	photoPinImage: {
		width: 28,
		height: 28,
		borderRadius: 14,
	},

	/* 下部パネル */
	bottomPanel: {
		backgroundColor: Colors.white,
		borderTopWidth: 1,
		borderTopColor: Colors.grayLighter,
		paddingBottom: 8,
	},
	tripHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	tripHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
	},
	tripHeaderDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
	},
	tripTitle: {
		fontSize: 18,
		fontWeight: "700",
		color: Colors.black,
	},
	tripDate: {
		fontSize: 13,
		color: Colors.gray,
		marginTop: 2,
	},

	/* 写真ギャラリー */
	photoList: {
		paddingHorizontal: 16,
		paddingBottom: 8,
	},
	photoSeparator: {
		width: 10,
	},
	photoCard: {
		width: PHOTO_CARD_WIDTH,
		borderRadius: 12,
		backgroundColor: Colors.background,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: "transparent",
	},
	photoCardImage: {
		width: "100%",
		height: PHOTO_CARD_WIDTH * 0.75,
	},
	photoCardImageFull: {
		width: "100%",
		height: "100%",
	},
	photoCardPlaceholder: {
		width: "100%",
		height: "100%",
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.grayLighter,
	},
	photoCardDate: {
		fontSize: 11,
		color: Colors.gray,
		paddingHorizontal: 8,
		paddingVertical: 6,
	},

	/* 写真なし */
	noPhotos: {
		alignItems: "center",
		paddingVertical: 20,
		gap: 6,
	},
	noPhotosText: {
		fontSize: 13,
		color: Colors.grayLight,
	},

	/* 写真詳細 */
	photoDetail: {
		paddingHorizontal: 16,
		paddingBottom: 4,
	},
	photoDetailDivider: {
		height: 1,
		backgroundColor: Colors.grayLighter,
		marginBottom: 10,
	},
	photoDetailRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginBottom: 4,
	},
	photoDetailLocation: {
		fontSize: 14,
		color: Colors.gray,
	},
	photoDetailMeta: {
		fontSize: 12,
		color: Colors.gray,
	},

	/* 未選択 */
	emptyPanel: {
		alignItems: "center",
		paddingVertical: 24,
		gap: 8,
	},
	emptyPanelText: {
		fontSize: 14,
		color: Colors.grayLight,
	},
});
