"""Drives BankID logins through the local Keycloak cluster and the Mimer BankID stand-in, hop by hop.

Standard library only. Run with `python3 -I drive.py` after ./run.sh has set things up (run.sh calls it).
Exits non-zero when any case does not end where it should.
"""
import http.cookiejar, json, os, re, subprocess, sys, time, urllib.parse, urllib.request

KC1, KC2, MOCK = "http://localhost:18081", "http://localhost:18082", "http://localhost:4010"
APP = "http://localhost:3000/"
XFF = "203.0.113.7"
KNOWN_PNR, UNKNOWN_PNR = "199001011234", "198001019999"
# messages_sv.properties in apps/keycloak-theme is not mounted here, so Keycloak shows the raw key
LOGIN_FAILED = "bankidLoginFailed"
HERE = os.path.dirname(os.path.abspath(__file__))
VAULT = os.path.join(HERE, "vault")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


class InsecureOk(http.cookiejar.DefaultCookiePolicy):
    """Keycloak marks its cookies Secure; a real browser would be on https. Send them over local http."""
    def return_ok_secure(self, cookie, request):
        return True

    def set_ok(self, cookie, request):
        return True


def browser():
    jar = http.cookiejar.CookieJar(policy=InsecureOk())
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar), NoRedirect())


def get(op, url):
    req = urllib.request.Request(url, headers={"X-Forwarded-For": XFF})
    try:
        r = op.open(req)
        return r.status, None, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Location"), e.read().decode(errors="replace")


def follow(op, url, stop, swap=None, limit=10):
    """Follow redirects until the URL starts with one of `stop`. `swap` rewrites a URL (cross-node test)."""
    for _ in range(limit):
        if swap:
            url = swap(url)
        if any(url.startswith(s) for s in stop):
            return url, None
        status, loc, body = get(op, url)
        if not loc:
            return url, (status, body)
        url = urllib.parse.urljoin(url, loc)
    raise RuntimeError("too many redirects")


def login_url(kc):
    q = urllib.parse.urlencode({"client_id": "mina-sidor", "redirect_uri": APP + "cb", "response_type": "code",
                                "scope": "openid", "state": "s1", "kc_idp_hint": "bankid"})
    return f"{kc}/realms/mimer-contacts/protocol/openid-connect/auth?{q}"


def start(op, kc=KC1):
    url, page = follow(op, login_url(kc), [MOCK])
    assert page is None, f"did not reach Mimer BankID: {page[0]} {page[1][:300]}"
    return re.search(r"/t/([0-9a-f-]+)/", url).group(1)


def finish(op, tx, action, swap=None):
    _, loc, _ = get(op, f"{MOCK}/t/{tx}/{action}")
    return loc, follow(op, loc, [APP], swap=swap)


class Landing:
    """Where a browser ended up: back at the app (with or without a code) or on a Keycloak page."""
    def __init__(self, result):
        url, page = result
        self.at_app = page is None
        self.query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query) if self.at_app else {}
        self.code = "code" in self.query
        self.status, body = (None, "") if page is None else page
        self.body = body
        self.login_form = 'id="kc-form' in body or "kc-social" in body or "social-providers" in body
        self.failed_msg = LOGIN_FAILED in body
        title = re.search(r"<title>(.*?)</title>", body, re.S)
        self.title = title.group(1).strip() if title else None

    def __str__(self):
        if self.at_app:
            return f"back at app, code={'yes' if self.code else 'no'} error={self.query.get('error', [None])[0]}"
        return f"Keycloak page {self.status} title={self.title!r} login form={self.login_form} {LOGIN_FAILED}={self.failed_msg}"


def logged_in(l):
    return l.code


def back_on_login(l):
    return not l.at_app and l.login_form and not l.failed_msg


def back_on_login_with_error(l):
    return not l.at_app and l.login_form and l.failed_msg


def error_page(status, text):
    """A Keycloak error page with this status and text, not the login form."""
    def check(l):
        return not l.at_app and l.status == status and text in l.body and not l.login_form
    check.__name__ = f"error_page({status}, {text!r})"
    return check


def back_at_app_with_error(error):
    """Redirected back to the app without a code, with this OAuth error."""
    def check(l):
        return l.at_app and not l.code and l.query.get("error") == [error]
    check.__name__ = f"back_at_app_with_error({error!r})"
    return check


def happy():
    op = browser(); tx = start(op)
    loc, res = finish(op, tx, f"complete?pnr={KNOWN_PNR}")
    assert "state=" in loc and "transaction_id=" in loc, f"return URL lost state: {loc}"
    return Landing(res), logged_in


def cross_node():
    op = browser(); tx = start(op, KC1)
    _, res = finish(op, tx, f"complete?pnr={KNOWN_PNR}", swap=lambda u: u.replace(KC1, KC2))
    return Landing(res), logged_in


def cancel():
    op = browser(); tx = start(op)
    return Landing(finish(op, tx, "cancel")[1]), back_on_login


def risk_blocked():
    op = browser(); tx = start(op)
    return Landing(finish(op, tx, "risk")[1]), back_on_login_with_error


def unknown_user():
    # The first-login flow only links existing users, so an unknown personnummer must not log in.
    op = browser(); tx = start(op)
    return Landing(finish(op, tx, f"complete?pnr={UNKNOWN_PNR}")[1]), error_page(401, "does not exist")


