using System;
using System.Collections.Generic;

namespace Test.Testing.Classes;

public class TestClass
{
    public bool MethodA(int a, string b)
    {
        return a > b.Length;
    }

    public string MethodB(string b)
    {
        return "Hello " + b;
    }

    public string Property1 => nameof(TestClass);
}