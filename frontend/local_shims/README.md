# Reemplazo local de `nbra-http-client`

`nbra-http-client` es una librería interna de Nestlé que se instala desde su
registro privado de npm (`nbra-js-feed`), al que todavía no tenemos acceso. Este
paquete expone lo que usa el template: `new AxiosHttpClient(config)`, los métodos
de axios y `redirectHandlerInClient()`, que acá no hace nada porque en local no
hay login que redirija.

**Mientras no haya acceso**, `package.json` apunta acá
(`"nbra-http-client": "file:./local_shims/nbra-http-client"`). Cuando haya acceso
se vuelve a `"nbra-http-client": "^1.1.2"` y se borra esta carpeta.

`.npmrc` sigue apuntando al registro de Nestlé (lo necesita el pipeline). En
local se instala contra el registro público:

    npm ci --registry=https://registry.npmjs.org/

Hoy `nbra-http-client` no existe en el registro público. Si alguien registrara ese
nombre, instalarlo desde ahí sería instalar código ajeno (dependency confusion):
por eso el paquete sale de acá y no del registro.
