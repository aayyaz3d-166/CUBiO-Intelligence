/**
 * Sovereign Web Gateway Daemon
 * Module: ONE Language Network ("one-net" / "one-gateway")
 * Gate: CNL-P36-001 (One Intelligence Product Suite)
 *
 * Lightweight HTTP gateway translating standard browser requests
 * to sovereign .one, .cubio, and .sovereign decentralized storage shards.
 */
import * as http from 'http';
export class SovereignWebGateway {
    dnsEngine;
    storageMatrix;
    server = null;
    port = 3690;
    is_actuation_blocked = true; // Permanent fail-closed invariant
    constructor(dnsEngine, storageMatrix, port = 3690) {
        this.dnsEngine = dnsEngine;
        this.storageMatrix = storageMatrix;
        this.port = port;
    }
    /**
     * Dispatches an HTTP request through DNS resolution and storage reassembly.
     */
    handleRequest(hostHeader, urlPath = '/') {
        const t0 = performance.now();
        // 1. Extract target sovereign domain
        let domain = hostHeader.toLowerCase().trim().replace(/:\d+$/, '');
        // Support query parameter fallback (e.g. localhost:3690/?domain=portal.one)
        if (domain === 'localhost' || domain === '127.0.0.1') {
            const match = urlPath.match(/[?&]domain=([^&]+)/);
            if (match) {
                domain = decodeURIComponent(match[1]);
            }
            else {
                domain = 'portal.one'; // Default home portal
            }
        }
        try {
            // 2. Sovereign DNS Resolution
            const resolution = this.dnsEngine.resolveDomain(domain);
            // 3. Decentralized Storage Matrix Retrieval
            const asset = this.storageMatrix.fetchAsset(resolution.contentRootHash);
            const t1 = performance.now();
            const latencyMs = Number((t1 - t0).toFixed(4));
            return {
                statusCode: 200,
                contentType: asset.contentType,
                body: asset.content,
                headers: {
                    'Content-Type': asset.contentType,
                    'X-Sovereign-Network': 'ONE-NET-V36',
                    'X-Sovereign-Domain': domain,
                    'X-Canonical-Address': resolution.canonicalAddress.toString(),
                    'X-Display-Index': resolution.displayIndex.toString(),
                    'X-PQC-Record-Seal': resolution.pqcSeal,
                    'X-Actuation-Blocked': 'true',
                    'X-Epistemic-Truth-UUP': '1.0',
                },
                resolution,
                latencyMs,
            };
        }
        catch (err) {
            const t1 = performance.now();
            const errMsg = err instanceof Error ? err.message : 'Unknown Gateway Error';
            return {
                statusCode: 404,
                contentType: 'text/html; charset=utf-8',
                body: `<html><body style="font-family:monospace;background:#030308;color:#ff0055;padding:40px;">
          <h2>⚠️ 404 Sovereign Gateway Resolution Error</h2>
          <p>Domain: <b>${domain}</b></p>
          <p>Detail: ${errMsg}</p>
          <hr style="border-color:#ff005533;"/>
          <p style="color:#888;">CubiO Sovereign Network | Gateway Port ${this.port}</p>
        </body></html>`,
                headers: {
                    'Content-Type': 'text/html; charset=utf-8',
                    'X-Sovereign-Network': 'ONE-NET-V36',
                    'X-Actuation-Blocked': 'true',
                },
                resolution: null,
                latencyMs: Number((t1 - t0).toFixed(4)),
            };
        }
    }
    /**
     * Starts the live native HTTP gateway server.
     */
    startServer() {
        return new Promise((resolve) => {
            this.server = http.createServer((req, res) => {
                const host = req.headers['host'] || 'localhost';
                const url = req.url || '/';
                const gatewayRes = this.handleRequest(host, url);
                res.writeHead(gatewayRes.statusCode, gatewayRes.headers);
                res.end(gatewayRes.body);
            });
            this.server.listen(this.port, () => {
                resolve(this.port);
            });
        });
    }
    /**
     * Gracefully shuts down the gateway server.
     */
    stopServer() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
            }
            else {
                resolve();
            }
        });
    }
    getPort() {
        return this.port;
    }
}
