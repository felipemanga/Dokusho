import { nodeMap, Root, RichText, Group, Label, Button, TextInput, ImageCtrl } from '../utils/gui/GUI.js';
import GUI from '../utils/gui/GUI.js';
import { Event } from '../utils/EventDispatcher.js';
import { imageGen } from '../utils/ImageGen.js';
import { simplePrompt } from '../utils/llama.js';
import { getFont } from '../utils/gui/FontCache.js';
import {PromptTemplate} from '../utils/PromptTemplate.js'

const SaveFolder = (settings.basePath == 'romfs:/' ? 'sdmc:/' : '') + settings.imageGenPath;
const PanSpeed = 50;
const font = 'regular 11px';
const S = 1024;
const window = new Window(400, 240 * 2);
window.backgroundColor = 0xFF555588 >>> 0;
let clickCount = 0;
let enabled = true;

let zoom = 0;
const fitZoom = 0;

let mic;
let micTimeout;

let template;
let localSettings = {};

const app = {
    init() {
        GUI.addEventListener('textReplace', (event) => this.prompt = event.text);
        GUI.addEventListener('keydown', (event) => this.keyDown(event));
        GUI.addEventListener('keyup', (event) => this.keyUp(event));
        this.updateScale();
        this.loadSettings();
    },

    get prompt() {
        return String(localSettings.prompt ?? settings.imageGenPrompt);
    },

    set prompt(prompt) {
        prompt = String(prompt);
        if (localSettings.prompt == prompt)
            return;
        localSettings.prompt = prompt;
        this.saveSettings();
        if (nodeMap.prompt)
            nodeMap.prompt.text = prompt;
    },

    genPromptA() {
        this.seedA = 0;
        this.prompt = this.template;
    },
    genPromptB() {
        this.seedB = 0;
        this.prompt = this.template;
    },

    get seedA() {
        return localSettings.seedA = localSettings.seedA ?? Math.random()*(-1>>>0)>>>0;
    },
    set seedA(v) {
        localSettings.seedA = v || null;
    },
    get seedB() {
        return localSettings.seedB = localSettings.seedB ?? Math.random()*(-1>>>0)>>>0;
    },
    set seedB(v) {
        localSettings.seedB = v || null;
    },

    get template() {
        if (!template) {
            template = new PromptTemplate(this.meta);
        }
        return template.run(this.seedA, this.seedB, {obsession:true});
    },

    get meta() {
        return String(localSettings.meta ?? settings.imageGenMeta);
    },

    set meta(meta) {
        meta = String(meta);
        if (localSettings.meta == meta)
            return;
        template = null;
        localSettings.meta = meta;
        this.saveSettings();
    },

    async loadSettings() {
        try {
            localSettings = JSON.parse(await fs.readFile(SaveFolder + '/settings.json'));
        } catch (ex) {
            this.saveSettings();
        }
        if (nodeMap.prompt)
            nodeMap.prompt.text = this.prompt;
    },

    async saveSettings() {
        try {
            await fs.writeFile(SaveFolder + '/settings.json', JSON.stringify(localSettings));
        } catch (ex) {
            this.setStatus(ex);
        }
    },

    keyDown({key}) {
        let func = this['onPress' + key];
        // this.setStatus(key + ' press:' + !!func);
        if (typeof func == 'function')
            func.call(this);
    },

    keyUp({key}) {
        let func = this['onRelease' + key];
        // this.setStatus(key + ' release:' + !!func);
        if (typeof func == 'function')
            func.call(this);
    },

    startRecording() {
        try {
            if (!mic) {
                mic = new Microphone();
                mic.sampleRate = 8000;
                mic.bitsPerSample = 8;
                mic.gain = 0;
            }
            if (mic.start(SaveFolder + "/sound.wav")) {
                micTimeout = setTimeout(_=>this.stopRecording(), 5000);
                this.setStatus('Recording');
            } else {
                this.setStatus('Not Recording');
            }
        } catch (ex) {
            this.setStatus(ex);
        }
    },

    stopRecording() {
        mic.stop();
        this.setStatus('Stop Recording');
        const s = new Sound(SaveFolder + "/sound.wav");
        s.play();
        clearTimeout(micTimeout);
    },

    onPressl() {
        nodeMap.img.visible = !nodeMap.img.visible;
        this.setStatus(nodeMap.img.visible ? ">_<" : "o_o");
    },
    onPressZLeft() {this.generate();},

    onPressr() {this.genPromptB();},
    onPressZRight() {this.genPromptA();},

    onPressSelect() {this.startRecording();},
    onReleaseSelect() {this.stopRecording();},

    onPressEnter() {exit();},
    onPressa() {this.load();},
    onPressx() {this.edit();},
    onPressy() {this.save();},

    onPressArrowUp() {this.zoomIn();},
    onPressArrowDown() {this.zoomOut();},
    onPressArrowLeft() {this.zoomFit();},
    onPressArrowRight() {this.zoom100();},

    onPressPadLeft() {this.updatePan(1, 0);},
    onPressPadRight() {this.updatePan(-1, 0);},
    onPressPadUp() {this.updatePan(0, 1);},
    onPressPadDown() {this.updatePan(0, -1);},

    // onPressj() {this.updatePan(1, 0);},
    // onPressl() {this.updatePan(-1, 0);},
    // onPressi() {this.updatePan(0, 1);},
    // onPressk() {this.updatePan(0, -1);},

    zoomIn() {
        zoom *= 1.1;
        if (zoom > 2)
            zoom = 2;
        this.updateScale();
    },

    zoomOut() {
        zoom *= 0.9;
        if (zoom < fitZoom)
            zoom = fitZoom;
        this.updateScale();
    },

    zoom100() {
        zoom = 1;
        this.updateScale();
    },

    zoomFit() {
        zoom = fitZoom;
        this.updateScale();
    },

    updateScale() {
        this.setStatus('Zoom:' + (zoom*100|0));
        const ctrl = nodeMap.img;
        const image = ctrl?.node?.image;
        if (!image)
            return;

        const w = image.width;
        const h = image.height;
        const oldW = ctrl.width;
        const oldH = ctrl.height;
        const oldZoom = oldW / w;
        const oldX = ctrl.x * oldZoom;
        const oldY = ctrl.y * oldZoom;

        const min = Math.min(400/w, 240/h);
        zoom = Math.max(zoom, min);
        const sw = w * zoom;
        const sh = h * zoom;
        ctrl.width = sw;
        ctrl.height = sh;
        ctrl.x = ((oldX - 200) * (zoom / oldZoom) + 200) / zoom;
        ctrl.y = ((oldY - 120) * (zoom / oldZoom) + 120) / zoom;
        this.updatePan(0, 0);
    },

    updatePan(offX, offY) {
        const ctrl = nodeMap.img;
        const sw = ctrl.width;
        const cx = sw/2;
        let x = ctrl.x * zoom;
        if (sw <= 400) {
            x = 400/2 - cx;
        } else {
            x += offX * PanSpeed * zoom;
            x = Math.min(0, x);
            x = Math.max(400 - sw, x);
        }
        ctrl.x = x / zoom;

        const sh = ctrl.height;
        const cy = sh/2;
        let y = ctrl.y * zoom;
        if (sh <= 240) {
            y = 240/2 - cy;
        } else {
            y += offY * PanSpeed * zoom;
            y = Math.min(0, y);
            y = Math.max(240 - sh, y);
        }
        ctrl.y = y / zoom;
    },

    async load() {
        nodeMap.img.node.image = null;
        try {
            const files = (await fs.listDir(SaveFolder))
                  .filter(e => e.isFile && /\.png$/.test(e.name))
                  .map(e => e.name);
            const pick = files[Math.random() * files.length | 0];
            if (!pick)
                return;
            const image = nodeMap.img.node.image = new Image(SaveFolder + '/' + pick);
            this.zoomFit();
            if (!image)
                return;

            const {text} = await runGraphAsync({
                nodes: [{
                    id: "bd",
                    type: "decodeText",
                    params: { image }
                }],
                pipelineOutputs: { text: { node: "bd", output: "text" } }
            });
            this.prompt = text;
        } catch (ex) {
            nodeMap.prompt.text = ex + '';
            console.log(ex);
        }
    },

    async save(image) {
        try {
            const uid = String(Math.random() * 0xFFFFFF|0);
            const name = SaveFolder + '/' + uid + '.png';
            const image = nodeMap.img.node.image;
            if (!image)
                return;

            nodeMap.description.text = `Saving...`;
            await image.save(name);
            nodeMap.description.text = `Saved: ` + uid;
            return;
        } catch (ex) {
            nodeMap.description.text = ex + '';
        }
    },

    setStatus(status) {
        nodeMap.description.text = String(status);
    },

    edit() {
        window.showTextInput(this.prompt);
    },

    async generate() {
        let text = this.prompt;
        this.setStatus(`Generating...`);
        try {
            nodeMap.img.node.image = null;
            let image = nodeMap.img.node.image = await imageGen(text, S, S * (240 / 400) | 0);
            app.updateScale();

            this.setStatus(`Encoding`);
            await runGraphAsync({
                nodes: {
                    encode: {
                        type: "encodeText",
                        params: {
                            image,
                            text
                        }
                    }
                }
            });

            this.setStatus(`Ready`);
        } catch (ex) {
            this.setStatus(ex);
        }
    }
};

