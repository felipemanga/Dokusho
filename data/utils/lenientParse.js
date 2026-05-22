
class LenientJSONParser {
    constructor(str, config) {
        this.str = str;
        this.pos = 0;
        this.config = config;
        this.length = str.length;
    }

    /**
     * Public entry point
     */
    parseValue() {
        this.skipWhitespace();

        if (this.pos >= this.length) return null;

        const char = this.peek();

        if (char === '{') return this.parseObject();
        if (char === '[') return this.parseArray();
        if (char === '"' || char === "'") return this.parseString();
        if (char === '-' || (char >= '0' && char <= '9')) return this.parseNumber();

        // Literal: null, true, false
        if (char === 'n' || char === 't' || char === 'f') return this.parseLiteral();

        // Unquoted Key (object value context) - treated as string fallback
        if (this.config.unquotedKeys && (char >= 'a' && char <= 'z') || char === '_') {
            // It might be an unquoted key or a bare value like "hello".
            // We try to parse it as a string/identifier.
            try {
                // Peek ahead to see if it looks like a number or object start
                if (this.peekN(3) === 'inf') return this.parseInfinity();
                if (this.peekN(4) === 'null') return 'null'; // Fallback
                if (this.peekN(4) === 'true') return true; // Fallback
                if (this.peekN(5) === 'false') return false; // Fallback

                // Otherwise treat as a string value
                return this.parseIdentifier();
            } catch (e) {
                return null;
            }
        }

        // Fallback: try to parse as string if char is unknown or quote mismatch
        return this.parseString();
    }

    /**
     * Parses an Object { key: value, ... }
     */
    parseObject() {
        this.consume('{');
        const result = {};
        this.skipWhitespace();

        // Handle empty object
        if (this.peek() === '}') {
            this.consume('}');
            return result;
        }

        while (this.pos < this.length) {
            this.skipWhitespace();

            // Key
            let key = null;
            if (this.peek() === '"' || this.peek() === "'") {
                key = this.parseString();
            } else if (this.config.unquotedKeys) {
                key = this.parseIdentifier();
            } else {
                // Try to parse a quoted key, or skip if broken
                key = this.parseString();
            }

            this.skipWhitespace();

            // Expect Colon
            if (this.peek() === ':') {
                this.consume(':');
                this.skipWhitespace();

                // Value
                try {
                    result[key] = this.parseValue();
                } catch (e) {
                    result[key] = null; // Recover
                }

                this.skipWhitespace();

                // Comma or End
                if (this.peek() === ',') {
                    this.consume(',');
                    this.skipWhitespace();
                    // Check for trailing comma
                    if (this.peek() === '}') break;
                } else if (this.peek() === '}') {
                    break; // End reached (even if no comma)
                } else {
                    // Missing comma or unexpected token
                    // Try to recover by skipping to next valid key or end
                    this.skipToDelimiter();
                    if (this.peek() === '}') break;
                }
            } else {
                // No colon found, treat key as the whole pair (mimic loose JS object literal)
                // e.g., { key: } -> treat as { "key": null }
                this.skipWhitespace();
                if (this.peek() === ',') {
                    this.consume(',');
                    this.skipWhitespace();
                    if (this.peek() === '}') break;
                } else if (this.peek() === '}') {
                    break;
                }
            }

            if (this.peek() === '}') {
                this.consume('}');
                break;
            }
        }

        // Recovery: If '}' is missing, consume to end
        if (this.peek() !== '}') {
            // Try to find closing brace, or just consume rest
            while(this.pos < this.length && this.str[this.pos] !== '}') {
                this.pos++;
            }
            this.consume('}', true);
        }

        return result;
    }

    /**
     * Parses an Array [ value, ... ]
     */
    parseArray() {
        this.consume('[');
        const result = [];
        this.skipWhitespace();

        if (this.peek() === ']') {
            this.consume(']');
            return result;
        }

        while (this.pos < this.length) {
            this.skipWhitespace();

            try {
                result.push(this.parseValue());
            } catch (e) {
                result.push(null);
            }

            this.skipWhitespace();

            if (this.peek() === ',') {
                this.consume(',');
                this.skipWhitespace();
                // Trailing comma check
                if (this.peek() === ']') break;
            } else if (this.peek() === ']') {
                break;
            } else {
                // Unexpected token
                this.skipToDelimiter();
                if (this.peek() === ']') break;
            }
        }

        // Recovery
        if (this.peek() !== ']') {
            while(this.pos < this.length && this.str[this.pos] !== ']') {
                this.pos++;
            }
            this.consume(']', true);
        }

        return result;
    }

    /**
     * Parses String "value" or 'value'
     */
    parseString() {
        const quote = this.consume(); // " or '

        if (quote !== '"' && quote !== "'") {
            // If we didn't start with a quote, maybe it's an identifier acting as a string
            this.pos--;
            return this.parseIdentifier();
        }

        let result = '';
        let escape = false;

        while (this.pos < this.length) {
            const char = this.str[this.pos++];

            if (escape) {
                result += char;
                escape = false;
                continue;
            }

            if (char === '\\') {
                escape = true;
                continue;
            }

            if (char === quote) {
                // String ended successfully
                return result;
            }

            result += char;
        }

        // Recovery: Quote never closed
        // We return whatever we collected so far (and consume the rest of the string)
        return result;
    }

