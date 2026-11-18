// Stand-in for Entra + Mimer BankID (bankid-api + the eid.mimer.nu hosted page), copying the rules
// read in bankid-api: create validation, statuses as strings, camelCase JSON, redirect composition
// that keeps existing query params and sets transaction_id + success, and the owner check.
import http from 'node:http';
import net from 'node:net';
import { randomUUID } from 'node:crypto';

const PORT = 4010;
const EXPECTED_SECRET = 'secret-from-vault';
const EXPECTED_APIM = 'apim-from-vault';
const CLIENT = 'mimer-minasidor-test';
const tokens = new Set();
const txs = new Map();
const log = [];
// Set by /debug/fail-create: the next create answers 503, as when Mimer BankID is down.
let failNextCreate = false;

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });

const authorized = (req) =>
  tokens.has((req.headers.authorization || '').replace(/^Bearer /, '')) &&
  req.headers['ocp-apim-subscription-key'] === EXPECTED_APIM;

// TransactionResponse.ComposeRedirectUri: ParseQueryString keeps existing params.
const composeRedirect = (redirectUrl, id, status) => {
  const u = new URL(redirectUrl);
  u.searchParams.set('transaction_id', id);
  u.searchParams.set('success', String(status === 'Complete'));
  return u.toString();
};

const view = (t) => ({
  id: t.id, method: t.method, status: t.status, redirectUrl: t.redirectUrl,
  createdAtUtc: t.createdAtUtc, startedAtUtc: null,
  processingInfo: {
    autoStartToken: null, qrData: null, collectStatus: t.collectStatus, hintCode: t.hintCode,
    // completion data only for Complete, as in BankIdTransactionManager
    completionData: t.status === 'Complete'
      ? { user: { personalNumber: t.pnr, name: 'Test Testsson', givenName: 'Test', surname: 'Testsson' }, device: { ipAddress: t.endUserIp } }
      : null,
  },
  transactionParameters: { auth: { endUserIp: t.endUserIp } },
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (req.method === 'POST' && p === '/oauth2/v2.0/token') {
    const form = new URLSearchParams(await readBody(req));
    log.push({ at: 'token', clientId: form.get('client_id'), secretOk: form.get('client_secret') === EXPECTED_SECRET, scope: form.get('scope') });
    if (form.get('grant_type') !== 'client_credentials' || form.get('client_secret') !== EXPECTED_SECRET) return send(res, 401, { error: 'invalid_client' });
    const t = randomUUID(); tokens.add(t);
    return send(res, 200, { token_type: 'Bearer', expires_in: 3599, access_token: t });
  }

  if (req.method === 'POST' && p === '/api/transactions') {
    if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });
    const body = JSON.parse(await readBody(req) || '{}');
    const ip = body?.transactionParameters?.auth?.endUserIp ?? '';
    log.push({ at: 'create', method: body.method, endUserIp: ip, redirectUrl: body.redirectUrl });
    if (failNextCreate) { failNextCreate = false; return send(res, 503, 'Service Unavailable', { 'content-type': 'text/plain' }); }
    if (body.method !== 'Auth' || !body.redirectUrl || ip.length < 7 || ip.length > 50 || !net.isIP(ip)) return send(res, 400, { error: 'validation' });
    const id = randomUUID();
    txs.set(id, { id, owner: CLIENT, method: 'Auth', status: 'New', redirectUrl: body.redirectUrl, endUserIp: ip, createdAtUtc: new Date().toISOString(), collectStatus: null, hintCode: null });
    return send(res, 200, { id, accessUrl: `http://localhost:${PORT}/t/${id}/12345678` });
  }

  let m;
  if (req.method === 'GET' && (m = p.match(/^\/api\/transactions\/([0-9a-f-]+)$/))) {
    if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });
    const t = txs.get(m[1]);
    log.push({ at: 'get', id: m[1], status: t?.status });
    if (!t || t.owner !== CLIENT) return send(res, 404, { error: 'not found' });
    return send(res, 200, view(t));
  }

  // Hosted page and the three ways a BankID order can end.
  if ((m = p.match(/^\/t\/([0-9a-f-]+)\/(\d{8}|complete|cancel|risk)$/))) {
    const t = txs.get(m[1]);
    if (!t) return send(res, 404, 'no such transaction', { 'content-type': 'text/plain' });
    if (/^\d{8}$/.test(m[2])) {
      t.status = 'Pending'; t.collectStatus = 'Pending'; t.hintCode = 'OutstandingTransaction';
      return send(res, 200, `<h1>Mock Mimer BankID</h1><a href="/t/${t.id}/complete?pnr=199001011234">complete</a>`, { 'content-type': 'text/html' });
    }
    if (m[2] === 'complete') { t.status = 'Complete'; t.collectStatus = 'Complete'; t.hintCode = null; t.pnr = url.searchParams.get('pnr'); }
    if (m[2] === 'cancel') { t.status = 'Cancelled'; t.hintCode = 'UserCancel'; }
    if (m[2] === 'risk') { t.status = 'Failed'; t.hintCode = 'TransactionRiskBlocked'; t.collectStatus = 'Complete'; }
    res.writeHead(302, { location: composeRedirect(t.redirectUrl, t.id, t.status) });
    return res.end();
  }

  if (p === '/debug/log') return send(res, 200, log);
  if (p === '/debug/fail-create') { failNextCreate = true; return send(res, 200, { failNextCreate }); }
  send(res, 404, { error: 'no route' });
}).listen(PORT, () => console.log(`mock on :${PORT}`));
