package com.swp391.bookstreet.common.media;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.activity.entity.ActivityStatus;
import com.swp391.bookstreet.activity.repository.ActivityRepository;
import com.swp391.bookstreet.activity.security.ActivityCurrentUser;
import com.swp391.bookstreet.activity.service.ActivityImageService;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.event.service.EventService;
import com.swp391.bookstreet.partner.entity.PartnerOrganization;
import com.swp391.bookstreet.partner.repository.PartnerOrganizationRepository;
import com.swp391.bookstreet.partner.service.PartnerOrganizationGuard;
import com.swp391.bookstreet.reward.security.RewardManagementCurrentUser;
import com.swp391.bookstreet.reward.service.BadgeImageService;
import com.swp391.bookstreet.security.authentication.AuthenticatedPrincipal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;

class EditorImageUploadTests {
    @TempDir Path directory;
    private final EventService events = mock(EventService.class);
    private final ActivityRepository activities = mock(ActivityRepository.class);
    private final PartnerOrganizationRepository organizations = mock(PartnerOrganizationRepository.class);
    private final byte[] png = java.util.Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQ1cAAAAASUVORK5CYII=");

    @AfterEach void clearIdentity() { SecurityContextHolder.clearContext(); }

    @Test void badgeUploadRoundTripsOriginalBytesInItsOwnDirectory() throws Exception {
        authenticate("ADMIN", true);
        var service = badges();
        String url = service.upload(image()).url();
        assertTrue(url.startsWith("/api/v1/media/badge-images/"));
        assertFalse(url.contains("event-banners"));
        try (var stream = service.read(name(url)).resource().getInputStream()) {
            assertArrayEquals(png, stream.readAllBytes());
        }
    }

    @ParameterizedTest @ValueSource(strings = {"PARTICIPANT", "PARTNER", "ORGANIZER"})
    void otherRolesCannotUploadBadgeImages(String role) throws Exception {
        authenticate(role, true);
        assertEquals("ACCESS_DENIED", assertThrows(ApiException.class,
                () -> badges().upload(image())).getCode());
        assertNoFiles();
    }

    @Test void anonymousAndUnverifiedAdminCannotUpload() throws Exception {
        assertEquals("AUTHENTICATION_REQUIRED", assertThrows(ApiException.class,
                () -> badges().upload(image())).getCode());
        authenticate("ADMIN", false);
        assertEquals("ACCESS_DENIED", assertThrows(ApiException.class,
                () -> badges().upload(image())).getCode());
        assertNoFiles();
    }

    @Test void organizerOwnershipFailureWritesNoFile() throws Exception {
        authenticate("ORGANIZER", true);
        when(events.getOwned(9L)).thenThrow(new ApiException(HttpStatus.NOT_FOUND,
                "EVENT_NOT_FOUND", "Not found"));
        assertThrows(ApiException.class, () -> activityImages().uploadForOrganizer(9L, image()));
        assertNoFiles();
    }

    @Test void organizerUploadChecksEventAndUsesActivityDirectory() throws Exception {
        authenticate("ORGANIZER", true);
        var service = activityImages();
        String url = service.uploadForOrganizer(9L, image()).url();
        verify(events).getOwned(9L);
        assertTrue(url.startsWith("/api/v1/media/activity-images/"));
        try (var stream = service.read(name(url)).resource().getInputStream()) {
            assertArrayEquals(png, stream.readAllBytes());
        }
        verifyNoInteractions(activities);
    }

    @Test void adminCannotUploadThroughOrganizerOrPartnerWorkflow() throws Exception {
        authenticate("ADMIN", true);
        assertThrows(RuntimeException.class, () -> activityImages().uploadForOrganizer(9L, image()));
        assertThrows(RuntimeException.class, () -> activityImages().uploadForPartner(7L, image()));
        verifyNoInteractions(events, activities, organizations);
        assertNoFiles();
    }

    @Test void lockedPartnerIsRejectedBeforeOwnershipLookupOrFileIO() throws Exception {
        authenticate("PARTNER", true);
        partnerOrganization(PartnerOrganization.OrganizationStatus.INACTIVE);
        assertEquals("PARTNER_ORGANIZATION_INACTIVE", assertThrows(ApiException.class,
                () -> activityImages().uploadForPartner(7L, image())).getCode());
        verifyNoInteractions(activities);
        assertNoFiles();
    }

