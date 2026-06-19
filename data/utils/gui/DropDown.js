import { Ctrl, nodeMap } from './Ctrl.js';
import { Event } from '../EventDispatcher.js';
import { Menu } from './Menu.js';
import { MenuItem } from './MenuItem.js';
import { TextInput } from './TextInput.js';
import GUI from './GUI.js';

// Cached triangle image (downward-pointing chevron)
let _triangleImg = null;

/**
 * Renders a small downward-pointing triangle using the polygon processor.
 * The image is modified in-place, so it's safe to use immediately.
 */
function createTriangleImage(width, height) {
    if (_triangleImg) return _triangleImg;

    _triangleImg = new Image(width, height);
    const points = [
        { x: 1, y: 1 },                     // top-left
        { x: width - 1, y: 1 },             // top-right
        { x: width * 0.5, y: height - 1 },  // bottom center
    ];

    runGraphAsync({
        nodes: {
            polygon: {
                type: 'polygon',
                image: _triangleImg,
                points,
                color: 0xAA111111
            }
        }
    });

    return _triangleImg;
}

export class DropDown extends Ctrl {
    #trigger;
    #arrowCtrl;
    #arrowNode;
    #savedFilterText = '';
    #customValue = null;       // non-strict: user-typed value not in items list
    #menu = null;
    #menuWidth = 0;
    #menuHeight = 0;
    #menuItems = [];
    #items = [];
    #selectedIndex = -1;
    #open = false;
    #hoveredIndex = -1;
    #strict = true;            // strict: value must be from items list
    #globalMousedownHandler;
    onChange = null;

