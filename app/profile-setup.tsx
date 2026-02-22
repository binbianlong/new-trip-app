import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import {
	ActivityIndicator,
	Alert,
	Image,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { Colors } from "../src/constants/colors";
import { supabase } from "../src/lib/supabase";
import type { User } from "../src/types";

const AVATAR_BUCKET =
	process.env.EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET ?? "photos";
const PROFILE_SETUP_REQUIRED_KEY = "profile_setup_required";

type ProfileFormData = {
	profileName: string;
	userName: string;
};

export default function ProfileSetupScreen() {
	const router = useRouter();
	const [profile, setProfile] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [avatarImage, setAvatarImage] = useState<string | null>(null);
	const [avatarError, setAvatarError] = useState(false);

	const {
		control,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<ProfileFormData>({
		defaultValues: {
			profileName: "",
			userName: "",
		},
	});

	const resolveAvatarDisplayUrl = useCallback(async (raw: string | null) => {
		if (!raw) return null;
		if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
			const { data, error } = await supabase.storage
				.from(AVATAR_BUCKET)
				.createSignedUrl(raw, 60 * 60);
			if (!error && data?.signedUrl) return data.signedUrl;
			const { data: publicData } = supabase.storage
				.from(AVATAR_BUCKET)
				.getPublicUrl(raw);
			return publicData.publicUrl;
		}
		return raw;
	}, []);

	const fetchProfile = useCallback(async () => {
		setIsLoading(true);
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			setProfile(null);
			setIsLoading(false);
			return;
		}

		const { data } = await supabase
			.from("users")
			.select("*")
			.eq("id", user.id)
			.maybeSingle();

		const resolvedProfile: User = data ?? {
			id: user.id,
			username: (user.user_metadata?.username as string | undefined) ?? null,
			profile_name:
				(user.user_metadata?.profile_name as string | undefined) ??
				user.email?.split("@")[0] ??
				null,
			email: user.email ?? null,
			avatar_url:
				(user.user_metadata?.avatar_url as string | undefined) ?? null,
			created_at: null,
			updated_at: null,
			deleted_at: null,
		};

		setProfile(resolvedProfile);
		const resolvedAvatarUrl = await resolveAvatarDisplayUrl(
			resolvedProfile.avatar_url,
		);
		setAvatarImage(resolvedAvatarUrl);
		reset({
			profileName: resolvedProfile.profile_name ?? "",
			userName: resolvedProfile.username ?? "",
		});
		setIsLoading(false);
	}, [reset, resolveAvatarDisplayUrl]);

	useEffect(() => {
		void fetchProfile();
	}, [fetchProfile]);

	const pickImage = useCallback(async () => {
		Alert.alert("プロフィール写真", "どこから写真を選びますか？", [
			{
				text: "カメラで撮影",
				onPress: async () => {
					const result = await ImagePicker.launchCameraAsync({
						allowsEditing: true,
						aspect: [1, 1],
						quality: 0.9,
					});
					if (!result.canceled) {
						setAvatarImage(result.assets[0].uri);
						setAvatarError(false);
					}
				},
			},
			{
				text: "写真ライブラリから選択",
				onPress: async () => {
					const result = await ImagePicker.launchImageLibraryAsync({
						allowsEditing: true,
						aspect: [1, 1],
						quality: 0.9,
					});
					if (!result.canceled) {
						setAvatarImage(result.assets[0].uri);
						setAvatarError(false);
					}
				},
			},
			{ text: "キャンセル", style: "cancel" },
		]);
	}, []);

	const uploadAvatarIfNeeded = useCallback(
		async (uri: string, userId: string) => {
			if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;

			const fileName = `${userId}/${Date.now()}.jpg`;
			const fileResponse = await fetch(uri);
			const fileArrayBuffer = await fileResponse.arrayBuffer();

			const { error: uploadError } = await supabase.storage
				.from(AVATAR_BUCKET)
				.upload(fileName, fileArrayBuffer, {
					contentType: "image/jpeg",
				});

			if (uploadError) {
				throw new Error(
					`Storage upload failed: ${uploadError.message} (bucket=${AVATAR_BUCKET}, path=${fileName})`,
				);
			}

			return fileName;
		},
		[],
	);

	const onSave: SubmitHandler<ProfileFormData> = async (formData) => {
		if (!profile?.id) return;
		if (!avatarImage) {
			setAvatarError(true);
			Alert.alert("エラー", "プロフィール写真を選択してください。");
			return;
		}

		setIsSaving(true);
		try {
			const avatarUrl = await uploadAvatarIfNeeded(avatarImage, profile.id);
			const payload = {
				profile_name: formData.profileName.trim() || null,
				username: formData.userName.trim() || null,
				avatar_url: avatarUrl,
			};

			const { error } = await supabase.from("users").upsert(
				{
					id: profile.id,
					email: profile.email ?? null,
					...payload,
				},
				{ onConflict: "id" },
			);

			if (error) {
				Alert.alert(
					"保存エラー",
					`プロフィールの更新に失敗しました: ${error.message}`,
				);
				return;
			}

			await supabase.auth.updateUser({ data: payload });
			await AsyncStorage.removeItem(PROFILE_SETUP_REQUIRED_KEY);
			router.replace("/(tabs)");
		} catch (error) {
			Alert.alert(
				"保存エラー",
				error instanceof Error
					? error.message
					: "プロフィール画像のアップロードに失敗しました",
			);
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="large" color={Colors.primary} />
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				<Text style={styles.title}>プロフィール設定</Text>
				<Text style={styles.subtitle}>
					ホーム画面へ進む前にプロフィール情報を保存してください。
				</Text>

				<Pressable
					style={[styles.avatarButton, avatarError && styles.avatarButtonError]}
					onPress={pickImage}
				>
					{avatarImage ? (
						<Image source={{ uri: avatarImage }} style={styles.avatarImage} />
					) : (
						<Text style={styles.avatarPlaceholder}>写真を選択</Text>
					)}
				</Pressable>
				{avatarError && (
					<Text style={styles.errorText}>
						プロフィール写真を選択してください。
					</Text>
				)}

				<View style={styles.field}>
					<Text style={styles.label}>プロフィールネーム</Text>
					<Controller
						control={control}
						name="profileName"
						rules={{ required: "入力してください" }}
						render={({ field: { onChange, onBlur, value } }) => (
							<TextInput
								style={[styles.input, errors.profileName && styles.inputError]}
								onChangeText={onChange}
								onBlur={onBlur}
								value={value}
								placeholder="表示名を入力"
								placeholderTextColor="#999"
							/>
						)}
					/>
					{errors.profileName && (
						<Text style={styles.errorText}>{errors.profileName.message}</Text>
					)}
				</View>

				<View style={styles.field}>
					<Text style={styles.label}>ユーザーネーム</Text>
					<Controller
						control={control}
						name="userName"
						rules={{ required: "入力してください" }}
						render={({ field: { onChange, onBlur, value } }) => (
							<TextInput
								style={[styles.input, errors.userName && styles.inputError]}
								onChangeText={onChange}
								onBlur={onBlur}
								value={value}
								placeholder="ユーザーIDを入力"
								placeholderTextColor="#999"
								autoCapitalize="none"
							/>
						)}
					/>
					{errors.userName && (
						<Text style={styles.errorText}>{errors.userName.message}</Text>
					)}
				</View>

				<Pressable
					style={[styles.saveButton, isSaving && styles.disabledButton]}
					onPress={handleSubmit(onSave)}
					disabled={isSaving}
				>
					{isSaving ? (
						<ActivityIndicator size="small" color="#4A7C59" />
					) : (
						<Text style={styles.saveButtonText}>保存する</Text>
					)}
				</Pressable>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#FFFFFF",
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#FFFFFF",
	},
	content: {
		paddingHorizontal: 20,
		paddingTop: 70,
		paddingBottom: 40,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#333333",
	},
	subtitle: {
		fontSize: 14,
		color: "#666666",
		marginTop: 8,
		marginBottom: 24,
		lineHeight: 20,
	},
	avatarButton: {
		width: 120,
		height: 120,
		borderRadius: 60,
		backgroundColor: "#FFFFFF",
		alignSelf: "center",
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
		borderWidth: 3,
		borderColor: "#4A7C59",
	},
	avatarButtonError: {
		borderColor: "#FF6B6B",
	},
	avatarImage: {
		width: "100%",
		height: "100%",
	},
	avatarPlaceholder: {
		fontSize: 14,
		fontWeight: "600",
		color: "#4A7C59",
	},
	field: {
		marginTop: 16,
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
		fontSize: 12,
		color: "#FF6B6B",
		marginTop: 4,
	},
	saveButton: {
		backgroundColor: "#C6FFCA",
		borderRadius: 8,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 24,
		borderWidth: 1,
		borderColor: "#4A7C59",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 2,
	},
	saveButtonText: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#4A7C59",
	},
	disabledButton: {
		opacity: 0.6,
	},
});
