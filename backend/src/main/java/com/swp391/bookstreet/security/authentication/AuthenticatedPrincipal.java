package com.swp391.bookstreet.security.authentication;

import java.io.Serializable;

/**
 * Shared identity contract exposed by the authenticated server-side session.
 * Feature modules use this contract to obtain the current user identity instead
 * of accepting ownership identifiers from an HTTP request.
 */
public interface AuthenticatedPrincipal extends Serializable {

    Long userId();

    boolean emailVerified();
}
