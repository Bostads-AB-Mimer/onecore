package nu.mimer.keycloak.bankid;

import org.keycloak.models.IdentityProviderModel;

/** Typed access to the settings an admin fills in for a Mimer BankID identity provider. */
public class MimerBankIdConfig extends IdentityProviderModel {

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
}
