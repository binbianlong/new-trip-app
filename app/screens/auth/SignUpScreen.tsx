import "react-native-url-polyfill/auto";
import type { JwtPayload } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../../src/lib/supabase";
import SignUp from "../../components/SignUp";
import { SplashScreen } from "../../components/User/SplashScreen";

export default function App() {
	const [claims, setClaims] = useState<JwtPayload | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// データ取得処理
		const fetchData = async () => {
			const { data } = await supabase.auth.getClaims();
			if (data) {
				setClaims(data.claims);
			}
		};

		fetchData();
	}, []);

	return (
		<SafeAreaView style={styles.safeArea}>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{/* ロゴエリア */}
				<View style={styles.logoArea}>
					<Text style={styles.logoIcon}>🐾</Text>
					<Text style={styles.logoText}>あしあと</Text>
				</View>

				{/* サインアップフォームコンポーネント */}
				<SignUp />

				{/* デバッグ情報（必要なければここを削除してください） */}
				{claims && (
					<View style={styles.debugInfo}>
						<Text style={styles.debugLabel}>ログイン中のID:</Text>
						<Text style={styles.debugText}>{claims.sub}</Text>
					</View>
				)}
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: "#FDFDFD", // ほぼ白の背景
	},
	scrollContent: {
		flexGrow: 1,
		alignItems: "center",
		paddingTop: 60,
		paddingBottom: 40,
	},
	logoArea: {
		alignItems: "center",
		marginBottom: 50,
	},
	logoIcon: {
		// フォントサイズ変更可能
		fontSize: 120,
		// 左右反転可能（scaleX: -1）、角度調整可能（0-360度、例: '45deg' で45度回転）
		transform: [{ scaleX: -1 }, { rotate: "-25deg" }],
	},
	logoText: {
		// フォントサイズ変更可能
		fontSize: 32,
		fontWeight: "900", // デザイン案に合わせて太め
		color: "#000000", // 🐾の色に合わせて黒に統一
		marginTop: 8,
		letterSpacing: 4,
		fontFamily: "Keifont",
	},
	debugInfo: {
		marginTop: 50,
		padding: 16,
		backgroundColor: "#F0F0F0",
		borderRadius: 12,
		width: "80%",
	},
	debugLabel: {
		fontSize: 10,
		color: "#666",
		fontWeight: "bold",
	},
	debugText: {
		fontSize: 10,
		color: "#666",
	},
});
