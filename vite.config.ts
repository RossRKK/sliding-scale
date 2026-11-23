import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
    publicDir: "public",
    build: {
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: true,
        minify: mode === "production",
        lib: {
            entry: "src/main.ts",
            formats: ["es"],
            fileName: () => "main.js",
        },
    },
}));
