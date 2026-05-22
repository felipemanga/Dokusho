import { nodeMap, Group, Label, Button, RichText } from '../../utils/gui/GUI.js';
import { fontSmall, fontMedium, fontLarge, buttonRowY, palette } from './Shared.js';

// Metadata view mode: 'novel' | 'chapter' | 'novelPrompt' | 'chapterPrompt'
let _metadataViewMode = 'novel';
export function getMetadataViewMode() { return _metadataViewMode; }
export function setMetadataViewMode(mode) { _metadataViewMode = mode; }

const metadataButtons = ['novel', 'chapter', 'novelPrompt', 'chapterPrompt'];
const metadataLabels = { novel: 'Novel', chapter: 'Chapter', novelPrompt: 'Novel Prompt', chapterPrompt: 'Chapter Prompt' };

function refreshMetadataButtons() {
    for (const mode of metadataButtons) {
        const btn = nodeMap['btnMeta' + mode.charAt(0).toUpperCase() + mode.slice(1)];
        if (!btn) continue;
        const isActive = mode === _metadataViewMode;
        btn.color = isActive ? palette.highlight : palette.textDim;
        btn.backgroundColor = isActive ? 0x44000000 : 0x22000000;
    }
}

export function createLlmView(app) {
    // Top screen: metadata display
    const topScreen = new Group({
        y: 0,
        x: 0,
        width: 400,
        height: 240,
        noFrame: true,
        children: [
            new Label({
                id: 'llmTitle',
                text: 'Translation',
                x: 15,
                y: 5,
                font: fontLarge,
                color: palette.highlight
            }),
            new Label({
                id: 'llmProgressLabel',
                text: '',
                x: 15,
                y: 40,
                font: fontMedium,
                color: palette.textDim
            }),
            new Group({
                id: 'llmProgressBar',
                x: 15,
                y: 60,
                width: 370,
                height: 10,
                backgroundColor: 0x22000000,
                children: [
                    new Group({
                        id: 'llmProgressFill',
                        x: 0,
                        y: 0,
                        width: 0,
                        height: 10,
                        backgroundColor: palette.highlight
                    })
                ]
            }),
            new Group({
                id: 'llmMetadataContainer',
                x: 15,
                y: 80,
                width: 370,
                height: 150,
                // overflow: 'scroll',
                backgroundColor: 0x22000000,
                children: [
                    new RichText({
                        id: 'llmMetadataDisplay',
                        x: 5,
                        y: 5,
                        width: 360,
                        regularSize: 15,
                        codeSize: 10,
                        color: palette.textNormal,
                        linkColor: palette.highlight,
                        quoteTextColor: palette.textNormal,
                        quoteBarColor: 0,
                        quoteBgColor: 0,
                        fontPaths: {
                            regular: 'system',
                            bold: 'system',
                            italic: 'system',
                            boldItalic: 'system',
                            heavy: 'system',
                            mono: 'system'
                        },
                        onUpdate() { this.parent.resizeSelf(); }
                    })
                ]
            })
        ]
    });

    // Bottom screen: action buttons
    const bottomScreen = new Group({
        y: 240,
        width: 320,
        height: 240,
        noFrame: true,
        children: [
            new Button({
                id: 'btnReTranslateLine',
                text: 'Re-translate Line',
                font: fontMedium,
                x: 10,
                y: 30,
                width: 140,
                onClick() {
                    app.model.reTranslateLine().catch(ex => {
                        console.error('Re-translate line failed:', ex);
                        nodeMap.llmStatus.text = 'Error: ' + ex;
                    });
                }
            }),
            new Button({
                id: 'btnContinueTranslation',
                text: 'Continue Translation',
                font: fontMedium,
                x: 170,
                y: 30,
                width: 140,
                onClick() {
                    app.model.translateChapter().catch(ex => {
                        console.error('Continue translation failed:', ex);
                        nodeMap.llmStatus.text = 'Error: ' + ex;
                    });
                }
            }),
            new Button({
                id: 'btnCancelTranslation',
                text: 'Cancel Translation',
                font: fontMedium,
                x: 10,
                y: 70,
                width: 140,
                visible: false,
                onClick() {
                    app.model.cancelTranslation();
                }
            }),
            new Button({
                id: 'btnRestartTranslation',
                text: 'Restart Translation',
                font: fontMedium,
                x: 170,
                y: 70,
                width: 140,
                onClick() {
                    app.model.restartChapterTranslation().catch(ex => {
                        console.error('Restart translation failed:', ex);
                        nodeMap.llmStatus.text = 'Error: ' + ex;
                    });
                }
            }),
            new Button({
                id: 'btnUpdateWord',
                text: 'Re-translate Word',
                font: fontMedium,
                x: 10,
                y: 70,
                width: 300,
                onClick() {
                    nodeMap.llmStatus.text = 'Updating word...';
                    app.model.reTranslateWord().then(() => {
                        updateLlmView(app);
                    }).catch(ex => {
                        console.error('Update word failed:', ex);
                        nodeMap.llmStatus.text = 'Error: ' + ex;
                    });
                }
            }),
            // Metadata buttons
            new Button({
                id: 'btnUpdateNovelMetadata',
                text: 'Update Novel Metadata',
                font: fontSmall,
                x: 10,
                y: 110,
                width: 140,
                onClick() {
                    nodeMap.llmStatus.text = 'Updating novel metadata...';
                    app.model.updateNovelMetadata().then(() => {
                        updateLlmView(app);
                        nodeMap.llmStatus.text = 'Novel metadata updated';
                    }).catch(ex => {
                        console.error('Update novel metadata failed:', ex);
                        nodeMap.llmStatus.text = 'Error: ' + ex;
                    });
                }
            }),
            new Button({
                id: 'btnUpdateChapterMetadata',
                text: 'Update Chapter Metadata',
                font: fontSmall,
                x: 170,
                y: 110,
                width: 140,
                onClick() {
                    nodeMap.llmStatus.text = 'Updating chapter metadata...';
                    app.model.updateChapterMetadata().then(() => {
                        updateLlmView(app);
                        nodeMap.llmStatus.text = 'Chapter metadata updated';
                    }).catch(ex => {
                        console.error('Update chapter metadata failed:', ex);
                        nodeMap.llmStatus.text = 'Error: ' + ex;
                    });
                }
            }),
            // Metadata filter buttons
            new Button({
                id: 'btnMetaNovel',
                text: 'Novel',
                font: fontSmall,
                x: 10,
                y: 150,
                width: 72,
                color: palette.highlight,
                backgroundColor: 0x44000000,
                onClick() {
                    setMetadataViewMode('novel');
                    refreshMetadataButtons();
                    updateMetadataDisplay(app);
                }
            }),
            new Button({
                id: 'btnMetaChapter',
                text: 'Chapter',
                font: fontSmall,
                x: 90,
                y: 150,
                width: 72,
                color: palette.textDim,
                backgroundColor: 0x22000000,
                onClick() {
                    setMetadataViewMode('chapter');
                    refreshMetadataButtons();
                    updateMetadataDisplay(app);
                }
            }),
            new Button({
                id: 'btnMetaNovelPrompt',
                text: 'Novel Prompt',
                font: fontSmall,
                x: 170,
                y: 150,
                width: 72,
                color: palette.textDim,
                backgroundColor: 0x22000000,
                onClick() {
                    setMetadataViewMode('novelPrompt');
                    refreshMetadataButtons();
                    updateMetadataDisplay(app);
                }
            }),
            new Button({
                id: 'btnMetaChapterPrompt',
                text: 'Chapter Prompt',
                font: fontSmall,
                x: 250,
                y: 150,
                width: 72,
                color: palette.textDim,
                backgroundColor: 0x22000000,
                onClick() {
                    setMetadataViewMode('chapterPrompt');
                    refreshMetadataButtons();
                    updateMetadataDisplay(app);
                }
            }),
            new Label({
                id: 'llmStatus',
                text: '',
                x: 10,
                y: 5,
                font: fontSmall,
                color: palette.textDim
            }),
            new Button({
                id: 'btnLlmBack',
                text: 'Back',
                font: fontMedium,
                x: 260,
                y: buttonRowY,
                onClick() { app.popState(); }
            })
        ]
    });

    return new Group({
        id: "llmView",
        x: 0,
        y: 0,
        width: 400,
        height: 480,
        noFrame: true,
        visible: false,
        children: [topScreen, bottomScreen]
    });
}

