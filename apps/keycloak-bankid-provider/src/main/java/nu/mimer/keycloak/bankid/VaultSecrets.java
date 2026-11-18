package nu.mimer.keycloak.bankid;

import java.io.IOException;
import java.util.regex.Matcher;
import org.keycloak.models.KeycloakSession;
import org.keycloak.vault.VaultStringSecret;

/** Reads the client secret and APIM key from the realm's vault. */
final class VaultSecrets {

    private VaultSecrets() {
    }

    /**
     * Resolves a {@code ${vault.<key>}} setting through the realm's vault. Anything else, or a key
     * the vault does not have, is an error naming the setting: sending the unresolved text on would
     * come back from Entra as a wrong secret instead.
     */
    static String resolve(KeycloakSession session, String name, String value) throws IOException {
        Matcher ref = MimerBankIdConfig.VAULT_REFERENCE.matcher(MimerBankIdConfig.required(name, value));
        if (!ref.matches()) {
            throw new IOException(name + " must be a ${vault.<key>} reference");
        }
        try (VaultStringSecret s = session.vault().getStringSecret(value)) {
            return s.get().orElseThrow(() -> new IOException(
                    name + ": vault key " + ref.group(1) + " not found (is the vault configured and the entry there?)"));
        }
    }
}
