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
								placeholderTextColor={Colors.grayLight}
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
								placeholderTextColor={Colors.grayLight}
								autoCapitalize="none"
							/>
						)}
					/>
					{errors.userName && (
						<Text style={styles.errorText}>{errors.userName.message}</Text>
					)}
				</View>
			</ScrollView>

			<View style={styles.footer}>
				<Pressable
					style={[styles.saveButton, isSaving && styles.disabledButton]}
					onPress={handleSubmit(onSave)}
					disabled={isSaving}
				>
					{isSaving ? (
						<ActivityIndicator size="small" color={Colors.white} />
					) : (
						<Text style={styles.saveButtonText}>保存する</Text>
					)}
				</Pressable>
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.white,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.white,
	},
	content: {
		paddingHorizontal: 24,
		paddingTop: 64,
		paddingBottom: 24,
	},
	title: {
		fontSize: 28,
		fontWeight: "700",
		color: Colors.black,
	},
	subtitle: {
		fontSize: 14,
		color: Colors.gray,
		marginTop: 8,
		marginBottom: 24,
		lineHeight: 20,
	},
	avatarButton: {
		width: 120,
		height: 120,
		borderRadius: 60,
		backgroundColor: Colors.grayLighter,
		alignSelf: "center",
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
		borderWidth: 2,
		borderColor: "transparent",
	},
	avatarButtonError: {
		borderColor: Colors.danger,
	},
	avatarImage: {
		width: "100%",
		height: "100%",
	},
	avatarPlaceholder: {
		fontSize: 14,
		fontWeight: "600",
		color: Colors.gray,
	},
	field: {
		marginTop: 20,
	},
	label: {
		fontSize: 14,
		fontWeight: "600",
		color: Colors.black,
		marginBottom: 8,
	},
	input: {
		borderWidth: 1,
		borderColor: Colors.grayLight,
		borderRadius: 12,
		padding: 14,
		fontSize: 16,
		color: Colors.black,
	},
	inputError: {
		borderColor: Colors.danger,
	},
	errorText: {
		fontSize: 12,
		color: Colors.danger,
		marginTop: 8,
	},
	footer: {
		paddingHorizontal: 24,
		paddingBottom: 32,
		paddingTop: 12,
		borderTopWidth: 1,
		borderTopColor: Colors.grayLighter,
	},
	saveButton: {
		backgroundColor: Colors.primary,
		borderRadius: 14,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
	},
	saveButtonText: {
		fontSize: 16,
		fontWeight: "700",
		color: Colors.white,
	},
	disabledButton: {
		opacity: 0.65,
	},
});
