package nu.mimer.keycloak.bankid;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.regex.Pattern;

/**
 * The parts of a Mimer BankID transaction that decide a login, and what they mean for it. The only
 * place that knows the transaction's JSON shape. Pure, so it carries the unit tests for who logs in.
 *
 * <p>{@link #toString()} leaves the personnummer out, so a transaction is safe to log.
 */
public record Transaction(String method, String status, String hintCode, String personalNumber) {

    /** What a transaction means for the login. */
    public sealed interface Outcome {
        /** A completed BankID Auth with a 12-digit personnummer. */
        record Accepted(String personalNumber) implements Outcome {
            @Override
            public String toString() {
                return "Accepted";
            }
        }

        /** The user cancelled, in the BankID app or on Mimer BankID's page. */
        record Cancelled() implements Outcome {
        }

        /** Anything else. {@code reason} is for the log and never holds the personnummer. */
        record Rejected(String reason) implements Outcome {
        }
    }

    private static final Pattern PERSONAL_NUMBER = Pattern.compile("^\\d{12}$");

    /** Reads a {@code GET /transactions/{id}} response. */
    static Transaction fromJson(JsonNode json) throws IOException {
        if (json == null || !json.isObject()) {
            throw new IOException("transaction: response is not a JSON object");
        }
        JsonNode info = json.path("processingInfo");
        return new Transaction(
                json.path("method").asText(null),
                json.path("status").asText(null),
                info.path("hintCode").asText(null),
                info.path("completionData").path("user").path("personalNumber").asText(null));
    }

    public Outcome outcome() {
        // BankID's own hint codes are camelCase (userCancel); accept either casing.
        if ("Cancelled".equals(status) || ("Failed".equals(status) && "userCancel".equalsIgnoreCase(hintCode))) {
            return new Outcome.Cancelled();
        }
        if (!"Auth".equals(method) || !"Complete".equals(status)) {
            return new Outcome.Rejected(toString());
        }
        if (personalNumber == null || !PERSONAL_NUMBER.matcher(personalNumber).matches()) {
            return new Outcome.Rejected(toString() + ", personalNumber missing or not 12 digits");
        }
        return new Outcome.Accepted(personalNumber);
    }

    @Override
    public String toString() {
        return "method=" + method + " status=" + status + " hint=" + hintCode;
    }
}
