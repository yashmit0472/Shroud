// Literal dotenv values: no interpolation and no shell execution.
export function parseEnvFile(content: string): { key: string; value: string }[] {
  const values = new Map<string, string>();
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) throw new Error(`Invalid environment variable on line ${index + 1}`);
    const [, key, initial] = match;
    let value = initial;
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0];
      let end = -1;
      let offset = 1;
      for (;;) {
        for (; offset < value.length; offset++) {
          if (value[offset] === quote) { end = offset; break; }
          if (quote === '"' && value[offset] === "\\") offset++;
        }
        if (end >= 0) break;
        if (++index >= lines.length) throw new Error(`Unclosed quoted value for ${key}`);
        value += "\n" + lines[index];
      }
      if (!/^\s*(?:#.*)?$/.test(value.slice(end + 1))) throw new Error(`Unexpected text after ${key}`);
      value = value.slice(1, end);
      if (quote === '"') value = value.replace(/\\([nrt"\\])/g, (_, escaped: string) => ({ n: "\n", r: "\r", t: "\t", '"': '"', "\\": "\\" })[escaped] ?? escaped);
    } else value = value.replace(/\s+#.*$/, "").trimEnd();
    if (value.includes("\0")) throw new Error(`NUL bytes are not supported for ${key}`);
    values.set(key, value);
  }
  return [...values].map(([key, value]) => ({ key, value }));
}

export function serializeEnvFile(values: { key: string; value: string }[]): string {
  return values.map(({ key, value }) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error("Server returned an invalid environment variable name");
    if (value.includes("\0")) throw new Error(`NUL bytes are not supported for ${key}`);
    return `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
  }).join("\n") + "\n";
}
