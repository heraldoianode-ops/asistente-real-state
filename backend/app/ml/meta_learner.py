from sqlalchemy import select
from app.models.feedback import FeedbackRecord, FeedbackTarget, FeedbackSentiment
from app.ml.trainer import run_training_pipeline
from app.core.database import AsyncSessionLocal
import structlog

log = structlog.get_logger()


async def process_agent_response_feedback(record: FeedbackRecord, db):
    log.info("meta_learner.agent_feedback", target_id=str(record.target_id), sentiment=record.sentiment)


async def process_match_feedback(record: FeedbackRecord, db):
    log.info("meta_learner.match_feedback", target_id=str(record.target_id), sentiment=record.sentiment)


async def process_score_feedback(record: FeedbackRecord, db):
    log.info("meta_learner.score_feedback", target_id=str(record.target_id), sentiment=record.sentiment)


async def process_rag_feedback(record: FeedbackRecord, db):
    log.info("meta_learner.rag_feedback", target_id=str(record.target_id), sentiment=record.sentiment)


ROUTERS = {
    FeedbackTarget.agent_response: process_agent_response_feedback,
    FeedbackTarget.property_match: process_match_feedback,
    FeedbackTarget.lead_score: process_score_feedback,
    FeedbackTarget.rag_document: process_rag_feedback,
}


async def run_meta_learning_cycle():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(FeedbackRecord).where(FeedbackRecord.processed == False).limit(100)
        )
        records = result.scalars().all()
        for record in records:
            handler = ROUTERS.get(record.target)
            if handler:
                await handler(record, db)
            record.processed = True
        await db.commit()

        # Retrain if enough new data
        training_result = await run_training_pipeline(db)
        log.info("meta_learner.cycle_complete", training=training_result)
        return {"processed": len(records), "training": training_result}
