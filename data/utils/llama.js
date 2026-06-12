import {lenientParse} from './lenientParse.js'

export const llamaSettings = {
    schema: undefined,
    json_mode: settings.llmJsonMode || false,
    max_retries: settings.llmMaxRetries || 4,
    temperature: settings.llmTemperature || 1,
    max_tokens: settings.llmMaxTokens || undefined,
    endpoint: settings.llmServerEndpoint || "http://localhost:8081/v1/chat/completions",
    embeddings_endpoint: settings.llmEmbeddingsEndpoint || "http://localhost:8081/v1/embeddings",
    thinking_budget_tokens: settings.llmThinkingBudgetTokens || 10000,
    reasoning_budget_end_tag: settings.llmReasoningBudgetEndTag || " ... thinking budget exceeded, let's answer now. \n",
    verbose: false
};

function fail(reason) {
    if (llamaSettings.verbose)
        console.error('[SCHEMA]', reason);
    return false;
}


export function validateSchema(value, schema, path = "$") {
    if (!schema || typeof schema != 'object')
        return true;


    let type = schema.type;
    if (type) {
        if (Array.isArray(type)) {
            for (const t of type) {
                if (t === 'null' && value === null) return true;
                if (t !== 'null' && validateSchema(value, { ...schema, type: t }, path)) return true;
            }
            return fail(`Type mismatch: expected one of ${type.join(', ')}`);
        }
        if (type === 'array') {
            if (!Array.isArray(value))
                return fail('Not an array');
            if (schema.minItems !== undefined && value.length < schema.minItems)
                return fail(`Insufficient items in array (${value.length})`);
            if (schema.maxItems !== undefined && value.length > schema.maxItems)
                return fail(`Too many items in array (${value.length})`);
            if (schema.uniqueItems && value.length !== new Set(value.map(v => JSON.stringify(v))).size)
                return fail('Array items not unique');
            if (schema.items) {
                for (let i = 0; i < value.length; i++) {
                    if (!validateSchema(value[i], schema.items, `${path}[${i}]`))
                        return false;
                }
            }
            if (schema.additionalItems === false && value.length > 0)
                return false;
        } else if (type === 'object') {
            if (typeof value !== 'object' || value === null || Array.isArray(value))
                return fail('Not an object');
            const keys = Object.keys(value);
            if (schema.required) {
                for (const req of schema.required) {
                    if (schema.properties && schema.properties[req] === undefined) {
                        if (!keys.includes(req))
                            return fail(`Missing required property: ${req}`);
                    }
                }
            }
            if (schema.properties) {
                for (const [key, propSchema] of Object.entries(schema.properties)) {
                    if (value.hasOwnProperty(key)) {
                        if (!validateSchema(value[key], propSchema, `${path}.${key}`))
                            return false;
                    } else if (schema.required && schema.required.includes(key)) {
                        return fail(`Missing required property: ${key}`);
                    }
                }
            }
            if (schema.additionalProperties === false) {
                const allowedKeys = schema.properties ? Object.keys(schema.properties) : [];
                for (const key of keys) {
                    if (!allowedKeys.includes(key))
                        return fail(`Unexpected property: ${key}`);
                }
            } else if (typeof schema.additionalProperties === 'object') {
                for (const [key, val] of Object.entries(value)) {
                    if (!schema.properties || !(key in schema.properties)) {
                        if (!validateSchema(val, schema.additionalProperties, `${path}.${key}`))
                            return false;
                    }
                }
            }
        } else if (type === 'string') {
            if (typeof value !== 'string')
                return fail('Not a string');
            if (schema.minLength !== undefined && value.length < schema.minLength)
                return fail(`String too short (min: ${schema.minLength})`);
            if (schema.maxLength !== undefined && value.length > schema.maxLength)
                return fail(`String too long (max: ${schema.maxLength})`);
            if (schema.pattern && !new RegExp(schema.pattern).test(value))
                return fail(`String doesn't match pattern`);
            if (schema.enum && !schema.enum.includes(value))
                return fail(`Invalid enum value`);
            if (schema.const && value !== schema.const)
                return fail(`Invalid const value`);
        } else if (type === 'number' || type === 'integer') {
            if (typeof value !== 'number')
                return fail('Not a number');
            if (type === 'integer' && !Number.isInteger(value))
                return fail('Not an integer');
            if (schema.minimum !== undefined && value < schema.minimum)
                return fail(`Value below minimum`);
            if (schema.maximum !== undefined && value > schema.maximum)
                return fail(`Value above maximum`);
            if (schema.minItems !== undefined && schema.minItems !== undefined) {
                if (typeof schema.minimum === 'number' && value < schema.minimum)
                    return fail(`Value below minimum`);
                if (typeof schema.maximum === 'number' && value > schema.maximum)
                    return fail(`Value above maximum`);
            }
            if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum)
                return fail(`Value at or below exclusive minimum`);
            if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum)
                return fail(`Value at or above exclusive maximum`);
            if (schema.enum && !schema.enum.includes(value))
                return fail('Invalid enum value');
            if (schema.const && value !== schema.const)
                return fail('Invalid const value');
        } else if (type === 'boolean') {
            if (typeof value !== 'boolean')
                return fail('Not a boolean');
            if (schema.enum && !schema.enum.includes(value))
                return fail('Invalid enum value');
            if (schema.const && value !== schema.const)
                return fail('Invalid const value');
        } else if (type === 'null') {
            if (value !== null)
                return fail('Not null');
        } else if (type === 'any' || type === undefined) {
            // any type matches everything
        } else {
            return fail(`Unknown type: ${type}`);
        }
    }

    if (schema.anyOf) {
        let matched = false;
        for (const subSchema of schema.anyOf) {
            if (validateSchema(value, subSchema, path)) {
                matched = true;
                break;
            }
        }
        if (!matched)
            return false;
    }

    if (schema.allOf) {
        for (const subSchema of schema.allOf) {
            if (!validateSchema(value, subSchema, path))
                return false;
        }
    }

    if (schema.oneOf) {
        let matched = 0;
        for (const subSchema of schema.oneOf) {
            if (validateSchema(value, subSchema, path))
                matched++;
        }
        if (matched !== 1)
            return fail(`oneOf: ${matched} schemas matched`);
    }

    if (schema.not) {
        if (validateSchema(value, schema.not, path))
            return fail('not schema matched');
    }

    if (schema.if && !validateSchema(value, schema.if, path))
        return false;
    if (schema.if && schema.then && schema.then) {
        if (!validateSchema(value, schema.then, path))
            return fail('then schema failed');
    }
    if (schema.if && schema.else && schema.else) {
        if (!schema.if || !validateSchema(value, schema.if, path)) {
            if (!validateSchema(value, schema.else, path))
                return fail('else schema failed');
        }
    }

    return true;
}

