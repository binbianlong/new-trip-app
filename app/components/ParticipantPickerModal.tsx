import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Image,
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { Colors } from "../../src/constants/colors";
import { supabase } from "../../src/lib/supabase";
import type { User } from "../../src/types";

type ParticipantPickerModalProps = {
	visible: boolean;
	onClose: () => void;
	onSelectUser: (user: User) => void;
	selectedUserIds: string[];
	excludeUserIds?: string[];
};

export function ParticipantPickerModal({
	visible,
	onClose,
	onSelectUser,
	selectedUserIds,
	excludeUserIds = [],
}: ParticipantPickerModalProps) {
	const [keyword, setKeyword] = useState("");
	const [results, setResults] = useState<User[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);

	useEffect(() => {
		if (!visible) {
			setKeyword("");
			setResults([]);
			setHasSearched(false);
			setIsSearching(false);
		}
	}, [visible]);

	const excludedSet = useMemo(
		() => new Set(excludeUserIds.filter((id): id is string => Boolean(id))),
		[excludeUserIds],
	);

	const handleSearch = useCallback(async () => {
		const trimmedKeyword = keyword.trim();
		setHasSearched(true);
		if (!trimmedKeyword) {
			setResults([]);
			return;
		}

		setIsSearching(true);
		try {
			const { data, error } = await supabase
				.from("users")
				.select("*")
				.ilike("username", `%${trimmedKeyword}%`)
				.is("deleted_at", null)
				.order("username", { ascending: true })
				.limit(20);

			if (error) {
				Alert.alert("検索エラー", error.message);
				return;
			}

			const filtered = (data ?? []).filter((user) => !excludedSet.has(user.id));
			setResults(filtered);
		} catch (error) {
			Alert.alert(
				"検索エラー",
				error instanceof Error
					? error.message
					: "ユーザー検索中にエラーが発生しました",
			);
		} finally {
			setIsSearching(false);
		}
	}, [keyword, excludedSet]);

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<View style={styles.overlay}>
				<Pressable style={styles.backdrop} onPress={onClose} />
				<View style={styles.card}>
					<View style={styles.header}>
						<Text style={styles.title}>参加者を検索</Text>
						<Pressable onPress={onClose} style={styles.closeButton}>
							<Ionicons name="close" size={20} color={Colors.gray} />
						</Pressable>
					</View>

					<View style={styles.searchRow}>
						<TextInput
							style={styles.searchInput}
							value={keyword}
							onChangeText={setKeyword}
							placeholder="username で検索"
							placeholderTextColor={Colors.grayLight}
							autoCapitalize="none"
							autoCorrect={false}
							returnKeyType="search"
							onSubmitEditing={handleSearch}
						/>
						<Pressable style={styles.searchButton} onPress={handleSearch}>
							<Ionicons name="search" size={18} color={Colors.white} />
						</Pressable>
					</View>

					<View style={styles.resultArea}>
						{isSearching ? (
							<ActivityIndicator color={Colors.primary} />
						) : results.length > 0 ? (
							<FlatList
								data={results}
								keyExtractor={(item) => item.id}
								keyboardShouldPersistTaps="handled"
								renderItem={({ item }) => {
									const isAdded = selectedUserIds.includes(item.id);
									const displayName =
										item.profile_name ?? item.username ?? "名前未設定";
									const username = item.username ?? "";
									return (
										<View style={styles.userRow}>
											{item.avatar_url ? (
												<Image
													source={{ uri: item.avatar_url }}
													style={styles.avatar}
												/>
											) : (
												<View style={styles.avatarFallback}>
													<Text style={styles.avatarInitial}>
														{displayName.charAt(0)}
													</Text>
												</View>
											)}
											<View style={styles.userTextBlock}>
												<Text style={styles.displayName} numberOfLines={1}>
													{displayName}
												</Text>
												<Text style={styles.username} numberOfLines={1}>
													@{username}
												</Text>
											</View>
											<Pressable
												style={[
													styles.addButton,
													isAdded && styles.addedButton,
												]}
												onPress={() => onSelectUser(item)}
												disabled={isAdded}
											>
												<Text
													style={[
														styles.addButtonText,
														isAdded && styles.addedButtonText,
													]}
												>
													{isAdded ? "追加済み" : "追加"}
												</Text>
											</Pressable>
										</View>
									);
								}}
							/>
						) : hasSearched ? (
							<Text style={styles.emptyText}>
								一致するユーザーが見つかりません
							</Text>
						) : (
							<Text style={styles.emptyText}>
								username を入力して検索してください
							</Text>
						)}
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		justifyContent: "center",
		padding: 20,
	},
	backdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.4)",
	},
	card: {
		backgroundColor: Colors.white,
		borderRadius: 16,
		padding: 16,
		maxHeight: "75%",
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	title: {
		fontSize: 16,
		fontWeight: "700",
		color: Colors.black,
	},
	closeButton: {
		padding: 4,
	},
	searchRow: {
		flexDirection: "row",
		gap: 8,
		marginBottom: 12,
	},
	searchInput: {
		flex: 1,
		borderWidth: 1,
		borderColor: Colors.grayLight,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 15,
		color: Colors.black,
	},
	searchButton: {
		width: 42,
		height: 42,
		borderRadius: 10,
		backgroundColor: Colors.primary,
		alignItems: "center",
		justifyContent: "center",
	},
	resultArea: {
		minHeight: 220,
	},
	userRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingVertical: 8,
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
	},
	avatarFallback: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: Colors.primary,
		alignItems: "center",
		justifyContent: "center",
	},
	avatarInitial: {
		color: Colors.white,
		fontWeight: "700",
		fontSize: 15,
	},
	userTextBlock: {
		flex: 1,
	},
	displayName: {
		fontSize: 14,
		fontWeight: "600",
		color: Colors.black,
	},
	username: {
		fontSize: 12,
		color: Colors.gray,
		marginTop: 1,
	},
	addButton: {
		backgroundColor: Colors.primary,
		borderRadius: 999,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	addedButton: {
		backgroundColor: Colors.grayLighter,
	},
	addButtonText: {
		color: Colors.white,
		fontSize: 12,
		fontWeight: "700",
	},
	addedButtonText: {
		color: Colors.gray,
	},
	emptyText: {
		color: Colors.gray,
		fontSize: 13,
		textAlign: "center",
		marginTop: 24,
	},
});
