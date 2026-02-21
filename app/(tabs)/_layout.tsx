import { Ionicons } from "@expo/vector-icons";
import { Tabs, useFocusEffect, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../../src/constants/colors";
import { getUnreadCount, registerPushToken } from "../../src/lib/notifications";
import { supabase } from "../../src/lib/supabase";
import type { User } from "../../src/types";

function NotificationBell({
	count,
	onPress,
}: {
	count: number;
	onPress: () => void;
}) {
	return (
		<Pressable onPress={onPress} style={styles.bellButton}>
			<Ionicons name="notifications-outline" size={24} color={Colors.black} />
			{count > 0 && (
				<View style={styles.badge}>
					<Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
				</View>
			)}
		</Pressable>
	);
}

function HeaderAvatar({
	profile,
	onPress,
}: {
	profile: User | null;
	onPress: () => void;
}) {
	const initial = useMemo(() => {
		const source = profile?.profile_name ?? profile?.username ?? "?";
		return source.charAt(0).toUpperCase();
	}, [profile]);

	return (
		<Pressable onPress={onPress} style={styles.avatarButton}>
			{profile?.avatar_url ? (
				<Image
					source={{ uri: profile.avatar_url }}
					style={styles.avatarImage}
				/>
			) : (
				<View style={styles.avatarFallback}>
					<Text style={styles.avatarInitial}>{initial || "?"}</Text>
				</View>
			)}
		</Pressable>
	);
}

// タブレイアウト（ホーム / マップ）
export default function TabLayout() {
	const router = useRouter();
	const pathname = usePathname();
	const [profile, setProfile] = useState<User | null>(null);
	const [unreadBadge, setUnreadBadge] = useState(0);

	useFocusEffect(
		useCallback(() => {
			void getUnreadCount().then(setUnreadBadge);
		}, []),
	);

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

	const fetchProfile = useCallback(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			setProfile(null);
			return;
		}

		const { data } = await supabase
			.from("users")
			.select("*")
			.eq("id", user.id)
			.maybeSingle();

		if (data) {
			const avatarUrl = await resolveAvatarDisplayUrl(data.avatar_url);
			setProfile({ ...data, avatar_url: avatarUrl });
			return;
		}

		const fallbackAvatarUrl = await resolveAvatarDisplayUrl(
			(user.user_metadata?.avatar_url as string | undefined) ?? null,
		);
		setProfile({
			id: user.id,
			username: (user.user_metadata?.username as string | undefined) ?? null,
			profile_name:
				(user.user_metadata?.profile_name as string | undefined) ??
				user.email?.split("@")[0] ??
				null,
			email: user.email ?? null,
			avatar_url: fallbackAvatarUrl,
			expo_push_token: null,
			created_at: null,
			updated_at: null,
			deleted_at: null,
		});
	}, [resolveAvatarDisplayUrl]);

	useEffect(() => {
		void pathname;
		fetchProfile();
	}, [fetchProfile, pathname]);

	useEffect(() => {
		void registerPushToken();
	}, []);

	return (
		<Tabs
			screenOptions={{
				headerShown: true,
				tabBarActiveTintColor: Colors.tabBarActive,
				tabBarInactiveTintColor: Colors.tabBarInactive,
				tabBarStyle: styles.tabBar,
				tabBarLabelStyle: styles.tabBarLabel,
				headerRight: () => (
					<View style={styles.headerRightContainer}>
						<NotificationBell
							count={unreadBadge}
							onPress={() => router.push("/notifications")}
						/>
						<HeaderAvatar
							profile={profile}
							onPress={() => router.push("/profile")}
						/>
					</View>
				),
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "ホーム",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="home" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="map"
				options={{
					title: "マップ",
					headerShown: false,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="map" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}

const styles = StyleSheet.create({
	tabBar: {
		backgroundColor: Colors.white,
		borderTopWidth: 1,
		borderTopColor: Colors.grayLighter,
		height: 88,
		paddingBottom: 28,
		paddingTop: 8,
	},
	tabBarLabel: {
		fontSize: 12,
		fontWeight: "600",
	},
	avatarButton: {
		marginRight: 12,
		padding: 2,
	},
	avatarImage: {
		width: 34,
		height: 34,
		borderRadius: 17,
		borderWidth: 1,
		borderColor: Colors.grayLighter,
	},
	avatarFallback: {
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: Colors.primary,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarInitial: {
		fontSize: 14,
		fontWeight: "700",
		color: Colors.white,
	},
	headerRightContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	bellButton: {
		padding: 6,
		position: "relative",
	},
	badge: {
		position: "absolute",
		top: 2,
		right: 2,
		backgroundColor: Colors.danger,
		borderRadius: 8,
		minWidth: 16,
		height: 16,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 3,
	},
	badgeText: {
		color: Colors.white,
		fontSize: 10,
		fontWeight: "700",
	},
});
