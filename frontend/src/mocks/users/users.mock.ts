import { http, HttpResponse } from 'msw';

export default [
    http.get(`/api/users`, () => HttpResponse.json([{ username: 'test@mail.com', status: 'ACTIVE', roles: ['readonly', 'admin'], id: '64067edb4d02909afe0157ae', }, { username: 'test2@mail.com', status: 'ACTIVE', roles: ['readonly'], id: '64067f1d4d02909afe0157b3', }, { username: 'test3@mail.com', status: 'ACTIVE', roles: ['readonly'], id: '640729c44c622bdf52c6506b', }, { username: 'test4@mail.com', status: 'ACTIVE', roles: ['readonly'], id: '640731710a5ba55d4d8d1e19', }, { username: 'dione.ceconello@br.nestle.com', status: 'ACTIVE', roles: ['sm-admin'], lastLogin: '2023-03-16T00:51:28.381Z', id: '640f57ec445085b0e562e140', }, { username: 'test5@mail.com', status: 'ACTIVE', roles: ['admin'], id: '640f5dff19d2b1428d3ee5f3', }, { username: 'test6@mail.com', createdAt: '2023-03-16T00:53:47.147Z', status: 'ACTIVE', roles: ['admin'], id: '6412689b2c16440fbea176d5', },]),),
    http.get(`/api/users/640f57ec445085b0e562e140`, () => HttpResponse.json({ id: '640f57ec445085b0e562e140', system: 'playground', username: 'dione.ceconello@br.nestle.com', status: 'ACTIVE', roles: ['sm-admin'], custom: {}, lastLogin: '2023-03-16T00:51:28.381Z', }),),
    http.get(`/api/users/64067edb4d02909afe0157ae`, () => HttpResponse.json({ "username": "test@mail.com", "status": "ACTIVE", "roles": ["readonly", "admin"], "id": "64067edb4d02909afe0157ae" }),),
    http.get(`/api/users/64067f1d4d02909afe0157b3`, () => HttpResponse.json({ "username": "test2@mail.com", "status": "ACTIVE", "roles": ["readonly"], "id": "64067f1d4d02909afe0157b3" }),),
    http.get(`/api/users/640729c44c622bdf52c6506b`, () => HttpResponse.json({ "username": "test3@mail.com", "status": "ACTIVE", "roles": ["readonly"], "id": "640729c44c622bdf52c6506b" }),),
    http.get(`/api/users/640731710a5ba55d4d8d1e19`, () => HttpResponse.json({ "username": "test4@mail.com", "status": "ACTIVE", "roles": ["readonly"], "id": "640731710a5ba55d4d8d1e19" }),),
    http.get(`/api/users/640f5dff19d2b1428d3ee5f3`, () => HttpResponse.json({ "username": "test5@mail.com", "status": "ACTIVE", "roles": ["admin"], "id": "640f5dff19d2b1428d3ee5f3" }),),
    http.get(`/api/users/6412689b2c16440fbea176d5`, () => HttpResponse.json({ "username": "test6@mail.com", "createdAt": "2023-03-16T00:53:47.147Z", "status": "ACTIVE", "roles": ["admin"], "id": "6412689b2c16440fbea176d5" }),),
    http.put(`/api/users/64067edb4d02909afe0157ae`, () => HttpResponse.json({ status: 200 })),
    http.put(`/api/users/640f57ec445085b0e562e140`, () => HttpResponse.json({ status: 200 }),),
    http.put(`/api/users/64067f1d4d02909afe0157b3`, () => HttpResponse.json({ status: 200 }),),
    http.put(`/api/users/640729c44c622bdf52c6506b`, () => HttpResponse.json({ status: 200 }),),
    http.put(`/api/users/640731710a5ba55d4d8d1e19`, () => HttpResponse.json({ status: 200 }),),
    http.put(`/api/users/640f5dff19d2b1428d3ee5f3`, () => HttpResponse.json({ status: 200 }),),
    http.put(`/api/users/6412689b2c16440fbea176d5`, () => HttpResponse.json({ status: 200 }),),
    http.post(`/api/users`, () => HttpResponse.json({ status: 200 })),
];
