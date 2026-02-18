import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Colors } from "../src/constants/colors";

export default function RootLayout() {
	return (
		<>
			<StatusBar style="dark" />
			<Stack
				screenOptions={{
					headerStyle: {
						backgroundColor: Colors.white,
					},
					headerTintColor: Colors.text,
					headerTitleStyle: {
						fontWeight: "600",
					},
					contentStyle: {
						backgroundColor: Colors.background,
					},
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen
					name="login"
					options={{
						title: "ログイン",
						presentation: "modal",
						headerShown: false,
					}}
				/>
				<Stack.Screen
					name="create"
					options={{
						title: "旅行を作成",
					}}
				/>
				<Stack.Screen
					name="notifications"
					options={{
						title: "通知",
					}}
				/>
				<Stack.Screen
					name="profile"
					options={{
						title: "マイページ",
					}}
				/>
				<Stack.Screen
					name="trip/[id]"
					options={{
						title: "旅行詳細",
					}}
				/>
			</Stack>
		</>
	);
}
