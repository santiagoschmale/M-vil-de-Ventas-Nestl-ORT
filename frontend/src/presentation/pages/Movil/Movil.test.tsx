import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { MovilPage } from './Movil';
import { useMovil } from '../../../stores/useMovil';
import { useSnackbarProps } from '../../../stores/useSnackbarProps';
import { mensajeDeError } from '../../../stores/useMovil/useMovil';
import { Estado } from '../../../stores/useMovil/useMovil.type';
import { cruceFactory, estadoFactory, inconsistenciaFactory, reglaFactory } from '../../../mocks/movil/fabricas';

// Un monto con más dígitos de los que un float representa exacto (está en cruceFactory).
const GRANDE = '12345678901234567.891';
const estado = (cambios: Partial<Estado> = {}) => estadoFactory.build(cambios);
const cruce = cruceFactory.build();

const pedidos: { metodo: string; url: string; cuerpo: unknown }[] = [];
beforeEach(() => {
  pedidos.length = 0;
  useMovil.setState({ foco: undefined, estado: undefined, cruce: undefined, unidad: 'kilos' });  // el store es global
  const anotar = async ({ request }: { request: Request }) => {
    pedidos.push({ metodo: request.method, url: new URL(request.url).pathname, cuerpo: await request.json() });
    return HttpResponse.json(estado());
  };
  server.use(
    http.get('*/api/movil', () => HttpResponse.json(estado())),
    http.get('*/api/movil/cruce/kilos', () => HttpResponse.json(cruce)),
    http.get('*/api/movil/apertura/*', () => HttpResponse.json({ detail: 'no se abre' }, { status: 404 })),
    http.put('*/api/movil/skus/*', anotar),
    http.put('*/api/movil/celdas/*', anotar),
    http.put('*/api/movil/input2', anotar),
    http.put('*/api/movil/skus/*/fila', anotar),
    http.put('*/api/movil/skus/*/canales', anotar),
    http.delete('*/api/movil/skus/*/canales', anotar),
  );
});

