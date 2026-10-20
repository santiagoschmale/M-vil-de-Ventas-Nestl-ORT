import { http, HttpResponse } from 'msw';

export default [
  http.get(`/api/whoami`, () => HttpResponse.json({ name: 'test,User', username: 'user-test@test.com', roles: ['sm-admin'], custom: {} }, { status: 200 })),
];
