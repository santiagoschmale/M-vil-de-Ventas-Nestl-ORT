import { http, HttpResponse } from 'msw';

export default [
    http.get(`/api/tokens`, () => HttpResponse.json([{ "id": "658efec3bf31d5757ee578c9", "secret": "********************************", "roles": ["admin"], "system": "DEMO", "custom": {}, "key": "b5377240-663b-4e8e-90a0-6bc3614a50f3", "createdAt": "2023-12-29T17:15:47.975Z" }])),
    http.get(`/api/tokens/658efec3bf31d5757ee578c9`, () => HttpResponse.json({ "id": "658efec3bf31d5757ee578c9", "roles": ["admin"], "system": "DEMO", "custom": {}, "key": "b5377240-663b-4e8e-90a0-6bc3614a50f3", "createdAt": "2023-12-29T17:15:47.975Z" })),
    http.post(`/api/tokens`, () => HttpResponse.json({ "id": "new", "secret": "secret", "roles": ["admin"], "system": "DEMO", "custom": {}, "key": "b5377240-663b-4e8e-90a0-6bc3614a50f3", "createdAt": "2023-12-29T17:15:47.975Z" })),
    http.put(`/api/tokens/658efec3bf31d5757ee578c9`, () => HttpResponse.json({ "id": "658efec3bf31d5757ee578c9", "roles": ["admin"], "system": "DEMO", "custom": {}, "key": "b5377240-663b-4e8e-90a0-6bc3614a50f3", "createdAt": "2023-12-29T17:15:47.975Z" })),
    http.put(`/api/tokens/658efec3bf31d5757ee578c9/new-secret`, () => HttpResponse.json({ "id": "658efec3bf31d5757ee578c9", "secret": "secret", "roles": ["admin"], "system": "DEMO", "custom": {}, "key": "b5377240-663b-4e8e-90a0-6bc3614a50f3", "createdAt": "2023-12-29T17:15:47.975Z" })),
    http.delete(`/api/tokens/658efec3bf31d5757ee578c9`, () => HttpResponse.json({ status: 200 })),
]
