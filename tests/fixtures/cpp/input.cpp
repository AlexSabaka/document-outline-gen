#include <string>

namespace geometry {

class Shape {
public:
    Shape(double area);
    virtual double area() const;
    static int count();

private:
    double area_;
};

enum class Color { Red, Green, Blue };

double distance(double x, double y);

}  // namespace geometry
