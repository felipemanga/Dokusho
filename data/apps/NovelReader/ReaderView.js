import { nodeMap, Group, Label, Button, RichText } from '../../utils/gui/GUI.js';
import { fontSmall, fontMedium, buttonRowY, palette, getTextFont, getTextFontSize, setTextFontSize, getAltMode } from './Shared.js';
import { updateLlmView } from './LlmView.js';
import { refreshImgGenPrompt } from './ImageGenView.js';
import { refreshSettingsView } from './SettingsView.js';

export function createReaderView(app) {
    const descRowY = 208;

    // Top screen: single fullscreen RichText with book/chapter/word info
    const topScreen = new Group({
        y: 0,
        x: 0,
        width: 400,
        height: 240,
        noFrame: true,
        children: [
            new RichText({
                id: 'topDisplay',
                x: 10,
                y: 10,
                width: 380,
                regularSize: 15,
                codeSize: 10,
                color: palette.textBright,
                headerColor: palette.highlight,
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
                }
            }),
            new Label({
                id: 'description',
                text: '',
                x: 360,
                y: 230,
                font: fontSmall,
                color: palette.textDim
            })
        ]
    });

    // Bottom screen: scrollable active line + buttons
    const bottomScreen = new Group({
        y: 240,
        width: 320,
        height: 240,
        noFrame: true,
        children: [
            new Group({
                id: 'lineContainer',
                x: 5,
                y: 5,
                width: 310,
                height: 200,
                overflow: 'scroll',
                backgroundColor: 0x33000000,
                children: [
                    new RichText({
                        id: 'activeLine',
                        x: 5,
                        y: 5,
                        width: 283,
                        font: getTextFont(),
                        text: '',
                        onHotspotClick(hotspot) {
                            if (hotspot && hotspot.wordIndex !== undefined) {
                                app.model.selectWord(hotspot.wordIndex);
                            }
                        },
                        onUpdate() {
                            this.parent.resizeSelf();
                        }
                    })
                ]
            }),
            new Button({
                id: 'btnBooks',
                text: 'Books',
                font: fontMedium,
                x: 5,
                y: buttonRowY,
                onClick() { app.popState(); }
            }),
            new Button({
                id: 'btnTranslate',
                text: 'LLM',
                font: fontMedium,
                x: 66,
                y: buttonRowY,
                onClick() {
                    updateLlmView(app);
                    app.pushState('llm');
                }
            }),
            new Button({
                id: 'btnImageGen',
                text: 'Images',
                font: fontMedium,
                x: 102,
                y: buttonRowY,
                onClick() {
                    refreshImgGenPrompt(app).catch(ex => console.error('refreshImgGenPrompt error:', ex));
                    app.pushState('imageGen');
                }
            }),
            new Button({
                id: 'btnMusic',
                text: 'Music',
                font: fontMedium,
                x: 152,
                y: buttonRowY,
                onClick() { app.pushState('music'); }
            }),
            new Button({
                id: 'btnSettings',
                text: 'Settings',
                font: fontMedium,
                x: 195,
                y: buttonRowY,
                onClick() {
                    refreshSettingsView(app);
                    app.pushState('settings');
                }
            }),
            new Button({
                id: 'btnControls',
                text: 'Controls',
                font: fontMedium,
                x: 250,
                y: buttonRowY,
                onClick() { app.pushState('controls'); }
            })
        ]
    });

    return new Group({
        id: "readerView",
        x: 0,
        y: 0,
        width: 400,
        height: 480,
        noFrame: true,
        visible: false,
        children: [topScreen, bottomScreen]
    });
}

let lastDisplayedLine = -1;

