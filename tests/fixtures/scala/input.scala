package geometry

trait Drawable {
  def draw(): String
}

class Shape(val area: Double) extends Drawable {
  def describe(): String = "shape"
  override def draw(): String = "shape"
}

object Registry {
  def create(): Shape = new Shape(0)
}
