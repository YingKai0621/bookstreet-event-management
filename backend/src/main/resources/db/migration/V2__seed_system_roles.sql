INSERT INTO roles (code, name, description)
VALUES
    (
        'PARTICIPANT',
        'Participant',
        'Người dùng tham gia Event và Activity'
    ),
    (
        'PARTNER',
        'Partner',
        'Đại diện tổ chức tham gia Event'
    ),
    (
        'ORGANIZER',
        'Organizer',
        'Người tổ chức và quản lý Event'
    ),
    (
        'ADMIN',
        'Admin',
        'Quản trị viên hệ thống'
    )
ON CONFLICT (code) DO NOTHING;