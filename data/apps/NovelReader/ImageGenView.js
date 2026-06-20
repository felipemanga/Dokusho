import { nodeMap, Group, Label, Button, TextInput, RichText } from '../../utils/gui/GUI.js';
import { StableDiffusion } from '../../utils/StableDiffusion.js';
import { fontSmall, fontMedium, fontLarge, buttonRowY, palette, getImgMode, setImgMode, getBgPath, setBG, getSdEndpoint, getNovelImageFolder, nrSettings, saveNrSettings } from './Shared.js';

const btnW = 45;
const btnStride = btnW + 15;
const btnH = 16;

let prompt = '';

export function createImageGenView(app) {
    // SD client using custom endpoint
    const sdClient = new StableDiffusion(getSdEndpoint());

    // Reuse nodeMap.bg for preview to avoid loading two large bitmaps (VRAM constraint on 3DS)
    const topScreen = new Group({
        y: 0,
        x: 0,
        width: 400,
        height: 240,
        noFrame: true,
        children: []
    });

    const bottomScreen = new Group({
        y: 240,
        width: 320,
        height: 240,
        noFrame: true,
        children: [
            // Title + mode toggle + status
            new Label({
                id: 'imgGenTitle',
                text: 'Images',
                x: 15,
                y: 220,
                font: fontLarge,
                color: palette.highlight
            }),
            new Group({
                id: 'btnImgModeCover',
                x: 10,
                y: 15,
                width: 60,
                height: 15,
                children:[
                    new Label({
                        font: fontSmall,
                        text: 'Cover',
                        color: palette.textNormal
                    })
                ],
                onClick() {
                    setImgMode('cover');
                    refreshImgGenPrompt(app).catch(ex => console.error('refreshImgGenPrompt error:', ex));
                    updateImgGenModeButtons();
                }
            }),
            new Group({
                id: 'btnImgModeChapter',
                x: 85,
                y: 15,
                width: 80,
                height: 15,
                children:[
                    new Label({
                        text: 'Chapter BG',
                        font: fontSmall,
                        color: palette.textNormal
                    })
                ],
                onClick() {
                    setImgMode('background');
                    refreshImgGenPrompt(app).catch(ex => console.error('refreshImgGenPrompt error:', ex));
                    updateImgGenModeButtons();
                }
            }),
            new Label({
                id: 'imgGenStatus',
                text: '[STATUS]',
                x: 180,
                y: 17,
                font: fontSmall,
                color: palette.textDim
            }),
            // Prompt input
            new Group({
                overflow: 'scroll',
                x: 10,
                y: 48,
                width: 300,
                height: 100,
                backgroundColor: 0x22000000,
                children: [
                    new RichText({
                        id: 'imgGenPrompt',
                        x: 0,
                        y: 0,
                        width: 270,
                        font: fontSmall,
                        onUpdate() {this.parent.resizeSelf();}
                    })
                ]
            }),
            new TextInput({
                id: 'imgGenPromptPostfix',
                x: 10,
                y: 160,
                width: 140,
                font: fontSmall,
                // text: nrSettings.imgGenPostfix ?? settings.imageGenPrompt,
                placeholder: 'Prompt...'
            }),
            // Negative prompt
            new TextInput({
                id: 'imgGenNegative',
                x: 165,
                y: 160,
                width: 140,
                font: fontSmall,
                // text: nrSettings.imgGenNegative ?? 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality',
                placeholder: 'Negative prompt...'
            }),
            // Size + steps row
            new Label({
                text: 'W:',
                x: 10,
                y: 195,
                font: fontSmall,
                color: palette.textDim
            }),
            new TextInput({
                id: 'imgGenWidth',
                x: 25,
                y: 192,
                width: 50,
                font: fontSmall,
                text: nrSettings.imgGenWidth ?? '1024'
            }),
            new Label({
                text: 'H:',
                x: 110,
                y: 195,
                font: fontSmall,
                color: palette.textDim
            }),
            new TextInput({
                id: 'imgGenHeight',
                x: 125,
                y: 192,
                width: 50,
                font: fontSmall,
                // text: nrSettings.imgGenHeight ?? '1024'
            }),
            new Label({
                text: 'Steps:',
                x: 220,
                y: 195,
                font: fontSmall,
                color: palette.textDim
            }),
            new TextInput({
                id: 'imgGenSteps',
                x: 255,
                y: 192,
                width: 50,
                font: fontSmall,
                // text: nrSettings.imgGenSteps ?? '30'
            }),
            // Buttons
            new Button({
                id: 'btnImgGenGenerate',
                text: 'Generate',
                font: fontMedium,
                x: 320 - (btnStride) * 3,
                y: buttonRowY,
                width: btnW,
                height: btnH,
                onClick() {
                    generateImage(app, sdClient);
                }
            }),
            new Button({
                id: 'btnImgGenSave',
                text: 'Save',
                font: fontMedium,
                x: 320 - (btnStride) * 2,
                y: buttonRowY,
                width: btnW,
                height: btnH,
                onClick() {
                    saveGeneratedImage(app);
                }
            }),
            new Button({
                id: 'btnImgGenBack',
                text: 'Back',
                font: fontMedium,
                x: 320 - (btnStride) * 1,
                y: buttonRowY,
                width: btnW,
                height: btnH,
                onClick() { app.popState(); }
            })
        ]
    });

    return new Group({
        id: "imageGenView",
        x: 0,
        y: 0,
        width: 400,
        height: 480,
        noFrame: true,
        visible: false,
        children: [topScreen, bottomScreen]
    });

    async function generateImage(app, sd) {
        const fullPrompt = [prompt, nodeMap.imgGenPromptPostfix.text].join(', ');
        if (!fullPrompt) {
            nodeMap.imgGenStatus.text = 'Enter a prompt first';
            return;
        }

        const negativePrompt = nodeMap.imgGenNegative.text;
        const width = parseInt(nodeMap.imgGenWidth.text) || 512;
        const height = parseInt(nodeMap.imgGenHeight.text) || 512;
        const steps = parseInt(nodeMap.imgGenSteps.text) || 20;

        nrSettings.imgGenPostfix = nodeMap.imgGenPromptPostfix.text || '';
        nrSettings.imgGenNegative = negativePrompt;
        nrSettings.imgGenWidth = width;
        nrSettings.imgGenHeight = height;
        nrSettings.imgGenSteps = steps;
        await saveNrSettings();

        nodeMap.imgGenStatus.text = 'Generating...';
        nodeMap.btnImgGenGenerate.visible = false;

        try {
            const image = await sd.txt2img(fullPrompt, {
                width,
                height,
                steps,
                negativePrompt,
                cfgScale: 7.0,
                seed: -1
            });
            const imagePath = (settings.basePath == 'romfs:/' ? 'sdmc:/' : '') + getBgPath() + '/generated_' + Date.now() + '.png';
            setBG(nodeMap.bg, image, imagePath);
            nodeMap.imgGenStatus.text = 'Done';
        } catch (ex) {
            console.error('Image generation failed:', ex);
            nodeMap.imgGenStatus.text = 'Error: ' + ex.message;
        } finally {
            nodeMap.btnImgGenGenerate.visible = true;
        }
    }

    async function saveGeneratedImage(app) {
        const img = nodeMap.bg.node.image;
        if (!img) {
            nodeMap.imgGenStatus.text = 'No image to save';
            return;
        }
        const type = getImgMode() === 'cover' ? 'cover' : 'bg';
        const SaveFolder = getNovelImageFolder();
        nodeMap.imgGenStatus.text = 'Saving...';
        const base = await app.saveGeneratedImage(img, type, SaveFolder);
        if (base) {
            nodeMap.imgGenStatus.text = 'Saved: ' + base + ' (+thumb +top)';
        } else {
            nodeMap.imgGenStatus.text = 'Save failed';
        }
    }
}

