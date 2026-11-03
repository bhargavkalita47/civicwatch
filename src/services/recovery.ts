import { request } from "./api";

/**
 * Password recovery remains entirely server-side. The browser never receives
 * the Supabase access token returned by a successful recovery-code exchange.
 */
export const recoveryService = {
  requestCode: async (email: string): Promise<void> => {
    await request<{ requested: true }>("/auth/recovery/request", {
      method: "POST", body: JSON.stringify({ email }),
    });
  },
  changePassword: async (email: string, code: string, password: string): Promise<void> => {
    await request<{ changed: true }>("/auth/recovery/complete", {
      method: "POST", body: JSON.stringify({ email, code, password }),
    });
  },
};