export function updateLineDisplay(app) {
    const model = app.model;
    const line = model.getCurrentLine();
    if (!line) {
        console.log('updateLineDisplay: no line');
        return;
    }

    const lineChanged = model.currentLine !== lastDisplayedLine;
    lastDisplayedLine = model.currentLine;
    if (lineChanged) {
        nodeMap.lineContainer.scrollY = 0;
    }

    const lines = model.getContentLines();
    const totalLines = lines.length;
    // Clamp currentWord if out of bounds (e.g. -1 from prevLine on untranslated line)
    const wordCount = line?.words?.length ?? 0;
    if (wordCount > 0 && (model.currentWord < 0 || model.currentWord >= wordCount)) {
        model.currentWord = Math.max(0, wordCount - 1);
    }

    // Update active line on bottom screen
    if (model.showEnglish) {
        nodeMap.activeLine.text = line.english || '(not translated yet)';
    } else {
        const segments = buildLineSegments(line, model.currentWord);
        if (segments) {
            nodeMap.activeLine.segments = segments;
        } else {
            nodeMap.activeLine.text = line.text;
        }
    }

    // Update description
    nodeMap.description.text = `${model.currentLine + 1}/${totalLines}`;
}

export function buildLineSegments(line, currentWord) {
    if (!line.words || line.words.length === 0) return null;

    return line.words.map((w, i) => ({
        text: typeof w === 'string' ? w : w.src,
        font: getTextFont(),
        color: i === currentWord ? palette.highlight : palette.textNormal,
        data: { wordIndex: i }
    }));
}

export function updateTopDisplay(app) {
    const model = app.model;
    const bookTitle = model.books[model.currentBook]?.title || '';
    const chapterNum = model.currentChapter + 1;
    const chapterTitle = model.chapterTitle || '';
    const word = model.getCurrentWord();

    const kanji = (word && typeof word === 'object') ? word.src : '';
    const hiragana = (word && typeof word === 'object') ? (word.hir || '') : '';
    const definition = (word && typeof word === 'object') ? (word.dic || '') : '';

    let md = '';
    if (bookTitle) md += `Book: **${bookTitle}**\n`;
    if (chapterTitle) md += `Chapter ${model.currentChapter + 1}: **${chapterTitle}**\n`;
    // if (kanji) md += `\n# ${kanji}\n`;
    // if (hiragana) md += `**${hiragana}**\n`;
    if (hiragana) md += `\n# ${hiragana || kanji}\n`;
    if (definition) md += `${definition.trim()}\n`;

    nodeMap.topDisplay.markdown = md;
}

export async function handleReaderKeyDown(app, event) {
    const { key } = event;
    const model = app.model;

    switch (key) {
    case 'ArrowUp':
        await model.prevLine();
        updateLineDisplay(app);
        break;
    case 'ArrowDown':
        await model.nextLine();
        updateLineDisplay(app);
        break;
    case 'ArrowLeft':
        await model.prevWord();
        updateLineDisplay(app);
        break;
    case 'ArrowRight':
        await model.nextWord();
        updateLineDisplay(app);
        break;
    case 'l':
        if (getAltMode()) {
            const newSize = Math.max(10, getTextFontSize() - 2);
            setTextFontSize(newSize);
            console.log('Font size decreased:', newSize);
            if (nodeMap.activeLine) nodeMap.activeLine.attrs.font = getTextFont();
            updateLineDisplay(app);
        } else {
            model.pageUp();
        }
        break;
    case 'r':
        if (getAltMode()) {
            const newSize = Math.min(48, getTextFontSize() + 2);
            setTextFontSize(newSize);
            console.log('Font size increased:', newSize);
            if (nodeMap.activeLine) nodeMap.activeLine.attrs.font = getTextFont();
            updateLineDisplay(app);
        } else {
            model.pageDown();
        }
        break;
    case 'ZLeft':
        await model.prevChapter(false);
        break;
    case 'ZRight':
        await model.nextChapter();
        break;
    case 'a':
        const { rndBG } = await import('./Shared.js');
        rndBG(nodeMap.bg);
        break;
    case 'b':
        app.popState();
        break;
    case 'y':
        if (getAltMode()) {
            nodeMap.bg.node.opacity = nodeMap.topDisplay.visible ? 1 : 0.3;
            nodeMap.topDisplay.visible = !nodeMap.topDisplay.visible;
        } else {
            model.showEnglish = !model.showEnglish;
            console.log('Toggle language:', model.showEnglish ? 'English' : 'Japanese');
            updateLineDisplay(app);
        }
        break;
    }
}
