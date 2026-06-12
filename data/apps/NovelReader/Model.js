import {strhash} from '../../utils/strhash.js';
import {jsonPrompt} from '../../utils/llama.js';
import { Event, EventDispatcher } from '../../utils/EventDispatcher.js';
import {getLlmEndpoint} from './Shared.js';

const NovelFolder = (settings.basePath == 'romfs:/' ? 'sdmc:/' : '') + 'Novels';
let msg = 0;

// Metadata schemas for LLM-generated illustration prompts
const NovelMetadataSchema = {
    type: 'object',
    properties: {
        protagonistName: { type: 'string', description: 'Full name of the main character' },
        protagonistGender: { type: 'string', description: 'Gender of the main character (male/female)' },
        protagonistHairStyle: {type: 'string', description: 'Hair style and color (improvise if not described explicitely)'},
        protagonistEyes: {type: 'string', description: 'Eye color (improvise if not described explicitely)'},
        protagonistAge: { type: 'string', description: 'Age or age range of the main character' },
        protagonistPhysicalDescription: { type: 'string', description: 'Hair, eyes, height, build, distinguishing features' },
        protagonistOutfit: { type: 'string', description: 'Typical clothing and accessories worn by the protagonist' },
        supportingCharacters: { type: 'string', description: 'Brief descriptions of key supporting characters' },
        novelGenre: { type: 'string', description: 'Primary genre(s) (e.g., romance, fantasy, sci-fi, slice of life)' },
        storySetting: { type: 'string', description: 'Time period and primary location(s) of the story' },
        atmosphere: { type: 'string', description: 'Overall mood and tone (e.g., dark, whimsical, tense, heartwarming)' },
        artStyle: { type: 'string', description: 'Preferred illustration style (e.g., anime, watercolor, realistic, pixel art)' },
        coverImagePrompt: { type: 'string', description: `Match the tone of the novel and use the following template:
age, gender, hair, eye color, physical description, outfit, pose, expression
BREAK
optional secondary characters
BREAK
location description
` },
    }
};

const ChapterMetadataSchema = {
    type: 'object',
    properties: {
        chapterSummary: { type: 'string', description: 'Brief summary of what happens in this chapter' },
        keyScene: { type: 'string', description: 'The most visually important scene in this chapter' },
        charactersPresent: { type: 'string', description: 'Characters appearing in this chapter' },
        sceneSetting: { type: 'string', description: 'Specific location and time of day for the key scene' },
        emotionalTone: { type: 'string', description: 'Emotional mood of this chapter (e.g., joyful, melancholic, suspenseful)' },
        backgroundImagePrompt: { type: 'string', description: `Match the tone of the chapter and use the following template:
age, gender, hair, eye color, physical description, outfit, pose, expression
BREAK
optional secondary characters
BREAK
location description
` },
    }
};

function ensureStringMap(obj) {
    if (!obj || typeof obj != "object")
        return {};
    const out = {};
    for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string')
            out[key] = val;
    }
    return out;
}

async function endpoint(arg, forceDownload = false) {
    const url = 'https://ncode.syosetu.com/' + arg;
    const cacheFile = `${NovelFolder}/cache-${strhash(url)}`;

    if (!forceDownload) {
        try {
            const cache = await fs.readFile(cacheFile);
            if (cache)
                return cache;
        } catch (ex) {}
    }

    const rsp = await fetch(url);
    const text = await rsp.text();
    try {
        fs.writeFile(cacheFile, text);
    } catch (ex) {
        console.log(ex);
    }
    return text;
}

const chapterExpr = /href="([^"]+)"\s+class="p-eplist__subtitle"\s*>\s*(.+?)\s*</gmi;
const titleExpr = /class="p-novel__title">([^<]+)/i;

