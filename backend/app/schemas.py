from pydantic import BaseModel
from typing import Any


class Paragraph(BaseModel):
    number: int
    label: str
    text: str
    rhetorical_role: str
    old_rhetorical_role: str | None = None
    comment: str | None = None


class Metadata(BaseModel):
    raw_header: str
    court: str | None = None
    jurisdiction: str | None = None
    case_numbers: list[str] | None = None
    parties: list[dict[str, str]] | None = None
    coram: list[str] | None = None
    reportable: bool | None = None
    judgment_marker: str | None = None


class Stats(BaseModel):
    total_paragraphs: int
    role_distribution: dict[str, int]


class ExtractionResult(BaseModel):
    source_file: str
    metadata: Metadata
    paragraphs: list[Paragraph]
    stats: Stats
    annotated: bool = False


class BatchFileResult(BaseModel):
    input: str
    output: str | None = None
    paragraphs: int | None = None
    roles: dict[str, int] | None = None
    error: str | None = None


class BatchResult(BaseModel):
    processed: int
    failed: int
    files: list[BatchFileResult]


class CorrectionItem(BaseModel):
    index: int
    number: int
    rhetorical_role: str
    comment: str | None = None


class CorrectionRequest(BaseModel):
    corrections: list[CorrectionItem]


class ChangeSummary(BaseModel):
    index: int
    paragraph: int
    old_role: str
    new_role: str
    comment: str | None = None


class ResultSummary(BaseModel):
    file_id: str
    source_file: str
    total_paragraphs: int
    role_distribution: dict[str, int]
    old_role_distribution: dict[str, int] = {}
    changes: list[ChangeSummary] = []
    comment_count: int = 0
    annotated: bool = False