def replay():
    # A completed transaction from browser A, pushed into browser B's own login.
    a = browser(); tx_a = start(a)
    get(a, f"{MOCK}/t/{tx_a}/complete?pnr={KNOWN_PNR}")
    b = browser(); tx_b = start(b)
    loc_b = get(b, f"{MOCK}/t/{tx_b}/cancel")[1]
    forged = re.sub(r"transaction_id=[0-9a-f-]+", f"transaction_id={tx_a}", loc_b).replace("success=false", "success=true")
    return Landing(follow(b, forged, [APP])), back_on_login_with_error


def reload_after_login():
    # Back button or a second redirect after a finished login. Keycloak has already removed the login
    # session, so it answers itself and the plugin is not reached (its one-use transaction note is
    # covered by the unit tests). It must be a redirect back to the app, not a raw error.
    op = browser(); tx = start(op)
    loc, first = finish(op, tx, f"complete?pnr={KNOWN_PNR}")
    assert Landing(first).code, f"first login failed: {Landing(first)}"
    return Landing(follow(op, loc, [APP])), back_at_app_with_error("temporarily_unavailable")


def forged_state():
    op = browser(); tx = start(op)
    loc = get(op, f"{MOCK}/t/{tx}/complete?pnr={KNOWN_PNR}")[1]
    return Landing(follow(op, re.sub(r"state=[^&]+", "state=garbage", loc), [APP])), error_page(400, "Invalid Request")


def missing_state():
    op = browser(); tx = start(op)
    loc = get(op, f"{MOCK}/t/{tx}/complete?pnr={KNOWN_PNR}")[1]
    return (Landing(follow(op, re.sub(r"state=[^&]+&?", "", loc), [APP])),
            error_page(502, "Missing state parameter"))


def malformed_state():
    # Not base64url: Keycloak throws a plain RuntimeException, which used to end in a raw 500
    op = browser(); tx = start(op)
    loc = get(op, f"{MOCK}/t/{tx}/complete?pnr={KNOWN_PNR}")[1]
    return (Landing(follow(op, re.sub(r"state=[^&]+", "state=a.b.c", loc), [APP])),
            error_page(502, "Unexpected error when authenticating"))


def vault_entry_missing():
    # The APIM key's vault file is gone: the login must fail before anything is sent to Mimer BankID,
    # instead of sending the unresolved ${vault.…} text as the key.
    name = "mimer-contacts_bankid-apim-key"
    key = os.path.join(VAULT, name)
    os.rename(key, key + ".away")
    try:
        container_sees(name, False)
        before = len(creates())
        landing = Landing(follow(browser(), login_url(KC1), [APP, MOCK]))
        assert len(creates()) == before, "a transaction was created without the APIM key"
    finally:
        os.rename(key + ".away", key)
        container_sees(name, True)
    return landing, back_on_login_with_error


def container_sees(name, present):
    """Docker Desktop's bind mount shows a host-side rename a moment later; wait for node 1 to see it."""
    for _ in range(40):
        r = subprocess.run(["docker", "compose", "exec", "-T", "keycloak", "test", "-e",
                            f"/opt/bitnami/keycloak/vault/{name}"], cwd=HERE, capture_output=True)
        if (r.returncode == 0) == present:
            return
        time.sleep(0.5)
    raise RuntimeError(f"Keycloak still {'misses' if present else 'sees'} vault/{name}")


def creates():
    return [e for e in json.load(urllib.request.urlopen(f"{MOCK}/debug/log")) if e["at"] == "create"]


def bankid_down_at_start():
    urllib.request.urlopen(f"{MOCK}/debug/fail-create").read()
    op = browser()
    return Landing(follow(op, login_url(KC1), [APP, MOCK])), back_on_login_with_error


CASES = [("1 happy path", happy), ("2 callback on other node", cross_node), ("3 cancel", cancel),
         ("4 TransactionRiskBlocked", risk_blocked), ("5 unknown personnummer", unknown_user),
         ("6 replay other browser's tx", replay), ("7 return URL reloaded after login", reload_after_login),
         ("8 forged state", forged_state), ("9 Mimer BankID down at start", bankid_down_at_start),
         ("10 return without state", missing_state), ("11 malformed state", malformed_state),
         ("12 vault entry missing", vault_entry_missing)]

if __name__ == "__main__":
    failed = 0
    for name, fn in CASES:
        try:
            landing, expected = fn()
            ok = expected(landing)
            print(f"{'PASS' if ok else 'FAIL'} {name}: {landing}  (expected {expected.__name__})")
        except Exception as e:
            ok = False
            print(f"FAIL {name}: {e!r}")
        failed += not ok

    log = json.load(urllib.request.urlopen(f"{MOCK}/debug/log"))
    created = [e for e in log if e["at"] == "create"]
    tokens = [e for e in log if e["at"] == "token"]
    ips = sorted({e["endUserIp"] for e in created})
    secrets_ok = bool(tokens) and all(t["secretOk"] for t in tokens)
    print(f"{'PASS' if ips == [XFF] else 'FAIL'} endUserIp from X-Forwarded-For: {ips}")
    print(f"{'PASS' if secrets_ok else 'FAIL'} client secret read from vault ({len(tokens)} token calls, {len(created)} creates)")
    failed += (ips != [XFF]) + (not secrets_ok)
    sys.exit(1 if failed else 0)
