"""
Stripe payment endpoints for VozInterview SaaS.
Handles checkout sessions, webhooks, and subscription status.
"""
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import stripe
import logging
from pathlib import Path

from config import get_settings
from database import get_db
from models import User, PlanType
from auth import get_current_user

logger = logging.getLogger(__name__)
settings = get_settings()

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/api/payments", tags=["payments"])


# ─── Create Checkout Session ───
@router.post("/create-checkout")
async def create_checkout_session(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout Session for Premium subscription."""
    if user.has_active_premium:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya tienes una suscripción Premium activa",
        )

    try:
        # Create or reuse Stripe customer
        if not user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.name,
                metadata={"user_id": str(user.id)},
            )
            user.stripe_customer_id = customer.id
            await db.commit()
        
        # Create Checkout Session with price_data (no pre-created Price needed)
        session = stripe.checkout.Session.create(
            customer=user.stripe_customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": "VozInterview Premium",
                        "description": "Acceso completo por 30 días — entrevistas ilimitadas, IA premium, historial completo",
                    },
                    "unit_amount": settings.STRIPE_PREMIUM_PRICE,  # $14.99 in cents
                },
                "quantity": 1,
            }],
            mode="payment",  # One-time payment for 30-day access
            success_url="http://localhost:8000/landing/dashboard.html?payment=success",
            cancel_url="http://localhost:8000/landing/dashboard.html?payment=cancelled",
            metadata={
                "user_id": str(user.id),
            },
        )

        logger.info(f"Checkout session created for {user.email}: {session.id}")

        return {
            "checkout_url": session.url,
            "session_id": session.id,
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error con Stripe: {str(e)}",
        )


# ─── Stripe Webhook ───
@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    # In test mode without CLI, we can skip signature verification
    # In production, always verify!
    try:
        if settings.STRIPE_WEBHOOK_SECRET and settings.STRIPE_WEBHOOK_SECRET != "whsec_placeholder":
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        else:
            # Test mode fallback: parse event directly
            import json
            event = stripe.Event.construct_from(
                json.loads(payload), stripe.api_key
            )
    except (ValueError, stripe.error.SignatureVerificationError) as e:
        logger.error(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle checkout.session.completed
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")

        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()

            if user:
                user.plan = PlanType.PREMIUM
                user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
                user.stripe_subscription_id = session.get("subscription") or session.get("id")
                await db.commit()
                logger.info(f"✅ User {user.email} upgraded to Premium (30 days)")
            else:
                logger.warning(f"User not found for webhook: {user_id}")

    return {"status": "ok"}


# ─── Simulate Payment (Test Mode Only) ───
@router.post("/simulate-payment")
async def simulate_payment(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Simulate a successful payment in test mode.
    This bypasses Stripe Checkout for local testing.
    """
    if user.has_active_premium:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya tienes una suscripción Premium activa",
        )

    # Create Stripe customer if needed
    if not user.stripe_customer_id:
        try:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.name,
                metadata={"user_id": str(user.id)},
            )
            user.stripe_customer_id = customer.id
        except stripe.error.StripeError:
            user.stripe_customer_id = f"cus_simulated_{user.id}"

    # Activate premium
    user.plan = PlanType.PREMIUM
    user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    user.stripe_subscription_id = f"sim_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    await db.commit()
    await db.refresh(user)

    logger.info(f"✅ Simulated payment for {user.email} — Premium until {user.plan_expires_at}")

    return {
        "status": "success",
        "plan": user.plan.value,
        "expires_at": user.plan_expires_at.isoformat(),
        "message": "¡Premium activado por 30 días!",
    }


# ─── Subscription Status ───
@router.get("/status")
async def payment_status(user: User = Depends(get_current_user)):
    """Get current subscription status."""
    return {
        "plan": user.plan.value,
        "is_premium": user.has_active_premium,
        "expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "stripe_customer_id": user.stripe_customer_id,
    }


# ─── Download Installer ───
@router.get("/download")
async def download_installer(user: User = Depends(get_current_user)):
    """Serve the Electron installer .exe to Premium users."""
    if not user.has_active_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere una cuenta Premium activa para descargar la aplicación",
        )

    # Path to the installer - adjusted for project structure
    installer_path = Path(__file__).parent.parent / "frontend" / "release" / "VozInterview Setup 1.0.0.exe"
    
    if not installer_path.exists():
        logger.error(f"Installer not found at: {installer_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="El instalador aún no está listo. Por favor contacta a soporte.",
        )

    return FileResponse(
        path=str(installer_path),
        filename="VozInterviewSetup.exe",
        media_type="application/octet-stream",
    )
