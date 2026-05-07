"""Parse GBM CFDI 4.0 account-statement XMLs into structured records.

Each XML is a SAT electronic invoice for the monthly broker commission. The
real account movements live as plain text inside <cfdi:Addenda><Movimientos>,
formatted like:

    Movimientos:
    Contrato, Descripción, Monto, Fecha, Folio
     AFF35401, Premio en vencimiento de reporto, 0.00, 01-10-2025, 1727092795
     ...
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "cfdi": "http://www.sat.gob.mx/cfd/4",
    "tfd":  "http://www.sat.gob.mx/TimbreFiscalDigital",
}


@dataclass
class Invoice:
    source_file: str
    serie: str
    folio: str
    fecha: str             # ISO timestamp from the CFDI header
    uuid: str
    fecha_timbrado: str
    moneda: str
    subtotal_mxn: float    # commission base (no IVA)
    iva_mxn: float
    total_mxn: float
    issuer_rfc: str
    issuer_name: str
    receiver_rfc: str
    receiver_name: str


@dataclass
class Movement:
    source_file: str
    invoice_uuid: str
    statement_period: str  # YYYY-MM (from invoice fecha)
    contract: str
    date: str              # YYYY-MM-DD
    description: str
    inferred_type: str
    amount_mxn: float
    folio: str


# --- classification --------------------------------------------------------

_KIND_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("INTEREST", re.compile(r"premio.*reporto|intereses?|rendimiento", re.I)),
    ("FEE",      re.compile(r"comisi[oó]n|honorario|cargo", re.I)),
    ("BUY",      re.compile(r"\bcompra\b|adquisici[oó]n", re.I)),
    ("SELL",     re.compile(r"\bventa\b|enajenaci[oó]n", re.I)),
    ("DIV",      re.compile(r"dividend", re.I)),
    ("TRANSFER", re.compile(r"traspaso|dep[oó]sito|retiro|abono", re.I)),
    ("TAX",      re.compile(r"\bisr\b|iva|retenci[oó]n", re.I)),
]


def classify(description: str) -> str:
    for kind, rx in _KIND_PATTERNS:
        if rx.search(description):
            return kind
    return "OTHER"


# --- XML parsing -----------------------------------------------------------

def _attr(el: ET.Element | None, key: str, default: str = "") -> str:
    return el.attrib.get(key, default) if el is not None else default


def _float(el: ET.Element | None, key: str, default: float = 0.0) -> float:
    if el is None or key not in el.attrib:
        return default
    try:
        return float(el.attrib[key])
    except ValueError:
        return default


def parse_xml(path: Path) -> tuple[Invoice, list[Movement]]:
    root = ET.parse(path).getroot()

    iva = 0.0
    impuestos = root.find("cfdi:Impuestos", NS)
    if impuestos is not None:
        iva = _float(impuestos, "TotalImpuestosTrasladados", 0.0)

    tfd = root.find("cfdi:Complemento/tfd:TimbreFiscalDigital", NS)

    invoice = Invoice(
        source_file=path.name,
        serie=_attr(root, "Serie"),
        folio=_attr(root, "Folio"),
        fecha=_attr(root, "Fecha"),
        uuid=_attr(tfd, "UUID"),
        fecha_timbrado=_attr(tfd, "FechaTimbrado"),
        moneda=_attr(root, "Moneda", "MXN"),
        subtotal_mxn=_float(root, "SubTotal"),
        iva_mxn=iva,
        total_mxn=_float(root, "Total"),
        issuer_rfc=_attr(root.find("cfdi:Emisor", NS), "Rfc"),
        issuer_name=_attr(root.find("cfdi:Emisor", NS), "Nombre"),
        receiver_rfc=_attr(root.find("cfdi:Receptor", NS), "Rfc"),
        receiver_name=_attr(root.find("cfdi:Receptor", NS), "Nombre"),
    )

    movements: list[Movement] = []
    addenda = root.find("cfdi:Addenda", NS)
    if addenda is not None:
        movements = _extract_movements(
            text="".join(addenda.itertext()),
            source_file=invoice.source_file,
            uuid=invoice.uuid,
            fecha=invoice.fecha,
        )

    return invoice, movements


def _to_iso(ddmmyyyy: str) -> str:
    """Convert '01-10-2025' → '2025-10-01'. Returns input unchanged on failure."""
    try:
        dd, mm, yyyy = ddmmyyyy.split("-")
        return f"{int(yyyy):04d}-{int(mm):02d}-{int(dd):02d}"
    except (ValueError, AttributeError):
        return ddmmyyyy


def _extract_movements(text: str, source_file: str, uuid: str, fecha: str) -> list[Movement]:
    m = re.search(r"Movimientos:\s*(.*)", text, re.S)
    if not m:
        return []

    period = (fecha or "")[:7]
    out: list[Movement] = []
    for raw in m.group(1).splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.lower().startswith("contrato"):
            continue

        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 5:
            continue

        contract, descripcion, monto, fecha_mov, folio = parts[:5]
        try:
            amount = float(monto)
        except ValueError:
            amount = 0.0

        out.append(Movement(
            source_file=source_file,
            invoice_uuid=uuid,
            statement_period=period,
            contract=contract,
            date=_to_iso(fecha_mov),
            description=descripcion,
            inferred_type=classify(descripcion),
            amount_mxn=amount,
            folio=folio,
        ))
    return out
