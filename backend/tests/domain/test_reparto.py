"""
Tests del reparto.

Escritos con `assert` plano y sin fixtures, para que corran igual con pytest o con
nose2. Todavía no está confirmado cuál de los dos exige Nestlé.

    cd backend && make test

Los valores esperados están calculados a mano y verificados. Si un test falla,
el sospechoso es la implementación, no el test.
"""

from decimal import Decimal as D

from src.domain.reparto import ErrorDeReparto, cuadra, repartir


# ---------------------------------------------------------------------------
# El caso que justifica todo el módulo
# ---------------------------------------------------------------------------

def test_cien_entre_tres_cierra_exacto():
    """
    33,33 x 3 = 99,99. Falta un centésimo y hay que dárselo a alguien.

    Este es EL caso del módulo: sin largest remainder, acá se pierde plata.
    """
    r = repartir(D("100"), {"a": D(1), "b": D(1), "c": D(1)}, decimales=2)

    assert sum(r.values()) == D("100.00")
    assert r == {"a": D("33.34"), "b": D("33.33"), "c": D("33.33")}


def test_el_faltante_va_al_de_mayor_resto():
    """
    Repartir 7 entre 3 sin decimales: exactos son 2,33 cada uno, pisos 2 cada uno,
    sobra 1. Se lo lleva uno solo, no se parte.
    """
    r = repartir(D("7"), {"a": D(1), "b": D(1), "c": D(1)}, decimales=0)

    assert sum(r.values()) == D("7")
    assert sorted(r.values()) == [D("2"), D("2"), D("3")]


def test_resto_al_que_mas_le_falta_no_al_mas_grande():
    """
    Ojo con esto: el resto va al de mayor RESTO DECIMAL, no al de mayor monto.

    10 repartido 0.5 / 0.25 / 0.25 con 0 decimales:
      exactos: 5 / 2,5 / 2,5      pisos: 5 / 2 / 2 = 9      falta 1
      restos:  0 / 0,5 / 0,5      -> el 1 va a 'b' o 'c', NUNCA a 'a'

    Si la implementación le diera el resto al más grande, 'a' terminaría en 6.
    """
    r = repartir(D("10"), {"a": D("0.5"), "b": D("0.25"), "c": D("0.25")}, decimales=0)

    assert sum(r.values()) == D("10")
    assert r["a"] == D("5")
    assert {r["b"], r["c"]} == {D("3"), D("2")}


def test_empate_de_restos_es_deterministico():
    """
    Con restos empatados, dos corridas iguales tienen que dar lo mismo.

    Sin criterio de desempate fijo el orden puede variar y los tests se vuelven
    intermitentes: pasan, fallan, vuelven a pasar, y nadie entiende por qué.
    """
    pesos = {"c": D(1), "a": D(1), "b": D(1)}

    primera = repartir(D("100"), pesos, decimales=2)
    for _ in range(20):
        assert repartir(D("100"), pesos, decimales=2) == primera


def test_el_orden_del_diccionario_no_cambia_el_resultado():
    """Los mismos pesos cargados en distinto orden dan el mismo reparto."""
    uno = repartir(D("100"), {"a": D(1), "b": D(1), "c": D(1)}, decimales=2)
    otro = repartir(D("100"), {"c": D(1), "b": D(1), "a": D(1)}, decimales=2)

    assert uno == otro


# ---------------------------------------------------------------------------
# Escala real
# ---------------------------------------------------------------------------

def test_movil_de_mayo_por_canal():
    """
    El objetivo real de mayo repartido con las participaciones del histórico 2025.
    Escala y decimales de verdad.
    """
    pesos = {
        "Mayoristas": D("0.314"),
        "Vending": D("0.288"),
        "Catering": D("0.225"),
        "KAM": D("0.173"),
    }
    r = repartir(D("197718"), pesos, decimales=3)

    assert sum(r.values()) == D("197718.000")
    assert r["Mayoristas"] == D("62083.452")
    assert r["Vending"] == D("56942.784")
    assert r["Catering"] == D("44486.550")
    assert r["KAM"] == D("34205.214")


def test_movil_de_mayo_entre_tres_iguales():
    """197718 entre 3 no da redondo hasta que el largest remainder lo acomoda."""
    r = repartir(D("197718"), {"a": D(1), "b": D(1), "c": D(1)}, decimales=3)

    assert sum(r.values()) == D("197718.000")


def test_muchas_entidades_siguen_cuadrando():
    """15 vendedores con pesos distintos, que es el orden real del archivo."""
    pesos = {f"vendedor_{i:02d}": D(i + 1) for i in range(15)}
    r = repartir(D("197718"), pesos, decimales=3)

    assert sum(r.values()) == D("197718.000")
    assert len(r) == 15


# ---------------------------------------------------------------------------
# La cascada: el test que de verdad importa
# ---------------------------------------------------------------------------

