import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);

const compilerOptions = {
  esModuleInterop: true,
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  target: ts.ScriptTarget.ES2020,
};

function register(extension) {
  require.extensions[extension] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');

    const output = ts.transpileModule(source, {
      compilerOptions,
      fileName: filename,
    });

    module._compile(output.outputText, filename);
  };
}

register('.ts');

register('.tsx');
