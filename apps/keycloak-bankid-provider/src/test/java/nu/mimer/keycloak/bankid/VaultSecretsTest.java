package nu.mimer.keycloak.bankid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.keycloak.models.KeycloakSession;
import org.keycloak.vault.VaultStringSecret;
import org.keycloak.vault.VaultTranscriber;

class VaultSecretsTest {

    private static final String SECRET_REF = "${vault.bankid-client-secret}";

    private final KeycloakSession session = mock(KeycloakSession.class);
    private final VaultTranscriber vault = mock(VaultTranscriber.class);

    @BeforeEach
    void setUp() {
        when(session.vault()).thenReturn(vault);
    }

    private void vaultHas(String ref, Optional<String> value) {
        VaultStringSecret secret = mock(VaultStringSecret.class);
        when(secret.get()).thenReturn(value);
        when(vault.getStringSecret(ref)).thenReturn(secret);
    }

    @Test
    void vaultReferenceResolves() throws Exception {
        vaultHas(SECRET_REF, Optional.of("s3cret"));
        assertEquals("s3cret", VaultSecrets.resolve(session, "clientSecret", SECRET_REF));
    }

    @Test
    void missingVaultKeyNamesTheKeyInsteadOfSendingThePlaceholder() {
        vaultHas(SECRET_REF, Optional.empty());
        IOException e = assertThrows(IOException.class, () -> VaultSecrets.resolve(session, "clientSecret", SECRET_REF));
        assertTrue(e.getMessage().contains("vault key bankid-client-secret not found"), e.getMessage());
    }

    @Test
    void plaintextSecretIsRefused() {
        IOException e = assertThrows(IOException.class, () -> VaultSecrets.resolve(session, "apimKey", "plain-key"));
        assertTrue(e.getMessage().startsWith("apimKey must be a ${vault."), e.getMessage());
        verifyNoInteractions(vault);
    }

    @Test
    void unsetSecretIsRefused() {
        IOException e = assertThrows(IOException.class, () -> VaultSecrets.resolve(session, "apimKey", null));
        assertEquals("apimKey is not set", e.getMessage());
    }
}
