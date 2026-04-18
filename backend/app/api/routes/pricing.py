from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.application.pricing import evaluate_pricing
from app.application.registry import serialize_instance, serialize_value
from app.core.dependencies import get_current_user, user_has_permission
from app.domain.models import (
    Customer,
    PriceCalculationSnapshot,
    ProjectSite,
    Quotation,
    QuotationItem,
    User,
)
from app.infrastructure.db import get_db

router = APIRouter(prefix="/api/v1/pricing", tags=["pricing"])


class PricingPreviewRequest(BaseModel):
    organization_id: str
    price_book_id: str | None = None
    customer_id: str | None = None
    site_id: str | None = None
    plant_id: str | None = None
    region_code: str | None = None
    concrete_product_id: str | None = None
    quoted_volume_m3: float = 1
    distance_km: float = 0
    difficulty_level: str | None = None
    requires_pump: bool = False
    surcharge_amount: float = 0
    discount_amount: float = 0
    pricing_at: datetime | None = None


class QuotationConfirmRequest(BaseModel):
    price_book_id: str | None = None
    plant_id: str | None = None
    region_code: str | None = None
    surcharge_amount: float = 0
    discount_amount: float = 0
    final_status: str = Field(default="confirmed")


class QuotationApprovalRequest(BaseModel):
    action: Literal["approved", "rejected"]
    note: str | None = None
    discount_override_pct: float | None = None
    discount_override_amount: float | None = None



def _ensure_permission_for_preview(db: Session, user: User) -> None:
    if user_has_permission(db, user.id, "price_rules", "read"):
        return
    if user_has_permission(db, user.id, "quotations", "write"):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing pricing permission")



def _ensure_quotation_permission(db: Session, user: User, action: str) -> None:
    if not user_has_permission(db, user.id, "quotations", action):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing quotation permission")


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return serialize_value(value)


