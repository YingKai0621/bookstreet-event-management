ALTER TABLE notifications
    DROP CONSTRAINT ck_notifications_type_role_reference;

ALTER TABLE notifications
    ADD CONSTRAINT ck_notifications_type_role_reference
        CHECK (
            (
                recipient_role = 'PARTICIPANT'
                AND (
                    (
                        notification_type IN (
                            'ACTIVITY_SCHEDULE_OR_LOCATION_CHANGED',
                            'ACTIVITY_CANCELLED',
                            'ACTIVITY_STARTING_SOON'
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
                        notification_type IN (
                            'PARTNER_BOOTH_REQUEST_STATUS_CHANGED',
                            'PARTNER_BOOTH_HOLD_EXPIRING'
                        )
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
                        notification_type IN ('PARTNER_EVENT_CANCELLED', 'PARTNER_EVENT_PUBLISHED')
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
                            'ORGANIZER_BOOTH_RESELECTION_REQUIRED',
                            'ORGANIZER_BOOTH_PAYMENT_CONFIRMED'
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
        );
