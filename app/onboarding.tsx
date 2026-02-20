import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
	Alert,
	Image,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	TouchableWithoutFeedback,
	View,
} from "react-native";

type FormData = {
	profileName: string;
	userName: string;
};

export default function OnboardingScreen() {
	const router = useRouter();
	const [image, setImage] = useState<string | null>(null);
	const [imageError, setImageError] = useState(false);

	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<FormData>({
		defaultValues: {
			profileName: "",
			userName: "",
		},
	});

	const pickImage = async () => {
		Alert.alert("プロフィール写真", "どこから写真を選びますか？", [
			{
				text: "カメラで撮影",
				onPress: async () => {
					const result = await ImagePicker.launchCameraAsync({
						allowsEditing: true,
						aspect: [1, 1],
						quality: 1,
					});
					if (!result.canceled) {
						setImage(result.assets[0].uri);
						setImageError(false);
					}
				},
			},
			{
				text: "写真ライブラリから選択",
				onPress: async () => {
					const result = await ImagePicker.launchImageLibraryAsync({
						allowsEditing: true,
						aspect: [1, 1],
						quality: 1,
					});
					if (!result.canceled) {
						setImage(result.assets[0].uri);
						setImageError(false);
					}
				},
			},
			{ text: "キャンセル", style: "cancel" },
		]);
	};

	const onSubmit = (data: FormData) => {
		if (!image) {
			setImageError(true);
			Alert.alert("エラー", "プロフィール写真を選択してください。");
			return;
		}
		console.log("保存データ:", { ...data, profileImage: image });
		router.replace("/(tabs)");
	};

	return (
		<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.container}
			>
				<View style={styles.header}>
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Text style={styles.backIcon}>←</Text>
					</Pressable>
					<Text style={styles.header_1}>あしあとへようこそ！</Text>
				</View>

				<View style={styles.card}>
					<Text style={styles.sectionTitle}>☆ユーザー情報入力☆</Text>
					<View style={styles.avatarSection}>
						<Pressable
							style={[styles.avatarCircle, imageError && styles.avatarError]}
							onPress={pickImage}
						>
							{image ? (
								<Image source={{ uri: image }} style={styles.avatarImage} />
							) : (
								<Ionicons name="camera-outline" size={48} color="#FFF" />
							)}
						</Pressable>
						{imageError && (
							<Text style={styles.errorTextSmall}>写真を選択してください</Text>
						)}
					</View>

					<Text style={styles.label}>プロフィールネーム</Text>
					<Controller
						control={control}
						rules={{ required: "入力してください" }}
						render={({ field: { onChange, value } }) => (
							<TextInput
								style={[styles.input, errors.profileName && styles.inputError]}
								onChangeText={onChange}
								value={value}
								placeholder="表示名を入力"
								placeholderTextColor="#A9A9A9"
							/>
						)}
						name="profileName"
					/>

					<Text style={styles.label}>ユーザーネーム</Text>
					<Controller
						control={control}
						rules={{ required: "入力してください" }}
						render={({ field: { onChange, value } }) => (
							<TextInput
								style={[styles.input, errors.userName && styles.inputError]}
								onChangeText={onChange}
								value={value}
								placeholder="ユーザーIDを入力"
								placeholderTextColor="#A9A9A9"
								autoCapitalize="none"
							/>
						)}
						name="userName"
					/>
				</View>

				<Pressable style={styles.submitButton} onPress={handleSubmit(onSubmit)}>
					<Text style={styles.submitButtonText}>完了</Text>
				</Pressable>
			</KeyboardAvoidingView>
		</TouchableWithoutFeedback>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#FFFFFF",
		paddingHorizontal: 20,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		marginTop: 70,
		marginBottom: 20,
		height: 40,
		position: "relative",
	},
	backButton: {
		position: "absolute",
		left: 0,
		padding: 10,
		zIndex: 10,
	},
	backIcon: {
		fontSize: 24,
		color: "#333",
	},
	header_1: {
		flex: 1,
		fontSize: 22,
		fontFamily: "Keifont",
		color: "#333",
		textAlign: "center",
	},
	// 追加した見出しのスタイル
	sectionTitle: {
		fontSize: 18,
		fontFamily: "Keifont",
		color: "#666",
		textAlign: "center",
		marginBottom: 10,
	},
	card: {
		backgroundColor: "#E2F9E5",
		borderRadius: 24,
		padding: 24,
		paddingTop: 30,
		marginBottom: 40,
	},
	avatarSection: {
		alignItems: "center",
		marginBottom: 25,
	},
	avatarCircle: {
		width: 90,
		height: 90,
		borderRadius: 45,
		backgroundColor: "#4A674D",
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
		borderWidth: 2,
		borderColor: "transparent",
	},
	avatarError: {
		borderColor: "#FF6B6B",
	},
	avatarImage: {
		width: "100%",
		height: "100%",
	},
	errorTextSmall: {
		color: "#FF6B6B",
		fontSize: 12,
		marginTop: 5,
		fontFamily: "Keifont",
	},
	label: {
		fontSize: 16,
		fontFamily: "Keifont",
		color: "#4A674D",
		marginBottom: 8,
	},
	input: {
		backgroundColor: "#FFFFFF",
		borderRadius: 30,
		height: 50,
		paddingHorizontal: 20,
		fontSize: 16,
		marginBottom: 20,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.1,
		shadowRadius: 2,
		elevation: 2,
	},
	inputError: {
		borderColor: "#FF6B6B",
		borderWidth: 1,
	},
	submitButton: {
		width: "60%",
		alignSelf: "center",
		borderWidth: 2,
		borderColor: "#4A674D",
		borderRadius: 30,
		paddingVertical: 14,
		alignItems: "center",
	},
	submitButtonText: {
		color: "#4A674D",
		fontSize: 18,
		fontFamily: "Keifont",
	},
});
