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
