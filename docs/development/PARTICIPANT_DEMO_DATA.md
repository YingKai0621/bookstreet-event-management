# Legacy Sprint 6 participant demo data

The historical Sprint 6 demo migrations `V12`–`V16` remain in
`backend/src/main/resources/db/demo` as immutable reference data. They must not be loaded together
with the production migration location after Sprint 7 because the approved production reward
schema now owns version `V12`. The backend therefore loads only `classpath:db/migration`.

Any disposable local database that previously applied the demo `V12`–`V16` chain must be recreated
before running the Sprint 7 backend. Do not edit, renumber or copy these applied migration contents
into the production migration directory. A future demo dataset must use a non-conflicting delivery
mechanism and receive a separate review.

## Accounts

| Username | Password | Purpose |
| --- | --- | --- |
| `participantdemo` | `BookStreet@123` | Try joining Events and registering Activities. |
| `seatdemoreader` | `BookStreet@123` | Holds the only seat in one full Activity. |

## Seeded schedule

- Six `[Demo Participant]` Published Events, starting 5, 7, 10, 14, 21 and 28 days after the first migration run.
- Each Event has one Published, registration required talk and one Published reading area that needs no registration: 12 Activities total.
- Three active Locations: stage, workshop room and reading area. The talks use the stage and the open readings use the reading area.
- `Gặp gỡ tác giả trẻ` has a passed Event registration deadline. It demonstrates a closed Join.
- The talk in `Hành trình văn học Việt` has capacity one, held by `seatdemoreader`. It demonstrates a full Activity.
- Five Events remain open for Join and four talks have available seats while their dates remain in the future. There are no pre-created registrations for `participantdemo`.

## Quick check

The steps below describe the archived Sprint 6 dataset only. They are retained as reference and are
not an instruction to enable `db/demo` in a Sprint 7 database.

1. On an archived Sprint 6 disposable database, confirm Flyway applied the legacy demo chain.
2. Open `/su-kien` and look for the `[Demo Participant]` Events.
3. Sign in as `participantdemo`, join an open Event, and open **Sự kiện của tôi**.
4. Open the Event detail and its **Hoạt động** tab. Register the talk. The reading area needs no registration.
5. Try the closed Event and full talk to verify their availability messages.

The backend public endpoints `GET /api/v1/events` and `GET /api/v1/activities` show the seeded schedule without signing in.

## Rich Event content (V15)

Flyway `V15` enriches the six existing demo Events with separate Vietnamese descriptions and banners served from `frontend/public`. Each Event now has four Published Activities: a registration-required talk, a registration-required workshop, an open reading area, and an open exhibition. The Activities have descriptions, images, distinct time slots and valid Locations. In total the demo schedule contains 24 Activities, including 12 that require registration.

This preserves the closed Event registration deadline and the full talk from V14. Event/Activity times are anchored to the original V12 run date; if they have passed, use a new disposable local database instead of changing applied migration files.

## Deadline and registration scenarios (V16)

`V16` adds four Published Events owned by `organizerdemo`, each with two seat-controlled Activities and one open reading area. Dates are calculated once on first migration; the Event names identify the expected result. Use `participantdemo` to try the Participant flow. Use a Partner account for the partner application deadline; the seed does not automatically submit any Partner application.

| Event | Join Event | Partner apply | Workshop A | Talk B | Reading area |
| --- | --- | --- | --- | --- | --- |
| `01 - Đăng ký bình thường` | Open | Open | Open, 20 seats | Open, 30 seats | No registration |
| `02 - Quá hạn tham gia sự kiện` | Deadline passed | Deadline passed | Listed, but a new Participant cannot Join the Event | Listed | No registration |
| `03 - Một hoạt động quá hạn` | Open | Open | Registration deadline passed | Open, 30 seats | No registration |
| `04 - Một hoạt động hết chỗ` | Open | Open | One seat held by `seatdemoreader` | Open, 30 seats | No registration |

Happy cases: Join 01, register Workshop A or Talk B, and browse the reading area. Unhappy cases: try to Join 02, register Workshop A in 03, or register Workshop A in 04. In cases 03 and 04, Talk B remains open so the Event still has a valid registration path. The Activity dates are 35, 42, 49 and 56 days after first applying V16, respectively.