(new Root({
    id:"root",
    children:[
        new Group({
            id: "imgview",
            width: 400,
            height: 240,
            noFrame: true,
            children: [
                new ImageCtrl({
                    id: "img",
                    floating:true,
                    // x:400/2,
                    // y:240/2,
                    // anchorX:0,
                    // anchorY:0,
                    // height: 240,
                    // image: "IGDeltaAI/1191099.png"
                }),
            ]
        }),

        new Label({
            id: 'description',
            text: settings.basePath,
            x: 10,
            y: 240,
            font: "regular 9px"
        }),

        new Group({
            x: 10,
            y: 255,
            width: 320 - 20,
            height: 190,
            overflow: 'scroll',
            id: 'container',
            backgroundColor: 0x11000000 >>> 0,
            children:[
                new RichText({
                    x: 5,
                    width: 270,
                    id:"prompt",
                    text: app.prompt,
                    font: 'regular 12px',
                    onUpdate() {nodeMap.container.resizeSelf();}
                })
            ]
        }),

        new Button({
            id:"loadBtn",
            text: 'A: Load',
            font,
            x: 8,
            y: 465,
            onClick() {app.load();}
        }),

        new Button({
            id:"saveBtn",
            text: 'Y: Save',
            font,
            x: 60,
            y: 465,
            onClick() {app.save();}
        }),

        new Button({
            id:"edit",
            text: 'X: Edit',
            font,
            x: 110,
            y: 465,
            onClick() {app.edit();}
        }),

        new Button({
            id:"btn",
            text: 'ZL: Generate',
            font,
            x: 160,
            y: 465,
            onClick() {app.generate();}
        }),

        new Button({
            id:"exitBtn",
            text: 'Exit',
            font,
            x: 280,
            y: 465,
            onClick() {exit();}
        })
    ]
})).show(window);

app.init();
