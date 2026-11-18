package nu.mimer.keycloak.bankid;

import static nu.mimer.keycloak.bankid.MimerBankIdConfig.required;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.Map;
import org.keycloak.broker.provider.util.SimpleHttp;
import org.keycloak.models.KeycloakSession;

/**
 * Mimer BankID's transaction API: start an Auth transaction, and read one back. Every call carries
 * an Entra token ({@link EntraTokens}) and the APIM subscription key from the vault.
 */
public class MimerBankIdClient {

    /** A started transaction: its id, and the hosted page to send the browser to. */
    public record Created(String id, String accessUrl) {
    }

    private final KeycloakSession session;
    private final MimerBankIdConfig config;
    private final EntraTokens tokens;

    public MimerBankIdClient(KeycloakSession session, MimerBankIdConfig config) {
        this(session, config, new EntraTokens(session, config));
    }

    MimerBankIdClient(KeycloakSession session, MimerBankIdConfig config, EntraTokens tokens) {
        this.session = session;
        this.config = config;
        this.tokens = tokens;
    }

    public Created createAuth(String endUserIp, String redirectUrl) throws IOException {
        if (endUserIp == null) {
            throw new IOException("create transaction: no remote address for endUserIp");
        }
        Map<String, Object> body = Map.of(
                "method", "Auth",
                "transactionParameters", Map.of("auth", Map.of("endUserIp", endUserIp, "requirement", Map.of())),
                "redirectUrl", redirectUrl);
        JsonNode json = send(SimpleHttp.doPost(transactionsUrl(), session).json(body), "create transaction");
        String id = json.path("id").asText(null);
        String accessUrl = json.path("accessUrl").asText(null);
        if (id == null || accessUrl == null) {
            throw new IOException("create transaction: response without id or accessUrl");
        }
        return new Created(id, accessUrl);
    }

    public Transaction get(String transactionId) throws IOException {
        return Transaction.fromJson(send(SimpleHttp.doGet(transactionsUrl() + "/" + transactionId, session), "get transaction"));
    }

    /** Sends a request with the token and APIM key; a 401 drops the cached token before it fails. */
    JsonNode send(SimpleHttp request, String what) throws IOException {
        SimpleHttp authorized = Http.withTimeouts(request)
                .auth(tokens.get())
                .header("Ocp-Apim-Subscription-Key", VaultSecrets.resolve(session, "apimKey", config.getApimKey()));
        try (SimpleHttp.Response res = authorized.asResponse()) {
            if (res.getStatus() == 401) {
                tokens.invalidate();
            }
            return Http.json(res, what);
        }
    }

    private String transactionsUrl() throws IOException {
        return required("gatewayUrl", config.getGatewayUrl()) + "transactions";
    }
}
