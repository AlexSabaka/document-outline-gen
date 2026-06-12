using System;

namespace Geometry
{
    public abstract class Shape : IComparable
    {
        public const double Pi = 3.14159;
        private double _area;

        public Shape(double area)
        {
            _area = area;
        }

        public abstract double Area();

        protected static int Count() => 0;

        public string Name { get; set; }
    }

    public interface IDrawable
    {
        void Draw();
    }

    public enum Color
    {
        Red,
        Green,
        Blue
    }

    public struct Point
    {
        public int X;
        public int Y;
    }
}
