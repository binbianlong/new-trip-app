// app/components/User/Splash_screen.tsx

import * as Font from "expo-font";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export const SplashScreen = () => {
	const [dots, setDots] = useState("");
	const [pawsCount, setPawsCount] = useState(0);
	const [fontLoaded, setFontLoaded] = useState(false);

	useEffect(() => {
		const loadFont = async () => {
			try {
				await Font.loadAsync({
					keifont: require("../../../assets/fonts/keifont.ttf"),
				});
			} catch (e) {
				console.warn("Font loading failed", e);
			} finally {
				setFontLoaded(true);
			}
		};
		loadFont();

		const dotsInterval = setInterval(() => {
			setDots((prev) => (prev === "..." ? "" : `${prev}.`));
		}, 300);

		const pawsInterval = setInterval(() => {
			setPawsCount((prev) => (prev >= 5 ? 0 : prev + 1));
		}, 700);

		return () => {
			clearInterval(dotsInterval);
			clearInterval(pawsInterval);
		};
	}, []);

	if (!fontLoaded) return null;

	return (
		<View style={styles.loadingContainer}>
			{/* 肉球セクション (位置固定) */}
			{pawsCount >= 1 && (
				<Text
					style={[
						styles.paws,
						{
							bottom: "15%",
							left: "15%",
							fontSize: 32,
							transform: [{ rotate: "10deg" }],
						},
					]}
				>
					🐾
				</Text>
			)}
			{pawsCount >= 2 && (
				<Text
					style={[
						styles.paws,
						{
							bottom: "25%",
							left: "30%",
							fontSize: 45,
							transform: [{ rotate: "5deg" }],
						},
					]}
				>
					🐾
				</Text>
			)}
			{pawsCount >= 3 && (
				<Text
					style={[
						styles.paws,
						{
							top: "55%",
							left: "43%",
							fontSize: 72,
							transform: [{ rotate: "-10deg" }],
						},
					]}
				>
					🐾
				</Text>
			)}
			{pawsCount >= 4 && (
				<Text
					style={[
						styles.paws,
						{
							top: "32%",
							right: "25%",
							fontSize: 90,
							transform: [{ rotate: "-15deg" }],
						},
					]}
				>
					🐾
				</Text>
			)}
			{pawsCount >= 5 && (
				<Text
					style={[
						styles.paws,
						{
							top: "12%",
							right: "45%",
							fontSize: 120,
							transform: [{ rotate: "-25deg" }],
						},
					]}
				>
					🐾
				</Text>
			)}

			<View style={styles.centerContent}>
				<Text style={styles.brandName}>あしあと</Text>

				<View style={styles.loadingWrapper}>
					{/* 修正ポイント：左側の空白を狭くした */}
					<View style={styles.dummySpace} />

					<Text style={styles.loadingText}>ロード中</Text>

					{/* 修正ポイント：ドットの開始位置とコンテナ幅を狭くした */}
					<View style={styles.dotsContainer}>
						<Text style={styles.loadingText}>{dots}</Text>
					</View>
				</View>
			</View>
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
	centerContent: {
		alignItems: "center",
		zIndex: 1,
	},
	brandName: {
		fontFamily: "keifont",
		fontSize: 60,
		color: "#000",
		marginBottom: 10,
	},
	loadingWrapper: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	loadingText: {
		fontSize: 18,
		fontWeight: "600",
		color: "#333",
		fontFamily: "System",
	},
	dummySpace: {
		// dotsContainerと同じ幅にして中央を維持
		width: 25,
	},
	dotsContainer: {
		// 幅を 50 → 25 に、paddingLeft を 10 → 2 に変更して文字に寄せた
		width: 25,
		justifyContent: "flex-start",
		paddingLeft: 2,
	},
	paws: {
		position: "absolute",
		color: "#555",
		opacity: 0.3,
	},
});
