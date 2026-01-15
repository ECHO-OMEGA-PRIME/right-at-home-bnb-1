# API Routes Package
from . import properties
from . import guests
from . import cleaners
from . import locks
from . import finance
from . import concierge
from . import messages

# Enhanced Routes (Database-integrated, full functionality)
from . import bookings
from . import guests_enhanced
from . import cleaners_enhanced
from . import finance_enhanced

__all__ = [
    # Basic Routes (Mock data / simple implementation)
    'properties',
    'guests',
    'cleaners',
    'locks',
    'finance',
    'concierge',
    'messages',

    # Enhanced Routes (Full database integration)
    'bookings',
    'guests_enhanced',
    'cleaners_enhanced',
    'finance_enhanced',
]