// Renderiza la pantalla entera con MUI: con toda la suite en paralelo, 5 s no siempre alcanzan.
describe('MovilPage', { timeout: 15000 }, () => {
  it('muestra los montos tal como vienen, con separadores argentinos y sin redondear', async () => {
    render(<MovilPage />);
    expect(await screen.findByText('1.000,000')).toBeInTheDocument();
    expect(screen.getByText('12.345.678.901.234.567,891')).toBeInTheDocument();
    expect(screen.getByText('repartido 499,999')).toBeInTheDocument();
  });

  it('fijar una celda manda el monto como texto con su motivo', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: '100 en Catering: 1.000,000' }));
    const dialogo = screen.getByRole('dialog');
    const valor = within(dialogo).getByLabelText('Nuevo valor');
    await user.clear(valor);
    await user.type(valor, '1234,5');
    const fijar = within(dialogo).getByRole('button', { name: 'Fijar' });
    expect(fijar).toBeDisabled(); // sin motivo no se puede
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'acuerdo comercial');
    await user.click(fijar);

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toEqual({
      metodo: 'PUT', url: '/api/movil/celdas/kilos/100/Catering',
      cuerpo: { monto: '1234,5', motivo: 'acuerdo comercial' },
    });
  });

  it('apagar un SKU pide motivo y codifica la ruta', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Apagar 200' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'SKU nuevo sin historia');
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar' }));

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toEqual({
      metodo: 'PUT', url: '/api/movil/skus/200', cuerpo: { activo: false, motivo: 'SKU nuevo sin historia' },
    });
  });

  it('si el backend rechaza el valor, el motivo se ve en el diálogo y no se cierra', async () => {
    const detalle = 'El valor supera el objetivo del SKU 100 (1500.000).';
    server.use(http.put('*/api/movil/celdas/*', () => HttpResponse.json({ detail: detalle }, { status: 422 })));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: '100 en Catering: 1.000,000' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'x');
    await user.click(within(dialogo).getByRole('button', { name: 'Fijar' }));

    expect(await within(dialogo).findByText(detalle)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('una sección que se abrió sola por un problema no se cierra sola cuando se arregla', async () => {
    const reglas = [reglaFactory.build({ id: 'R1' }), reglaFactory.build({ id: 'R2', limite: 'minimo' })];
    const conflicto = estado({ reglas, inconsistencias: { kilos: [inconsistenciaFactory.build()], plata: [] } });
    server.use(
      http.get('*/api/movil', () => HttpResponse.json(conflicto)),
      http.delete('*/api/movil/reglas/*', () => HttpResponse.json(estado({ reglas: reglas.slice(0, 1) }))),
    );
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    const seccion = await screen.findByRole('button', { name: /^Reglas/ });
    expect(seccion).toHaveAttribute('aria-expanded', 'true');  // se abrió sola: hay reglas que chocan

    await user.click(screen.getByRole('button', { name: 'Eliminar R2' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'era un error');
    await user.click(within(dialogo).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(screen.queryByText('Choca')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^Reglas/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('desde "Para revisar" se va a la regla que choca: abre Reglas y marca la fila', async () => {
    const reglas = [reglaFactory.build({ id: 'R1' }), reglaFactory.build({ id: 'R2', limite: 'minimo' })];
    server.use(http.get('*/api/movil', () => HttpResponse.json(
      estado({ reglas, inconsistencias: { kilos: [inconsistenciaFactory.build({ reglas: ['R1', 'R2'] })], plata: [] } }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: 'Ver R2' }));
    expect(screen.getByRole('button', { name: /^Reglas/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('row', { name: /^R2 / })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('row', { name: /^R1 / })).not.toHaveAttribute('aria-current');
  });

  it('desde "Para revisar" se va a la fila del SKU en la matriz', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      problemas: [{ severidad: 'aviso', mensaje: 'SKU con objetivo en cero.', sku: '200', bloque: 'input1' }],
    }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Para revisar/ }));  // no bloquea: está cerrada
    await user.click(screen.getByRole('button', { name: 'Ver SKU 200' }));
    expect(screen.getByRole('row', { name: /^Apagar 200/ })).toHaveAttribute('aria-current', 'true');
  });

  it('un problema de un SKU que no está en la matriz no ofrece ir a verlo', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      problemas: [{ severidad: 'aviso', mensaje: 'Producto de otro país.', sku: '999', bloque: 'input1' }],
    }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Para revisar/ }));
    expect(screen.getByText(/Producto de otro país/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ver SKU 999' })).not.toBeInTheDocument();
  });

  it('el ⓘ explica el concepto en un modal y no abre ni cierra la sección', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    const reglas = await screen.findByRole('button', { name: /^Reglas/ });
    const antes = reglas.getAttribute('aria-expanded');
    await user.click(screen.getByRole('button', { name: 'Qué es una regla' }));
    expect(within(screen.getByRole('dialog')).getByText(/limita cuánto de un canal/)).toBeInTheDocument();
    expect(reglas).toHaveAttribute('aria-expanded', antes);
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('la pantalla no habla de input 1 ni input 2', async () => {
    render(<MovilPage />);
    await screen.findByText('Totales por canal');
    const texto = document.body.textContent ?? '';
    const m = texto.match(/.{0,60}input\s*[12].{0,40}/i);
    expect(m?.[0] ?? null).toBeNull();
  });

  it('los totales por canal se suben en Excel', async () => {
    // Acá se prueba que la pantalla le pasa el archivo a la acción. El pedido HTTP lo cubre el test de la API
    // en el backend: en el entorno de test, jsdom + axios + msw se cuelgan con un FormData.
    const original = useMovil.getState().cargarInput2;
    const cargarInput2 = vi.fn(async () => null);
    useMovil.setState({ cargarInput2 });
    onTestFinished(() => useMovil.setState({ cargarInput2: original }));  // el store es global
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Entradas/ }));  // con todo cargado, arranca cerrada
    const archivo = new File(['x'], 'totales.xlsx');
    await user.upload(screen.getByLabelText('Excel de totales por canal'), archivo);
    expect(cargarInput2).toHaveBeenCalledWith(archivo);
  });

  it('editar los totales manda la tabla con los números como se escriben en Argentina', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Entradas/ }));
    await user.click(screen.getByRole('button', { name: 'Editar totales por canal' }));
    const dialogo = screen.getByRole('dialog');
    const kilos = within(dialogo).getByLabelText('Kilos de Directa (BA)');
    expect(kilos).toHaveValue('500,000');
    await user.clear(kilos);
    await user.type(kilos, '490,5');
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toEqual({
      metodo: 'PUT', url: '/api/movil/input2',
      cuerpo: { texto: 'Canal\tKilos\tPlata\nCatering\t1.000,000\t60,00\nDirecta (BA)\t490,5\t40,00' },
    });
  });

  it('la tabla dice en qué unidad están los números', async () => {
    render(<MovilPage />);
    expect(await screen.findByRole('columnheader', { name: 'Objetivo (kg)' })).toBeInTheDocument();
  });

  it('un SKU repetido se resuelve en la plataforma eligiendo cuál fila vale', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      problemas: [{ severidad: 'error', mensaje: 'Está repetido (filas 4 y 51).', sku: '100', bloque: 'input1',
                    tipo: 'sku_repetido' }],
      repetidos: [{ sku: '100', elegida: 4, filas: [
        { fila: 4, descripcion: 'Café 1 kg', kilos: '1500.000', nns: '90.00' },
        { fila: 51, descripcion: 'Café 1 kg (repetido)', kilos: '1.000', nns: '1.00' },
      ] }],
    }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Para revisar/ }));
    await user.click(screen.getByRole('button', { name: 'Elegir fila de SKU 100' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByRole('radio', { name: /Fila 4/ })).toBeChecked();
    await user.click(within(dialogo).getByRole('radio', { name: /Fila 51/ }));
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'la fila 4 era de otro producto');
    await user.click(within(dialogo).getByRole('button', { name: 'Usar esta fila' }));

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toEqual({
      metodo: 'PUT', url: '/api/movil/skus/100/fila', cuerpo: { fila: 51, motivo: 'la fila 4 era de otro producto' },
    });
  });

  it('desde el aviso de una celda que no se abre se va a esa celda', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      problemas: [{ severidad: 'error', mensaje: 'Catering no se puede abrir en kilos ni en pesos: …', sku: '100',
                    bloque: 'apertura', canal: 'Catering' }],
    }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Para revisar/ }));
    await user.click(screen.getByRole('button', { name: 'Ver celda 100 · Catering' }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('100 · Catering');
  });

  it('al editar los totales se ve qué cambió y contra qué objetivo se compara', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Entradas/ }));
    await user.click(screen.getByRole('button', { name: 'Editar totales por canal' }));
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('1.500,000 kg');  // el objetivo de Contraloría, como referencia
    expect(within(dialogo).queryByText(/antes:/)).not.toBeInTheDocument();
    const kilos = within(dialogo).getByLabelText('Kilos de Directa (BA)');
    await user.clear(kilos);
    await user.type(kilos, '490,5');
    expect(within(dialogo).getByText('antes: 500,000')).toBeInTheDocument();
  });

  it('el aviso de cada cambio es corto e informativo: el reparto se recalculó', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('checkbox', { name: 'Apagar 200' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'x');
    await user.click(within(dialogo).getByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(useSnackbarProps.getState().snackbarProps)
      .toEqual({ message: 'Reparto recalculado.', severity: 'info' }));
  });

  it('rojo es solo lo que no cierra: los problemas del archivo se ven en amarillo', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      cierra: { kilos: false, plata: true },
      inconsistencias: { kilos: [inconsistenciaFactory.build({ mensaje: 'No cierra por esto.' })], plata: [] },
      problemas: [{ severidad: 'error', mensaje: 'Rosario no se puede abrir.', sku: '100', bloque: 'apertura', canal: 'Catering' }],
    }))));
    render(<MovilPage />);
    expect((await screen.findByText('No cierra por esto.')).closest('.MuiAlert-standardError')).not.toBeNull();
    expect(screen.getByText(/Rosario no se puede abrir/).closest('.MuiAlert-standardWarning')).not.toBeNull();
  });

  it('exportar con cosas para revisar pide confirmar y las muestra', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      problemas: [{ severidad: 'error', mensaje: 'Rosario no se puede abrir.', sku: '100', bloque: 'apertura', canal: 'Catering' }],
    }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: 'Exportar' }));
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('Rosario no se puede abrir.');
    expect(within(dialogo).getByRole('link', { name: 'Exportar igual' })).toHaveAttribute('href', '/api/movil/exportar');
  });

  it('un SKU sin historia se resuelve diciendo dónde se vende', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      cierra: { kilos: false, plata: false },
      inconsistencias: { kilos: [inconsistenciaFactory.build({
        tipo: 'sku_sin_canal', mensaje: 'El SKU 200 tiene objetivo pero no se vendió el mes anterior.', skus: ['200'],
        canales: [], reglas: [] })], plata: [] },
    }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: 'Elegir canales de SKU 200' }));
    const dialogo = screen.getByRole('dialog');
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Directa (BA)' }));
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'lanzamiento en BA');
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toEqual({
      metodo: 'PUT', url: '/api/movil/skus/200/canales', cuerpo: { canales: ['Directa (BA)'], motivo: 'lanzamiento en BA' },
    });
  });

  it('lo elegido en dónde se vende se ve en Reglas y se puede quitar', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      canales_sku: [{ sku: '200', canales: ['Directa (BA)'], accion: 'elegir_canales', detalle: '', autor: 'planner-local',
                      cuando: '2026-09-28T10:00:00-03:00', motivo: 'lanzamiento' }],
    }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Reglas/ }));
    expect(screen.getByText(/SKU 200 se vende en Directa \(BA\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Quitar dónde se vende SKU 200' }));
    const dialogo = screen.getByRole('dialog');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'se postergó');
    await user.click(within(dialogo).getByRole('button', { name: 'Quitar' }));
    await waitFor(() => expect(pedidos).toHaveLength(1));
    expect(pedidos[0]).toMatchObject({ metodo: 'DELETE', url: '/api/movil/skus/200/canales', cuerpo: { motivo: 'se postergó' } });
  });

  it('exportar se habilita solo cuando kilos y pesos cierran', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({ cierra: { kilos: true, plata: false } }))));
    render(<MovilPage />);
    expect(await screen.findByRole('link', { name: 'Exportar' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('mensajeDeError', () => {
  it('sin respuesta es un problema de conexión', () => {
    expect(mensajeDeError(new Error('Network Error'))).toMatch(/No se pudo conectar/);
  });
  it('usa el detalle del backend cuando lo hay', () => {
    expect(mensajeDeError({ response: { status: 422, data: { detail: 'Todo ajuste necesita un motivo.' } } }))
      .toBe('Todo ajuste necesita un motivo.');
  });
  it('un 500 dice que no se aplicó', () => {
    expect(mensajeDeError({ response: { status: 500, data: 'Internal server error' } })).toMatch(/no se aplicó/);
  });
  it('si contesta otra aplicación (una página HTML), dice que revise el puerto', () => {
    const m = mensajeDeError({ response: { status: 404, data: '<!DOCTYPE html><html>…</html>' } });
    expect(m).toMatch(/otra aplicación/);
    expect(m).toMatch(/3000/);
  });
  it('una validación de formato (lista de pydantic) no muestra inglés técnico', () => {
    const m = mensajeDeError({ response: { status: 422, data: { detail: [{ msg: 'Input should be a valid string' }] } } });
    expect(m).not.toMatch(/Input should/);
  });
});
