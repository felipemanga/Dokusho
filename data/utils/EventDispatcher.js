export class Event {
    bubbles;
    target;
    currentTarget;
    defaultPrevented;
    propagationStopped;

    constructor(type, data = {}) {
        this.type = type;
        this.bubbles = data.bubbles ?? false;
        this.target = null;
        this.currentTarget = null;
        this.relatedTarget = null;
        Object.assign(this, data, {type});
    }

    preventDefault() {
        this.defaultPrevented = true;
    }

    stopPropagation() {
        this.propagationStopped = true;
    }
}

export class EventDispatcher {
    #listeners = new Map();
    #parent = null;
    #self = null;

    set self(self) {
        this.#self = self;
    }

    setParent(parent) {
        this.#parent = parent;
    }

    getParent() {
        return this.#parent;
    }

    getListenerCount(type) {
        let listeners = this.#listeners.get(type);
        return listeners ? listeners.size : 0;
    }

    addEventListener(type, listener) {
        let listeners = this.#listeners.get(type);
        if (!listeners) {
            listeners = new Set();
            this.#listeners.set(type, listeners);
        }
        listeners.add(listener);
    }

    removeEventListener(type, listener) {
        let listeners = this.#listeners.get(type);
        if (listeners) {
            listeners.delete(listener);
            if (listeners.size === 0) {
                this.#listeners.delete(type);
            }
        }
    }

    dispatchEvent(event) {
        if (!event.target) {
            event.target = this.#self;
        }
        const prevCurrentTarget = event.currentTarget;
        event.currentTarget = this.#self;

        let listeners = this.#listeners.get(event.type);
        if (listeners) {
            for (const listener of listeners) {
                listener(event);
                if (event.propagationStopped) {
                    return;
                }
            }
        }
        if (event.bubbles && this.#parent && !event.propagationStopped) {
            this.#parent.dispatchEvent(event);
        }
        event.currentTarget = prevCurrentTarget;
    }
}
