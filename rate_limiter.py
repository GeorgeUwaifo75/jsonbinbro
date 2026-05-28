from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Create limiter instance
limiter = Limiter(key_func=get_remote_address, default_limits=["100/hour"])

# Export these for use in main.py
__all__ = ["limiter", "RateLimitExceeded", "_rate_limit_exceeded_handler"]