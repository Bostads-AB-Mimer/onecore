package nu.mimer.keycloak.bankid;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import org.junit.jupiter.api.Test;
import org.keycloak.broker.provider.util.SimpleHttp;

class HttpTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static SimpleHttp.Response response(int status, JsonNode body) throws IOException {
        SimpleHttp.Response res = mock(SimpleHttp.Response.class);
        when(res.getStatus()).thenReturn(status);
        when(res.asJson()).thenReturn(body);
        return res;
    }

    @Test
    void successReturnsTheBody() throws Exception {
        JsonNode body = JSON.readTree("{\"id\":\"tx-1\"}");
        assertSame(body, Http.json(response(201, body), "create transaction"));
    }

    @Test
    void entraErrorKeepsOnlyTheCodes() throws Exception {
        SimpleHttp.Response res = response(401, JSON.readTree(
                "{\"error\":\"invalid_client\",\"error_description\":\"AADSTS7000215: Invalid client secret provided. Trace ID: x\"}"));
        IOException e = assertThrows(IOException.class, () -> Http.json(res, "token"));
        assertEquals("token: HTTP 401 invalid_client AADSTS7000215", e.getMessage());
    }

    @Test
    void errorBodyThatIsNotJsonGivesTheStatusOnly() throws Exception {
        SimpleHttp.Response res = mock(SimpleHttp.Response.class);
        when(res.getStatus()).thenReturn(503);
        when(res.asJson()).thenThrow(new IOException("not json"));
        IOException e = assertThrows(IOException.class, () -> Http.json(res, "get transaction"));
        assertEquals("get transaction: HTTP 503", e.getMessage());
    }
}