    constructor(params = {}) {
        super({
            node: new Node(),
            ...params
        });

        this.#strict = this.getAttr('strict', true);

        this.#trigger = new TextInput({
            placeholder: params.placeholder ?? 'Select...',
            width: '100%',
            height: '100%'
        });
        this.addChild(this.#trigger);

        // Triangle indicator wrapped in a Ctrl for positioning
        this.#arrowNode = new ImageNode(createTriangleImage(12, 8));
        this.#arrowNode.setAnchor(0.5, 0.5);
        this.#trigger.node.addChild(this.#arrowNode);

        this.#trigger.addEventListener('focus', () => this.#toggleMenu());
        this.#trigger.addEventListener('change', () => {
            if (this.#open) this.#applyFilter();
        });
        this.#trigger.addEventListener('keydown', (ev) => this.#onTriggerKeyDown(ev));
        this.#menuWidth = this.#trigger.finalWidth;
        this.#menuHeight = this.#trigger.finalHeight * 10;

        this.onChange = this.getAttr('onChange') ?? null;
        this.addEventListener('change', (...args) => this.onChange && this.onChange(...args));

        this.#globalMousedownHandler = (event) => {
            let picked = this.root.node.pick(event.x, event.y);

            // Check if pick is anywhere under menu node (scrollbar nodes are siblings in
            // the C++ tree but still descendants of menu.node via node.parent chain)
            if (this.#menu && picked) {
                let check = picked;
                while (check) {
                    if (check === this.#menu.node) {
                        return;
                    }
                    check = check.parent;
                }
            }

            while (picked) {
                const ctrl = nodeMap[picked.id];
                if (ctrl && ctrl.enabled) {
                    if (ctrl !== this && !ctrl.hasAncestor(this)) {
                        if (this.#open) this.#commitCustomValue();
                        if (this.#open) this.#closeMenu();
                    }
                    return;
                }
                picked = picked.parent;
            }
            if (this.#open) this.#closeMenu();
        };

        this.items = params.items ?? [];
        let value = this.getAttr('value');
        let index = this.getAttr('index');
        if (!this.#strict && value !== undefined)
            this.#customValue = String(value);
        else if (value !== undefined)
            this.#selectedIndex = this.#findIndexByValue(value);
        else if (index !== undefined)
            this.#selectedIndex = Math.max(0, Math.min(index, this.#items.length - 1));

        this.#updateTriggerText();
    }

    #updateTimeout;
    #updateArrow() {
        clearTimeout(this.#updateTimeout);
        let r = this.#arrowNode.rotation;
        let t = this.#open ? 3.14159265 : 0;
        let d = (r * 7 + t) / 8;
        if (Math.abs(r - t) > 0.1) {
            this.#updateTimeout = setTimeout(_=>this.#updateArrow(), 30);
        } else {
            d = t;
        }
        this.#arrowNode.rotation = d;
    }

    #findIndexByValue(value) {
        for (let i = 0; i < this.#items.length; i++) {
            if (this.#items[i].value === value) return i;
        }
        return -1;
    }

    get items() { return [...this.#items]; }
    set items(values) {
        this.#items = values.map(item => {
            if (typeof item === 'string') return { label: item, value: item };
            return { label: item.label ?? String(item.value ?? ''), value: item.value ?? item.label, disabled: item.disabled ?? false };
        });
        if (this.#selectedIndex >= this.#items.length)
            this.#selectedIndex = -1;
        if (this.#menu) {
            this.#rebuildMenuItems();
        }
        this.#updateTriggerText();
    }

    get selectedValue() {
        if (this.#selectedIndex < 0 || this.#selectedIndex >= this.#items.length) return null;
        return this.#items[this.#selectedIndex].value;
    }
    set selectedValue(value) {
        const idx = this.#findIndexByValue(value);
        if (idx !== this.#selectedIndex) {
            this.#selectedIndex = idx;
            this.#updateTriggerText();
            this.dispatchEvent(new Event('change', { bubbles: true, value, index: idx, item: this.#items[idx] }));
        }
    }

    get selectedIndex() { return this.#selectedIndex; }
    set selectedIndex(idx) {
        idx = Math.floor(idx);
        if (idx >= 0 && idx < this.#items.length && idx !== this.#selectedIndex) {
            this.#selectedIndex = idx;
            this.#updateTriggerText();
            const item = this.#items[idx];
            this.dispatchEvent(new Event('change', { bubbles: true, value: item.value, index: idx, item }));
        }
    }

    get placeholder() { return this.#trigger.placeholder; }
    set placeholder(value) { this.#trigger.placeholder = value; }

    get isOpen() { return this.#open; }

    get strict() { return this.#strict; }
    set strict(value) {
        this.#strict = !!value;
        if (this.#strict && this.#customValue !== null) {
            // Convert custom value to nearest match or reset
            const idx = this.#findIndexByLabel(this.#customValue);
            if (idx >= 0) {
                this.#selectedIndex = idx;
                this.#customValue = null;
            } else {
                this.#customValue = null;
                this.#selectedIndex = -1;
                this.#updateTriggerText();
            }
        }
    }

    get value() {
        if (!this.#strict && this.#customValue !== null) return this.#customValue;
        if (this.#selectedIndex >= 0 && this.#selectedIndex < this.#items.length) return this.#items[this.#selectedIndex].value;
        return null;
    }
    set value(v) {
        if (this.#strict) {
            this.selectedValue = v;
        } else {
            const idx = this.#findIndexByValue(v);
            if (idx >= 0) {
                this.#selectedIndex = idx;
                this.#customValue = null;
            } else {
                this.#selectedIndex = -1;
                this.#customValue = String(v);
            }
            this.#updateTriggerText();
            this.dispatchEvent(new Event('change', { bubbles: true, value: this.value, index: this.#selectedIndex }));
        }
    }

    #findIndexByLabel(label) {
        const l = label.toLowerCase();
        for (let i = 0; i < this.#items.length; i++) {
            if (this.#items[i].label.toLowerCase() === l) return i;
        }
        return -1;
    }

    #commitCustomValue() {
        if (this.#strict) return;
        const text = this.#trigger.text.trim();
        if (!text) return;
        const idx = this.#findIndexByLabel(text);
        if (idx >= 0) {
            // Matches an existing item — select it
            if (idx !== this.#selectedIndex) {
                this.#selectedIndex = idx;
                this.#customValue = null;
                this.#updateTriggerText();
                this.dispatchEvent(new Event('change', { bubbles: true, value: this.value, index: idx, item: this.#items[idx] }));
            }
        } else {
            // Custom value
            if (text !== this.#customValue) {
                this.#customValue = text;
                this.#selectedIndex = -1;
                this.dispatchEvent(new Event('change', { bubbles: true, value: text, index: -1 }));
            }
        }
    }

    #updateTriggerText() {
        if (!this.#strict && this.#customValue !== null) {
            this.#trigger.text = this.#customValue;
        } else if (this.#selectedIndex >= 0 && this.#selectedIndex < this.#items.length) {
            this.#trigger.text = this.#items[this.#selectedIndex].label;
        } else {
            this.#trigger.text = '';
        }
    }

    #buildMenu() {
        if (this.#menu) return;

        this.#menu = new Menu({overflow: 'scroll'});
        this.#menu.node.zIndex = 99;

        for (let i = 0; i < this.#items.length; i++) {
            const item = this.#items[i];
            const menuItem = new MenuItem({
                label: item.label,
                enabled: !item.disabled,
                onClick: () => this.#selectItem(i),
            });
            this.#menuItems.push(menuItem);
            this.#menu.addItem(menuItem);
        }

        // this.#menu.calculateSize();
    }

    #rebuildMenuItems() {
        if (!this.#menu) return;

        for (const menuItem of this.#menuItems) {
            this.#menu.removeItem(menuItem);
        }
        this.#menuItems = [];

        for (let i = 0; i < this.#items.length; i++) {
            const item = this.#items[i];
            const menuItem = new MenuItem({
                label: item.label,
                enabled: !item.disabled,
                onClick: () => this.#selectItem(i),
            });
            this.#menuItems.push(menuItem);
            this.#menu.addItem(menuItem);
        }

        this.#menu.calculateSize({width: this.#menuWidth, height: this.#menuHeight});
    }

    #positionMenu() {
        if (!this.#menu) return;

        const marginBottom = this.#trigger.marginBottom || 0;
        const paddingBottom = this.#trigger.paddingBottom || 0;
        const marginTop = this.#trigger.marginTop || 0;
        const paddingTop = this.#trigger.paddingTop || 0;
        const height = this.#trigger.finalHeight;
        const localY = height + marginBottom + paddingBottom + marginTop + paddingTop;

        // Convert local coords below trigger to world coords
        const world = this.node.toWorld(0, localY);
        this.#menu.x = world.x;
        this.#menu.y = world.y;
        this.root.addChild(this.#menu);
    }

    #toggleMenu() {
        if (!this.enabled) return;
        if (this.#open) {
            this.#closeMenu();
        } else {
            this.#openMenu();
        }
    }

    #openMenu() {
        this.#buildMenu();
        this.#savedFilterText = this.#trigger.text;
        this.#trigger.text = '';
        this.#positionMenu();
        this.#applyFilter();
        this.#menu.resizeSelf();
        this.#open = true;
        this.#hoveredIndex = -1;

        GUI.addEventListener('mousedown', this.#globalMousedownHandler);
        this.#trigger.focus();
        this.#updateArrow();
    }

    #closeMenu() {
        if (!this.#open) return;
        this.#open = false;
        if (this.#strict) {
            this.#trigger.text = this.#savedFilterText;
        } else {
            // In non-strict mode, commit any typed text or restore saved
            const typed = this.#trigger.text.trim();
            if (typed) {
                this.#commitCustomValue();
            } else {
                this.#trigger.text = this.#savedFilterText;
            }
        }
        if (this.#menu) {
            this.root.removeChild(this.#menu);
        }
        GUI.removeEventListener('mousedown', this.#globalMousedownHandler);
        this.#updateArrow();
    }

    detachRoot(oldRoot) {
        this.#closeMenu();
        super.detachRoot(oldRoot);
    }

    #selectItem(index) {
        if (index < 0 || index >= this.#items.length) return;
        const item = this.#items[index];
        if (item.disabled) return;

        this.#selectedIndex = index;
        this.#savedFilterText = item.label;
        this.#trigger.text = item.label;
        this.#trigger.blur();
        this.#closeMenu();
        this.dispatchEvent(new Event('change', { bubbles: true, value: item.value, index, item }));
    }

    #onTriggerKeyDown(ev) {
        if (!this.enabled) return;

        if (ev.key === 'ArrowDown') {
            ev.stopPropagation();
            if (!this.#open) {
                this.#openMenu();
            } else {
                this.#navigateItems(1);
            }
            return;
        }

        if (ev.key === 'ArrowUp') {
            ev.stopPropagation();
            if (!this.#open) {
                this.#openMenu();
            } else {
                this.#navigateItems(-1);
            }
            return;
        }

        if (ev.key === 'Enter') {
            if (this.#open) {
                ev.stopPropagation();
                if (this.#hoveredIndex >= 0) {
                    this.#selectItem(this.#hoveredIndex);
                } else if (!this.#strict) {
                    this.#commitCustomValue();
                    this.#closeMenu();
                } else if (this.#selectedIndex >= 0) {
                    this.#closeMenu();
                }
            }
            return;
        }

        if (ev.key === 'Escape') {
            if (this.#open) {
                ev.stopPropagation();
                this.#closeMenu();
            }
            return;
        }
    }

    #navigateItems(direction) {
        const visibleItems = this.#getVisibleItems();
        if (visibleItems.length === 0) return;

        let currentPos = -1;
        for (let i = 0; i < visibleItems.length; i++) {
            if (visibleItems[i] === this.#hoveredIndex) {
                currentPos = i;
                break;
            }
        }

        let newPos = currentPos + direction;
        if (newPos < 0) newPos = visibleItems.length - 1;
        if (newPos >= visibleItems.length) newPos = 0;

        this.#setHoveredIndex(visibleItems[newPos]);
    }

    #getVisibleItems() {
        const result = [];
        for (let i = 0; i < this.#menuItems.length; i++) {
            if (this.#menuItems[i].visible) {
                result.push(i);
            }
        }
        return result;
    }

    #setHoveredIndex(index) {
        const prev = this.#hoveredIndex;
        this.#hoveredIndex = index;

        if (prev >= 0 && prev < this.#menuItems.length) {
            this.#menuItems[prev].state = 'default';
        }
        if (index >= 0 && index < this.#menuItems.length) {
            this.#menuItems[index].state = 'hover';

            const menuItem = this.#menuItems[index];
            const itemY = menuItem.finalY;
            const itemH = menuItem.finalHeight;
            if (itemY < this.#menu.scrollY) {
                this.#menu.scrollY = itemY;
            } else if (itemY + itemH > this.#menu.scrollY + (this.#menu.finalHeight ?? 200)) {
                const viewportH = this.#menu.finalHeight ?? 200;
                this.#menu.scrollY = itemY + itemH - viewportH;
            }
        }
    }

    #applyFilter() {
        const filterText = this.#trigger.text.toLowerCase();

        if (!filterText) {
            for (const menuItem of this.#menuItems) {
                menuItem.visible = true;
            }
            this.#hoveredIndex = -1;
            this.#menu.calculateSize({width: this.#menuWidth, height: this.#menuHeight});
            return;
        }

        let matchedIndex = -1;
        for (let i = 0; i < this.#menuItems.length; i++) {
            const item = this.#items[i];
            const matches = item.label.toLowerCase().includes(filterText);
            this.#menuItems[i].visible = matches;
            if (matches && matchedIndex === -1) {
                matchedIndex = i;
            }
        }

        if (matchedIndex >= 0) {
            this.#setHoveredIndex(matchedIndex);
        } else {
            this.#hoveredIndex = -1;
        }

        this.#menu.calculateSize({width: this.#menuWidth, height: this.#menuHeight});
    }

    resize() {
        super.resize();
        this.#positionArrow();
    }

    #positionArrow() {
        const padding = 8;
        const width = this.finalWidth;
        const height = this.finalHeight;
        const x = width - padding;
        const y = height / 2;
        this.#arrowNode.position = {x, y};
    }

    attachRoot(root) {
        super.attachRoot(root);
    }
}
