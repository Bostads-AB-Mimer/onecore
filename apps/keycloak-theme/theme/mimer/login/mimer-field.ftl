<#import "field.ftl" as field>

<#-- keycloak.v2's field.input plus a placeholder, which field.input has no parameter for.
     Reuses field.group for the label and error text, so only the <input> itself is ours. -->
<#macro input name label placeholder value="" autocomplete="off" error=kcSanitize(messagesPerField.get(name))?no_esc autofocus=false>
  <@field.group name=name label=label error=error>
    <span class="${properties.kcInputClass} <#if error?has_content>${properties.kcError}</#if>">
        <input id="${name}" name="${name}" value="${value}" type="text" autocomplete="${autocomplete}" placeholder="${placeholder}" <#if autofocus>autofocus</#if>
                aria-invalid="<#if error?has_content>true</#if>"/>
        <@field.errorIcon error=error/>
    </span>
  </@field.group>
</#macro>
