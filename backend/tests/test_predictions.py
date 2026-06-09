import pytest
from app.ml.predictor import score_lead, ScoreResult
from app.ml.features import ClientFeatures


def test_score_lead_rules_cold():
    features = ClientFeatures(
        days_since_first_contact=100,
        total_interactions=1,
        interactions_last_7d=0,
        interactions_last_30d=1,
        has_budget=0,
        budget_usd=0,
        has_preferred_neighborhood=0,
        has_preferred_type=0,
        min_bedrooms=0,
        events_scheduled=0,
        events_completed=0,
        events_cancelled=0,
        completion_rate=0.0,
        days_since_last_interaction=30,
        has_wa_contact=0,
        preferred_operation_buy=0,
        preferred_operation_rent=0,
    )
    result = score_lead(features)
    assert isinstance(result, ScoreResult)
    assert result.label == "cold"
    assert 0 <= result.score <= 1
