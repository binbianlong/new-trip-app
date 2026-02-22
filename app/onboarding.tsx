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
	TouchableOpacity,
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
	const [loading, setLoading] = useState(false);

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
		setLoading(true);
		console.log("保存データ:", { ...data, profileImage: image });
		router.replace("/(tabs)");
		setLoading(false);
	};

	return (
		<TouchableWithoutFeedback onPress={Keyboard.dismiss}>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={styles.container}
			>
				<View style={styles.header}>
					<Pressable onPress={() => router.back()} style={styles.backButton}>
						<Ionicons name="arrow-back" size={24} color="#4A7C59" />
					</Pressable>
					<Text style={styles.headerTitle}>プロフィール設定</Text>
				</View>

				<View style={styles.formArea}>
					<View style={styles.avatarSection}>
						<Pressable
							style={[styles.avatarCircle, imageError && styles.avatarError]}
							onPress={pickImage}
						>
							{image ? (
								<Image source={{ uri: image }} style={styles.avatarImage} />
							) : (
								<Ionicons name="camera-outline" size={40} color="#fff" />
							)}
						</Pressable>
						<Text style={styles.avatarHint}>写真を選択</Text>
						{imageError && (
							<Text style={styles.errorText}>写真を選択してください</Text>
						)}
					</View>

					<View style={styles.inputGroup}>
						<Text style={styles.label}>プロフィールネーム</Text>
						<Controller
							control={control}
							rules={{ required: "入力してください" }}
							render={({ field: { onChange, value } }) => (
								<TextInput
									style={[
										styles.input,
										errors.profileName && styles.inputError,
									]}
									onChangeText={onChange}
									value={value}
									placeholder="表示名を入力"
									placeholderTextColor="#999"
								/>
							)}
							name="profileName"
						/>
						{errors.profileName && (
							<Text style={styles.errorText}>{errors.profileName.message}</Text>
						)}
					</View>

					<View style={styles.inputGroup}>
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
									placeholderTextColor="#999"
									autoCapitalize="none"
								/>
							)}
							name="userName"
						/>
						{errors.userName && (
							<Text style={styles.errorText}>{errors.userName.message}</Text>
						)}
					</View>

					<TouchableOpacity
						style={[styles.button, loading && styles.buttonDisabled]}
						onPress={handleSubmit(onSubmit)}
						disabled={loading}
						activeOpacity={0.8}
					>
						<Text style={styles.buttonText}>
							{loading ? "保存中..." : "保存する"}
						</Text>
					</TouchableOpacity>
				</View>
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
		marginBottom: 30,
		height: 40,
	},
	backButton: {
		padding: 8,
		marginRight: 12,
	},
	headerTitle: {
		fontSize: 22,
		fontWeight: "bold",
		color: "#4A7C59",
	},
	formArea: {
		width: "100%",
		paddingHorizontal: 0,
	},
	avatarSection: {
		alignItems: "center",
		marginBottom: 28,
	},
	avatarCircle: {
		width: 100,
		height: 100,
		borderRadius: 50,
		backgroundColor: "#4A7C59",
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
		borderWidth: 3,
		borderColor: "#4A7C59",
	},
	avatarError: {
		borderColor: "#FF6B6B",
	},
	avatarImage: {
		width: "100%",
		height: "100%",
	},
	avatarHint: {
		marginTop: 8,
		fontSize: 13,
		color: "#4A7C59",
		fontWeight: "600",
	},
	inputGroup: {
		marginBottom: 16,
	},
	label: {
		fontSize: 14,
		fontWeight: "bold",
		color: "#4A7C59",
		marginBottom: 6,
	},
	input: {
		borderWidth: 1,
		borderColor: "#4A7C59",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		backgroundColor: "#fff",
	},
	inputError: {
		borderColor: "#FF6B6B",
	},
	errorText: {
		color: "#FF6B6B",
		fontSize: 12,
		marginTop: 4,
	},
	button: {
		backgroundColor: "#C6FFCA",
		borderRadius: 8,
		paddingVertical: 14,
		alignItems: "center",
		marginTop: 20,
		borderWidth: 1,
		borderColor: "#4A7C59",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		color: "#4A7C59",
		fontSize: 18,
		fontWeight: "bold",
	},
});
