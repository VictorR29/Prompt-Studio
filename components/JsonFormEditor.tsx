

import React, { useState, useEffect, useRef } from 'react';
import { smartFieldOptions } from './smartFieldConfig';

interface JsonFormEditorProps {
    jsonData: any;
    onJsonChange: (newData: any) => void;
}

const isHexColor = (value: unknown): value is string => {
    return typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value);
};


const AccordionIcon: React.FC<{ isOpen: boolean }> = ({ isOpen }) => (
    <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
);

const baseInputClasses = "w-full bg-gray-800/70 rounded-lg p-2.5 text-gray-200 ring-1 ring-gray-700/50 focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm transition-all shadow-inner placeholder:text-gray-500";

const renderField = (key: string, value: any, path: string[], onDataChange: (path: string[], newValue: any) => void) => {
    const currentPath = [...path, key];
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        onDataChange(currentPath, e.target.value);
    };

    const handleArrayChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newArray = e.target.value.split('\n').filter(item => item.trim() !== '');
        onDataChange(currentPath, newArray);
    };
    
    // Smart Select Field
    if (key in smartFieldOptions && typeof value === 'string') {
        const options = smartFieldOptions[key as keyof typeof smartFieldOptions];
        return (
            <select
                value={value}
                onChange={handleInputChange}
                className={baseInputClasses}
            >
                {!options.includes(value) && <option value={value}>{value} (Personalizado)</option>}
                {options.map(option => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        );
    }


    // Smart Color Field
    if (isHexColor(value)) {
        return (
            <div className="group flex items-center space-x-2 bg-gray-800/70 rounded-lg ring-1 ring-gray-700/50 focus-within:ring-2 focus-within:ring-teal-500 pr-2 shadow-inner transition-all">
                <input
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    className="w-full bg-transparent p-2.5 text-gray-300 focus:outline-none text-sm font-mono"
                    maxLength={7}
                />
                <div className="relative w-6 h-6 rounded-md cursor-pointer overflow-hidden border-2 border-transparent group-focus-within:border-teal-500 transition-all">
                    <div
                        className="w-full h-full border border-white/20 rounded-sm"
                        style={{ backgroundColor: value }}
                    />
                    <input
                        type="color"
                        value={value}
                        onChange={handleInputChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
            </div>
        );
    }


    if (typeof value === 'string') {
        const isLongText = value.length > 60 || value.includes('\n');
        return isLongText ? (
            <textarea
                value={value}
                onChange={handleInputChange}
                className={`${baseInputClasses} min-h-[80px]`}
            />
        ) : (
            <input
                type="text"
                value={value}
                onChange={handleInputChange}
                className={baseInputClasses}
            />
        );
    }

    if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
        return (
             <textarea
                value={value.join('\n')}
                onChange={handleArrayChange}
                placeholder="Un valor por línea"
                className={`${baseInputClasses} min-h-[100px]`}
            />
        );
    }

    if (Array.isArray(value)) {
        const handleJsonArrayChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const lines = e.target.value.split('\n').filter(item => item.trim() !== '');
            const newArray = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return line; // keep as is if not valid json
                }
            });
            onDataChange(currentPath, newArray);
        };
        
        return (
            <textarea
                value={value.map(item => typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)).join('\n')}
                onChange={handleJsonArrayChange}
                placeholder="Un objeto JSON por línea"
                className={`${baseInputClasses} min-h-[100px]`}
            />
        );
    }
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return (
            <div className="pl-4 border-l-2 border-gray-700/50 space-y-4">
                {Object.entries(value).map(([nestedKey, nestedValue]) => (
                    <div key={nestedKey}>
                        <label className="block text-sm font-semibold text-gray-300 mb-1.5 capitalize">{nestedKey.replace(/_/g, ' ')}</label>
                        {renderField(nestedKey, nestedValue, currentPath, onDataChange)}
                    </div>
                ))}
            </div>
        );
    }

    // Fallback para otros tipos (números, booleanos, etc.)
    return (
        <input
            type="text"
            value={String(value)}
            onChange={handleInputChange}
            className={baseInputClasses}
        />
    );
};

export const JsonFormEditor: React.FC<JsonFormEditorProps> = ({ jsonData, onJsonChange }) => {
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current && jsonData && Object.keys(jsonData).length > 0) {
            const initialOpenState: Record<string, boolean> = {};
            // Abrir la primera sección por defecto
            const firstKey = Object.keys(jsonData)[0];
            initialOpenState[firstKey] = true;
            
            // Abrir secciones anidadas que son objetos
            Object.entries(jsonData).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    initialOpenState[key] = true;
                }
            });

            setOpenSections(initialOpenState);
            isFirstRender.current = false;
        }
    }, [jsonData]);

    useEffect(() => {
        // Reset open sections when jsonData changes to a completely new prompt
        const handleNewPrompt = (newJson: any) => {
             const initialOpenState: Record<string, boolean> = {};
            if (newJson && Object.keys(newJson).length > 0) {
                 const firstKey = Object.keys(newJson)[0];
                 initialOpenState[firstKey] = true;
                 Object.entries(newJson).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        initialOpenState[key] = true;
                    }
                });
            }
            setOpenSections(initialOpenState);
        };
        handleNewPrompt(jsonData);
    }, [jsonData]);

    if (!jsonData || typeof jsonData !== 'object' || Array.isArray(jsonData)) {
        return <div className="text-gray-500">JSON no válido o no es un objeto.</div>;
    }
    
    const toggleSection = (key: string) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleDataChange = (path: string[], newValue: any) => {
        const newJson = JSON.parse(JSON.stringify(jsonData));
        let current = newJson;
        for (let i = 0; i < path.length - 1; i++) {
            current = current[path[i]];
        }
        current[path[path.length - 1]] = newValue;
        onJsonChange(newJson);
    };

    return (
        <div className="w-full h-full flex flex-col">
            <h2 className="text-xl font-bold text-gray-200 mb-4 flex-shrink-0">Personalizar Campos</h2>
            <div className="overflow-y-auto custom-scrollbar flex-grow pr-3 -mr-3 space-y-3">
                {Object.entries(jsonData).map(([key, value]) => {
                     const isOpen = openSections[key] ?? false;
                     
                      const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);

                      if (isObject) {
                        return (
                            <div key={key} className="bg-gray-900/50 rounded-lg overflow-hidden ring-1 ring-white/10">
                                <button onClick={() => toggleSection(key)} className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors">
                                    <h3 className="font-semibold text-teal-300 capitalize text-base">{key.replace(/_/g, ' ')}</h3>
                                    <AccordionIcon isOpen={isOpen} />
                                </button>
                                {isOpen && (
                                    <div className="p-4 border-t border-gray-700 space-y-4">
                                        {Object.entries(value).map(([nestedKey, nestedValue]) => (
                                            <div key={nestedKey}>
                                                <label className="block text-sm font-semibold text-gray-300 mb-1.5 capitalize">{nestedKey.replace(/_/g, ' ')}</label>
                                                {renderField(nestedKey, nestedValue, [key], handleDataChange)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                      }
                      
                      // Render as a simple field if not an object
                      return (
                         <div key={key} className="p-3 bg-gray-900/50 rounded-lg ring-1 ring-white/10">
                            <label className="block text-sm font-semibold text-teal-300 mb-1.5 capitalize">{key.replace(/_/g, ' ')}</label>
                            {renderField(key, value, [], handleDataChange)}
                         </div>
                      );
                })}
            </div>
        </div>
    );
};