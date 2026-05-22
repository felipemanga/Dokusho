import { Ctrl } from './Ctrl.js';
import { Event } from '../EventDispatcher.js';
import { createNinePatchFrame, calculateNinePatchKey } from './FrameCache.js';

export class Button extends Ctrl {
    #labelNode = new SpanNode();
    #frames = {};

    constructor(params = {}) {
        super({
            node:new Node(),
            containerNode: new NinePatch(),
            state:'',
            states: ['default', 'hover', 'press', 'disabled']}, params);

        const node = this.node;
        node.addChild(this.containerNode);

        node.addChild(this.#labelNode);
        this.#labelNode.setAnchor(0.5, 0.5);
        this.#labelNode.text = params.text ?? 'Button';

        this.addEventListener('mouseover', () => this.state = 'hover');
        this.addEventListener('mouseout', () => this.state = 'default');
        this.addEventListener('mousedown', () => this.state = 'press');
        this.addEventListener('mouseup', () => this.state = 'hover');
    }

    get text() {return this.getAttr("text");}
    set text(value) {this.setAttr("text", value);}

    redraw(state, attrs) {
        this.#updateLabel(state, attrs);
        this.#updateBackground(state, attrs);
        this.#centerLabel();
    }

    #updateLabel(state, attrs) {
        this.#labelNode.text = attrs.text;
        this.#labelNode.font = attrs.font;
        this.#labelNode.color = attrs.textColor ?? 0xFF000000;
    }

    #updateBackground(state, attrs) {
        let frameAttrs = attrs;

        switch (state) {
        case '':
        case 'default':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.defaultColor,
                elevation: attrs.defaultElevation ?? 1
            };
            break;
        case 'hover':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.hoverColor,
                elevation: attrs.hoverElevation ?? 2
            };
            break;
        case 'press':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.pressColor,
                elevation: attrs.pressElevation ?? -2
            }
            break;
        case 'disabled':
            frameAttrs = {
                ...attrs,
                backgroundColor: attrs.disabledColor,
                elevation: attrs.disabledElevation ?? -1
            }
            break;
        }

        let key = calculateNinePatchKey(frameAttrs);
        let frame = this.#frames[state];
        if (!frame || frame.key !== key) {
            frame = createNinePatchFrame(frameAttrs);
            this.#frames[state] = frame;
        }

        let background = this.containerNode;
        background.image = frame.image;
        background.margins = frame.margins;
        background.position = {
            x: -attrs.marginLeft - attrs.paddingLeft,
            y: -attrs.marginTop - attrs.paddingTop
        };
    }

    #centerLabel() {
        const frame = this.containerNode;
        if (!frame) return;
        let innerWidth = (this.#labelNode.width) | 0;
        let innerHeight = (this.#labelNode.height) | 0;
        this.containerNode.setInnerSize(innerWidth, innerHeight);
        const frameWidth = frame.width;
        const frameHeight = frame.height;
        const margins = frame.margins;
        let x = (frameWidth - margins.left - margins.right) / 2;
        let y = (frameHeight - margins.top - margins.bottom) / 2;
        this.#labelNode.position = {x, y};
    }

    applyState(state) {
        super.applyState(this.enabled ? state : 'disabled');
    }

    resize() {
        super.resize();
        this.#centerLabel();
    }
}
