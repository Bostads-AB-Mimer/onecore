package nu.mimer.keycloak.bankid;

import java.util.List;
import org.keycloak.broker.provider.AbstractIdentityProviderFactory;
import org.keycloak.models.IdentityProviderModel;
import org.keycloak.models.KeycloakSession;
import org.keycloak.provider.ProviderConfigProperty;
import org.keycloak.provider.ProviderConfigurationBuilder;

public class MimerBankIdIdentityProviderFactory
        extends AbstractIdentityProviderFactory<MimerBankIdIdentityProvider> {

    public static final String PROVIDER_ID = "mimer-bankid";

    @Override
    public String getId() {
        return PROVIDER_ID;
    }

    @Override
    public String getName() {
        return "Mimer BankID";
    }

    @Override
    public MimerBankIdIdentityProvider create(KeycloakSession session, IdentityProviderModel model) {
        return new MimerBankIdIdentityProvider(session, new MimerBankIdConfig(model));
    }

    @Override
    public IdentityProviderModel createConfig() {
        return new MimerBankIdConfig();
    }

    @Override
    public List<ProviderConfigProperty> getConfigProperties() {
        return ProviderConfigurationBuilder.create()
                .property().name("gatewayUrl").label("Mimer BankID URL")
                    .helpText("Transaction API base URL, e.g. https://…/eid/v1/api/").type(ProviderConfigProperty.STRING_TYPE).add()
                .property().name("tokenUrl").label("Entra token URL").type(ProviderConfigProperty.STRING_TYPE).add()
                .property().name("clientId").label("Client id").type(ProviderConfigProperty.STRING_TYPE).add()
                .property().name("clientSecret").label("Client secret")
                    .helpText("Must be ${vault.<key>}").type(ProviderConfigProperty.PASSWORD).secret(true).add()
                .property().name("scope").label("Scope").type(ProviderConfigProperty.STRING_TYPE).add()
                .property().name("apimKey").label("APIM subscription key")
                    .helpText("Must be ${vault.<key>}").type(ProviderConfigProperty.PASSWORD).secret(true).add()
                .build();
    }
}
