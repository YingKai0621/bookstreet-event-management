package com.swp391.bookstreet.certificate.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.certificate.dto.CertificateDetailResponse;
import com.swp391.bookstreet.certificate.dto.CertificatePageResponse;
import com.swp391.bookstreet.certificate.dto.CertificateSummaryResponse;
import com.swp391.bookstreet.certificate.entity.Certificate;
import com.swp391.bookstreet.certificate.entity.CertificateStatus;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import com.swp391.bookstreet.certificate.repository.CertificateDetailRecord;
import com.swp391.bookstreet.certificate.repository.CertificateRepository;
import com.swp391.bookstreet.certificate.security.CertificateCurrentUser;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.event.entity.Event;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.beans.BeanUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ParticipantCertificateServiceTests {

    private static final Long PARTICIPANT_ID = 100L;
    private static final Instant NOW = Instant.parse("2027-01-11T03:00:05Z");

    @Mock
    private CertificateRepository certificateRepository;

    @Mock
    private CertificateCurrentUser currentUser;

    private CertificatePdfRenderer pdfRenderer;
    private ParticipantCertificateService service;

    @BeforeEach
    void setUp() {
        pdfRenderer = new CertificatePdfRenderer();
        service = new ParticipantCertificateService(certificateRepository, currentUser, pdfRenderer);
    }

    @Test
    void listReturnsPagedCertificatesForAuthenticatedParticipant() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        Certificate certificate = createCertificate(601L, 10L, "BKS-2027-ABC1", "Nguyen Minh An", CertificateStatus.ISSUED);
        Page<Certificate> page = new PageImpl<>(List.of(certificate));

        when(certificateRepository.findOwnedCertificates(
                eq(PARTICIPANT_ID), eq(null), eq(null), eq(null), any(Pageable.class)
        )).thenReturn(page);

        CertificatePageResponse<CertificateSummaryResponse> result = service.list(0, 20, "issuedAt,desc", null, null, null);

        assertThat(result.content()).hasSize(1);
        CertificateSummaryResponse summary = result.content().get(0);
        assertThat(summary.certificateId()).isEqualTo(601L);
        assertThat(summary.certificateCode()).isEqualTo("BKS-2027-ABC1");
        assertThat(summary.recipientName()).isEqualTo("Nguyen Minh An");
        assertThat(summary.status()).isEqualTo("ISSUED");
        assertThat(summary.downloadAvailable()).isTrue();
    }

    @Test
    void listRejectsInvalidFilterOrSort() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        assertThatThrownBy(() -> service.list(0, 20, "issuedAt,desc", -1L, null, null))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(api.getCode()).isEqualTo("INVALID_IDENTIFIER");
                });

        assertThatThrownBy(() -> service.list(0, 20, "issuedAt,desc", null, -5L, null))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(api.getCode()).isEqualTo("INVALID_IDENTIFIER");
                });

        assertThatThrownBy(() -> service.list(0, 20, "issuedAt,desc", null, null, "INVALID_STATUS"))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(api.getCode()).isEqualTo("INVALID_FILTER");
                });

        assertThatThrownBy(() -> service.list(0, 20, "unknownField,desc", null, null, null))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(api.getCode()).isEqualTo("INVALID_SORT");
                });
    }

    @Test
    void detailReturnsCertificateWithActivityAndEvent() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        Certificate certificate = createCertificate(601L, 10L, "BKS-2027-ABC1", "Nguyễn Minh An", CertificateStatus.ISSUED);
        Activity activity = createActivity(91L, "Giao lưu tác giả trẻ");
        Event event = createEvent(7L, "Ngày hội Văn hóa Đọc 2027");

        when(certificateRepository.findOwnedDetail(601L, PARTICIPANT_ID))
                .thenReturn(Optional.of(new CertificateDetailRecord(certificate, activity, event)));

        CertificateDetailResponse detail = service.detail(601L);

        assertThat(detail.certificate().certificateId()).isEqualTo(601L);
        assertThat(detail.certificate().certificateCode()).isEqualTo("BKS-2027-ABC1");
        assertThat(detail.certificate().status()).isEqualTo("ISSUED");
        assertThat(detail.certificate().downloadAvailable()).isTrue();
        assertThat(detail.activity().activityId()).isEqualTo(91L);
        assertThat(detail.activity().title()).isEqualTo("Giao lưu tác giả trẻ");
        assertThat(detail.event().eventId()).isEqualTo(7L);
        assertThat(detail.event().name()).isEqualTo("Ngày hội Văn hóa Đọc 2027");
    }

    @Test
    void detailForRevokedCertificateReturnsRevokedStatusWithDownloadUnavailable() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        Certificate certificate = createCertificate(602L, 10L, "BKS-2027-REVOKED", "Tran Van B", CertificateStatus.REVOKED);
        ReflectionTestUtils.setField(certificate, "revokedAt", NOW.plusSeconds(3600));
        Activity activity = createActivity(91L, "Giao luu tac gia tre");
        Event event = createEvent(7L, "Ngay hoi Van hoa Doc 2027");

        when(certificateRepository.findOwnedDetail(602L, PARTICIPANT_ID))
                .thenReturn(Optional.of(new CertificateDetailRecord(certificate, activity, event)));

        CertificateDetailResponse detail = service.detail(602L);

        assertThat(detail.certificate().status()).isEqualTo("REVOKED");
        assertThat(detail.certificate().downloadAvailable()).isFalse();
        assertThat(detail.certificate().revokedAt()).isNotNull();
    }

    @Test
    void detailForMissingOrForeignCertificateThrows404() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        when(certificateRepository.findOwnedDetail(999L, PARTICIPANT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.detail(999L))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(api.getCode()).isEqualTo("CERTIFICATE_NOT_FOUND");
                });
    }

    @Test
    void downloadReturnsPdfBytesForIssuedCertificate() throws Exception {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        Certificate certificate = createCertificate(601L, 10L, "BKS-2027-ABC1", "Nguyễn Minh An", CertificateStatus.ISSUED);
        Activity activity = createActivity(91L, "Giao lưu tác giả trẻ");
        Event event = createEvent(7L, "Ngày hội Văn hóa Đọc 2027");

        when(certificateRepository.findOwnedDetail(601L, PARTICIPANT_ID))
                .thenReturn(Optional.of(new CertificateDetailRecord(certificate, activity, event)));

        ParticipantCertificateService.CertificateDownloadResult result = service.download(601L);

        assertThat(result.filename()).isEqualTo("certificate-BKS-2027-ABC1.pdf");
        assertThat(result.pdfContent()).isNotEmpty();
        assertThat(new String(result.pdfContent(), java.nio.charset.StandardCharsets.ISO_8859_1)).startsWith("%PDF-1.4");
        try (PDDocument document = Loader.loadPDF(result.pdfContent())) {
            String content = new PDFTextStripper().getText(document);
            assertThat(content)
                    .contains("ĐƯỜNG SÁCH", "GIẤY CHỨNG NHẬN", "NGUYỄN MINH AN")
                    .contains("Giao lưu tác giả trẻ", "Ngày hội Văn hóa Đọc 2027", "BKS-2027-ABC1");
        } catch (java.io.IOException exception) {
            throw new AssertionError("Generated certificate should be a readable PDF", exception);
        }
    }

    @Test
    void downloadThrowsConflictWhenCertificateIsRevoked() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        Certificate certificate = createCertificate(602L, 10L, "BKS-2027-REVOKED", "Tran Van B", CertificateStatus.REVOKED);
        Activity activity = createActivity(91L, "Giao luu tac gia tre");
        Event event = createEvent(7L, "Ngay hoi Van hoa Doc 2027");

        when(certificateRepository.findOwnedDetail(602L, PARTICIPANT_ID))
                .thenReturn(Optional.of(new CertificateDetailRecord(certificate, activity, event)));

        assertThatThrownBy(() -> service.download(602L))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(api.getCode()).isEqualTo("CERTIFICATE_REVOKED");
                });
    }

    @Test
    void downloadThrows503WhenRenderingFails() {
        when(currentUser.requireParticipantId()).thenReturn(PARTICIPANT_ID);

        Certificate certificate = createCertificate(601L, 10L, "BKS-2027-ABC1", "Nguyen Minh An", CertificateStatus.ISSUED);
        Activity activity = createActivity(91L, "Giao luu tac gia tre");
        Event event = createEvent(7L, "Ngay hoi Van hoa Doc 2027");

        when(certificateRepository.findOwnedDetail(601L, PARTICIPANT_ID))
                .thenReturn(Optional.of(new CertificateDetailRecord(certificate, activity, event)));

        pdfRenderer.setSimulateFailure(true);

        assertThatThrownBy(() -> service.download(601L))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> {
                    ApiException api = (ApiException) e;
                    assertThat(api.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(api.getCode()).isEqualTo("CERTIFICATE_RENDER_UNAVAILABLE");
                });

        // Ensure certificate status remains unchanged
        assertThat(certificate.getStatus()).isEqualTo(CertificateStatus.ISSUED);
    }

    private Certificate createCertificate(Long id, Long attendanceId, String code, String name, CertificateStatus status) {
        Certificate cert = Certificate.issue(attendanceId, code, name, NOW);
        ReflectionTestUtils.setField(cert, "certificateId", id);
        ReflectionTestUtils.setField(cert, "status", status);
        return cert;
    }

    private Activity createActivity(Long id, String title) {
        Activity activity = BeanUtils.instantiateClass(Activity.class);
        ReflectionTestUtils.setField(activity, "activityId", id);
        ReflectionTestUtils.setField(activity, "title", title);
        ReflectionTestUtils.setField(activity, "startAt", NOW.minusSeconds(3600));
        ReflectionTestUtils.setField(activity, "endAt", NOW);
        return activity;
    }

    private Event createEvent(Long id, String name) {
        Event event = BeanUtils.instantiateClass(Event.class);
        ReflectionTestUtils.setField(event, "eventId", id);
        ReflectionTestUtils.setField(event, "name", name);
        return event;
    }

}
