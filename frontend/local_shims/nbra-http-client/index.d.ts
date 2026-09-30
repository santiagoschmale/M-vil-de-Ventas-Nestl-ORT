import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export declare class AxiosHttpClient {
  constructor(config?: AxiosRequestConfig);
  instance: AxiosInstance;
  interceptors: AxiosInstance["interceptors"];
  get<R = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<R>>;
  delete<R = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<R>>;
  post<B = unknown, R = unknown>(url: string, body: B, config?: AxiosRequestConfig): Promise<AxiosResponse<R>>;
  put<B = unknown, R = unknown>(url: string, body: B, config?: AxiosRequestConfig): Promise<AxiosResponse<R>>;
  patch<B = unknown, R = unknown>(url: string, body: B, config?: AxiosRequestConfig): Promise<AxiosResponse<R>>;
  upload<R = unknown>(url: string, formData: FormData, onProgress?: (percent: number) => void): Promise<AxiosResponse<R>>;
  redirectHandlerInClient(): void;
}
