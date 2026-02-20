import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "../src/hooks/useAuth";

const PROFILE_SETUP_REQUIRED_KEY = "profile_setup_required";

// 認証状態に応じてリダイレクトするコンポーネント
function AuthGuard() {
	const { session, isLoading } = useAuth();
	const segments = useSegments();
	const router = useRouter();

	useEffect(() => {
		if (isLoading) return;
		let isMounted = true;

		const handleNavigation = async () => {
			const setupRequired =
				(await AsyncStorage.getItem(PROFILE_SETUP_REQUIRED_KEY)) === "1";

			if (!isMounted) return;

			// ログイン・オンボーディング画面はガード対象外
			const isAuthScreen =
				segments[0] === "screens" ||
				segments[0] === "login" ||
				segments[0] === "onboarding";
			const isProfileSetupScreen = segments[0] === "profile-setup";

			if (!session && !isAuthScreen) {
				// 未ログイン → ログイン画面へ
				router.replace("/screens/auth/SignInScreen");
			} else if (session && setupRequired && !isProfileSetupScreen) {
				// サインアップ後はプロフィール設定を優先
				router.replace("/profile-setup");
			} else if (session && isAuthScreen) {
				// ログイン済みでログイン画面にいる → ホームへ
				router.replace("/(tabs)");
			}
		};

		void handleNavigation();
		return () => {
			isMounted = false;
		};
	}, [session, isLoading, segments, router]);

	return null;
}

// ルートレイアウト (Stack)
export default function RootLayout() {
	return (
		<>
			<AuthGuard />
			<Stack screenOptions={{ headerShown: false }}>
				<Stack.Screen name="(tabs)" options={{ title: "" }} />
				<Stack.Screen name="login" options={{ headerShown: false }} />
				<Stack.Screen
					name="screens/auth/SignInScreen"
					options={{ headerShown: false }}
				/>
				<Stack.Screen
					name="create"
					options={{ headerShown: true, title: "旅行プラン作成" }}
				/>
				<Stack.Screen
					name="trip/[id]"
					options={{
						headerShown: false,
						presentation: "modal",
					}}
				/>
				<Stack.Screen
					name="profile"
					options={{
						headerShown: false,
						presentation: "modal",
					}}
				/>
				<Stack.Screen
					name="profile-setup"
					options={{
						headerShown: false,
					}}
				/>
				<Stack.Screen
					name="trip/active"
					options={{
						headerShown: false,
						animation: "slide_from_right",
					}}
				/>
			</Stack>
		</>
	);
}
