// Expression evaluation is implemented here as a small recursive-descent parser.
package api

import (
	"errors"
	"math"
	"strconv"
	"strings"
	"unicode"
)

var (
	// These sentinel errors let the handler map parser failures to stable API codes.
	errInvalidExpression = errors.New("invalid_expression")
	errDivisionByZero    = errors.New("division_by_zero")
	errResultOutOfRange  = errors.New("result_out_of_range")
)

// calculate parses one complete expression and rejects non-finite results.
func calculate(expression string) (float64, error) {
	if len(expression) > 256 {
		return 0, errInvalidExpression
	}
	p := parser{input: expression}
	value, err := p.parseExpression()
	if err != nil {
		return 0, err
	}
	p.skipSpace()
	if p.pos != len(p.input) {
		return 0, errInvalidExpression
	}
	if math.IsInf(value, 0) || math.IsNaN(value) {
		return 0, errResultOutOfRange
	}
	return value, nil
}

type parser struct {
	// input is the original expression; pos is the next byte to consume.
	input string
	pos   int
}

// skipSpace advances past ASCII whitespace before an operator or token check.
func (p *parser) skipSpace() {
	for p.pos < len(p.input) && unicode.IsSpace(rune(p.input[p.pos])) {
		p.pos++
	}
}

// take consumes want after optional whitespace and reports whether it matched.
func (p *parser) take(want byte) bool {
	p.skipSpace()
	if p.pos < len(p.input) && p.input[p.pos] == want {
		p.pos++
		return true
	}
	return false
}

// parseExpression evaluates left-associative addition and subtraction.
func (p *parser) parseExpression() (float64, error) {
	value, err := p.parseTerm()
	if err != nil {
		return 0, err
	}
	for {
		if p.take('+') {
			right, err := p.parseTerm()
			if err != nil {
				return 0, err
			}
			value, err = finite(value + right)
			if err != nil {
				return 0, err
			}
		} else if p.take('-') {
			right, err := p.parseTerm()
			if err != nil {
				return 0, err
			}
			value, err = finite(value - right)
			if err != nil {
				return 0, err
			}
		} else {
			return value, nil
		}
	}
}

// parseTerm evaluates multiplication and division before addition/subtraction.
func (p *parser) parseTerm() (float64, error) {
	value, err := p.parseUnary()
	if err != nil {
		return 0, err
	}
	for {
		if p.take('*') {
			right, err := p.parseUnary()
			if err != nil {
				return 0, err
			}
			value, err = finite(value * right)
			if err != nil {
				return 0, err
			}
		} else if p.take('/') {
			right, err := p.parseUnary()
			if err != nil {
				return 0, err
			}
			if right == 0 {
				return 0, errDivisionByZero
			}
			value, err = finite(value / right)
			if err != nil {
				return 0, err
			}
		} else {
			return value, nil
		}
	}
}

// parseUnary handles leading signs and then delegates to exponentiation.
func (p *parser) parseUnary() (float64, error) {
	if p.take('+') {
		return p.parseUnary()
	}
	if p.take('-') {
		value, err := p.parseUnary()
		return -value, err
	}
	return p.parsePower()
}

// parsePower evaluates exponentiation; parsing its right side as unary makes ^ right-associative.
func (p *parser) parsePower() (float64, error) {
	value, err := p.parsePostfix()
	if err != nil {
		return 0, err
	}
	if p.take('^') {
		right, err := p.parseUnary()
		if err != nil {
			return 0, err
		}
		value, err = finite(math.Pow(value, right))
		if err != nil {
			return 0, err
		}
	}
	return value, nil
}

// finite rejects NaN and infinity as soon as an operation creates them so a
// later operation cannot mask an invalid intermediate (for example NaN^0).
func finite(value float64) (float64, error) {
	if math.IsInf(value, 0) || math.IsNaN(value) {
		return 0, errResultOutOfRange
	}
	return value, nil
}

// parsePostfix applies each trailing percentage marker by dividing by 100.
func (p *parser) parsePostfix() (float64, error) {
	value, err := p.parsePrimary()
	if err != nil {
		return 0, err
	}
	for p.take('%') {
		value /= 100
	}
	return value, nil
}

// parsePrimary reads a number, parenthesized expression, or sqrt(expression).
func (p *parser) parsePrimary() (float64, error) {
	p.skipSpace()
	if p.pos >= len(p.input) {
		return 0, errInvalidExpression
	}
	if strings.HasPrefix(p.input[p.pos:], "sqrt") {
		p.pos += 4
		if !p.take('(') {
			return 0, errInvalidExpression
		}
		value, err := p.parseExpression()
		if err != nil {
			return 0, err
		}
		if !p.take(')') || value < 0 {
			return 0, errInvalidExpression
		}
		return math.Sqrt(value), nil
	}
	if p.take('(') {
		value, err := p.parseExpression()
		if err != nil {
			return 0, err
		}
		if !p.take(')') {
			return 0, errInvalidExpression
		}
		return value, nil
	}
	start := p.pos
	for p.pos < len(p.input) {
		c := p.input[p.pos]
		if (c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || ((c == '+' || c == '-') && p.pos > start && (p.input[p.pos-1] == 'e' || p.input[p.pos-1] == 'E')) {
			p.pos++
		} else {
			break
		}
	}
	if start == p.pos {
		return 0, errInvalidExpression
	}
	value, err := strconv.ParseFloat(p.input[start:p.pos], 64)
	if err != nil || math.IsInf(value, 0) || math.IsNaN(value) {
		return 0, errInvalidExpression
	}
	return value, nil
}
