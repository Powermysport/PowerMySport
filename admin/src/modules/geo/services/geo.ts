import axiosInstance from "@/lib/api/axios";

export interface GeoSuggestion {
  label: string;
  lat: number;
  lon: number;
}

interface GeoResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export const geoApi = {
  autocomplete: async (query: string): Promise<GeoSuggestion[]> => {
    const response = await axiosInstance.get<GeoResponse<GeoSuggestion[]>>(
      `/geo/autocomplete?q=${encodeURIComponent(query)}`
    );
    return response.data.data || [];
  },
};
