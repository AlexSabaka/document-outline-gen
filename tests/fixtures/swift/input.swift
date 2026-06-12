import Foundation

protocol Drawable {
    func draw() -> String
}

class Shape: Drawable {
    var area: Double = 0

    init(area: Double) {
        self.area = area
    }

    func draw() -> String {
        return "shape"
    }

    static func create() -> Shape {
        return Shape(area: 0)
    }
}

struct Point {
    var x: Int = 0
}

enum Color {
    case red
    case green
}

func greet(name: String) -> String {
    return "hi"
}
