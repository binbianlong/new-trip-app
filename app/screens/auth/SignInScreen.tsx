import "react-native-url-polyfill/auto";
import type { JwtPayload } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../../src/lib/supabase";
import Auth from "../../components/Auth";

export default function App() {
	const [claims, setClaims] = useState<JwtPayload | null>(null);
	const router = useRouter();

	useEffect(() => {
		supabase.auth.getClaims().then(({ data }) => {
			if (data) {
				setClaims(data.claims);
			}
		});

		supabase.auth.onAuthStateChange(() => {
			supabase.auth.getClaims().then(({ data }) => {
				if (data) {
					setClaims(data.claims);
				}
			});
		});
	}, []);

	return (
		<View style={{ flex: 1, padding: 16 }}>
			<Auth />
			{claims && (
				<View
					style={{
						marginTop: 16,
						padding: 12,
						backgroundColor: "#f0f0f0",
						borderRadius: 8,
					}}
				>
					<Text style={{ fontSize: 14 }} numberOfLines={2}>
						{claims.sub}
					</Text>
				</View>
			)}
			<ScrollView style={styles.container}>
				<View style={styles.content}>
					{claims && (
						<View style={styles.claimsContainer}>
							<Text style={styles.claimsText}>
								{JSON.stringify(claims, null, 2)}
							</Text>
						</View>
					)}
				</View>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		padding: 16,
	},
	claimsContainer: {
		marginTop: 16,
		padding: 12,
		backgroundColor: "#f5f5f5",
		borderRadius: 8,
	},
	claimsText: {
		fontSize: 12,
		fontFamily: "monospace",
	},
});
