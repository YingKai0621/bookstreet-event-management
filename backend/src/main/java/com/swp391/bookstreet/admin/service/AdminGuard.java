package com.swp391.bookstreet.admin.service;

import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.common.exception.ApiException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Keeps the system from losing its last active Admin. Call this before a lock or an ADMIN role removal,
 * inside the transaction that makes the change: the row locks it takes last until that commit, so
 * concurrent commands are checked one after another.
 */
@Service
public class AdminGuard {
    private final UserRepository users;

    public AdminGuard(UserRepository users) {
        this.users = users;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireAnotherActiveAdmin(Long targetUserId) {
        List<Long> activeAdmins = users.lockActiveAdminIds();
        if (activeAdmins.size() == 1 && activeAdmins.getFirst().equals(targetUserId)) {
            throw new ApiException(HttpStatus.CONFLICT, "LAST_ACTIVE_ADMIN_REQUIRED",
                    "The system must keep at least one active Admin.");
        }
    }
}
