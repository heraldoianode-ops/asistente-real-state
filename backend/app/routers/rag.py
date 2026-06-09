from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.auth import get_current_user
from app.rag.ingestor import ingest_document, list_documents
from app.rag.retriever import retrieve, format_context
from pydantic import BaseModel

router = APIRouter(tags=["rag"], dependencies=[Depends(get_current_user)])


class IngestRequest(BaseModel):
    title: str
    source: str
    content: str


@router.post("/ingest")
async def ingest(body: IngestRequest, db: AsyncSession = Depends(get_db)):
    count = await ingest_document(body.title, body.source, body.content, db)
    return {"chunks": count}


@router.get("/documents")
async def documents(db: AsyncSession = Depends(get_db)):
    return await list_documents(db)


@router.get("/retrieve")
async def retrieve_endpoint(q: str, db: AsyncSession = Depends(get_db)):
    docs = await retrieve(q, db)
    return {"context": format_context(docs), "docs": docs}
