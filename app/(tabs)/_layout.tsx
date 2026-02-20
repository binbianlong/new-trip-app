import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { Colors } from "../../src/constants/colors";

// タブレイアウト（ホーム / マップ）
export default function TabLayout() {
	return (
		<Tabs
			screenOptions={{
				headerShown: true,
				tabBarActiveTintColor: Colors.tabBarActive,
				tabBarInactiveTintColor: Colors.tabBarInactive,
				tabBarStyle: styles.tabBar,
				tabBarLabelStyle: styles.tabBarLabel,
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
});
