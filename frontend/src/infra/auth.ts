import type { PublicClientApplication } from '@azure/msal-browser';
import { api } from './http';

/**
 * Login con Microsoft Entra ID. El backend dice si está configurado (/api/config): si no, no hay
 * login y la pantalla usa el planner de prueba, como en desarrollo. Si sí, se inicia sesión con
 * Microsoft y cada pedido a la API lleva el token.
 */
let msal: PublicClientApplication | undefined;
let alcances: string[] = [];

let reiniciable = false;

export const conEntra = () => msal !== undefined;
/** Empezar de cero: solo en local o en un entorno de prueba que lo permite (lo dice el backend). */
export const puedeReiniciar = () => reiniciable;

const token = async () => {
  try {
    return (await msal!.acquireTokenSilent({ scopes: alcances })).accessToken;
  } catch {
    // Venció y no se pudo renovar en silencio: vuelve a Microsoft y regresa acá.
    await msal!.acquireTokenRedirect({ scopes: alcances });
    return new Promise<string>(() => undefined); // la página se va a Microsoft: el pedido no sigue ni falla
  }
};

/** Antes de mostrar la pantalla: si hay Entra, la sesión tiene que estar iniciada. */
export const iniciarSesion = async (): Promise<void> => {
  const config = await fetch('/api/config').then(r => (r.ok ? r.json() : null)).catch(() => null);
  reiniciable = !!config?.reiniciar;
  if (!config?.entra) return;
  const { tenant, client_id: cliente } = config.entra as { tenant: string; client_id: string };
  const { PublicClientApplication } = await import('@azure/msal-browser');
  msal = new PublicClientApplication({
    auth: { clientId: cliente, authority: `https://login.microsoftonline.com/${tenant}`, redirectUri: window.location.origin },
    cache: { cacheLocation: 'sessionStorage' },
  });
  await msal.initialize();
  alcances = [`api://${cliente}/access_as_user`];
  const vuelta = await msal.handleRedirectPromise();
  const cuenta = vuelta?.account ?? msal.getAllAccounts()[0];
  if (!cuenta) {
    await msal.loginRedirect({ scopes: alcances });
    return new Promise(() => undefined); // la página se va a Microsoft: no hay nada que mostrar
  }
  msal.setActiveAccount(cuenta);
  api.interceptors.request.use(async pedido => {
    pedido.headers.Authorization = `Bearer ${await token()}`;
    return pedido;
  });
};

export const cerrarSesion = () => msal?.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
