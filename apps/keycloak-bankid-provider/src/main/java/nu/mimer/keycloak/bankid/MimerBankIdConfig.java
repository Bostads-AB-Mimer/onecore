package nu.mimer.keycloak.bankid;

import static org.keycloak.common.util.UriUtils.checkUrl;

import java.io.IOException;
import java.util.regex.Pattern;
import org.keycloak.models.IdentityProviderModel;
import org.keycloak.models.RealmModel;

/** Typed access to the settings an admin fills in for a Mimer BankID identity provider. */
public class MimerBankIdConfig extends IdentityProviderModel {

    /** The same expression Keycloak's vault transcriber recognises. */
    static final Pattern VAULT_REFERENCE = Pattern.compile("^\\$\\{vault\\.(.+?)}$");

    public MimerBankIdConfig() {
    }

    public MimerBankIdConfig(IdentityProviderModel model) {
        super(model);
    }

    /** Base URL of the transaction API, ending in a slash, e.g. https://…/eid/v1/api/ */
    public String getGatewayUrl() {
        String url = getConfig().get("gatewayUrl");
        return url != null && !url.endsWith("/") ? url + "/" : url;
    }

    public String getTokenUrl() {
        return getConfig().get("tokenUrl");
    }

    public String getClientId() {
        return getConfig().get("clientId");
    }

    public String getClientSecret() {
        return getConfig().get("clientSecret");
    }

    public String getScope() {
        return getConfig().get("scope");
    }

    public String getApimKey() {
        return getConfig().get("apimKey");
    }

    /**
     * The value, or an error naming the setting. A guard at login time for settings that
     * {@link #validate} already refuses when the provider is saved.
     */
    static String required(String name, String value) throws IOException {
        if (value == null || value.isBlank()) {
            throw new IOException(name + " is not set");
        }
        return value;
    }

    /**
     * Runs when the provider is saved in the admin console, through the admin API, or imported with
     * a realm. A rejected setting answers 400 there instead of failing at the first login.
     */
    @Override
    public void validate(RealmModel realm) {
        super.validate(realm);
        for (String name : new String[] {"gatewayUrl", "tokenUrl", "clientId", "scope", "clientSecret", "apimKey"}) {
            String value = getConfig().get(name);
            if (value == null || value.isBlank()) {
                throw new IllegalArgumentException(name + " is required");
            }
        }
        checkUrl(realm.getSslRequired(), getGatewayUrl(), "gatewayUrl");
        checkUrl(realm.getSslRequired(), getTokenUrl(), "tokenUrl");
        for (String name : new String[] {"clientSecret", "apimKey"}) {
            if (!VAULT_REFERENCE.matcher(getConfig().get(name)).matches()) {
                throw new IllegalArgumentException(name + " must be a ${vault.<key>} reference");
            }
        }
    }
}
