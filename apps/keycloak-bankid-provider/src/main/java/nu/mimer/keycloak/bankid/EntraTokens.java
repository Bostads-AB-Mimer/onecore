package nu.mimer.keycloak.bankid;

import static nu.mimer.keycloak.bankid.MimerBankIdConfig.required;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.keycloak.broker.provider.util.SimpleHttp;
import org.keycloak.models.KeycloakSession;

/**
 * Entra access tokens for Mimer BankID (client credentials), cached per node until a minute before
 * they expire.
 *
 * <p>The cache is static, so every realm on the node shares it. Keying on the identity provider's
 * internal id (unique across realms), as well as token URL, client id and scope, keeps one realm's
 * token from being handed to another realm's provider that names the same client but never proved
 * it knows the secret.
 */
class EntraTokens {

    record CachedToken(String value, long expiresAtMillis) {
    }

    static final Map<String, CachedToken> CACHE = new ConcurrentHashMap<>();
    /** Fetch a new token this long before the cached one expires. */
    private static final long EXPIRY_MARGIN_MS = 60_000;
    /** Used when Entra leaves out expires_in. */
    private static final long DEFAULT_EXPIRES_IN_S = 300;

    private final KeycloakSession session;
    private final MimerBankIdConfig config;

    EntraTokens(KeycloakSession session, MimerBankIdConfig config) {
        this.session = session;
        this.config = config;
    }

    /** A cached token, or a new one from Entra. */
    String get() throws IOException {
        String key = key();
        CachedToken cached = CACHE.get(key);
        if (cached != null && cached.expiresAtMillis() > System.currentTimeMillis() + EXPIRY_MARGIN_MS) {
            return cached.value();
        }
        CachedToken fresh = fetch();
        CACHE.put(key, fresh);
        return fresh.value();
    }

    /** Drops the cached token after an API refused it, so a revoked token heals on the next login. */
    void invalidate() throws IOException {
        CACHE.remove(key());
    }

    String key() throws IOException {
        String idp = required("identity provider internal id", config.getInternalId());
        return idp + "|" + config.getTokenUrl() + "|" + config.getClientId() + "|" + config.getScope();
    }

    private CachedToken fetch() throws IOException {
        SimpleHttp request = Http.withTimeouts(SimpleHttp.doPost(required("tokenUrl", config.getTokenUrl()), session))
                .param("grant_type", "client_credentials")
                .param("client_id", required("clientId", config.getClientId()))
                .param("client_secret", VaultSecrets.resolve(session, "clientSecret", config.getClientSecret()))
                .param("scope", required("scope", config.getScope()));
        try (SimpleHttp.Response res = request.asResponse()) {
            JsonNode json = Http.json(res, "token");
            String value = json.path("access_token").asText(null);
            if (value == null) {
                throw new IOException("token: response without access_token");
            }
            long expiresIn = json.path("expires_in").asLong(DEFAULT_EXPIRES_IN_S);
            return new CachedToken(value, System.currentTimeMillis() + expiresIn * 1000);
        }
    }
}
