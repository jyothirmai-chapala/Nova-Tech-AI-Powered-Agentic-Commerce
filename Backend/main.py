from dotenv import load_dotenv
import os
import json
import re
from datetime import datetime, timezone

import razorpay

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from products import products


# ==================================================
# ENVIRONMENT VARIABLES
# ==================================================

load_dotenv()

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")


# ==================================================
# CHECK RAZORPAY CONFIGURATION
# ==================================================

if not RAZORPAY_KEY_ID:
    raise ValueError(
        "RAZORPAY_KEY_ID is missing from .env"
    )

if not RAZORPAY_KEY_SECRET:
    raise ValueError(
        "RAZORPAY_KEY_SECRET is missing from .env"
    )


# ==================================================
# FILE PATHS
# ==================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

AUDIT_FILE = os.path.join(
    BASE_DIR,
    "audit_log.json"
)


# ==================================================
# CREATE AUDIT FILE IF IT DOES NOT EXIST
# ==================================================

if not os.path.exists(AUDIT_FILE):

    with open(
        AUDIT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            [],
            file,
            indent=4
        )


# ==================================================
# RAZORPAY CLIENT
# ==================================================

razorpay_client = razorpay.Client(
    auth=(
        RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET
    )
)


# ==================================================
# FASTAPI APP
# ==================================================

app = FastAPI(
    title="Nova Intelligence API",
    description=(
        "AI-powered merchant commerce backend "
        "with Razorpay, audit trail and revenue metrics"
    ),
    version="1.0.0",
)


# ==================================================
# CORS
# ==================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================================
# REQUEST MODELS
# ==================================================

class ChatRequest(BaseModel):
    message: str


class OrderRequest(BaseModel):
    amount: int


class PaymentVerificationRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ==================================================
# NEW: PAYMENT FAILED REQUEST
# ==================================================

class PaymentFailedRequest(BaseModel):
    razorpay_order_id: str | None = None
    razorpay_payment_id: str | None = None
    amount: float | None = None
    error_code: str | None = None
    error_description: str | None = None
    error_source: str | None = None
    error_step: str | None = None
    error_reason: str | None = None


# ==================================================
# AUDIT TRAIL HELPERS
# ==================================================

def get_current_timestamp():
    """
    Return current UTC timestamp.
    """

    return datetime.now(
        timezone.utc
    ).isoformat()


def read_audit_log():
    """
    Read all audit records from audit_log.json.
    """

    try:

        with open(
            AUDIT_FILE,
            "r",
            encoding="utf-8"
        ) as file:

            data = json.load(file)

            if isinstance(data, list):
                return data

            return []

    except (
        FileNotFoundError,
        json.JSONDecodeError
    ):

        return []


def write_audit_log(records):
    """
    Save audit records to audit_log.json.
    """

    with open(
        AUDIT_FILE,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            records,
            file,
            indent=4,
            ensure_ascii=False
        )


def add_audit_event(
    event_type,
    status,
    message,
    order_id=None,
    payment_id=None,
    amount=None,
    currency="INR",
    metadata=None
):
    """
    Add one event to the audit trail.
    """

    records = read_audit_log()

    event = {
        "id": len(records) + 1,
        "timestamp": get_current_timestamp(),
        "event_type": event_type,
        "status": status,
        "message": message,
        "order_id": order_id,
        "payment_id": payment_id,
        "amount": amount,
        "currency": currency,
        "metadata": metadata or {}
    }

    records.append(event)

    write_audit_log(records)

    return event


# ==================================================
# REVENUE METRICS HELPER
# ==================================================