class Syosetu {
    #validateNCode(ncode) {
        return /^n[0-9]+[a-z][a-z]$/.test(ncode);
    }

    #downloadRawIndex(ncode, forceDownload = false) {
        if (!this.#validateNCode(ncode))
            throw new Error("Invalid NCode");
        return endpoint(ncode + '/', forceDownload);
    }

    #parseIndex(ncode, index) {
        let title = ncode;
        let chapters = [];
        index.replace(chapterExpr, (m, url, title) => {
            chapters.push({url, title});
        });
        index.replace(titleExpr, (m, t) => title = t);
        return {title, chapters};
    }

    async #downloadIndex(ncode, forceDownload) {
        return this.#parseIndex(ncode, await this.#downloadRawIndex(ncode, forceDownload));
    }

    async getIndex(ncode, forceDownload = false) {
        const cachePath = `${NovelFolder}/syosetu-${ncode}.json`;
        if (!forceDownload) {
            try {
                const str = await fs.readFile(cachePath);
                if (typeof str == 'string' && str.length > 0)
                    return JSON.parse(str);
            } catch (ex) {}
        }
        const index = await this.#downloadIndex(ncode, forceDownload);
        fs.writeFile(cachePath, JSON.stringify(index));
        return index;
    }

    async #getLineParts(line, context) {
        const schema = {
            type: 'object',
            required: ['english', 'words'],
            properties: {
                english: {
                    type: 'string',
                    description: 'Sentence translated to English'
                },
                words: {
                    type: 'array',
                    description: 'An object for word in the source string',
                    items: {
                        type: 'object',
                        required: ['src', 'dic'],
                        properties: {
                            src: {
                                type: 'string',
                                description: 'Source word as it appears in the sentence (strict)'
                            },
                            hir: {
                                type: 'string',
                                description: 'Source word written in Hiragana instead of Kanji'
                            },
                            dic: {
                                type: 'string',
                                description: 'Brief english definition of the word in the context'
                            }
                        }
                    }
                }
            }
        };

        const schemaSimple = {
            english: schema.properties.english.description,
            words: [{
                src: schema.properties.words.items.properties.src.description,
                hir: schema.properties.words.items.properties.hir.description,
                dic: schema.properties.words.items.properties.dic.description
            }]
        };

        const system_prompt = `You will be given some context and a line of text from a Japanese novel. Reply by parsing the line into the following format: ${JSON.stringify(schemaSimple)}`;
        const message = `Context:
\`\`\`
${context}
\`\`\`

Line to parse:
\`\`\`
${line}
\`\`\`
`;
        const start = performance.now();
        console.log(`Translating: ${line}`);
        const parts =  await jsonPrompt(message, {
            system_prompt,
            schema,
            endpoint: getLlmEndpoint()
        });
        if (!parts)
            throw new Error('No translation response');
        const end = performance.now();
        console.log(`Got ${end - start}ms: ${JSON.stringify(parts)}`);
        parts.words = this.#validateWords(line, parts.words);
        return parts;
    }

    async getWordInfo(word, context) {
        const schema = {
            type: 'object',
            required: ['hir', 'dic'],
            properties: {
                hir: {
                    type: 'string',
                    description: 'Word written in Hiragana instead of Kanji'
                },
                dic: {
                    type: 'string',
                    description: 'Brief english definition of the word in this context'
                }
            }
        };

        const system_prompt = `You will be given a Japanese word and the sentence it appears in. Reply with the hiragana reading and a brief english definition in this JSON format: ${JSON.stringify(schema)}`;
        const message = `Context sentence:
\`\`\`
${context}
\`\`\`

Word to look up:
\`\`\`
${word}
\`\`\`
`;
        return jsonPrompt(message, {
            system_prompt,
            schema,
            endpoint: getLlmEndpoint()
        });
    }

    #validateWords(line, words) {
        if (!words || !Array.isArray(words) || words.length === 0) {
            return line.split('');
        }

        const valid = [];
        let cursor = 0;

        for (const word of words) {
            if (!word || !word.src || typeof word.src !== 'string') continue;

            // Fill gap between cursor and where this word starts
            if (line.indexOf(word.src, cursor) !== cursor) {
                // Word not at cursor: fill gap as individual chars, try to find word elsewhere
                while (cursor < line.length && line[cursor] !== word.src[0]) {
                    valid.push(line[cursor]);
                    cursor++;
                }
                // Check if word now matches at cursor
                if (cursor + word.src.length > line.length ||
                    line.substring(cursor, cursor + word.src.length) !== word.src) {
                    // Word still not found, drop it
                    continue;
                }
            }

            valid.push(word);
            cursor += word.src.length;
        }

        // Fill trailing unconsumed characters
        while (cursor < line.length) {
            valid.push(line[cursor]);
            cursor++;
        }

        return valid;
    }

    // Parse HTML into raw lines only (no LLM)
    #parseChapterHTML(chapterHTML) {
        const preface = [];
        const content = [];
        chapterHTML.replace(/<p id="L(p?)[0-9]+">([\s\S]+?)<\/p>/gmi, (m, isPreface, text) => {
            isPreface = isPreface === 'p';
            text = text.replace(/<br\s*\/?>/gmi, '\n')
                       .replace(/<[^>]+>/gmi, '')
                       .trim();
            if (text.length) {
                (isPreface ? preface : content).push({text});
            }
        });
        return {preface, content};
    }

    // Get raw chapter content without LLM translation
    async getChapterRaw(ncode, chapterIndex, forceDownload = false) {
        const index = await this.getIndex(ncode);
        if (chapterIndex < 0 || chapterIndex >= index.chapters.length)
            throw new Error("Invalid chapter index");
        const {url} = index.chapters[chapterIndex];
        const chapterHTML = await endpoint(url, forceDownload);
        return this.#parseChapterHTML(chapterHTML);
    }

    async translateLine(context, index, onUpdate) {
        const line = context[index];
        if (line.english) return; // already translated

        let start = Math.max(0, index - 3);
        let end = Math.min(context.length, index + 2);
        let paragraph = context.slice(start, end).map(l => l.text).join('\n');

        const parts = await this.#getLineParts(line.text, paragraph);
        Object.assign(line, parts);
        if (onUpdate) onUpdate(index, context.length);
    }

    // Translate lines through LLM, with progress callback and cancel support
    async translateLines(lines, onUpdate, onCancel) {
        for (let i = 0; i < lines.length; i++) {
            if (onCancel && onCancel()) break;
            await this.translateLine(lines, i, onUpdate);
        }
    }

    async test() {
        const chap = await this.getChapterContent('n4395il', 0);
        console.log(JSON.stringify(chap, null, 2));
    }
}

