package com.example.geometry;

import java.util.List;

/** A shape. */
public abstract class Shape implements Comparable<Shape> {
    public static final double PI = 3.14159;
    private double area;

    public Shape(double area) {
        this.area = area;
    }

    public abstract double area();

    protected static int count() {
        return 0;
    }
}

interface Drawable {
    void draw();
}

enum Color {
    RED,
    GREEN,
    BLUE
}