def test_cascada_de_tres_niveles_no_pierde_nada():
    """
    Repartir, volver a repartir cada parte, y volver a repartir cada parte de esa.

    La suma de las hojas del árbol tiene que seguir dando el total original.
    Acá es donde se vería el error de redondeo acumulado.
    """
    total = D("197718")

    # nivel 1: canal
    canales = repartir(total, {"A": D(1), "B": D(1), "C": D(1)}, decimales=3)
    assert sum(canales.values()) == total

    # nivel 2: distribuidor dentro de cada canal
    nivel2 = {}
    for canal, monto in canales.items():
        partes = repartir(monto, {"d1": D(3), "d2": D(2), "d3": D(1)}, decimales=3)
        assert sum(partes.values()) == monto  # cuadra contra su padre
        nivel2[canal] = partes

    # nivel 3: vendedor dentro de cada distribuidor
    hojas = []
    for canal, distribuidores in nivel2.items():
        for dist, monto in distribuidores.items():
            partes = repartir(monto, {"v1": D(1), "v2": D(1), "v3": D(1)}, decimales=3)
            assert sum(partes.values()) == monto
            hojas.extend(partes.values())

    assert len(hojas) == 27
    assert sum(hojas) == total


def test_cascada_con_pesos_irregulares():
    """Lo mismo pero con pesos que no dividen bien, que es el caso real."""
    total = D("197718")

    canales = repartir(
        total,
        {"Mayoristas": D("0.314"), "Vending": D("0.288"),
         "Catering": D("0.225"), "KAM": D("0.173")},
        decimales=3,
    )

    hojas = []
    for monto in canales.values():
        partes = repartir(
            monto,
            {"a": D("0.37"), "b": D("0.33"), "c": D("0.19"), "d": D("0.11")},
            decimales=3,
        )
        assert sum(partes.values()) == monto
        hojas.extend(partes.values())

    assert sum(hojas) == total


def test_kilos_y_plata_se_reparten_por_separado():
    """
    Las dos unidades usan los mismos pesos pero distinta precisión, y cada una
    cuadra contra su propio total.
    """
    pesos = {"a": D("0.314"), "b": D("0.288"), "c": D("0.225"), "d": D("0.173")}

    kilos = repartir(D("197718"), pesos, decimales=3)
    plata = repartir(D("3934840140"), pesos, decimales=2)

    assert sum(kilos.values()) == D("197718.000")
    assert sum(plata.values()) == D("3934840140.00")


# ---------------------------------------------------------------------------
# Bordes
# ---------------------------------------------------------------------------

def test_total_cero():
    """Un SKU sin objetivo del mes. No tiene que explotar."""
    r = repartir(D("0"), {"a": D(1), "b": D(2)}, decimales=3)

    assert sum(r.values()) == D("0")
    assert all(v == 0 for v in r.values())


def test_una_sola_entidad_se_lleva_todo():
    """Un SKU que se vende por un único canal."""
    r = repartir(D("197718"), {"unica": D("0.42")}, decimales=3)

    assert r["unica"] == D("197718.000")


def test_entidad_con_peso_cero_recibe_cero():
    """
    Peso cero no es lo mismo que no estar. La entidad aparece en el resultado
    con valor cero, que es el caso 'aplica pero sin volumen'.
    """
    r = repartir(D("100"), {"a": D(1), "b": D(0), "c": D(1)}, decimales=2)

    assert r["b"] == D("0.00")
    assert "b" in r
    assert sum(r.values()) == D("100.00")


def test_sin_decimales():
    """Reparto en unidades enteras."""
    r = repartir(D("100"), {"a": D(1), "b": D(1), "c": D(1)}, decimales=0)

    assert sum(r.values()) == D("100")


def test_los_pesos_son_relativos_no_porcentajes():
    """
    Estos dos diccionarios tienen que dar el mismo resultado. Los pesos son
    relativos entre sí, no fracciones que deban sumar 1.
    """
    como_fraccion = repartir(D("100"), {"a": D("0.5"), "b": D("0.5")}, decimales=2)
    como_peso = repartir(D("100"), {"a": D(1), "b": D(1)}, decimales=2)
    como_peso_grande = repartir(D("100"), {"a": D(50), "b": D(50)}, decimales=2)

    assert como_fraccion == como_peso == como_peso_grande


def test_sacar_una_entidad_reparte_su_parte_entre_las_demas():
    """
    Deshabilitar un distribuidor es sacarlo del diccionario. Su parte no
    desaparece: los que quedan absorben proporcionalmente.
    """
    completo = repartir(D("100"), {"a": D(1), "b": D(1), "c": D(1), "d": D(1)}, decimales=2)
    sin_d = repartir(D("100"), {"a": D(1), "b": D(1), "c": D(1)}, decimales=2)

    assert sum(completo.values()) == D("100.00")
    assert sum(sin_d.values()) == D("100.00")
    assert "d" not in sin_d
    assert sin_d["a"] > completo["a"]  # a recibió más al salir d


