from sentry_sdk import init as sentry_init

from app.core.config import settings


def initialize_sentry() -> None:
    if not settings.sentry_dsn:
        return

    sentry_init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=0.1,
    )