@router.post("/preview")
def pricing_preview(
    payload: PricingPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_permission_for_preview(db, current_user)

    try:
        return evaluate_pricing(
            db=db,
            organization_id=payload.organization_id,
            pricing_context=payload.model_dump(),
            preferred_price_book_id=payload.price_book_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/quotations/{quotation_id}/confirm")
def confirm_quotation_pricing(
    quotation_id: str,
    payload: QuotationConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_quotation_permission(db, current_user, "write")

    quotation = db.get(Quotation, quotation_id)
    if not quotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    items = (
        db.execute(select(QuotationItem).where(QuotationItem.quotation_id == quotation_id))
        .scalars()
        .all()
    )
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quotation has no items")

    total_amount = 0.0
    priced_items: list[dict[str, Any]] = []

    for item in items:
        context = {
            "organization_id": quotation.organization_id,
            "customer_id": quotation.customer_id,
            "site_id": quotation.site_id,
            "plant_id": payload.plant_id,
            "region_code": payload.region_code,
            "concrete_product_id": item.concrete_product_id,
            "quoted_volume_m3": item.quoted_volume_m3 or 0,
            "distance_km": item.distance_km or 0,
            "difficulty_level": item.difficulty_level,
            "requires_pump": item.requires_pump,
            "surcharge_amount": payload.surcharge_amount,
            "discount_amount": payload.discount_amount,
            "pricing_at": datetime.now(tz=timezone.utc),
        }

        pricing_result = evaluate_pricing(
            db=db,
            organization_id=quotation.organization_id,
            pricing_context=context,
            preferred_price_book_id=payload.price_book_id or quotation.price_book_id,
        )

        snapshot = PriceCalculationSnapshot(
            organization_id=quotation.organization_id,
            source_type="quotation_item",
            source_id=item.id,
            price_book_id=pricing_result["price_book"]["id"],
            input_snapshot_json=_json_safe(context),
            result_snapshot_json=_json_safe(pricing_result),
            final_unit_price=pricing_result["final_unit_price"],
            calculated_by=current_user.id,
        )
        db.add(snapshot)
        db.flush()

        components = pricing_result["components"]
        item.base_price = components["base_price"]
        item.distance_fee = components["distance_fee"]
        item.difficulty_fee = components["difficulty_fee"]
        item.pump_fee = components["pump_fee"]
        item.surcharge_fee = components["surcharge_fee"]
        item.discount_fee = components["discount_fee"]
        item.final_unit_price = pricing_result["final_unit_price"]
        item.total_amount = pricing_result["total_amount"]
        item.pricing_snapshot_json = _json_safe({
            "snapshot_id": snapshot.id,
            "price_book": pricing_result["price_book"],
            "applied_rules": pricing_result["applied_rules"],
            "components": components,
            "final_unit_price": pricing_result["final_unit_price"],
            "total_amount": pricing_result["total_amount"],
        })

        db.add(item)
        total_amount += float(pricing_result["total_amount"])
        priced_items.append(serialize_instance(item))

        quotation.price_book_id = pricing_result["price_book"]["id"]

    quotation.status = payload.final_status
    db.add(quotation)
    db.commit()
    db.refresh(quotation)

    return {
        "quotation": serialize_instance(quotation),
        "items": priced_items,
        "total_amount": round(total_amount, 2),
    }


@router.post("/quotations/{quotation_id}/approval")
def set_quotation_approval(
    quotation_id: str,
    payload: QuotationApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    _ensure_quotation_permission(db, current_user, "write")

    quotation = db.get(Quotation, quotation_id)
    if not quotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    quotation.approval_status = payload.action
    quotation.approved_by = current_user.id
    quotation.approved_at = datetime.now(tz=timezone.utc)
    quotation.approval_note = payload.note

    if payload.discount_override_pct is not None:
        quotation.discount_override_pct = payload.discount_override_pct
    if payload.discount_override_amount is not None:
        quotation.discount_override_amount = payload.discount_override_amount

    if payload.action == "approved" and quotation.status == "draft":
        quotation.status = "approved"
    if payload.action == "rejected":
        quotation.status = "rejected"

    db.add(quotation)
    db.commit()
    db.refresh(quotation)
    return serialize_instance(quotation)


@router.get("/quotations/{quotation_id}/pdf")
def export_quotation_pdf(
    quotation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    _ensure_quotation_permission(db, current_user, "read")

    quotation = db.get(Quotation, quotation_id)
    if not quotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")

    customer = db.get(Customer, quotation.customer_id)
    site = db.get(ProjectSite, quotation.site_id) if quotation.site_id else None
    items = (
        db.execute(select(QuotationItem).where(QuotationItem.quotation_id == quotation_id))
        .scalars()
        .all()
    )

    rows = "".join(
        f"<tr><td>{idx + 1}</td><td>{item.concrete_product_id}</td><td>{item.quoted_volume_m3 or 0}</td><td>{item.final_unit_price or 0}</td><td>{item.total_amount or 0}</td></tr>"
        for idx, item in enumerate(items)
    )

    total_amount = sum(float(item.total_amount or 0) for item in items)
    html = f"""
    <html>
      <head>
        <style>
          body {{ font-family: DejaVu Sans, Arial, sans-serif; font-size: 12px; }}
          h1 {{ font-size: 20px; margin-bottom: 8px; }}
          table {{ border-collapse: collapse; width: 100%; margin-top: 12px; }}
          th, td {{ border: 1px solid #ddd; padding: 6px; text-align: left; }}
          .meta {{ margin: 4px 0; }}
          .total {{ margin-top: 12px; font-weight: bold; }}
        </style>
      </head>
      <body>
        <h1>Quotation {quotation.quotation_no}</h1>
        <div class="meta">Customer: {customer.name if customer else quotation.customer_id}</div>
        <div class="meta">Site: {site.site_name if site else (quotation.site_id or '-')}</div>
        <div class="meta">Status: {quotation.status}</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Volume (m3)</th>
              <th>Final Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows}
          </tbody>
        </table>
        <div class="total">Total Amount: {round(total_amount, 2)}</div>
      </body>
    </html>
    """

    try:
        from weasyprint import HTML

        pdf_bytes = HTML(string=html).write_pdf()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {exc}",
        ) from exc

    filename = f"quotation-{quotation.quotation_no}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
