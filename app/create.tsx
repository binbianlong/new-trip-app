import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import {
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

// フォームの型定義
type TripFormData = {
	title: string;
	start_date: string;
	memo: string;
};

// 旅行プラン作成画面
export default function CreateScreen() {
	const router = useRouter();
	const {
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<TripFormData>({
		defaultValues: {
			title: "",
			start_date: "",
			memo: "",
		},
	});

	// フォーム送信ハンドラー（将来的にSupabaseへ送信）
	const onSubmit = (data: TripFormData) => {
		console.log("旅行プランデータ:", data);
		// TODO: Supabaseにtripsデータを登録する
		router.back();
	};

	return (
		<KeyboardAvoidingView
			style={styles.keyboardView}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<ScrollView
				contentContainerStyle={styles.container}
				keyboardShouldPersistTaps="handled"
			>
				{/* タイトル入力欄 */}
				<View style={styles.field}>
					<Text style={styles.label}>タイトル（必須）</Text>
					<Controller
						control={control}
						name="title"
						rules={{ required: "タイトルは必須です" }}
						render={({ field: { onChange, onBlur, value } }) => (
							<TextInput
								style={[styles.input, errors.title && styles.inputError]}
								placeholder="旅行のタイトルを入力"
								placeholderTextColor={Colors.grayLight}
								onChangeText={onChange}
								onBlur={onBlur}
								value={value}
							/>
						)}
					/>
					{errors.title && (
						<Text style={styles.errorText}>{errors.title.message}</Text>
					)}
				</View>

				{/* 参加者追加ボタン */}
				<View style={styles.field}>
					<Text style={styles.label}>参加者</Text>
					<Pressable style={styles.addParticipantButton}>
						<Ionicons
							name="person-add-outline"
							size={18}
							color={Colors.primary}
						/>
						<Text style={styles.addParticipantText}>参加者を追加</Text>
					</Pressable>
				</View>

				{/* 開始日入力 */}
				<View style={styles.field}>
					<Text style={styles.label}>開始日（必須）</Text>
					<Controller
						control={control}
						name="start_date"
						rules={{
							required: "開始日は必須です",
							pattern: {
								value: /^\d{4}-\d{2}-\d{2}$/,
								message: "YYYY-MM-DD形式で入力してください",
							},
						}}
						render={({ field: { onChange, onBlur, value } }) => (
							<TextInput
								style={[styles.input, errors.start_date && styles.inputError]}
								placeholder="YYYY-MM-DD"
								placeholderTextColor={Colors.grayLight}
								onChangeText={onChange}
								onBlur={onBlur}
								value={value}
								keyboardType="numbers-and-punctuation"
							/>
						)}
					/>
					{errors.start_date && (
						<Text style={styles.errorText}>{errors.start_date.message}</Text>
					)}
				</View>

				{/* メモ欄 */}
				<View style={styles.field}>
					<Text style={styles.label}>メモ（任意）</Text>
					<Controller
						control={control}
						name="memo"
						render={({ field: { onChange, onBlur, value } }) => (
							<TextInput
								style={[styles.input, styles.memoInput]}
								placeholder="メモを入力"
								placeholderTextColor={Colors.grayLight}
								onChangeText={onChange}
								onBlur={onBlur}
								value={value}
								multiline
							/>
						)}
					/>
				</View>

				{/* 作成完了ボタン */}
				<Pressable style={styles.button} onPress={handleSubmit(onSubmit)}>
					<Text style={styles.buttonText}>作成する</Text>
				</Pressable>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	keyboardView: {
		flex: 1,
		backgroundColor: Colors.white,
	},
	container: {
		padding: 24,
		paddingBottom: 48,
	},
	field: {
		marginBottom: 24,
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
		marginTop: 6,
	},
	memoInput: {
		height: 120,
		textAlignVertical: "top",
	},
	addParticipantButton: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		borderWidth: 1,
		borderColor: Colors.primary,
		borderRadius: 12,
		borderStyle: "dashed",
		padding: 14,
		justifyContent: "center",
	},
	addParticipantText: {
		fontSize: 15,
		color: Colors.primary,
		fontWeight: "600",
	},
	button: {
		backgroundColor: Colors.primary,
		borderRadius: 12,
		paddingVertical: 16,
		alignItems: "center",
		marginTop: 8,
	},
	buttonText: {
		color: Colors.white,
		fontSize: 16,
		fontWeight: "bold",
	},
});
