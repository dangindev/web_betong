from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.models import PriceBook, PriceRule

RULE_COMPONENT_KEY = {
    "BasePrice": "base_price",
    "DistanceFee": "distance_fee",
    "DifficultyFee": "difficulty_fee",
    "PumpFee": "pump_fee",
    "Surcharge": "surcharge_fee",
    "Discount": "discount_fee",
}


@dataclass
class PricingResolution:
    price_book: PriceBook
    rules: list[PriceRule]


def _to_decimal(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        return Decimal("0")
    if isinstance(value, bool):
        return Decimal("1") if value else Decimal("0")
    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001
        return Decimal("0")


def _to_number(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01")))


def _matches_operator(actual: Any, operator: str, expected: Any) -> bool:
    if operator == "eq":
        return str(actual) == str(expected)
    if operator == "neq":
        return str(actual) != str(expected)
    if operator == "gt":
        return _to_decimal(actual) > _to_decimal(expected)
    if operator == "gte":
        return _to_decimal(actual) >= _to_decimal(expected)
    if operator == "lt":
        return _to_decimal(actual) < _to_decimal(expected)
    if operator == "lte":
        return _to_decimal(actual) <= _to_decimal(expected)
    if operator == "in":
        if isinstance(expected, list):
            return str(actual) in {str(item) for item in expected}
        return False
    if operator == "contains":
        return str(expected).lower() in str(actual).lower()
    if operator == "truthy":
        return bool(actual)
    return False


def evaluate_condition(condition_json: Any, context: dict[str, Any]) -> bool:
    if condition_json in (None, {}, []):
        return True

    if isinstance(condition_json, list):
        return all(evaluate_condition(item, context) for item in condition_json)

    if not isinstance(condition_json, dict):
        return False

    if "all" in condition_json:
        all_conditions = condition_json.get("all")
        return all(evaluate_condition(item, context) for item in all_conditions if isinstance(all_conditions, list))

    if "any" in condition_json:
        any_conditions = condition_json.get("any")
        if not isinstance(any_conditions, list) or not any_conditions:
            return False
        return any(evaluate_condition(item, context) for item in any_conditions)

    if "not" in condition_json:
        return not evaluate_condition(condition_json.get("not"), context)

    field = str(condition_json.get("field", "")).strip()
    operator = str(condition_json.get("op", "eq")).strip()
    expected = condition_json.get("value")
    actual = context.get(field)
    return _matches_operator(actual, operator, expected)


def _formula_value(
    rule_type: str,
    formula_json: dict[str, Any] | None,
    context: dict[str, Any],
    components: dict[str, Decimal],
) -> Decimal:
    formula = formula_json if isinstance(formula_json, dict) else {}
    mode = str(formula.get("mode") or formula.get("kind") or "fixed")

    if rule_type == "BasePrice" and "value" not in formula:
        return _to_decimal(context.get("base_price", 0))

    if mode in {"fixed", "value"}:
        return _to_decimal(formula.get("value", 0))

    if mode in {"multiply", "per_unit", "per_km"}:
        field = str(formula.get("field", "distance_km"))
        rate = _to_decimal(formula.get("rate", formula.get("value", 0)))
        return _to_decimal(context.get(field, 0)) * rate

    if mode == "percentage":
        base_field = str(formula.get("base_field", "base_price"))
        base_value = _to_decimal(components.get(base_field, context.get(base_field, 0)))
        percent = _to_decimal(formula.get("value", 0))
        return (base_value * percent) / Decimal("100")

    if mode in {"mapping", "difficulty_map"}:
        field = str(formula.get("field", "difficulty_level"))
        mapping = formula.get("mapping", {})
        if isinstance(mapping, dict):
            selected = mapping.get(str(context.get(field)), formula.get("default", 0))
            return _to_decimal(selected)
        return Decimal("0")

    if mode == "boolean":
        field = str(formula.get("field", "requires_pump"))
        true_value = _to_decimal(formula.get("true_value", 0))
        false_value = _to_decimal(formula.get("false_value", 0))
        return true_value if bool(context.get(field)) else false_value

    if mode == "passthrough":
        field = str(formula.get("field", "surcharge_amount"))
        return _to_decimal(context.get(field, 0))

    return _to_decimal(formula.get("value", 0))


def _rule_scope_matches(rule: PriceRule, context: dict[str, Any]) -> bool:
    if rule.scope_customer_id and str(context.get("customer_id")) != str(rule.scope_customer_id):
        return False
    if rule.scope_region and str(context.get("region_code")) != str(rule.scope_region):
        return False
    if rule.scope_plant_id and str(context.get("plant_id")) != str(rule.scope_plant_id):
        return False
    return True


def _book_effective(book: PriceBook, pricing_at: datetime) -> bool:
    if book.effective_from and pricing_at < book.effective_from:
        return False
    if book.effective_to and pricing_at > book.effective_to:
        return False
    return True


def resolve_price_book(
    db: Session,
    organization_id: str,
    pricing_context: dict[str, Any],
    preferred_price_book_id: str | None = None,
) -> PriceBook:
    pricing_at = pricing_context.get("pricing_at")
    if not isinstance(pricing_at, datetime):
        pricing_at = datetime.now(tz=timezone.utc)

    if preferred_price_book_id:
        preferred = db.get(PriceBook, preferred_price_book_id)
        if not preferred:
            raise ValueError("price_book_id not found")
        if preferred.organization_id != organization_id:
            raise ValueError("price_book organization mismatch")
        if preferred.status not in {"active", "published"}:
            raise ValueError("price_book is not active")
        if not _book_effective(preferred, pricing_at):
            raise ValueError("price_book outside effective period")
        return preferred

    candidates = db.execute(
        select(PriceBook)
        .where(PriceBook.organization_id == organization_id)
        .where(PriceBook.status.in_(["active", "published"]))
    ).scalars().all()

    if not candidates:
        raise ValueError("No active price books")

    customer_id = pricing_context.get("customer_id")
    region_code = pricing_context.get("region_code")

    best_score: int | None = None
    best_book: PriceBook | None = None

    for candidate in candidates:
        if not _book_effective(candidate, pricing_at):
            continue

        score = int(candidate.priority or 0)

        if candidate.customer_scope:
            if str(customer_id) != str(candidate.customer_scope):
                continue
            score += 100

        if candidate.region_scope:
            if str(region_code) != str(candidate.region_scope):
                continue
            score += 10

        if best_book is None or (best_score is not None and score > best_score):
            best_book = candidate
            best_score = score

    if best_book is None:
        raise ValueError("No matching price book for current scope")

    return best_book


def resolve_price_rules(db: Session, price_book_id: str) -> list[PriceRule]:
    return (
        db.execute(
            select(PriceRule)
            .where(PriceRule.price_book_id == price_book_id)
            .where(PriceRule.is_active.is_(True))
            .order_by(PriceRule.priority.desc(), PriceRule.created_at.asc())
        )
        .scalars()
        .all()
    )


def evaluate_pricing(
    db: Session,
    organization_id: str,
    pricing_context: dict[str, Any],
    preferred_price_book_id: str | None = None,
) -> dict[str, Any]:
    context = dict(pricing_context)

    price_book = resolve_price_book(
        db=db,
        organization_id=organization_id,
        pricing_context=context,
        preferred_price_book_id=preferred_price_book_id,
    )
    rules = resolve_price_rules(db, price_book.id)

    components: dict[str, Decimal] = {
        "base_price": Decimal("0"),
        "distance_fee": Decimal("0"),
        "difficulty_fee": Decimal("0"),
        "pump_fee": Decimal("0"),
        "surcharge_fee": Decimal("0"),
        "discount_fee": Decimal("0"),
    }

    applied_rules: list[dict[str, Any]] = []
    applied_rule_types: set[str] = set()

    for rule in rules:
        if not _rule_scope_matches(rule, context):
            continue
        if not evaluate_condition(rule.condition_json, context):
            continue

        amount = _formula_value(rule.rule_type, rule.formula_json, context, components)
        component_key = RULE_COMPONENT_KEY.get(rule.rule_type)
        if not component_key:
            continue

        if rule.rule_type == "BasePrice":
            if components[component_key] == Decimal("0"):
                components[component_key] = amount
        else:
            components[component_key] += amount

        applied_rule_types.add(rule.rule_type)
        applied_rules.append(
            {
                "rule_id": rule.id,
                "rule_name": rule.rule_name,
                "rule_type": rule.rule_type,
                "amount": _to_number(amount),
                "priority": rule.priority,
            }
        )

    if "Surcharge" not in applied_rule_types:
        components["surcharge_fee"] += _to_decimal(context.get("surcharge_amount", 0))
    if "Discount" not in applied_rule_types:
        components["discount_fee"] += _to_decimal(context.get("discount_amount", 0))

    final_unit_price = (
        components["base_price"]
        + components["distance_fee"]
        + components["difficulty_fee"]
        + components["pump_fee"]
        + components["surcharge_fee"]
        - components["discount_fee"]
    )
    if final_unit_price < Decimal("0"):
        final_unit_price = Decimal("0")

    quoted_volume_m3 = _to_decimal(context.get("quoted_volume_m3", 1))
    if quoted_volume_m3 < Decimal("0"):
        quoted_volume_m3 = Decimal("0")

    total_amount = final_unit_price * quoted_volume_m3

    return {
        "price_book": {
            "id": price_book.id,
            "code": price_book.code,
            "name": price_book.name,
            "priority": price_book.priority,
        },
        "components": {
            key: _to_number(value)
            for key, value in components.items()
        },
        "final_unit_price": _to_number(final_unit_price),
        "quoted_volume_m3": _to_number(quoted_volume_m3),
        "total_amount": _to_number(total_amount),
        "applied_rules": applied_rules,
    }
