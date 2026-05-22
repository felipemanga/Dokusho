import { Ctrl } from './Ctrl.js';
import { coordExpression, coordVars } from './coordExpression.js';
import { calculateNinePatchKey, createNinePatchFrame } from './FrameCache.js';
import { ImageCtrl } from './ImageCtrl.js';
import { Event } from '../EventDispatcher.js';
import GUI from './GUI.js';

class ScrollGutter extends Ctrl {
    #vertical;
    constructor(params = {}) {
        super({classes: ['scrollgutter'], node: new NinePatch(), states:['hover']}, params);
        this.#vertical = params.vertical;
        this.addEventListener('mouseover', () => this.state = 'hover');
        this.addEventListener('mouseout', () => this.state = '');
    }

    redraw(state, attrs) {
        let key = calculateNinePatchKey(attrs);
        if (this.node.key !== key) {
            let frame = createNinePatchFrame(attrs);
            this.node.image = frame.image;
            this.node.margins = frame.margins;
            this.node.key = key;
        }
        this.node.color = attrs.color;
        // Don't call super.redraw to avoid overwriting manually set position/size
    }

    show(x, y, w, h, i, s) {
        let margins = this.node.margins || {};
        let sv = s + margins.top;
        let sh = s + margins.left;
        if (this.#vertical) {
            this.node.setSize(sh + margins.right, h + margins.top + margins.bottom - (i ? sv : 0));
            this.node.setPosition(w - s - margins.left, -margins.top);
        } else {
            this.node.setSize(w + margins.left + margins.right - (i ? sh : 0), sv + margins.bottom);
            this.node.setPosition(-margins.left, h - s - margins.top);
        }
    }
}

class ScrollHandle extends Ctrl {
    #vertical;
    constructor(params = {}) {
        super({node: new NinePatch(), states:['hover']}, params);
        this.#vertical = params.vertical;
        this.addEventListener('mouseover', () => this.state = 'hover');
        this.addEventListener('mouseout', () => this.state = '');
    }

    redraw(state, attrs) {
        let key = calculateNinePatchKey(attrs);
        if (this.node.key !== key) {
            let frame = createNinePatchFrame({...attrs});
            this.node.image = frame.image;
            this.node.margins = frame.margins;
            this.node.key = key;
        }
        this.node.color = attrs.color;
        // Don't call super.redraw
    }
}

class ScrollGroup extends Ctrl {
    constructor(params = {}) {
        super({node: new Node()}, params);
    }
}

export class Group extends Ctrl {
    #backgroundNode = new NinePatch();
    #clippingNode = new ClippingNode();
    #vscrollGutter;
    #vscrollHandle;
    #hscrollGutter;
    #hscrollHandle;
    #scrollX = 0;
    #scrollY = 0;
    #scrollGroup;
    #overflow = 'hidden'

