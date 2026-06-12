module Geometry
  class Shape
    def initialize(area)
      @area = area
    end

    def describe
      "shape"
    end

    def self.create
      new(0)
    end
  end
end

def greet(name)
  "hi"
end
