import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors } from "../src/constants/colors";

export default function LoginScreen() {
	const router = useRouter();

	const handleGoogleLogin = () => {
		Alert.alert(
			"ログイン成功",
			"Googleアカウントでログインしました！（モック）",
			[{ text: "OK", onPress: () => router.back() }],
		);
	};

	return (
		<View style={styles.container}>
			{/* ロゴ */}
			<View style={styles.logoSection}>
				<View style={styles.logoCircle}>
					<Ionicons name="airplane" size={48} color={Colors.white} />
				</View>
				<Text style={styles.appName}>旅シェア</Text>
				<Text style={styles.appTagline}>
					旅の思い出を{"\n"}みんなで共有しよう
				</Text>
			</View>

			{/* ログインボタン */}
			<View style={styles.buttonSection}>
				<TouchableOpacity
					style={styles.googleButton}
					onPress={handleGoogleLogin}
				>
					<View style={styles.googleIcon}>
						<Text style={styles.googleIconText}>G</Text>
					</View>
					<Text style={styles.googleButtonText}>Googleでログイン</Text>
				</TouchableOpacity>

				<Text style={styles.terms}>
					ログインすることで、利用規約とプライバシーポリシーに同意したことになります。
				</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
		justifyContent: "center",
		padding: 32,
	},
	logoSection: {
		alignItems: "center",
		marginBottom: 60,
	},
	logoCircle: {
		width: 100,
		height: 100,
		borderRadius: 50,
		backgroundColor: Colors.primary,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 20,
		shadowColor: Colors.primary,
		shadowOffset: { width: 0, height: 6 },
		shadowOpacity: 0.3,
		shadowRadius: 12,
		elevation: 8,
	},
	appName: {
		fontSize: 32,
		fontWeight: "800",
		color: Colors.text,
		marginBottom: 8,
	},
	appTagline: {
		fontSize: 16,
		color: Colors.textSecondary,
		textAlign: "center",
		lineHeight: 24,
	},
	buttonSection: {
		gap: 20,
	},
	googleButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: Colors.white,
		borderRadius: 14,
		paddingVertical: 16,
		gap: 12,
		shadowColor: Colors.black,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		elevation: 3,
		borderWidth: 1,
		borderColor: Colors.border,
	},
	googleIcon: {
		width: 28,
		height: 28,
		borderRadius: 14,
		backgroundColor: "#4285F4",
		justifyContent: "center",
		alignItems: "center",
	},
	googleIconText: {
		color: Colors.white,
		fontSize: 16,
		fontWeight: "800",
	},
	googleButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: Colors.text,
	},
	terms: {
		fontSize: 12,
		color: Colors.textLight,
		textAlign: "center",
		lineHeight: 18,
	},
});
