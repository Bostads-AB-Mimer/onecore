"""Drives BankID logins through the local Keycloak cluster and the Mimer BankID stand-in, hop by hop.

Standard library only. Run with `python3 -I drive.py` after ./run.sh has set things up (run.sh calls it).
Exits non-zero when any case does not end where it should.
"""
import http.cookiejar, json, re, sys, urllib.parse, urllib.request

KC1, KC2, MOCK = "http://localhost:18081", "http://localhost:18082", "http://localhost:4010"
APP = "http://localhost:3000/"
XFF = "203.0.113.7"
KNOWN_PNR, UNKNOWN_PNR = "199001011234", "198001019999"
# messages_sv.properties in apps/keycloak-theme is not mounted here, so Keycloak shows the raw key
LOGIN_FAILED = "bankidLoginFailed"


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
        self.code = self.at_app and "code" in urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        self.status, body = (None, "") if page is None else page
        self.login_form = 'id="kc-form' in body or "kc-social" in body or "social-providers" in body
        self.failed_msg = LOGIN_FAILED in body
        title = re.search(r"<title>(.*?)</title>", body, re.S)
        self.title = title.group(1).strip() if title else None

    def __str__(self):
        if self.at_app:
            return f"back at app, code={'yes' if self.code else 'no'}"
        return f"Keycloak page {self.status} title={self.title!r} login form={self.login_form} {LOGIN_FAILED}={self.failed_msg}"


def logged_in(l):
    return l.code


def back_on_login(l):
    return not l.at_app and l.login_form and not l.failed_msg


def back_on_login_with_error(l):
    return not l.at_app and l.login_form and l.failed_msg


def not_logged_in(l):
    return not l.code


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
    return Landing(finish(op, tx, f"complete?pnr={UNKNOWN_PNR}")[1]), not_logged_in


def replay():
    # A completed transaction from browser A, pushed into browser B's own login.
    a = browser(); tx_a = start(a)
    get(a, f"{MOCK}/t/{tx_a}/complete?pnr={KNOWN_PNR}")
    b = browser(); tx_b = start(b)
    loc_b = get(b, f"{MOCK}/t/{tx_b}/cancel")[1]
    forged = re.sub(r"transaction_id=[0-9a-f-]+", f"transaction_id={tx_a}", loc_b).replace("success=false", "success=true")
    return Landing(follow(b, forged, [APP])), back_on_login_with_error


def same_callback_twice():
    op = browser(); tx = start(op)
    loc, first = finish(op, tx, f"complete?pnr={KNOWN_PNR}")
    assert Landing(first).code, f"first login failed: {Landing(first)}"
    return Landing(follow(op, loc, [APP])), not_logged_in


def forged_state():
    op = browser(); tx = start(op)
    loc = get(op, f"{MOCK}/t/{tx}/complete?pnr={KNOWN_PNR}")[1]
    return Landing(follow(op, re.sub(r"state=[^&]+", "state=garbage", loc), [APP])), not_logged_in


def bankid_down_at_start():
    urllib.request.urlopen(f"{MOCK}/debug/fail-create").read()
    op = browser()
    return Landing(follow(op, login_url(KC1), [APP, MOCK])), back_on_login_with_error


CASES = [("1 happy path", happy), ("2 callback on other node", cross_node), ("3 cancel", cancel),
         ("4 TransactionRiskBlocked", risk_blocked), ("5 unknown personnummer", unknown_user),
         ("6 replay other browser's tx", replay), ("7 same callback twice", same_callback_twice),
         ("8 forged state", forged_state), ("9 Mimer BankID down at start", bankid_down_at_start)]

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
    creates = [e for e in log if e["at"] == "create"]
    tokens = [e for e in log if e["at"] == "token"]
    ips = sorted({e["endUserIp"] for e in creates})
    secrets_ok = bool(tokens) and all(t["secretOk"] for t in tokens)
    print(f"{'PASS' if ips == [XFF] else 'FAIL'} endUserIp from X-Forwarded-For: {ips}")
    print(f"{'PASS' if secrets_ok else 'FAIL'} client secret read from vault ({len(tokens)} token calls, {len(creates)} creates)")
    failed += (ips != [XFF]) + (not secrets_ok)
    sys.exit(1 if failed else 0)
