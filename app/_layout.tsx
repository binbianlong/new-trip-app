import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "../src/hooks/useAuth";
import { supabase } from "../src/lib/supabase";

// 認証状態に応じてリダイレクトするコンポーネント
function AuthGuard() {
	const { session, isLoading } = useAuth();
	const segments = useSegments();
	const router = useRouter();
	const [isProfileComplete, setIsProfileComplete] = useState<
		boolean | undefined
	>(undefined);

	useEffect(() => {
		let isMounted = true;

		const checkProfileCompletion = async () => {
			if (!session) {
				if (isMounted) setIsProfileComplete(undefined);
				return;
			}

			const { data, error } = await supabase
				.from("users")
				.select("profile_name,username,avatar_url")
				.eq("id", session.user.id)
				.maybeSingle();

			if (!isMounted) return;
			if (error || !data) {
				setIsProfileComplete(false);
				return;
			}

			const isFilled = (value: string | null) =>
				typeof value === "string" && value.trim().length > 0;
			setIsProfileComplete(
				isFilled(data.profile_name) &&
					isFilled(data.username) &&
					isFilled(data.avatar_url),
			);
		};

		void checkProfileCompletion();
		return () => {
			isMounted = false;
		};
	}, [session]);

	useEffect(() => {
		if (isLoading) return;
		if (session && isProfileComplete === undefined) return;

		// ログイン・オンボーディング画面はガード対象外
		const isAuthScreen =
			segments[0] === "screens" ||
			segments[0] === "login" ||
			segments[0] === "onboarding";
		const isProfileScreen = segments[0] === "profile";
		const isProfileSetupScreen = segments[0] === "profile-setup";

		if (!session && !isAuthScreen) {
			// 未ログイン → ログイン画面へ
			router.replace("/screens/auth/SignInScreen");
		} else if (
			session &&
			isProfileComplete === false &&
			!isProfileScreen &&
			!isProfileSetupScreen
		) {
			// プロフィール未設定 → プロフィール設定画面へ
			router.replace("/profile-setup");
		} else if (session && isProfileComplete && isProfileSetupScreen) {
			// プロフィール設定済みならホームへ
			router.replace("/(tabs)");
		} else if (session && isProfileComplete && isAuthScreen) {
			// ログイン済みでログイン画面にいる → ホームへ
			router.replace("/(tabs)");
		}
	}, [session, isLoading, isProfileComplete, segments, router]);

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
