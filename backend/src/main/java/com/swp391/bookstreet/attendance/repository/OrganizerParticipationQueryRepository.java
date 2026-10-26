package com.swp391.bookstreet.attendance.repository;

import com.swp391.bookstreet.attendance.dto.*;
import com.swp391.bookstreet.attendance.service.ParticipationPagination;
import com.swp391.bookstreet.registration.dto.AttendanceSummaryResponse;
import com.swp391.bookstreet.registration.dto.CertificateSummaryResponse;
import com.swp391.bookstreet.registration.dto.RegistrationPageResponse;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class OrganizerParticipationQueryRepository {
    private static final String OUTCOME = """
            case when r.status = 'CANCELLED' then 'CANCELLED'
                 when att.status = 'VALID' then 'ATTENDED'
                 when r.status = 'NO_SHOW' then 'NO_SHOW' else 'ACTIVE' end
            """;
    private static final String JOINS = """
            from activity_registrations r
            join event_registrations er on er.event_registration_id = r.event_registration_id
            join activities a on a.activity_id = r.activity_id
            join events e on e.event_id = a.event_id
            join users u on u.user_id = er.user_id
            left join attendances att on att.activity_registration_id = r.activity_registration_id
            left join certificates c on c.attendance_id = att.attendance_id
            left join activity_ratings rating on rating.attendance_id = att.attendance_id
            """;
    private static final String SELECT = """
            select r.*, a.event_id, u.user_id, u.full_name,
                   att.attendance_id, att.status as attendance_status, att.recorded_source,
                   att.attended_at, att.created_at as attendance_created_at,
                   att.updated_at as attendance_updated_at, att.voided_at,
                   c.certificate_id, c.certificate_code, c.recipient_name_snapshot,
                   c.status as certificate_status, c.issued_at, c.revoked_at,
                   rating.status as rating_status,
                   (select max(ad.adjusted_at) from attendance_adjustments ad
                    where ad.activity_registration_id = r.activity_registration_id) as latest_adjustment_at,
            """ + OUTCOME + " as outcome " + JOINS;

    private final JdbcTemplate jdbc;

    public OrganizerParticipationQueryRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public RegistrationPageResponse<OrganizerParticipationResponse> activities(Long organizerId, Long activityId,
            String status, String outcome, String attendanceStatus, String search, ParticipationPagination page) {
        String where = " where e.organizer_user_id = ? and a.activity_id = ?";
        List<Object> args = new ArrayList<>(List.of(organizerId, activityId));
        if (status != null) { where += " and r.status = ?"; args.add(status); }
        if (outcome != null) { where += " and (" + OUTCOME + ") = ?"; args.add(outcome); }
        if (attendanceStatus != null) { where += " and att.status = ?"; args.add(attendanceStatus); }
        if (!search.isEmpty()) { where += " and position(lower(?) in lower(u.full_name)) > 0"; args.add(search); }
        long count = jdbc.queryForObject("select count(*) " + JOINS + where, Long.class, args.toArray());
        args.add(page.size()); args.add(page.offset());
        var rows = jdbc.query(SELECT + where + " order by " + page.sql("r.activity_registration_id")
                + " limit ? offset ?", (rs, n) -> participation(rs), args.toArray());
        return new RegistrationPageResponse<>(rows, page.page(), page.size(), count, pages(count, page.size()));
    }

    public OrganizerParticipationResponse detail(Long organizerId, Long registrationId) {
        return jdbc.query(SELECT + " where e.organizer_user_id = ? and r.activity_registration_id = ?",
                (rs, n) -> participation(rs), organizerId, registrationId).stream().findFirst().orElse(null);
    }

    public RegistrationPageResponse<OrganizerEventRegistrationResponse> events(Long organizerId, Long eventId,
            String status, String search, ParticipationPagination page) {
        String from = " from event_registrations er join events e on e.event_id = er.event_id"
                + " join users u on u.user_id = er.user_id where e.organizer_user_id = ? and er.event_id = ?";
        List<Object> args = new ArrayList<>(List.of(organizerId, eventId));
        if (status != null) { from += " and er.status = ?"; args.add(status); }
        if (!search.isEmpty()) { from += " and position(lower(?) in lower(u.full_name)) > 0"; args.add(search); }
        long count = jdbc.queryForObject("select count(*)" + from, Long.class, args.toArray());
        String counts = """
                select er.*, u.full_name,
                (select count(*) from activity_registrations r join activities a on a.activity_id=r.activity_id
                 where r.event_registration_id=er.event_registration_id and r.status='ACTIVE'
                 and a.status in ('PUBLISHED','ONGOING')) as seat_count,
                (select count(*) from activity_registrations r
                 where r.event_registration_id=er.event_registration_id) as registration_count,
                (select count(*) from activity_registrations r join attendances att
                 on att.activity_registration_id=r.activity_registration_id
                 where r.event_registration_id=er.event_registration_id and r.status <> 'CANCELLED'
                 and att.status='VALID') as attended_count,
                (select count(*) from activity_registrations r
                 where r.event_registration_id=er.event_registration_id and r.status='NO_SHOW'
                 and not exists(select 1 from attendances att where att.activity_registration_id=r.activity_registration_id
                     and att.status='VALID')) as no_show_count
                """;
        args.add(page.size()); args.add(page.offset());
        var rows = jdbc.query(counts + from + " order by " + page.sql("er.event_registration_id")
                + " limit ? offset ?", (rs, n) -> new OrganizerEventRegistrationResponse(
                        rs.getLong("event_registration_id"), rs.getLong("event_id"),
                        new ParticipationPersonResponse(rs.getLong("user_id"), rs.getString("full_name")),
                        rs.getString("status"), time(rs, "registered_at"), time(rs, "activated_at"),
                        time(rs, "left_at"), time(rs, "updated_at"), rs.getLong("seat_count"),
                        rs.getLong("registration_count"), rs.getLong("attended_count"), rs.getLong("no_show_count")), args.toArray());
        return new RegistrationPageResponse<>(rows, page.page(), page.size(), count, pages(count, page.size()));
    }

    private OrganizerParticipationResponse participation(ResultSet rs) throws SQLException {
        Long attendanceId = rs.getObject("attendance_id", Long.class);
        AttendanceSummaryResponse attendance = attendanceId == null ? null : new AttendanceSummaryResponse(
                attendanceId, rs.getString("attendance_status"), rs.getString("recorded_source"),
                time(rs, "attended_at"), time(rs, "attendance_created_at"), time(rs, "attendance_updated_at"), time(rs, "voided_at"));
        Long certificateId = rs.getObject("certificate_id", Long.class);
        CertificateSummaryResponse certificate = certificateId == null ? null : new CertificateSummaryResponse(
                certificateId, rs.getString("certificate_code"), rs.getString("recipient_name_snapshot"),
                rs.getString("certificate_status"), time(rs, "issued_at"), time(rs, "revoked_at"),
                "ISSUED".equals(rs.getString("certificate_status")));
        return new OrganizerParticipationResponse(rs.getLong("activity_registration_id"), rs.getLong("event_registration_id"),
                rs.getLong("event_id"), rs.getLong("activity_id"), new ParticipationPersonResponse(rs.getLong("user_id"),
                rs.getString("full_name")), rs.getString("status"), rs.getString("cancellation_source"), rs.getString("outcome"),
                time(rs, "registered_at"), time(rs, "activated_at"), time(rs, "cancelled_at"), time(rs, "no_show_at"),
                attendance, certificate, rs.getString("rating_status"), time(rs, "latest_adjustment_at"));
    }

    private static Instant time(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static int pages(long count, int size) { return (int) ((count + size - 1) / size); }
}
