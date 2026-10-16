import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from './editor';
import { emitAppEvent } from './app/app-events';

export interface EditorState {
  isReady: boolean;
  tool: string;
  zoom: number;
  documentName: string;
  documentSize: { width: number; height: number };
  colorMode: string;
  hasDocument: boolean;
  canUndo: boolean;
  canRedo: boolean;
  statusText: string;
  engineStatus: string;
  layerCount: number;
  selectedLayerId: string;
  error: string | null;
}

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [editorState, setEditorState] = useState<EditorState>({
    isReady: false,
    tool: 'move',
    zoom: 1,
    documentName: 'Untitled',
    documentSize: { width: 1600, height: 1000 },
    colorMode: 'RGB / 8',
    hasDocument: false,
    canUndo: false,
    canRedo: false,
    statusText: 'Initializing...',
    engineStatus: 'Starting graphics…',
    layerCount: 0,
    selectedLayerId: '',
    error: null,
  });

  const syncState = useCallback((editor: Editor) => {
    const doc = editor.doc;
    const depth = doc.bitsPerChannel ?? 8;
    setEditorState((prev) => ({
      ...prev,
      tool: editor.tool,
      zoom: editor.zoom,
      documentName: doc.name || 'Untitled',
      documentSize: { width: doc.width, height: doc.height },
      colorMode: `${editor.colorModeLabel} / ${depth}`,
      hasDocument: editor.hasDocument,
      canUndo: editor.history.canUndo,
      canRedo: editor.history.canRedo,
      engineStatus: editor.renderer ? editor.renderer.name : prev.engineStatus,
      layerCount: doc.layers.length,
      selectedLayerId: editor.selected,
    }));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any previous children in container
    const container = containerRef.current;
    container.innerHTML = '';

    const editor = new Editor(container);
    editorRef.current = editor;

    // Attach to window for dev tools and tests
    (window as unknown as { photoStudio: Editor; smartEditor: Editor }).photoStudio = editor;
    (window as unknown as { smartEditor: Editor }).smartEditor = editor;

    editor.onUpdate((e) => {
      syncState(e);
    });

    let isMounted = true;

    editor
      .start()
      .then(() => {
        if (!isMounted) return;
        emitAppEvent('start');
        setEditorState((prev) => ({
          ...prev,
          isReady: true,
          statusText: 'Ready',
          engineStatus: editor.renderer ? editor.renderer.name : 'Ready',
        }));
        syncState(editor);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Editor start error:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        const statusEl = editor.el('#engine-status');
        if (statusEl) statusEl.textContent = 'Graphics unavailable';
        editor.message(errorMsg);
        setEditorState((prev) => ({
          ...prev,
          engineStatus: 'Graphics unavailable',
          error: errorMsg,
        }));
      });

    return () => {
      isMounted = false;
      // Cleanup if necessary
    };
  }, [syncState]);

  return (
    <div className="photo-studio-react-app">
      {editorState.error && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ff4d4f',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 4,
            zIndex: 99999,
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {editorState.error}
        </div>
      )}
      <div
        id="app"
        ref={containerRef}
        style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}
      />
    </div>
  );
};

export default App;
