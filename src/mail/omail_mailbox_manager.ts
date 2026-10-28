/**
 * Sovereign Mailbox Manager
 * Module: ONE Language Mail ("one-omail" / "one-mailbox")
 * Gate: CNL-P37-001 (One Intelligence Product Suite — OMail)
 *
 * Manages peer-to-peer user mailboxes anchored directly to
 * Canonical Address369 spatial cells [26..368] via CubiODNSEngine.
 */

import { SovereignMailEnvelope } from './pqc_mail_envelope';
import { CubiODNSEngine } from '../net/cubio_dns_engine';
import { CanonicalAddress369 } from '../one/address369_canonical';

export interface MailboxStore {
  identity: string;            // e.g. alice@portal.one
  domain: string;              // portal.one
  canonicalAddress: number;    // 26..368
  displayIndex: number;        // 27..369
  spatialCoord: { i: number; j: number; k: number };
  inbox: SovereignMailEnvelope[];
  outbox: SovereignMailEnvelope[];
  totalMessagesCount: number;
  storedBytes: number;
  lastActiveAt: number;
}

export class OMailMailboxManager {
  private mailboxes: Map<string, MailboxStore> = new Map();
  private dnsEngine: CubiODNSEngine;
  private readonly MAX_MAILBOX_BYTES = 32 * 1024 * 1024; // 32 MB per mailbox ceiling

  constructor(dnsEngine: CubiODNSEngine) {
    this.dnsEngine = dnsEngine;
  }

  /**
   * Registers a new sovereign mailbox by resolving its domain through CubiODNS.
   */
  public registerMailbox(identity: string): MailboxStore {
    const lowerId = identity.toLowerCase().trim();
    if (!lowerId.includes('@')) {
      throw new Error(`[Mailbox Error] Invalid sovereign identity format: ${identity}. Must contain '@'.`);
    }

    const domain = lowerId.split('@')[1];
    const dnsRes = this.dnsEngine.resolveDomain(domain);

    const mailbox: MailboxStore = {
      identity: lowerId,
      domain,
      canonicalAddress: dnsRes.canonicalAddress,
      displayIndex: dnsRes.displayIndex,
      spatialCoord: dnsRes.spatialCoord,
      inbox: [],
      outbox: [],
      totalMessagesCount: 0,
      storedBytes: 0,
      lastActiveAt: Date.now(),
    };

    this.mailboxes.set(lowerId, mailbox);
    return mailbox;
  }

  /**
   * Delivers an encrypted PQC envelope into the recipient's inbox.
   */
  public deliverEnvelope(envelope: SovereignMailEnvelope): { delivered: boolean; latencyMs: number } {
    const t0 = performance.now();
    const recipient = envelope.recipient.toLowerCase().trim();

    let mailbox = this.mailboxes.get(recipient);
    if (!mailbox) {
      // Auto-provision mailbox if domain is validly registered in CubiODNS
      mailbox = this.registerMailbox(recipient);
    }

    const envelopeBytes = Buffer.from(JSON.stringify(envelope)).length;
    if (mailbox.storedBytes + envelopeBytes > this.MAX_MAILBOX_BYTES) {
      throw new Error(`[Mailbox Quota Exceeded] Mailbox ${recipient} has reached storage ceiling.`);
    }

    mailbox.inbox.push(envelope);
    mailbox.totalMessagesCount++;
    mailbox.storedBytes += envelopeBytes;
    mailbox.lastActiveAt = Date.now();

    const t1 = performance.now();
    return {
      delivered: true,
      latencyMs: Number((t1 - t0).toFixed(4)),
    };
  }

  /**
   * Retrieves messages from a mailbox inbox.
   */
  public fetchInbox(identity: string): SovereignMailEnvelope[] {
    const mailbox = this.mailboxes.get(identity.toLowerCase().trim());
    if (!mailbox) {
      throw new Error(`[Mailbox Error] Mailbox '${identity}' not found.`);
    }
    return [...mailbox.inbox];
  }

  public getMailbox(identity: string): MailboxStore | undefined {
    return this.mailboxes.get(identity.toLowerCase().trim());
  }

  public getTotalMailboxes(): number {
    return this.mailboxes.size;
  }

  public listMailboxIdentities(): string[] {
    return Array.from(this.mailboxes.keys());
  }
}
