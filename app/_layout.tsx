import { Stack } from "expo-router";

// ルートレイアウト (Stack)
export default function RootLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(tabs)" options={{ title: "" }} />
			<Stack.Screen name="login" options={{ headerShown: false }} />

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
		</Stack>
	);
}
