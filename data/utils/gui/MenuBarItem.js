import { Ctrl } from './Ctrl.js';
import { Event } from '../EventDispatcher.js';

export class MenuBarItem extends Ctrl {
    labelNode;

    constructor(params = {}) {
        super({
            node: new Node(),
            containerNode: new Node(),
            state: '',
            states: ['default', 'hover', 'press', 'disabled'],
            floating: true,
            ...params
        });

        const labelNode = new SpanNode();
        labelNode.text = this.attrs.label ?? '';
        labelNode.setAnchor(0.0, 0.25);
        this.node.addChild(labelNode);

        this.labelNode = labelNode;

        this.addEventListener('mouseover', () => {
            if (this.enabled) this.state = 'hover';
        });
        this.addEventListener('mouseout', () => {
            this.state = 'default';
        });
        this.addEventListener('mousedown', () => {
            if (this.enabled) this.state = 'press';
        });
        this.addEventListener('mouseup', () => {
            if (this.enabled) this.state = 'hover';
        });
    }
}
