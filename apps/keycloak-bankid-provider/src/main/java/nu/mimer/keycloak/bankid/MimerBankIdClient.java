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

    private record CachedToken(String value, long expiresAtMillis) {
    }

    private static final Map<String, CachedToken> TOKENS = new ConcurrentHashMap<>();
    private static final int TIMEOUT_MS = 5000;
    private static final Pattern AADSTS = Pattern.compile("AADSTS\\d+");

    private final KeycloakSession session;
    private final MimerBankIdConfig config;

    public MimerBankIdClient(KeycloakSession session, MimerBankIdConfig config) {
        this.session = session;
        this.config = config;
    }

    public Created createAuth(String endUserIp, String redirectUrl) throws IOException {
        Map<String, Object> body = Map.of(
                "method", "Auth",
                "transactionParameters", Map.of("auth", Map.of("endUserIp", endUserIp, "requirement", Map.of())),
                "redirectUrl", redirectUrl);
        SimpleHttp.Response res = withTimeouts(SimpleHttp.doPost(config.getGatewayUrl() + "transactions", session))
                .auth(token())
                .header("Ocp-Apim-Subscription-Key", secret(config.getApimKey()))
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
        SimpleHttp.Response res = withTimeouts(SimpleHttp.doGet(config.getGatewayUrl() + "transactions/" + transactionId, session))
                .auth(token())
                .header("Ocp-Apim-Subscription-Key", secret(config.getApimKey()))
                .asResponse();
        return okJson(res, "get transaction", true);
    }

    private String tokenKey() {
        return config.getTokenUrl() + "|" + config.getClientId() + "|" + config.getScope();
    }

    private String token() throws IOException {
        CachedToken cached = TOKENS.get(tokenKey());
        if (cached != null && cached.expiresAtMillis() > System.currentTimeMillis() + 60_000) {
            return cached.value();
        }
        SimpleHttp.Response res = withTimeouts(SimpleHttp.doPost(config.getTokenUrl(), session))
                .param("grant_type", "client_credentials")
                .param("client_id", config.getClientId())
                .param("client_secret", secret(config.getClientSecret()))
                .param("scope", config.getScope())
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

    /** Resolves {@code ${vault.<key>}} through the realm's vault; any other value is used as is (local runs). */
    private String secret(String value) {
        if (value == null) {
            return null;
        }
        try (VaultStringSecret s = session.vault().getStringSecret(value)) {
            return s.get().orElse(value);
        }
    }

    private static SimpleHttp withTimeouts(SimpleHttp http) {
        return http.connectTimeoutMillis(TIMEOUT_MS).socketTimeOutMillis(TIMEOUT_MS);
    }

    private JsonNode okJson(SimpleHttp.Response res, String what, boolean usesToken) throws IOException {
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
