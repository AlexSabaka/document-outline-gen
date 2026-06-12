pub struct Point {
    pub x: i32,
    y: i32,
}

pub enum Color {
    Red,
    Green,
}

pub trait Drawable {
    fn draw(&self) -> String;
}

impl Point {
    pub fn new(x: i32) -> Self {
        Point { x, y: 0 }
    }
}

pub fn distance(a: i32, b: i32) -> i32 {
    a - b
}

mod util {}
