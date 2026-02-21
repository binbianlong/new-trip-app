// app/components/User/Splash_screen.tsx
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export const SplashScreen = () => {
	return (
		<View style={styles.loadingContainer}>
			<ActivityIndicator size="large" color="#0000ff" />
			<Text style={styles.loadingText}>データを読み込み中...</Text>
			<Text style={styles.subText}>5秒間お待ちください</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#ffffff",
	},
	loadingText: {
		marginTop: 10,
		fontSize: 18,
		fontWeight: "bold",
	},
	subText: {
		marginTop: 5,
		color: "#888",
	},
});
