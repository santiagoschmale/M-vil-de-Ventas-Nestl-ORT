// Reemplazo local de nbra-http-client: la misma forma que usa el template, sobre
// axios. Ver local_shims/README.md.
//   get<R>(url, config?)            -> Promise<AxiosResponse<R>>
//   post/put/patch<B, R>(url, body) -> Promise<AxiosResponse<R>>
//   delete<R>(url, config?)         -> Promise<AxiosResponse<R>>
//   upload(url, formData, onProgress(percent))
import axios from "axios";

export class AxiosHttpClient {
  constructor(config) {
    this.instance = axios.create(config);
    this.interceptors = this.instance.interceptors;
  }

  get(url, config) {
    return this.instance.get(url, config);
  }

  delete(url, config) {
    return this.instance.delete(url, config);
  }

  post(url, body, config) {
    return this.instance.post(url, body, config);
  }

  put(url, body, config) {
    return this.instance.put(url, body, config);
  }

  patch(url, body, config) {
    return this.instance.patch(url, body, config);
  }

  upload(url, formData, onProgress) {
    return this.instance.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded * 100) / e.total) : 0),
    });
  }

  // El real maneja las redirecciones de autenticación de la plataforma. En local
  // no hay login que redirija, así que no hace nada.
  redirectHandlerInClient() {}
}

