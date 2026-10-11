"""
El móvil de cada mes se guarda: lo que hizo el planner sobrevive a un reinicio. Se
prueba con SQLite en memoria; en producción es PostgreSQL con las mismas tablas.
"""

from datetime import date, datetime

from src.movil.almacen import Almacen
from src.movil.repositorio import MesInexistente, Repositorio, mes_siguiente
from src.movil.sesion import ErrorDeAjuste
from tests.movil.test_sesion import CUANDO, MUESTRA, NUEVO, P

DESPUES = datetime(2026, 10, 2, 11, 0)
HOY = lambda: date(2026, 10, 7)  # noqa: E731


def _almacen():
    a = Almacen("sqlite://")
    a.crear_tablas()
    return a


def _armar(s):
    s.cargar_input1(MUESTRA / "input1_objetivo.xlsx", "objetivo.xlsx", P, CUANDO)
    s.cargar_input2((MUESTRA / "input2_sin_sku_nuevo.tsv").read_text(encoding="utf-8"), P, CUANDO)
    s.cargar_base(MUESTRA / "base_mes_anterior.xlsx", "base.xlsx", P, CUANDO)
    s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=CUANDO, motivo="nuevo")
    s.asignar_porcentaje("Córdoba", "Sofía Correa", "30", P, DESPUES, "cartera nueva")
    s.revisar_etapa("canal", P, DESPUES)
    s.revisar_etapa("apertura", P, DESPUES)
    s.aprobar(P, DESPUES)


def test_sin_almacen_arranca_el_mes_actual_en_memoria():
    r = Repositorio(hoy=HOY)
    with r.usar() as s:
        assert s.mes == "2026-10" and s.faltan()
    assert [m["mes"] for m in r.meses()] == ["2026-10"]


def test_lo_guardado_sobrevive_a_un_reinicio():
    almacen = _almacen()
    with Repositorio(almacen, hoy=HOY).usar() as s:
        _armar(s)
        antes = (s.recorrido.kilos.celdas, s.recorrido.plata.celdas, [a.accion for a in s.historial])
    with Repositorio(almacen, hoy=HOY).usar() as s:  # otro proceso: reconstruye desde la base
        assert (s.recorrido.kilos.celdas, s.recorrido.plata.celdas, [a.accion for a in s.historial]) == antes
        assert s.aprobado is not None and set(s.revisadas) == {"canal", "apertura"}
        assert s.porcentajes[("Córdoba", "Sofía Correa")][0] == 30


def test_una_accion_rechazada_no_se_guarda():
    almacen = _almacen()
    with Repositorio(almacen, hoy=HOY).usar() as s:
        s.cargar_input1(MUESTRA / "input1_objetivo.xlsx", "objetivo.xlsx", P, CUANDO)
        try:
            s.cambiar_sku("no-existe", activo=False, autor=P, cuando=CUANDO, motivo="")
        except ErrorDeAjuste:
            pass
    assert [m for _, m, _ in almacen.comandos("2026-10")] == ["cargar_input1"]


def test_pedir_un_mes_que_no_existe_falla():
    try:
        with Repositorio(_almacen(), hoy=HOY).usar("2020-01"):
            pass
        assert False, "tenía que fallar"
    except MesInexistente:
        pass


def test_el_mes_siguiente():
    assert mes_siguiente("2026-10") == "2026-11"
    assert mes_siguiente("2026-12") == "2027-01"


def test_el_mes_siguiente_arranca_del_aprobado():
    """El histórico lo arma la herramienta: el reparto aprobado es la base del mes siguiente (confirmado 07/10)."""
    almacen = _almacen()
    r = Repositorio(almacen, hoy=HOY)
    with r.usar() as s:
        _armar(s)
        s.reabrir(P, DESPUES, "falta una regla")
        s.agregar_regla("Mayoristas", ["Café"], "tope", "40", None, P, DESPUES, "acuerdo")
        s.revisar_etapa("canal", P, DESPUES)
        s.revisar_etapa("apertura", P, DESPUES)
        s.aprobar(P, DESPUES)
        aprobado = dict(s.recorrido.kilos.celdas)
    assert r.empezar_siguiente(P, DESPUES) == "2026-11"
    with Repositorio(almacen, hoy=HOY).usar() as s:  # y sobrevive a un reinicio
        assert s.mes == "2026-11" and s.faltan() == ["objetivo de Contraloría"]
        assert s.entradas.base == {k: v for k, v in aprobado.items()}
        assert set(s.reglas) == {"R1"} and s.porcentajes[("Córdoba", "Sofía Correa")][0] == 30
        assert s.historial[-1].accion == "heredar" and "2026-10" in s.historial[-1].detalle
        s.cargar_input1(MUESTRA / "input1_objetivo.xlsx", "objetivo de noviembre.xlsx", P, DESPUES)
        s.cambiar_sku(NUEVO, activo=False, autor=P, cuando=DESPUES, motivo="los SKUs apagados no se heredan")
        assert s.recorrido.kilos.celdas is not None  # con el objetivo nuevo, reparte


def test_el_mes_siguiente_exige_el_anterior_aprobado():
    r = Repositorio(_almacen(), hoy=HOY)
    with r.usar() as s:
        s.cargar_input1(MUESTRA / "input1_objetivo.xlsx", "objetivo.xlsx", P, CUANDO)
    try:
        r.empezar_siguiente(P, DESPUES)
        assert False, "tenía que fallar"
    except ErrorDeAjuste as e:
        assert "aprobá" in str(e)


def test_las_categorias_pasan_al_mes_siguiente():
    """Las del archivo y las asignadas: el mes siguiente puede venir con el template sin categoría."""
    r = Repositorio(_almacen(), hoy=HOY)
    with r.usar() as s:
        _armar(s)
        categorias = {k: o.categoria for k, o in s.objetivos_vigentes().items() if o.categoria}
    r.empezar_siguiente(P, DESPUES)
    with r.usar() as s:
        assert s.categorias == categorias


def test_el_mes_siguiente_sin_ningun_mes_avisa():
    try:
        Repositorio(_almacen(), hoy=HOY).empezar_siguiente(P, DESPUES)
        assert False, "tenía que fallar"
    except ErrorDeAjuste as e:
        assert "ningún móvil" in str(e)


def test_un_mes_anterior_no_se_toca():
    """Quien tenía octubre abierto no puede seguir cambiándolo cuando otro ya empezó noviembre."""
    r = Repositorio(_almacen(), hoy=HOY)
    with r.usar() as s:
        _armar(s)
    r.empezar_siguiente(P, DESPUES)
    with r.usar("2026-10") as s:
        assert not s.es_ultimo
        for accion in (lambda: s.reabrir(P, DESPUES, "m"),
                       lambda: s.cambiar_sku(NUEVO, activo=True, autor=P, cuando=DESPUES, motivo="m"),
                       lambda: s.asignar_categorias({"90020001": "Café"}, P, DESPUES, "m")):
            try:
                accion()
                assert False, "tenía que rechazarse"
            except ErrorDeAjuste:
                pass
