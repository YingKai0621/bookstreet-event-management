import { apiClient } from './apiClient';
import { API_BASE_URL } from './apiConfig';

async function upload(path: string, file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const result = await apiClient.postForm<{ url: string }>(path, body);
  return new URL(result.url, new URL(API_BASE_URL, window.location.origin)).href;
}

export const contentImageApi = {
  uploadBadge: (file: File) => upload('/admin/badge-images', file),
  uploadOrganizerActivity: (eventId: string, file: File) =>
    upload(`/organizer/events/${encodeURIComponent(eventId)}/activity-images`, file),
  uploadPartnerActivity: (activityId: number, file: File) =>
    upload(`/partner/activities/${activityId}/images`, file),
};
