import { Ctrl } from './Ctrl.js';
import { Event } from '../EventDispatcher.js';
import { calculateNinePatchKey, createNinePatchFrame } from './FrameCache.js';

export class MenuItem extends Ctrl {
    #backgroundNode = new NinePatch();
    #labelNode = new SpanNode();
    #shortcutNode = new SpanNode();
    #frames = {};

    constructor(params = {}) {
        super({
            node: new Node(),
            containerNode: new Node(),
            state: '',
            states: ['default', 'hover', 'press', 'disabled'],
            floating: true,
            ...params
        });

        const node = this.node;
        node.addChild(this.#backgroundNode);
        node.addChild(this.#labelNode);
        node.addChild(this.#shortcutNode);
        
        this.#labelNode.setAnchor(0, 0.5);
        this.#shortcutNode.setAnchor(1, 0.5);
        
        this.addEventListener('mouseover', () => this.state = 'hover');
        this.addEventListener('mouseout', () => this.state = 'default');
        this.addEventListener('mousedown', () => this.state = 'press');
        this.addEventListener('mouseup', () => this.state = 'hover');
    }

    get innerWidth() {
        return this.#labelNode.width + (this.attrs.gap ?? 10) + this.#shortcutNode.width;
    }

    get label() { return this.getAttr("label"); }
    set label(value) { this.setAttr("label", value); }

    get shortcut() { return this.getAttr("shortcut"); }
    set shortcut(value) { this.setAttr("shortcut", value); }

    redraw(state, attrs) {
        this.#updateLabel(state, attrs);
        this.#updateShortcut(state, attrs);
        this.#updateBackground(state, attrs);
    }

    #updateLabel(state, attrs) {
        this.#labelNode.text = attrs.label ?? '';
        this.#labelNode.font = attrs.font;
        this.#labelNode.color = attrs.itemTextColor ?? 0xFF000000;
    }

    #updateShortcut(state, attrs) {
        this.#shortcutNode.text = attrs.shortcut ?? '';
        this.#shortcutNode.font = attrs.font;
        this.#shortcutNode.color = attrs.itemTextColor ?? 0xFF000000;
        this.#shortcutNode.opacity = attrs.shortcut ? 0.7 : 0;
    }

    #updateBackground(state, attrs) {
        let frameAttrs = attrs;

        switch (state) {
        case '':
        case 'default':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.itemColor
            };
            break;
        case 'hover':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.itemHoverColor
            };
            break;
        case 'press':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.itemPressColor
            };
            break;
        case 'disabled':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.itemDisabledColor
            };
            break;
        }

        let key = calculateNinePatchKey(frameAttrs);
        let frame = this.#frames[state];
        if (!frame || frame.key !== key) {
            frame = createNinePatchFrame(frameAttrs);
            this.#frames[state] = frame;
        }

        this.#backgroundNode.image = frame.image;
        this.#backgroundNode.margins = frame.margins;
        this.#backgroundNode.setInnerSize(this.finalWidth, this.finalHeight);
        this.#backgroundNode.position = {
            x: -frame.margins.left,
            y: -frame.margins.top
        };
    }

    applyState(state) {
        super.applyState(this.enabled ? state : 'disabled');
    }

    resize() {
        super.resize();
        const labelWidth = this.#labelNode.width + 8;
        const shortcutWidth = this.#shortcutNode.width + 8;
        
        this.#labelNode.position = { x: 4, y: this.finalHeight / 2 };
        this.#shortcutNode.position = { x: this.finalWidth - 4, y: this.finalHeight / 2 };
    }
}
