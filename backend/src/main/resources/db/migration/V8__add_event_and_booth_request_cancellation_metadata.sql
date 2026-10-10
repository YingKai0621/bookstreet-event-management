ALTER TABLE events
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN cancellation_reason TEXT;

UPDATE events
SET cancelled_at = updated_at,
    cancellation_reason = 'Sự kiện đã được hủy trước khi hệ thống lưu lý do.'
WHERE status = 'CANCELLED';

ALTER TABLE events
    ADD CONSTRAINT ck_events_cancellation_consistency
        CHECK (
            (status = 'CANCELLED'
                AND cancelled_at IS NOT NULL
                AND cancellation_reason IS NOT NULL)
            OR
            (status <> 'CANCELLED'
                AND cancelled_at IS NULL
                AND cancellation_reason IS NULL)
        ),
    ADD CONSTRAINT ck_events_cancellation_reason_length
        CHECK (
            cancellation_reason IS NULL
            OR CHAR_LENGTH(BTRIM(cancellation_reason)) BETWEEN 10 AND 500
        );


ALTER TABLE booth_requests
    ADD COLUMN cancelled_at TIMESTAMPTZ;

ALTER TABLE booth_requests
    DROP CONSTRAINT ck_booth_requests_status;

ALTER TABLE booth_requests
    ADD CONSTRAINT ck_booth_requests_status
        CHECK (status IN (
            'PENDING',
            'SELECTED',
            'COMPLETED',
            'PAYMENT_EXPIRED',
            'NOT_SELECTED',
            'REJECTED',
            'WITHDRAWN',
            'CANCELLED'
        )),
    ADD CONSTRAINT ck_booth_requests_cancellation_consistency
        CHECK (
            (status = 'CANCELLED' AND cancelled_at IS NOT NULL)
            OR (status <> 'CANCELLED' AND cancelled_at IS NULL)
        );
