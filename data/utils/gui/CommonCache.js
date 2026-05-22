export class CommonCache {
    constructor(limit = 100) {
        this.cache = new Map();
        this.limit = limit;
    }

    setLimit(newLimit) {
        this.limit = newLimit;
        this.evictLRU();
    }

    get(key) {
        const value = this.cache.get(key);
        if (value !== undefined) {
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.limit) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    has(key) {
        return this.cache.has(key);
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    evictLRU() {
        while (this.cache.size >= this.limit) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    get size() {
        return this.cache.size;
    }
}
