import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
	Alert,
	Image,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Colors } from "../../src/constants/colors";
import { mockPhotos, mockRoutePoints, mockTrips } from "../../src/data/mock";
import type { TripStatus } from "../../src/types";

const STATUS_LABELS: Record<TripStatus, string> = {
	planned: "予定",
	active: "旅行中",
	completed: "完了",
};

export default function TripDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const mapRef = useRef<MapView>(null);

	const trip = mockTrips.find((t) => t.id === id);
	const photos = useMemo(() => mockPhotos.filter((p) => p.tripId === id), [id]);
	const routePoints = useMemo(() => mockRoutePoints[id ?? ""] ?? [], [id]);
	const routeCoords = useMemo(
		() =>
			routePoints.map((p) => ({
				latitude: p.latitude,
				longitude: p.longitude,
			})),
		[routePoints],
	);
	const [status, setStatus] = useState<TripStatus>(trip?.status ?? "planned");

	if (!trip) {
		return (
			<View style={styles.notFound}>
				<Ionicons
					name="alert-circle-outline"
					size={48}
					color={Colors.textLight}
				/>
				<Text style={styles.notFoundText}>旅行が見つかりません</Text>
				<TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
					<Text style={styles.backBtnText}>戻る</Text>
				</TouchableOpacity>
			</View>
		);
	}

	const handleStart = () => {
		Alert.alert(
			"旅行開始",
			"旅行を開始しますか？位置情報の記録が始まります。",
			[
				{ text: "キャンセル", style: "cancel" },
				{
					text: "開始する",
					onPress: () => setStatus("active"),
				},
			],
		);
	};

	const handleEnd = () => {
		Alert.alert("旅行終了", "旅行を終了しますか？記録が保存されます。", [
			{ text: "キャンセル", style: "cancel" },
			{
				text: "終了する",
				style: "destructive",
				onPress: () => setStatus("completed"),
			},
		]);
	};

	const handleShare = async () => {
		if (trip.inviteLink) {
			try {
				await Share.share({
					message: `「${trip.title}」に参加しよう！\n${trip.inviteLink}`,
				});
			} catch {
				// cancelled
			}
		}
	};

	const formatDate = (d: string) => {
		const date = new Date(d);
		return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
	};

	return (
		<ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
			{/* 地図 */}
			<View style={styles.mapContainer}>
				<MapView
					ref={mapRef}
					style={styles.map}
					initialRegion={
						routeCoords.length > 0
							? {
									latitude: routeCoords[0].latitude,
									longitude: routeCoords[0].longitude,
									latitudeDelta: 0.15,
									longitudeDelta: 0.15,
								}
							: {
									latitude: 35.68,
									longitude: 139.77,
									latitudeDelta: 5,
									longitudeDelta: 5,
								}
					}
					scrollEnabled={false}
					zoomEnabled={false}
				>
					{routeCoords.length > 1 && (
						<Polyline
							coordinates={routeCoords}
							strokeColor={Colors.primary}
							strokeWidth={3}
							lineDashPattern={[10, 5]}
						/>
					)}
					{photos.map((photo) => (
						<Marker
							key={photo.id}
							coordinate={{
								latitude: photo.latitude,
								longitude: photo.longitude,
							}}
						>
							<View style={styles.photoPin}>
								{photo.uri ? (
									<Image
										source={{ uri: photo.uri }}
										style={styles.photoPinImg}
									/>
								) : (
									<Ionicons name="camera" size={14} color={Colors.white} />
								)}
							</View>
						</Marker>
					))}
				</MapView>
			</View>

			{/* 旅行情報 */}
			<View style={styles.infoSection}>
				<View style={styles.titleRow}>
					<Text style={styles.tripTitle}>{trip.title}</Text>
					<View
						style={[
							styles.statusBadge,
							{
								backgroundColor:
									status === "active"
										? "#E8F5E9"
										: status === "planned"
											? "#E3F2FD"
											: "#F5F5F5",
							},
						]}
					>
						<Text
							style={[
								styles.statusText,
								{
									color:
										status === "active"
											? "#2E7D32"
											: status === "planned"
												? "#1565C0"
												: "#757575",
								},
							]}
						>
							{STATUS_LABELS[status]}
						</Text>
					</View>
				</View>

				<View style={styles.detailRow}>
					<Ionicons
						name="calendar-outline"
						size={16}
						color={Colors.textSecondary}
					/>
					<Text style={styles.detailText}>{formatDate(trip.startDate)}</Text>
				</View>

				{trip.memo && (
					<View style={styles.detailRow}>
						<Ionicons
							name="document-text-outline"
							size={16}
							color={Colors.textSecondary}
						/>
						<Text style={styles.detailText}>{trip.memo}</Text>
					</View>
				)}
			</View>

			{/* 参加者 */}
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>参加者</Text>
				<View style={styles.participantsList}>
					{trip.participants.map((p) => (
						<View key={p.id} style={styles.participant}>
							<View
								style={[
									styles.participantAvatar,
									{ backgroundColor: p.avatarColor },
								]}
							>
								<Text style={styles.participantInitial}>
									{p.displayName.charAt(0)}
								</Text>
							</View>
							<Text style={styles.participantName}>{p.displayName}</Text>
						</View>
					))}
				</View>
				{trip.inviteLink && (
					<TouchableOpacity style={styles.shareLink} onPress={handleShare}>
						<Ionicons name="link-outline" size={16} color={Colors.primary} />
						<Text style={styles.shareLinkText}>招待リンクを共有</Text>
					</TouchableOpacity>
				)}
			</View>

			{/* 写真 */}
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>写真（{photos.length}枚）</Text>
				{photos.length > 0 ? (
					<ScrollView horizontal showsHorizontalScrollIndicator={false}>
						{photos.map((photo) => (
							<View key={photo.id} style={styles.photoCard}>
								<View style={styles.photoPlaceholder}>
									<Ionicons
										name="image-outline"
										size={32}
										color={Colors.textLight}
									/>
								</View>
								<Text style={styles.photoTime}>
									{new Date(photo.takenAt).toLocaleTimeString("ja-JP", {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</Text>
							</View>
						))}
					</ScrollView>
				) : (
					<View style={styles.noPhotos}>
						<Ionicons
							name="camera-outline"
							size={32}
							color={Colors.textLight}
						/>
						<Text style={styles.noPhotosText}>まだ写真がありません</Text>
					</View>
				)}
			</View>

			{/* アクションボタン */}
			<View style={styles.actions}>
				{status === "planned" && (
					<TouchableOpacity style={styles.startButton} onPress={handleStart}>
						<Ionicons name="play" size={20} color={Colors.white} />
						<Text style={styles.actionButtonText}>旅行を開始する</Text>
					</TouchableOpacity>
				)}
				{status === "active" && (
					<>
						<TouchableOpacity style={styles.cameraActionButton}>
							<Ionicons name="camera" size={20} color={Colors.white} />
							<Text style={styles.actionButtonText}>写真を撮る</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.endButton} onPress={handleEnd}>
							<Ionicons name="stop" size={20} color={Colors.white} />
							<Text style={styles.actionButtonText}>旅行を終了する</Text>
						</TouchableOpacity>
					</>
				)}
				{status === "completed" && (
					<TouchableOpacity style={styles.shareButton} onPress={handleShare}>
						<Ionicons name="share-outline" size={20} color={Colors.primary} />
						<Text style={[styles.actionButtonText, { color: Colors.primary }]}>
							旅行の記録を共有
						</Text>
					</TouchableOpacity>
				)}
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
	},
	notFound: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		gap: 12,
		backgroundColor: Colors.background,
	},
	notFoundText: {
		fontSize: 16,
		color: Colors.textSecondary,
	},
	backBtn: {
		paddingHorizontal: 24,
		paddingVertical: 10,
		borderRadius: 8,
		backgroundColor: Colors.primary,
	},
	backBtnText: {
		color: Colors.white,
		fontWeight: "600",
	},
	mapContainer: {
		height: 240,
		borderBottomWidth: 1,
		borderBottomColor: Colors.border,
	},
	map: {
		flex: 1,
	},
	photoPin: {
		width: 30,
		height: 30,
		borderRadius: 15,
		backgroundColor: Colors.secondary,
		justifyContent: "center",
		alignItems: "center",
		borderWidth: 2,
		borderColor: Colors.white,
	},
	photoPinImg: {
		width: 26,
		height: 26,
		borderRadius: 13,
	},
	infoSection: {
		backgroundColor: Colors.white,
		padding: 20,
	},
	titleRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 14,
	},
	tripTitle: {
		fontSize: 22,
		fontWeight: "800",
		color: Colors.text,
		flex: 1,
	},
	statusBadge: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 12,
		marginLeft: 10,
	},
	statusText: {
		fontSize: 12,
		fontWeight: "700",
	},
	detailRow: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: 8,
		marginBottom: 8,
	},
	detailText: {
		fontSize: 14,
		color: Colors.textSecondary,
		flex: 1,
		lineHeight: 20,
	},
	section: {
		backgroundColor: Colors.white,
		marginTop: 10,
		padding: 20,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: "700",
		color: Colors.text,
		marginBottom: 14,
	},
	participantsList: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
	},
	participant: {
		alignItems: "center",
		gap: 4,
	},
	participantAvatar: {
		width: 44,
		height: 44,
		borderRadius: 22,
		justifyContent: "center",
		alignItems: "center",
	},
	participantInitial: {
		color: Colors.white,
		fontSize: 18,
		fontWeight: "700",
	},
	participantName: {
		fontSize: 12,
		color: Colors.textSecondary,
	},
	shareLink: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		marginTop: 14,
		alignSelf: "flex-start",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: Colors.primary,
	},
	shareLinkText: {
		fontSize: 13,
		fontWeight: "600",
		color: Colors.primary,
	},
	photoCard: {
		marginRight: 10,
		alignItems: "center",
		gap: 4,
	},
	photoPlaceholder: {
		width: 100,
		height: 100,
		borderRadius: 12,
		backgroundColor: Colors.background,
		justifyContent: "center",
		alignItems: "center",
	},
	photoTime: {
		fontSize: 11,
		color: Colors.textSecondary,
	},
	noPhotos: {
		alignItems: "center",
		paddingVertical: 24,
		gap: 8,
	},
	noPhotosText: {
		fontSize: 14,
		color: Colors.textLight,
	},
	actions: {
		padding: 20,
		gap: 10,
		paddingBottom: 40,
	},
	startButton: {
		backgroundColor: Colors.primary,
		borderRadius: 14,
		paddingVertical: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
	},
	cameraActionButton: {
		backgroundColor: Colors.secondary,
		borderRadius: 14,
		paddingVertical: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
	},
	endButton: {
		backgroundColor: Colors.error,
		borderRadius: 14,
		paddingVertical: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
	},
	shareButton: {
		backgroundColor: Colors.white,
		borderRadius: 14,
		paddingVertical: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		borderWidth: 1,
		borderColor: Colors.primary,
	},
	actionButtonText: {
		color: Colors.white,
		fontSize: 16,
		fontWeight: "700",
	},
});