    /**
     * Parses Number
     */
    parseNumber() {
        let numStr = '';
        let sign = 1;

        if (this.peek() === '-') {
            sign = -1;
            numStr += this.consume();
        } else if (this.peek() === '+') {
            numStr += this.consume();
        }

        let isFloat = false;
        while (this.pos < this.length) {
            const char = this.str[this.pos];
            if ((char >= '0' && char <= '9') || char === '.') {
                if (char === '.') isFloat = true;
                numStr += this.consume();
            } else if (char === 'e' || char === 'E') {
                numStr += this.consume();
                // Exponent sign
                const expChar = this.peek();
                if (expChar === '-' || expChar === '+') {
                    numStr += this.consume();
                }
                // Exponent digits
                while (this.pos < this.length && (this.str[this.pos] >= '0' && this.str[this.pos] <= '9')) {
                    numStr += this.consume();
                }
                break;
            } else {
                break;
            }
        }

        if (numStr === '-' || numStr === '' || numStr === '.') return null;

        return Number(numStr) * sign;
    }

    /**
     * Parses Literals: true, false, null
     */
    parseLiteral() {
        const lower = this.peek();

        if (lower === 'n' || lower === 'N') {
            this.consume('n');
            this.skipTo('u', 'e');
            this.consume('l'); this.consume('l');
            return null;
        }
        if (lower === 't' || lower === 'T') {
            this.consume('t');
            this.consume('r'); this.consume('u'); this.consume('e');
            return true;
        }
        if (lower === 'f' || lower === 'F') {
            this.consume('f');
            this.consume('a'); this.consume('l'); this.consume('s'); this.consume('e');
            return false;
        }

        // If it doesn't match, treat as string/identifier
        return this.parseIdentifier();
    }

    parseIdentifier() {
        let id = '';
        while (this.pos < this.length) {
            const char = this.str[this.pos];
            if (char === ' ' || char === '\n' || char === ',' || char === '{' || char === '}' || char === ']') break;
            id += this.consume();
        }
        return id || null;
    }

    /**
     * Special handling for Infinity, NaN, Undefined
     */
    parseInfinity() {
        const s = this.str.substring(this.pos);
        if (s.startsWith('Infinity')) {
            this.pos += 8; // skip Infinity
            return Number.POSITIVE_INFINITY;
        }
        if (s.startsWith('NaN')) {
            this.pos += 3; // skip NaN
            return NaN;
        }
        if (s.startsWith('undefined')) {
            this.pos += 9; // skip undefined
            return null; // Map undefined to null
        }
        return this.parseIdentifier();
    }

    // --- Utilities ---

    skipWhitespace() {
        while (this.pos < this.length) {
            const char = this.str[this.pos];
            // Skip comments
            if (this.config.skipComments) {
                if (char === '/' && this.peek(1) === '/') {
                    while (this.pos < this.length && this.str[this.pos] !== '\n') this.pos++;
                    continue;
                }
                if (char === '/' && this.peek(1) === '*') {
                    this.pos += 2;
                    while (this.pos < this.length) {
                        if (this.str[this.pos] === '*' && this.str[this.pos+1] === '/') {
                            this.pos += 2;
                            break;
                        }
                        this.pos++;
                    }
                    continue;
                }
            }

            if (/\s/.test(char)) {
                this.pos++;
            } else {
                break;
            }
        }
    }

    consume(expected = null, silent = false) {
        if (this.pos >= this.length) {
            if (!silent) throw new Error('Unexpected end of input');
            return null;
        }

        const char = this.str[this.pos];

        if (expected !== null && char !== expected) {
            // Lenient: Don't throw, just skip if expected doesn't match
            return char;
        }

        this.pos++;
        return char;
    }

    peek(index = 0) {
        const pos = this.pos + index;
        return pos < this.length ? this.str[pos] : null;
    }

    // Check if there are characters remaining
    hasMore() {
        return this.pos < this.length;
    }

    // Helper to skip to delimiter in error recovery
    skipToDelimiter() {
        // Try to jump to comma or closing bracket
        while (this.pos < this.length) {
            const char = this.str[this.pos];
            if (char === ',' || char === ']' || char === '}') {
                return char;
            }
            this.pos++;
        }
        return null;
    }

    // Peek N characters
    peekN(n) {
        return this.str.substring(this.pos, this.pos + n);
    }
}

/**
 * A lenient JSON parser that recovers from syntax errors rather than throwing.
 * @param {string} str - The JSON-like string to parse.
 * @param {Object} [options] - Options object.
 * @param {boolean} [options.skipComments=true] - Whether to remove JS-style comments.
 * @param {boolean} [options.unquotedKeys=true] - Whether to allow keys without quotes.
 * @returns {any|null} - The parsed object, array, or primitive, or null if completely unparsable.
 */
export function lenientParse(str, options = {}) {
    if (typeof str !== 'string') {
        return typeof str; // Return the non-string value as-is if it's passed in
    }

    try {
        return JSON.parse(str);
    } catch (ex){}

    const config = {
        skipComments: true,
        unquotedKeys: true,
        ...options
    };

    const parser = new LenientJSONParser(str, config);

    try {
        const result = parser.parseValue();
        if (parser.hasMore()) {
            // If there is leftover garbage after parsing a valid root, ignore it
            // (e.g., "123 some random text")
            parser.skipWhitespace();
        }
        return result;
    } catch (e) {
        // In case of catastrophic failure, return null
        return null;
    }
}
