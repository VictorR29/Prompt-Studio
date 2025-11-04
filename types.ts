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