def calculate_metrics():

    records = read_audit_log()

    # ----------------------------------------------
    # VERIFIED PAYMENTS
    # ----------------------------------------------

    verified_payments = []

    for record in records:

        if (
            record.get("event_type")
            == "payment_verified"
            and record.get("status")
            == "success"
        ):

            verified_payments.append(record)

    # ----------------------------------------------
    # REMOVE DUPLICATE PAYMENT IDS
    # ----------------------------------------------

    unique_payments = {}

    for payment in verified_payments:

        payment_id = payment.get(
            "payment_id"
        )

        if payment_id:

            unique_payments[payment_id] = payment

    verified_payments = list(
        unique_payments.values()
    )

    # ----------------------------------------------
    # REVENUE
    # ----------------------------------------------

    total_revenue = sum(
        payment.get("amount") or 0
        for payment in verified_payments
    )

    # ----------------------------------------------
    # SUCCESSFUL ORDERS
    # ----------------------------------------------

    successful_orders = len(
        verified_payments
    )

    # ----------------------------------------------
    # FAILED PAYMENTS
    # ----------------------------------------------

    failed_payments = sum(
        1
        for record in records
        if (
            record.get("event_type")
            == "payment_failed"
            and record.get("status")
            == "failed"
        )
    )

    # ----------------------------------------------
    # ORDER CREATION COUNT
    # ----------------------------------------------

    orders_created = sum(
        1
        for record in records
        if (
            record.get("event_type")
            == "order_created"
            and record.get("status")
            == "success"
        )
    )

    # ----------------------------------------------
    # AI QUERY COUNT
    # ----------------------------------------------

    ai_queries = sum(
        1
        for record in records
        if record.get("event_type")
        == "ai_query"
    )

    # ----------------------------------------------
    # PAYMENT VERIFICATION COUNT
    # ----------------------------------------------

    verification_attempts = sum(
        1
        for record in records
        if record.get("event_type")
        in {
            "payment_verified",
            "payment_verification_failed"
        }
    )

    # ----------------------------------------------
    # AVERAGE ORDER VALUE
    # ----------------------------------------------

    if successful_orders > 0:

        average_order_value = (
            total_revenue
            / successful_orders
        )

    else:

        average_order_value = 0

    # ----------------------------------------------
    # CONVERSION RATE
    # ----------------------------------------------

    if orders_created > 0:

        payment_conversion_rate = (
            successful_orders
            / orders_created
        ) * 100

    else:

        payment_conversion_rate = 0

    # ----------------------------------------------
    # RETURN METRICS
    # ----------------------------------------------

    return {
        "total_revenue": round(
            total_revenue,
            2
        ),

        "successful_orders":
            successful_orders,

        "orders_created":
            orders_created,

        "failed_payments":
            failed_payments,

        "average_order_value":
            round(
                average_order_value,
                2
            ),

        "payment_conversion_rate":
            round(
                payment_conversion_rate,
                2
            ),

        "ai_queries":
            ai_queries,

        "verification_attempts":
            verification_attempts,

        "audit_events":
            len(records),

        "currency":
            "INR"
    }


# ==================================================
# HELPER: EXTRACT BUDGET
# ==================================================

def extract_budget(message: str):

    """
    Extract budget from messages such as:

    ₹1000
    ₹1,000
    1000
    under 1000
    below ₹1500
    within 2000
    budget 3000
    """

    numbers = re.findall(
        r"\d+(?:,\d+)*",
        message
    )

    if not numbers:
        return None

    values = []

    for number in numbers:

        values.append(
            int(
                number.replace(
                    ",",
                    ""
                )
            )
        )

    return max(values)


# ==================================================
# HELPER: FIND PRODUCTS
# ==================================================

def find_products(
    message: str,
    budget=None
):

    message_lower = message.lower()

    words = re.findall(
        r"[a-zA-Z]+",
        message_lower
    )

    stop_words = {
        "the",
        "for",
        "and",
        "with",
        "under",
        "below",
        "within",
        "need",
        "want",
        "something",
        "looking",
        "find",
        "give",
        "show",
        "me",
        "please",
        "can",
        "you",
        "my",
        "some",
        "good",
        "best",
        "budget",
    }

    useful_words = [
        word
        for word in words
        if len(word) >= 3
        and word not in stop_words
    ]

    scored_products = []

    for product in products:

        score = 0

        searchable_text = (
            product["name"].lower()
            + " "
            + product["description"].lower()
            + " "
            + " ".join(
                product["tags"]
            ).lower()
        )

        # ------------------------------------------
        # KEYWORD MATCHING
        # ------------------------------------------

        for word in useful_words:

            if word in searchable_text:
                score += 2

        # ------------------------------------------
        # BUDGET SCORING
        # ------------------------------------------

        if budget is not None:

            if product["price"] <= budget:
                score += 3

            else:
                score -= 2

        # ------------------------------------------
        # ADD PRODUCT
        # ------------------------------------------

        if score > 0:

            scored_products.append(
                {
                    **product,
                    "score": score
                }
            )

    # ----------------------------------------------
    # SORT PRODUCTS
    # ----------------------------------------------

    scored_products.sort(
        key=lambda product: (
            product["score"],
            -product["price"]
        ),
        reverse=True,
    )

    return scored_products


# ==================================================
# HELPER: GET UPSELL PRODUCTS
# ==================================================

def get_upsell_products(
    recommended_product
):

    related_ids = (
        recommended_product.get(
            "relatedProducts",
            []
        )
    )

    related = []

    for product in products:

        if product["id"] in related_ids:

            related.append(product)

    return related


# ==================================================
# ROOT ENDPOINT
# ==================================================

@app.get("/")
def root():

    return {
        "message":
            "Nova Intelligence is running",

        "status":
            "online",

        "features": [
            "AI recommendations",
            "Razorpay payments",
            "Payment verification",
            "Failed payment tracking",
            "Audit trail",
            "Revenue metrics"
        ]
    }


# ==================================================
# PRODUCT ENDPOINT
# ==================================================

