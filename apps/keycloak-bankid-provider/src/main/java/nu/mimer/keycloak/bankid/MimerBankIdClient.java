package nu.mimer.keycloak.bankid;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.keycloak.broker.provider.util.SimpleHttp;
import org.keycloak.models.KeycloakSession;
import org.keycloak.vault.VaultStringSecret;

/**
 * HTTP calls to Entra (client credentials) and Mimer BankID's transaction API.
 *
 * <p>One Entra access token is cached per node and per token URL, client id and scope, until a
 * minute before it expires. A 401 from Mimer BankID drops it, so a revoked token heals on the
 * next login instead of failing until it would have expired.
 */
public class MimerBankIdClient {

    public record Created(String id, String accessUrl) {
    }

    record CachedToken(String value, long expiresAtMillis) {
    }

    static final Map<String, CachedToken> TOKENS = new ConcurrentHashMap<>();
    private static final int TIMEOUT_MS = 5000;
    private static final Pattern AADSTS = Pattern.compile("AADSTS\\d+");

    private final KeycloakSession session;
    private final MimerBankIdConfig config;

    public MimerBankIdClient(KeycloakSession session, MimerBankIdConfig config) {
        this.session = session;
        this.config = config;
    }

    public Created createAuth(String endUserIp, String redirectUrl) throws IOException {
        if (endUserIp == null) {
            throw new IOException("create transaction: no remote address for endUserIp");
        }
        Map<String, Object> body = Map.of(
                "method", "Auth",
                "transactionParameters", Map.of("auth", Map.of("endUserIp", endUserIp, "requirement", Map.of())),
                "redirectUrl", redirectUrl);
        SimpleHttp.Response res = withTimeouts(SimpleHttp.doPost(required("gatewayUrl", config.getGatewayUrl()) + "transactions", session))
                .auth(token())
                .header("Ocp-Apim-Subscription-Key", secret("apimKey", config.getApimKey()))
                .json(body)
                .asResponse();
        JsonNode json = okJson(res, "create transaction", true);
        String id = json.path("id").asText(null);
        String accessUrl = json.path("accessUrl").asText(null);
        if (id == null || accessUrl == null) {
            throw new IOException("create transaction: response without id or accessUrl");
        }
        return new Created(id, accessUrl);
    }

    public JsonNode get(String transactionId) throws IOException {
        SimpleHttp.Response res = withTimeouts(SimpleHttp.doGet(required("gatewayUrl", config.getGatewayUrl()) + "transactions/" + transactionId, session))
                .auth(token())
                .header("Ocp-Apim-Subscription-Key", secret("apimKey", config.getApimKey()))
                .asResponse();
        return okJson(res, "get transaction", true);
    }

    String tokenKey() {
        return config.getTokenUrl() + "|" + config.getClientId() + "|" + config.getScope();
    }

    String token() throws IOException {
        CachedToken cached = TOKENS.get(tokenKey());
        if (cached != null && cached.expiresAtMillis() > System.currentTimeMillis() + 60_000) {
            return cached.value();
        }
        SimpleHttp.Response res = withTimeouts(SimpleHttp.doPost(required("tokenUrl", config.getTokenUrl()), session))
                .param("grant_type", "client_credentials")
                .param("client_id", required("clientId", config.getClientId()))
                .param("client_secret", secret("clientSecret", config.getClientSecret()))
                .param("scope", required("scope", config.getScope()))
                .asResponse();
        JsonNode json = okJson(res, "token", false);
        String value = json.path("access_token").asText(null);
        if (value == null) {
            throw new IOException("token: response without access_token");
        }
        long expiresIn = json.path("expires_in").asLong(300);
        TOKENS.put(tokenKey(), new CachedToken(value, System.currentTimeMillis() + expiresIn * 1000));
        return value;
    }

    /**
     * Resolves a {@code ${vault.<key>}} setting through the realm's vault. Anything else, or a key
     * the vault does not have, is an error naming the setting: sending the unresolved text on would
     * come back from Entra as a wrong secret instead.
     */
    String secret(String name, String value) throws IOException {
        Matcher ref = MimerBankIdConfig.VAULT_REFERENCE.matcher(required(name, value));
        if (!ref.matches()) {
            throw new IOException(name + " must be a ${vault.<key>} reference");
        }
        try (VaultStringSecret s = session.vault().getStringSecret(value)) {
            return s.get().orElseThrow(() -> new IOException(
                    name + ": vault key " + ref.group(1) + " not found (is the vault configured and the entry there?)"));
        }
    }

    private static String required(String name, String value) throws IOException {
        if (value == null || value.isBlank()) {
            throw new IOException(name + " is not set");
        }
        return value;
    }

    private static SimpleHttp withTimeouts(SimpleHttp http) {
        return http.connectTimeoutMillis(TIMEOUT_MS).socketTimeOutMillis(TIMEOUT_MS);
    }

    JsonNode okJson(SimpleHttp.Response res, String what, boolean usesToken) throws IOException {
        try {
            int status = res.getStatus();
            if (status == 401 && usesToken) {
                TOKENS.remove(tokenKey());
            }
            if (status < 200 || status >= 300) {
                // Error codes only (e.g. Entra's "invalid_client" / AADSTS7000215), never the request.
                String detail = "";
                try {
                    JsonNode err = res.asJson();
                    String code = err.path("error").asText("");
                    Matcher aad = AADSTS.matcher(err.path("error_description").asText(""));
                    detail = (code + " " + (aad.find() ? aad.group() : "")).trim();
                } catch (Exception ignored) {
                    // body was not JSON
                }
                throw new IOException(what + ": HTTP " + status + (detail.isEmpty() ? "" : " " + detail));
            }
            return res.asJson();
        } finally {
            res.close();
        }
    }
}