export function extractJSON(str, debug) {
    if (!str || typeof str != 'string') {
        if (debug)
            console.error(`[EXTRACTJSON]: Empty string`);
        return undefined;
    }
    let end = str.length;
    while (end) {
        let c = str[--end];
        if (c == '}' || c == ']')
            break;
    }

    if (!end) {
        if (debug)
            console.error(`[EXTRACTJSON]: could not find end`);
        return undefined;
    }

    let start = end;
    let depth = 1;
    let instr = false;
    while (start) {
        let c = str[--start];
        if (c == '"') {
            if (!instr) {
                instr = true;
            } else if (str[start - 1] == '\\') {
            } else {
                instr = false;
            }
        }
        if (instr)
            continue;
        if (c == '}' || c == ']')
            depth++;
        if (c == '{' || c == '[') {
            depth--;
            if (depth == 0)
                break;
        }
    }

    if (depth) {
        if (debug)
            console.error(`[EXTRACTJSON]: could not find start`);
        return undefined;
    }

    str = str.substr(start, end - start + 1);
    try {
        return lenientParse(str);
    } catch (ex) {
        console.log('invalid', str, ex);
    }

    return undefined;
}

export async function simplePrompt(prompt, settings = {}) {
    settings = Object.assign({}, llamaSettings, settings);

    let messages = settings.messages ?? [];
    if (typeof prompt == 'string') {
        if (settings.system_prompt) {
            messages.push({
                role: "system",
                content: settings.system_prompt
            });
        }
        if (prompt) {
            messages.push({
                role: "user",
                content: prompt
            });
        }
        if (settings.verbose)
            console.log(`[${settings.task ?? 'LLAMA'}]: ${prompt}`);
    } else if (Array.isArray(prompt)) {
        messages = prompt;
        if (settings.verbose)
            console.log(`[${settings.task ?? 'LLAMA'}]: ${JSON.stringify(messages, null, 2)}`);
    }

    for (let i = 0; i < settings.max_retries; ++i) {

        try {
            const response = await fetch(settings.endpoint, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    model: settings.llmModel || "gpt-4o-mini",
                    temperature: settings.temperature,
                    thinking_budget_tokens: llamaSettings.thinking_budget_tokens,
                    reasoning_budget_end_tag: llamaSettings.reasoning_budget_end_tag,
                    messages,
                    max_tokens: settings.max_tokens
                })
            });

            let result;
            try {
                result = await response.json();
            } catch (ex) {
                console.error("LLAMA: Fetch Error ", settings.endpoint);
                console.error(ex);
                await new Promise(ok => setTimeout(ok, 3000));
                continue;
            }

            // console.log(JSON.stringify(result, null, 2));
            const content = result?.choices?.[0]?.message?.content;
            const reasoning = result?.choices?.[0]?.message?.reasoning_content;
            // if (reasoning) console.log(reasoning);
            if (!content)
                return content;
            messages.push(result?.choices?.[0]?.message);
            let clean = content.replace(/.*<\/think>/gm, '');
            if (!settings.json_mode)
                return clean;
            let object = extractJSON(clean, settings.debug);
            if (object && settings.schema && !validateSchema(object, settings.schema)) {
                console.error(`LLAMA: Schema validation failed`);
                console.error(JSON.stringify(object, null, 2));
                messages.push({
                    role: 'user',
                    content: `Error. Response must match schema: ${JSON.stringify(settings.schema)}`
                });
                continue;
            }
            return object;
        } catch (e) {
            console.error("LLAMA: Fetch failed:", e);
        }
    }
}

export async function jsonPrompt(prompt, settings = {}) {
    return simplePrompt(prompt, Object.assign({json_mode:true}, settings));
}

export async function getEmbedding(input, settings = {}) {
    settings = Object.assign({}, llamaSettings, settings);

    const payload = {
        input,
        model: settings.llmModel || "gpt-4o-mini",
        encoding_format: "float"
    };

    for (let i = 0; i < settings.max_retries; ++i) {
        try {
            const response = await fetch(settings.embeddings_endpoint, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload)
            });

            let result;
            try {
                result = await response.json();
            } catch (ex) {
                console.error("LLAMA: Embeddings fetch error", settings.embeddings_endpoint);
                console.error(ex);
                await new Promise(ok => setTimeout(ok, 3000));
                continue;
            }

            const embedding = result?.data?.[0]?.embedding;
            if (!embedding)
                return null;
            return embedding;
        } catch (e) {
            console.error("LLAMA: Embeddings fetch failed:", e);
        }
    }
    return null;
}
