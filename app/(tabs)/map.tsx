import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Animated,
	Dimensions,
	type FlatList,
	Image,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../src/constants/colors";
import { supabase } from "../../src/lib/supabase";
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
	const insets = useSafeAreaInsets();
	const mapRef = useRef<MapView>(null);
	const photoListRef = useRef<FlatList<Photo>>(null);
	const scrollX = useRef(new Animated.Value(0)).current;

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

	/** 全写真を新しい順に並べたもの（通常状態で使用） */
	const allPhotosSorted = useMemo(
		() =>
			[...photos].sort(
				(a, b) =>
					new Date(b.created_at ?? "").getTime() -
					new Date(a.created_at ?? "").getTime(),
			),
		[photos],
	);

	const selectedTrip = useMemo(
		() => trips.find((t) => t.id === selectedTripId) ?? null,
		[trips, selectedTripId],
	);

	/** 選択中の旅行のメンバー */
	const [selectedMembers, setSelectedMembers] = useState<User[]>([]);

	useEffect(() => {
		if (!selectedTripId) {
			setSelectedMembers([]);
			return;
		}
		(async () => {
			const { data: members } = await supabase
				.from("trip_members")
				.select("user_id")
				.eq("trip_id", selectedTripId)
				.is("deletead_at", null);
			const userIds = (members ?? [])
				.map((m) => m.user_id)
				.filter((uid): uid is string => uid != null);
			if (userIds.length > 0) {
				const { data: users } = await supabase
					.from("users")
					.select("*")
					.in("id", userIds);
				setSelectedMembers(users ?? []);
			} else {
				setSelectedMembers([]);
			}
		})();
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

	// --- データ取得（Supabase） ---
	const fetchMapData = useCallback(async () => {
		setLoading(true);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				setTrips([]);
				setPhotos([]);
				return;
			}

			const { data: memberRows } = await supabase
				.from("trip_members")
				.select("trip_id")
				.eq("user_id", user.id)
				.is("deletead_at", null);
			const memberTripIds = (memberRows ?? [])
				.map((r) => r.trip_id)
				.filter((id): id is string => id != null);

			const { data: ownedTrips } = await supabase
				.from("trips")
				.select("*")
				.eq("owner_user_id", user.id)
				.is("deleted_at", null);

			const ownedIds = new Set((ownedTrips ?? []).map((t) => t.id));
			const extraIds = memberTripIds.filter((id) => !ownedIds.has(id));

			let extraTrips: Trip[] = [];
			if (extraIds.length > 0) {
				const { data } = await supabase
					.from("trips")
					.select("*")
					.in("id", extraIds)
					.is("deleted_at", null);
				extraTrips = data ?? [];
			}

			const allTrips = [...(ownedTrips ?? []), ...extraTrips];
			setTrips(allTrips);

			const allTripIds = allTrips.map((t) => t.id);
			if (allTripIds.length > 0) {
				const { data: photosData, error: photosError } = await supabase
					.from("photos")
					.select("*")
					.in("trip_id", allTripIds)
					.order("created_at", { ascending: true });
				if (photosError) {
					console.error("Photos fetch error:", photosError);
				}
				setPhotos(photosData ?? []);
			} else {
				setPhotos([]);
			}
		} catch (error) {
			console.error("fetchMapData error:", error);
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
				if (!selectedTripId && photo.trip_id) {
					setSelectedTripId(photo.trip_id);
				}
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
		[focusedPhotoId, selectedTripId],
	);

	const handleMapPress = useCallback(() => {
		setFocusedPhotoId(null);
	}, []);

	/** 全旅行が収まるようにマップを縮小 */
	const handleFitAllTrips = useCallback(() => {
		const positions = Object.values(tripPositions);
		if (positions.length === 0) {
			mapRef.current?.animateToRegion(JAPAN_REGION, 600);
			return;
		}
		const lats = positions.map((p) => p.latitude);
		const lngs = positions.map((p) => p.longitude);
		const minLat = Math.min(...lats);
		const maxLat = Math.max(...lats);
		const minLng = Math.min(...lngs);
		const maxLng = Math.max(...lngs);
		const padding = 1.5;
		mapRef.current?.animateToRegion(
			{
				latitude: (minLat + maxLat) / 2,
				longitude: (minLng + maxLng) / 2,
				latitudeDelta: Math.max(maxLat - minLat + padding, 2),
				longitudeDelta: Math.max(maxLng - minLng + padding, 2),
			},
			600,
		);
	}, [tripPositions]);

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
						latitudeDelta: 0.02,
						longitudeDelta: 0.02,
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
				outputRange: [0.85, 1, 0.85],
				extrapolate: "clamp",
			});
			const opacity = scrollX.interpolate({
				inputRange,
				outputRange: [0.6, 1, 0.6],
				extrapolate: "clamp",
			});
			return (
				<Animated.View
					style={{
						width: CARD_WIDTH,
						transform: [{ scale }],
						opacity,
					}}
				>
					<TouchableOpacity
						style={styles.photoCard}
						onPress={() => handlePhotoCardPress(item)}
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
		[scrollX, handlePhotoCardPress],
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

				{/* 写真ピン（通常時は全写真、選択時はその旅行の写真） */}
				{(selectedTripId ? selectedPhotos : photos)
					.filter((p) => p.lat != null && p.lng != null)
					.map((photo) => {
						const color = tripColorMap[photo.trip_id ?? ""] ?? Colors.primary;
						return (
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
										!selectedTripId && { borderColor: color },
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
						);
					})}
			</MapView>

			{/* 上部オーバーレイ */}
			{selectedTrip ? (
				<View style={[styles.tripInfoOverlay, { top: insets.top + 12 }]}>
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
			) : (
				trips.length > 0 && (
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						style={[styles.tripChipList, { top: insets.top + 8 }]}
						contentContainerStyle={styles.tripChipListContent}
					>
						{trips.map((trip) => {
							const color = tripColorMap[trip.id] ?? Colors.primary;
							const photoCount = (photosByTrip[trip.id] ?? []).length;
							return (
								<TouchableOpacity
									key={trip.id}
									style={styles.tripChip}
									onPress={() => handleTripPinPress(trip.id)}
									activeOpacity={0.8}
								>
									<View
										style={[styles.tripChipDot, { backgroundColor: color }]}
									/>
									<Text style={styles.tripChipTitle} numberOfLines={1}>
										{trip.title ?? "無題"}
									</Text>
									{photoCount > 0 && (
										<View
											style={[styles.tripChipBadge, { backgroundColor: color }]}
										>
											<Text style={styles.tripChipBadgeText}>{photoCount}</Text>
										</View>
									)}
								</TouchableOpacity>
							);
						})}
					</ScrollView>
				)
			)}

			{/* 全旅行表示ボタン（旅行未選択時のみ表示） */}
			{!selectedTrip && trips.length > 0 && (
				<TouchableOpacity
					style={[styles.fitAllButton, { bottom: insets.bottom + 16 }]}
					onPress={handleFitAllTrips}
					activeOpacity={0.8}
				>
					<Ionicons name="contract-outline" size={20} color={Colors.white} />
				</TouchableOpacity>
			)}

			{/* 下部パネル: 旅行選択時のみ写真表示 */}
			{selectedTrip && (
				<View style={styles.bottomPanel}>
					{selectedPhotos.length > 0 ? (
						<Animated.FlatList
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
					) : (
						<View style={styles.emptyPanel}>
							<Ionicons
								name="camera-outline"
								size={28}
								color={Colors.grayLight}
							/>
							<Text style={styles.emptyPanelText}>まだ写真がありません</Text>
						</View>
					)}
				</View>
			)}
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

	/* 旅行チップリスト（通常状態） */
	tripChipList: {
		position: "absolute",
		left: 0,
		right: 0,
		zIndex: 10,
	},
	tripChipListContent: {
		paddingHorizontal: 12,
		gap: 8,
	},
	tripChip: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgba(255,255,255,0.95)",
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		gap: 6,
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.15,
		shadowRadius: 4,
		elevation: 3,
	},
	tripChipDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	tripChipTitle: {
		fontSize: 13,
		fontWeight: "600",
		color: Colors.black,
		maxWidth: 120,
	},
	tripChipBadge: {
		minWidth: 18,
		height: 18,
		borderRadius: 9,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 4,
	},
	tripChipBadgeText: {
		fontSize: 10,
		fontWeight: "700",
		color: Colors.white,
	},

	/* 上部オーバーレイ（旅行選択時） */
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
		paddingHorizontal: SIDE_PADDING,
		alignItems: "center",
	},
	photoSeparator: {
		width: CARD_SPACING,
	},
	photoCard: {
		width: CARD_WIDTH,
		borderRadius: 14,
		backgroundColor: Colors.white,
		overflow: "hidden",
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 3 },
		shadowOpacity: 0.2,
		shadowRadius: 6,
		elevation: 5,
	},
	photoCardImage: {
		width: "100%",
		height: CARD_WIDTH * 0.75,
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
		fontSize: 12,
		color: Colors.gray,
		paddingHorizontal: 10,
		paddingVertical: 6,
		textAlign: "center",
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

	/* 全旅行表示ボタン */
	fitAllButton: {
		position: "absolute",
		right: 16,
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: Colors.primary,
		justifyContent: "center",
		alignItems: "center",
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 6,
		elevation: 6,
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
