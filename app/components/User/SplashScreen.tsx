// app/components/User/Splash_screen.tsx
import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

export const SplashScreen = () => {
    const [dots, setDots] = useState("");
    const [pawsCount, setPawsCount] = useState(0);

    useEffect(() => {
        // --- ドット用タイマー (300ms) ---
        const dotsInterval = setInterval(() => {
            setDots((prev) => {
                if (prev === "...") {
                    return "";
                } else {
                    return `${prev}.`;
                }
            });
        }, 300);

        // --- 足跡用タイマー (700ms) ---
        const pawsInterval = setInterval(() => {
            setPawsCount((prev) => {
                if (prev >= 5) {
                    return 0;
                } else {
                    return prev + 1;
                }
            });
        }, 700);

        // クリーンアップで両方のタイマーをクリア
        return () => {
            clearInterval(dotsInterval);
            clearInterval(pawsInterval);
        };
    }, []);

    return (
        <View style={styles.loadingContainer}>
            {/* --- 肉球の配置セクション --- */}
            {/* 5個目：左下（歩き始め：pawsCountが1以上の時に表示） */}
            {pawsCount >= 1 && (
                <Text style={[styles.paws, { 
                    bottom: "15%", 
                    left: "15%", 
                    fontSize: 32, 
                    transform: [{ rotate: "10deg" }] 
                }]}>🐾</Text>
            )}

            {/* 4個目：中央より少し左下（pawsCountが2以上の時に表示） */}
            {pawsCount >= 2 && (
                <Text style={[styles.paws, { 
                    bottom: "25%", 
                    left: "30%", 
                    fontSize: 45, 
                    transform: [{ rotate: "5deg" }] 
                }]}>🐾</Text>
            )}
            
            {/* 3個目：画面中央付近（pawsCountが3以上の時に表示） */}
            {pawsCount >= 3 && (
                <Text style={[styles.paws, { 
                    top: "55%", 
                    left: "43%", 
                    fontSize: 72, 
                    transform: [{ rotate: "-10deg" }] 
                }]}>🐾</Text>
            )}
            
            {/* 2個目：中央より少し右上（pawsCountが4以上の時に表示） */}
            {pawsCount >= 4 && (
                <Text style={[styles.paws, { 
                    top: "32%", 
                    right: "25%", 
                    fontSize: 90, 
                    transform: [{ rotate: "-15deg" }] 
                }]}>🐾</Text>
            )}

            {/* 1個目：右上（最後：pawsCountが5の時に表示） */}
            {pawsCount >= 5 && (
                <Text style={[styles.paws, { 
                    top: "12%", 
                    right: "45%", 
                    fontSize: 120, 
                    transform: [{ rotate: "-25deg" }] 
                }]}>🐾</Text>
            )}
            {/* ---------------------------- */}

            <View style={styles.textWrapper}>
                <Text style={styles.loadingText}>ロード中{dots}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#ffffff",
    },
    textWrapper: {
        width: 150,
        alignItems: "flex-start",
        paddingLeft: 20,
        zIndex: 1, 
    },
    loadingText: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
        fontFamily: "System", 
    },
    paws: {
        position: "absolute",
        color: "#555",
        opacity: 0.3, 
    },
});