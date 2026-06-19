
export function Rng(seed) {
    return (max) => {
        seed = (seed * 9301 + 49297) % 233280;
        let f = seed / 233280;
        if (max !== undefined)
            f = Math.floor(f * max);
        return f;
    };
}

export function MersenneTwister(seed) {
    const MT = new Array(624);
    let index = 0;

    function initialize(seed) {
        MT[0] = seed;
        for (let i = 1; i < 624; i++) {
            MT[i] = (1812433253 * (MT[i - 1] ^ (MT[i - 1] >>> 30)) + i) >>> 0;
        }
    }

    function generate() {
        if (index === 0) {
            for (let i = 0; i < 624; i++) {
                const y = (MT[i] & 0x80000000) + (MT[(i + 1) % 624] & 0x7fffffff);
                MT[i] = MT[(i + 397) % 624] ^ (y >>> 1);
                if (y % 2 !== 0) {
                    MT[i] ^= 0x9908b0df;
                }
            }
        }

        let y = MT[index];
        y ^= (y >>> 11);
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= (y >>> 18);

        index = (index + 1) % 624;
        return (y >>> 0) / 0x100000000;
    }

    initialize(seed);

    return (max) => {
        let f = generate();
        if (max !== undefined)
            f = Math.floor(f * max);
        return f;
    }
}
