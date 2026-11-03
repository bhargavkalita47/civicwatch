import { config } from "../config";
import type { Dataset, PublicProfile } from "../domain/types";
import { request } from "./api";

/** The public API deliberately returns no account email or personal watchlist. */
export const publicProfiles = {
  async get(userId: string, dataset: Dataset): Promise<PublicProfile> {
    if (config.serviceMode === "api") {
      return request<PublicProfile>(`/users/${encodeURIComponent(userId)}/profile`);
    }
    const user = dataset.users.find(entry => entry.id === userId);
    const draft = dataset.profiles?.find(entry => entry.userId === userId);
    if (!user && !draft) throw new Error("This resident's profile isn't available.");
    return {
      userId,
      displayName: draft?.displayName || user?.displayName || "CivicWatch member",
      avatarUrl: draft?.avatarUrl || "",
      city: draft?.city || "",
      bio: draft?.bio || "",
      website: draft?.website || "",
    };
  },
};
