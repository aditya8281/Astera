use std::collections::HashMap;
use crate::utils::*;

/// A greeter struct
pub struct Greeter {
    name: String,
}

impl Greeter {
    pub fn new(name: String) -> Self {
        Greeter { name }
    }

    pub fn greet(&self) -> String {
        format!("Hello, {}!", self.name)
    }
}

/// User status enum
pub enum Status {
    Active,
    Inactive,
}

/// User trait
pub trait User {
    fn id(&self) -> u64;
}

/// Admin struct implementing User
pub struct Admin {
    id: u64,
}

impl User for Admin {
    fn id(&self) -> u64 {
        self.id
    }
}

pub type Callback = Box<dyn Fn(String)>;

const MAX_RETRIES: u32 = 3;

pub fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}
