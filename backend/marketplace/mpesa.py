import base64
import logging
from datetime import datetime, timedelta
from decimal import Decimal

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .escrow_services import calculate_order_amounts, fund_order_escrow, decrement_product_stock
from .checkout_services import complete_checkout_session, amounts_for_checkout_session
from .models import Order, MpesaTransaction, CheckoutSession
from .mpesa_config import normalize_callback_url

logger = logging.getLogger('marketplace.mpesa')

STK_REQUEST_TIMEOUT = 30
PENDING_TIMEOUT_MINUTES = 5
CANCELLED_RESULT_CODES = frozenset({'1032', '1037'})


def _mpesa_setting(name: str) -> str:
    """Read a Django settings value and strip whitespace/newlines from .env."""
    return str(getattr(settings, name, '') or '').strip()


def _mpesa_settings():
    callback_raw = _mpesa_setting('MPESA_CALLBACK_URL')
    return {
        'env': _mpesa_setting('MPESA_ENV') or 'sandbox',
        'shortcode': _mpesa_setting('MPESA_SHORTCODE'),
        'passkey': _mpesa_setting('MPESA_PASSKEY'),
        'consumer_key': _mpesa_setting('MPESA_CONSUMER_KEY'),
        'consumer_secret': _mpesa_setting('MPESA_CONSUMER_SECRET'),
        'callback_url': normalize_callback_url(callback_raw),
    }


def _build_stk_password(*, shortcode: str, passkey: str, timestamp: str) -> str:
    """Lipa Na M-Pesa Online password: base64(shortcode + passkey + timestamp)."""
    raw_string = shortcode + passkey + timestamp
    return base64.b64encode(raw_string.encode()).decode()


def _base_url(env: str) -> str:
    if env == 'production':
        return 'https://api.safaricom.co.ke'
    return 'https://sandbox.safaricom.co.ke'


def _parse_json_response(response: requests.Response) -> dict:
    try:
        return response.json()
    except Exception:
        snippet = (response.text or '')[:500]
        logger.error(
            'M-Pesa non-JSON response status=%s body=%s',
            response.status_code,
            snippet,
        )
        raise ValueError(snippet or f'M-Pesa returned HTTP {response.status_code}')


def get_access_token() -> str:
    cfg = _mpesa_settings()
    auth = base64.b64encode(f"{cfg['consumer_key']}:{cfg['consumer_secret']}".encode()).decode()
    url = f"{_base_url(cfg['env'])}/oauth/v1/generate?grant_type=client_credentials"
    logger.info('M-Pesa OAuth request env=%s', cfg['env'])
    logger.info("OAuth URL: %s", url)
    logger.info("Consumer Key: %s", cfg['consumer_key'])
    logger.info("Consumer Secret Length: %s", len(cfg['consumer_secret']))
    response = requests.get(url, headers={'Authorization': f'Basic {auth}'}, timeout=STK_REQUEST_TIMEOUT)
    data = _parse_json_response(response)
    logger.error("OAuth Status Code: %s", response.status_code)
    logger.error("OAuth Response: %s", data)
    if not response.ok:
        raise ValueError(data.get('errorMessage') or data.get('error') or 'OAuth token request failed')
    token = data.get('access_token')
    if not token:
        raise ValueError('M-Pesa OAuth response missing access_token')
    return token


def _normalize_phone(phone: str) -> str:
    digits = ''.join(ch for ch in str(phone) if ch.isdigit())
    if digits.startswith('254'):
        return digits
    if digits.startswith('0'):
        return f"254{digits[1:]}"
    if len(digits) == 9:
        return f"254{digits}"
    return digits


def _map_failure_status(result_code: str) -> str:
    if result_code in CANCELLED_RESULT_CODES:
        return MpesaTransaction.STATUS_CANCELLED
    return MpesaTransaction.STATUS_FAILED


def maybe_mark_transaction_timed_out(txn: MpesaTransaction) -> MpesaTransaction:
    if txn.status != MpesaTransaction.STATUS_PENDING:
        return txn
    cutoff = timezone.now() - timedelta(minutes=PENDING_TIMEOUT_MINUTES)
    if txn.created_at <= cutoff:
        txn.status = MpesaTransaction.STATUS_TIMEOUT
        txn.result_desc = txn.result_desc or 'Payment timed out waiting for M-Pesa confirmation'
        txn.updated_at = timezone.now()
        txn.save(update_fields=['status', 'result_desc', 'updated_at'])
        logger.warning(
            'M-Pesa transaction timed out checkout_request_id=%s order_id=%s',
            txn.checkout_request_id,
            txn.order_id,
        )
    return txn


