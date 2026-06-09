import re
from typing import Optional


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9_]", "_", text.lower().strip())


def normalize_headers(row) -> list:
    return [_slug(str(cell.value or "")) for cell in row]


def parse_excel_property_row(headers: list, row) -> Optional[dict]:
    values = [cell.value for cell in row]
    data = dict(zip(headers, values))
    address = data.get("direccion") or data.get("address")
    if not address:
        return None
    return {
        "address": str(address),
        "neighborhood": str(data.get("barrio") or data.get("neighborhood") or ""),
        "property_type": str(data.get("tipo") or data.get("type") or "other"),
        "operation_type": str(data.get("operacion") or data.get("operation") or "sale"),
        "price": float(data.get("precio") or data.get("price") or 0),
        "currency": str(data.get("moneda") or data.get("currency") or "USD"),
        "bedrooms": int(data.get("dormitorios") or data.get("bedrooms") or 0) or None,
        "sqm_covered": float(data.get("sup_cubierta") or data.get("sqm_covered") or 0) or None,
        "description": str(data.get("descripcion") or data.get("description") or ""),
    }


def parse_excel_contact_row(headers: list, row) -> Optional[dict]:
    values = [cell.value for cell in row]
    data = dict(zip(headers, values))
    name = data.get("nombre") or data.get("name")
    if not name:
        return None
    return {
        "full_name": str(name),
        "phone": str(data.get("telefono") or data.get("phone") or ""),
        "email": str(data.get("email") or ""),
        "notes": str(data.get("notas") or data.get("notes") or ""),
    }
