import { server } from './mocks/server'
import 'vitest-dom/extend-expect'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => server.resetHandlers())

//export default defineConfig({
//    plugins: [react()],
//    test: {
//        globals: true,
//        environment: 'jsdom'
//    }
//})