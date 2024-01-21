import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';
import { externalizeDeps as dependencies } from 'vite-plugin-externalize-deps';

export default defineConfig({
    plugins: [dts({ rollupTypes: false }), dependencies({})],
    build: {
        lib: {
            entry: {
                index: 'src/index.ts',
                raw: 'src/raw/index.ts',
            },
            fileName: (format, entryName) => {
                const extension = format === 'cjs' ? 'cjs' : 'mjs';
                return `${entryName}.${extension}`;
            },
            formats: ['es', 'cjs'],
        },
    },
});
