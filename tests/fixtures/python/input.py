import asyncio
from typing import Optional


class Animal:
    """Base animal."""

    species: str = "unknown"

    def __init__(self, name: str, age: int = 0):
        self.name = name
        self._age = age

    @property
    def age(self) -> int:
        return self._age

    async def speak(self) -> str:
        return "..."


class Dog(Animal):
    def speak(self) -> str:
        return "woof"


def make_dog(name: str) -> Dog:
    return Dog(name)
