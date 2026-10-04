INSERT INTO users (
    username,
    email,
    password_hash,
    full_name,
    email_verified_at,
    status
)
VALUES
    (
        'organizerdemo',
        'organizer.demo@example.com',
        '$2a$10$MoispgmJjcSIHTH3IoVBueKomhnXFyxsC8e901VjOXdBYbAsZg5V2',
        'Demo Organizer',
        CURRENT_TIMESTAMP,
        'ACTIVE'
    ),
    (
        'partnerdemo',
        'partner.demo@example.com',
        '$2a$10$gQvnZ9LSNhhbCjNAS3yiq.jAdcxYpTz.cnwhizcqQ9rIAsvSlDZcO',
        'Demo Partner',
        CURRENT_TIMESTAMP,
        'ACTIVE'
    );

INSERT INTO user_roles (user_id, role_id)
SELECT
    demo_user.user_id,
    system_role.role_id
FROM (
    VALUES
        ('organizerdemo', 'PARTICIPANT'),
        ('organizerdemo', 'ORGANIZER'),
        ('partnerdemo', 'PARTICIPANT'),
        ('partnerdemo', 'PARTNER')
) AS demo_assignment(username, role_code)
JOIN users AS demo_user
    ON demo_user.username = demo_assignment.username
JOIN roles AS system_role
    ON system_role.code = demo_assignment.role_code;
