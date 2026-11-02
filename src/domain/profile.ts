import type { Issue, Profile } from "./types";
import { ServiceError } from "./types";
export const profileName = (name: string) => name.trim() || "CivicWatch member";
export const canEditReport = (issue: Issue, userId: string) =>
  issue.authorId === userId && issue.status === "reported";
export function normalizeProfile(profile: Profile): Profile {
  const result = {
    ...profile,
    displayName: profile.displayName.trim(),
    city: profile.city.trim(),
    bio: profile.bio.trim(),
    website: profile.website.trim(),
  };
  if (
    result.displayName.length > 60 ||
    result.city.length > 100 ||
    result.bio.length > 240 ||
    result.website.length > 2048
  )
    throw new ServiceError(
      "Keep your name within 60 characters, city within 100, bio within 240 and link within 2,048.",
      "VALIDATION",
    );
  if (result.website) {
    try {
      const url = new URL(result.website);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password
      )
        throw Error();
      result.website = url.href;
    } catch {
      throw new ServiceError(
        "Enter a full http:// or https:// website or social link.",
        "VALIDATION",
      );
    }
  }
  if (
    result.avatarUrl &&
    (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(
      result.avatarUrl,
    ) ||
      result.avatarUrl.length > 1024 * 1024)
  )
    throw new ServiceError(
      "Choose a new profile photo using the photo picker.",
      "VALIDATION",
    );
  return result;
}
