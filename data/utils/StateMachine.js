import {eventBus} from './EventBus.js';

export class StateMachine {
    #states = new Map();
    #state;
    #nextStateName;

    applyState() {
        if (!this.#nextStateName)
            return;
        const ctor = this.#states.get(this.#nextStateName);
        if (!ctor)
            return;
        this.#nextStateName = null;
        const nextState = new ctor();
        const oldState = this.#state;
        this.#state = nextState;
        eventBus.add(nextState);
        if (oldState) {
            eventBus.remove(oldState);
            if (typeof oldState.exit == 'function')
                oldState.exit();
        }
    }

    setState(name) {
        this.#nextStateName = name;
    }

    addState(ctor) {
        const name = ctor.name;
        console.log('Adding state', name);
        this.#states.set(name, ctor);
    }
}
