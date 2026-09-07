"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

type AuthValue = {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const token = localStorage.getItem("unzanet_token");
        if (!token) {
            Promise.resolve().then(() => setLoading(false));
            return;
        }
        api<{ user: User }>("/auth/me")
            .then((result) => setUser(result.user))
            .catch(() => localStorage.removeItem("unzanet_token"))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!loading && pathname.startsWith("/dashboard") && !user)
            router.replace("/login");
    }, [loading, pathname, router, user]);

    const value = useMemo<AuthValue>(
        () => ({
            user,
            loading,
            login: async (email, password) => {
                const result = await api<{ user: User; accessToken: string }>(
                    "/auth/login",
                    {
                        method: "POST",
                        body: JSON.stringify({ email, password }),
                    },
                );
                localStorage.setItem("unzanet_token", result.accessToken);
                setUser(result.user);
                router.replace("/dashboard");
            },
            logout: () => {
                localStorage.removeItem("unzanet_token");
                setUser(null);
                router.replace("/login");
            },
        }),
        [loading, router, user],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context)
        throw new Error("useAuth harus digunakan di dalam AuthProvider.");
    return context;
}
