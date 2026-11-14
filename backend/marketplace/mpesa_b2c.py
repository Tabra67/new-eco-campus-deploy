import base64
import logging
from datetime import datetime

import requests
from django.conf import settings

logger = logging.getLogger('marketplace.mpesa')


def _base_url() -> str:
    return 'https://sandbox.safaricom.co.ke'


def _setting(name: str, default: str = '') -> str:
    return str(getattr(settings, name, default) or '').strip()


def _normalize_phone(phone: str) -> str:
    digits = ''.join(ch for ch in str(phone or '') if ch.isdigit())
    if digits.startswith('254'):
        return digits
    if digits.startswith('0'):
        return f'254{digits[1:]}'
    if len(digits) == 9:
        return f'254{digits}'
    return digits


def get_b2c_token() -> str:
    key = _setting('MPESA_CONSUMER_KEY')
    secret = _setting('MPESA_CONSUMER_SECRET')
    auth = base64.b64encode(f'{key}:{secret}'.encode()).decode()
    url = f'{_base_url()}/oauth/v1/generate?grant_type=client_credentials'
    response = requests.get(url, headers={'Authorization': f'Basic {auth}'}, timeout=30)
    data = response.json()
    if not response.ok or not data.get('access_token'):
        raise ValueError(data.get('errorMessage') or 'Failed to authenticate with Daraja B2C')
    return data['access_token']


def initiate_b2c_payout(*, amount: int, phone_number: str, remarks: str, occasion: str, reference_id: str) -> dict:
    token = get_b2c_token()
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    security_credential = _setting('MPESA_B2C_SECURITY_CREDENTIAL')
    initiator_name = _setting('MPESA_B2C_INITIATOR_NAME')
    short_code = _setting('MPESA_SHORTCODE')
    result_url = _setting('MPESA_B2C_RESULT_URL')
    timeout_url = _setting('MPESA_B2C_TIMEOUT_URL')

    if not all([security_credential, initiator_name, short_code, result_url, timeout_url]):
        raise ValueError('Missing B2C settings. Set MPESA_B2C_* environment variables.')

    payload = {
        'InitiatorName': initiator_name,
        'SecurityCredential': security_credential,
        'CommandID': 'BusinessPayment',
        'Amount': int(amount),
        'PartyA': short_code,
        'PartyB': _normalize_phone(phone_number),
        'Remarks': remarks[:100],
        'QueueTimeOutURL': timeout_url,
        'ResultURL': result_url,
        'Occasion': occasion[:100] or f'WD-{reference_id}',
    }
    url = f'{_base_url()}/mpesa/b2c/v3/paymentrequest'
    response = requests.post(url, json=payload, headers={'Authorization': f'Bearer {token}'}, timeout=40)
    data = response.json()
    logger.info('B2C payout request reference=%s response=%s', reference_id, data)
    if not response.ok or data.get('errorCode'):
        raise ValueError(data.get('errorMessage') or data.get('errorCode') or 'B2C payout request failed')
    return {
        'conversation_id': data.get('ConversationID', ''),
        'originator_conversation_id': data.get('OriginatorConversationID', ''),
        'response_description': data.get('ResponseDescription', ''),
        'raw': data,
        'timestamp': timestamp,
    }
