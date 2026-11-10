import axiosInstance from "@/lib/api/axios";
import {
  OnboardingStep1Payload,
  OnboardingVenue,
  PresignedUrl,
} from "@/modules/onboarding/types/onboarding";
import axios from "axios";

const API_BASE = "/venues/onboarding";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

/**
 * Venue Onboarding API Service
 * Handles all 4-step onboarding process and admin operations
 *
 * REFACTORED FLOW:
 * Step 1: Venue Lister Contact Info (ownerName, ownerEmail, ownerPhone)
 * Step 2: Venue Details (name, location, sports, price, etc.)
 * Step 3: Images (5-20 images with cover photo)
 * Step 4: Documents (ownership, registration, tax, insurance, certificates)
 */
export const onboardingApi = {
  /**
   * STEP 3A: Get presigned URLs for image upload
   * Now generates URLs for 3 general images + 5 per sport
   */
  getImageUploadUrls: async (
    venueId: string,
    sports: string[]
  ): Promise<ApiResponse<{ uploadUrls: PresignedUrl[] }>> => {
    const response = await axiosInstance.post(`${API_BASE}/step3/upload-urls`, {
      venueId,
      sports,
    });
    return response.data;
  },

  /**
   * STEP 4A: Get presigned URLs for document upload
   */
  getDocumentUploadUrls: async (
    venueId: string,
    documents: Array<{
      type: string;
      fileName: string;
      contentType: string;
    }>
  ): Promise<ApiResponse<{ uploadUrls: PresignedUrl[] }>> => {
    const response = await axiosInstance.post(`${API_BASE}/step4/upload-urls`, {
      venueId,
      documents,
    });
    return response.data;
  },

  /**
   * Get coach photo upload URL
   */
  getCoachPhotoUploadUrl: async (
    venueId: string,
    fileName: string,
    contentType: string
  ): Promise<ApiResponse<{ uploadUrl: string; downloadUrl: string; s3Key: string }>> => {
    const response = await axiosInstance.post(`${API_BASE}/coach-photo-upload-url`, {
      venueId,
      fileName,
      contentType,
    });
    return response.data;
  },

  // DEPRECATED: Old Step 1 method (kept for compatibility)
  /**
   * @deprecated Use submitContactInfo and submitVenueDetails instead
   */
  createVenue: async (data: OnboardingStep1Payload): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(`${API_BASE}/step1`, data);
    return response.data;
  },

  // DEPRECATED: Old Step 2 method (kept for compatibility)

  /**
   * ADMIN: Get venue details for review
   */
  getVenueDetailsForReview: async (venueId: string): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.get(`${API_BASE}/admin/${venueId}`);
    return response.data;
  },

  /**
   * ADMIN: Approve venue
   */
  approveVenue: async (venueId: string): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(`${API_BASE}/admin/${venueId}/approve`);
    return response.data;
  },

  /**
   * ADMIN: Reject venue
   */
  rejectVenue: async (venueId: string, reason: string): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(`${API_BASE}/admin/${venueId}/reject`, {
      reason,
    });
    return response.data;
  },

  /**
   * ADMIN: Mark venue for review
   */
  markVenueForReview: async (
    venueId: string,
    notes?: string
  ): Promise<ApiResponse<OnboardingVenue>> => {
    const response = await axiosInstance.post(`${API_BASE}/admin/${venueId}/mark-review`, {
      notes,
    });
    return response.data;
  },
};

/**
 * Helper: Upload file to presigned URL
 */
export const uploadFileToPresignedUrl = async (
  file: File,
  presignedUrl: string,
  contentType: string
): Promise<void> => {
  await axios.put(presignedUrl, file, {
    headers: {
      "Content-Type": contentType,
    },
    withCredentials: false,
  });
};
