import { Ctrl } from './Ctrl.js';
import { getImage } from './ImageCache.js';

export class ImageCtrl extends Ctrl {
    #oldImage = null;

    constructor(params = {}) {
        super({color:0xFFFFFFFF, node: new ImageNode()}, params);
        this.image = this.getAttr('image', null);
    }

    set image(img) {
        this.setAttr("image", img);
    }

    get image() {
        return this.getAttr("image", null);
    }

    redraw(state, attrs) {
        super.redraw(state, attrs);
        let img = attrs.image;
        if (img === this.#oldImage)
            return;
        this.#oldImage = img;
        if (typeof img === 'string')
            img = getImage(img);
        this.node.image = img;
        this.dirtySize();
    }

    resizeSelf() {
        super.resizeSelf();
        let width = this.finalWidth;
        let height = this.finalHeight;
        let image = this.node.image;
        if ((width || height) && image) {
            const imageHeight = image.height;
            const imageWidth = image.width;
            let scaleX = 1;
            let scaleY = 1;
            let ratio = imageWidth / imageHeight;
            if (!width) {
                scaleX = scaleY = height / imageHeight;
                width = height * ratio;
            } else if (!height) {
                scaleX = scaleY = width / imageWidth;
                height = width / ratio;
            } else {
                scaleY = height / imageHeight;
                scaleX = width / imageWidth;
            }
            this.setScale(scaleX, scaleY);
            this.node.setScale(scaleX, scaleY);
            // console.log(`Debug img: ${!!image}, w: ${width}, h: ${height}, scaleX: ${scaleX}, scaleY: ${scaleY}`);
        }
    }
}
