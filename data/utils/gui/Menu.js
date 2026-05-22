import { Group } from './Group.js';
import { MenuItem } from './MenuItem.js';

export class Menu extends Group {
    #items = [];

    constructor(params = {}) {
        super({
            node: new Node(),
            floating: true,
            ...params
        });
    }

    addItem(item) {
        this.#items.push(item);
        this.addChild(item);
    }

    removeItem(item) {
        const index = this.#items.indexOf(item);
        if (index === -1) return;
        this.removeChild(item);
        this.#items.splice(index, 1);
    }

    clearItems() {
        for (const item of this.#items) {
            this.removeChild(item);
        }
        this.#items = [];
    }

    getItems() {
        return [...this.#items];
    }

    calculateSize() {
        const attrs = this.attrs;

        const paddingLeft = attrs.paddingLeft ?? attrs.padding ?? 0;
        const paddingRight = attrs.paddingRight ?? attrs.padding ?? 0;
        const paddingX = paddingLeft + paddingRight;
        const paddingTop = attrs.paddingTop ?? attrs.padding ?? 0;
        const paddingBottom = attrs.paddingBottom ?? attrs.padding ?? 0;
        const paddingY = paddingTop + paddingBottom;

        const marginLeft = attrs.marginLeft ?? attrs.margin ?? 0;
        const marginRight = attrs.marginRight ?? attrs.margin ?? 0;
        const marginX = marginLeft + marginRight;
        const marginTop = attrs.marginTop ?? attrs.margin ?? 0;
        const marginBottom = attrs.marginBottom ?? attrs.margin ?? 0;
        const marginY = marginTop + marginBottom;

        const itemHeight = attrs.itemHeight ?? 0;
        let y = paddingTop;
        let my = 0;

        let itemWidth = 0;
        for (const item of this.#items) {
            let itemPadding = (item.attrs.paddingLeft ?? 0) + (item.attrs.paddingRight ?? 0);
            let itemMargin = (item.attrs.marginLeft ?? 0) + (item.attrs.marginRight ?? 0);
            itemWidth = Math.max(itemWidth, item.innerWidth + itemPadding + itemMargin);
        }

        for (const item of this.#items) {
            y += Math.max(my, item.attrs.marginTop ?? 0);
            item.y = y;
            y += item.attrs.paddingTop ?? 0;
            y += item.height ?? 0;
            y += item.attrs.paddingBottom ?? 0;
            my = item.attrs.marginBottom ?? 0;
            item.x = paddingLeft + item.attrs.marginLeft;
            item.width = itemWidth;
        }

        this.setSize(itemWidth + paddingX + marginX, y + paddingBottom);
    }
}
