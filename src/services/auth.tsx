import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, SignInInput } from "../domain/types";
import { civicService } from "./index";
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
        },
        signOut: async () => {
          await civicService.signOut();
          setSession(null);
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
