import { makeRedirectUri } from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors } from "../src/constants/colors";
import { supabase } from "../src/lib/supabase"; // パスが正しいか確認してください

// ブラウザを閉じた後にアプリに戻るための設定
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
	const router = useRouter();

	const handleGoogleLogin = async () => {
		try {
			// 1. リダイレクトURLの生成（app.jsonのscheme: "new-trip-app" を使用）
			const redirectUri = makeRedirectUri({
				scheme: "new-trip-app",
			});

			// 2. SupabaseでOAuthログインを開始（URLを取得）
			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: {
					redirectTo: redirectUri,
					skipBrowserRedirect: true,
				},
			});

			if (error) throw error;

			// 3. 取得したURLをWebBrowserで開く
			const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

			// 4. ログイン成功後の処理
			if (res.type === "success") {
				const { url } = res;

				// URLから認証パラメータ（#以降）を解析
				const query = url.split("#")[1];
				const params = new URLSearchParams(query);
				const accessToken = params.get("access_token");
				const refreshToken = params.get("refresh_token");

				if (accessToken && refreshToken) {
					const { error: sessionError } = await supabase.auth.setSession({
						access_token: accessToken,
						refresh_token: refreshToken,
					});
					if (sessionError) throw sessionError;

					// ログイン成功！オンボーディング画面へ
					router.replace("/onboarding");
				}
			}
		} catch (error: any) {
			Alert.alert("エラー", error.message || "ログインに失敗しました");
			console.error(error);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>旅行記録アプリ</Text>
			<Text style={styles.subtitle}>旅の思い出を地図に残そう</Text>

			<Pressable style={styles.googleButton} onPress={handleGoogleLogin}>
				<Text style={styles.googleButtonText}>Googleでサインアップ</Text>
			</Pressable>

			<Pressable
				style={styles.skipButton}
				onPress={() => router.replace("/(tabs)")}
			>
				<Text style={styles.skipButtonText}>スキップ（開発用）</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.white,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
	title: {
		fontSize: 28,
		fontWeight: "bold",
		color: Colors.black,
	},
	subtitle: {
		fontSize: 16,
		color: Colors.gray,
		marginTop: 8,
		marginBottom: 48,
	},
	googleButton: {
		backgroundColor: Colors.white,
		borderWidth: 1,
		borderColor: "#DDD",
		borderRadius: 8,
		paddingVertical: 14,
		paddingHorizontal: 24,
		width: "100%",
		alignItems: "center",
	},
	googleButtonText: {
		fontSize: 16,
		fontWeight: "600",
		color: Colors.black,
	},
	skipButton: {
		marginTop: 16,
		paddingVertical: 12,
	},
	skipButtonText: {
		fontSize: 14,
		color: Colors.gray,
		textDecorationLine: "underline",
	},
});
