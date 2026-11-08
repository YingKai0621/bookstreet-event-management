package com.swp391.bookstreet.admin.entity;

public enum AdminAuditAction {
    USER_CREATED(AdminAuditTargetType.USER, false),
    USER_UPDATED(AdminAuditTargetType.USER, false),
    USER_LOCKED(AdminAuditTargetType.USER, true),
    USER_UNLOCKED(AdminAuditTargetType.USER, true),
    ROLE_ASSIGNED(AdminAuditTargetType.USER, false),
    ROLE_REMOVED(AdminAuditTargetType.USER, false),
    ORGANIZATION_LOCKED(AdminAuditTargetType.PARTNER_ORGANIZATION, true),
    ORGANIZATION_UNLOCKED(AdminAuditTargetType.PARTNER_ORGANIZATION, true),
    BADGE_CREATED(AdminAuditTargetType.BADGE, false),
    BADGE_UPDATED(AdminAuditTargetType.BADGE, false),
    BADGE_AWARDS_SYNCHRONIZED(AdminAuditTargetType.BADGE, false);

    private final AdminAuditTargetType targetType;
    private final boolean reasonRequired;

    AdminAuditAction(AdminAuditTargetType targetType, boolean reasonRequired) {
        this.targetType = targetType;
        this.reasonRequired = reasonRequired;
    }

    public AdminAuditTargetType targetType() {
        return targetType;
    }

    public boolean reasonRequired() {
        return reasonRequired;
    }
}
