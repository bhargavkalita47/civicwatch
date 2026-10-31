import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, SignInInput } from "../domain/types";
import { civicService } from "./index";
import { config } from "../config";
interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  error: string;
  signIn: (input: SignInInput) => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    civicService
      .getSession()
      .then((s) => {
        if (active) setSession(s);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  // Reconcile session changes across tabs. Storage covers local preview mode;
  // BroadcastChannel also covers cookie-based API sessions later on.
  useEffect(() => {
    let alive = true;
    let latest = 0;
    const reconcile = async () => {
      const request = ++latest;
      try {
        const next = await civicService.getSession();
        if (alive && request === latest) {
          setSession(next);
          setError("");
        }
      } catch (cause) {
        if (alive && request === latest) {
          setSession(null);
          setError((cause as Error).message);
        }
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === config.sessionKey || event.key === null) void reconcile();
    };
    const channel = typeof BroadcastChannel === "undefined"
      ? null : new BroadcastChannel("civicwatch-auth-v1");
    if (channel) channel.onmessage = () => void reconcile();
    window.addEventListener("storage", onStorage);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, []);
  const broadcastAuthChange = () => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("civicwatch-auth-v1");
    channel.postMessage("session-changed");
    channel.close();
  };
  useEffect(() => {
    if (!session) return;
    const left = Date.parse(session.expiresAt) - Date.now();
    if (left <= 0) {
      setSession(null);
      return;
    }
    const timer = setTimeout(
      () => setSession(null),
      Math.min(left, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [session]);
  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        error,
        signIn: async (input) => {
          setSession(await civicService.signIn(input));
          setError("");
          broadcastAuthChange();
        },
        signOut: async () => {
          await civicService.signOut();
          setSession(null);
          broadcastAuthChange();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw Error("AuthProvider is required");
  return value;
}
