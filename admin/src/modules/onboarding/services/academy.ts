import axiosInstance from "@/lib/api/axios";
import {
  AcademyStep1Payload,
  ApiResponse,
  ConfirmDocumentsPayload,
  ConfirmImagesPayload,
  OnboardingAcademy,
  OnboardingProgress,
  PresignedUrl,
  AcademyStepPayload,
} from "@/modules/onboarding/types/academy";

const API_BASE = "/academies/onboarding";

/**
 * Academy Onboarding API Service
 * Handles 7-step onboarding process
 */
export const academyOnboardingApi = {
  /**
   * STEP 1: Start academy onboarding with basic info
   */
  startOnboarding: async (data: AcademyStep1Payload): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.post(`${API_BASE}/start`, data);
    return response.data;
  },

  /**
   * Get academy onboarding progress
   */
  getProgress: async (academyId: string): Promise<ApiResponse<OnboardingProgress>> => {
    const response = await axiosInstance.get(`${API_BASE}/${academyId}/progress`);
    return response.data;
  },

  /**
   * Save any step (2-7)
   */
  saveStep: async (
    academyId: string,
    stepNumber: number,
    data: AcademyStepPayload
  ): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.put(`${API_BASE}/${academyId}/step/${stepNumber}`, data);
    return response.data;
  },

  /**
   * STEP 3: Get presigned URLs for images
   */
  getImageUploadUrls: async (
    academyId: string,
    imageTypes: string[]
  ): Promise<ApiResponse<{ uploadUrls: PresignedUrl[] }>> => {
    const response = await axiosInstance.post(`${API_BASE}/${academyId}/image-upload-urls`, {
      imageTypes,
    });
    return response.data;
  },

  /**
   * STEP 3: Confirm images uploaded
   */
  confirmImages: async (payload: ConfirmImagesPayload): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/${payload.academyId}/confirm-images`,
      payload
    );
    return response.data;
  },

  /**
   * STEP 3: Get presigned URLs for documents
   */
  getDocumentUploadUrls: async (
    academyId: string,
    docTypes: ("panDocument" | "gstDocument")[]
  ): Promise<ApiResponse<{ uploadUrls: PresignedUrl[] }>> => {
    const response = await axiosInstance.post(`${API_BASE}/${academyId}/document-upload-urls`, {
      docTypes,
    });
    return response.data;
  },

  /**
   * STEP 3: Confirm documents uploaded
   */
  confirmDocuments: async (
    payload: ConfirmDocumentsPayload
  ): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.post(
      `${API_BASE}/${payload.academyId}/confirm-documents`,
      payload
    );
    return response.data;
  },

  /**
   * Submit academy for admin approval
   */
  submitForApproval: async (academyId: string): Promise<ApiResponse<OnboardingAcademy>> => {
    const response = await axiosInstance.post(`${API_BASE}/${academyId}/submit`);
    return response.data;
  },
};
