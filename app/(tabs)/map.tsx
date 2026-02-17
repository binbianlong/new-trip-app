import { StyleSheet, Text, View } from "react-native";
import { Colors } from "../../src/constants/colors";

// マップ画面
export default function MapScreen() {
	return (
		<View style={styles.container}>
			<View style={styles.placeholder}>
				<Text style={styles.text}>マップ画面</Text>
				<Text style={styles.subText}>ここに地図が表示されます</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
	},
	placeholder: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	text: {
		fontSize: 20,
		fontWeight: "bold",
		color: Colors.black,
	},
	subText: {
		fontSize: 14,
		color: Colors.gray,
		marginTop: 8,
	},
});
