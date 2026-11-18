package nu.mimer.keycloak.bankid;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.regex.Pattern;

/** Decides what a Mimer BankID transaction means for the login. Pure, so it carries the unit tests. */
public final class TransactionCheck {

    public enum Outcome { ACCEPTED, CANCELLED, REJECTED }

    private static final Pattern PERSONAL_NUMBER = Pattern.compile("^\\d{12}$");

    private TransactionCheck() {
    }

    public static Outcome evaluate(JsonNode tx) {
        if (tx == null || !tx.isObject()) {
            return Outcome.REJECTED;
        }
        String status = tx.path("status").asText("");
        String hint = tx.path("processingInfo").path("hintCode").asText("");
        // BankID's own hint codes are camelCase (userCancel); accept either casing.
        if ("Cancelled".equals(status) || ("Failed".equals(status) && "userCancel".equalsIgnoreCase(hint))) {
            return Outcome.CANCELLED;
        }
        if (!"Auth".equals(tx.path("method").asText(""))) {
            return Outcome.REJECTED;
        }
        if (!"Complete".equals(status)) {
            return Outcome.REJECTED;
        }
        return personalNumber(tx) == null ? Outcome.REJECTED : Outcome.ACCEPTED;
    }

    /** The 12-digit personnummer of a completed transaction, or null. */
    public static String personalNumber(JsonNode tx) {
        String pnr = tx.path("processingInfo").path("completionData").path("user").path("personalNumber").asText(null);
        return pnr != null && PERSONAL_NUMBER.matcher(pnr).matches() ? pnr : null;
    }
}
