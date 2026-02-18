import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "../src/constants/colors";
import { mockUser } from "../src/data/mock";

export default function ProfileScreen() {
	const router = useRouter();

	return (
		<View style={styles.container}>
			{/* プロフィールカード */}
			<View style={styles.profileCard}>
				<View style={styles.avatar}>
					<Ionicons name="person" size={44} color={Colors.white} />
				</View>
				<Text style={styles.displayName}>{mockUser.displayName}</Text>
				<Text style={styles.username}>@{mockUser.username}</Text>
				<Text style={styles.userId}>ID: {mockUser.id}</Text>

				<View style={styles.statsRow}>
					<View style={styles.statItem}>
						<Text style={styles.statNumber}>{mockUser.tripsCount}</Text>
						<Text style={styles.statLabel}>旅行</Text>
					</View>
					<View style={styles.statDivider} />
					<View style={styles.statItem}>
						<Text style={styles.statNumber}>{mockUser.photosCount}</Text>
						<Text style={styles.statLabel}>写真</Text>
					</View>
				</View>
			</View>

			{/* メニュー */}
			<View style={styles.menuSection}>
				<TouchableOpacity
					style={styles.menuItem}
					onPress={() => router.push("/notifications")}
				>
					<Ionicons
						name="notifications-outline"
						size={22}
						color={Colors.text}
					/>
					<Text style={styles.menuText}>通知設定</Text>
					<Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
				</TouchableOpacity>

				<View style={styles.menuDivider} />

				<TouchableOpacity style={styles.menuItem}>
					<Ionicons name="share-social-outline" size={22} color={Colors.text} />
					<Text style={styles.menuText}>招待リンク</Text>
					<Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
				</TouchableOpacity>

				<View style={styles.menuDivider} />

				<TouchableOpacity style={styles.menuItem}>
					<Ionicons name="settings-outline" size={22} color={Colors.text} />
					<Text style={styles.menuText}>設定</Text>
					<Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
				</TouchableOpacity>

				<View style={styles.menuDivider} />

				<TouchableOpacity
					style={styles.menuItem}
					onPress={() => router.push("/login")}
				>
					<Ionicons name="log-out-outline" size={22} color={Colors.error} />
					<Text style={[styles.menuText, { color: Colors.error }]}>
						ログアウト
					</Text>
					<Ionicons name="chevron-forward" size={20} color={Colors.textLight} />
				</TouchableOpacity>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
	},
	profileCard: {
		backgroundColor: Colors.white,
		margin: 16,
		borderRadius: 20,
		padding: 24,
		alignItems: "center",
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 8,
		elevation: 3,
	},
	avatar: {
		width: 84,
		height: 84,
		borderRadius: 42,
		backgroundColor: Colors.primaryLight,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 14,
	},
	displayName: {
		fontSize: 22,
		fontWeight: "800",
		color: Colors.text,
		marginBottom: 4,
	},
	username: {
		fontSize: 15,
		color: Colors.textSecondary,
		marginBottom: 2,
	},
	userId: {
		fontSize: 12,
		color: Colors.textLight,
		marginBottom: 20,
	},
	statsRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 32,
	},
	statItem: {
		alignItems: "center",
	},
	statNumber: {
		fontSize: 24,
		fontWeight: "800",
		color: Colors.primary,
	},
	statLabel: {
		fontSize: 12,
		color: Colors.textSecondary,
		marginTop: 2,
	},
	statDivider: {
		width: 1,
		height: 32,
		backgroundColor: Colors.border,
	},
	menuSection: {
		backgroundColor: Colors.white,
		marginHorizontal: 16,
		borderRadius: 16,
		overflow: "hidden",
	},
	menuItem: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		gap: 14,
	},
	menuText: {
		flex: 1,
		fontSize: 15,
		fontWeight: "500",
		color: Colors.text,
	},
	menuDivider: {
		height: 1,
		backgroundColor: Colors.background,
		marginLeft: 52,
	},
});
