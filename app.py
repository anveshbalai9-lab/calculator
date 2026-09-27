import math
import re

from flask import Flask, jsonify, render_template, request
from sympy import E, Symbol, cos, integrate, log, pi, sin, sqrt, tan
from sympy.parsing.sympy_parser import (
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/calculate", methods=["POST"])
def calculate():
    data = request.get_json(silent=True) or {}
    expression = str(data.get("expression", "")).strip().lower()
    
    try:
        result = evaluate_expression(expression)
        
        return jsonify({
            "success": True,
            "result": str(result),
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Invalid calculation: {str(e)}"
        })


def evaluate_expression(expression):
    expression = normalize_expression(expression)
    integral_match = re.fullmatch(
        r"(?:integral|integrate)\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+)",
        expression,
    )

    transformations = standard_transformations + (implicit_multiplication_application,)
    allowed = {"E": E, "pi": pi, "sin": sin, "cos": cos, "tan": tan, "sqrt": sqrt, "log": log}
    if integral_match:
        function_text, lower_text, upper_text = integral_match.groups()
        function = parse_expr(function_text, local_dict=allowed, transformations=transformations)
        variable = next(iter(function.free_symbols), Symbol("x"))
        lower = parse_expr(lower_text, local_dict=allowed, transformations=transformations)
        upper = parse_expr(upper_text, local_dict=allowed, transformations=transformations)
        result = integrate(function, (variable, lower, upper))
    else:
        result = parse_expr(expression, local_dict=allowed, transformations=transformations)

    if getattr(result, "is_number", False):
        result = result.evalf(10) if not result.is_Integer else result
    return result


def normalize_expression(expression):
    expression = expression.replace("integral of", "integral").replace("integrate of", "integrate")
    replacements = {
        "multiplied by": "*", "times": "*", "plus": "+", "minus": "-",
        "divided by": "/", "divide by": "/", "into": "/",
        "what is": "", "calculate": "", "compute": "",
        "square root of": "sqrt ", "squared": "**2",
    }
    for source, target in replacements.items():
        expression = expression.replace(source, target)
    expression = re.sub(r"(sin|cos|tan)\s*\(?\s*([^()]+?)\s*degrees?\s*\)?", r"\1(pi*\2/180)", expression)
    expression = expression.replace("math.pi", "pi").replace("pie", "pi")
    expression = re.sub(r"\b(one|two|three|four|five|six|seven|eight|nine|ten)\b", lambda match: str({
        "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    }[match.group(1)]), expression)
    return expression.strip()


if __name__ == "__main__":
    app.run(debug=True)

