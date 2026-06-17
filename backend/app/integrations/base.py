"""Generic provider registry for pluggable integrations (ports & adapters).

ES: Registro genérico de proveedores. Permite intercambiar implementaciones
    (p. ej. Google vs Outlook) sin tocar el código que las consume.
EN: Generic provider registry. Lets implementations be swapped (e.g. Google vs
    Outlook) without changing the consuming code.
"""
from __future__ import annotations

from typing import Generic, Type, TypeVar

T = TypeVar("T")


class ProviderRegistry(Generic[T]):
    """Holds named provider classes for one integration kind (calendar, crm, ...)."""

    def __init__(self, kind: str) -> None:
        self.kind = kind
        self._providers: dict[str, Type[T]] = {}
        self._default: str | None = None

    def register(self, name: str, *, default: bool = False):
        """Class decorator: register a concrete provider under ``name``."""

        def decorator(cls: Type[T]) -> Type[T]:
            self._providers[name] = cls
            if default or self._default is None:
                self._default = name
            return cls

        return decorator

    def provider_class(self, name: str | None = None) -> Type[T]:
        key = name or self._default
        if key is None or key not in self._providers:
            raise KeyError(f"No '{self.kind}' provider registered for {key!r}")
        return self._providers[key]

    def available(self) -> list[str]:
        return list(self._providers)

    @property
    def default(self) -> str | None:
        return self._default
