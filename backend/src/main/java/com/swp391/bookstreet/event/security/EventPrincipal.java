package com.swp391.bookstreet.event.security;

import java.io.Serializable;

/**
 * Integration contract for the authenticated session principal supplied by Auth.
 * Implement this on the real principal; never populate it from an HTTP request body.
 * Roles remain Spring Security GrantedAuthority values.
 */
public interface EventPrincipal extends Serializable {
    Long userId();
    boolean emailVerified();
}

