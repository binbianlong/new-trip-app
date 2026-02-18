import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Colors } from "../../src/constants/colors";

export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: Colors.tabActive,
				tabBarInactiveTintColor: Colors.tabInactive,
				tabBarStyle: {
					backgroundColor: Colors.white,
					borderTopColor: Colors.border,
					height: 88,
					paddingTop: 8,
				},
				tabBarLabelStyle: {
					fontSize: 12,
					fontWeight: "600",
				},
				headerStyle: {
					backgroundColor: Colors.white,
				},
				headerTitleStyle: {
					fontWeight: "700",
					fontSize: 18,
				},
				headerTintColor: Colors.text,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "ホーム",
					headerShown: false,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="home" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="map"
				options={{
					title: "マップ",
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="map" size={size} color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
