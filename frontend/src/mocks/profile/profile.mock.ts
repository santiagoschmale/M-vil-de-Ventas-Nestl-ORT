import { http, HttpResponse } from 'msw';

export default [
  http.get(`/api/whoami`, () => HttpResponse.json({ name: 'Ceconello,Dione,BR-São Paulo,External', username: 'Dione.Ceconello@br.nestle.com', roles: ['sm-admin'], custom: {} }, { status: 200 })),
];
