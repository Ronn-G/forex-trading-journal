import { ImportParseError } from "../../domain/import/parser";
export function decodeUtf8(bytes: Uint8Array): string {
  if (bytes.some((value) => value === 0)) throw new ImportParseError("BINARY_INPUT", "The file contains binary data.");
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, ""); }
  catch { throw new ImportParseError("INVALID_ENCODING", "The report must use UTF-8 encoding."); }
}
