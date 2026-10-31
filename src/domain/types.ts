export type ID = string;
export type ISODate = string;
export type Role = "resident" | "moderator" | "administrator";
export type IssueStatus =
  | "reported"
  | "acknowledged"
  | "in_progress"
  | "resolved";
export type CategoryGroup =
  | "Roads & travel"
  | "Water & drainage"
  | "Waste & environment"
  | "Public utilities"
  | "Public spaces"
  | "Safety & access";
export interface City {
  id: ID;
  name: string;
  region: string;
  country: string;
  center: Coordinate;
  radiusKm: number;
}
export interface Coordinate {
  lat: number;
  lng: number;
}
export interface User {
  id: ID;
  displayName: string;
  email: string;
  role: Role;
  createdAt: ISODate;
}
export interface PublicUser {
  id: ID;
  displayName: string;
  role: Role;
}
export interface Session {
  user: User;
  expiresAt: ISODate;
}
export interface Organization {
  id: ID;
  name: string;
  jurisdiction: string;
  createdAt: ISODate;
}
export interface Category {
  id: ID;
  label: string;
  group: CategoryGroup;
  color: string;
  symbol: string;
  description: string;
}
export interface Attachment {
  id: ID;
  url: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: ISODate;
}
export interface Issue {
  id: ID;
  categoryId: ID;
  cityId: ID;
  title: string;
  description: string;
  location: Coordinate;
  address: string;
  status: IssueStatus;
  authorId: ID;
  organizationId: ID | null;
  confirmationUserIds: ID[];
  attachments: Attachment[];
  createdAt: ISODate;
  updatedAt: ISODate;
}
export interface Comment {
  id: ID;
  issueId: ID;
  authorId: ID;
  parentId: ID | null;
  body: string;
  attachments: Attachment[];
  createdAt: ISODate;
}
export interface AreaStats {
  reports: number;
  open: number;
  resolved: number;
  people: number;
}
export interface OverviewSnapshot {
  platform: AreaStats;
  cities: Record<ID, AreaStats>;
  updatedAt: ISODate;
}
export interface Dataset {
  version: 1;
  users: PublicUser[];
  issues: Issue[];
  comments: Comment[];
  /** Reporting areas are created by reports, not limited to a static city list. */
  areas?: City[];
}
export interface CreateIssueInput {
  area: City;
  categoryId: ID;
  title: string;
  description: string;
  location: Coordinate;
  address: string;
  attachments: Attachment[];
}
export interface CreateCommentInput {
  issueId: ID;
  parentId?: ID | null;
  body: string;
  attachments: Attachment[];
}
export interface SignInInput {
  displayName: string;
  email: string;
}
export interface IssueFilters {
  query: string;
  categoryIds: ID[];
  status: IssueStatus | "all";
  sort: "recent" | "supported";
  authorId?: ID;
}
export interface LocationCluster {
  id: ID;
  location: Coordinate;
  issues: Issue[];
  totalPeople: number;
}
export interface CivicService {
  getCategories(): Promise<Category[]>;
  getCities(): Promise<City[]>;
  getOverviewStats(): Promise<OverviewSnapshot>;
  getDataset(): Promise<Dataset>;
  getSession(): Promise<Session | null>;
  signIn(input: SignInInput): Promise<Session>;
  signOut(): Promise<void>;
  createIssue(input: CreateIssueInput): Promise<Issue>;
  confirmIssue(id: ID): Promise<Issue>;
  createComment(input: CreateCommentInput): Promise<Comment>;
  uploadPhoto(file: File): Promise<Attachment>;
  updateStatus(id: ID, status: IssueStatus): Promise<Issue>;
  deleteIssue(id: ID): Promise<void>;
}
export class ServiceError extends Error {
  constructor(
    message: string,
    public code:
      | "VALIDATION"
      | "UNAUTHENTICATED"
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "STORAGE"
      | "NETWORK"
      | "CONFIGURATION",
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
