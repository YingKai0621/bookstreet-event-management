package com.swp391.bookstreet.notification.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class NotificationNoStoreFilterTests {
    private final NotificationNoStoreFilter filter = new NotificationNoStoreFilter();

    @Test
    void exactNotificationFamilyAndChildrenReceiveNoStore() throws Exception {
        assertNoStore("/api/v1/participant/notifications");
        assertNoStore("/api/v1/partner/notifications/9/read");
        assertNoStore("/api/v1/organizer/notifications/read-all");
        assertNoStore("/api/v1/admin/notifications/unread-count");
    }

    @Test
    void lookalikePathOutsideNotificationFamilyIsNotModified() throws Exception {
        MockHttpServletResponse response = apply("/api/v1/partner/notifications-export");
        assertThat(response.getHeader("Cache-Control")).isNull();
    }

    private void assertNoStore(String path) throws Exception {
        assertThat(apply(path).getHeader("Cache-Control")).isEqualTo("no-store");
    }

    private MockHttpServletResponse apply(String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setRequestURI(path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
