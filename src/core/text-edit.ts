export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchError";
  }
}

export function insertAfterOnce(
  source: string,
  anchor: string,
  insertion: string,
  marker: string,
  file: string,
): string {
  if (source.includes(marker)) return source;
  const first = source.indexOf(anchor);
  if (first < 0) throw new PatchError(`${file}: missing anchor ${JSON.stringify(anchor)}`);
  if (source.indexOf(anchor, first + anchor.length) >= 0) {
    throw new PatchError(`${file}: ambiguous anchor ${JSON.stringify(anchor)}`);
  }
  return source.slice(0, first + anchor.length) + insertion + source.slice(first + anchor.length);
}

export function insertBeforeOnce(
  source: string,
  anchor: string,
  insertion: string,
  marker: string,
  file: string,
): string {
  if (source.includes(marker)) return source;
  const first = source.indexOf(anchor);
  if (first < 0) throw new PatchError(`${file}: missing anchor ${JSON.stringify(anchor)}`);
  if (source.indexOf(anchor, first + anchor.length) >= 0) {
    throw new PatchError(`${file}: ambiguous anchor ${JSON.stringify(anchor)}`);
  }
  return source.slice(0, first) + insertion + source.slice(first);
}

export function replaceOnce(
  source: string,
  anchor: string,
  replacement: string,
  marker: string,
  file: string,
): string {
  if (source.includes(marker)) return source;
  const first = source.indexOf(anchor);
  if (first < 0) throw new PatchError(`${file}: missing anchor ${JSON.stringify(anchor)}`);
  if (source.indexOf(anchor, first + anchor.length) >= 0) {
    throw new PatchError(`${file}: ambiguous anchor ${JSON.stringify(anchor)}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + anchor.length);
}
