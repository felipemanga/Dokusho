import { Ctrl } from './Ctrl.js';

export class Label extends Ctrl {
    constructor(params = {}) {
        super({node: new SpanNode(), ...params});
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
        super.redraw(state, attrs);
    }
}
