import asyncio
import json
import re
import tempfile
import os
import zipfile
import io
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse

# Shared thread pool for CPU-bound extraction work (pdfplumber + regex).
# 8 workers → up to 8 PDFs extracted simultaneously.
_EXTRACT_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="extract")

from app.core.extractor import extract_judgment
from app.schemas import (
    ExtractionResult, BatchResult, BatchFileResult,
    CorrectionRequest, ResultSummary,
)

router = APIRouter(prefix="/extract", tags=["extract"])

RESULTS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def _file_id(filename: str) -> str:
    stem = Path(filename).stem
    return re.sub(r"[^a-zA-Z0-9_-]", "_", stem)[:80]


def _save_result(file_id: str, result: dict) -> None:
    path = RESULTS_DIR / f"{file_id}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


def _load_result(file_id: str) -> dict:
    path = RESULTS_DIR / f"{file_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Result not found.")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ── Upload endpoints ──────────────────────────────────────────────────────────

@router.post("/", response_model=ExtractionResult)
async def extract_single(file: UploadFile = File(...)):
    """Upload a single PDF judgment and receive extracted paragraphs."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        result = extract_judgment(tmp_path)
        result["source_file"] = file.filename
        fid = _file_id(file.filename)
        _save_result(fid, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")
    finally:
        os.unlink(tmp_path)


@router.post("/batch", response_model=BatchResult)
async def extract_batch(files: list[UploadFile] = File(...)):
    """Upload multiple PDF judgments. Files are extracted in parallel."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    loop = asyncio.get_event_loop()

    async def _process_one(upload: UploadFile) -> BatchFileResult:
        if not upload.filename or not upload.filename.lower().endswith(".pdf"):
            return BatchFileResult(input=upload.filename or "unknown", error="Not a PDF file.")

        contents = await upload.read()
        filename = upload.filename  # capture before thread boundary

        def _run_in_thread() -> BatchFileResult:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(contents)
                tmp_path = tmp.name
            try:
                result = extract_judgment(tmp_path)
                result["source_file"] = filename
                fid = _file_id(filename)
                _save_result(fid, result)
                return BatchFileResult(
                    input=filename,
                    output=f"{fid}.json",
                    paragraphs=result["stats"]["total_paragraphs"],
                    roles=result["stats"]["role_distribution"],
                )
            except Exception as e:
                return BatchFileResult(input=filename, error=str(e))
            finally:
                os.unlink(tmp_path)

        return await loop.run_in_executor(_EXTRACT_EXECUTOR, _run_in_thread)

    file_results = list(await asyncio.gather(*[_process_one(f) for f in files]))
    processed = sum(1 for r in file_results if r.error is None)
    failed = len(file_results) - processed

    return BatchResult(processed=processed, failed=failed, files=file_results)


# ── Results endpoints ─────────────────────────────────────────────────────────

