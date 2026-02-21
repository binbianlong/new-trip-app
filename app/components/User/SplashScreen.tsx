// app/components/User/Splash_screen.tsx
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export const SplashScreen = () => {
	const [dots, setDots] = useState("");
	const [pawsCount, setPawsCount] = useState(0);

	useEffect(() => {
		// --- ドット用タイマー (300ms) ---
		const dotsInterval = setInterval(() => {
			setDots((prev) => {
				if (prev === "...") {
					return "";
				} else {
					return `${prev}.`;
				}
			});
		}, 300);

		// --- 足跡用タイマー (700ms) ---
		const pawsInterval = setInterval(() => {
			setPawsCount((prev) => {
				if (prev >= 5) {
					return 0;
				} else {
					return prev + 1;
				}
			});
		}, 700);

		return () => {
			clearInterval(dotsInterval);
			clearInterval(pawsInterval);
		};
	}, []);

	return (
		<View style={styles.loadingContainer}>
			{/* --- 肉球の配置セクション (位置・サイズ固定) --- */}
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
			{/* ---------------------------- */}

			<View style={styles.centerContent}>
				<Text style={styles.brandName}>あしあと</Text>

				<View style={styles.loadingWrapper}>
					{/* 中心を保つための透明なダミー。ドットと同じ幅（30px）にする */}
					<View style={styles.dummySpace} />

					<Text style={styles.loadingText}>ロード中</Text>

					{/* ドット本体。ここが 30px の固定幅を持つので、ドットが増えても全体が揺れません */}
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
		fontSize: 54,
		fontWeight: "bold",
		color: "#000",
		marginBottom: 10,
	},
	loadingWrapper: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	loadingText: {
		fontSize: 20,
		fontWeight: "600",
		color: "#333",
		fontFamily: "System",
	},
	dummySpace: {
		width: 30, // dotsContainerと同じ幅にする
	},
	dotsContainer: {
		width: 30, // ドット3つ分（...）が入るのに十分な幅を固定
		justifyContent: "flex-start",
	},
	paws: {
		position: "absolute",
		color: "#555",
		opacity: 0.3,
	},
});
