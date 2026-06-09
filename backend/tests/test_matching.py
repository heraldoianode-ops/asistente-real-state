import pytest
from unittest.mock import AsyncMock, MagicMock
from app.matching.property_matcher import build_property_text


def test_build_property_text_basic():
    prop = MagicMock()
    prop.title = "Apto 3 amb"
    prop.property_type = "apartment"
    prop.neighborhood = "Palermo"
    prop.city = "Buenos Aires"
    prop.operation_type = "sale"
    prop.currency = "USD"
    prop.price = 150000
    prop.sqm_covered = 70
    prop.bedrooms = 2
    prop.bathrooms = 1
    prop.amenities = ["pool", "gym"]
    prop.description = "Luminoso"
    text = build_property_text(prop)
    assert "Palermo" in text
    assert "150000" in text
