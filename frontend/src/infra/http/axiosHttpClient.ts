import { AxiosHttpClient } from 'nbra-http-client';

const api: AxiosHttpClient = new AxiosHttpClient({
  baseURL: '/api',
  maxRedirects: 0,
  validateStatus: status => status < 300,
});

api.redirectHandlerInClient();

export { api };
