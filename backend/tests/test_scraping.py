import pytest
from app.scraping.excel_parser import normalize_headers, parse_excel_property_row
from unittest.mock import MagicMock


def test_normalize_headers():
    cell = MagicMock()
    cell.value = "Dirección"
    result = normalize_headers([cell])
    assert result == ["direcci_n"]


def test_parse_excel_property_row_missing_address():
    headers = ["nombre", "precio"]
    row = [MagicMock(value="test"), MagicMock(value=100)]
    result = parse_excel_property_row(headers, row)
    assert result is None
