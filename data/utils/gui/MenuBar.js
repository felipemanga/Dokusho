import { Ctrl } from './Ctrl.js';
import { calculateNinePatchKey, createNinePatchFrame } from './FrameCache.js';
import { Menu } from './Menu.js';
import { MenuItem } from './MenuItem.js';
import { MenuBarItem } from './MenuBarItem.js';
import { Event } from '../EventDispatcher.js';

function normalizeShortcutKey(key) {
    const raw = String(key ?? '').trim();
    if (!raw) {
        return '';
    }
    if (raw.length === 1) {
        return raw.toLowerCase();
    }
    const map = {
        escape: 'Escape',
        esc: 'Escape',
        enter: 'Enter',
        return: 'Enter',
        space: ' ',
        spacebar: ' ',
        tab: 'Tab',
        backspace: 'Backspace',
        delete: 'Delete',
        del: 'Delete',
        left: 'ArrowLeft',
        right: 'ArrowRight',
        up: 'ArrowUp',
        down: 'ArrowDown'
    };
    const lowered = raw.toLowerCase();
    if (map[lowered]) {
        return map[lowered];
    }
    if (/^f\d{1,2}$/i.test(raw)) {
        return raw.toUpperCase();
    }
    return raw;
}

function parseShortcutSpec(spec) {
    if (typeof spec !== 'string') {
        return null;
    }

    const parts = spec.split('+').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) {
        return null;
    }

    let ctrl = false;
    let alt = false;
    let shift = false;
    let meta = false;
    let key = '';

    for (const partRaw of parts) {
        const part = partRaw.toLowerCase();
        if (part === 'ctrl' || part === 'control') {
            ctrl = true;
            continue;
        }
        if (part === 'alt' || part === 'option') {
            alt = true;
            continue;
        }
        if (part === 'shift') {
            shift = true;
            continue;
        }
        if (part === 'meta' || part === 'cmd' || part === 'command' || part === 'super' || part === 'win' || part === 'windows') {
            meta = true;
            continue;
        }
        key = normalizeShortcutKey(partRaw);
    }

    if (!key) {
        return null;
    }

    return { key, ctrl, alt, shift, meta };
}

function getEventModifiers(ev) {
    const mod = (typeof ev?.mod === 'number') ? ev.mod : 0;
    const shift = ev?.shiftKey ?? ((mod & 0x0003) !== 0);
    const ctrl = ev?.ctrlKey ?? ((mod & 0x00C0) !== 0);
    const alt = ev?.altKey ?? ((mod & 0x0300) !== 0);
    const meta = ev?.metaKey ?? ((mod & 0x0C00) !== 0);
    return { ctrl: !!ctrl, alt: !!alt, shift: !!shift, meta: !!meta };
}

function eventMatchesShortcut(ev, shortcut) {
    if (!shortcut) {
        return false;
    }
    const evKey = normalizeShortcutKey(ev?.key);
    if (!evKey || evKey !== shortcut.key) {
        return false;
    }
    const mods = getEventModifiers(ev);
    return mods.ctrl === !!shortcut.ctrl
        && mods.alt === !!shortcut.alt
        && mods.shift === !!shortcut.shift
        && mods.meta === !!shortcut.meta;
}

export function bindShortcut(spec, handler, options = {}) {
    const shortcut = parseShortcutSpec(spec);
    if (!shortcut || typeof handler !== 'function') {
        return () => {};
    }
    const entry = {
        shortcut,
        handler,
        allowRepeat: !!options.repeat
    };
    shortcutBindings.push(entry);
    return () => {
        const idx = shortcutBindings.indexOf(entry);
        if (idx >= 0) {
            shortcutBindings.splice(idx, 1);
        }
    };
}

export class MenuBar extends Ctrl {
    #barBackground = new NinePatch();
    #menus = [];
    #menuButtons = [];
    #openMenu = null;
    #parentListener;
    #shortcuts = [];

    constructor(params = {}) {
        super({
            node: new Node(),
            containerNode: new Node(),
            floating: true,
            ...params
        });

        this.#parentListener = this.#onParentEvent.bind(this);
        const node = this.node;
        node.addChild(this.#barBackground);
        node.addChild(this.containerNode);
        this.#buildMenus(params.menus ?? []);
    }

    #buildMenus(menusData) {
        for (const menuData of menusData) {
            const menuButton = this.#createMenuButton(menuData.label);
            this.#menuButtons.push(menuButton);
            this.addChild(menuButton);
            const menu = this.#createMenu(menuData.label, menuData.items);
            this.#menus.push(menu);
        }
    }

