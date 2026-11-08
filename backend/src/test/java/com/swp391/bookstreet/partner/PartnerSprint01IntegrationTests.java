package com.swp391.bookstreet.partner;

import com.swp391.bookstreet.auth.entity.Role;
import com.swp391.bookstreet.auth.entity.RoleCode;
import com.swp391.bookstreet.auth.entity.User;
import com.swp391.bookstreet.auth.repository.RoleRepository;
import com.swp391.bookstreet.auth.repository.UserRepository;
import com.swp391.bookstreet.auth.repository.UserRoleRepository;
import com.swp391.bookstreet.partner.dto.PartnerOrganizationRequest;
import com.swp391.bookstreet.partner.dto.SubmitPartnerApplicationRequest;
import com.swp391.bookstreet.partner.service.PartnerApplicationService;
import com.swp391.bookstreet.partner.service.PartnerOrganizationService;
import com.swp391.bookstreet.security.authentication.AuthenticatedUser;
import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PartnerSprint01IntegrationTests {

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired UserRoleRepository userRoles;
    @Autowired EntityManager entityManager;
    @Autowired PartnerOrganizationService organizations;
    @Autowired PartnerApplicationService applications;

    @Test
    void partnerOrganizationCreateUpdateAndValidationFollowContract() throws Exception {
        User partner = user(RoleCode.PARTNER);
        RequestPostProcessor asPartner = as(partner);

        mvc.perform(get("/api/v1/partner/organization").with(asPartner))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_NOT_FOUND"));
        mvc.perform(put("/api/v1/partner/organization").with(asPartner).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"categoryCode\":\"\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(put("/api/v1/partner/organization").with(asPartner).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(organizationJson("Publisher One")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Publisher One"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(get("/api/v1/partner/organization").with(asPartner))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Publisher One"));
        mvc.perform(put("/api/v1/partner/organization").with(asPartner).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(organizationJson("Publisher Updated")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Publisher Updated"));
    }

    @Test
    void submissionIsolationAndWithdrawalFollowAcceptanceCriteria() throws Exception {
        User partner = user(RoleCode.PARTNER);
        User otherPartner = user(RoleCode.PARTNER);
        User organizer = user(RoleCode.ORGANIZER);
        long eventId = event(organizer, "PUBLISHED", Instant.now().plusSeconds(86400));

        mvc.perform(post("/api/v1/events/{eventId}/applications", eventId)
                        .with(as(partner)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_REQUIRED"));

        organization(partner);
        long draftId = event(organizer, "DRAFT", Instant.now().plusSeconds(86400));
        long expiredId = event(organizer, "PUBLISHED", Instant.now().minusSeconds(60));
        mvc.perform(post("/api/v1/events/{eventId}/applications", draftId)
                        .with(as(partner)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_ACCEPTING_APPLICATIONS"));
        mvc.perform(post("/api/v1/events/{eventId}/applications", expiredId)
                        .with(as(partner)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPLICATION_DEADLINE_PASSED"));
        mvc.perform(post("/api/v1/events/{eventId}/applications", Long.MAX_VALUE)
                        .with(as(partner)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_FOUND"));

        MvcResult submission = mvc.perform(post("/api/v1/events/{eventId}/applications", eventId)
                        .with(as(partner)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"applicationNote\":\"Test application\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.submittedAt").exists())
                .andReturn();
        long applicationId = ((Number) JsonPath.read(
                submission.getResponse().getContentAsString(), "$.applicationId")).longValue();
        mvc.perform(post("/api/v1/events/{eventId}/applications", eventId)
                        .with(as(partner)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPLICATION_ALREADY_EXISTS"));
        mvc.perform(get("/api/v1/partner/applications").with(as(partner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].applicationId").value(applicationId));
        mvc.perform(get("/api/v1/partner/applications/{id}", applicationId).with(as(partner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
        mvc.perform(get("/api/v1/partner/applications/{id}", applicationId).with(as(otherPartner)))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/partner/applications/{id}/withdraw", applicationId)
                        .with(as(otherPartner)).with(csrf()))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/partner/applications/{id}/withdraw", applicationId)
                        .with(as(partner)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"))
                .andExpect(jsonPath("$.withdrawnAt").exists());
        mvc.perform(post("/api/v1/partner/applications/{id}/withdraw", applicationId)
                        .with(as(partner)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPLICATION_NOT_PENDING"));
    }

    @Test
    void inactiveOrganizationCannotSubmitOrBeApprovedButCanStillBeRejected() throws Exception {
        User organizer = user(RoleCode.ORGANIZER);
        User partner = user(RoleCode.PARTNER);
        organization(partner);
        long eventId = event(organizer, "PUBLISHED", Instant.now().plusSeconds(86400));
        long organizationId = jdbc.queryForObject(
                "select partner_organization_id from partner_organizations where representative_user_id = ?",
                Long.class, partner.getId());
        jdbc.update("update partner_organizations set status = 'INACTIVE' where partner_organization_id = ?",
                organizationId);
        entityManager.clear();

        mvc.perform(post("/api/v1/events/{eventId}/applications", eventId)
                        .with(as(partner)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_INACTIVE"));
        assertThat(jdbc.queryForObject("select count(*) from partner_event_applications where event_id = ?",
                Long.class, eventId)).isZero();

        long pendingId = jdbc.queryForObject("""
                insert into partner_event_applications(partner_organization_id, event_id, status, submitted_at)
                values (?, ?, 'PENDING', current_timestamp) returning application_id
                """, Long.class, organizationId, eventId);
        mvc.perform(post("/api/v1/organizer/applications/{id}/approve", pendingId)
                        .with(as(organizer)).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PARTNER_ORGANIZATION_INACTIVE"));
        mvc.perform(post("/api/v1/organizer/applications/{id}/reject", pendingId)
                        .with(as(organizer)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reviewNote\":\"Tổ chức chưa đáp ứng yêu cầu.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
    }

    @Test
    void submissionRechecksTimedLifecycleUnderRootLock() throws Exception {
        User partner = user(RoleCode.PARTNER);
        User organizer = user(RoleCode.ORGANIZER);
        organization(partner);
        long eventId = jdbc.queryForObject("""
                INSERT INTO events (organizer_user_id, name, start_at, end_at,
                    partner_application_deadline_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner, status, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP - INTERVAL '1 minute',
                    CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 hour',
                    60, 2, 5, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING event_id
                """, Long.class, organizer.getId(), "Started Test " + UUID.randomUUID());

        mvc.perform(post("/api/v1/events/{eventId}/applications", eventId)
                        .with(as(partner)).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_ACCEPTING_APPLICATIONS"));

        // The failed submit rolls back its transaction, including the in-memory lifecycle
        // advance. The scheduler persists ONGOING separately; the request-time guard still
        // rejects work from the effective ONGOING state.
        assertThat(jdbc.queryForObject("SELECT status FROM events WHERE event_id = ?",
                String.class, eventId)).isEqualTo("PUBLISHED");
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM partner_event_applications WHERE event_id = ?",
                Long.class, eventId)).isZero();
    }

    @Test
    void organizerOwnershipReviewAndRepeatTransitionFollowAcceptanceCriteria() throws Exception {
        User organizer = user(RoleCode.ORGANIZER);
        User otherOrganizer = user(RoleCode.ORGANIZER);
        User partner1 = user(RoleCode.PARTNER);
        User partner2 = user(RoleCode.PARTNER);
        organization(partner1);
        organization(partner2);
        long eventId = event(organizer, "PUBLISHED", Instant.now().plusSeconds(86400));
        long firstId = applications.submit(partner1.getId(), eventId,
                new SubmitPartnerApplicationRequest("First")).applicationId();
        long secondId = applications.submit(partner2.getId(), eventId,
                new SubmitPartnerApplicationRequest("Second")).applicationId();

        mvc.perform(get("/api/v1/organizer/events/{id}/applications", eventId).with(as(organizer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].partnerOrganizationStatus").value("ACTIVE"));
        mvc.perform(get("/api/v1/organizer/events/{id}/applications?status=PENDING&page=0&size=1", eventId)
                        .with(as(organizer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content.length()").value(1));
        mvc.perform(get("/api/v1/organizer/events/{id}/applications", eventId).with(as(otherOrganizer)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EVENT_ACCESS_DENIED"));
        mvc.perform(get("/api/v1/organizer/applications/{id}", firstId).with(as(organizer)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.partnerOrganizationStatus").value("ACTIVE"));
        mvc.perform(post("/api/v1/organizer/applications/{id}/approve", firstId)
                        .with(as(otherOrganizer)).with(csrf()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("EVENT_ACCESS_DENIED"));
        mvc.perform(post("/api/v1/organizer/applications/{id}/approve", firstId)
                        .with(as(organizer)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reviewNote\":\"Accepted\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.reviewedAt").exists());
        mvc.perform(get("/api/v1/partner/notifications?type=PARTNER_APPLICATION_STATUS_CHANGED")
                        .with(as(partner1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].referenceType").value("PARTNER_APPLICATION"))
                .andExpect(jsonPath("$.content[0].referenceId").value(firstId));
        mvc.perform(get("/api/v1/partner/notifications").with(as(partner2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(post("/api/v1/organizer/applications/{id}/approve", firstId)
                        .with(as(organizer)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("APPLICATION_NOT_PENDING"));
        mvc.perform(post("/api/v1/organizer/applications/{id}/reject", secondId)
                        .with(as(organizer)).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reviewNote\":\"Not suitable\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.reviewNote").value("Not suitable"))
                .andExpect(jsonPath("$.reviewedAt").exists());
        mvc.perform(get("/api/v1/partner/notifications?type=PARTNER_APPLICATION_STATUS_CHANGED")
                        .with(as(partner2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].referenceId").value(secondId));
        mvc.perform(get("/api/v1/partner/applications/{id}", firstId).with(as(partner1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM partner_event_applications WHERE event_id = ?",
                Long.class, eventId)).isEqualTo(2);
    }

    @Test
    void organizerCannotReviewApplicationAfterEventCancellation() throws Exception {
        User organizer = user(RoleCode.ORGANIZER);
        User partner = user(RoleCode.PARTNER);
        organization(partner);
        Long organizationId = jdbc.queryForObject("""
                SELECT partner_organization_id
                FROM partner_organizations
                WHERE representative_user_id = ?
                """, Long.class, partner.getId());
        long eventId = jdbc.queryForObject("""
                INSERT INTO events (organizer_user_id, name, start_at, end_at,
                    partner_application_deadline_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner, status,
                    cancelled_at, cancellation_reason, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '10 days',
                    CURRENT_TIMESTAMP + INTERVAL '11 days', CURRENT_TIMESTAMP + INTERVAL '5 days',
                    60, 2, 5, 'CANCELLED', CURRENT_TIMESTAMP,
                    'Cancelled for Partner review test.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING event_id
                """, Long.class, organizer.getId(), "Cancelled Test " + UUID.randomUUID());
        long applicationId = jdbc.queryForObject("""
                INSERT INTO partner_event_applications (partner_organization_id, event_id,
                    status, application_note, submitted_at)
                VALUES (?, ?, 'PENDING', 'Pending before cancellation', CURRENT_TIMESTAMP)
                RETURNING application_id
                """, Long.class, organizationId, eventId);

        mvc.perform(post("/api/v1/organizer/applications/{id}/approve", applicationId)
                        .with(as(organizer)).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVENT_NOT_ACCEPTING_APPLICATIONS"));

        assertThat(jdbc.queryForObject("""
                SELECT status FROM partner_event_applications WHERE application_id = ?
                """, String.class, applicationId)).isEqualTo("PENDING");
    }

    @Test
    void partnerApplicationListRejectsUnsupportedSortField() throws Exception {
        User partner = user(RoleCode.PARTNER);

        String[] allowedSortFields = {
                "submittedAt", "status", "eventId", "reviewedAt", "withdrawnAt"
        };

        for (String sortField : allowedSortFields) {
            mvc.perform(get("/api/v1/partner/applications")
                            .param("page", "0")
                            .param("size", "20")
                            .param("sort", sortField + ",desc")
                            .with(as(partner)))
                    .andExpect(status().isOk());
        }

        mvc.perform(get("/api/v1/partner/applications")
                        .param("page", "0")
                        .param("size", "1")
                        .param("sort", "[\"string\"]")
                        .with(as(partner)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"))
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    @Test
    void organizerApplicationListRejectsUnsupportedSortField() throws Exception {
        User organizer = user(RoleCode.ORGANIZER);
        long eventId = event(organizer, "PUBLISHED", Instant.now().plusSeconds(86400));

        String[] allowedSortFields = {
                "submittedAt", "status", "eventId", "reviewedAt", "withdrawnAt"
        };

        for (String sortField : allowedSortFields) {
            mvc.perform(get("/api/v1/organizer/events/{eventId}/applications", eventId)
                            .param("sort", sortField + ",desc")
                            .with(as(organizer)))
                    .andExpect(status().isOk());
        }

        mvc.perform(get("/api/v1/organizer/events/{eventId}/applications", eventId)
                        .param("sort", "unknownField,asc")
                        .with(as(organizer)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"))
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    private User user(RoleCode roleCode) {
        String username = "s1" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        User user = new User(username, username + "@example.test", "unused-hash", "Sprint One Test");
        user.setEmailVerifiedAt(Instant.now());
        users.saveAndFlush(user);
        Role role = roles.findByCode(roleCode).orElseThrow();
        userRoles.saveAndFlush(user.addRole(role));
        return user;
    }

    private RequestPostProcessor as(User user) {
        AuthenticatedUser principal = AuthenticatedUser.from(user);
        return authentication(new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities()));
    }

    private void organization(User partner) {
        organizations.createOrUpdate(partner.getId(), new PartnerOrganizationRequest(
                "Test Publisher", null, "PUBLISHER", null, null, null, null));
    }

    private long event(User organizer, String eventStatus, Instant deadline) {
        return jdbc.queryForObject("""
                INSERT INTO events (organizer_user_id, name, start_at, end_at,
                    partner_application_deadline_at, booth_payment_window_minutes,
                    max_booths_per_partner, max_activities_per_partner, status, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '10 days',
                    CURRENT_TIMESTAMP + INTERVAL '11 days', ?, 60, 2, 5, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING event_id
                """, Long.class, organizer.getId(), "Sprint Test " + UUID.randomUUID(),
                java.sql.Timestamp.from(deadline), eventStatus);
    }

    private String organizationJson(String name) {
        return "{\"name\":\"%s\",\"categoryCode\":\"PUBLISHER\"}".formatted(name);
    }
}
