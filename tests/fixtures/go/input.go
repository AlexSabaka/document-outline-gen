package geometry

import "fmt"

// Shape is a 2D shape.
type Shape struct {
	Area   float64
	hidden int
}

type Drawable interface {
	Draw() string
}

func NewShape(area float64) *Shape {
	return &Shape{Area: area}
}

func (s *Shape) Describe() string {
	return fmt.Sprintf("%f", s.Area)
}

const Pi = 3.14159
