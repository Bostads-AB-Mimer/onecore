package nu.mimer.keycloak.bankid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import nu.mimer.keycloak.bankid.Transaction.Outcome;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class TransactionTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PNR = "199001011234";

    /** A transaction as Mimer BankID returns it, read through {@link Transaction#fromJson}. */
    private static Transaction tx(String method, String status, String hint, String pnr) throws Exception {
        String completion = pnr == null ? "null" : "{\"user\":{\"personalNumber\":\"" + pnr + "\"}}";
        String hintJson = hint == null ? "null" : "\"" + hint + "\"";
        return Transaction.fromJson(JSON.readTree("{\"id\":\"x\",\"method\":\"" + method + "\",\"status\":\"" + status
                + "\",\"processingInfo\":{\"hintCode\":" + hintJson + ",\"completionData\":" + completion + "}}"));
    }

    @Test
    void completedAuthWithTwelveDigitsIsAccepted() throws Exception {
        assertEquals(new Outcome.Accepted(PNR), tx("Auth", "Complete", null, PNR).outcome());
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
        assertInstanceOf(Outcome.Rejected.class, tx(method, status, hint, pnr).outcome());
    }

    @Test
    void cancelIsCancelled() throws Exception {
        assertEquals(new Outcome.Cancelled(), tx("Auth", "Cancelled", null, null).outcome());
        assertEquals(new Outcome.Cancelled(), tx("Auth", "Failed", "UserCancel", null).outcome());
        assertEquals(new Outcome.Cancelled(), tx("Auth", "Failed", "userCancel", null).outcome());
    }

    @Test
    void rejectionReasonNamesMethodStatusAndHint() throws Exception {
        Outcome.Rejected r = (Outcome.Rejected) tx("Auth", "Failed", "TransactionRiskBlocked", null).outcome();
        assertEquals("method=Auth status=Failed hint=TransactionRiskBlocked", r.reason());
    }

    @Test
    void thePersonnummerStaysOutOfEverythingLoggable() throws Exception {
        Transaction complete = tx("Auth", "Complete", null, PNR);
        assertFalse(complete.toString().contains(PNR), complete.toString());
        assertFalse(complete.outcome().toString().contains(PNR), complete.outcome().toString());

        String malformed = "19900101-1234";
        Outcome.Rejected r = (Outcome.Rejected) tx("Auth", "Complete", null, malformed).outcome();
        assertFalse(r.reason().contains(malformed), r.reason());
        assertEquals("method=Auth status=Complete hint=null, personalNumber missing or not 12 digits", r.reason());
    }

    @ParameterizedTest
    @ValueSource(strings = {"[]", "\"text\"", "null"})
    void responseThatIsNotAnObjectIsAnError(String body) {
        IOException e = assertThrows(IOException.class, () -> Transaction.fromJson(JSON.readTree(body)));
        assertEquals("transaction: response is not a JSON object", e.getMessage());
    }

    @Test
    void missingResponseIsAnError() {
        assertThrows(IOException.class, () -> Transaction.fromJson(null));
    }
}