export class NovelReaderModel extends EventDispatcher {
    syosetu;

    books = {};
    currentBook = null;
    currentChapter = 0;
    currentLine = 0;
    currentWord = 0;
    chapterContent = null;
    chapterTitle = '';
    chapterIndex = null; // cached chapter index for current book

    translationProgress = {total: 0, current: 0, running: false};
    #cancelTranslation = false;
    #saveTimeout = null;

    #getChapterDir(ncode, chapterIdx) {
        return `${NovelFolder}/syosetu-${ncode}/ch${chapterIdx}/`;
    }

    // Save a single line to its own file.
    // type: 'preface' or 'content'. sectionIdx: index within that section.
    async #saveLineToFile(ncode, chapterIdx, sectionIdx, lineObj, type) {
        const dir = this.#getChapterDir(ncode, chapterIdx);
        const prefix = type === 'preface' ? 'Lp' : 'Lc';
        const path = `${dir}${prefix}${sectionIdx}.json`;
        try {
            fs.writeFile(path, JSON.stringify({
                text: lineObj.text,
                english: lineObj.english,
                words: lineObj.words
            }));
            console.log(`Saved line file: ${path}`);
        } catch (ex) {
            console.error('Failed to save line file:', path, ex);
        }
    }

    // Load all per-line files for a chapter, return {preface, content} or null
    // Files: Lp{N}.json (preface), Lc{N}.json (content)
    // Lines are placed at their section index (sparse arrays).
    async #loadLinesFromCache(ncode, chapterIdx) {
        const dir = this.#getChapterDir(ncode, chapterIdx);
        const preface = [];
        const content = [];
        try {
            const entries = await fs.listDir(dir);
            if (!entries || entries.length === 0) return null;

            for (const e of entries) {
                try {
                    const m = e.name.match(/^(Lp|Lc)(\d+)\.json$/);
                    if (!m) continue;
                    const idx = parseInt(m[2]);
                    const data = JSON.parse(await fs.readFile(`${dir}${e.name}`));
                    const line = {
                        text: data.text,
                        english: data.english,
                        words: data.words
                    };
                    const arr = m[1] === 'Lp' ? preface : content;
                    arr[idx] = line; // place at exact index
                } catch (ex) {
                    console.error(`Failed to read line file ${e.name}:`, ex);
                }
            }
            console.log(`Loaded ${preface.filter(Boolean).length} preface + ${content.filter(Boolean).length} content lines from ${dir}`);
            return preface.some(Boolean) || content.some(Boolean) ? { preface, content } : null;
        } catch (ex) {
            return null;
        }
    }

  // Migrate legacy single-file cache to per-line files, then delete legacy
    async #migrateLegacyCache(ncode, chapterIdx) {
        const legacyPath = `${NovelFolder}/syosetu-${ncode}-ch${chapterIdx}-translated.json`;
        try {
            const raw = await fs.readFile(legacyPath);
            if (!raw) return;
            const cached = JSON.parse(raw);
            if (!cached || !cached.preface || !cached.content) return;

            console.log(`Migrating legacy cache for ${ncode} ch${chapterIdx} (${cached.preface.length + cached.content.length} lines)`);
            for (let i = 0; i < cached.preface.length; i++) {
                await this.#saveLineToFile(ncode, chapterIdx, i, cached.preface[i], 'preface');
            }
            for (let i = 0; i < cached.content.length; i++) {
                await this.#saveLineToFile(ncode, chapterIdx, i, cached.content[i], 'content');
            }
            try {
                await fs.deleteFile(legacyPath);
                console.log(`Deleted legacy cache: ${legacyPath}`);
            } catch (ex) {
                console.log(`Could not delete legacy cache: ${legacyPath}`);
            }
        } catch (ex) {
            // No legacy file or parse error, ignore
        }
    }

    // Merge cached translations onto raw chapter content.
    // Raw is the source of truth for line count/order.
    // Cached lines are matched by section index (preface[i] -> preface[i], content[i] -> content[i]).
    #mergeCachedLines(raw, cached) {
        const merged = { preface: [], content: [] };
        for (let i = 0; i < raw.preface.length; i++) {
            const c = cached.preface[i];
            merged.preface.push({
                text: raw.preface[i].text,
                english: c?.english,
                words: c?.words
            });
        }
        for (let i = 0; i < raw.content.length; i++) {
            const c = cached.content[i];
            merged.content.push({
                text: raw.content[i].text,
                english: c?.english,
                words: c?.words
            });
        }
        const translatedCount = merged.preface.filter(l => l.english).length + merged.content.filter(l => l.english).length;
        console.log(`Merged: ${translatedCount} translated lines out of ${merged.preface.length + merged.content.length} total`);
        return merged;
    }

    showEnglish = false;

    autoTranslateMode = 'chapter'; // 'off' | 'line' | 'chapter'

    error = '';

    constructor() {
        super();
        this.self = this;
        this.syosetu = new Syosetu();
    }

    async init() {
        let empty = true;
        try {
            const library = JSON.parse(await fs.readFile(`${NovelFolder}/library.json`));
            this.books = library.books || {};
            this.currentBook = library.current;
            empty = false;
            // Ensure all books have metadata property (backward compat)
            for (let ncode in this.books) {
                if (!this.books[ncode].metadata) {
                    this.books[ncode].metadata = {};
                }
            }
        } catch (ex) {}
        this.dispatchEvent(new Event('loaded'));
        if (empty)
            this.addBook('n4395il');
    }

    async addBook(ncode) {
        this.error = '';
        try {
            let index = await this.syosetu.getIndex(ncode);
            this.books[ncode] = {
                title: index.title,
                chapter: 0,
                line: 0,
                word: 0,
                metadata: {}
            };
            this.save();
            this.dispatchEvent(new Event('bookAdded'));
        } catch (err) {
            this.error = err + '';
        }
    }

    // Get novel-level metadata for a book
    getNovelMetadata(ncode) {
        return this.books[ncode]?.metadata || {};
    }

    // Get chapter-level metadata for current book/chapter
    async getChapterMetadata(chapterIdx) {
        if (!this.currentBook) return {};
        const cachePath = `${NovelFolder}/syosetu-${this.currentBook}-ch${chapterIdx ?? this.currentChapter}-metadata.json`;
        try {
            const raw = await fs.readFile(cachePath);
            if (!raw) return {};
            const data = JSON.parse(raw);
            return data || {};
        } catch (ex) {
            return {};
        }
    }

    // Update novel-level metadata via LLM
    async updateNovelMetadata() {
        if (!this.currentBook) return;
        this.error = '';
        try {
            const book = this.books[this.currentBook];
            const index = await this.syosetu.getIndex(this.currentBook);

            // Use current chapter content if available, otherwise fetch first non-preface chapter
            // Collect lines until we hit minimum sample length
            const minSampleLen = 2000;
            let sampleLines;
            if (this.chapterContent) {
                const lines = this.getContentLines();
                let sample = '';
                for (const l of lines) {
                    sample += l.text + '\n';
                    if (sample.length >= minSampleLen) break;
                }
                sampleLines = sample;
                console.log(`updateNovelMetadata: using current chapter ${this.currentChapter + 1}, ${sampleLines.length} chars`);
            } else {
                const ch0 = await this.syosetu.getChapterRaw(this.currentBook, 0);
                const allLines = [...ch0.preface, ...ch0.content];
                let sample = '';
                for (const l of allLines) {
                    sample += l.text + '\n';
                    if (sample.length >= minSampleLen) break;
                }
                sampleLines = sample;
                console.log(`updateNovelMetadata: using chapter 1 as fallback, ${sampleLines.length} chars`);
            }

            const systemPrompt = `You are a novel analyst. Extract metadata from the provided novel information to help generate illustrations. All fields are optional - leave blank or omit if not applicable. Respond with a JSON that follows this schema: ${JSON.stringify(NovelMetadataSchema)}`;

            const message = `Novel Title: ${index.title}
NCode: ${this.currentBook}
Total Chapters: ${index.chapters.length}
Current Chapter: ${this.currentChapter + 1} - ${this.chapterTitle}

Chapter sample:
\`\`\`
${sampleLines}
\`\`\`

Extract metadata for illustration generation:`;

            console.log('Updating novel metadata for:', this.currentBook);
            const metadata = await jsonPrompt(message, {
                system_prompt: systemPrompt,
                schema: NovelMetadataSchema,
                endpoint: getLlmEndpoint()
            });

            book.metadata = ensureStringMap(metadata);
            this.saveNow();
            this.dispatchEvent(new Event('metadataUpdated'));
            console.log('Novel metadata updated:', JSON.stringify(metadata, null, 2));
        } catch (err) {
            this.error = err + '';
            console.error('updateNovelMetadata error:', this.error);
        }
    }

    // Update chapter-level metadata via LLM
    async updateChapterMetadata() {
        if (!this.currentBook || !this.chapterContent) return;
        this.error = '';
        try {
            const chapterIdx = this.currentChapter;
            const lines = this.getContentLines();

            // Build context from chapter content, collect until min length
            const minSampleLen = 2000;
            let sampleLines = '';
            for (const l of lines) {
                sampleLines += l.text + '\n';
                if (sampleLines.length >= minSampleLen) break;
            }

            const novelMeta = this.books[this.currentBook]?.metadata || {};

            let protagonist = [];
            for (let key in novelMeta) {
                let match = key.match(/^protagonist(.*)/);
                if (!match)
                    continue;
                protagonist.push(`- ${match[1]}: ${novelMeta[key]}`);
            }

            const novelContext = `
Novel: ${this.books[this.currentBook]?.title}
Genre: ${novelMeta.novelGenre || 'Unknown'}
Setting: ${novelMeta.storySetting || 'Unknown'}
Atmosphere: ${novelMeta.atmosphere || 'Unknown'}
Art Style: ${novelMeta.artStyle || 'Not specified'}
Protagonist:
${protagonist.join('\n')}
Supporting Characters: ${novelMeta.supportingCharacters || 'None specified'}`.trim();

            const systemPrompt = `You are a novel analyst. Extract metadata from the provided chapter to help generate illustrations. All fields are optional. Respond with a JSON that follows this schema: ${JSON.stringify(ChapterMetadataSchema)}`;

            const message = `${novelContext}

Chapter ${chapterIdx + 1}: ${this.chapterTitle}

Chapter content:
\`\`\`
${sampleLines}
\`\`\`

Extract metadata for illustration generation:`;

            console.log('Updating chapter metadata for ch', chapterIdx);
            const metadata = await jsonPrompt(message, {
                system_prompt: systemPrompt,
                schema: ChapterMetadataSchema,
                endpoint: getLlmEndpoint()
            });

            // Save to per-chapter metadata file
            const cachePath = `${NovelFolder}/syosetu-${this.currentBook}-ch${chapterIdx}-metadata.json`;
            fs.writeFile(cachePath, JSON.stringify(ensureStringMap(metadata)));

            this.dispatchEvent(new Event('metadataUpdated'));
            console.log('Chapter metadata updated');
        } catch (err) {
            this.error = err + '';
            console.error('updateChapterMetadata error:', this.error);
        }
    }

    async deleteBook(ncode) {
        if (!this.books[ncode])
            return;
        delete this.books[ncode];
        try {
            this.save();
            this.dispatchEvent(new Event('bookDeleted'));
        } catch (err) {
            this.error = err + '';
        }
    }

    // Open a book: set current book, load chapter at saved position
    async openBook(ncode) {
        this.error = '';
        this.currentBook = ncode;
        const book = this.books[ncode];
        this.currentChapter = book?.chapter ?? 0;
        this.currentLine = book?.line ?? 0;
        this.currentWord = book?.word ?? 0;
        this.saveNow(); // persist current book immediately
        await this.loadChapter(this.currentChapter);
    }

    // Load a chapter: fetch raw content, check translation cache, start background translation
    async loadChapter(chapterIndex, forceDownload = false) {
        this.error = '';
        try {
            // Clear previous chapter content to avoid stale data if cache fetch fails
            this.chapterContent = null;

            // Fetch chapter index for titles
            this.chapterIndex = await this.syosetu.getIndex(this.currentBook, forceDownload);
            const chEntry = this.chapterIndex.chapters[chapterIndex];
            this.chapterTitle = chEntry ? chEntry.title : `Chapter ${chapterIndex + 1}`;

            // Always fetch raw as base (fallback for missing/corrupted line files)
            this.chapterContent = await this.syosetu.getChapterRaw(this.currentBook, chapterIndex, forceDownload);
            console.log(`Loaded raw chapter ${chapterIndex}, ${this.getContentLines().length} lines`);

            // Layer per-line cached translations on top (skip if forceDownload)
            if (!forceDownload) {
                // Check for legacy single-file cache and migrate if present
                await this.#migrateLegacyCache(this.currentBook, chapterIndex);

                const cached = await this.#loadLinesFromCache(this.currentBook, chapterIndex);
                if (cached) {
                    this.chapterContent = this.#mergeCachedLines(this.chapterContent, cached);
                    console.log(`Merged cached translations for ch${chapterIndex}`);
                }
            }

            this.currentChapter = chapterIndex;
            this.#clampLine();
            const line = this.getCurrentLine();
            console.log(`loadChapter(${chapterIndex}): title="${this.chapterTitle}", line=${this.currentLine}, text="${line?.text?.substring(0, 60) || '(none)'}..."`);
            this.dispatchEvent(new Event('chapterLoaded'));
            this.dispatchEvent(new Event('lineChanged'));
            this.dispatchEvent(new Event('bookOpened'));

            // Start background translation based on autoTranslateMode
            if (this.autoTranslateMode === 'chapter') {
                this.translateChapter().catch(err => {
                    this.error = err + '';
                    console.error('loadChapter error:', this.error);
                });
            } else if (this.autoTranslateMode === 'line') {
                // Translate just the current line on chapter load
                this.translateLineAt(this.currentLine).catch(err => {
                    this.error = err + '';
                    console.error('loadChapter auto-translate error:', this.error);
                });
            }
        } catch (err) {
            this.error = err + '';
            console.error('loadChapter error:', this.error);
        }
    }

    #clampLine() {
        const lines = this.getContentLines();
        if (lines.length === 0) {
            this.currentLine = 0;
            this.currentWord = 0;
            return;
        }
        this.currentLine = Math.max(0, Math.min(this.currentLine, lines.length - 1));
        const line = this.getCurrentLine();
        const wordCount = line?.words?.length ?? 0;
        this.currentWord = Math.max(0, Math.min(this.currentWord, Math.max(0, wordCount - 1)));
    }

    // Flatten preface + content into single array
    getContentLines() {
        if (!this.chapterContent) return [];
        return [...this.chapterContent.preface, ...this.chapterContent.content];
    }

    getCurrentLine() {
        const lines = this.getContentLines();
        if (this.currentLine < 0 || this.currentLine >= lines.length) return null;
        return lines[this.currentLine];
    }

    getCurrentWord() {
        const line = this.getCurrentLine();
        if (!line || !line.words || line.words.length === 0) return null;
        if (this.currentWord < 0 || this.currentWord >= line.words.length) return null;
        return line.words[this.currentWord];
    }

    // Navigation: lines
    async nextLine() {
        const lines = this.getContentLines();
        if (this.currentLine < lines.length - 1) {
            this.currentLine++;
            this.currentWord = 0;
            this.saveProgress();
            this.dispatchEvent(new Event('lineChanged'));
            if (this.autoTranslateMode === 'line') {
                this.translateLineAt(this.currentLine).catch(err => {
                    this.error = err + '';
                    console.error('nextLine auto-translate error:', this.error);
                });
            }
            return true;
        }
        // Last line: advance to next chapter
        await this.nextChapter();
        return false;
    }

    async prevLine() {
        if (this.currentLine > 0) {
            this.currentLine--;
            const line = this.getCurrentLine();
            this.currentWord = line?.words?.length - 1 ?? 0;
            this.saveProgress();
            this.dispatchEvent(new Event('lineChanged'));
            if (this.autoTranslateMode === 'line') {
                this.translateLineAt(this.currentLine).catch(err => {
                    this.error = err + '';
                    console.error('prevLine auto-translate error:', this.error);
                });
            }
            return true;
        }
        // First line: go to previous chapter
        await this.prevChapter(true);
        return false;
    }

    // Navigation: words within current line
    async nextWord() {
        const line = this.getCurrentLine();
        if (!line || !line.words) return false;
        for (let i = this.currentWord + 1; i < line.words.length; i++) {
            if (typeof line.words[i] === 'object' && line.words[i].src) {
                this.currentWord = i;
                this.dispatchEvent(new Event('wordChanged'));
                return true;
            }
        }
        // Last word: advance line (cascades to chapter if needed)
        await this.nextLine();
        return false;
    }

    async prevWord() {
        const line = this.getCurrentLine();
        if (!line || !line.words) return false;
        for (let i = this.currentWord - 1; i >= 0; i--) {
            if (typeof line.words[i] === 'object' && line.words[i].src) {
                this.currentWord = i;
                this.dispatchEvent(new Event('wordChanged'));
                return true;
            }
        }
        // First word: go to previous line (cascades to chapter if needed)
        await this.prevLine();
        return false;
    }

    selectWord(wordIndex) {
        this.currentWord = wordIndex;
        this.dispatchEvent(new Event('wordChanged'));
    }

    // Page up/down: +/-10 lines, single save at end
    pageUp(count = 10) {
        let moved = false;
        for (let i = 0; i < count; i++) {
            if (this.currentLine > 0) {
                this.currentLine--;
                this.currentWord = 0;
                moved = true;
            }
        }
        if (moved) {
            this.saveProgress();
            this.dispatchEvent(new Event('lineChanged'));
            if (this.autoTranslateMode === 'line') {
                this.translateLineAt(this.currentLine).catch(err => {
                    this.error = err + '';
                    console.error('pageUp auto-translate error:', this.error);
                });
            }
        }
    }

    pageDown(count = 10) {
        let moved = false;
        const lines = this.getContentLines();
        for (let i = 0; i < count; i++) {
            if (this.currentLine < lines.length - 1) {
                this.currentLine++;
                this.currentWord = 0;
                moved = true;
            }
        }
        if (moved) {
            this.saveProgress();
            this.dispatchEvent(new Event('lineChanged'));
            if (this.autoTranslateMode === 'line') {
                this.translateLineAt(this.currentLine).catch(err => {
                    this.error = err + '';
                    console.error('pageDown auto-translate error:', this.error);
                });
            }
        }
    }

 // Chapter navigation
    async prevChapter(jumpToEnd) {
        if (!this.chapterIndex) return;
        if (this.currentChapter > 0) {
            this.saveProgress();
            await this.loadChapter(this.currentChapter - 1);
        } else if (jumpToEnd) {
            return;
        }
        const lines = this.getContentLines();
        if (lines.length > 0) {
            this.currentLine = jumpToEnd ? lines.length - 1 : 0;
            const line = this.getCurrentLine();
            this.currentWord = jumpToEnd ? (line?.words?.length - 1 ?? 0) : 0;
            this.dispatchEvent(new Event('lineChanged'));
        }

    }

    async nextChapter() {
        if (!this.chapterIndex) return;
        if (this.currentChapter < this.chapterIndex.chapters.length - 1) {
            this.saveProgress();
            this.currentLine = 0;
            this.currentWord = 0;
            await this.loadChapter(this.currentChapter + 1);
        }
    }

    // Background translation
    async translateChapter() {
        if (this.translationProgress.running) return;
        if (!this.chapterContent) return;

        const lines = this.getContentLines();
        const chapterIdx = this.currentChapter; // capture chapter index to prevent cache corruption on navigation
        const prefaceLen = this.chapterContent.preface.length; // capture structure before navigation
        this.translationProgress.running = true;
        this.translationProgress.current = 0;
        this.translationProgress.total = lines.length;
        this.#cancelTranslation = false;
        this.dispatchEvent(new Event('translationProgress'));
        console.log(`Starting translation for ${lines.length} lines`);

        try {
            await this.syosetu.translateLines(lines, (i, total) => {
                // Abort if user navigated away from this chapter
                if (this.currentChapter !== chapterIdx) {
                    this.#cancelTranslation = true;
                    return;
                }
                this.translationProgress.current = i + 1;
                this.dispatchEvent(new Event('translationProgress'));

                // Save just the newly translated line to its own file (fire-and-forget in sync callback)
                this.#saveTranslationCacheFromLines(lines, chapterIdx, prefaceLen, i).catch(ex => {
                    console.error('Failed to save line during translation:', ex);
                });

                // Notify view if the current line just got translated (only if still on this chapter)
                if (this.currentChapter === chapterIdx && i === this.currentLine) {
                    this.dispatchEvent(new Event('lineTranslated'));
                }
            }, () => this.#cancelTranslation);

            // Final save (only if still on the same chapter)
            if (this.currentChapter === chapterIdx) {
                await this.saveTranslationCache();
                console.log(`Saved translation cache for ch${chapterIdx}`);
            }
            console.log('Translation complete');
        } catch (err) {
            this.error = err + '';
            console.error('Translation error:', this.error);
            throw err;
        } finally {
            this.translationProgress.running = false;
            this.dispatchEvent(new Event('translationProgress'));
        }
    }

    cancelTranslation() {
        this.#cancelTranslation = true;
    }

 // Restart chapter translation from scratch: force-re-download chapter, wipe translation cache
    async restartChapterTranslation() {
        if (!this.currentBook || !this.chapterContent || this.translationProgress.running)
            return;

        const chapterIdx = this.currentChapter;

        console.log('Restarting chapter translation from scratch');
        // Wipe per-line cache files
        const dir = this.#getChapterDir(this.currentBook, chapterIdx);
        try {
            const entries = await fs.listDir(dir);
            if (entries) {
                for (const e of entries) {
                    if (/^L[pc]\d+\.json$/.test(e.name)) {
                        await fs.deleteFile(`${dir}${e.name}`);
                    }
                }
            }
            console.log(`Wiped per-line cache for ch${chapterIdx}`);
        } catch (ex) {
            console.log(`No per-line cache to wipe for ch${chapterIdx}`);
        }

        this.chapterContent = null;
        this.translationProgress = { total: 0, current: 0, running: false };
        this.dispatchEvent(new Event('translationProgress'));
        try {
            await this.loadChapter(chapterIdx, true);
        } catch (err) {
            this.error = err + '';
            console.error('Restart translation error:', this.error);
            throw err;
        }
    }

    // Re-translate the current line (clears existing translation first)
    async reTranslateLine() {
        if (this.translationProgress.running) {
            console.log('Cannot re-translate while chapter translation is running');
            return;
        }
        const line = this.getCurrentLine();
        if (!line) return;

        console.log('Re-translating line', this.currentLine);
        // Clear existing translation to force re-translation
        delete line.english;
        delete line.words;

        const lines = this.getContentLines();

        this.translationProgress.running = true;
        this.translationProgress.current = 0;
        this.translationProgress.total = 1;
        this.dispatchEvent(new Event('translationProgress'));

        try {
            const prefaceLen = this.chapterContent.preface.length;
            await this.syosetu.translateLine(lines, this.currentLine, (i, total) => {
                this.translationProgress.current = 1;
                this.dispatchEvent(new Event('translationProgress'));
            });

            // Save only the re-translated line
            const idx = this.currentLine;
            if (idx < prefaceLen) {
                await this.#saveLineToFile(this.currentBook, this.currentChapter, idx, line, 'preface');
            } else {
                await this.#saveLineToFile(this.currentBook, this.currentChapter, idx - prefaceLen, line, 'content');
            }
            console.log('Re-translation complete for line', this.currentLine);
            this.dispatchEvent(new Event('lineTranslated'));
            this.dispatchEvent(new Event('lineChanged'));
        } catch (err) {
            this.error = err + '';
            console.error('Re-translate error:', this.error);
            throw err;
        } finally {
            this.translationProgress.running = false;
            this.dispatchEvent(new Event('translationProgress'));
        }
    }

    // Re-translate hiragana/definition for the current word only
    async reTranslateWord() {
        const word = this.getCurrentWord();
        const line = this.getCurrentLine();
        if (!word || !line || typeof word !== 'object') return;

        console.log('Re-translating word:', word.src);
        const context = line.text;

             try {
            const info = await this.syosetu.getWordInfo(word.src, context);
            word.hir = info.hir || '';
            word.dic = info.dic || '';
            // Save only the modified line
            const prefaceLen = this.chapterContent.preface.length;
            const idx = this.currentLine;
            if (idx < prefaceLen) {
                await this.#saveLineToFile(this.currentBook, this.currentChapter, idx, line, 'preface');
            } else {
                await this.#saveLineToFile(this.currentBook, this.currentChapter, idx - prefaceLen, line, 'content');
            }
            console.log('Word re-translation complete:', word.src, '->', word.hir, word.dic);
        } catch (err) {
            this.error = err + '';
            console.error('Re-translate word error:', this.error);
            throw err;
        }

        this.dispatchEvent(new Event('wordChanged'));
    }

    // Translate a single line by index (used for 'line' auto-translate mode)
    async translateLineAt(index) {
        if (this.translationProgress.running) return;
        const lines = this.getContentLines();
        if (index < 0 || index >= lines.length) return;
        const line = lines[index];
        if (line.english) return; // already translated

        console.log(`Auto-translating line ${index} (line mode)`);
        this.translationProgress.running = true;
        this.translationProgress.current = 0;
        this.translationProgress.total = 1;
        this.dispatchEvent(new Event('translationProgress'));

        try {
            const prefaceLen = this.chapterContent.preface.length;
            await this.syosetu.translateLine(lines, index, (i, total) => {
                this.translationProgress.current = 1;
                this.dispatchEvent(new Event('translationProgress'));
            });

            // Save only the translated line
            if (index < prefaceLen) {
                await this.#saveLineToFile(this.currentBook, this.currentChapter, index, line, 'preface');
            } else {
                await this.#saveLineToFile(this.currentBook, this.currentChapter, index - prefaceLen, line, 'content');
            }
            this.dispatchEvent(new Event('lineTranslated'));
            console.log(`Auto-translation complete for line ${index}`);
        } catch (err) {
            this.error = err + '';
            console.error('Auto-translate line error:', this.error);
        } finally {
            this.translationProgress.running = false;
            this.dispatchEvent(new Event('translationProgress'));
        }
    }

    // Persist per-book reading position
    saveProgress() {
        if (!this.currentBook || !this.books[this.currentBook]) return;
        this.books[this.currentBook].chapter = this.currentChapter;
        this.books[this.currentBook].line = this.currentLine;
        this.books[this.currentBook].word = this.currentWord;
        this.save();
    }

    // Debounced save: coalesces multiple calls within 5s window
    save() {
        if (this.#saveTimeout) return;
        this.#saveTimeout = setTimeout(() => {
            this.#saveTimeout = null;
            this.#flushSave();
        }, 5000);
    }

    // Immediate save (no debounce)
    saveNow() {
        if (this.#saveTimeout) {
            clearTimeout(this.#saveTimeout);
            this.#saveTimeout = null;
        }
        this.#flushSave();
    }

    #flushSave() {
        try {
            fs.writeFile(`${NovelFolder}/library.json`, JSON.stringify({
                books: this.books,
                current: this.currentBook
            }));
            this.dispatchEvent(new Event('saved'));
        } catch (err) {
            console.error('save error:', err);
        }
    }

   // Save translation cache to disk (uses current chapter index)
    async saveTranslationCache() {
        await this.saveTranslationCacheFor(this.currentChapter);
    }

    // Save translation cache to disk with explicit chapter index (per-line files)
    async saveTranslationCacheFor(chapterIdx) {
        if (!this.chapterContent) return;
        for (let i = 0; i < this.chapterContent.preface.length; i++) {
            await this.#saveLineToFile(this.currentBook, chapterIdx, i, this.chapterContent.preface[i], 'preface');
        }
        for (let i = 0; i < this.chapterContent.content.length; i++) {
            await this.#saveLineToFile(this.currentBook, chapterIdx, i, this.chapterContent.content[i], 'content');
        }
    }

   // Save translated lines to cache for a specific chapter (used during background translation)
    // Only saves the line at `translatedIndex` (global index) to its own file
    async #saveTranslationCacheFromLines(lines, chapterIdx, prefaceLen, translatedIndex) {
        const line = lines[translatedIndex];
        if (translatedIndex < prefaceLen) {
            await this.#saveLineToFile(this.currentBook, chapterIdx, translatedIndex, line, 'preface');
        } else {
            await this.#saveLineToFile(this.currentBook, chapterIdx, translatedIndex - prefaceLen, line, 'content');
        }
    }
}
