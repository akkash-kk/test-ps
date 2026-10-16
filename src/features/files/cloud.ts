import { download } from '../../persistence/puter';

export interface CloudItem {
  path: string;
  name: string;
  isDir?: boolean;
  read(): Promise<Blob>;
}
type ExtendedPuter = {
  fs: {
    write(path: string, data: Blob, options?: { overwrite?: boolean; dedupeName?: boolean; createMissingParents?: boolean }): Promise<CloudItem>;
    read(path: string): Promise<Blob>;
  };
  ui: {
    showOpenFilePicker(options: { accept?: string | string[]; multiple?: boolean }): Promise<CloudItem | CloudItem[]>;
    showSaveFilePicker(content: Blob, name: string): Promise<CloudItem>;
    showDirectoryPicker(options?: { multiple?: boolean }): Promise<CloudItem | CloudItem[]>;
  };
};
const api = () => (window as unknown as { puter?: ExtendedPuter }).puter;

export const openAccept = '.photo,.psd,.psb,.tif,.tiff,.bmp,.dib,.gif,.ico,.cur,.tga,.pbm,.pgm,.ppm,.pnm,.pam,.svg,image/*';

export async function pickCloudFiles(multiple: boolean, accept = openAccept): Promise<CloudItem[]> {
  const p = api();
  if (p?.ui?.showOpenFilePicker) {
    const r = await p.ui.showOpenFilePicker({ accept, multiple });
    return Array.isArray(r) ? r : [r];
  }
  const win = window as unknown as {
    showOpenFilePicker?: (opts: unknown) => Promise<Array<{ name: string; getFile(): Promise<File> }>>;
  };
  if (typeof win.showOpenFilePicker === 'function') {
    const handles = await win.showOpenFilePicker({ multiple });
    return Promise.all(
      handles.map(async (h) => {
        const f = await h.getFile();
        return { name: f.name, path: f.name, read: async () => f };
      }),
    );
  }
  throw new Error('File picker is not available.');
}

export async function pickCloudFolder(): Promise<CloudItem> {
  const p = api();
  if (p?.ui?.showDirectoryPicker) {
    const r = await p.ui.showDirectoryPicker({ multiple: false });
    return Array.isArray(r) ? r[0] : r;
  }
  const win = window as unknown as {
    showDirectoryPicker?: (opts: unknown) => Promise<{ name: string }>;
  };
  if (typeof win.showDirectoryPicker === 'function') {
    const handle = await win.showDirectoryPicker({});
    return { name: handle.name, path: handle.name, isDir: true, read: async () => new Blob() };
  }
  throw new Error('Directory picker is not available.');
}

export async function cloudSaveAs(blob: Blob, name: string): Promise<CloudItem> {
  const p = api();
  if (p?.ui?.showSaveFilePicker) {
    return p.ui.showSaveFilePicker(blob, name);
  }
  const win = window as unknown as {
    showSaveFilePicker?: (opts: unknown) => Promise<{
      name: string;
      createWritable(): Promise<{ write(d: Blob): Promise<void>; close(): Promise<void> }>;
    }>;
  };
  if (typeof win.showSaveFilePicker === 'function') {
    const handle = await win.showSaveFilePicker({ suggestedName: name });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { name: handle.name, path: handle.name, read: async () => blob };
  }
  download(blob, name);
  return { name, path: name, read: async () => blob };
}

export async function cloudWrite(path: string, blob: Blob, opts: { dedupeName?: boolean } = {}) {
  const p = api();
  if (p?.fs?.write) {
    return p.fs.write(path, blob, { overwrite: !opts.dedupeName, dedupeName: !!opts.dedupeName, createMissingParents: true });
  }
  download(blob, path);
  return { name: path, path, read: async () => blob };
}

export async function cloudRead(path: string) {
  const p = api();
  if (p?.fs?.read) {
    return p.fs.read(path);
  }
  throw new Error('File is not readable.');
}

export function joinPath(dir: string, name: string) {
  return `${dir.replace(/\/+$/, '')}/${name}`;
}
