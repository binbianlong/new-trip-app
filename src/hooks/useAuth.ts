import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// 認証状態を管理するフック
export function useAuth() {
	const [session, setSession] = useState<Session | null | undefined>(undefined);

	useEffect(() => {
		// 初回マウント時にセッションを取得し、サーバー側で有効性を検証
		supabase.auth.getSession().then(async ({ data: { session } }) => {
			if (session) {
				// getUser() はサーバーリクエストを行うため、DBからユーザーが削除された場合も検知できる
				const { error } = await supabase.auth.getUser();
				if (error) {
					// ユーザーが無効な場合はローカルセッションをクリア
					await supabase.auth.signOut();
					setSession(null);
					return;
				}
			}
			setSession(session);
		});

		// 認証状態の変化を監視
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
		});

		return () => subscription.unsubscribe();
	}, []);

	return { session, isLoading: session === undefined };
}
