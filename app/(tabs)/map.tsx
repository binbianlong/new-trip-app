import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
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
import { mockPhotos, mockTrips, TRIP_COLORS } from "../../src/data/mock";
import type { TripPhoto, TripProject } from "../../src/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PHOTO_CARD_WIDTH = SCREEN_WIDTH * 0.38;
const PHOTO_CARD_HEIGHT = PHOTO_CARD_WIDTH * 1.2;

const JAPAN_CENTER: Region = {
	latitude: 36.5,
	longitude: 137.0,
	latitudeDelta: 14,
	longitudeDelta: 14,
};

function getPhotographerName(trip: TripProject, takenBy: string): string {
	return trip.participants.find((p) => p.id === takenBy)?.displayName ?? "不明";
}

function formatTripDate(dateStr: string): string {
	const d = new Date(dateStr);
	return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function MapScreen() {
	const router = useRouter();
	const mapRef = useRef<MapView>(null);
	const photoListRef = useRef<FlatList<TripPhoto>>(null);

	/** 座標を持つ旅行のみ（ピン表示対象） */
	const tripsWithCoord = useMemo(
		() =>
			mockTrips
				.filter(
					(t) =>
						t.latitude != null &&
						t.longitude != null &&
						(t.status === "active" || t.status === "completed"),
				)
				.sort(
					(a, b) =>
						new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
				),
		[],
	);

	/** 旅行間の経路（時系列順に旅行を結ぶ） */
	const tripRoute = useMemo(
		() =>
			tripsWithCoord
				.filter(
					(t): t is TripProject & { latitude: number; longitude: number } =>
						t.latitude != null && t.longitude != null,
				)
				.map((t) => ({
					latitude: t.latitude,
					longitude: t.longitude,
				})),
		[tripsWithCoord],
	);

	const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
	const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

	const selectedTrip = useMemo(
		() => tripsWithCoord.find((t) => t.id === selectedTripId) ?? null,
		[tripsWithCoord, selectedTripId],
	);

	const tripPhotos = useMemo(
		() =>
			selectedTripId
				? mockPhotos.filter((p) => p.tripId === selectedTripId)
				: [],
		[selectedTripId],
	);

	const selectedPhoto = useMemo(
		() => tripPhotos.find((p) => p.id === selectedPhotoId) ?? null,
		[tripPhotos, selectedPhotoId],
	);

	/** 旅行ピンをタップ → 選択して下部パネルに写真表示 */
	const handleTripPinPress = useCallback(
		(trip: TripProject) => {
			if (selectedTripId === trip.id) {
				// 同じピンを再タップで選択解除
				setSelectedTripId(null);
				setSelectedPhotoId(null);
			} else {
				setSelectedTripId(trip.id);
				setSelectedPhotoId(null);
			}
		},
		[selectedTripId],
	);

	/** ギャラリーの写真タップ → 地図を該当位置に移動 */
	const handlePhotoCardPress = useCallback(
		(photo: TripPhoto) => {
			if (selectedPhotoId === photo.id) {
				setSelectedPhotoId(null);
			} else {
				setSelectedPhotoId(photo.id);
				mapRef.current?.animateToRegion(
					{
						latitude: photo.latitude,
						longitude: photo.longitude,
						latitudeDelta: 0.05,
						longitudeDelta: 0.05,
					},
					400,
				);
			}
		},
		[selectedPhotoId],
	);

	/** 地図の空白タップで選択解除 */
	const handleMapPress = useCallback(() => {
		setSelectedPhotoId(null);
	}, []);

	/** 写真カード描画 */
	const renderPhotoCard = useCallback(
		({ item }: { item: TripPhoto }) => {
			const isSelected = item.id === selectedPhotoId;
			const color = TRIP_COLORS[item.tripId] ?? Colors.primary;
			return (
				<TouchableOpacity
					style={[
						styles.photoCard,
						isSelected && { borderColor: color, borderWidth: 2 },
					]}
					onPress={() => handlePhotoCardPress(item)}
					activeOpacity={0.85}
				>
					<View style={styles.photoCardImage}>
						{item.uri ? (
							<Image
								source={{ uri: item.uri }}
								style={styles.photoCardImageFull}
							/>
						) : (
							<View style={styles.photoCardPlaceholder}>
								<Ionicons
									name="image-outline"
									size={32}
									color={Colors.textLight}
								/>
							</View>
						)}
					</View>
					<Text style={styles.photoCardLocation} numberOfLines={1}>
						{item.locationName ?? "撮影地点"}
					</Text>
					{item.caption && (
						<Text style={styles.photoCardCaption} numberOfLines={2}>
							{item.caption}
						</Text>
					)}
				</TouchableOpacity>
			);
		},
		[selectedPhotoId, handlePhotoCardPress],
	);

	return (
		<View style={styles.container}>
			{/* ===== 地図エリア ===== */}
			<View style={styles.mapArea}>
				<MapView
					ref={mapRef}
					style={styles.map}
					initialRegion={JAPAN_CENTER}
					onPress={handleMapPress}
				>
					{/* 旅行間の経路線 */}
					{tripRoute.length > 1 && (
						<Polyline
							coordinates={tripRoute}
							strokeColor={Colors.primary}
							strokeWidth={2}
							lineDashPattern={[12, 6]}
						/>
					)}

					{/* 旅行ピン */}
					{tripsWithCoord.map((trip) => {
						if (trip.latitude == null || trip.longitude == null) return null;
						const color = TRIP_COLORS[trip.id] ?? Colors.primary;
						const isSelected = trip.id === selectedTripId;
						const photoCount = mockPhotos.filter(
							(p) => p.tripId === trip.id,
						).length;

						return (
							<Marker
								key={trip.id}
								coordinate={{
									latitude: trip.latitude,
									longitude: trip.longitude,
								}}
								onPress={() => handleTripPinPress(trip)}
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
								{/* ピン下にラベル */}
								<View style={styles.tripPinLabel}>
									<Text
										style={[
											styles.tripPinLabelText,
											isSelected && { fontWeight: "800", color },
										]}
										numberOfLines={1}
									>
										{trip.title}
									</Text>
								</View>
							</Marker>
						);
					})}
				</MapView>
			</View>

			{/* ===== 下部パネル ===== */}
			<View style={styles.bottomPanel}>
				{selectedTrip ? (
					<>
						{/* 選択中の旅行ヘッダー */}
						<TouchableOpacity
							style={styles.tripHeader}
							onPress={() => router.push(`/trip/${selectedTrip.id}`)}
							activeOpacity={0.7}
						>
							<View style={styles.tripHeaderLeft}>
								<View
									style={[
										styles.tripHeaderDot,
										{
											backgroundColor:
												TRIP_COLORS[selectedTrip.id] ?? Colors.primary,
										},
									]}
								/>
								<View>
									<Text style={styles.tripTitle}>{selectedTrip.title}</Text>
									<Text style={styles.tripDate}>
										{formatTripDate(selectedTrip.startDate)}
									</Text>
								</View>
							</View>
							<Ionicons
								name="chevron-forward"
								size={20}
								color={Colors.textSecondary}
							/>
						</TouchableOpacity>

						{/* 写真ギャラリー（横スクロール） */}
						{tripPhotos.length > 0 ? (
							<FlatList
								ref={photoListRef}
								data={tripPhotos}
								keyExtractor={(item) => item.id}
								renderItem={renderPhotoCard}
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={styles.photoList}
								ItemSeparatorComponent={() => (
									<View style={styles.photoSeparator} />
								)}
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
									color={Colors.textLight}
								/>
								<Text style={styles.noPhotosText}>まだ写真がありません</Text>
							</View>
						)}

						{/* 選択写真の詳細 */}
						{selectedPhoto && (
							<View style={styles.photoDetail}>
								<View style={styles.photoDetailDivider} />
								<View style={styles.photoDetailRow}>
									<Ionicons
										name="location"
										size={14}
										color={TRIP_COLORS[selectedTrip.id] ?? Colors.primary}
									/>
									<Text style={styles.photoDetailLocation}>
										{selectedPhoto.locationName ?? "撮影地点"}
									</Text>
								</View>
								{selectedPhoto.caption && (
									<Text style={styles.photoDetailCaption}>
										{selectedPhoto.caption}
									</Text>
								)}
								<View style={styles.photoDetailMeta}>
									<Text style={styles.photoDetailMetaText}>
										撮影:{" "}
										{getPhotographerName(selectedTrip, selectedPhoto.takenBy)}
									</Text>
									<Text style={styles.photoDetailMetaText}>
										{new Date(selectedPhoto.takenAt).toLocaleString("ja-JP", {
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</Text>
								</View>
							</View>
						)}
					</>
				) : (
					/* 未選択状態 */
					<View style={styles.emptyPanel}>
						<Ionicons name="map-outline" size={28} color={Colors.textLight} />
						<Text style={styles.emptyPanelText}>
							旅行のピンをタップして写真を見よう
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

	/* ===== 地図 ===== */
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
		shadowOpacity: 0.4,
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
		borderColor: Colors.border,
	},
	tripPinBadgeText: {
		fontSize: 9,
		fontWeight: "800",
		color: Colors.text,
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
		color: Colors.textSecondary,
		maxWidth: 80,
		textAlign: "center",
	},

	/* ===== 下部パネル ===== */
	bottomPanel: {
		backgroundColor: Colors.white,
		borderTopWidth: 1,
		borderTopColor: Colors.border,
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
		color: Colors.text,
	},
	tripDate: {
		fontSize: 13,
		color: Colors.textSecondary,
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
		height: PHOTO_CARD_HEIGHT * 0.6,
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
		backgroundColor: Colors.border,
	},
	photoCardLocation: {
		fontSize: 12,
		fontWeight: "700",
		color: Colors.text,
		paddingHorizontal: 8,
		paddingTop: 6,
	},
	photoCardCaption: {
		fontSize: 11,
		color: Colors.textSecondary,
		paddingHorizontal: 8,
		paddingTop: 2,
		paddingBottom: 6,
		lineHeight: 15,
	},

	/* 写真なし */
	noPhotos: {
		alignItems: "center",
		paddingVertical: 20,
		gap: 6,
	},
	noPhotosText: {
		fontSize: 13,
		color: Colors.textLight,
	},

	/* 選択写真の詳細 */
	photoDetail: {
		paddingHorizontal: 16,
		paddingBottom: 4,
	},
	photoDetailDivider: {
		height: 1,
		backgroundColor: Colors.border,
		marginBottom: 10,
	},
	photoDetailRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginBottom: 4,
	},
	photoDetailLocation: {
		fontSize: 15,
		fontWeight: "700",
		color: Colors.text,
	},
	photoDetailCaption: {
		fontSize: 13,
		color: Colors.text,
		lineHeight: 20,
		marginBottom: 6,
	},
	photoDetailMeta: {
		flexDirection: "row",
		gap: 16,
	},
	photoDetailMetaText: {
		fontSize: 12,
		color: Colors.textSecondary,
	},

	/* 未選択 */
	emptyPanel: {
		alignItems: "center",
		paddingVertical: 24,
		gap: 8,
	},
	emptyPanelText: {
		fontSize: 14,
		color: Colors.textLight,
	},
});
