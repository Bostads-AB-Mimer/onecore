package nu.mimer.keycloak.bankid;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.keycloak.broker.provider.util.SimpleHttp;

/** What every outgoing call shares: timeouts, and turning a response into JSON or a loggable error. */
final class Http {

    private static final int TIMEOUT_MS = 5000;
    private static final Pattern AADSTS = Pattern.compile("AADSTS\\d+");

    private Http() {
    }

    static SimpleHttp withTimeouts(SimpleHttp http) {
        return http.connectTimeoutMillis(TIMEOUT_MS).socketTimeOutMillis(TIMEOUT_MS);
    }

    /**
     * The body of a 2xx response. Anything else is an error carrying the status and the error codes
     * (e.g. Entra's "invalid_client" / AADSTS7000215), never the request or the full error text.
     * The caller closes the response.
     */
    static JsonNode json(SimpleHttp.Response res, String what) throws IOException {
        int status = res.getStatus();
        if (status < 200 || status >= 300) {
            String detail = errorCodes(res);
            throw new IOException(what + ": HTTP " + status + (detail.isEmpty() ? "" : " " + detail));
        }
        return res.asJson();
    }

    private static String errorCodes(SimpleHttp.Response res) {
        try {
            JsonNode err = res.asJson();
            String code = err.path("error").asText("");
            Matcher aad = AADSTS.matcher(err.path("error_description").asText(""));
            return (code + " " + (aad.find() ? aad.group() : "")).trim();
        } catch (Exception notJson) {
            return "";
        }
    }
}
