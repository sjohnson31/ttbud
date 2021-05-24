"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PACKAGE_NAME = exports.DEBUG_TIMEOUT = exports.DEFAULT_TEST_PLAYWRIGHT_TIMEOUT = exports.DEFAULT_CONFIG = exports.SERVER = exports.PERSISTENT = exports.LAUNCH = exports.WEBKIT = exports.FIREFOX = exports.CHROMIUM = exports.CONFIG_ENVIRONMENT_NAME = exports.IMPORT_KIND_PLAYWRIGHT = void 0;
exports.IMPORT_KIND_PLAYWRIGHT = 'playwright';
exports.CONFIG_ENVIRONMENT_NAME = 'jest-playwright';
exports.CHROMIUM = 'chromium';
exports.FIREFOX = 'firefox';
exports.WEBKIT = 'webkit';
exports.LAUNCH = 'LAUNCH';
exports.PERSISTENT = 'PERSISTENT';
exports.SERVER = 'SERVER';
exports.DEFAULT_CONFIG = {
    launchType: exports.SERVER,
    launchOptions: {},
    connectOptions: {},
    contextOptions: {},
    browsers: [exports.CHROMIUM],
    exitOnPageError: true,
    collectCoverage: false,
};
exports.DEFAULT_TEST_PLAYWRIGHT_TIMEOUT = 15000;
// Set timeout to 4 days
exports.DEBUG_TIMEOUT = 4 * 24 * 60 * 60 * 1000;
exports.PACKAGE_NAME = 'jest-playwright-preset';
