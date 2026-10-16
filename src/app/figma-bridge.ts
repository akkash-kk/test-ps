import type { Editor } from '../editor';
import { exportPng, importFile } from '../ui/actions';

const bridgeType = 'photo-studio-figma';

type PluginMessage =
  | {
      type: 'load-image';
      name: string;
      mimeType: string;
      bytes: ArrayBuffer | Uint8Array;
    }
  | { type: 'export-image' };

function send(message: Record<string, unknown>, transfer: Transferable[] = []) {
  window.parent.postMessage({ bridge: bridgeType, ...message }, '*', transfer);
}

export function installFigmaBridge(editor: Editor) {
  if (window.parent === window) return () => {};

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window.parent || event.data?.bridge !== bridgeType) return;
    const message = event.data as PluginMessage;
    void (async () => {
      if (editor.busy) throw new Error('Wait for the current editor task to finish.');
      if (message.type === 'load-image') {
        if (
          typeof message.name !== 'string' ||
          !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(message.mimeType) ||
          (!(message.bytes instanceof ArrayBuffer) && !(message.bytes instanceof Uint8Array))
        )
          throw new Error('The selected Figma image could not be read.');
        const input =
          message.bytes instanceof ArrayBuffer
            ? new Uint8Array(message.bytes)
            : message.bytes;
        const buffer = new ArrayBuffer(input.byteLength);
        new Uint8Array(buffer).set(input);
        await importFile(editor, new Blob([buffer], { type: message.mimeType }), message.name);
        send({ type: 'image-loaded', name: message.name });
        return;
      }
      if (message.type === 'export-image') {
        if (!editor.hasDocument) throw new Error('Import an image before sending it to Figma.');
        editor.transform.apply();
        editor.modal?.apply();
        const png = await exportPng(editor);
        const bytes = await png.arrayBuffer();
        send({
          type: 'exported-image',
          name: editor.doc.name,
          width: editor.doc.width,
          height: editor.doc.height,
          bytes,
        }, [bytes]);
        return;
      }
    })().catch((error: unknown) => {
      send({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    });
  };

  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