def _send_stk_push(*, amount_int: int, phone: str, account_reference: str, description: str) -> dict:
    cfg = _mpesa_settings()
    callback_url = cfg['callback_url']
    normalized_phone = _normalize_phone(phone)
    shortcode = cfg['shortcode']
    passkey = cfg['passkey']
    if not shortcode or not passkey:
        raise ValueError('M-Pesa shortcode or passkey is not configured')

    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    password = _build_stk_password(shortcode=shortcode, passkey=passkey, timestamp=timestamp)
    token = get_access_token()

    payload = {
        'BusinessShortCode': shortcode,
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': 'CustomerPayBillOnline',
        'Amount': amount_int,
        'PartyA': normalized_phone,
        'PartyB': shortcode,
        'PhoneNumber': normalized_phone,
        'CallBackURL': callback_url,
        'AccountReference': account_reference[:12],
        'TransactionDesc': description[:50],
    }

    url = f"{_base_url(cfg['env'])}/mpesa/stkpush/v1/processrequest"
    try:
        response = requests.post(
            url,
            headers={'Authorization': f'Bearer {token}'},
            json=payload,
            timeout=STK_REQUEST_TIMEOUT,
        )
    except requests.Timeout:
        raise ValueError('M-Pesa request timed out. Please try again.') from None
    except requests.RequestException as exc:
        raise ValueError('Could not reach M-Pesa. Check your connection and try again.') from exc

    data = _parse_json_response(response)
    if not response.ok or data.get('errorCode'):
        message = data.get('errorMessage') or data.get('errorCode') or response.reason
        raise ValueError(message)

    checkout_request_id = data.get('CheckoutRequestID')
    if not checkout_request_id:
        raise ValueError('M-Pesa did not return a checkout request ID')

    return {
        'checkout_request_id': checkout_request_id,
        'merchant_request_id': data.get('MerchantRequestID'),
        'phone': normalized_phone,
        'raw': data,
    }


def initiate_stk_push(*, order: Order, phone: str) -> MpesaTransaction:
    pending = MpesaTransaction.objects.filter(
        order=order,
        status=MpesaTransaction.STATUS_PENDING,
    ).first()
    if pending:
        maybe_mark_transaction_timed_out(pending)
        if pending.status == MpesaTransaction.STATUS_PENDING:
            raise ValueError('A payment is already pending for this order. Complete or cancel it on your phone.')

    amounts = calculate_order_amounts(order, order.buyer)
    amount_int = int(Decimal(amounts['total_amount']))
    if amount_int < 1:
        raise ValueError('Payment amount must be at least 1 KES')

    stk = _send_stk_push(
        amount_int=amount_int,
        phone=phone,
        account_reference=f'ORDER{order.id}',
        description=f'Escrow payment order {order.id}',
    )

    txn = MpesaTransaction.objects.create(
        order=order,
        checkout_request_id=stk['checkout_request_id'],
        merchant_request_id=stk['merchant_request_id'],
        phone=stk['phone'],
        amount=amounts['total_amount'],
        status=MpesaTransaction.STATUS_PENDING,
        raw_callback=stk['raw'],
    )
    return txn


def initiate_stk_push_for_session(*, session: CheckoutSession, phone: str) -> MpesaTransaction:
    pending = MpesaTransaction.objects.filter(
        checkout_session=session,
        status=MpesaTransaction.STATUS_PENDING,
    ).first()
    if pending:
        maybe_mark_transaction_timed_out(pending)
        if pending.status == MpesaTransaction.STATUS_PENDING:
            raise ValueError('A payment is already pending. Complete or cancel it on your phone.')

    amounts = amounts_for_checkout_session(session)
    amount_int = int(Decimal(amounts['total_amount']))
    if amount_int < 1:
        raise ValueError('Payment amount must be at least 1 KES')

    stk = _send_stk_push(
        amount_int=amount_int,
        phone=phone,
        account_reference=f'CHK{session.id}',
        description=f'Eco-Campus checkout {session.id}',
    )

    session.phone = stk['phone']
    session.save(update_fields=['phone', 'updated_at'])

    return MpesaTransaction.objects.create(
        checkout_session=session,
        checkout_request_id=stk['checkout_request_id'],
        merchant_request_id=stk['merchant_request_id'],
        phone=stk['phone'],
        amount=amounts['total_amount'],
        status=MpesaTransaction.STATUS_PENDING,
        raw_callback=stk['raw'],
    )


