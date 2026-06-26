import os
import sys
from typing import Optional, List

def greet(name: str) -> str:
    return f"Hello, {name}"

class UserService:
    def __init__(self):
        self.users = {}

    def add_user(self, user_id: str, name: str) -> None:
        self.users[user_id] = name

    def find_by_name(self, name: str) -> Optional[str]:
        for uid, uname in self.users.items():
            if uname == name:
                return uid
        return None
