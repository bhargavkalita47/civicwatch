import {
  ServiceError,
  type Category,
  type City,
  type Dataset,
  type AreaStats,
  type Coordinate,
  type CreateIssueInput,
  type Issue,
  type IssueFilters,
  type LocationCluster,
} from "./types";
export function distance(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180,
    dLat = (b.lat - a.lat) * rad,
    dLng = (b.lng - a.lng) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
/** Independent aggregate, with people deduplicated across all reports in scope. */
export function summarizeIssues(issues: Issue[]): AreaStats {
  return {
    reports: issues.length,
    open: issues.filter((issue) => issue.status !== "resolved").length,
    resolved: issues.filter((issue) => issue.status === "resolved").length,
    people: new Set(issues.flatMap((issue) => [issue.authorId, ...issue.confirmationUserIds])).size,
  };
}
export function cityForCoordinate(point: Coordinate, cities: City[]): City | undefined {
  return cities.filter((city) => distance(point, city.center) <= city.radiusKm * 1000)
    .sort((a, b) => distance(a.center, point) - distance(b.center, point))[0];
}
export function statsByCity(dataset: Dataset, cities: City[]): Record<string, AreaStats> {
  return Object.fromEntries(cities.map((city) => [city.id, summarizeIssues(dataset.issues.filter((issue) => issue.cityId === city.id))]));
}
export function peopleCount(issue: Issue) {
  return new Set([issue.authorId, ...issue.confirmationUserIds]).size;
}
export function filterIssues(issues: Issue[], filters: IssueFilters): Issue[] {
  const q = filters.query.trim().toLowerCase();
  return issues
    .filter(
      (i) =>
        (!q ||
          `${i.title} ${i.address} ${i.description}`
            .toLowerCase()
            .includes(q)) &&
        (!filters.categoryIds.length ||
          filters.categoryIds.includes(i.categoryId)) &&
        (filters.status === "all" || i.status === filters.status) &&
        (!filters.authorId || i.authorId === filters.authorId),
    )
    .sort((a, b) =>
      filters.sort === "supported"
        ? peopleCount(b) - peopleCount(a)
        : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
}
export function activeIssues(issues: Issue[]): Issue[] {
  return issues.filter(issue => issue.status !== "resolved");
}

export function historicalIssues(issues: Issue[]): Issue[] {
  return issues.filter(issue => issue.status === "resolved");
}

export function clusterIssues(issues: Issue[]): LocationCluster[] {
  const clusters: LocationCluster[] = [];
  for (const issue of activeIssues(issues).sort((a, b) => a.id.localeCompare(b.id))) {
    let cluster = clusters.find(
      (c) => distance(c.location, issue.location) <= 45,
    );
    if (!cluster) {
      cluster = {
        id: issue.id,
        location: issue.location,
        issues: [],
        totalPeople: 0,
      };
      clusters.push(cluster);
    }
    cluster.issues.push(issue);
    cluster.totalPeople = new Set(
      cluster.issues.flatMap((i) => [i.authorId, ...i.confirmationUserIds]),
    ).size;
  }
  return clusters;
}
export function markerColor(hex: string, count: number): string {
  // Keep dense clusters visibly stronger while preserving the pastel palette.
  const factor = 1 - Math.min(0.26, Math.log2(Math.max(1, count)) / 24);
  return (
    "#" +
    hex
      .slice(1)
      .match(/.{2}/g)!
      .map((p) =>
        Math.round(parseInt(p, 16) * factor)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function validateIssue(input: CreateIssueInput, categories: Category[]) {
  if (!input.area || !input.area.name.trim() || !input.area.region.trim() || !input.area.country.trim())
    throw new ServiceError("Enter the town or locality, region and country.", "VALIDATION");
  if ([input.area.name, input.area.region, input.area.country].some((field) => field.trim().length > 100))
    throw new ServiceError("Location names must have fewer than 100 characters.", "VALIDATION");
  if (!categories.some((c) => c.id === input.categoryId))
    throw new ServiceError("Choose an issue type.", "VALIDATION");
  if (input.title.trim().length < 8 || input.title.length > 120)
    throw new ServiceError(
      "Use a title between 8 and 120 characters.",
      "VALIDATION",
    );
  if (input.description.trim().length < 20 || input.description.length > 3000)
    throw new ServiceError(
      "Add a description between 20 and 3,000 characters.",
      "VALIDATION",
    );
  if (input.address.trim().length < 3 || input.address.length > 240)
    throw new ServiceError(
      "Add a street or landmark (3–240 characters).",
      "VALIDATION",
    );
  const { lat, lng } = input.location;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    throw new ServiceError("Select a valid location on the map.", "VALIDATION");
  if (input.attachments.length > 3)
    throw new ServiceError("You can attach up to 3 photos.", "VALIDATION");
}
export const statusLabels: Record<Issue["status"], string> = {
  reported: "Reported",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
};
export function relativeTime(date: string) {
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 60000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}
