package nu.mimer.keycloak.bankid;

import static nu.mimer.keycloak.bankid.TransactionCheck.Outcome.ACCEPTED;
import static nu.mimer.keycloak.bankid.TransactionCheck.Outcome.CANCELLED;
import static nu.mimer.keycloak.bankid.TransactionCheck.Outcome.REJECTED;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class TransactionCheckTest {

    private static final ObjectMapper M = new ObjectMapper();

    private static JsonNode tx(String method, String status, String hint, String pnr) throws Exception {
        String completion = pnr == null ? "null" : "{\"user\":{\"personalNumber\":\"" + pnr + "\"}}";
        String hintJson = hint == null ? "null" : "\"" + hint + "\"";
        return M.readTree("{\"id\":\"x\",\"method\":\"" + method + "\",\"status\":\"" + status + "\","
                + "\"processingInfo\":{\"hintCode\":" + hintJson + ",\"completionData\":" + completion + "}}");
    }

    @Test
    void completedAuthWithTwelveDigitsIsAccepted() throws Exception {
        assertEquals(ACCEPTED, TransactionCheck.evaluate(tx("Auth", "Complete", null, "199001011234")));
        assertEquals("199001011234", TransactionCheck.personalNumber(tx("Auth", "Complete", null, "199001011234")));
    }

    @ParameterizedTest
    @CsvSource({
        "Sign,Complete,,199001011234",
        "PhoneAuth,Complete,,199001011234",
        "Auth,New,,",
        "Auth,Pending,OutstandingTransaction,",
        "Auth,Failed,TransactionRiskBlocked,",
        "Auth,Failed,ExpiredTransaction,",
        "Auth,Failed,StartFailed,",
        "Auth,Complete,,9001011234",
        "Auth,Complete,,19900101-1234",
        "Auth,Complete,,",
    })
    void everythingElseIsRejected(String method, String status, String hint, String pnr) throws Exception {
        assertEquals(REJECTED, TransactionCheck.evaluate(tx(method, status, hint, pnr)));
    }

    @Test
    void cancelIsCancelled() throws Exception {
        assertEquals(CANCELLED, TransactionCheck.evaluate(tx("Auth", "Cancelled", null, null)));
        assertEquals(CANCELLED, TransactionCheck.evaluate(tx("Auth", "Failed", "UserCancel", null)));
    }

    @Test
    void returnUrlKeepsStateOnBrokerEndpoint() {
        String url = MimerBankIdIdentityProvider.returnUrl(
                "https://auth.dev.mimer.nu/realms/mimer-contacts/broker/bankid/endpoint", "abc.def-ghi_jkl");
        assertEquals("https://auth.dev.mimer.nu/realms/mimer-contacts/broker/bankid/endpoint/return?state=abc.def-ghi_jkl", url);
        assertTrue(url.contains("/broker/bankid/endpoint"));
    }
}
