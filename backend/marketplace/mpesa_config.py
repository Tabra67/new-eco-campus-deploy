"""M-Pesa configuration helpers (callback URL validation, no secrets)."""
from urllib.parse import urlparse

PLACEHOLDER_HOSTS = frozenset({'your_ngrok_url.ngrok-free.app', 'your-ngrok-url.ngrok-free.app'})
BLOCKED_HOSTS = frozenset({'localhost', '127.0.0.1', '0.0.0.0'})


def normalize_callback_url(url: str) -> str:
    """Ensure callback URL is HTTPS, public, and ends with the callback path."""
    raw = (url or '').strip()
    if not raw:
        raise ValueError(
            'MPESA_CALLBACK_URL is not set. Add your ngrok HTTPS URL to .env, e.g. '
            'MPESA_CALLBACK_URL=https://xxxx.ngrok-free.app/api/marketplace/mpesa/callback/'
        )

    if 'YOUR_NGROK_URL' in raw.upper():
        raise ValueError(
            'MPESA_CALLBACK_URL still contains the placeholder YOUR_NGROK_URL. '
            'Set your live ngrok HTTPS URL in .env.'
        )

    parsed = urlparse(raw)
    if parsed.scheme != 'https':
        raise ValueError('MPESA_CALLBACK_URL must use HTTPS (Safaricom sandbox requires a public HTTPS URL).')

    host = (parsed.hostname or '').lower()
    if not host:
        raise ValueError('MPESA_CALLBACK_URL is missing a valid hostname.')

    if host in BLOCKED_HOSTS or host in PLACEHOLDER_HOSTS:
        raise ValueError(
            'MPESA_CALLBACK_URL cannot use localhost or a placeholder host. '
            'Use your ngrok HTTPS domain instead.'
        )

    if host.endswith('.local') or host.startswith('192.168.') or host.startswith('10.'):
        raise ValueError('MPESA_CALLBACK_URL must be a publicly reachable address (not a private IP).')

    path = parsed.path or ''
    if 'mpesa/callback' not in path:
        raise ValueError(
            'MPESA_CALLBACK_URL path should end with /api/marketplace/mpesa/callback/'
        )

    normalized = f'{parsed.scheme}://{parsed.netloc}{path}'
    if not normalized.endswith('/'):
        normalized += '/'
    return normalized