@router.get("/results", response_model=list[ResultSummary])
def list_results():
    """List all previously extracted judgments."""
    summaries = []
    for path in sorted(RESULTS_DIR.glob("*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            changes = []
            comment_count = 0
            old_dist: dict[str, int] = {}
            for i, p in enumerate(data.get("paragraphs", [])):
                if p.get("old_rhetorical_role"):
                    changes.append({
                        "index": i,
                        "paragraph": p["number"],
                        "old_role": p["old_rhetorical_role"],
                        "new_role": p["rhetorical_role"],
                        "comment": p.get("comment"),
                    })
                if p.get("comment"):
                    comment_count += 1
            # Build old role distribution: start from current, undo changes
            if changes:
                from collections import Counter
                old_dist = Counter(
                    p.get("old_rhetorical_role", p["rhetorical_role"])
                    for p in data.get("paragraphs", [])
                )
                old_dist = dict(old_dist)
            summaries.append(ResultSummary(
                file_id=path.stem,
                source_file=data.get("source_file", path.stem),
                total_paragraphs=data["stats"]["total_paragraphs"],
                role_distribution=data["stats"]["role_distribution"],
                old_role_distribution=old_dist,
                changes=changes,
                comment_count=comment_count,
                annotated=data.get("annotated", False),
            ))
        except Exception:
            continue
    return summaries


@router.get("/results/{file_id}", response_model=ExtractionResult)
def get_result(file_id: str):
    """Get a specific extraction result by file ID."""
    return _load_result(file_id)


@router.delete("/results/{file_id}")
def delete_result(file_id: str):
    """Delete a single extraction result."""
    path = RESULTS_DIR / f"{file_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Result not found.")
    path.unlink()
    return {"status": "deleted", "file_id": file_id}


@router.post("/results/delete-batch")
def delete_results_batch(file_ids: list[str]):
    """Delete multiple extraction results."""
    deleted, not_found = [], []
    for fid in file_ids:
        path = RESULTS_DIR / f"{fid}.json"
        if path.exists():
            path.unlink()
            deleted.append(fid)
        else:
            not_found.append(fid)
    return {"deleted": deleted, "not_found": not_found}


@router.post("/corrections/{file_id}")
def save_corrections(file_id: str, body: CorrectionRequest):
    """Save corrected rhetorical role labels and comments for a judgment."""
    result = _load_result(file_id)
    correction_map = {c.index: c for c in body.corrections}
    for i, para in enumerate(result["paragraphs"]):
        corr = correction_map.get(i)
        if corr:
            new_role = corr.rhetorical_role
            # Preserve the auto-extracted role the very first time it is changed.
            # Once set, original_rhetorical_role is never overwritten again.
            if new_role != para["rhetorical_role"] and "old_rhetorical_role" not in para:
                para["old_rhetorical_role"] = para["rhetorical_role"]
            para["rhetorical_role"] = new_role
            # Store comment; remove key entirely if empty so JSON stays clean
            if corr.comment:
                para["comment"] = corr.comment
            else:
                para.pop("comment", None)
    # Mark as annotated
    result["annotated"] = True
    # Recompute role distribution
    from collections import Counter
    dist = Counter(p["rhetorical_role"] for p in result["paragraphs"])
    result["stats"]["role_distribution"] = dict(dist)
    _save_result(file_id, result)
    return {"status": "saved", "file_id": file_id}


# ── Upload corrected JSON ─────────────────────────────────────────────────────

@router.put("/results/{file_id}")
async def upload_corrected_json(file_id: str, file: UploadFile = File(...)):
    """Replace an extraction result with a manually corrected JSON file."""
    if not file.filename or not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Only JSON files are accepted.")

    contents = await file.read()
    try:
        data = json.loads(contents)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    # Basic structure validation
    for required in ("paragraphs", "stats", "metadata"):
        if required not in data:
            raise HTTPException(status_code=400, detail=f"Missing required field: '{required}'")

    # Recompute role_distribution from paragraphs to keep stats consistent
    from collections import Counter
    dist = Counter(p.get("rhetorical_role", "unknown") for p in data["paragraphs"])
    data["stats"]["role_distribution"] = dict(dist)
    data["stats"]["total_paragraphs"] = len(data["paragraphs"])

    if "source_file" not in data:
        data["source_file"] = file.filename

    _save_result(file_id, data)
    return {"status": "replaced", "file_id": file_id, "paragraphs": data["stats"]["total_paragraphs"]}


# ── Download endpoints ────────────────────────────────────────────────────────

@router.get("/download/{file_id}")
def download_single(file_id: str):
    """Download a single extraction result as JSON."""
    result = _load_result(file_id)
    content = json.dumps(result, ensure_ascii=False, indent=2)
    return StreamingResponse(
        iter([content.encode("utf-8")]),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{file_id}.json"'},
    )


@router.get("/download-zip")
def download_zip():
    """Download all extraction results as a ZIP archive."""
    json_files = list(RESULTS_DIR.glob("*.json"))
    if not json_files:
        raise HTTPException(status_code=404, detail="No results found.")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in json_files:
            zf.write(path, path.name)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="judgments.zip"'},
    )