# ---------------------------------------------------------------------------
# Entradas inválidas: tienen que fallar fuerte, no repartir mal en silencio
# ---------------------------------------------------------------------------

def test_sin_entidades_es_error():
    try:
        repartir(D("100"), {}, decimales=2)
        assert False, "tendría que haber lanzado ErrorDeReparto"
    except ErrorDeReparto:
        pass


def test_peso_negativo_es_error():
    """
    El cliente confirmó que las participaciones negativas del archivo son errores.
    El motor no las replica: las rechaza.
    """
    try:
        repartir(D("100"), {"a": D(1), "b": D("-0.2")}, decimales=2)
        assert False, "tendría que haber lanzado ErrorDeReparto"
    except ErrorDeReparto:
        pass


def test_todos_los_pesos_en_cero_es_error():
    """
    No hay peso relativo sobre el cual repartir. Es el caso 'entidad sin
    histórico' y necesita una regla de negocio propia (punto A4 del plan),
    no un reparto silencioso.
    """
    try:
        repartir(D("100"), {"a": D(0), "b": D(0)}, decimales=2)
        assert False, "tendría que haber lanzado ErrorDeReparto"
    except ErrorDeReparto:
        pass


# ---------------------------------------------------------------------------
# cuadra()
# ---------------------------------------------------------------------------

def test_cuadra_detecta_reparto_correcto():
    r = repartir(D("100"), {"a": D(1), "b": D(1), "c": D(1)}, decimales=2)
    assert cuadra(D("100"), r) is True


def test_cuadra_detecta_diferencia_de_un_centesimo():
    """Sin tolerancia: un centésimo de diferencia ya no cuadra."""
    assert cuadra(D("100"), {"a": D("33.33"), "b": D("33.33"), "c": D("33.33")}) is False


# ---------------------------------------------------------------------------
# La evidencia de por qué Decimal
# ---------------------------------------------------------------------------

def test_float_no_cuadraria():
    """
    No prueba nuestro código: documenta por qué la regla existe.

    Sirve para el informe y para explicárselo al equipo. Con float, sumar tres
    veces 0,1 no da 0,3, y ese error se arrastra por toda la cascada.
    """
    assert 0.1 + 0.2 != 0.3
    assert D("0.1") + D("0.2") == D("0.3")


# ---------------------------------------------------------------------------
# Validaciones agregadas en la implementación (no estaban en la suite original)
# ---------------------------------------------------------------------------

def _lanza_error(**kwargs):
    try:
        repartir(**kwargs)
        return False
    except ErrorDeReparto:
        return True


def test_total_negativo_es_error():
    assert _lanza_error(total=D("-1"), pesos={"a": D(1)}, decimales=2)


def test_total_con_mas_decimales_que_la_precision_es_error():
    """100,005 a 2 decimales no puede cuadrar exacto: se rechaza, no se redondea."""
    assert _lanza_error(total=D("100.005"), pesos={"a": D(1)}, decimales=2)


def test_float_se_rechaza_en_la_entrada():
    """La regla 'nunca float' se corta en la frontera del motor."""
    assert _lanza_error(total=100.0, pesos={"a": D(1)}, decimales=2)
    assert _lanza_error(total=D("100"), pesos={"a": 0.5}, decimales=2)


def test_restos_que_decimal_empataria_se_ordenan_bien():
    """
    Los restos reales son 0,49999...97 para 'a' y 0,50000...02 para 'b': la unidad
    le toca a 'b'. Con Decimal a 28 dígitos los dos quedan en 0,5, empatan, y el
    desempate alfabético se la daría a 'a'. Es la razón de usar Fraction.
    """
    r = repartir(D("1"), {"a": D(1), "b": D("1.0000000000000000000000000001")}, decimales=0)

    assert r == {"a": D("0"), "b": D("1")}


def test_decimales_invalidos_es_error():
    assert _lanza_error(total=D("100"), pesos={"a": D(1)}, decimales=-1)
    assert _lanza_error(total=D("100"), pesos={"a": D(1)}, decimales=2.0)


def test_totales_de_mas_de_28_digitos_no_se_redondean():
    """La salida se arma desde texto: scaleb() redondearía en silencio."""
    total = D("1234567890123456789012345678.901")
    r = repartir(total, {"a": D(1), "b": D(2)}, decimales=3)

    assert cuadra(total, r)


def test_a_texto_escribe_montos_como_se_leen_en_argentina():
    from src.domain.formato import a_texto

    assert a_texto(D("10.000")) == "10,000"  # diez kilos, no diez mil
    assert a_texto(D("454971.590")) == "454.971,590"
    assert a_texto(D("-1234.50")) == "-1.234,50"
    assert a_texto(D("1000")) == "1.000"
    assert a_texto(D("0.00")) == "0,00"
    assert a_texto(D("12345678901234567.891")) == "12.345.678.901.234.567,891"
