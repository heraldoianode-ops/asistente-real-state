from dataclasses import dataclass
from typing import List, Tuple
from app.ml.features import ClientFeatures
import os

MODEL_PATH = os.getenv("ML_MODEL_PATH", "/app/ml_models/lead_scorer.json")


@dataclass
class ScoreResult:
    score: float
    label: str
    model_used: str
    top_features: List[Tuple[str, float]]


def _rule_based_score(f: ClientFeatures) -> float:
    score = 0.0
    if f.has_budget:
        score += 0.25
    if f.interactions_last_7d >= 3:
        score += 0.20
    elif f.interactions_last_7d >= 1:
        score += 0.10
    if f.events_completed >= 1:
        score += 0.20
    if f.has_preferred_neighborhood:
        score += 0.10
    if f.has_preferred_type:
        score += 0.10
    if f.days_since_last_interaction < 3:
        score += 0.15
    elif f.days_since_last_interaction > 14:
        score -= 0.10
    return max(0.0, min(1.0, score))


def score_lead(features: ClientFeatures) -> ScoreResult:
    try:
        import xgboost as xgb
        import numpy as np
        model = xgb.XGBClassifier()
        model.load_model(MODEL_PATH)
        feat_values = [
            features.days_since_first_contact, features.total_interactions,
            features.interactions_last_7d, features.interactions_last_30d,
            features.has_budget, features.budget_usd,
            features.has_preferred_neighborhood, features.has_preferred_type,
            features.min_bedrooms, features.events_scheduled,
            features.events_completed, features.events_cancelled,
            features.completion_rate, features.days_since_last_interaction,
            features.has_wa_contact, features.preferred_operation_buy,
            features.preferred_operation_rent,
        ]
        arr = np.array([feat_values])
        prob = float(model.predict_proba(arr)[0][1])
        importance = model.feature_importances_
        feat_names = list(features.__dataclass_fields__.keys())
        top = sorted(zip(feat_names, importance.tolist()), key=lambda x: -x[1])[:5]
        label = "hot" if prob >= 0.7 else "warm" if prob >= 0.4 else "cold"
        return ScoreResult(score=prob, label=label, model_used="xgboost", top_features=top)
    except Exception:
        score = _rule_based_score(features)
        label = "hot" if score >= 0.7 else "warm" if score >= 0.4 else "cold"
        return ScoreResult(score=score, label=label, model_used="rules", top_features=[])
