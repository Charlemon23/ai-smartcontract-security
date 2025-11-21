import fs from "fs";
import path from "path";
import solc from "solc";
export function readSolidityFiles(srcDir) {
  const files = [];
  const walk = d => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (p.endsWith(".sol")) files.push(p);
    }
  };
  walk(srcDir);
  return files;
}
export function compileToAST(files) {
  const input = {
    language: "Solidity",
    sources: Object.fromEntries(
      files.map(fp => [path.relative(process.cwd(), fp), { content: fs.readFileSync(fp, "utf8") }])
    ),
    settings: { outputSelection: { "*": { "*": ["*"], "": ["ast"] } } }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors && output.errors.some(e => e.severity === "error")) {
    throw new Error(output.errors.map(e => e.formattedMessage).join("\\n"));
  }
  return Object.entries(output.sources).map(([file, obj]) => ({ file, ast: obj.ast }));
}
