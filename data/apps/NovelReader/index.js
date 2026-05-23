import { NovelReaderModel } from './Model.js';
import { NovelReaderView } from './View.js';
import { loadTracks } from './MusicView.js';
import { refreshSettingsView } from './SettingsView.js';
import { refreshImageGenView } from './ImageGenView.js';

class App {
    view;
    window;
    states;
    stateStack = [];
    #currentState;
    model = new NovelReaderModel();

    async init({view, window}) {
        await this.model.init();
        this.view = view;
        this.window = window;

        this.states = [];
        for (let name in view) {
            if (!name.endsWith('View'))
                continue;
            this.states.push(view[name]);
        }

        this.state = 'books';
    }

    get is3DS() {
        return settings.basePath == 'romfs:/';
    }

    popState() {
        if (this.stateStack.length == 0)
            return;
        this.#setStateInternal(this.stateStack.pop() || 'books');
    }

    get state() {
        return this.#currentState;
    }

    pushState(state) {
        if (state == this.#currentState)
            return;
        this.stateStack.push(this.#currentState);
        this.#setStateInternal(state);
    }

    set state(state) {
        if (state == this.#currentState)
            return;
        this.#setStateInternal(state);
    }

    #setStateInternal(state) {
        this.view.bg.node.opacity = state == 'books' || state == 'imageGen' ? 1 : 0.3;
        this.#currentState = state;
        state += 'View';
        for (let ctrl of this.states) {
            ctrl.node.visible = ctrl.node.id == state;
        }
        // Load tracks when entering music view
        if (this.#currentState === 'music') {
            loadTracks().catch(ex => console.error('MusicView loadTracks error:', ex));
        }
        // Refresh settings inputs when entering settings view
        if (this.#currentState === 'settings') {
            refreshSettingsView(this);
        }
        // Initialize image gen inputs when entering image gen view
        if (this.#currentState === 'imageGen') {
            refreshImageGenView(this);
        }
    }

    layout() {
        // Called by RichText onUpdate callbacks
    }

    async saveGeneratedImage(image, type, saveFolder) {
        if (!image || !this.model.currentBook) return;
        try {
            const ncode = this.model.currentBook;
            const ch = this.model.currentChapter;
            const base = type === 'cover'
                ? `${ncode}_${type}`
                : `${ncode}_${type}_ch${ch}`;

            // 1. Save original
            await runGraphAsync({
                nodes: [{
                    id: 'save',
                    type: 'saveimage',
                    params: {
                        image: image,
                        filename: `${saveFolder}/${base}.png`
                    }
                }]
            });
            console.log('Saved original:', base + '.png');

           // 2. 64x64 thumbnail: scale to cover, center crop
            const srcW = image.width;
            const srcH = image.height;
            const thumbScale = Math.max(64 / srcW, 64 / srcH);
            const thumbSW = Math.ceil(srcW * thumbScale);
            const thumbSH = Math.ceil(srcH * thumbScale);
            const thumbCX = Math.floor((thumbSW - 64) / 2);
            const thumbCY = Math.floor((thumbSH - 64) / 2);

            await runGraphAsync({
                nodes: [{
                    id: 'thumbCanvas',
                    type: 'newimage',
                    params: { width: 64, height: 64 }
                }, {
                    id: 'thumbBlit',
                    type: 'blit',
                    params: {
                        source: image,
                        destination: { node: 'thumbCanvas', output: 'image' },
                        dstX: -thumbCX,
                        dstY: -thumbCY,
                        dstW: thumbSW,
                        dstH: thumbSH,
                        linear: true,
                        blendMode: 'copy'
                    }
                }, {
                    id: 'save',
                    type: 'saveimage',
                    params: {
                        image: { node: 'thumbBlit', output: 'image' },
                        filename: `${saveFolder}/${base}_thumb.png`
                    }
                }]
            });
            console.log('Saved thumbnail:', base + '_thumb.png');

            // 3. 400x240 topscreen: scale to cover, center crop
            const coverScale = Math.max(400 / srcW, 240 / srcH);
            const scaledW = Math.ceil(srcW * coverScale);
            const scaledH = Math.ceil(srcH * coverScale);
            const cropX = Math.floor((scaledW - 400) / 2);
            const cropY = Math.floor((scaledH - 240) / 2);

            await runGraphAsync({
                nodes: [{
                    id: 'topCanvas',
                    type: 'newimage',
                    params: { width: 400, height: 240 }
                }, {
                    id: 'scale',
                    type: 'blit',
                    params: {
                        source: image,
                        destination: { node: 'topCanvas', output: 'image' },
                        dstX: -cropX,
                        dstY: -cropY,
                        dstW: scaledW,
                        dstH: scaledH,
                        linear: true,
                        blendMode: 'copy'
                    }
                }, {
                    id: 'save',
                    type: 'saveimage',
                    params: {
                        image: { node: 'scale', output: 'image' },
                        filename: `${saveFolder}/${base}_top.png`
                    }
                }]
            });
            console.log('Saved topscreen:', base + '_top.png');

            return base;
        } catch (ex) {
            console.error('saveGeneratedImage error:', ex);
        }
    }
}

try {
    NovelReaderView(new App());
} catch (ex) {
    console.error(ex);
}
