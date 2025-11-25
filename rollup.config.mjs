// rollup.config.mjs
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const tsPlugin = typescript({
  // Use the main tsconfig; tsc-build handles .d.ts, Rollup handles JS bundling
  tsconfig: './tsconfig.json',
  compilerOptions: {
    // We only want JS from Rollup; declaration files come from `tsc -p tsconfig.build.json`
    declaration: false,
    emitDeclarationOnly: false,
    // Let Rollup control the output location
    outDir: undefined
  }
});

const basePlugins = [
  resolve({ extensions: ['.mjs', '.js', '.ts'] }),
  commonjs(),
  tsPlugin
];

export default [
  // Main library bundle (entry: src/index.ts)
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'esm',
        sourcemap: true
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true
      }
    ],
    plugins: basePlugins
  },

  // WASM loader entry (entry: wasm/index.ts)
  {
    input: 'wasm/index.ts',
    output: {
      file: 'dist/wasm/index.js',
      format: 'esm',
      sourcemap: true
    },
    plugins: basePlugins
  }
];
