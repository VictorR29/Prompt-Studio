
export type ExtractionMode = 'style' | 'subject' | 'pose' | 'expression' | 'scene' | 'outfit' | 'composition' | 'color' | 'object';

export interface SavedPrompt {
  id: string;
  type: 'style' | 'structured' | 'pose' | 'expression' | 'scene' | 'outfit' | 'composition' | 'color' | 'master' | 'subject' | 'object';
  prompt: string;
  coverImage: string; // base64 data URL
  title: string;
  category: string;
  artType: string;
  notes: string;
}

export interface PlaygroundOperation {
  module: ExtractionMode;
  value: string;
}

export interface AssistantResponse {
  message: string;
  updates: PlaygroundOperation[];
  assembled_prompt?: string;
}

export interface AssistantSuggestion {
  module: ExtractionMode;
  newValue: string;
}

export type AppView = 'editor' | 'extractor' | 'gallery' | 'playground';