    constructor(params = {}) {
        super({
            node: new Node(), 
            containerNode: new Node(),
            ...params 
        });

        const node = this.node;
        node.addChild(this.#backgroundNode);
        node.addChild(this.#clippingNode);
        this.#clippingNode.addChild(this.containerNode);

        coordVars.auto = this.calculateAutoSize().width;
        this.innerWidth = this.getAttr('innerWidth', 'auto');
        this.innerHeight = this.getAttr('innerHeight', 'auto');
        this.overflow = this.getAttr('overflow', 'hidden');
        this.#scrollGroup = new ScrollGroup();
        this.#scrollGroup.parent = this;

        this.addEventListener('wheel', (event) => this.#onWheel(event));
    }

    get overflow() {
        return this.#overflow;
    }

    set overflow(mode) {
        if (mode == 'hidden' || mode == 'scroll')
            this.#overflow = mode;
    }

    get root() { return super.root; }
    set root(r) {
        super.root = r;
        if (this.#scrollGroup) this.#scrollGroup.root = r;
        if (this.#vscrollGutter) this.#vscrollGutter.root = r;
        if (this.#vscrollHandle) this.#vscrollHandle.root = r;
        if (this.#hscrollGutter) this.#hscrollGutter.root = r;
        if (this.#hscrollHandle) this.#hscrollHandle.root = r;
    }

    #onWheel(event) {
        const theme = this.#scrollGroup.attrs;
        const stepX = theme.wheelStepX ?? 20;
        const stepY = theme.wheelStepY ?? 20;
        let oldScrollX = this.scrollX;
        let oldScrollY = this.scrollY;
        this.scrollX += event.deltaX * stepX;
        this.scrollY += event.deltaY * stepY;
        if (this.scrollX != oldScrollX || this.scrollY != oldScrollY)
            event.stopPropagation();
    }

    get scrollX() { return this.#scrollX; }
    set scrollX(val) {
        const viewportSize = this.#clippingNode.size();
        const maxScroll = Math.max(0, this.finalInnerWidth - viewportSize.width);
        this.#scrollX = Math.max(0, Math.min(val, maxScroll));
        this.containerNode.position.x = -this.#scrollX;
        this.#updateScrollHandles();
    }

    get scrollY() { return this.#scrollY; }
    set scrollY(val) {
        const viewportSize = this.#clippingNode.size();
        const maxScroll = Math.max(0, this.finalInnerHeight - viewportSize.height);
        this.#scrollY = Math.max(0, Math.min(val, maxScroll));
        this.containerNode.position.y = -this.#scrollY;
        this.#updateScrollHandles();
    }

    set backgroundColor(color) {
        this.setAttr('backgroundColor', color >>> 0);
    }
    get backgroundColor() {
        return this.getAttr('backgroundColor');
    }

    set innerWidth(value) {
        this.setAttr('innerWidth', coordExpression(value, this, "viewportWidth", 'finalInnerWidth'));
        this.dirtySize();
    }
    get innerWidth() { return this.getAttr('innerWidth').raw; }
    get finalInnerWidth() {return this.getAttr('innerWidth')?.cache;}

    set innerHeight(value) {
        this.setAttr('innerHeight', coordExpression(value, this, "viewportHeight", 'finalInnerHeight'));
        this.dirtySize();
    }
    get innerHeight() { return this.getAttr('innerHeight').raw; }
    get finalInnerHeight() { return this.getAttr('innerHeight')?.cache; }

    redraw(state, attrs) {
        let key = calculateNinePatchKey(attrs);
        let frame = this.#backgroundNode;
        if (frame.key !== key) {
            let newFrame = createNinePatchFrame(attrs);
            if (newFrame) {
                frame.image = newFrame.image;
                frame.margins = newFrame.margins;
                frame.key = newFrame.key;
            } else {
                frame.image = null;
                frame.margins = [0,0,0,0];
            }
        }
        frame.setPosition(-frame.margins.left, -frame.margins.top);
        super.redraw(state, attrs);
    }

    #updateScrollHandles() {
        const viewport = this.#clippingNode.size();
        const theme = this.#scrollGroup.attrs;
        const gutterSize = theme.handleThickness ?? theme.barThickness ?? 10;
        const minHandleSize = theme.barMinThumbSize ?? 16;

        if (this.#vscrollHandle && this.#vscrollHandle.node.parent) {
            const trackM = this.#vscrollGutter.node.margins;
            const trackInnerHeight = Math.max(0, this.#vscrollGutter.node.height - trackM.top - trackM.bottom);
            const contentHeight = this.finalInnerHeight;
            
            let handleInnerHeight = Math.max(minHandleSize, trackInnerHeight * (viewport.height / contentHeight));
            if (handleInnerHeight > trackInnerHeight) handleInnerHeight = trackInnerHeight;
            
            const maxScroll = Math.max(0, contentHeight - viewport.height);
            const scrollRatio = maxScroll > 0 ? this.#scrollY / maxScroll : 0;
            const handleY = scrollRatio * (trackInnerHeight - handleInnerHeight);
            
            const m = this.#vscrollHandle.node.margins;
            const trackX = this.#vscrollGutter.node.position.x + trackM.left;
            const trackY = this.#vscrollGutter.node.position.y + trackM.top;
            
            this.#vscrollHandle.node.setPosition(trackX - m.left, trackY + handleY - m.top);
            this.#vscrollHandle.node.setInnerSize(gutterSize, handleInnerHeight);
        }

        if (this.#hscrollHandle && this.#hscrollHandle.node.parent) {
            const trackM = this.#hscrollGutter.node.margins;
            const trackInnerWidth = Math.max(0, this.#hscrollGutter.node.width - trackM.left - trackM.right);
            const contentWidth = this.finalInnerWidth;
            
            let handleInnerWidth = Math.max(minHandleSize, trackInnerWidth * (viewport.width / contentWidth));
            if (handleInnerWidth > trackInnerWidth) handleInnerWidth = trackInnerWidth;

            const maxScroll = Math.max(0, contentWidth - viewport.width);
            const scrollRatio = maxScroll > 0 ? this.#scrollX / maxScroll : 0;
            const handleX = scrollRatio * (trackInnerWidth - handleInnerWidth);

            const m = this.#hscrollHandle.node.margins;
            const trackX = this.#hscrollGutter.node.position.x + trackM.left;
            const trackY = this.#hscrollGutter.node.position.y + trackM.top;

            this.#hscrollHandle.node.setPosition(trackX + handleX - m.left, trackY - m.top);
            this.#hscrollHandle.node.setInnerSize(handleInnerWidth, gutterSize);
        }
    }

    #dragScroll = null;
    #onHandleMouseDown(event, vertical) {
        this.#dragScroll = {
            vertical,
            startX: event.x,
            startY: event.y,
            startScrollX: this.scrollX,
            startScrollY: this.scrollY
        };
        
        const onMouseMove = (moveEvent) => {
            if (!this.#dragScroll) return;
            const dx = moveEvent.x - this.#dragScroll.startX;
            const dy = moveEvent.y - this.#dragScroll.startY;
            const viewport = this.#clippingNode.size();
            
            if (this.#dragScroll.vertical) {
                const trackM = this.#vscrollGutter.node.margins;
                const trackInnerHeight = Math.max(0, this.#vscrollGutter.node.height - trackM.top - trackM.bottom);
                const handleM = this.#vscrollHandle.node.margins;
                const handleInnerHeight = Math.max(0, this.#vscrollHandle.node.height - handleM.top - handleM.bottom);
                
                const maxHandleScroll = trackInnerHeight - handleInnerHeight;
                const maxContentScroll = this.finalInnerHeight - viewport.height;
                const ratio = maxHandleScroll > 0 ? maxContentScroll / maxHandleScroll : 0;
                this.scrollY = this.#dragScroll.startScrollY + dy * ratio;
            } else {
                const trackM = this.#hscrollGutter.node.margins;
                const trackInnerWidth = Math.max(0, this.#hscrollGutter.node.width - trackM.left - trackM.right);
                const handleM = this.#hscrollHandle.node.margins;
                const handleInnerWidth = Math.max(0, this.#hscrollHandle.node.width - handleM.left - handleM.right);

                const maxHandleScroll = trackInnerWidth - handleInnerWidth;
                const maxContentScroll = this.finalInnerWidth - viewport.width;
                const ratio = maxHandleScroll > 0 ? maxContentScroll / maxHandleScroll : 0;
                this.scrollX = this.#dragScroll.startScrollX + dx * ratio;
            }
        };
        
        const onMouseUp = () => {
            this.#dragScroll = null;
            GUI.removeEventListener('mousemove', onMouseMove);
            GUI.removeEventListener('mouseup', onMouseUp);
        };
        
        GUI.addEventListener('mousemove', onMouseMove);
        GUI.addEventListener('mouseup', onMouseUp);
        event.stopPropagation();
    }

    #initScrollbars() {
        if (this.#vscrollGutter) return;
        this.#vscrollGutter = new ScrollGutter({vertical: true});
        this.#vscrollHandle = new ScrollHandle({vertical: true});
        this.#vscrollGutter.parent = this.#scrollGroup;
        this.#vscrollHandle.parent = this.#scrollGroup;
        this.#vscrollHandle.addEventListener('mousedown', (e) => this.#onHandleMouseDown(e, true));

        this.#hscrollGutter = new ScrollGutter({vertical: false});
        this.#hscrollHandle = new ScrollHandle({vertical: false});
        this.#hscrollGutter.parent = this.#scrollGroup;
        this.#hscrollHandle.parent = this.#scrollGroup;
        this.#hscrollHandle.addEventListener('mousedown', (e) => this.#onHandleMouseDown(e, false));
        
        if (this.root) {
            this.#vscrollGutter.root = this.root;
            this.#vscrollHandle.root = this.root;
            this.#hscrollGutter.root = this.root;
            this.#hscrollHandle.root = this.root;
        }
    }

    calculateAutoSize() {
        let maxX = 0, maxY = 0;
        if (this.#overflow == 'scroll') {
            for (let child of this.children) {
                if (child.floating)
                    continue;
                let position = child.node.position;
                let anchor = child.node.anchor();
                let marginLR = (child.marginLeft || 0) + (child.marginRight || 0);
                let marginTB = (child.marginTop || 0) + (child.marginBottom || 0);
                let childMaxX = position.x + ((child.finalWidth || 0) + marginLR) * (1 - anchor.x);
                let childMaxY = position.y + ((child.finalHeight || 0) + marginTB) * (1 - anchor.y);
                if (childMaxX > maxX) maxX = childMaxX;
                if (childMaxY > maxY) maxY = childMaxY;
            }
        }
        return {width: maxX, height: maxY};
    }

    resizeSelf() {
        super.resizeSelf();

        let outerWidth = this.finalWidth;
        let outerHeight = this.finalHeight;
        this.#backgroundNode.setInnerSize(outerWidth, outerHeight);
        let autoSize = this.calculateAutoSize();
        coordVars.auto = autoSize.width;
        const innerWidth = this.getAttr('innerWidth');
        innerWidth.cache = innerWidth.func();
        coordVars.auto = autoSize.height;
        const innerHeight = this.getAttr('innerHeight');
        innerHeight.cache = innerHeight.func();

        // console.log('Resize Group:', innerWidth.cache, innerHeight.cache, 'Auto size:', autoSize);

        let hasHScroll = innerWidth.cache > outerWidth;
        let hasVScroll = innerHeight.cache > outerHeight;

        const theme = this.#scrollGroup.attrs;
        const gutterSize = theme.barThickness ?? 10;
        
        if (hasVScroll && !hasHScroll) {
            if (innerWidth.cache > outerWidth - gutterSize) hasHScroll = true;
        }
        if (hasHScroll && !hasVScroll) {
            if (innerHeight.cache > outerHeight - gutterSize) hasVScroll = true;
        }

        let gutterSizeH = gutterSize;
        let gutterSizeV = gutterSize;
        if (hasVScroll || hasHScroll) {
            this.#initScrollbars();
            gutterSizeV += this.#vscrollGutter.node.margins?.left ?? 0;
            gutterSizeH += this.#hscrollGutter.node.margins?.top ?? 0;
        }

        let viewportWidth = outerWidth - (hasVScroll ? gutterSizeV : 0);
        let viewportHeight = outerHeight - (hasHScroll ? gutterSizeH : 0);

        this.#clippingNode.setSize(viewportWidth, viewportHeight);

        if (hasVScroll) {
            if (this.#vscrollGutter.node.parent !== this.node) {
                this.node.addChild(this.#vscrollGutter.node);
                this.node.addChild(this.#vscrollHandle.node);
            }
            this.#vscrollGutter.show(viewportWidth, 0, outerWidth, outerHeight, hasHScroll, gutterSize);
        } else if (this.#vscrollGutter) {
            this.#vscrollGutter.node.remove();
            this.#vscrollHandle.node.remove();
        }

        if (hasHScroll) {
            if (this.#hscrollGutter.node.parent !== this.node) {
                this.node.addChild(this.#hscrollGutter.node);
                this.node.addChild(this.#hscrollHandle.node);
            }
            this.#hscrollGutter.show(0, viewportHeight, outerWidth, outerHeight, hasVScroll, gutterSize);
        } else if (this.#hscrollGutter) {
            this.#hscrollGutter.node.remove();
            this.#hscrollHandle.node.remove();
        }

        this.#updateScrollHandles();
    }
}
