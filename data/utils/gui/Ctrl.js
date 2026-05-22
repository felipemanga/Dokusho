import { getThemeForControl } from './Themes.js';
import { Event, EventDispatcher } from '../EventDispatcher.js';
import { coordVars, coordExpression } from './coordExpression.js';
import { createNinePatchFrame } from './FrameCache.js';
import GUI from './GUI.js';

export let nextNodeId = 1;
export const nodeMap = Object.create(null);

export class Ctrl {
    #node;
    #containerNode;
    #eventDispatcher = new EventDispatcher();
    #children = [];
    #states = {};
    #state = undefined;
    #attrs = {}
    #wasInit = false;
    #enabled = true;
    #root = null;

    constructor(...args) {
        const baseState = Object.assign({}, ...args);
        let {
            node,
            containerNode = node,
            children = [],
            classes = [],
            states = [],
            state = "",
            enabled = true,
            visible = true,
            floating = false,
            id = 'ctrl-' + nextNodeId++,
            verbose = false
        } = baseState;

        this.#eventDispatcher.self = this;
        this.#node = node;
        this.#containerNode = containerNode;
        this.#enabled = enabled;
        this.#node.id = id;

        for (let state of states)
            this.#states[state] = getThemeForControl(this, [...classes, state], baseState);
        this.#states[""] = getThemeForControl(this, classes, baseState);
        this.state = state;

        this.onFocus = baseState.onFocus ?? null;
        this.onBlur = baseState.onBlur ?? null;
        this.onKeyDown = baseState.onKeyDown ?? null;
        this.onMouseEnter = baseState.onMouseEnter ?? null;
        this.onMouseLeave = baseState.onMouseLeave ?? null;
        this.onMouseDown = baseState.onMouseDown ?? null;
        this.onMouseUp = baseState.onMouseUp ?? null;
        this.onClick = baseState.onClick ?? null;

        this.addEventListener('focus', (...args) => this.onFocus && this.onFocus(...args));
        this.addEventListener('blur', (...args) => this.onBlur && this.onBlur(...args));
        this.addEventListener('keydown', (...args) => this.onKeyDown && this.onKeyDown(...args));
        this.addEventListener('mouseover', (...args) => this.onMouseEnter && this.onMouseEnter(...args));
        this.addEventListener('mouseout', (...args) => this.onMouseLeave && this.onMouseLeave(...args));
        this.addEventListener('mousedown', (...args) => this.onMouseDown && this.onMouseDown(...args));
        this.addEventListener('mouseup', (...args) => this.onMouseUp && this.onMouseUp(...args));
        this.addEventListener('click', (...args) => {this.onClick && this.onClick(...args)});

        children.forEach(child => this.addChild(child));

        this.x = this.getAttr('x', 0);
        this.y = this.getAttr('y', 0);
        this.anchorX = this.getAttr('anchorX', 0);
        this.anchorY = this.getAttr('anchorY', 0);
        this.scaleX = this.getAttr('scaleX', 1);
        this.scaleY = this.getAttr('scaleY', 1);
        this.width = this.getAttr('width', 'auto');
        this.height = this.getAttr('height', 'auto');
        this.color = this.getAttr('color', 0xFFFFFFFF);
        this.visible = this.getAttr('visible', true);
        this.floating = this.getAttr('floating', false);

        if (verbose) {
            console.log(`Created control ${this.node.id} at (${baseState.x ?? 0}, ${baseState.y ?? 0}) with scale (${baseState.scaleX ?? 1}, ${baseState.scaleY ?? 1})`);
            console.log(`    classes: ${this.attrs.allClasses?.join(' ') ?? ''}`);
            console.log(`    state: "${this.state}"`);
            console.log(`    attributes:`, JSON.stringify(Object.assign({}, this.attrs, this.#attrs), null, 2));
        }
    }

    printDebug(depth = 0) {
        let indent = '  '.repeat(depth);
        console.log(`${indent}${this.constructor.name} (id: ${this.node.id}, state: "${this.state}", enabled: ${this.enabled})`);
        console.log(`${indent}  position: (${this.finalX}, ${this.finalY}), size: (${this.finalWidth}, ${this.finalHeight}), scale: (${this.finalScaleX}, ${this.finalScaleY}), anchor: (${this.finalAnchorX}, ${this.finalAnchorY})`);
        let scaleX = this.finalScaleX ?? 1;
        let scaleY = this.finalScaleY ?? 1;
        let stop = this.parent?.node;
        let parent = this.node.parent;
        while (parent && parent !== stop) {
            if (parent instanceof ClippingNode) {
                let size = parent.size();
                console.log(`${indent}  clip ${parent.id} bounds: (${size.width}, ${size.height})`);
            }
            let scale = parent.scale();
            scaleX *= scale.x;
            scaleY *= scale.y;
            console.log(`${indent}  parent ${parent.id} scale: (${scaleX ?? 1}, ${scaleY ?? 1})`);
            parent = parent.parent;
        }
        console.log(`${indent}  effective scale: (${scaleX}, ${scaleY})`);
        for (let child of this.children) {
            child.printDebug(depth + 1);
        }
    }

    get containerNode() {
        return this.#containerNode;
    }

    get state() {
        return this.#state;
    }

    dirtyState() {
        if (this.#wasInit)
            this.applyState(this.#state);
    }

    dirtySize() {
        if (this.#wasInit)
            this.resize();
    }

    set state(state) {
        if (!(state in this.#states))
            throw new Error(`State "${state}" not defined for control ${this.node.id}`);
        if (this.#state === state)
            return;
        this.#state = state;
        this.dirtyState();
    }

    setAttr(key, value) {
        this.#attrs[key] = value;
        this.dirtyState();
    }

    getAttr(key, defval) {
        if (key in this.#attrs)
            return this.#attrs[key];
        let stateAttrs = this.attrs;
        if (key in stateAttrs)
            return stateAttrs[key];
        return defval;
    }

    get attrs() {
        return this.#states[this.#state];
    }

    get enabled() {
        return this.#enabled;
    }

    set enabled(value) {
        this.#enabled = value;
        this.dirtyState();
    }

    get node() {
        return this.#node;
    }

    get root() {
        return this.#root;
    }

    detachRoot(oldRoot) {
        delete nodeMap[this.node.id];
    }

    attachRoot(root) {
        nodeMap[this.node.id] = this;
    }

    set root(root) {
        if (this.#root == root)
            return;
        if (this.#root)
            this.detachRoot(this.#root);
        this.#root = root;
        if (root)
            this.attachRoot(root);
        for (let child of this.children)
            child.root = root;
    }

    get parent() {
        return this.#eventDispatcher.getParent();
    }

    set parent(parent) {
        this.#eventDispatcher.setParent(parent);
        this.root = parent?.root ?? null;
        if (!this.#wasInit)
            this.#wasInit = true;
        if (parent) {
            this.dirtyState();
            this.dirtySize();
        }
    }

    hasAncestor(ancestor) {
        let p = this.parent;
        while (p) {
            if (p === ancestor)
                return true;
            p = p.parent;
        }
        return false;
    }

    remove() {
        let parent = this.parent;
        if (parent)
            parent.removeChild(this);
    }

    addChild(child) {
        if (child.parent === this || !child)
            return;
        if (!(child instanceof Ctrl))
            throw new Error('Invalid child added to Control');
        child.remove();
        this.#containerNode.addChild(child.node);
        this.#children.push(child);
        child.parent = this;
    }

    removeChild(child) {
        let index = this.#children.indexOf(child);
        if (index === -1)
            return;
        child.parent = null;
        this.#containerNode.removeChild(child.node);
        this.#children.splice(index, 1);
    }

    clearChildren() {
        while (this.#children.length > 0) {
            this.removeChild(this.#children[0]);
        }
    }

    get children() {
        return this.#children;
    }

    findChildById(id) {
        for (const child of this.#children) {
            if (child.node.id === id) {
                return child;
            }
            const found = child.findChildById(id);
            if (found) {
                return found;
            }
        }
        return undefined;
    }


    set width(value) {
        this.setAttr('width', coordExpression(value, this, "viewportWidth", 'finalWidth'));
        this.dirtySize();
    }
    get width() { return this.getAttr('width').raw; }
    get finalWidth() {return this.getAttr('width')?.cache;}

    set height(value) {
        this.setAttr('height', coordExpression(value, this, "viewportHeight", 'finalHeight'));
        this.dirtySize();
    }
    get height() { return this.getAttr('height').raw; }
    get finalHeight() { return this.getAttr('height')?.cache; }

    setSize(width, height) {
        this.setAttr('width', coordExpression(width, this, "viewportWidth", 'finalWidth'));
        this.setAttr('height', coordExpression(height, this, "viewportHeight", 'finalHeight'));
        this.dirtySize();
    }

    get color() { return this.getAttr('color'); }
    set color(value) {
        this.setAttr('color', value);
        this.dirtyState();
    }

    get visible() { return this.getAttr('visible'); }
    set visible(value) {
        this.setAttr('visible', value);
        this.node.visible = !!value;
    }

    get floating() { return this.getAttr('floating'); }
    set floating(value) {
        this.setAttr('floating', value);
    }

    set anchorX(anchorX) {
        this.#attrs.anchorX = coordExpression(anchorX,
                                             this,
                                             "viewportWidth",
                                             'finalAnchorX');
    }
    get anchorX() { return this.#attrs.anchorX.raw; }
    get finalAnchorX() { return this.#attrs.anchorX?.cache; }

    set anchorY(anchorY) {
        this.#attrs.anchorY = coordExpression(anchorY,
                                       this,
                                       "viewportHeight",
                                       'finalAnchorY');
    }
    get anchorY() { return this.#attrs.anchorY.raw; }
    get finalAnchorY() { return this.#attrs.anchorY?.cache; }

    set scaleX(scaleX) {
        this.#attrs.scaleX = coordExpression(scaleX,
                                             this,
                                             "viewportWidth",
                                             'finalScaleX');
    }
    get scaleX() { return this.#attrs.scaleX.raw; }
    get finalScaleX() { return this.#attrs.scaleX?.cache; }

    set scaleY(scaleY) {
        this.#attrs.scaleY = coordExpression(scaleY,
                                       this,
                                       "viewportHeight",
                                       'finalScaleY');
    }
    get scaleY() { return this.#attrs.scaleY.raw; }
    get finalScaleY() { return this.#attrs.scaleY?.cache; }

    setScale(scaleX, scaleY) {
        this.scaleX = scaleX ?? 1;
        this.scaleY = scaleY ?? 1;
        this.node.setScale(this.#attrs.scaleX.cache, this.#attrs.scaleY.cache);
    }

    set x(x) {
        this.#attrs.x = coordExpression(x, this, "viewportWidth", 'finalWidth');
        this.node.position.x = this.#attrs.x.cache;
    }
    get x() {return this.#attrs.x.raw;}
    get finalX() {return this.#attrs.x?.cache;}

    set y(y) {
        this.#attrs.y = coordExpression(y, this, "viewportHeight", 'finalHeight');
        this.node.position.y = this.#attrs.y?.cache;
    }
    get y() {return this.#attrs.y.raw;}
    get finalY() {return this.#attrs.y?.cache;}

    get marginLeft() {return this.getAttr('marginLeft', 0);}
    get marginRight() {return this.getAttr('marginRight', 0);}
    get marginTop() {return this.getAttr('marginTop', 0);}
    get marginBottom() {return this.getAttr('marginBottom', 0);}

    set position({x, y}) {
        this.x = x;
        this.y = y;
    }

    resizeSelf() {
        Object.assign(coordVars, this.attrs);
        coordVars.padding = (coordVars.paddingLeft|0) + (coordVars.paddingRight|0);
        coordVars.margin = (coordVars.marginLeft|0) + (coordVars.marginRight|0);
        this.#attrs.width.cache = this.#attrs.width.func();
        this.#attrs.x.cache = this.#attrs.x.func();
        this.#attrs.scaleX.cache = this.#attrs.scaleX.func();

        coordVars.padding = (coordVars.paddingTop|0) + (coordVars.paddingBottom|0);
        coordVars.margin = (coordVars.marginTop|0) + (coordVars.marginBottom|0);
        this.#attrs.height.cache = this.#attrs.height.func();
        this.#attrs.y.cache = this.#attrs.y.func();
        this.#attrs.scaleY.cache = this.#attrs.scaleY.func();

        this.node.position = {x:this.#attrs.x.cache, y:this.#attrs.y.cache};
        this.node.setScale(this.#attrs.scaleX.cache, this.#attrs.scaleY.cache);
    }

    resizeChildren() {
        for (const child of this.#children)
            child.resize();
    }

    redrawChildren() {
        for (const child of this.#children)
            child.dirtyState();
    }

    resize() {
        let oldX = this.finalX;
        let oldY = this.finalY;
        let oldScaleX = this.finalScaleX;
        let oldScaleY = this.finalScaleY;
        let oldWidth = this.finalWidth;
        let oldHeight = this.finalHeight;

        this.resizeSelf();

        let sizeChanged = oldWidth !== this.#attrs.width.cache || oldHeight !== this.#attrs.height.cache;
        if (sizeChanged) {
            this.resizeChildren();
        }
    }

    redraw(state, attrs) {
        this.node.position = {x:attrs.x, y:attrs.y};
        this.node.setScale(attrs.scaleX, attrs.scaleY);
        this.node.setAnchor(attrs.anchorX, attrs.anchorY);
        this.node.color = attrs.color;
        this.redrawChildren();
    }

    applyState(state) {
        if (!this.#wasInit)
            return;
        const attrs = Object.assign({}, this.#states[state], this.#attrs);
        for (let key in attrs) {
            let value = attrs[key];
            if (value && typeof value.func === 'function') {
                attrs[key] = value.func();
            }
        }
        this.redraw(state, attrs);
    }

    toLocal(x, y) {
        return this.node.toLocal(x, y);
    }

    addEventListener(type, listener) {
        this.#eventDispatcher.addEventListener(type, listener);
    }

    removeEventListener(type, listener) {
        this.#eventDispatcher.removeEventListener(type, listener);
    }

    dispatchEvent(event) {
        return this.#eventDispatcher.dispatchEvent(event);
    }

    get hasFocus() {
        return GUI.getFocus().ctrl === this;
    }

    focus() {
        GUI.setFocus(this.node, this);
        this.dispatchEvent(new Event('focus', {}));
    }
}
