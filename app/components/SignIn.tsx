import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	Alert,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { supabase } from "../../src/lib/supabase";

const PROFILE_SETUP_REQUIRED_KEY = "profile_setup_required";

export default function Auth() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	async function signInWithEmail() {
		setLoading(true);
		const {
			data: { session },
			error,
		} = await supabase.auth.signInWithPassword({
			email: email,
			password: password,
		});

		if (error) {
			Alert.alert(error.message);
			setLoading(false);
			return;
		}
		if (session) {
			router.replace("/(tabs)");
		}
		setLoading(false);
	}

	async function signUpWithEmail() {
		setLoading(true);
		const {
			data: { session },
			error,
		} = await supabase.auth.signUp({
			email: email,
			password: password,
		});

		if (error) {
			Alert.alert("エラー", error.message);
			setLoading(false);
			return;
		}
		await AsyncStorage.setItem(PROFILE_SETUP_REQUIRED_KEY, "1");

		if (session) {
			router.replace("/profile-setup");
		} else {
			Alert.alert("確認", "メールボックスを確認してください。");
		}
		setLoading(false);
	}

	return (
		<View style={styles.container}>
			{/* メールアドレス入力 */}
			<View style={styles.inputGroup}>
				<Text style={styles.label}>メールアドレス</Text>
				<TextInput
					onChangeText={(text) => setEmail(text)}
					value={email}
					placeholder="email@address.com"
					autoCapitalize="none"
					style={styles.input}
					placeholderTextColor="#999"
				/>
			</View>

			{/* パスワード入力 */}
			<View style={styles.inputGroup}>
				<Text style={styles.label}>パスワード</Text>
				<TextInput
					onChangeText={(text) => setPassword(text)}
					value={password}
					secureTextEntry={true}
					placeholder="Password"
					autoCapitalize="none"
					style={styles.input}
					placeholderTextColor="#999"
				/>
			</View>

			{/* ログインボタン */}
			<TouchableOpacity
				style={[styles.button, loading && styles.buttonDisabled]}
				onPress={() => signInWithEmail()}
				disabled={loading}
			>
				<Text style={styles.buttonText}>
					{loading ? "ログイン中..." : "ログイン"}
				</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: "100%",
		paddingHorizontal: 20,
	},
	inputGroup: {
		marginBottom: 16,
	},
	label: {
		fontSize: 14,
		fontWeight: "bold",
		color: "#4A7C59", // 深い緑
		marginBottom: 6,
	},
	input: {
		borderWidth: 1,
		borderColor: "#4A7C59", // 深い緑
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		backgroundColor: "#fff",
	},
	button: {
		backgroundColor: "#C6FFCA", // 薄い緑
		borderRadius: 8,
		paddingVertical: 14,
		alignItems: "center",
		marginTop: 20,
		borderWidth: 1,
		borderColor: "#4A7C59",
		// 軽いシャドウ（iOS用）
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		// 軽いシャドウ（Android用）
		elevation: 2,
	},
	buttonDisabled: {
		opacity: 0.6,
	},
	buttonText: {
		color: "#4A7C59", // 深い緑
		fontSize: 18,
		fontWeight: "bold",
	},
});
