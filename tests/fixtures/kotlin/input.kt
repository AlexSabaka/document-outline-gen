package geometry

interface Drawable {
    fun draw(): String
}

abstract class Shape(val area: Double) : Drawable {
    var name: String = ""

    abstract fun describe(): String

    override fun draw(): String {
        return "shape"
    }
}

fun greet(name: String): String {
    return "hi"
}

object Registry