export function updateImgGenModeButtons() {
    if (nodeMap.btnImgModeCover) {
        nodeMap.btnImgModeCover.backgroundColor = getImgMode() === 'cover'
            ? palette.highlight & 0x33FFFFFF
            : palette.contrast;
    }
    if (nodeMap.btnImgModeChapter) {
        nodeMap.btnImgModeChapter.backgroundColor = getImgMode() === 'background'
            ? palette.highlight & 0x33FFFFFF
            : palette.contrast;
    }
}

// Called when entering image gen view to pre-fill prompt from metadata
export function refreshImageGenView(app) {
    if (nodeMap.imgGenPromptPostfix) nodeMap.imgGenPromptPostfix.text = nrSettings.imgGenPostfix ?? settings.imageGenPrompt;
    if (nodeMap.imgGenNegative) nodeMap.imgGenNegative.text = nrSettings.imgGenNegative ?? 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality';
    if (nodeMap.imgGenWidth) nodeMap.imgGenWidth.text = nrSettings.imgGenWidth ?? '1024';
    if (nodeMap.imgGenHeight) nodeMap.imgGenHeight.text = nrSettings.imgGenHeight ?? '1024';
    if (nodeMap.imgGenSteps) nodeMap.imgGenSteps.text = nrSettings.imgGenSteps ?? '30';
    refreshImgGenPrompt(app).catch(ex => console.error('refreshImgGenPrompt error:', ex));
}

export async function refreshImgGenPrompt(app) {
    const model = app.model;
    if (!model.currentBook || !nodeMap.imgGenPrompt) {
        nodeMap.imgGenPrompt.text = `[EMPTY]`;
        return;
    }

    if (getImgMode() === 'cover') {
        const meta = model.getNovelMetadata(model.currentBook);
        prompt = meta.coverImagePrompt || '';
    } else {
        const meta = await model.getChapterMetadata();
        prompt = meta.backgroundImagePrompt || '';
    }

    nodeMap.imgGenPrompt.text = prompt;
    updateImgGenModeButtons();
}

export async function handleImageGenKeyDown(app, event) {
    const { key } = event;
    switch (key) {
    case 'b':
        app.popState();
        break;
    case 'a':
        // Trigger generate on 'a' button
        if (nodeMap.btnImgGenGenerate) {
            nodeMap.btnImgGenGenerate.onClick();
        }
        break;
    }
}
