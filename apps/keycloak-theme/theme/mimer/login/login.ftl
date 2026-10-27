<#-- Copy of keycloak.v2/login/login.ftl (Keycloak 26.3.3). Changes are marked "Mimer:". -->
<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#import "buttons.ftl" as buttons>
<#import "passkeys.ftl" as passkeys>
<#import "mimer-field.ftl" as mimerField>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password && realm.registrationAllowed && !registrationDisabled??; section>
<!-- template: login.ftl -->

    <#if section = "header">
        ${msg("loginAccountTitle")}
    <#elseif section = "form">
        <div id="kc-form">
          <div id="kc-form-wrapper">
            <#-- Mimer: identity providers (BankID) first, like Mina sidor, instead of below the form -->
            <#if realm.password && social.providers?? && social.providers?has_content>
                <ul id="kc-social-providers" class="mimer-idp-list">
                    <#list social.providers as p>
                        <li>
                            <a data-once-link data-disabled-class="${properties.kcFormSocialAccountListButtonDisabledClass!}"
                               id="social-${p.alias}" class="mimer-idp-button" href="${p.loginUrl}">
                                <#if p.alias?contains("bankid")>
                                    <img src="${url.resourcesPath}/img/bankid.svg" alt="" aria-hidden="true">
                                </#if>
                                <span>${p.displayName!}</span>
                            </a>
                        </li>
                    </#list>
                </ul>
                <div class="mimer-divider"><span>${msg("mimerLoginWithPassword")}</span></div>
            </#if>

            <#-- Mimer: existing users have no password after the move from Xpand; point them to the reset flow -->
            <#if realm.resetPasswordAllowed>
                <div class="mimer-notice" role="note">
                    ${kcSanitize(msg("mimerFirstLoginInfo", url.loginResetCredentialsUrl))?no_esc}
                </div>
            </#if>

            <#if realm.password>
                <form id="kc-form-login" class="${properties.kcFormClass!}" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post" novalidate="novalidate">
                    <#if !usernameHidden??>
                        <#assign label>
                            <#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if>
                        </#assign>
                        <#-- Mimer: placeholder on the username field -->
                        <@mimerField.input name="username" label=label placeholder=msg("mimerUsernamePlaceholder") error=kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc
                            autofocus=true autocomplete="${(enableWebAuthnConditionalUI?has_content)?then('username webauthn', 'username')}" value=login.username!'' />
                        <#-- Mimer: forgotPassword=false, the link is rendered below the button instead -->
                        <@field.password name="password" label=msg("password") error="" forgotPassword=false autofocus=usernameHidden?? autocomplete="current-password">
                            <#if realm.rememberMe && !usernameHidden??>
                                <@field.checkbox name="rememberMe" label=msg("rememberMe") value=login.rememberMe?? />
                            </#if>
                        </@field.password>
                    <#else>
                        <@field.password name="password" label=msg("password") forgotPassword=false autofocus=usernameHidden?? autocomplete="current-password">
                            <#if realm.rememberMe && !usernameHidden??>
                                <@field.checkbox name="rememberMe" label=msg("rememberMe") value=login.rememberMe?? />
                            </#if>
                        </@field.password>
                    </#if>

                    <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                    <@buttons.loginButton />

                    <#if realm.resetPasswordAllowed>
                        <div class="mimer-links">
                            <a id="kc-forgot-password" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a>
                        </div>
                    </#if>
                </form>
            </#if>
            </div>
        </div>
        <@passkeys.conditionalUIData />
    <#elseif section = "info" >
        <#if realm.password && realm.registrationAllowed && !registrationDisabled??>
            <div id="kc-registration-container">
                <div id="kc-registration">
                    <span>${msg("noAccount")} <a href="${url.registrationUrl}">${msg("doRegister")}</a></span>
                </div>
            </div>
        </#if>
    </#if>

</@layout.registrationLayout>
