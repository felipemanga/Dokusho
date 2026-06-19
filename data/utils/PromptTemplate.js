export class PromptTemplate {
    #parts;
    #seed;
    #altSeed;
    #variables;
    #depth;

    input;
    highlight;
    trace;

    constructor(str, debug){
	    this.input = str;
        this.#parts = this.#parse(str, true);
    }

    toString(){
	    return JSON.stringify(this.#parts, null, 0);
    }

    #parse(str, first) {
        let parts = [];
        let paren = 0;
        let min = 1, max = 1, sep = ' ', rng = '';
        let sub;
        let acc = '';
        let arg = '';
	    let call = first ? 'raw' : 'select';
	    let args = '';
        let comment = false;
        for (let i = 0; i < str.length; ++i) {
            let token = str[i];

            if (token == '\n') comment = false;
            // else if (token == '#') comment = '#';
            if (comment) {
		        comment += token;
		        continue;
	        }

            if (token == '{') {
		        if (paren == 0)
		            sub = i;
                paren++;
            } else if (token == '}') {
                paren--;
                if (paren == 0) {
		            parts.push(this.#parse(str.substr(sub + 1, i - sub - 1), false));
                }
            } else if (paren != 0) {
            } else if (token == '$' && str[i+1] == '$' && typeof parts[parts.length - 1] == 'string') {
                ++i
                let arg = parts.pop();
                arg = arg.replace(/^\s*([0-9]+)-([0-9]+)\s*/, (_, a, b) => {
		            min = a;
		            max = b;
                    return '';
                });
		        arg = arg.replace(/^\*$/, _ => {
		            rng = 'alt';
		            return '';
		        });
		        arg = arg.replace(/^\s*([a-z]+)\s*\(\s*(.*)\s*\)\s*$/i, (_, _call, _args) => {
		            call = _call;
		            args = _args;
		            return '';
		        });
                if (arg.length)
                    sep = arg;
		        if (call == 'select')
		            args = `${min},${max},${rng},{${sep}}`;
            } else {
                if (typeof parts[parts.length - 1] != 'string')
                    parts.push('');
                parts[parts.length - 1] += token;
            }
        }
        return {parts, call, args};
    }

    format() {
	    const self = this;
	    return formatInternal(new Ctx({part:this.#parts}));

	    function formatInternal(ctx) {
	        let obj = ctx.part;
	        if (ctx.depth) {
		        // ctx.segs.push('_');
		        let o = '{';
		        if (obj.call == 'select') {
		            let [, min, max, rng, sep] = self.#selectArgs(obj.args);
		            if (min != 1 && max != 1)
			            o += `${min}-${max}$$`;
		            if (rng != '')
			            o += '*$$';
		            if (sep != ' ')
			            o += sep + '$$';
		        } else {
		            o += obj.call + '(' + obj.args + ')' + '$$';
		        }
		        seg(ctx, o);
	        }
	        ctx.segs.push(null);
	        for (let part of obj.parts) {
		        seg(ctx, part);
	        }
	        if (ctx.depth)
		        seg(ctx, '}');
	        return finish(ctx);
	    }

	    function seg(ctx, ...segs) {
	        for (let s of segs) {
		        if (typeof s != 'string') {
		            if (ctx.segs.length)
			            ctx.segs.push(undefined);
		            s = formatInternal(new Ctx({
			            depth: ctx.depth + 1,
			            part: s
		            }));
		            ctx.segs.push(s);
		            ctx.multiline = true;
		        } else {
		            s = self.clean(s);
		            ctx.segs.push(...s.split(/\s*(\|)\s*/).filter(a=>a.length > 0));
		        }
	        }
	    }

	    function finish(ctx) {
	        if (!ctx.multiline)
		        return ctx.segs.filter(a=>a).join(' ');

	        let acc = '';
	        let before = '';
	        const count = ctx.segs.length|0;
	        for (let i = 0; i < count; ++i) {
		        const last = i == count - 1;
		        const seg = ctx.segs[i];
		        if (last && seg == '}') {
		            if (count >= 3)
			            acc += '\n' + ' '.repeat((ctx.depth - 1) * 4) ;
		            acc += '}';
		            continue;
		        }
		        if (seg === null) {
		            before = '\n' + ' '.repeat(ctx.depth * 4);
		            continue;
		        }
		        if (seg === undefined) {
		            if (!before) {
			            let last = acc[acc.length - 1];
			            if (last == ',') {
			                if (ctx.depth == 0)
				                acc += '\n';
			                acc +=  '\n' + ' '.repeat(ctx.depth * 4);
			            }
			            before = '';
		            }
		            continue;
		        }
		        if (seg === '|') {
		            acc += '|';
		            before = '\n' + ' '.repeat(ctx.depth * 4);
		            continue;
		        }
		        acc += before + seg;
		        before = '';
	        }

	        return acc;
	    }

	    function Ctx(init) {
	        let self = Object.assign(this, {
		        depth: 0,
		        multiline: false,
		        segs: [],
		        part:null,
	        }, init);
	    }
    }

    rng(){
	    let state = this.#seed|0;
	    state ^= state << 17;
	    state ^= state >>> 13;
	    state ^= state << 5;
	    this.#seed = state;
	    return (state & 0xFFFF) / (0xFFFF + 1);
    }

    altrng(){
	    let state = this.#altSeed|0;
	    state ^= state << 17;
	    state ^= state >>> 13;
	    state ^= state << 5;
	    this.#altSeed = state;
	    return (state & 0xFFFF) / (0xFFFF + 1);
    }

    clean(str) {
	    return ((str ?? '') + '')
	        .replace(/<\/?(?:lbl|b)([^>]*?)>/ig, '')
	        .replace(/[\s\n,]*,[\s\n]*/g, ', ')
	        .replace(/[\s\n]+/g, ' ')
	        .replace(/\([\s\n]+/g, '(')
	        .replace(/[\s\n]+\)/g, ')')
	        .trim();
    }

    run(seed = Math.random()*(-1>>>0)>>>0, altSeed = Math.random()*(-1>>>0)>>>0, variables = {}) {
	    this.#depth = 0;
	    this.trace = [];
	    this.#seed = seed|0;
	    this.#altSeed = altSeed|0;
	    this.#variables = Object.assign(Object.create(null), variables);
	    this.highlight = this.#runInternal(this.#parts)
	        .replace(/[\s\n,]*,[\s\n]*/g, ', ')
	        .replace(/[\s\n]+/g, ' ')
	        .replace(/\([\s\n]+/g, '(')
	        .replace(/[\s\n]+\)/g, ')');
	    return this.clean(this.highlight);
    }

    #push(info) {
	    this.trace.push(' '.repeat(this.#depth) + info);
    }

    _raw(obj, out) {
	    return out;
    }

    _label(obj, out) {
	    this.#push('Label: ' + obj.args);
	    out = this.#eval(obj, out).trim();
	    return  out.length ? `<lbl arg="${obj.args}">${out}</lbl>` : '';
    }

    _reroll(obj, out, state) {
	    let opts = state.opts ? state.opts : state.opts = out.split('|');
	    let random = this.rng;
	    let r = random.call(this);
	    let pick = opts.length * r | 0;
	    let rsp = opts[pick] ?? '';
	    opts.splice(pick, 1);
	    if (opts.length)
	        state.validate = reroll.bind(this);
	    this.#push(`Roll[${obj.args}=${pick}]: remaining=${opts.length}`);

	    return rsp;

	    function reroll(out) {
	        let clean = this.clean(out);
	        let empty = clean.length == 0;
	        this.#push(empty ? 'Reroll' : `Pass:[${clean}]`);
	        return !empty;
	    }
    }

    #selectArgs(args) {
	    return args.match(/^([0-9]+)\s*,\s*([0-9]+)\s*,\s*([a-z]*)\s*,\s*\{([^}]+)\}$/) ?? [,1,1,'',' '];
    }

    _select(obj, out) {
	    let [, min, max, rng, sep] = this.#selectArgs(obj.args);
	    let random = this[rng + 'rng'];
	    min = min|0;
	    max = max|0;
	    if (max < min)
	        max = min;
	    let opts = out.split('|');
	    out = [];
	    let r = random.call(this);
	    let count = (r*(max - min) + min) | 0;
	    let counts = new Map();
	    for (let i = 0; i < count; ++i) {
	        const pick = opts[random.call(this)*opts.length|0];
	        counts.set(pick, (counts.get(pick)|0) + 1);
	    }
	    for (let [key, value] of counts) {
	        out.push('('.repeat(value - 1) + key + ')'.repeat(value - 1));
	    }
	    out = out.join(sep);
	    if (random != this.rng && out.trim().length)
	        out = `<b>${out}</b>`;
	    return out;
    }

    _set(obj, out) {
	    let varName = obj.args.split(/\s*,\s*/);
	    if (varName) {
	        let v = this.#eval(obj, out);
	        for (let k of varName)
		        this.#variables[k] = v;
	        this.#push(`set ${varName.join(',')} = ${v}`);
	    }
	    return '';
    }

    _echo(obj, out) {
	    let varName = obj.args.split(/\s*,\s*/);
	    let ret = [];
	    for (let k of varName)
	        ret.push(this.#variables[k] ?? '');
	    ret = ret.join(' ');
	    this.#push(`echo ${varName.join(',')} = ${ret}`);
	    return ret;
    }

    _if(obj, out) {
	    let cond = obj.args.split(/\s*,\s*/);
	    let pass = 0;
	    for (let i = 0; i < cond.length; ++i) {
	        let v = this.#variables[cond[i]];
	        if (!v) {
		        pass = 1;
		        break;
	        }
	    }
	    const opts = out.split('|');
	    const rsp = opts[pass] ?? '';
	    this.#push(`if ${cond.map(c=>`${c}[${this.#variables[c]}]`).join(' and ')} -> ${this.clean(rsp)}`);
	    return rsp;
    }

#error(obj) {
	return `Unknown function "${obj.call}"`;
}

    #eval(obj, out) {
	    return out.replace(/\{\?\$\$([0-9]+)\}/g, (_, i) => this.#runInternal(obj.parts[i]));
    }

    #runInternal(obj) {
	    this.#depth++;
	    let out = '';
	    let parts = obj.parts;
	    for (let i = 0; i < parts.length; ++i) {
	        let part = parts[i];
	        if (typeof part == 'string') {
		        out += part;
	        } else out += '{?$$' + i + '}';
		    // out += this.#runInternal(part);
	    }
	    const func = this['_' + obj.call] || this.#error;
	    let validate = null;
	    let state = {};
	    while (true) {
	        state.validate = null;
	        let result = this.#eval(obj, func.call(this, obj, out, state));
	        if (typeof state.validate == 'function' && !state.validate(result)) {
		        continue;
	        }
	        this.#depth--;
	        return result;
	    }
    }
}
