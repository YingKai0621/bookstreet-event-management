export interface PublicHeritageListItem {
  publicCode: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  locationText: string | null;
  publishedAt: string;
}

export interface PublicHeritageDetail extends PublicHeritageListItem {
  content: string;
}

export type HeritageProfile = PublicHeritageListItem;

export interface HeritagePageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type HeritageStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface OrganizerHeritageListItem {
  heritageContentId: number;
  publicCode: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  locationText: string | null;
  status: HeritageStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizerHeritageDetail extends OrganizerHeritageListItem {
  content: string;
}

export interface OrganizerHeritageQuery {
  page?: number;
  size?: number;
  sort?: 'updatedAt,desc' | 'updatedAt,asc' | 'title,asc' | 'title,desc';
  search?: string;
  status?: HeritageStatus;
}

export interface CreateHeritageRequest {
  title: string;
  summary?: string | null;
  content: string;
  imageUrl?: string | null;
  locationText?: string | null;
}

export interface HeritageImageUploadResponse {
  imageUrl: string;
}

export interface UpdateHeritageRequest {
  title: string;
  summary: string | null;
  content: string;
  imageUrl: string | null;
  locationText: string | null;
  expectedUpdatedAt: string;
}
