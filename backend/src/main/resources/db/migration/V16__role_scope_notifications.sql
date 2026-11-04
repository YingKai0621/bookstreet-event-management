ALTER TABLE notifications
    ADD COLUMN recipient_role VARCHAR(20);

UPDATE notifications
SET recipient_role = 'PARTICIPANT';

ALTER TABLE notifications
    ALTER COLUMN recipient_role SET NOT NULL,
    ADD COLUMN partner_event_application_id BIGINT,
    ADD COLUMN booth_request_id BIGINT,
    ADD COLUMN activity_proposal_id BIGINT,
    ADD COLUMN activity_request_id BIGINT,
    ADD CONSTRAINT fk_notifications_partner_event_application
        FOREIGN KEY (partner_event_application_id)
        REFERENCES partner_event_applications (application_id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT fk_notifications_booth_request
        FOREIGN KEY (booth_request_id)
        REFERENCES booth_requests (booth_request_id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT fk_notifications_activity_proposal
        FOREIGN KEY (activity_proposal_id)
        REFERENCES activity_proposals (activity_proposal_id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT fk_notifications_activity_request
        FOREIGN KEY (activity_request_id)
        REFERENCES activity_requests (activity_request_id)
        ON DELETE RESTRICT;

ALTER TABLE notifications
    DROP CONSTRAINT ck_notifications_type,
    DROP CONSTRAINT ck_notifications_reference,
    DROP CONSTRAINT uk_notifications_recipient_deduplication;

ALTER TABLE notifications
    ADD CONSTRAINT ck_notifications_recipient_role
        CHECK (recipient_role IN ('PARTICIPANT', 'PARTNER', 'ORGANIZER', 'ADMIN')),
    ADD CONSTRAINT ck_notifications_type_role_reference
        CHECK (
            (
                recipient_role = 'PARTICIPANT'
                AND (
                    (
                        notification_type IN (
                            'ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED',
                            'ACTIVITY_CANCELLED'
                        )
                        AND activity_id IS NOT NULL
                        AND event_id IS NULL
                        AND certificate_id IS NULL
                        AND badge_id IS NULL
                    )
                    OR (
                        notification_type = 'EVENT_CANCELLED'
                        AND event_id IS NOT NULL
                        AND activity_id IS NULL
                        AND certificate_id IS NULL
                        AND badge_id IS NULL
                    )
                    OR (
                        notification_type IN ('CERTIFICATE_ISSUED', 'CERTIFICATE_REVOKED')
                        AND certificate_id IS NOT NULL
                        AND event_id IS NULL
                        AND activity_id IS NULL
                        AND badge_id IS NULL
                    )
                    OR (
                        notification_type = 'BADGE_UNLOCKED'
                        AND badge_id IS NOT NULL
                        AND event_id IS NULL
                        AND activity_id IS NULL
                        AND certificate_id IS NULL
                    )
                )
                AND partner_event_application_id IS NULL
                AND booth_request_id IS NULL
                AND activity_proposal_id IS NULL
                AND activity_request_id IS NULL
            )
            OR (
                recipient_role = 'PARTNER'
                AND (
                    (
                        notification_type = 'PARTNER_APPLICATION_STATUS_CHANGED'
                        AND partner_event_application_id IS NOT NULL
                        AND booth_request_id IS NULL
                        AND activity_proposal_id IS NULL
                        AND activity_request_id IS NULL
                        AND event_id IS NULL
                        AND activity_id IS NULL
                    )
                    OR (
                        notification_type = 'PARTNER_BOOTH_REQUEST_STATUS_CHANGED'
                        AND booth_request_id IS NOT NULL
                        AND partner_event_application_id IS NULL
                        AND activity_proposal_id IS NULL
                        AND activity_request_id IS NULL
                        AND event_id IS NULL
                        AND activity_id IS NULL
                    )
                    OR (
                        notification_type = 'PARTNER_ACTIVITY_PROPOSAL_STATUS_CHANGED'
                        AND activity_proposal_id IS NOT NULL
                        AND partner_event_application_id IS NULL
                        AND booth_request_id IS NULL
                        AND activity_request_id IS NULL
                        AND event_id IS NULL
                        AND activity_id IS NULL
                    )
                    OR (
                        notification_type IN (
                            'PARTNER_ACTIVITY_CHANGE_REQUEST_STATUS_CHANGED',
                            'PARTNER_ACTIVITY_CANCELLATION_REQUEST_STATUS_CHANGED'
                        )
                        AND activity_request_id IS NOT NULL
                        AND partner_event_application_id IS NULL
                        AND booth_request_id IS NULL
                        AND activity_proposal_id IS NULL
                        AND event_id IS NULL
                        AND activity_id IS NULL
                    )
                    OR (
                        notification_type = 'PARTNER_EVENT_CANCELLED'
                        AND event_id IS NOT NULL
                        AND partner_event_application_id IS NULL
                        AND booth_request_id IS NULL
                        AND activity_proposal_id IS NULL
                        AND activity_request_id IS NULL
                        AND activity_id IS NULL
                    )
                    OR (
                        notification_type = 'PARTNER_ACTIVITY_CANCELLED'
                        AND activity_id IS NOT NULL
                        AND partner_event_application_id IS NULL
                        AND booth_request_id IS NULL
                        AND activity_proposal_id IS NULL
                        AND activity_request_id IS NULL
                        AND event_id IS NULL
                    )
                )
                AND certificate_id IS NULL
                AND badge_id IS NULL
            )
            OR (
                recipient_role = 'ORGANIZER'
                AND (
                    (
                        notification_type = 'ORGANIZER_NEW_PARTNER_APPLICATION'
                        AND partner_event_application_id IS NOT NULL
                        AND booth_request_id IS NULL
                        AND activity_proposal_id IS NULL
                        AND activity_request_id IS NULL
                    )
                    OR (
                        notification_type IN (
                            'ORGANIZER_NEW_BOOTH_REQUEST',
                            'ORGANIZER_BOOTH_RESELECTION_REQUIRED'
                        )
                        AND booth_request_id IS NOT NULL
                        AND partner_event_application_id IS NULL
                        AND activity_proposal_id IS NULL
                        AND activity_request_id IS NULL
                    )
                    OR (
                        notification_type = 'ORGANIZER_ACTIVITY_PROPOSAL_SUBMITTED'
                        AND activity_proposal_id IS NOT NULL
                        AND partner_event_application_id IS NULL
                        AND booth_request_id IS NULL
                        AND activity_request_id IS NULL
                    )
                    OR (
                        notification_type IN (
                            'ORGANIZER_NEW_ACTIVITY_CHANGE_REQUEST',
                            'ORGANIZER_NEW_ACTIVITY_CANCELLATION_REQUEST'
                        )
                        AND activity_request_id IS NOT NULL
                        AND partner_event_application_id IS NULL
                        AND booth_request_id IS NULL
                        AND activity_proposal_id IS NULL
                    )
                )
                AND event_id IS NULL
                AND activity_id IS NULL
                AND certificate_id IS NULL
                AND badge_id IS NULL
            )
        ),
    ADD CONSTRAINT uk_notifications_recipient_role_deduplication
        UNIQUE (recipient_user_id, recipient_role, deduplication_key);

DROP INDEX idx_notifications_recipient_created;
DROP INDEX idx_notifications_recipient_unread;

CREATE INDEX idx_notifications_recipient_role_created
    ON notifications (
        recipient_user_id,
        recipient_role,
        created_at DESC,
        notification_id ASC
    );

CREATE INDEX idx_notifications_recipient_role_unread
    ON notifications (
        recipient_user_id,
        recipient_role,
        created_at DESC,
        notification_id ASC
    )
    WHERE read_at IS NULL;

CREATE INDEX idx_notifications_recipient_role_read
    ON notifications (
        recipient_user_id,
        recipient_role,
        read_at DESC NULLS LAST,
        notification_id ASC
    );

CREATE INDEX idx_notifications_partner_event_application
    ON notifications (partner_event_application_id, notification_id);

CREATE INDEX idx_notifications_booth_request
    ON notifications (booth_request_id, notification_id);

CREATE INDEX idx_notifications_activity_proposal
    ON notifications (activity_proposal_id, notification_id);

CREATE INDEX idx_notifications_activity_request
    ON notifications (activity_request_id, notification_id);
