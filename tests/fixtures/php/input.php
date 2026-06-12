<?php

namespace App\Geometry;

interface Drawable
{
    public function draw(): string;
}

class Shape implements Drawable
{
    private float $area;

    public function __construct(float $area)
    {
        $this->area = $area;
    }

    public function draw(): string
    {
        return "shape";
    }
}

function greet(string $name): string
{
    return "hi";
}
