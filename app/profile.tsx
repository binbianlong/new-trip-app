import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function ProfileModal() {
	const router = useRouter();
	const [profile, setProfile] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isEditing, setIsEditing] = useState(false);
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
			if (error) {
				console.warn("createSignedUrl failed:", {
					bucket: AVATAR_BUCKET,
					path: raw,
					message: error.message,
				});
			}
			const { data: publicData } = supabase.storage
				.from(AVATAR_BUCKET)
				.getPublicUrl(raw);
			return publicData.publicUrl;
		}

		try {
			const parsed = new URL(raw);
			const match = parsed.pathname.match(
				/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
			);
			if (!match) return raw;
			const [, bucket, objectPathRaw] = match;
			const objectPath = decodeURIComponent(objectPathRaw);
			const { data, error } = await supabase.storage
				.from(bucket)
				.createSignedUrl(objectPath, 60 * 60);
			if (!error && data?.signedUrl) return data.signedUrl;
			if (error) {
				console.warn("createSignedUrl from URL failed:", {
					bucket,
					path: objectPath,
					message: error.message,
				});
			}
			const { data: publicData } = supabase.storage
				.from(bucket)
				.getPublicUrl(objectPath);
			return publicData.publicUrl;
		} catch {
			return raw;
		}
	}, []);

	const fetchProfile = useCallback(async () => {
		setIsLoading(true);

		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			setProfile(null);
			setIsLoading(false);
			return;
		}

		const { data, error } = await supabase
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

		if (error) {
			console.warn("Failed to fetch profile from users table:", error.message);
		}

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
		fetchProfile();
	}, [fetchProfile]);

	const displayName = useMemo(
		() => profile?.profile_name ?? profile?.username ?? "未設定ユーザー",
		[profile],
	);

	const initial = useMemo(
		() => displayName.charAt(0).toUpperCase(),
		[displayName],
	);

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
			if (uri.startsWith("http://") || uri.startsWith("https://")) {
				return uri;
			}

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

			const fileLeafName = fileName.split("/").pop() ?? "";
			const { data: listed, error: listError } = await supabase.storage
				.from(AVATAR_BUCKET)
				.list(userId, { search: fileLeafName, limit: 10 });
			if (listError) {
				throw new Error(
					`Storage verify failed: ${listError.message} (bucket=${AVATAR_BUCKET}, path=${fileName})`,
				);
			}

			const exists = (listed ?? []).some((item) => item.name === fileLeafName);
			if (!exists) {
				throw new Error(
					`Storage verify failed: uploaded object not found (bucket=${AVATAR_BUCKET}, path=${fileName})`,
				);
			}

			console.log("Avatar uploaded:", {
				bucket: AVATAR_BUCKET,
				path: fileName,
			});
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

			const { data: upsertedUser, error } = await supabase
				.from("users")
				.upsert(
					{
						id: profile.id,
						email: profile.email ?? null,
						...payload,
					},
					{ onConflict: "id" },
				)
				.select("*")
				.maybeSingle();

			if (error) {
				console.warn("Profile update failed:", error);
				Alert.alert(
					"保存エラー",
					`プロフィールの更新に失敗しました: ${error.message}`,
				);
				return;
			}
			if (!upsertedUser) {
				Alert.alert(
					"保存エラー",
					"プロフィールの保存結果を取得できませんでした。RLSのSELECT policyを確認してください。",
				);
				return;
			}

			const { error: authUpdateError } = await supabase.auth.updateUser({
				data: {
					profile_name: payload.profile_name,
					username: payload.username,
					avatar_url: payload.avatar_url,
				},
			});

			if (authUpdateError) {
				console.warn("Auth metadata update failed:", authUpdateError);
			}

			setProfile(upsertedUser);
			const resolvedAvatarUrl = await resolveAvatarDisplayUrl(
				upsertedUser.avatar_url,
			);
			setAvatarImage(resolvedAvatarUrl);
			reset({
				profileName: upsertedUser.profile_name ?? "",
				userName: upsertedUser.username ?? "",
			});

			// サーバー上の最新値も再取得してズレを防ぐ
			void fetchProfile();

			setIsEditing(false);
			Alert.alert("保存完了", "プロフィールを更新しました");
		} catch (error) {
			console.warn("Avatar upload failed:", error);
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

	const handleCancelEdit = () => {
		if (profile) {
			reset({
				profileName: profile.profile_name ?? "",
				userName: profile.username ?? "",
			});
			setAvatarImage(profile.avatar_url ?? null);
		}
		setAvatarError(false);
		setIsEditing(false);
	};

	const handleLogout = () => {
		Alert.alert("ログアウト", "ログアウトしますか？", [
			{ text: "キャンセル", style: "cancel" },
			{
				text: "ログアウト",
				style: "destructive",
				onPress: async () => {
					const { error } = await supabase.auth.signOut();
					if (error) {
						Alert.alert("エラー", "ログアウトに失敗しました");
						return;
					}
					router.replace("/screens/auth/SignInScreen");
				},
			},
		]);
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
			style={styles.keyboardView}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<View style={styles.handle} />

			<View style={styles.header}>
				{isEditing ? (
					<Pressable onPress={handleCancelEdit} style={styles.headerButton}>
						<Ionicons
							name="close-circle-outline"
							size={18}
							color={Colors.gray}
						/>
						<Text
							style={[styles.headerButtonText, styles.headerButtonTextCancel]}
						>
							キャンセル
						</Text>
					</Pressable>
				) : (
					<Pressable
						onPress={() => setIsEditing(true)}
						style={styles.headerButton}
					>
						<Ionicons name="pencil-outline" size={18} color={Colors.primary} />
						<Text style={styles.headerButtonText}>編集</Text>
					</Pressable>
				)}
				<Pressable onPress={() => router.dismiss()} style={styles.closeButton}>
					<Ionicons name="close" size={24} color={Colors.gray} />
				</Pressable>
			</View>

			<ScrollView
				style={styles.content}
				contentContainerStyle={styles.contentContainer}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.profileHeader}>
					<Pressable
						style={[
							styles.avatarButton,
							isEditing && avatarError && styles.avatarButtonError,
						]}
						onPress={isEditing ? pickImage : undefined}
						disabled={!isEditing}
					>
						{avatarImage ? (
							<Image source={{ uri: avatarImage }} style={styles.avatarImage} />
						) : (
							<View style={styles.avatarFallback}>
								<Text style={styles.avatarInitial}>{initial || "?"}</Text>
							</View>
						)}
					</Pressable>
					<Text style={styles.displayName}>{displayName}</Text>
					<Text style={styles.email}>{profile?.email ?? "メール未設定"}</Text>
					{isEditing && (
						<Text style={styles.avatarHint}>画像をタップして変更</Text>
					)}
				</View>
				{isEditing && avatarError && (
					<Text style={styles.errorText}>写真を選択してください</Text>
				)}

				<View style={styles.field}>
					<Text style={styles.label}>プロフィールネーム</Text>
					{isEditing ? (
						<>
							<Controller
								control={control}
								name="profileName"
								rules={{ required: "入力してください" }}
								render={({ field: { onChange, onBlur, value } }) => (
									<TextInput
										style={[
											styles.input,
											errors.profileName && styles.inputError,
										]}
										onChangeText={onChange}
										onBlur={onBlur}
										value={value}
										placeholder="表示名を入力"
										placeholderTextColor={Colors.grayLight}
									/>
								)}
							/>
							{errors.profileName && (
								<Text style={styles.errorText}>
									{errors.profileName.message}
								</Text>
							)}
						</>
					) : (
						<Text style={styles.value}>
							{profile?.profile_name || "未設定"}
						</Text>
					)}
				</View>

				<View style={styles.field}>
					<Text style={styles.label}>ユーザーネーム</Text>
					{isEditing ? (
						<>
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
						</>
					) : (
						<Text style={styles.value}>{profile?.username || "未設定"}</Text>
					)}
				</View>
			</ScrollView>

			<View style={styles.footer}>
				{isEditing ? (
					<Pressable
						style={[styles.saveButton, isSaving && styles.disabledButton]}
						onPress={handleSubmit(onSave)}
						disabled={isSaving}
					>
						{isSaving ? (
							<ActivityIndicator size="small" color={Colors.white} />
						) : (
							<>
								<Ionicons
									name="checkmark"
									size={20}
									color={Colors.white}
									style={styles.buttonIcon}
								/>
								<Text style={styles.buttonText}>変更を保存する</Text>
							</>
						)}
					</Pressable>
				) : (
					<Pressable style={styles.logoutButton} onPress={handleLogout}>
						<Ionicons
							name="log-out-outline"
							size={20}
							color={Colors.white}
							style={styles.buttonIcon}
						/>
						<Text style={styles.buttonText}>ログアウト</Text>
					</Pressable>
				)}
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: Colors.white,
	},
	keyboardView: {
		flex: 1,
		backgroundColor: Colors.white,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
	},
	handle: {
		width: 40,
		height: 4,
		backgroundColor: Colors.grayLighter,
		borderRadius: 2,
		alignSelf: "center",
		marginTop: 12,
		marginBottom: 4,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 20,
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: Colors.grayLighter,
	},
	headerButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingVertical: 4,
		paddingHorizontal: 8,
	},
	headerButtonText: {
		fontSize: 14,
		color: Colors.primary,
		fontWeight: "600",
	},
	headerButtonTextCancel: {
		color: Colors.gray,
	},
	closeButton: {
		padding: 4,
	},
	content: {
		flex: 1,
	},
	contentContainer: {
		padding: 24,
		paddingBottom: 16,
	},
	profileHeader: {
		alignItems: "center",
		marginBottom: 20,
	},
	avatarButton: {
		borderRadius: 44,
		overflow: "hidden",
		borderWidth: 2,
		borderColor: "transparent",
	},
	avatarButtonError: {
		borderColor: Colors.danger,
	},
	avatarImage: {
		width: 88,
		height: 88,
		borderRadius: 44,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: Colors.grayLighter,
	},
	avatarFallback: {
		width: 88,
		height: 88,
		borderRadius: 44,
		backgroundColor: Colors.primary,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: 12,
	},
	avatarInitial: {
		fontSize: 30,
		fontWeight: "700",
		color: Colors.white,
	},
	displayName: {
		fontSize: 22,
		fontWeight: "700",
		color: Colors.black,
	},
	email: {
		fontSize: 13,
		color: Colors.gray,
		marginTop: 4,
	},
	avatarHint: {
		fontSize: 12,
		color: Colors.gray,
		marginTop: 8,
	},
	field: {
		marginBottom: 20,
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
	value: {
		fontSize: 16,
		color: Colors.black,
		lineHeight: 22,
	},
	inputError: {
		borderColor: Colors.danger,
	},
	errorText: {
		fontSize: 12,
		color: Colors.danger,
		marginTop: 6,
	},
	footer: {
		paddingHorizontal: 24,
		paddingTop: 12,
		paddingBottom: 32,
		borderTopWidth: 1,
		borderTopColor: Colors.grayLighter,
	},
	saveButton: {
		backgroundColor: Colors.primary,
		borderRadius: 14,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
	},
	logoutButton: {
		backgroundColor: Colors.danger,
		borderRadius: 14,
		paddingVertical: 14,
		alignItems: "center",
		justifyContent: "center",
		flexDirection: "row",
	},
	disabledButton: {
		opacity: 0.65,
	},
	buttonIcon: {
		marginRight: 8,
	},
	buttonText: {
		fontSize: 16,
		fontWeight: "700",
		color: Colors.white,
	},
});
