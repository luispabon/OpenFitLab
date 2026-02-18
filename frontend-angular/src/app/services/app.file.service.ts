import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppFileService {
  async decompressIfNeeded(buffer: ArrayBuffer, path?: string): Promise<ArrayBuffer> {
    const bytes = new Uint8Array(buffer);
    const isFit = path?.toLowerCase().endsWith('.fit');
    if (!isFit && bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
      try {
        const stream = new Response(buffer).body!.pipeThrough(new DecompressionStream('gzip'));
        return await new Response(stream).arrayBuffer();
      } catch {
        return buffer;
      }
    }
    return buffer;
  }
}
