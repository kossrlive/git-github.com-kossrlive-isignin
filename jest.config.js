export default {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            useESM: true,
        }],
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
        '!src/index.ts',
    ],
    setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
    testTimeout: 10000,
};