@transaction.atomic
def process_stk_callback(payload: dict):
    if not isinstance(payload, dict):
        logger.warning('M-Pesa callback ignored: payload is not a dict')
        return None

    body = payload.get('Body', {}).get('stkCallback', {})
    if not isinstance(body, dict):
        logger.warning('M-Pesa callback missing stkCallback body')
        return None

    checkout_request_id = body.get('CheckoutRequestID')
    if not checkout_request_id:
        logger.warning('M-Pesa callback missing CheckoutRequestID')
        return None

    logger.info('M-Pesa callback received checkout_request_id=%s', checkout_request_id)

    txn = (
        MpesaTransaction.objects.select_for_update()
        .select_related(
            'order', 'order__buyer', 'order__seller',
            'checkout_session', 'checkout_session__product', 'checkout_session__buyer',
        )
        .filter(checkout_request_id=checkout_request_id)
        .first()
    )
    if not txn:
        logger.warning('M-Pesa callback unknown checkout_request_id=%s', checkout_request_id)
        return None

    if txn.status == MpesaTransaction.STATUS_COMPLETED:
        logger.info('M-Pesa duplicate callback ignored (already completed) checkout_request_id=%s', checkout_request_id)
        return txn

    result_code = str(body.get('ResultCode', ''))
    txn.result_code = result_code
    txn.result_desc = body.get('ResultDesc', '') or ''
    txn.raw_callback = payload
    txn.updated_at = timezone.now()

    if result_code != '0':
        txn.status = _map_failure_status(result_code)
        txn.save(update_fields=['result_code', 'result_desc', 'raw_callback', 'status', 'updated_at'])
        logger.warning(
            'M-Pesa payment failed checkout_request_id=%s code=%s desc=%s status=%s',
            checkout_request_id,
            result_code,
            txn.result_desc,
            txn.status,
        )
        return txn

    metadata = body.get('CallbackMetadata', {}).get('Item', []) or []
    receipt_number = ''
    for item in metadata:
        if isinstance(item, dict) and item.get('Name') == 'MpesaReceiptNumber':
            receipt_number = str(item.get('Value', ''))

    txn.receipt_number = receipt_number
    txn.status = MpesaTransaction.STATUS_COMPLETED
    txn.save(update_fields=['result_code', 'result_desc', 'raw_callback', 'receipt_number', 'status', 'updated_at'])

    session = txn.checkout_session
    if session and session.status != CheckoutSession.STATUS_COMPLETED:
        try:
            complete_checkout_session(
                session,
                phone=txn.phone,
                checkout_request_id=txn.checkout_request_id,
                receipt_number=receipt_number,
                merchant_request_id=txn.merchant_request_id or '',
            )
            txn.order = session.order
            txn.save(update_fields=['order'])
            logger.info('M-Pesa checkout session completed session_id=%s order_id=%s', session.id, session.order_id)
        except Exception:
            logger.exception('Failed to complete checkout session session_id=%s', session.id)
        return txn

    order = txn.order
    if not order:
        logger.warning('M-Pesa callback completed without order or session checkout_request_id=%s', checkout_request_id)
        return txn

    if order.status in (Order.STATUS_PENDING_PAYMENT, Order.STATUS_PROCESSING):
        if order.status == Order.STATUS_PENDING_PAYMENT:
            decrement_product_stock(order.product, getattr(order, 'quantity', 1))
        fund_order_escrow(
            order,
            phone=txn.phone,
            checkout_request_id=txn.checkout_request_id,
            receipt_number=receipt_number,
            merchant_request_id=txn.merchant_request_id or '',
        )
        logger.info('M-Pesa escrow funded order_id=%s', order.id)
    elif order.status == Order.STATUS_PAID:
        logger.info('M-Pesa callback success but order already paid order_id=%s', order.id)
    else:
        logger.warning('M-Pesa payment completed unexpected order status order_id=%s status=%s', order.id, order.status)

    return txn
