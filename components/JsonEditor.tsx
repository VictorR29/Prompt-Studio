import React from 'react';

const isHexColor = (str: unknown): str is string => typeof str === 'string' && /^#[0-9A-F]{6}$/i.test(str);

const createHighlightedMarkup = (jsonString: string): { __html: string } => {
    // Re-format the JSON string to be pretty-printed
    let json = JSON.stringify(JSON.parse(jsonString), null, 2);
    
    // Basic HTML escaping
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    const html = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let cls = 'text-cyan-300'; // number
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'text-teal-300'; // key
            } else {
                cls = 'text-green-300'; // string
                const strValue = match.substring(1, match.length - 1);
                if (isHexColor(strValue)) {
                    const swatchHtml = `<span style="background-color: ${strValue}" class="inline-block w-3 h-3 rounded-sm border border-white/20 mr-1.5 align-middle"></span>`;
                    return `<span class="text-amber-300">"${swatchHtml}${strValue}"</span>`;
                }
            }
        } else if (/true|false/.test(match)) {
            cls = 'text-purple-400'; // boolean
        } else if (/null/.test(match)) {
            cls = 'text-gray-500'; // null
        }
        return `<span class="${cls}">${match}</span>`;
    });
    return { __html: html };
};


interface JsonEditorProps {
    jsonString: string;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({ jsonString }) => {
    try {
        const markup = createHighlightedMarkup(jsonString);
        return (
            <pre
                className="font-mono text-sm text-gray-300 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={markup}
            />
        );
    } catch (e: any) {
        return <pre className="font-mono text-xs text-red-400">Error al analizar JSON: {e.message}</pre>;
    }
};
