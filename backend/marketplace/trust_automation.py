"""Future dispute/trust automation hooks — no automated decisions yet."""


def auto_refund(dispute):
    """Placeholder: auto-refund eligible disputes."""
    return None


def auto_release(dispute):
    """Placeholder: auto-release escrow for eligible disputes."""
    return None


def risk_scoring(dispute):
    """Placeholder: compute dispute risk score."""
    return None


def faster_release_eligibility(user):
    """High-trust seller: faster release eligibility (not implemented)."""
    return False


def refund_review_eligibility(user):
    """Low-trust seller: refund review eligibility (not implemented)."""
    return False
