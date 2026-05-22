import { Ctrl } from './Ctrl.js';
import { getFont } from './FontCache.js';
import { Markdown } from '../Markdown.js';

export class RichText extends Ctrl {
    #segments = [];
    #lineSpacing = 0;
    onUpdate = null;
    onHotspotClick = null;
    #align = 'left';
    #hotspots = [];

    #raw;
    #rawFormat;

    constructor(params = {}) {
        super({node:new ImageNode(), ...params});
        let segments = this.getAttr('segments', []);
        if (segments)
            this.segments = segments;
        this.#lineSpacing = this.getAttr('lineSpacing', 0);
        this.onUpdate = this.getAttr('onUpdate', null);
        this.onHotspotClick = this.getAttr('onHotspotClick', null);
        this.#align = this.getAttr('align', 'left');
        this.addEventListener('mouseup', (e) => this.#onMouseUp(e));

        let mdText = this.getAttr('markdown', null);
        if (mdText) {
            this.markdown = mdText;
        } else {
            let text = this.getAttr('text', null);
            if (text)
                this.text = text;
        }
    }

    redraw() {
        if (this.#segments.length > 0) {
            this.update();
        }
    }

    set segments(segments) {
        if (!Array.isArray(segments))
            return;
        this.#segments = segments;
        this.#rawFormat = 'segments'
        this.dirtyState();
    }

    set markdown(mdText) {
        if (typeof mdText != 'string')
            return;
        this.#raw = mdText;
        this.#rawFormat = 'markdown';
        this.dirtyState();
    }

    set text(text) {
        this.#raw = String(text);
        this.#rawFormat = 'text';
        this.dirtyState();
    }

    redraw(state, attrs) {
        this.update();
    }

    async update() {
        if (this.#rawFormat == 'markdown') {
            this.#segments = Markdown.render(this.#raw, this.attrs);
            this.#rawFormat = 'segments';
            this.#raw = '';
        }

        if (this.#rawFormat == 'text') {
            this.#segments = [{text:this.#raw, font: this.attrs.font, color: this.attrs.color}];
            this.#rawFormat = 'segments';
            this.#raw = '';
        }

        if (this.#rawFormat == 'segments') {
            this.#rawFormat = '';
            try {
                const dataMap = new Map();
                let nextDataId = 1;

                const processedSegments = this.#segments.map(seg => {
                    let s = { ...seg };
                    if (typeof s.font === 'string') {
                        s.font = getFont(s.font);
                    }
                    if (s.data !== undefined) {
                        const id = nextDataId++;
                        dataMap.set(id, s.data);
                        s.data = id;
                    }
                    return s;
                });

                const pipeline = {
                    nodes: [
                        {
                            id: 'rich_text_node',
                            type: 'richtext',
                            params: {
                                image: null,
                                segments: processedSegments,
                                lineSpacing: this.#lineSpacing,
                                width: this.finalWidth,
                                align: this.#align
                            }
                        }
                    ],
                    pipelineOutputs: {
                        image: { node: 'rich_text_node', output: 'image' },
                        hotspots: { node: 'rich_text_node', output: 'hotspots' }
                    }
                };

                const results = await runGraphAsync(pipeline, {});
                if (results.image) {
                    this.node.image = results.image;
                    this.#hotspots = (results.hotspots || []).map(h => {
                        if (h.data !== undefined) {
                            const data = dataMap.get(h.data);
                            return { ...h, data };
                        }
                        return h;
                    });

                    this.height = results.image.height;
                    if (this.onUpdate) {
                        this.onUpdate({target:this});
                    }
                }
            } catch (e) {
                console.error('Failed to update RichText:', e);
            }
        }
    }

    set textSegments(segments) {
        this.#segments = segments;
        this.update();
    }

    getHotspot(x, y) {
        for (const h of this.#hotspots) {
            if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) {
                return h.data;
            }
        }
        return null;
    }

    #onMouseUp(e) {
        if (typeof this.onHotspotClick == 'function') {
            const local = this.toLocal(e.x, e.y);
            const hotspot = this.getHotspot(local.x, local.y);
            if (hotspot) {
                this.onHotspotClick(hotspot);
            }
        }
    }
}
