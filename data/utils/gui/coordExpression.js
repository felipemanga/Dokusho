export const coordVars = {
    viewportWidth: 800,
    viewportHeight: 600
};

/*
  Expression syntax:
  [!] <term> ([+-/*] <term>)*
    <term> := <number> [unit] | <var> [unit]
    unit   := % | px | w | h | sw | sh
    var    := any string that is a key in coordVars

  Units:
    %: percentage of parent size
    px: pixels (same as no unit)
    w: percentage of own size
    h: percentage of own size
    sw: percentage of screen width
    sh: percentage of screen height

  If the expression starts with '!', it will log debug information about the evaluation process.

  Example usage:
    x = "50% - 50w" // 50% of parent size minus 50% of own size = center self
    x = "!100% - 100w - 10" // right edge of parent minus own width minus 10 pixels = 10 pixels from the right edge of parent, with debug logs
*/

export function coordExpression(expr, node, ss, prop) {
    let verbose = (x) => x;
    if (typeof expr == 'string') {
        expr = expr.trim();
        if (expr[0] == '!') {
            verbose = (x, ...args) => {
                console.log(`Debug "${expr}": ${x} <-`, ...args);
                return x;
            };
            expr = expr.slice(1).trim();
        }
    }
    if ((typeof expr == 'number' && isNaN(expr)) || !expr)
        expr = 0;
    const ret = {
        raw: expr,
        func: () => verbose(0, "Invalid"),
        cache: 0,
        prop
    };
    if (typeof expr === 'number') {
        ret.func = () => expr;
        ret.cache = expr;
        return ret;
    }
    if (!expr)
        return ret;

    if (typeof expr !== 'string')
        throw new Error(`Invalid expression: ${JSON.stringify(expr)}`);

    let parentSize = {v:0}, ownSize = {v:0}, screenSize = {v:coordVars[ss]};

    let A = () => 0;

    let units = {
        '%': v => verbose((v / 100) * parentSize.v, v, parentSize.v, "%"),
        'px': v => v,
        '': v => v,
        'w': v => verbose((v / 100) * ownSize.v, v, ownSize.v, "w"),
        'h': v => verbose((v / 100) * ownSize.v, v, ownSize.v, "h"),
        'sw': v => verbose((v / 100) * screenSize.v, v, screenSize.v, "sw"),
        'sh': v => verbose((v / 100) * screenSize.v, v, screenSize.v, "sh")
    };

    let binops = {
        '+': (a, b) => a + b,
        '-': (a, b) => a - b,
        '*': (a, b) => a * b,
        '/': (a, b) => a / b
    };


    let rep = expr.replace(/\s*([+\-*/]?)\s*([0-9.]+|\S+)\s*(%|px|sw|sh|w|h|)\s*/gi, (_, op, val, unit) => {
        let V = units[unit] ?? (x=>x);
        let B;
        if (val in coordVars) {
            B = () => verbose(V(coordVars[val]), "var", val, "=", coordVars[val]);
        } else {
            let v = parseFloat(val);
            if (!v) B = () => 0;
            else B = () => verbose(V(v), "num", val, "unit", unit);
        }

        let OP = binops[op] ?? ((a, b) => verbose(b));
        let a = A;
        A = () => verbose(OP(a(), B()), "op", op);
        return '';
    });

    ret.func = () => {
        let parent = node.parent
        parentSize.v = parent?.[prop] ?? coordVars[ss];
        ownSize.v = node[prop] ?? 0;
        screenSize.v = coordVars[ss];
        let out = A();
        verbose(out, `parentSize=${parentSize.v}, ownSize=${ownSize.v}, screenSize=${screenSize.v}, parent=${parent?.constructor?.name}, prop=${prop}, parentProp=${parent?.[prop]}, nodeProp=${node[prop]}`);
        // console.log(expr, {parentSize, ownSize, ss:coordVars[ss], out, prop});
        return out;
    };

    ret.cache = ret.func()|0;

    return ret;
}
