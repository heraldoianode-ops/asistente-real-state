import pandas as pd
from sqlalchemy import select
from app.models.client import Client, LeadStage
from app.ml.features import extract_features
import os
import asyncio

MODEL_PATH = os.getenv("ML_MODEL_PATH", "/app/ml_models/lead_scorer.json")


async def build_training_dataset(db) -> pd.DataFrame:
    result = await db.execute(select(Client))
    clients = result.scalars().all()
    rows = []
    for client in clients:
        features = await extract_features(client, db)
        label = 1 if client.lead_stage in (LeadStage.closing, LeadStage.closed_won) else 0
        row = {**features.__dict__, "label": label}
        rows.append(row)
    return pd.DataFrame(rows)


async def run_training_pipeline(db):
    import xgboost as xgb
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import roc_auc_score
    import os

    df = await build_training_dataset(db)
    if len(df) < 20:
        return {"status": "skipped", "reason": "insufficient_data", "rows": len(df)}

    X = df.drop(columns=["label"])
    y = df["label"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = xgb.XGBClassifier(n_estimators=100, max_depth=4, learning_rate=0.1, use_label_encoder=False, eval_metric="logloss")
    model.fit(X_train, y_train)

    y_pred = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_pred)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save_model(MODEL_PATH)

    return {"status": "ok", "auc": round(auc, 4), "rows": len(df)}
