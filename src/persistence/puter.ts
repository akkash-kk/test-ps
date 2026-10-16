interface FSItem {
  path: string;
  name: string;
  read(): Promise<Blob>;
}
interface Puter {
  env: string;
  auth: {
    isSignedIn(): boolean;
    signIn(): Promise<unknown>;
    signOut(): void;
    getUser(): Promise<{ username: string }>;
  };
  fs: {
    write(path: string, data: Blob, options?: { createMissingParents?: boolean }): Promise<FSItem>;
    read(path: string): Promise<Blob>;
  };
  ui: {
    showOpenFilePicker(options: { accept: string; multiple: boolean }): Promise<FSItem>;
    showSaveFilePicker(content: Blob, name: string): Promise<FSItem>;
  };
}
declare global {
  interface Window {
    puter?: Puter;
  }
}
export function puter(): Puter {
  if (!window.puter)
    throw new Error('Storage service is unavailable. Check your connection, or save a local project.');
  return window.puter;
}
export function canSignOut(env: string) {
  return env !== 'app';
}
export class PuterStorage {
  path?: string;
  private generation = 0;
  async save(blob: Blob, name: string) {
    if (window.puter?.fs) {
      const p = window.puter,
        generation = this.generation;
      const item = this.path
        ? await p.fs.write(this.path, blob)
        : await p.ui.showSaveFilePicker(blob, `${name}.photo`);
      if (generation === this.generation) this.path = item.path;
      return item;
    }
    // Browser native File System Access API
    const win = window as unknown as {
      showSaveFilePicker?: (opts: unknown) => Promise<{
        name: string;
        createWritable(): Promise<{ write(d: Blob): Promise<void>; close(): Promise<void> }>;
      }>;
    };
    if (typeof win.showSaveFilePicker === 'function') {
      try {
        const handle = await win.showSaveFilePicker({
          suggestedName: preferredFileName(`${name}.photo`),
          types: [{ description: 'Smart Editor project', accept: { 'application/octet-stream': ['.photo'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        this.path = handle.name;
        return { name: handle.name, path: handle.name, read: async () => blob };
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err;
      }
    }
    download(blob, `${name}.photo`);
    return { name: `${name}.photo`, path: `${name}.photo`, read: async () => blob };
  }
  async open() {
    if (window.puter?.ui) {
      const item = await window.puter.ui.showOpenFilePicker({
        accept: '.photo,.psd,.psb,image/*',
        multiple: false,
      });
      return { blob: await item.read(), name: item.name, path: item.path };
    }
    const win = window as unknown as {
      showOpenFilePicker?: (opts: unknown) => Promise<Array<{
        name: string;
        getFile(): Promise<File>;
      }>>;
    };
    if (typeof win.showOpenFilePicker === 'function') {
      const handles = await win.showOpenFilePicker({
        types: [{ description: 'Images and Projects', accept: { 'application/octet-stream': ['.photo', '.psd', '.psb'], 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff'] } }],
        multiple: false,
      });
      if (handles.length > 0) {
        const file = await handles[0].getFile();
        return { blob: file, name: file.name, path: file.name };
      }
    }
    throw new Error('File picker is not supported in this browser.');
  }
  reset() {
    this.generation++;
    this.path = undefined;
  }
}
// Preferences → File Handling → Append file extension (set by the editor).
export const fileNaming = { extensionCase: 'lower' as 'lower' | 'upper' };
/** A file name with its extension in the preferred case. */
export function preferredFileName(name: string) {
  const m = /^(.*\.)([A-Za-z0-9]{1,8})$/.exec(name);
  if (!m) return name;
  return m[1] + (fileNaming.extensionCase === 'upper' ? m[2].toUpperCase() : m[2].toLowerCase());
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = preferredFileName(name);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
