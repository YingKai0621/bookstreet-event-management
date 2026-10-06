-- Update existing demo accounts with requested password 'BookStreet@123'
UPDATE users
SET password_hash = '$2a$10$pvN1yBhezmRmImNG22HPnOIU2e39H1AJpS1Za1JuYYnHzWq6kJQ6q'
WHERE LOWER(username) IN ('organizerdemo', 'partnerdemo');

-- Insert admindemo and participantdemo
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
        'admindemo',
        'admin.demo@example.com',
        '$2a$10$pvN1yBhezmRmImNG22HPnOIU2e39H1AJpS1Za1JuYYnHzWq6kJQ6q',
        'Demo Admin',
        CURRENT_TIMESTAMP,
        'ACTIVE'
    ),
    (
        'participantdemo',
        'participant.demo@example.com',
        '$2a$10$pvN1yBhezmRmImNG22HPnOIU2e39H1AJpS1Za1JuYYnHzWq6kJQ6q',
        'Demo Participant',
        CURRENT_TIMESTAMP,
        'ACTIVE'
    )
ON CONFLICT ((LOWER(username))) DO UPDATE
SET password_hash = EXCLUDED.password_hash;

-- Map roles to demo accounts
INSERT INTO user_roles (user_id, role_id)
SELECT
    demo_user.user_id,
    system_role.role_id
FROM (
    VALUES
        ('admindemo', 'PARTICIPANT'),
        ('admindemo', 'ADMIN'),
        ('participantdemo', 'PARTICIPANT')
) AS demo_assignment(username, role_code)
JOIN users AS demo_user
    ON LOWER(demo_user.username) = LOWER(demo_assignment.username)
JOIN roles AS system_role
    ON system_role.code = demo_assignment.role_code
ON CONFLICT (user_id, role_id) DO NOTHING;
