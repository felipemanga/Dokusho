export const eventBus = new class EventBus {
    #map = new Map();
    #listeners = new Map();

    add(listener) {
        if (!listener || typeof listener !== 'object') {
            throw new Error('Listener must be an object');
        }
        if (this.#listeners.has(listener))
            return;
        let props = Object.getOwnPropertyNames(Object.getPrototypeOf(listener));
        this.#listeners.set(listener, props);
        // console.log('Adding listener',
        //             listener.constructor.name + ':',
        //             props.filter(p => typeof listener[p] === 'function').join(', '));
        for (let prop of props) {
            if (prop === 'constructor' || typeof listener[prop] !== 'function') continue;
            if (!this.#map.has(prop)) {
                this.#map.set(prop, new Map());
            }
            this.#map.get(prop).set(listener, listener[prop].bind(listener));
        }
    }

    remove(listener) {
        if (!listener || typeof listener !== 'object') {
            return;
        }
        if (!this.#listeners.has(listener)) {
            throw new Error('Listener not found');
        }
        let props = this.#listeners.get(listener);
        this.#listeners.delete(listener);
        for (let prop of props) {
            if (prop === 'constructor' || typeof listener[prop] !== 'function') continue;
            if (this.#map.has(prop)) {
                this.#map.get(prop).delete(listener);
                if (this.#map.get(prop).size === 0) {
                    this.#map.delete(prop);
                }
            }
        }
    }

    emit(event, ...args) {
        const listeners = this.#map.get(event);
        if (!listeners)
            return;
        for (let listener of listeners.values()) {
            listener(...args);
        }
    }
}
