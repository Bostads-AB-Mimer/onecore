<#-- Copy of keycloak.v2/login/login-reset-password.ftl (Keycloak 26.3.3). Changes are marked "Mimer:". -->
<#import "template.ftl" as layout>
<#import "field.ftl" as field>
<#import "buttons.ftl" as buttons>
<#import "mimer-field.ftl" as mimerField>
<@layout.registrationLayout displayInfo=true displayMessage=!messagesPerField.existsError('username'); section>
    <#if section = "header">
        ${msg("emailForgotTitle")}
    <#elseif section = "form">
        <form id="kc-reset-password-form" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
            <#assign label>
                <#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if>
            </#assign>
            <#-- Mimer: placeholder on the username field -->
            <@mimerField.input name="username" label=label placeholder=msg("mimerUsernamePlaceholder") value=auth.attemptedUsername!'' autofocus=true />

            <@buttons.actionGroup>
              <@buttons.button id="kc-form-buttons" label="doSubmit" class=["kcButtonPrimaryClass", "kcButtonBlockClass"]/>
              <@buttons.buttonLink href=url.loginUrl label="backToLogin" class=["kcButtonSecondaryClass", "kcButtonBlockClass"]/>
            </@buttons.actionGroup>

        </form>
    <#elseif section = "info" >
        <span class="${properties.kcLoginMainFooterHelperText!}">
            <#if realm.duplicateEmailsAllowed>
                ${msg("emailInstructionUsername")}
            <#else>
                ${msg("emailInstruction")}
            </#if>
        </span>
    </#if>
</@layout.registrationLayout>
