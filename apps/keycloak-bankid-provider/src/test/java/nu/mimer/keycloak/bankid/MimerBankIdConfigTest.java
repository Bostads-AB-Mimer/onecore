package nu.mimer.keycloak.bankid;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.keycloak.common.enums.SslRequired;
import org.keycloak.models.RealmModel;

class MimerBankIdConfigTest {

    private final RealmModel realm = mock(RealmModel.class);
    private final MimerBankIdConfig config = new MimerBankIdConfig();

    @BeforeEach
    void setUp() {
        when(realm.getSslRequired()).thenReturn(SslRequired.ALL);
        config.getConfig().put("gatewayUrl", "https://apim.example/eid/v1/api");
        config.getConfig().put("tokenUrl", "https://login.microsoftonline.com/t/oauth2/v2.0/token");
        config.getConfig().put("clientId", "client");
        config.getConfig().put("scope", "api://bankid/.default");
        config.getConfig().put("clientSecret", "${vault.bankid-client-secret}");
        config.getConfig().put("apimKey", "${vault.bankid-apim-key}");
    }

    @Test
    void completeConfigIsAccepted() {
        assertDoesNotThrow(() -> config.validate(realm));
        assertEquals("https://apim.example/eid/v1/api/", config.getGatewayUrl());
    }

    @ParameterizedTest
    @ValueSource(strings = {"gatewayUrl", "tokenUrl", "clientId", "scope", "clientSecret", "apimKey"})
    void everySettingIsRequired(String name) {
        config.getConfig().remove(name);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> config.validate(realm));
        assertEquals(name + " is required", e.getMessage());
    }

    @ParameterizedTest
    @ValueSource(strings = {"clientSecret", "apimKey"})
    void secretsMustComeFromTheVault(String name) {
        config.getConfig().put(name, "plaintext");
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, () -> config.validate(realm));
        assertEquals(name + " must be a ${vault.<key>} reference", e.getMessage());
    }

    @Test
    void plainHttpIsRefusedWhenTheRealmRequiresSsl() {
        config.getConfig().put("tokenUrl", "http://login.example/token");
        assertThrows(IllegalArgumentException.class, () -> config.validate(realm));
    }
}
