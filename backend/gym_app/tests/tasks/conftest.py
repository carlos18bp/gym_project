"""Test configuration for gym_app tasks tests."""

import sys
from unittest.mock import MagicMock

sys.modules.setdefault('silk', MagicMock())
sys.modules.setdefault('silk.models', MagicMock())
