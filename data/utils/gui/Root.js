import { Group } from './Group.js';
import { nodeMap } from './Ctrl.js';
import GUI from './GUI.js';
import { coordVars } from './coordExpression.js';
import { Event } from '../EventDispatcher.js';

export class Root extends Group {
    static #currentRoot = null;
    #eventListeners = [];
    index = {};

    constructor(params = {}) {
        super({width:'100sw', height:'100sh', ...params});
        this.parent = null; // set #wasInit
        if (params.window)
            this.show(params.window);
    }

    #lastHoveredCtrl = null;
    #mouseDownCtrl = null;
    #resizeHandler = null;
    #caretTickerId = null;

    static getCurrent() {
        return this.#currentRoot;
    }

    #setupGlobalEventListeners() {
        const mouseEvents = ['click', 'mousedown', 'mouseup', 'wheel'];
        const handler = (event) => {
            let picked = this.node.pick(event.x, event.y);
            let clickedCtrl = null;
            while (picked) {
                const ctrl = nodeMap[picked.id];
                if (ctrl && ctrl.enabled) {
                    clickedCtrl = ctrl;
                    break;
                }
                picked = picked.parent;
            }
            
            const focus = GUI.getFocus();
            if (focus.ctrl && focus.ctrl !== clickedCtrl) {
                GUI.setFocus(null, null);
            }
            
            if (clickedCtrl) {
                clickedCtrl.dispatchEvent(new Event(event.type, {...event, bubbles:true}));
            }
            if (event.type == 'mousedown' && clickedCtrl) {
                this.#mouseDownCtrl = clickedCtrl;
                GUI.setFocus(clickedCtrl.node, clickedCtrl);
                clickedCtrl.dispatchEvent(new Event('focus', {}));
            } else if (event.type == 'mouseup' && clickedCtrl && clickedCtrl == this.#mouseDownCtrl && clickedCtrl.enabled !== false) {
                clickedCtrl.dispatchEvent(new Event('click', {...event, bubbles:true}));
            }
        };
        mouseEvents.forEach(eventType => {
            GUI.addEventListener(eventType, handler);
            this.#eventListeners.push({ eventType, handler });
        });

        const hoverHandler = (event) => {
            let picked = this.node.pick(event.x, event.y);
            let hoveredCtrl = null;
            while (picked) {
                const ctrl = nodeMap[picked.id];
                if (ctrl) {
                    hoveredCtrl = ctrl;
                    break;
                }
                picked = picked.parent;
            }

            if (hoveredCtrl !== this.#lastHoveredCtrl) {
                if (this.#lastHoveredCtrl) {
                    this.#lastHoveredCtrl.dispatchEvent(new Event('mouseout', event));
                }
                if (hoveredCtrl) {
                    hoveredCtrl.dispatchEvent(new Event('mouseover', event));
                }
                this.#lastHoveredCtrl = hoveredCtrl;
            }
            if (hoveredCtrl) {
                hoveredCtrl.dispatchEvent(new Event('mousemove', event));
            }
        };
        GUI.addEventListener('mousemove', hoverHandler);
        this.#eventListeners.push({ eventType: 'mousemove', handler: hoverHandler });

        const keyboardEvents = ['keydown', 'keyup', 'textInput', 'textEditing', 'textReplace'];
        const keyboardHandler = (event) => {
            const focus = GUI.getFocus();
            if (focus.ctrl && focus.ctrl.enabled !== false) {
                focus.ctrl.dispatchEvent(new Event(event.type, {...event, bubbles:true}));
            } else {
                this.dispatchEvent(new Event(event.type, {...event, bubbles:true}));
            }
        };
        keyboardEvents.forEach(eventType => {
            GUI.addEventListener(eventType, keyboardHandler);
            this.#eventListeners.push({ eventType, handler });
        });

        this.#resizeHandler = () => this.resize();
        GUI.addEventListener('resize', this.#resizeHandler);
        this.#eventListeners.push({ eventType: 'resize', handler: this.#resizeHandler });
    }

    resize() {
        if (this.window) {
            const {width, height} = this.window;
            coordVars.viewportWidth = width;
            coordVars.viewportHeight = height;
            super.resize();
        }
    }

    #startCaretTicker() {
        if (this.#caretTickerId) return;
        this.#caretTickerId = setInterval(() => {
            const focus = GUI.getFocus();
            if (focus.ctrl && focus.ctrl._caretTick) {
                focus.ctrl._caretTick();
            }
        }, 500);
    }

    #stopCaretTicker() {
        if (this.#caretTickerId) {
            clearInterval(this.#caretTickerId);
            this.#caretTickerId = null;
        }
    }

    #teardownGlobalEventListeners() {
        this.#lastHoveredCtrl = null;
        this.#eventListeners.forEach(({ eventType, handler }) => {
            GUI.removeEventListener(eventType, handler);
        });
        this.#eventListeners = [];
        this.#stopCaretTicker();
    }

    show(window) {
        if (Root.#currentRoot == this)
            return;
        Root.#currentRoot?.hide();
        Root.#currentRoot = this;
        this.#setupGlobalEventListeners();
        this.#startCaretTicker();
        if (window)
            window.node = this.node;
        this.window = window;
        this.root = this;
        this.focus();
        if (window) {
            this.dirtyState();
            this.dirtySize();
            this.#resizeHandler(window);
        }
    }

    hide() {
        this.#teardownGlobalEventListeners();
        this.root = null;
    }

    blurFocused() {
        const focus = GUI.getFocus();
        if (focus.ctrl) {
            focus.ctrl.dispatchEvent(new Event('blur', {}));
        }
    }
}
