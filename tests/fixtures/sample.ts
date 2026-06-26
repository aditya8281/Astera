function greet(name: string): string {
  return "Hello, " + name;
}

class UserService {
  private users: Map<string, User> = new Map();

  constructor() {
    console.log("UserService created");
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
  }

  findByName(name: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.name === name);
  }
}

interface User {
  id: string;
  name: string;
  email?: string;
}

enum Status {
  Active,
  Inactive,
}

type Callback = (result: string) => void;

import { Component } from "react";
import * as fs from "fs";
