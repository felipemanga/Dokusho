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

let _selectedBookIndex = 0;
let _bookNcodes = [];

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
        _bookNcodes = Object.keys(app.model.books);
        if (_selectedBookIndex >= _bookNcodes.length) {
            _selectedBookIndex = Math.max(0, _bookNcodes.length - 1);
        }
        let y = 10 - cardHeight - cardSpacing;
        for (let [ncode, book] of Object.entries(app.model.books)) {
            const idx = Object.keys(app.model.books).indexOf(ncode);
            bookList.addChild(createBookCardView(ncode, book, y += cardHeight + cardSpacing, idx));
        }
        bookList.resizeSelf();
        ensureSelectionVisible();
    }

    function createBookCardView(ncode, book, y, index) {
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

        const isSelected = index === _selectedBookIndex;
        const card = new Group({
            id: 'bookCard' + index,
            y,
            x: 7,
            width: 270,
            height: cardHeight,
            backgroundColor: isSelected ? palette.highlight & 0x33FFFFFF : 0x22FFFFFF,
            children,
            onClick() {
                _selectedBookIndex = index;
                updateCardColors();
                console.log('Opening book:', ncode);
                app.model.openBook(ncode);
                app.pushState('reader');
            }
        });
        return card;
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

function updateCardColors() {
    const bookList = nodeMap.bookList;
    if (!bookList) return;
    const children = bookList.children;
    for (let i = 0; i < children.length; i++) {
        const card = children[i];
        const id = card.getAttr?.('id') || card.id;
        const m = String(id).match(/^bookCard(\d+)$/);
        if (!m) continue;
        const idx = parseInt(m[1], 10);
        card.backgroundColor = idx === _selectedBookIndex ? palette.highlight & 0x33FFFFFF : 0x22FFFFFF;
    }
}

function ensureSelectionVisible() {
    const bookList = nodeMap.bookList;
    if (!bookList || _bookNcodes.length === 0) return;
    const cardStrut = cardHeight + cardSpacing;
    const listHeight = 200; // matches bookList height
    const firstCardY = 10; // where cards start in updateBooksView
    const cardY = firstCardY + _selectedBookIndex * cardStrut;
    const scrollY = bookList.scrollY ?? 0;
    if (cardY < scrollY) {
        bookList.scrollY = cardY;
    } else if (cardY + cardHeight > scrollY + listHeight) {
        bookList.scrollY = cardY + cardHeight - listHeight;
    }
}

export async function handleBooksKeyDown(app, event) {
    const { key } = event;
    const totalBooks = Object.keys(app.model.books).length;
    if (totalBooks === 0) return;

    switch (key) {
    case 'ArrowUp':
        _selectedBookIndex = Math.max(0, _selectedBookIndex - 1);
        updateCardColors();
        ensureSelectionVisible();
        break;
    case 'ArrowDown':
        _selectedBookIndex = Math.min(totalBooks - 1, _selectedBookIndex + 1);
        updateCardColors();
        ensureSelectionVisible();
        break;
    case 'a':
        if (_bookNcodes[_selectedBookIndex]) {
            app.model.openBook(_bookNcodes[_selectedBookIndex]);
            app.pushState('reader');
        }
        break;
    }
}
