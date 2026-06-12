import { Ctrl } from './Ctrl.js';

export class Label extends Ctrl {
    constructor(params = {}) {
        super({node: new SpanNode(), ...params});
        this.lineHeight = this.getAttr('lineHeight', null);
    }

    set lineHeight(value) {
        this.setAttr("lineHeight", value);
    }

    get lineHeight() {
        return this.getAttr("lineHeight", null);
    }

    set maxWidth(value) {
        this.setAttr("maxWidth", value);
    }

    get maxWidth() {
        return this.getAttr("maxWidth", 0);
    }

    set text(text) {
        this.setAttr("text", text);
    }

    get text() {
        return this.getAttr("text", "");
    }

    redraw(state, attrs) {
        this.node.font = attrs.font;
        this.node.text = attrs.text;
        this.node.color = attrs.color;
        if (attrs.lineHeight !== undefined && attrs.lineHeight !== null)
            this.node.lineHeight = attrs.lineHeight;
        this.node.maxWidth = attrs.maxWidth ?? 0;
        super.redraw(state, attrs);
    }
}
