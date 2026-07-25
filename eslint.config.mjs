import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import functional from 'eslint-plugin-functional';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['build/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  comments.recommended,
  prettier,
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended, importPlugin.flatConfigs.typescript, functional.configs.lite],
    languageOptions: {
      parserOptions: {
        // The "everything" project: sources, specs, example, benchmark and playground.
        project: ['./tsconfig.spec.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-implied-eval': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'functional/no-mixed-types': 'off',
      'functional/no-classes': 'off',
      'functional/prefer-immutable-types': 'off',
      'functional/no-return-void': 'off',
      'functional/no-throw-statements': 'off',
      'functional/no-loop-statements': 'off',
      'functional/no-let': 'off',
      'functional/prefer-readonly-type': 'off',
      'functional/immutable-data': 'off',
      'functional/functional-parameters': 'off',
      'functional/no-expression-statements': 'off',
      'functional/no-conditional-statements': 'off',
      'no-new-func': 'off',
      'import/order': [
        'error',
        {
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
      'sort-imports': ['error', { ignoreDeclarationSort: true, ignoreCase: true }],
    },
  },
  {
    // The playground is a scratchpad driven by `npm run dev --inspect`.
    files: ['playground/**/*.ts'],
    rules: { 'no-debugger': 'off' },
  },
);
