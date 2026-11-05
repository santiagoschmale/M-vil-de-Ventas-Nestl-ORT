import { setupWorker } from 'msw/browser'
import { handlers } from './handlers';

// /api/whoami lo contesta el backend (planner de prueba o el usuario de Entra): el mock queda solo para los tests.
const sinWhoami = handlers.filter(h => !('info' in h && String((h as { info: { path?: unknown } }).info.path).includes('whoami')));
export const worker = setupWorker(...sinWhoami);