@app.get("/products")
def get_products():

    return {
        "products": products
    }


# ==================================================
# RAZORPAY CREATE ORDER
# ==================================================

@app.post("/payment/create-order")
def create_order(
    request: OrderRequest
):

    amount = request.amount

    # ----------------------------------------------
    # VALIDATE AMOUNT
    # ----------------------------------------------

    if amount <= 0:

        add_audit_event(
            event_type="order_creation_failed",
            status="failed",
            message="Invalid order amount",
            amount=amount
        )

        return {
            "success": False,
            "error": "Invalid amount"
        }

    try:

        # ------------------------------------------
        # CONVERT RUPEES TO PAISE
        # ------------------------------------------

        order_data = {
            "amount": amount * 100,
            "currency": "INR",
            "payment_capture": 1
        }

        # ------------------------------------------
        # CREATE RAZORPAY ORDER
        # ------------------------------------------

        order = razorpay_client.order.create(
            data=order_data
        )

        # ------------------------------------------
        # AUDIT ORDER CREATION
        # ------------------------------------------

        add_audit_event(
            event_type="order_created",
            status="success",
            message="Razorpay order created successfully",
            order_id=order["id"],
            amount=amount,
            currency="INR",
            metadata={
                "razorpay_amount":
                    order["amount"]
            }
        )

        # ------------------------------------------
        # RETURN ORDER INFORMATION
        # ------------------------------------------

        return {
            "success": True,
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": RAZORPAY_KEY_ID
        }

    except Exception as error:

        print(
            "Razorpay order creation error:",
            error
        )

        add_audit_event(
            event_type="order_creation_failed",
            status="failed",
            message="Unable to create Razorpay order",
            amount=amount,
            metadata={
                "error": str(error)
            }
        )

        return {
            "success": False,
            "error":
                "Unable to create Razorpay order"
        }


# ==================================================
# NEW: RAZORPAY PAYMENT FAILED
# ==================================================

@app.post("/payment/failed")
def payment_failed(
    request: PaymentFailedRequest
):

    print(
        "Razorpay payment failed:"
    )

    print(
        "Order ID:",
        request.razorpay_order_id
    )

    print(
        "Payment ID:",
        request.razorpay_payment_id
    )

    print(
        "Error:",
        request.error_description
    )

    # ----------------------------------------------
    # CREATE FAILED PAYMENT AUDIT EVENT
    # ----------------------------------------------

    event = add_audit_event(
        event_type="payment_failed",
        status="failed",
        message=(
            request.error_description
            or "Razorpay payment failed"
        ),
        order_id=request.razorpay_order_id,
        payment_id=request.razorpay_payment_id,
        amount=request.amount,
        currency="INR",
        metadata={
            "error_code":
                request.error_code,

            "error_source":
                request.error_source,

            "error_step":
                request.error_step,

            "error_reason":
                request.error_reason
        }
    )

    return {
        "success": True,
        "recorded": True,
        "message":
            "Failed payment recorded successfully",
        "event_id":
            event["id"]
    }


# ==================================================
# RAZORPAY PAYMENT VERIFICATION
# ==================================================

@app.post("/payment/verify")
def verify_payment(
    request: PaymentVerificationRequest
):

    try:

        # ------------------------------------------
        # VERIFY RAZORPAY SIGNATURE
        # ------------------------------------------

        razorpay_client.utility.verify_payment_signature(
            {
                "razorpay_order_id":
                    request.razorpay_order_id,

                "razorpay_payment_id":
                    request.razorpay_payment_id,

                "razorpay_signature":
                    request.razorpay_signature
            }
        )

        # ------------------------------------------
        # FETCH ORDER FROM RAZORPAY
        # ------------------------------------------

        order = razorpay_client.order.fetch(
            request.razorpay_order_id
        )

        order_amount_paise = order.get(
            "amount",
            0
        )

        order_amount_rupees = (
            order_amount_paise / 100
        )

        # ------------------------------------------
        # AUDIT SUCCESSFUL PAYMENT
        # ------------------------------------------

        add_audit_event(
            event_type="payment_verified",
            status="success",
            message="Payment verified successfully",
            order_id=
                request.razorpay_order_id,
            payment_id=
                request.razorpay_payment_id,
            amount=
                order_amount_rupees,
            currency=
                order.get(
                    "currency",
                    "INR"
                ),
            metadata={
                "signature_verified":
                    True
            }
        )

        print(
            "Payment verified successfully:"
        )

        print(
            "Order ID:",
            request.razorpay_order_id
        )

        print(
            "Payment ID:",
            request.razorpay_payment_id
        )

        return {
            "success": True,

            "verified": True,

            "message":
                "Payment verified successfully",

            "razorpay_order_id":
                request.razorpay_order_id,

            "razorpay_payment_id":
                request.razorpay_payment_id,

            "amount":
                order_amount_rupees,

            "currency":
                order.get(
                    "currency",
                    "INR"
                )
        }

    except razorpay.errors.SignatureVerificationError:

        # ------------------------------------------
        # INVALID SIGNATURE
        # ------------------------------------------

        print(
            "Payment verification failed:"
            " Invalid signature"
        )

        add_audit_event(
            event_type=
                "payment_verification_failed",

            status="failed",

            message=
                "Payment signature verification failed",

            order_id=
                request.razorpay_order_id,

            payment_id=
                request.razorpay_payment_id,

            metadata={
                "signature_verified":
                    False
            }
        )

        return {
            "success": False,

            "verified": False,

            "message":
                "Payment verification failed"
        }

    except Exception as error:

        # ------------------------------------------
        # OTHER ERROR
        # ------------------------------------------

        print(
            "Payment verification error:",
            error
        )

        add_audit_event(
            event_type=
                "payment_verification_failed",

            status="failed",

            message=
                "Unable to verify payment",

            order_id=
                request.razorpay_order_id,

            payment_id=
                request.razorpay_payment_id,

            metadata={
                "error":
                    str(error)
            }
        )

        return {
            "success": False,

            "verified": False,

            "message":
                "Unable to verify payment"
        }


