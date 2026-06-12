import { nodeMap, Group, Label, ImageCtrl, TextInput, Button, RichText } from '../../utils/gui/GUI.js';
import { fontSmall, fontMedium, buttonRowY, palette, getNovelImageFolder } from './Shared.js';

const thumbSize = 64;
const thumbX = 8;
const thumbY = 8;
const cardHeight = thumbSize + thumbY * 2;
const cardSpacing = 16;
const btnW = 37;
const btnStride = btnW + 15;
const btnH = 16;

export function createBooksView(app) {
    const booksView = new Group({
        id: "booksView",
        width: 320,
        height: 240 * 2,
        noFrame: true,
        visible: false,
        children: [
            new Group({
                id: 'bookList',
                x: 10,
                y: 240 + 7,
                width: 300,
                height: 200,
                overflow: 'scroll',
                backgroundColor: 0x11000000,
                elevation: -1
            }),
            new TextInput({
                id: 'addBookInput',
                x: 10,
                y: 240 + buttonRowY,
                width: 85,
                font: fontSmall,
                placeholder:"NCode..."
            }),
            new Button({
                x: 320 - (btnStride) * 4,
                y: 240 + buttonRowY,
                width: btnW,
                height: btnH,
                font: fontSmall,
                text: 'Add Book',
                onClick(){
                    app.model.addBook(nodeMap.addBookInput.text);
                }
            }),
            new Button({
                id: 'btnSettings',
                text: 'Settings',
                font: fontMedium,
                width: btnW,
                height: btnH,
                x: 320 - (btnStride) * 3,
                y: 240 + buttonRowY,
                onClick() {
                    app.pushState('settings');
                }
            }),
            new Button({
                id: 'btnControls',
                text: 'Controls',
                font: fontMedium,
                width: btnW,
                height: btnH,
                x: 320 - (btnStride) * 2,
                y: 240 + buttonRowY,
                onClick() { app.pushState('controls'); }
            }),
            new Button({
                x: 320 - (btnStride) * 1,
                y: 240 + buttonRowY,
                width: btnW,
                height: btnH,
                font: fontMedium,
                text: 'Music',
                onClick(){
                    app.pushState('music');
                }
            })
        ]
    });
    app.model.addEventListener('loaded', updateBooksView);
    app.model.addEventListener('bookAdded', updateBooksView);
    app.model.addEventListener('bookDeleted', updateBooksView);

    return booksView;

    function updateBooksView() {
        const bookList = nodeMap.bookList;
        bookList.clearChildren();
        let y = 10 - cardHeight - cardSpacing;
        for (let [ncode, book] of Object.entries(app.model.books)) {
            bookList.addChild(createBookCardView(ncode, book, y += cardHeight + cardSpacing));
        }
        bookList.resizeSelf();
    }

    function createBookCardView(ncode, book, y) {
        const hasMetadata = book.metadata && Object.keys(book.metadata).length > 0;
        const thumbPath = getThumbPath(ncode);
        const thumbnail = new Image(thumbPath); // thumbnail is null if it doesn't load
        let titleOffset = thumbnail ? thumbX + thumbSize + 11 : 0;

        let children = [];

        if (thumbnail) {
            children.push(new Group({
                x: thumbX,
                y: thumbY,
                width: thumbSize,
                height: thumbSize,
                backgroundColor: 0x44FFFFFF,
                children: [
                    new ImageCtrl({
                        image: thumbnail
                    })
                ]
            }));
        }

        children.push(new RichText({
            markdown:`[${ncode}:]() ${book.title}`,
            x: titleOffset,
            y: 0,
            width: 270 - titleOffset - 7,
            lineHeight: 16,
            regularSize: 15,
            codeSize: 10,
            color: 0xDD000000,
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
            }
        }));

        return new Group({
            y,
            x: 7,
            width: 270,
            height: cardHeight,
            backgroundColor: 0x22FFFFFF,
            children,
            onClick() {
                console.log('Opening book:', ncode);
                app.model.openBook(ncode);
                app.pushState('reader');
            }
        });
    }

    function getThumbPath(ncode) {
        const novelFolder = getNovelImageFolder();
        return novelFolder + '/' + ncode + '_cover_thumb.png';
    }

    function getCoverPath(ncode) {
        const novelFolder = getNovelImageFolder();
        return novelFolder + '/' + ncode + '_cover.png';
    }
}

export async function handleBooksKeyDown(app, event) {
    const { key } = event;

    switch (key) {
    case 'a':
        const { rndBG } = await import('./Shared.js');
        rndBG(nodeMap.bg);
        break;
    }
}
