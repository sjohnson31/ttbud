"use strict";
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserServerLauncherImpl = void 0;
const ws_1 = require("ws");
const browserDispatcher_1 = require("./dispatchers/browserDispatcher");
const clientHelper_1 = require("./client/clientHelper");
const utils_1 = require("./utils/utils");
const selectorsDispatcher_1 = require("./dispatchers/selectorsDispatcher");
const selectors_1 = require("./server/selectors");
const instrumentation_1 = require("./server/instrumentation");
const playwrightDispatcher_1 = require("./dispatchers/playwrightDispatcher");
const playwrightServer_1 = require("./remote/playwrightServer");
class BrowserServerLauncherImpl {
    constructor(playwright, browserType) {
        this._playwright = playwright;
        this._browserType = browserType;
    }
    async launchServer(options = {}) {
        // 1. Pre-launch the browser
        const browser = await this._browserType.launch(instrumentation_1.internalCallMetadata(), {
            ...options,
            ignoreDefaultArgs: Array.isArray(options.ignoreDefaultArgs) ? options.ignoreDefaultArgs : undefined,
            ignoreAllDefaultArgs: !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs),
            env: options.env ? clientHelper_1.envObjectToArray(options.env) : undefined,
        }, toProtocolLogger(options.logger));
        // 2. Start the server
        const delegate = {
            path: '/' + utils_1.createGuid(),
            allowMultipleClients: true,
            onClose: () => { },
            onConnect: this._onConnect.bind(this, browser),
        };
        const server = new playwrightServer_1.PlaywrightServer(delegate);
        const wsEndpoint = await server.listen(options.port);
        // 3. Return the BrowserServer interface
        const browserServer = new ws_1.EventEmitter();
        browserServer.process = () => browser.options.browserProcess.process;
        browserServer.wsEndpoint = () => wsEndpoint;
        browserServer.close = () => browser.options.browserProcess.close();
        browserServer.kill = () => browser.options.browserProcess.kill();
        browser.options.browserProcess.onclose = async (exitCode, signal) => {
            server.close();
            browserServer.emit('close', exitCode, signal);
        };
        return browserServer;
    }
    _onConnect(browser, scope) {
        const selectors = new selectors_1.Selectors();
        const selectorsDispatcher = new selectorsDispatcher_1.SelectorsDispatcher(scope, selectors);
        const browserDispatcher = new ConnectedBrowser(scope, browser, selectors);
        new playwrightDispatcher_1.PlaywrightDispatcher(scope, this._playwright, selectorsDispatcher, browserDispatcher);
        return () => {
            // Cleanup contexts upon disconnect.
            browserDispatcher.close().catch(e => { });
        };
    }
}
exports.BrowserServerLauncherImpl = BrowserServerLauncherImpl;
// This class implements multiplexing multiple BrowserDispatchers over a single Browser instance.
class ConnectedBrowser extends browserDispatcher_1.BrowserDispatcher {
    constructor(scope, browser, selectors) {
        super(scope, browser);
        this._contexts = [];
        this._closed = false;
        this._selectors = selectors;
    }
    async newContext(params, metadata) {
        if (params.recordVideo) {
            // TODO: we should create a separate temp directory or accept a launchServer parameter.
            params.recordVideo.dir = this._object.options.downloadsPath;
        }
        const result = await super.newContext(params, metadata);
        const dispatcher = result.context;
        dispatcher._object._setSelectors(this._selectors);
        this._contexts.push(dispatcher);
        return result;
    }
    async close() {
        // Only close our own contexts.
        await Promise.all(this._contexts.map(context => context.close({}, instrumentation_1.internalCallMetadata())));
        this._didClose();
    }
    _didClose() {
        if (!this._closed) {
            // We come here multiple times:
            // - from ConnectedBrowser.close();
            // - from underlying Browser.on('close').
            this._closed = true;
            super._didClose();
        }
    }
}
function toProtocolLogger(logger) {
    return logger ? (direction, message) => {
        if (logger.isEnabled('protocol', 'verbose'))
            logger.log('protocol', 'verbose', (direction === 'send' ? 'SEND ► ' : '◀ RECV ') + JSON.stringify(message), [], {});
    } : undefined;
}
//# sourceMappingURL=browserServerImpl.js.map