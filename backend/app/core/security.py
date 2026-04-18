"""Security skeleton for upcoming JWT auth in Phase 1."""

from dataclasses import dataclass


@dataclass(frozen=True)
class AuthTokenPayload:
    sub: str
    role: str
