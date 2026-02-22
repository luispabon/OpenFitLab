const zlib = require('zlib');
const { DOMParser } = require('xmldom');
const {
  EventImporterFIT,
  EventImporterTCX,
  EventImporterGPX,
  EventImporterSuuntoJSON,
  EventImporterSuuntoSML,
  ActivityParsingOptions,
} = require('@sports-alliance/sports-lib');
const JSONSanitizer = require('../utils/json-sanitizer');

class FileParser {
  /**
   * Parse a file buffer based on its extension
   * @param {Buffer} fileBuffer - The file buffer
   * @param {string} extension - File extension (e.g., 'tcx', 'fit', 'gpx')
   * @param {string} originalFilename - Original filename for error messages
   * @returns {Promise<Object>} Parsed event object
   */
  static async parseFile(fileBuffer, extension, originalFilename = '') {
    const ext = extension.toLowerCase();

    // Handle gzip decompression
    let buffer = fileBuffer;
    if (ext !== 'fit' && this.isGzipped(buffer)) {
      try {
        buffer = zlib.gunzipSync(buffer);
      } catch (e) {
        throw new Error(`Failed to decompress gzipped file: ${e.message}`, { cause: e });
      }
    }

    const options = new ActivityParsingOptions({ generateUnitStreams: false });

    try {
      let event;

      if (ext === 'fit') {
        // FIT files are binary
        // Convert Buffer to ArrayBuffer if needed
        const arrayBuffer =
          buffer instanceof Buffer
            ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
            : buffer.buffer || buffer;
        event = await EventImporterFIT.getFromArrayBuffer(arrayBuffer, options);
      } else {
        // Text-based formats
        const text = buffer.toString('utf8');

        if (ext === 'tcx') {
          const domParser = new DOMParser();
          const xmlDoc = domParser.parseFromString(text, 'application/xml');
          event = await EventImporterTCX.getFromXML(xmlDoc, options);
        } else if (ext === 'gpx') {
          event = await EventImporterGPX.getFromString(text, options);
        } else if (ext === 'json') {
          let json;
          try {
            json = JSON.parse(text);
          } catch {
            // Try as SML JSON string
            try {
              event = await EventImporterSuuntoSML.getFromJSONString(text, options);
            } catch {
              throw new Error('Invalid JSON format');
            }
          }
          if (json && !event) {
            // Sanitize JSON before parsing
            const { sanitizedJson } = JSONSanitizer.sanitize(json);
            event = await EventImporterSuuntoJSON.getFromJSONString(
              JSON.stringify(sanitizedJson),
              options
            );
          }
        } else if (ext === 'sml') {
          event = await EventImporterSuuntoSML.getFromXML(text, options);
        } else {
          throw new Error(`Unsupported file format: ${ext}`);
        }
      }

      if (!event) {
        throw new Error('Failed to parse file - no event data extracted');
      }

      // Always set filename as event name (prioritize filename over parsed name)
      if (originalFilename && originalFilename.trim()) {
        const filenameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '').trim(); // Remove extension and trim
        if (filenameWithoutExt) {
          event.name = filenameWithoutExt;
        } else if (!event.name || !event.name.trim()) {
          event.name = 'Untitled Event';
        }
      } else if (!event.name || !event.name.trim()) {
        event.name = 'Untitled Event';
      }

      return event;
    } catch (e) {
      const errorMsg = originalFilename
        ? `Failed to parse ${originalFilename}: ${e.message}`
        : `Failed to parse file: ${e.message}`;
      throw new Error(errorMsg, { cause: e });
    }
  }

  /**
   * Check if buffer is gzipped by magic bytes
   * @param {Buffer} buffer
   * @returns {boolean}
   */
  static isGzipped(buffer) {
    return buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
  }

  /**
   * Extract extension from filename
   * @param {string} filename
   * @returns {string} Extension without dot
   */
  static getExtension(filename) {
    const parts = filename.split('.');
    if (parts.length < 2) return '';
    let ext = parts.pop().toLowerCase();
    // Handle .gz compression
    if (ext === 'gz' && parts.length > 0) {
      ext = parts.pop().toLowerCase();
    }
    return ext;
  }
}

module.exports = FileParser;