export function updateTranslationProgress(app) {
    const { total, current, running } = app.model.translationProgress;

    // Update old progress nodes (if they still exist somewhere)
    if (nodeMap.progressLabel) {
        if (running && total > 0) {
            nodeMap.progressLabel.visible = true;
            nodeMap.progressBar.visible = true;
            nodeMap.progressLabel.text = `Translating... ${current}/${total}`;
            const pct = current / total;
            nodeMap.progressFill.width = Math.floor(380 * pct);
        } else if (current > 0) {
            nodeMap.progressLabel.visible = true;
            nodeMap.progressBar.visible = true;
            nodeMap.progressLabel.text = `Translation complete (${current}/${total})`;
            nodeMap.progressFill.width = 380;
        } else {
            nodeMap.progressLabel.visible = false;
            nodeMap.progressBar.visible = false;
        }
    }

    // Update LLM view progress
    updateLlmView(app);
}

export function updateLlmView(app) {
    const { running } = app.model.translationProgress;
    const line = app.model.getCurrentLine();

    // Compute actual translation counts from content lines
    const lines = app.model.getContentLines();
    const total = lines.length;
    const current = lines.filter(l => l.english).length;

    // Progress label
    if (running && total > 0) {
        const progCurrent = app.model.translationProgress.current;
        nodeMap.llmProgressLabel.text = `Translating... ${progCurrent}/${total}`;
        const pct = progCurrent / total;
        nodeMap.llmProgressFill.width = Math.floor(370 * pct);
    } else if (current > 0) {
        nodeMap.llmProgressLabel.text = `${current}/${total} lines translated`;
        const pct = current / total;
        nodeMap.llmProgressFill.width = Math.floor(370 * pct);
    } else {
        nodeMap.llmProgressLabel.text = `No translation yet (${total} lines)`;
        nodeMap.llmProgressFill.width = 0;
    }

    // Button visibility
    nodeMap.btnContinueTranslation.visible = !running && total > 0 && current < total;
    nodeMap.btnCancelTranslation.visible = running;
    nodeMap.btnReTranslateLine.visible = !!line && !running;
    nodeMap.btnRestartTranslation.visible = !running && !!app.model.chapterContent;
    const word = app.model.getCurrentWord();
    nodeMap.btnUpdateWord.visible = !running && word && typeof word === 'object';

    // Status
    if (running) {
        nodeMap.llmStatus.text = 'Translation in progress...';
    } else if (current >= total && total > 0) {
        nodeMap.llmStatus.text = 'All lines translated';
    } else if (current > 0) {
        nodeMap.llmStatus.text = `${current}/${total} lines translated`;
    } else {
        nodeMap.llmStatus.text = 'Ready to translate';
    }

    // Metadata display
    refreshMetadataButtons();
    updateMetadataDisplay(app).catch(ex => console.error('updateMetadataDisplay error:', ex));
}

