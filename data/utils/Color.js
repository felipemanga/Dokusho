/**
 * Convert 32-bit int (0xAARRGGBB) to [r, g, b, a]
 */
export function intToRgba(color) {
    return [
        (color >> 16) & 0xFF,
        (color >> 8) & 0xFF,
        color & 0xFF,
        (color >> 24) & 0xFF
    ];
}

/**
 * Convert [r, g, b, a] to 32-bit int (0xAARRGGBB)
 */
export function rgbaToInt(r, g, b, a = 255) {
    return ((a & 0xFF) << 24) | ((r & 0xFF) << 16) | ((g & 0xFF) << 8) | (b & 0xFF);
}

/**
 * Convert RGB (0-255) to HSL (h: 0-360, s: 0-1, l: 0-1)
 */
export function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
        return [0, 0, l];
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h;
    switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
    }

    return [h * 360, s, l];
}

/**
 * Convert HSL (h: 0-360, s: 0-1, l: 0-1) to RGB (0-255)
 */
export function hslToRgb(h, s, l) {
    h /= 360;

    if (s === 0) {
        const v = Math.round(l * 255);
        return [v, v, v];
    }

    const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const r = hue2rgb(p, q, h + 1/3);
    const g = hue2rgb(p, q, h);
    const b = hue2rgb(p, q, h - 1/3);

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const colorOps = [
    { // int
        normalize(data) {return data >>> 0;},
        getAlpha(data) {return (data >> 24) & 0xFF;},
        setAlpha(data, a) {return (data & 0x00FFFFFF) | ((a & 0xFF) << 24);},
        toInt(data) {return data >>> 0;},
        toRGBA(data) {
            const [r, g, b, a] = intToRgba(data >>> 0);
            return {r, g, b, a};
        },
        toHSLA(data) {
            const [r, g, b, a] = intToRgba(data >>> 0);
            const [h, s, l] = rgbToHsl(r, g, b);
            return {h, s, l, a};
        }
    },
    { // {r, g, b, a}
        normalize(data) {
            if (typeof data === 'number')
                data = intToRgba(data);
            if (Array.isArray(data)) {
                const [r, g, b, a] = data;
                data = {r, g, b, a};
            }
            if (!data || typeof data != 'object')
                data = {};
            return {
                r: Number(data.r) || 0,
                g: Number(data.g) || 0,
                b: Number(data.b) || 0,
                a: Number(data.a) || 0
            };
        },
        getAlpha(data) {return data.a;},
        setAlpha(data, a) {return {...data, a};},
        toInt(data) {return rgbaToInt(data.r, data.g, data.b, data.a);},
        toRGBA(data) {
            return data;
        },
        toHSLA(data) {
            const [h, s, l] = rgbToHsl(data.r, data.g, data.b);
            return {h, s, l, a: data.a};
        }
    },
    { // {h, s, l, a}
        normalize(data) {
            if (typeof data === 'number') {
                const [r, g, b, a] = intToRgba(data);
                const [h, s, l] = rgbToHsl(r, g, b);
                data = {h, s, l, a};
            } else if (Array.isArray(data)) {
                const [h, s, l, a] = data;
                data = {h, s, l, a};
            } else if (data && typeof data === 'object' && ('r' in data || 'g' in data || 'b' in data)) {
                const [h, s, l] = rgbToHsl(data.r || 0, data.g || 0, data.b || 0);
                data = {h, s, l, a: data.a ?? 255};
            } else if (!data || typeof data !== 'object') {
                data = {};
            }
            return {
                h: Number(data.h) || 0,
                s: Number(data.s) || 0,
                l: Number(data.l) || 0,
                a: Number(data.a) || 0
            };
        },
        getAlpha(data) {return data.a;},
        setAlpha(data, a) {return {...data, a};},
        toInt(data) {
            const [r, g, b] = hslToRgb(data.h, data.s, data.l);
            return rgbaToInt(r, g, b, data.a);
        },
        toRGBA(data) {
            const [r, g, b] = hslToRgb(data.h, data.s, data.l);
            return {r, g, b, a: data.a};
        },
        toHSLA(data) {
            return data;
        }
    }
];

export class Color {
    #data = 0;
    #ops = null; // 0:int, 1:{r, g, b, a?}, 2: {h, s, l, a}

    constructor(data, type) {
        this.#data = data;
        this.#init(type >>> 0);
    }

    #init(type) {
        if (type < 0 || type >= colorOps.length)
            throw new Error(`Invalid Color Type: ${type}`);
        this.#ops = colorOps[type];
        this.#data = this.#ops.normalize(this.#data);
    }

    toInt() {
        return this.#ops.toInt(this.#data);
    }

    toRGBA() {
        return this.#ops.toRGBA(this.#data);
    }

    toHSLA() {
        return this.#ops.toHSLA(this.#data);
    }

    hueShift(angle) {
        const {h, s, l, a} = this.toHSLA();
        const shiftedH = ((h + angle) % 360 + 360) % 360;
        return Color.fromHSLA({h: shiftedH, s, l, a});
    }

    saturationMul(factor) {
        const {h, s, l, a} = this.toHSLA();
        const shiftedS = Math.min(1, Math.max(0, s * factor));
        return Color.fromHSLA({h, s: shiftedS, l, a});
    }

    luminanceMul(factor) {
        const {h, s, l, a} = this.toHSLA();
        const shiftedL = Math.min(1, Math.max(0, l * factor));
        return Color.fromHSLA({h, s, l: shiftedL, a});
    }

    alphaMul(factor) {
        const a = this.#ops.getAlpha(this.#data);
        const shiftedA = Math.min(255, Math.max(0, Math.round(a * factor)));
        return new Color(this.#ops.setAlpha(this.#data, shiftedA), colorOps.indexOf(this.#ops));
    }

    setAlpha(a) {
        return new Color(this.#ops.setAlpha(this.#data, a & 0xFF), colorOps.indexOf(this.#ops));
    }

    setLightness(target) {
        const {h, s, l, a} = this.toHSLA();
        return Color.fromHSLA({h, s, l: Math.min(1, Math.max(0, target)), a});
    }

    setSaturation(target) {
        const {h, s, l, a} = this.toHSLA();
        return Color.fromHSLA({h, s: Math.min(1, Math.max(0, target)), l, a});
    }

    lighten(steps) {
        const {l} = this.toHSLA();
        return this.setLightness(l + steps);
    }

    darken(steps) {
        const {l} = this.toHSLA();
        return this.setLightness(l - steps);
    }

    complementary() {
        return this.hueShift(180);
    }

    splitComplementary(side = 1) {
        return this.hueShift(side > 0 ? 150 : 210);
    }

    analogous(offset = 30) {
        return this.hueShift(offset);
    }

    triadic(index = 1) {
        return this.hueShift(index * 120);
    }

    tetradic(offset = 30) {
        return this.hueShift(180 + offset);
    }

    static fromInt(color) {
        return new Color(color, 0);
    }

    static fromRGBA(rgba) {
        return new Color(rgba, 1);
    }

    static fromHSLA(hsla) {
        return new Color(hsla, 2);
    }
}
export function rgbaToObject([r, g, b, a]) {return {r, g, b, a};}
export function intToObject(rgba) {return rgbaToObject(intToRgba(rgba));}
