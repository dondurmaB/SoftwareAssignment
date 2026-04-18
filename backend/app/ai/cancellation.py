from __future__ import annotations

from threading import Lock


class AICancellationRegistry:
    """In-memory cancellation tracker for assignment/demo-scale AI streaming."""

    def __init__(self) -> None:
        self._canceled_interactions: set[int] = set()
        self._lock = Lock()

    def mark_cancellation_requested(self, interaction_id: int) -> None:
        with self._lock:
            self._canceled_interactions.add(interaction_id)

    def is_canceled(self, interaction_id: int) -> bool:
        with self._lock:
            return interaction_id in self._canceled_interactions

    def clear(self, interaction_id: int) -> None:
        with self._lock:
            self._canceled_interactions.discard(interaction_id)

    def reset(self) -> None:
        with self._lock:
            self._canceled_interactions.clear()
