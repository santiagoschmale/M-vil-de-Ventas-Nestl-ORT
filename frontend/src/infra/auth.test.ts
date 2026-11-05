import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';

// Microsoft no se toca en los tests: la librería se reemplaza por una con una sesión ya iniciada.
const loginRedirect = vi.fn();
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    handleRedirectPromise: vi.fn().mockResolvedValue(null),
    getAllAccounts: vi.fn().mockReturnValue(globalThis.__cuentas ?? []),
    setActiveAccount: vi.fn(),
    loginRedirect,
    acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'token-de-prueba' }),
  })),
}));

declare global { var __cuentas: unknown[] | undefined } // eslint-disable-line no-var

describe('iniciarSesion', () => {
  beforeEach(() => { vi.resetModules(); loginRedirect.mockClear(); globalThis.__cuentas = undefined; });

  it('sin Entra configurado no pide login', async () => {
    server.use(http.get('*/api/config', () => HttpResponse.json({ entra: null })));
    const { iniciarSesion, conEntra } = await import('./auth');
    await iniciarSesion();
    expect(conEntra()).toBe(false);
    expect(loginRedirect).not.toHaveBeenCalled();
  });

  it('con Entra y la sesión iniciada, cada pedido lleva el token', async () => {
    globalThis.__cuentas = [{ username: 'ana@nestle.test' }];
    let autorizacion: string | null = null;
    server.use(
      http.get('*/api/config', () => HttpResponse.json({ entra: { tenant: 't', client_id: 'c' } })),
      http.get('*/api/movil/meses', ({ request }) => { autorizacion = request.headers.get('authorization'); return HttpResponse.json([]); }),
    );
    const { iniciarSesion, conEntra } = await import('./auth');
    const { api } = await import('./http');
    await iniciarSesion();
    expect(conEntra()).toBe(true);
    await api.get('/movil/meses');
    expect(autorizacion).toBe('Bearer token-de-prueba');
  });

  it('con Entra y sin sesión, manda a iniciar sesión con Microsoft', async () => {
    server.use(http.get('*/api/config', () => HttpResponse.json({ entra: { tenant: 't', client_id: 'c' } })));
    const { iniciarSesion } = await import('./auth');
    void iniciarSesion();
    await vi.waitFor(() => expect(loginRedirect).toHaveBeenCalledWith({ scopes: ['api://c/access_as_user'] }));
  });
});
