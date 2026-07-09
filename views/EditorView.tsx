
import React from 'react';
import { SavedPrompt, AppView } from '../types';
import { PromptEditor } from '../components/PromptEditor';

interface EditorViewProps {
  initialPrompt: SavedPrompt | null;
  savedPrompts: SavedPrompt[];
  onSavePrompt: (prompt: SavedPrompt) => void;
  setView: (view: AppView) => void;
  onNavigateToGallery: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  setGlobalLoader: (state: { active: boolean; message: string }) => void;
}

const EditorView: React.FC<EditorViewProps> = (props) => (
  <div className="animate-fade-slide-in-up">
    <PromptEditor
      key={props.initialPrompt?.id || 'new-editor'}
      initialPrompt={props.initialPrompt}
      onSavePrompt={props.onSavePrompt}
      savedPrompts={props.savedPrompts}
      setView={props.setView}
      onNavigateToGallery={props.onNavigateToGallery}
      addToast={props.addToast}
      setGlobalLoader={props.setGlobalLoader}
    />
  </div>
);

export default EditorView;
