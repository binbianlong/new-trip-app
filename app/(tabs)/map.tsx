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
import {
	mockPhotos,
	mockTripMembers,
	mockTrips,
	mockUsers,
} from "../../src/data/mock";
import type { Photo, Trip } from "../../src/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PHOTO_CARD_WIDTH = SCREEN_WIDTH * 0.4;
const PHOTO_CARD_WIDTH_FOCUSED = SCREEN_WIDTH * 0.55;
const PHOTO_CARD_WIDTH_UNFOCUSED = SCREEN_WIDTH * 0.28;

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

	/** 選択中の旅行のメンバー */
	const selectedMembers = useMemo(() => {
		if (!selectedTripId) return [];
		const memberUserIds = mockTripMembers
			.filter((m) => m.trip_id === selectedTripId)
			.map((m) => m.user_id);
		return mockUsers.filter((u) => memberUserIds.includes(u.id));
	}, [selectedTripId]);

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

	// --- データ取得（モックデータ使用） ---
	const fetchMapData = useCallback(async () => {
		setLoading(true);
		// モックデータをそのまま使用
		setTrips(mockTrips);
		setPhotos(mockPhotos);
		setLoading(false);
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
			// 一番左側の見えているカードを選択する
			const centerItem = viewableItems[0];
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
			const hasAnyFocus = focusedPhotoId != null;
			const cardWidth = isFocused
				? PHOTO_CARD_WIDTH_FOCUSED
				: hasAnyFocus
					? PHOTO_CARD_WIDTH_UNFOCUSED
					: PHOTO_CARD_WIDTH;
			const color = tripColorMap[item.trip_id ?? ""] ?? Colors.primary;
			return (
				<TouchableOpacity
					style={[
						styles.photoCard,
						{ width: cardWidth },
						isFocused && { borderColor: color, borderWidth: 2 },
					]}
					onPress={() => handlePhotoCardPress(item)}
					activeOpacity={0.85}
				>
					<View style={[styles.photoCardImage, { height: cardWidth * 0.75 }]}>
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
			{/* 地図（画面全体） */}
			<MapView
				ref={mapRef}
				style={StyleSheet.absoluteFillObject}
				initialRegion={JAPAN_REGION}
				onPress={handleMapPress}
			>
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

			{/* 上部オーバーレイ: 旅行情報 */}
			{selectedTrip && (
				<View style={styles.tripInfoOverlay}>
					<View style={styles.tripInfoRow}>
						<View
							style={[
								styles.tripInfoDot,
								{
									backgroundColor:
										tripColorMap[selectedTrip.id] ?? Colors.primary,
								},
							]}
						/>
						<Text style={styles.tripInfoTitle} numberOfLines={1}>
							{selectedTrip.title ?? "無題"}
						</Text>
						<TouchableOpacity
							onPress={() => {
								setSelectedTripId(null);
								setFocusedPhotoId(null);
							}}
							hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
						>
							<Ionicons name="chevron-down" size={20} color={Colors.gray} />
						</TouchableOpacity>
					</View>
					<View style={styles.tripInfoMeta}>
						<Ionicons name="calendar-outline" size={13} color={Colors.gray} />
						<Text style={styles.tripInfoMetaText}>
							{selectedTrip.start_date ?? ""}
							{selectedTrip.end_date ? ` 〜 ${selectedTrip.end_date}` : ""}
						</Text>
					</View>
					{selectedMembers.length > 0 && (
						<View style={styles.tripInfoMeta}>
							<Ionicons name="people-outline" size={13} color={Colors.gray} />
							{selectedMembers.slice(0, 3).map((member, i) => (
								<View
									key={member.id}
									style={[styles.memberAvatar, i > 0 && { marginLeft: -6 }]}
								>
									{member.avatar_url ? (
										<Image
											source={{ uri: member.avatar_url }}
											style={styles.memberAvatarImage}
										/>
									) : (
										<Ionicons name="person" size={10} color={Colors.gray} />
									)}
								</View>
							))}
							<Text style={styles.tripInfoMetaText}>
								{selectedMembers
									.slice(0, 2)
									.map((m) => m.profile_name ?? m.username)
									.join("・")}
								{selectedMembers.length > 2
									? ` 他${selectedMembers.length - 2}名`
									: ""}
							</Text>
						</View>
					)}
				</View>
			)}

			{/* 下部パネル: 写真のみ */}
			<View style={styles.bottomPanel}>
				{selectedTrip ? (
					selectedPhotos.length > 0 ? (
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
							extraData={focusedPhotoId}
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
					)
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

	/* 上部オーバーレイ */
	tripInfoOverlay: {
		position: "absolute",
		top: 12,
		left: 12,
		right: 12,
		backgroundColor: "rgba(255,255,255,0.95)",
		borderRadius: 14,
		paddingHorizontal: 14,
		paddingVertical: 12,
		gap: 6,
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 5,
	},
	tripInfoRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	tripInfoDot: {
		width: 10,
		height: 10,
		borderRadius: 5,
		flexShrink: 0,
	},
	tripInfoTitle: {
		fontSize: 17,
		fontWeight: "700",
		color: Colors.black,
		flex: 1,
	},
	tripInfoMeta: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
	},
	tripInfoMetaText: {
		fontSize: 13,
		color: Colors.gray,
	},
	memberAvatar: {
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: Colors.grayLighter,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 1.5,
		borderColor: Colors.white,
		overflow: "hidden",
	},
	memberAvatarImage: {
		width: 20,
		height: 20,
		borderRadius: 10,
	},

	/* 下部パネル */
	bottomPanel: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		backgroundColor: "transparent",
		paddingBottom: 12,
		paddingTop: 4,
	},

	/* 写真ギャラリー */
	photoList: {
		paddingHorizontal: SCREEN_WIDTH / 2 - PHOTO_CARD_WIDTH / 2,
		paddingBottom: 8,
		alignItems: "flex-end",
	},
	photoSeparator: {
		width: 10,
	},
	photoCard: {
		width: PHOTO_CARD_WIDTH,
		borderRadius: 12,
		backgroundColor: "transparent",
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
		paddingVertical: 4,
		backgroundColor: Colors.white,
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