    @Test void partnerCannotUploadForAnUnownedActivity() throws Exception {
        authenticate("PARTNER", true);
        partnerOrganization(PartnerOrganization.OrganizationStatus.ACTIVE);
        when(activities.findOwnedByPartner(7L, 42L)).thenReturn(Optional.empty());
        assertEquals("ACTIVITY_NOT_FOUND", assertThrows(ApiException.class,
                () -> activityImages().uploadForPartner(7L, image())).getCode());
        assertNoFiles();
    }

    @ParameterizedTest @ValueSource(strings = {"ONGOING", "COMPLETED", "CANCELLED"})
    void partnerCannotPrepareChangeForClosedOrOngoingActivity(String status) throws Exception {
        authenticate("PARTNER", true);
        partnerActivity(ActivityStatus.valueOf(status));
        assertEquals("ACTIVITY_IMAGE_NOT_EDITABLE", assertThrows(ApiException.class,
                () -> activityImages().uploadForPartner(7L, image())).getCode());
        assertNoFiles();
    }

    @ParameterizedTest @ValueSource(strings = {"DRAFT", "PUBLISHED"})
    void partnerUploadOnlyPreparesUrlWithoutSavingActivity(String status) {
        authenticate("PARTNER", true);
        var activity = partnerActivity(ActivityStatus.valueOf(status));
        assertTrue(activityImages().uploadForPartner(7L, image()).url().contains("activity-images"));
        verify(activity, never()).getImageUrl();
        verify(activities, never()).save(any());
        verify(activities, never()).saveAndFlush(any());
    }

    @Test void invalidContentAndUnsafeReadPathsAreRejected() throws Exception {
        var store = new ValidatedImageStorage(
                MediaStorageTestSupport.local(directory), MediaAssetType.BADGE_IMAGE);
        for (MockMultipartFile invalid : new MockMultipartFile[]{
                new MockMultipartFile("file", "a.png", "image/png", new byte[]{1, 2, 3}),
                new MockMultipartFile("file", "a.txt", "text/plain", png),
                new MockMultipartFile("file", "a.png", "image/png", new byte[0]),
                new MockMultipartFile("file", "a.png", "image/png", new byte[5 * 1024 * 1024 + 1])}) {
            assertEquals("IMAGE_INVALID", assertThrows(ApiException.class, () -> store.store(invalid)).getCode());
        }
        assertEquals("IMAGE_NOT_FOUND", assertThrows(ApiException.class,
                () -> store.load("../secret.png")).getCode());
        assertNoFiles();
    }

    private BadgeImageService badges() {
        return new BadgeImageService(
                new RewardManagementCurrentUser(), MediaStorageTestSupport.local(directory));
    }

    private ActivityImageService activityImages() {
        return new ActivityImageService(new ActivityCurrentUser(), events, activities, organizations,
                new PartnerOrganizationGuard(), MediaStorageTestSupport.local(directory));
    }

    private void partnerOrganization(PartnerOrganization.OrganizationStatus status) {
        var organization = mock(PartnerOrganization.class);
        when(organization.getStatus()).thenReturn(status);
        when(organizations.findByRepresentativeUserId(42L)).thenReturn(Optional.of(organization));
    }

    private Activity partnerActivity(ActivityStatus status) {
        partnerOrganization(PartnerOrganization.OrganizationStatus.ACTIVE);
        var activity = mock(Activity.class);
        when(activity.getStatus()).thenReturn(status);
        when(activities.findOwnedByPartner(7L, 42L)).thenReturn(Optional.of(activity));
        return activity;
    }

    private MockMultipartFile image() { return new MockMultipartFile("file", "ignored.png", "image/png", png); }
    private static String name(String url) { return url.substring(url.lastIndexOf('/') + 1); }
    private void assertNoFiles() throws Exception {
        try (var files = Files.list(directory)) { assertEquals(0, files.count()); }
    }
    private void authenticate(String role, boolean verified) {
        record Principal(Long userId, boolean emailVerified) implements AuthenticatedPrincipal { }
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new Principal(42L, verified), "unused", AuthorityUtils.createAuthorityList("ROLE_" + role)));
    }
}
