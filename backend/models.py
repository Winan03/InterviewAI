"""
Database models for VozInterview.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from database import Base
import enum


class PlanType(str, enum.Enum):
    FREE = "free"
    PREMIUM = "premium"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    plan = Column(
        SAEnum(PlanType, values_callable=lambda e: [m.value for m in e], create_type=False),
        default=PlanType.FREE,
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)

    # Stripe fields
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    plan_expires_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @property
    def has_active_premium(self) -> bool:
        """Check if user has an active premium subscription."""
        if self.plan != PlanType.PREMIUM:
            return False
        if self.plan_expires_at is None:
            return False
        return self.plan_expires_at > datetime.now(timezone.utc)

    def __repr__(self):
        return f"<User {self.email}>"
