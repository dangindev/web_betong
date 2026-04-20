from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import inspect

from app.domain.models import (
    Asset,
    Attachment,
    AuditLog,
    BusinessUnit,
    CostCenter,
    CostObject,
    CostPeriod,
    CostPool,
    ConcreteProduct,
    Customer,
    CustomerContact,
    Employee,
    Material,
    ManualOverride,
    MixDesign,
    MixDesignComponent,
    Organization,
    Permission,
    Plant,
    PlantCapacitySlot,
    PlantLoadingBay,
    PourRequest,
    PourRequestTimeWindow,
    PumpAvailability,
    PumpEvent,
    PumpSession,
    PriceBook,
    PriceCalculationSnapshot,
    PriceRule,
    ProjectSite,
    Pump,
    ReconciliationRecord,
    ResourceLock,
    Quotation,
    QuotationItem,
    Role,
    RolePermission,
    SalesOrder,
    ScheduleConflict,
    ScheduleRun,
    ScheduleVersion,
    ScheduledTrip,
    SiteAccessProfile,
    SystemSetting,
    TravelEstimate,
    Trip,
    TripEvent,
    User,
    UserRole,
    UserSession,
    Vehicle,
    Warehouse,
    VehicleAvailability,
    VehicleType,
    BatchTicket,
    BatchTicketComponent,
    DailyKpiSnapshot,
    MarginSnapshot,
    DispatchOrder,
    EventIngestion,
    AllocationResult,
    AllocationRule,
    AllocationRun,
    InventoryLedgerEntry,
    ProductionLog,
    InventoryStockTake,
    GpsPing,
    Notification,
    OfflineSyncQueue,
    OperationalShift,
    UnitCostSnapshot,
)

MODEL_REGISTRY = {
    "organizations": Organization,
    "business_units": BusinessUnit,
    "employees": Employee,
    "users": User,
    "roles": Role,
    "permissions": Permission,
    "role_permissions": RolePermission,
    "user_roles": UserRole,
    "user_sessions": UserSession,
    "customers": Customer,
    "customer_contacts": CustomerContact,
    "site_access_profiles": SiteAccessProfile,
    "project_sites": ProjectSite,
    "plants": Plant,
    "plant_loading_bays": PlantLoadingBay,
    "vehicle_types": VehicleType,
    "vehicles": Vehicle,
    "pumps": Pump,
    "assets": Asset,
    "materials": Material,
    "warehouses": Warehouse,
    "concrete_products": ConcreteProduct,
    "mix_designs": MixDesign,
    "mix_design_components": MixDesignComponent,
    "cost_centers": CostCenter,
    "cost_objects": CostObject,
    "cost_periods": CostPeriod,
    "production_logs": ProductionLog,
    "cost_pools": CostPool,
    "allocation_rules": AllocationRule,
    "allocation_runs": AllocationRun,
    "allocation_results": AllocationResult,
    "unit_cost_snapshots": UnitCostSnapshot,
    "margin_snapshots": MarginSnapshot,
    "price_books": PriceBook,
    "price_rules": PriceRule,
    "quotations": Quotation,
    "quotation_items": QuotationItem,
    "sales_orders": SalesOrder,
    "pour_requests": PourRequest,
    "pour_request_time_windows": PourRequestTimeWindow,
    "price_calculation_snapshots": PriceCalculationSnapshot,
    "operational_shifts": OperationalShift,
    "vehicle_availabilities": VehicleAvailability,
    "pump_availabilities": PumpAvailability,
    "resource_locks": ResourceLock,
    "plant_capacity_slots": PlantCapacitySlot,
    "travel_estimates": TravelEstimate,
    "schedule_runs": ScheduleRun,
    "dispatch_orders": DispatchOrder,
    "scheduled_trips": ScheduledTrip,
    "schedule_conflicts": ScheduleConflict,
    "schedule_versions": ScheduleVersion,
    "manual_overrides": ManualOverride,
    "trips": Trip,
    "trip_events": TripEvent,
    "pump_sessions": PumpSession,
    "pump_events": PumpEvent,
    "batch_tickets": BatchTicket,
    "batch_ticket_components": BatchTicketComponent,
    "gps_pings": GpsPing,
    "notifications": Notification,
    "offline_sync_queue": OfflineSyncQueue,
    "event_ingestions": EventIngestion,
    "reconciliation_records": ReconciliationRecord,
    "daily_kpi_snapshots": DailyKpiSnapshot,
    "inventory_ledger_entries": InventoryLedgerEntry,
    "inventory_stock_takes": InventoryStockTake,
    "system_settings": SystemSetting,
    "audit_logs": AuditLog,
    "attachments": Attachment,
}

IMPORT_EXPORT_RESOURCES = {
    "customers",
    "project_sites",
    "vehicles",
    "materials",
    "price_rules",
    "pour_requests",
}


def allowed_columns(model: type) -> set[str]:
    mapper = inspect(model)
    return {column.key for column in mapper.columns}


def serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value


def serialize_instance(instance: Any) -> dict[str, Any]:
    mapper = inspect(instance.__class__)
    payload: dict[str, Any] = {}
    for column in mapper.columns:
        payload[column.key] = serialize_value(getattr(instance, column.key))
    return payload