export async function updateMetadataDisplay(app) {
    const model = app.model;
    if (!model.currentBook || !nodeMap.llmMetadataDisplay) return;

    const novelMeta = model.getNovelMetadata(model.currentBook);
    const chapterMeta = await model.getChapterMetadata();
    const mode = _metadataViewMode;

    let md = '';

    switch (mode) {
    case 'novel':
        if (Object.keys(novelMeta).length > 0) {
            md += '**Novel**\n';
            if (novelMeta.protagonistName) md += `Protagonist: ${novelMeta.protagonistName}\n`;
            if (novelMeta.protagonistGender) md += `Gender: ${novelMeta.protagonistGender}\n`;
            if (novelMeta.protagonistAge) md += `Age: ${novelMeta.protagonistAge}\n`;
            if (novelMeta.novelGenre) md += `Genre: ${novelMeta.novelGenre}\n`;
            if (novelMeta.storySetting) md += `Setting: ${novelMeta.storySetting}\n`;
            if (novelMeta.atmosphere) md += `Atmosphere: ${novelMeta.atmosphere}\n`;
            if (novelMeta.artStyle) md += `Art Style: ${novelMeta.artStyle}\n`;
            if (novelMeta.protagonistPhysicalDescription) md += `Appearance: ${novelMeta.protagonistPhysicalDescription}\n`;
            if (novelMeta.protagonistOutfit) md += `Outfit: ${novelMeta.protagonistOutfit}\n`;
        } else {
            md = '*No novel metadata yet. Click Update to generate.*';
        }
        break;

    case 'chapter':
        if (Object.keys(chapterMeta).length > 0) {
            md += '**Chapter**\n';
            if (chapterMeta.chapterSummary) md += `Summary: ${chapterMeta.chapterSummary}\n`;
            if (chapterMeta.keyScene) md += `Key Scene: ${chapterMeta.keyScene}\n`;
            if (chapterMeta.charactersPresent) md += `Characters: ${chapterMeta.charactersPresent}\n`;
            if (chapterMeta.sceneSetting) md += `Scene: ${chapterMeta.sceneSetting}\n`;
            if (chapterMeta.emotionalTone) md += `Tone: ${chapterMeta.emotionalTone}\n`;
        } else {
            md = '*No chapter metadata yet. Click Update to generate.*';
        }
        break;

    case 'novelPrompt':
        if (novelMeta.coverImagePrompt) {
            md += '**Cover Image Prompt**\n\n';
            md += novelMeta.coverImagePrompt;
        } else {
            md = '*No cover image prompt yet. Update novel metadata to generate.*';
        }
        break;

    case 'chapterPrompt':
        if (chapterMeta.backgroundImagePrompt) {
            md += '**Background Image Prompt**\n\n';
            md += chapterMeta.backgroundImagePrompt;
        } else {
            md = '*No background image prompt yet. Update chapter metadata to generate.*';
        }
        break;
    }

    nodeMap.llmMetadataDisplay.markdown = md;
}

export async function handleLlmKeyDown(app, event) {
    const { key } = event;
    switch (key) {
    case 'b':
        app.popState();
        break;
    }
}