    resizeChildren() {}

    #createMenuButton(label) {
        return new MenuBarItem({
            label,
            onClick: ({target})=>this.#openMenuForButton(target)
        });
    }

    #createMenu(label, items) {
        const menu = new Menu({});

        for (const itemData of items ?? []) {
            const menuItem = new MenuItem({
                label: itemData.label,
                shortcut: itemData.shortcut,
                onClick: itemData.onClick
            });
            menuItem.addEventListener('click', _=>{this.#closeAllMenus();});
            const shortcut = parseShortcutSpec(menuItem.shortcut);
            if (shortcut)
                this.#shortcuts.push({shortcut, menuItem});
            menu.addItem(menuItem);
        }

        menu.menuLabel = label;
        return menu;
    }

    #onParentEvent(event) {
        if (event.type == 'mousedown' && !event.target.hasAncestor(this))
            this.#closeAllMenus();
        if (event.type == 'keydown') {
            for (const {shortcut, menuItem} of this.#shortcuts) {
                if (eventMatchesShortcut(event, shortcut)) {
                    menuItem.dispatchEvent(new Event('click', {bubbles:true}));
                }
            }
        }
    }

    attachRoot(root) {
        root.addEventListener('mousedown', this.#parentListener);
        root.addEventListener('keydown', this.#parentListener);
    }

    detachRoot(root) {
        oldRoot.removeEventListener('mousedown', this.#parentListener);
        oldRoot.removeEventListener('keydown', this.#parentListener);
    }

    #layoutMenuButtons(state, attrs) {
        const font = attrs.font;
        const textColor = attrs.topTextColor ?? 0xFF000000;
        const gap = attrs.topMenuGap ?? 3;
        
        const marginLeft = attrs.marginLeft ?? 1;
        const paddingLeft = attrs.paddingLeft ?? 10;
        const leftMargin = marginLeft + paddingLeft;

        let x = paddingLeft + leftMargin;
        let y = 0; // (attrs.paddingTop ?? 0) + (attrs.marginTop ?? 0);
        for (const button of this.#menuButtons) {
            const labelNode = button.labelNode;
            labelNode.font = font;
            labelNode.color = textColor;
            const labelWidth = labelNode.width;
            const buttonWidth = labelWidth;
            
            button.position = {x, y:0}; // this.finalHeight / 2};
            // button.setSize(buttonWidth, this.finalHeight);
            button.dirtyState();

            x += buttonWidth + gap;
        }
    }

    #openMenuForButton(button) {
        const index = this.#menuButtons.indexOf(button);
        if (index === -1) return;

        if (this.#openMenu === this.#menus[index]) {
            this.#closeAllMenus();
            return;
        }

        this.#closeAllMenus();
        
        const menu = this.#menus[index];
        this.#openMenu = menu;

        const buttonX = button.finalX;
        const buttonY = button.finalY;
        const dropdownOffsetY = this.getAttr('dropdownOffsetY', 0) + this.finalHeight + this.getAttr('marginTop', 0) + this.getAttr('marginBottom', 0) + this.getAttr('paddingTop', 0) + this.getAttr('paddingBottom', 0);
        menu.x = buttonX;
        menu.y = buttonY + dropdownOffsetY;
        menu.calculateSize();

        this.addChild(menu);
    }

    #closeAllMenus() {
        if (this.#openMenu) {
            this.removeChild(this.#openMenu);
            this.#openMenu = null;
        }
    }

    #closeMenu(menu) {
        if (this.#openMenu === menu) {
            this.removeChild(menu);
            this.#openMenu = null;
        }
    }

    redraw(state, attrs) {
        super.redraw(state, attrs);
        const frameAttrs = {
            ...attrs,
            backgroundColor: attrs.barColor
        };
        let key = calculateNinePatchKey(frameAttrs);
        let frame = this.#barBackground;
        if (frame.key !== key) {
            let newFrame = createNinePatchFrame(frameAttrs);
            frame.image = newFrame.image;
            frame.margins = newFrame.margins;
            frame.key = newFrame.key;
        }
        frame.setInnerSize(this.finalWidth, this.finalHeight);
        this.#layoutMenuButtons(state, attrs);
    }

    #resizeBackground() {
        this.#barBackground.setPosition(0, 0);
    }

    resize() {
        super.resize();
        this.#barBackground.setInnerSize(this.finalWidth, this.finalHeight);
        this.containerNode.setPosition(0, this.finalHeight / 2);
    }
}
