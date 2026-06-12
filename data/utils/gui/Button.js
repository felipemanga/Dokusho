import { Ctrl } from './Ctrl.js';
import { Event } from '../EventDispatcher.js';
import { coordVars } from './coordExpression.js';
import { createNinePatchFrame, calculateNinePatchKey } from './FrameCache.js';
import { intToRgba, rgbaToInt, rgbToHsl, hslToRgb } from '../Color.js';

export class Button extends Ctrl {
    #labelNode = new SpanNode();
    #frames = {};

    constructor(params = {}) {
        super({
            node:new Node(),
            containerNode: new NinePatch(),
            state:'',
            width:'autowidth',
            height:'autoheight',
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

        let backgroundColor = this.getAttr('backgroundColor');
        if (backgroundColor !== undefined)
            this.backgroundColor = backgroundColor;
    }

    get text() {return this.getAttr("text");}
    set text(value) {this.setAttr("text", value);}

    set backgroundColor(color) {
        color = color >>> 0;
        const [r, g, b, a] = intToRgba(color);
        const [h, s, l] = rgbToHsl(r, g, b);

        this.setAttr('defaultColor', rgbaToInt(...hslToRgb(h, s, l), a));
        this.setAttr('hoverColor', rgbaToInt(...hslToRgb(h, s, Math.min(1, l + 0.1)), a));
        this.setAttr('pressColor', rgbaToInt(...hslToRgb(h, s, Math.max(0, l - 0.15)), a));
        this.setAttr('disabledColor', rgbaToInt(...hslToRgb(h, Math.max(0, s - 0.3), l), a));

        this.dirtyState();
    }

    redraw(state, attrs) {
        this.#updateLabel(state, attrs);
        this.#updateBackground(state, attrs);
        // this.#centerLabel();
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
        let width = this.finalWidth;
        let height = this.finalHeight;
        frame.setInnerSize(width, height);
        const margins = frame.margins;
        let x = width / 2;
        let y = height / 2;
        this.#labelNode.position = {x, y};
    }

    applyState(state) {
        super.applyState(this.enabled ? state : 'disabled');
    }

    resizeSelf() {
        Object.assign(coordVars, {
            autowidth: (this.#labelNode.width) | 0,
            autoheight: (this.#labelNode.height) | 0
        });
        super.resizeSelf();
        this.#centerLabel();
    }
}