# ==================================================
# AI CHAT ENDPOINT
# ==================================================

@app.post("/ai/chat")
def ai_chat(
    request: ChatRequest
):

    message = request.message.strip()

    # ----------------------------------------------
    # AUDIT AI QUERY
    # ----------------------------------------------

    add_audit_event(
        event_type="ai_query",
        status="success",
        message="Nova AI query received",
        metadata={
            "query_length":
                len(message)
        }
    )

    # ----------------------------------------------
    # EMPTY MESSAGE
    # ----------------------------------------------

    if not message:

        return {
            "reply":
                "Tell me what you're looking for.",

            "budget":
                None,

            "recommendations":
                [],

            "upsell":
                []
        }

    # ----------------------------------------------
    # EXTRACT BUDGET
    # ----------------------------------------------

    budget = extract_budget(
        message
    )

    # ----------------------------------------------
    # FIND PRODUCTS
    # ----------------------------------------------

    recommendations = find_products(
        message,
        budget
    )

    # ----------------------------------------------
    # NO RECOMMENDATIONS
    # ----------------------------------------------

    if not recommendations:

        return {
            "reply": (
                "I couldn't find an exact match. "
                "Try something like "
                "'wireless mouse under ₹1000' "
                "or "
                "'something for my workspace'."
            ),

            "budget":
                budget,

            "recommendations":
                [],

            "upsell":
                []
        }

    # ----------------------------------------------
    # LIMIT RECOMMENDATIONS
    # ----------------------------------------------

    recommendations = recommendations[:3]

    # ----------------------------------------------
    # TOP PRODUCT
    # ----------------------------------------------

    top_product = recommendations[0]

    # ----------------------------------------------
    # UPSELL PRODUCTS
    # ----------------------------------------------

    upsell = get_upsell_products(
        top_product
    )

    recommendation_ids = {
        product["id"]
        for product in recommendations
    }

    upsell = [
        product
        for product in upsell
        if product["id"]
        not in recommendation_ids
    ]

    upsell = upsell[:2]

    # ----------------------------------------------
    # GENERATE RESPONSE
    # ----------------------------------------------

    if budget:

        reply = (
            f"I found "
            f"{len(recommendations)} good options "
            f"within your "
            f"₹{budget:,} budget. "
            f"My top pick is "
            f"{top_product['name']}."
        )

    else:

        reply = (
            f"My top recommendation is "
            f"{top_product['name']} "
            f"at "
            f"₹{top_product['price']:,}."
        )

    # ----------------------------------------------
    # ADD UPSELL MESSAGE
    # ----------------------------------------------

    if upsell:

        reply += (
            f" You may also want "
            f"{upsell[0]['name']} "
            f"to complete your setup."
        )

    # ----------------------------------------------
    # FINAL RESPONSE
    # ----------------------------------------------

    return {
        "reply":
            reply,

        "budget":
            budget,

        "recommendations":
            recommendations,

        "upsell":
            upsell
    }


# ==================================================
# ADMIN - AUDIT TRAIL
# ==================================================

@app.get("/admin/audit")
def get_audit_trail():

    records = read_audit_log()

    # Latest events first
    records.reverse()

    return {
        "success": True,
        "count": len(records),
        "audit": records
    }


# ==================================================
# ADMIN - REVENUE METRICS
# ==================================================

@app.get("/admin/metrics")
def get_revenue_metrics():

    metrics = calculate_metrics()

    return {
        "success": True,
        "metrics": metrics
    }