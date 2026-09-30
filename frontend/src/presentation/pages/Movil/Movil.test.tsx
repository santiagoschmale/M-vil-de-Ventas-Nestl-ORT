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
    http.post('*/api/movil/deshacer', anotar),
    http.post('*/api/movil/aprobar', anotar),
    http.post('*/api/movil/reabrir', anotar),
    http.post('*/api/movil/etapas/*', anotar),
    http.put('*/api/movil/porcentajes', anotar),
    http.post('*/api/movil/entidades', anotar),
    http.delete('*/api/movil/entidades', anotar),
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

  it('sin Excel, los totales por canal se arman en la pantalla desde los kilos del mes anterior', async () => {
    const base = { archivo: 'reparto_agosto.xlsx', celdas: 3, aperturas: 1,
      canales: [{ canal: 'Catering', kilos: '900.000' }, { canal: 'Córdoba', kilos: '400.000' }] };
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      faltan: ['totales por canal'], entradas: { ...estado().entradas, input2: null, base } }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: 'Armar totales por canal en la pantalla' }));
    const dialogo = screen.getByRole('dialog', { name: 'Armar totales por canal' });
    expect(dialogo).toHaveTextContent(/mes anterior/);
    expect(within(dialogo).getByLabelText('Kilos de Catering')).toHaveValue('900,000');
    await user.type(within(dialogo).getByLabelText('Pesos de Catering'), '60');
    await user.type(within(dialogo).getByLabelText('Pesos de Córdoba'), '40');
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(pedidos).toEqual([{ metodo: 'PUT', url: '/api/movil/input2',
      cuerpo: { texto: 'Canal\tKilos\tPlata\nCatering\t900,000\t60\nCórdoba\t400,000\t40' } }]));
  });

  it('se pueden agregar y sacar canales al armar los totales, aun sin mes anterior', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({
      faltan: ['totales por canal', 'mes anterior'], entradas: { ...estado().entradas, input2: null, base: null } }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: 'Armar totales por canal en la pantalla' }));
    const dialogo = screen.getByRole('dialog', { name: 'Armar totales por canal' });
    await user.type(within(dialogo).getByLabelText('Canal 1'), 'Vending');
    await user.type(within(dialogo).getByLabelText('Kilos de Vending'), '100');
    await user.click(within(dialogo).getByRole('button', { name: 'Agregar canal' }));
    await user.type(within(dialogo).getByLabelText('Canal 2'), 'Borrar');
    await user.click(within(dialogo).getByRole('button', { name: 'Sacar Borrar' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(pedidos).toEqual([{ metodo: 'PUT', url: '/api/movil/input2',
      cuerpo: { texto: 'Canal\tKilos\tPlata\nVending\t100\t' } }]));
  });

  it('al armar o editar los totales, el diálogo avisa lo que va a pasar antes de guardar', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: /^Entradas/ }));
    await user.click(screen.getByRole('button', { name: 'Editar totales por canal' }));
    const dialogo = screen.getByRole('dialog', { name: 'Editar totales por canal' });
    await user.clear(within(dialogo).getByLabelText('Pesos de Catering'));
    expect(within(dialogo).getByText(/Falta el peso de 1 canal/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole('button', { name: 'Sacar Directa (BA)' }));
    expect(within(dialogo).getByText(/Vas a sacar Directa \(BA\)/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole('button', { name: 'Agregar canal' }));
    await user.type(within(dialogo).getByLabelText('Canal 2'), ' catering ');
    expect(within(dialogo).getByText('Ya está en la tabla')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled();
    await user.click(within(dialogo).getByRole('button', { name: 'Sacar catering' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Sacar Catering' }));
    expect(within(dialogo).getByRole('button', { name: 'Guardar' })).toBeDisabled();  // sin ningún canal
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

  it('deshacer vuelve atrás el último cambio y dice cuál es', async () => {
    const ultimo = { accion: 'apagar_sku', detalle: 'SKU 100', autor: 'planner-local', cuando: '2026-09-24T10:00:00', motivo: 'm' };
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({ deshacer: ultimo }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    const boton = await screen.findByRole('button', { name: 'Deshacer: Apagó un SKU · SKU 100' });
    await user.click(boton);
    await waitFor(() => expect(pedidos).toEqual([{ metodo: 'POST', url: '/api/movil/deshacer', cuerpo: {} }]));
  });

  it('sin un cambio para deshacer, el botón está deshabilitado', async () => {
    render(<MovilPage />);
    expect(await screen.findByRole('button', { name: 'Deshacer' })).toBeDisabled();
  });

  it('aprobar pide confirmar y avisa que después no se puede cambiar', async () => {
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText(/nadie puede cambiarlo/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(pedidos).toEqual([{ metodo: 'POST', url: '/api/movil/aprobar', cuerpo: {} }]));
  });

  it('aprobado, lo que edita queda deshabilitado', async () => {
    const aprobado = { accion: 'aprobar', detalle: 'Aprobó el móvil', autor: 'planner-local', cuando: '2026-09-24T10:00:00', motivo: null };
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({ aprobado }))));
    render(<MovilPage />);
    expect(await screen.findByRole('checkbox', { name: 'Apagar 100' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reabrir' })).toBeEnabled();
  });

  it('cada etapa se da por revisada, en orden, y aprobar lo exige', async () => {
    const etapas = [{ etapa: 'canal', revisada: null }, { etapa: 'apertura', revisada: null }];
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({ etapas }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Marcar revisada la etapa debajo del canal' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Marcar revisada la etapa por canal' }));
    await waitFor(() => expect(pedidos).toEqual([{ metodo: 'POST', url: '/api/movil/etapas/canal', cuerpo: {} }]));
  });

  it('no se puede aprobar si no cierra', async () => {
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({ cierra: { kilos: false, plata: true } }))));
    render(<MovilPage />);
    expect(await screen.findByRole('button', { name: 'Aprobar' })).toBeDisabled();
  });

  it('aprobado se ve en el encabezado y se reabre con motivo', async () => {
    const aprobado = { accion: 'aprobar', detalle: 'Aprobó el móvil', autor: 'planner-local', cuando: '2026-09-24T10:00:00', motivo: null };
    server.use(http.get('*/api/movil', () => HttpResponse.json(estado({ aprobado }))));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    expect(await screen.findByText(/Aprobado por planner-local/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprobar' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reabrir' }));
    await user.type(screen.getByRole('textbox', { name: /Motivo/ }), 'faltó un acuerdo');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reabrir' }));
    await waitFor(() => expect(pedidos).toEqual([{ metodo: 'POST', url: '/api/movil/reabrir', cuerpo: { motivo: 'faltó un acuerdo' } }]));
  });

  it('en la apertura, a una entidad se le pone un % manual en vez del histórico', async () => {
    const apertura = {
      sku: '100', canal: 'Catering', kilos: '1000.000', plata: '500.00', cuadra: { kilos: true, plata: true }, aviso: null,
      entidades: [
        { nombre: 'Ana', activo: true, peso: '1', porcentaje: null, kilos: '500.000', plata: '250.00' },
        { nombre: 'Beto', activo: true, peso: '1', porcentaje: '30', kilos: '300.000', plata: '150.00' },
      ],
    };
    server.use(http.get('*/api/movil/apertura/*', () => HttpResponse.json(apertura)));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: '100 en Catering: 1.000,000' }));
    expect(await screen.findByRole('button', { name: 'Base de Beto: 30%' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Base de Ana: histórico' }));
    const dialogo = screen.getByRole('dialog', { name: 'Base de cálculo de Ana' });
    await user.click(within(dialogo).getByRole('radio', { name: '% manual' }));
    await user.type(within(dialogo).getByRole('textbox', { name: '%' }), '25');
    await user.type(within(dialogo).getByRole('textbox', { name: /Motivo/ }), 'cartera nueva');
    await user.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(pedidos).toEqual([{ metodo: 'PUT', url: '/api/movil/porcentajes',
      cuerpo: { canal: 'Catering', entidad: 'Ana', porcentaje: '25', motivo: 'cartera nueva' } }]));
  });

  it('en la apertura se da de alta un vendedor nuevo con su % y se lo puede sacar', async () => {
    const apertura = {
      sku: '100', canal: 'Catering', kilos: '1000.000', plata: '500.00', cuadra: { kilos: true, plata: true }, aviso: null,
      entidades: [
        { nombre: 'Ana', activo: true, peso: '1', porcentaje: null, nueva: false, kilos: '800.000', plata: '400.00' },
        { nombre: 'Nuevo', activo: true, peso: '0', porcentaje: '20', nueva: true, kilos: '200.000', plata: '100.00' },
      ],
    };
    server.use(http.get('*/api/movil/apertura/*', () => HttpResponse.json(apertura)));
    const user = userEvent.setup({ delay: null });
    render(<MovilPage />);
    await user.click(await screen.findByRole('button', { name: '100 en Catering: 1.000,000' }));
    await user.click(await screen.findByRole('button', { name: 'Agregar distribuidor o vendedor' }));
    const alta = screen.getByRole('dialog', { name: 'Agregar a Catering' });
    expect(within(alta).getByText(/no tiene historia/)).toBeInTheDocument();
    await user.type(within(alta).getByRole('textbox', { name: 'Nombre' }), 'Carla');
    await user.type(within(alta).getByRole('textbox', { name: '%' }), '15');
    await user.type(within(alta).getByRole('textbox', { name: /Motivo/ }), 'entró en octubre');
    await user.click(within(alta).getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(pedidos).toEqual([{ metodo: 'POST', url: '/api/movil/entidades',
      cuerpo: { canal: 'Catering', entidad: 'Carla', porcentaje: '15', motivo: 'entró en octubre' } }]));

    pedidos.length = 0;
    await user.click(screen.getByRole('button', { name: 'Eliminar Nuevo' }));
    await user.type(screen.getByRole('textbox', { name: /Motivo/ }), 'error');
    await user.click(within(screen.getByRole('dialog', { name: 'Eliminar Nuevo' })).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(pedidos).toEqual([{ metodo: 'DELETE', url: '/api/movil/entidades',
      cuerpo: { canal: 'Catering', entidad: 'Nuevo', motivo: 'error' } }]));
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
