import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "dist/**/*",
      "src-tauri/**/*",
      "node_modules/**/*",
      "dist-portable/**/*",
      "scripts/**/*"
    ]
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-console": "off"
    }
  }
];
