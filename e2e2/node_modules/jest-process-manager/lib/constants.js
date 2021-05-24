"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.ERROR_NO_COMMAND = exports.ERROR_PORT_USED = exports.ERROR_TIMEOUT = void 0;
exports.ERROR_TIMEOUT = 'ERROR_TIMEOUT';
exports.ERROR_PORT_USED = 'ERROR_PORT_USED';
exports.ERROR_NO_COMMAND = 'ERROR_NO_COMMAND';
exports.DEFAULT_CONFIG = {
    command: 'npm run start',
    debug: false,
    options: {},
    launchTimeout: 5000,
    host: 'localhost',
    port: 3000,
    protocol: 'tcp',
    usedPortAction: 'ask',
    waitOnScheme: {},
};
