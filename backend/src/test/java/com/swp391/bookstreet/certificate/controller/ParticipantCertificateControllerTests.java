package com.swp391.bookstreet.certificate.controller;

import com.swp391.bookstreet.certificate.dto.CertificateDetailActivityResponse;
import com.swp391.bookstreet.certificate.dto.CertificateDetailEventResponse;
import com.swp391.bookstreet.certificate.dto.CertificateDetailResponse;
import com.swp391.bookstreet.certificate.dto.CertificatePageResponse;
import com.swp391.bookstreet.certificate.dto.CertificateSummaryResponse;
import com.swp391.bookstreet.certificate.service.ParticipantCertificateService;
import com.swp391.bookstreet.certificate.service.ParticipantCertificateService.CertificateDownloadResult;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.common.exception.GlobalExceptionHandler;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ParticipantCertificateControllerTests {

    private static final String BASE_URL = "/api/v1/participant/certificates";
    private static final Instant NOW = Instant.parse("2027-01-11T03:00:05Z");

    @Mock
    private ParticipantCertificateService service;

    @InjectMocks
    private ParticipantCertificateController controller;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void listReturnsPagedCertificates() throws Exception {
        CertificateSummaryResponse summary = new CertificateSummaryResponse(
                601L, "BKS-2027-ABC1", "Nguyen Minh An", "ISSUED", NOW, null, true);
        CertificatePageResponse<CertificateSummaryResponse> page = new CertificatePageResponse<>(
                List.of(summary), 0, 20, 1, 1);

        when(service.list(eq(0), eq(20), eq("issuedAt,desc"), eq(null), eq(null), eq(null)))
                .thenReturn(page);

        mockMvc.perform(get(BASE_URL)
                        .param("page", "0")
                        .param("size", "20")
                        .param("sort", "issuedAt,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.content[0].certificateId").value(601))
                .andExpect(jsonPath("$.content[0].certificateCode").value("BKS-2027-ABC1"))
                .andExpect(jsonPath("$.content[0].recipientName").value("Nguyen Minh An"))
                .andExpect(jsonPath("$.content[0].status").value("ISSUED"))
                .andExpect(jsonPath("$.content[0].downloadAvailable").value(true));
    }

    @Test
    void listPropagatesInvalidSortError() throws Exception {
        when(service.list(anyInt(), anyInt(), eq("invalidField,asc"), eq(null), eq(null), eq(null)))
                .thenThrow(new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SORT", "sort uses an unsupported Certificate field."));

        mockMvc.perform(get(BASE_URL)
                        .param("sort", "invalidField,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_SORT"))
                .andExpect(jsonPath("$.message").value("sort uses an unsupported Certificate field."));
    }

    @Test
    void detailReturnsCertificateWithActivityAndEvent() throws Exception {
        CertificateSummaryResponse certSummary = new CertificateSummaryResponse(
                601L, "BKS-2027-ABC1", "Nguyen Minh An", "ISSUED", NOW, null, true);
        CertificateDetailActivityResponse act = new CertificateDetailActivityResponse(
                91L, "Giao luu tac gia tre", NOW.minusSeconds(3600), NOW);
        CertificateDetailEventResponse ev = new CertificateDetailEventResponse(
                7L, "Ngay hoi Van hoa Doc 2027");
        CertificateDetailResponse detail = new CertificateDetailResponse(certSummary, act, ev);

        when(service.detail(601L)).thenReturn(detail);

        mockMvc.perform(get(BASE_URL + "/601"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.certificate.certificateId").value(601))
                .andExpect(jsonPath("$.certificate.certificateCode").value("BKS-2027-ABC1"))
                .andExpect(jsonPath("$.certificate.recipientName").value("Nguyen Minh An"))
                .andExpect(jsonPath("$.certificate.status").value("ISSUED"))
                .andExpect(jsonPath("$.certificate.downloadAvailable").value(true))
                .andExpect(jsonPath("$.activity.activityId").value(91))
                .andExpect(jsonPath("$.activity.title").value("Giao luu tac gia tre"))
                .andExpect(jsonPath("$.event.eventId").value(7))
                .andExpect(jsonPath("$.event.name").value("Ngay hoi Van hoa Doc 2027"));
    }

    @Test
    void detailReturns404WhenNotFound() throws Exception {
        when(service.detail(999L))
                .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "CERTIFICATE_NOT_FOUND", "Certificate not found."));

        mockMvc.perform(get(BASE_URL + "/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_NOT_FOUND"));
    }

    @Test
    void downloadReturnsPdfFileWithContentDisposition() throws Exception {
        byte[] pdfBytes = "%PDF-1.4 test certificate".getBytes();
        CertificateDownloadResult downloadResult = new CertificateDownloadResult(
                pdfBytes, "certificate-BKS-2027-ABC1.pdf");

        when(service.download(601L)).thenReturn(downloadResult);

        mockMvc.perform(get(BASE_URL + "/601/download"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"certificate-BKS-2027-ABC1.pdf\""))
                .andExpect(content().bytes(pdfBytes));
    }

    @Test
    void downloadReturns409WhenRevoked() throws Exception {
        when(service.download(602L))
                .thenThrow(new ApiException(HttpStatus.CONFLICT, "CERTIFICATE_REVOKED", "Revoked certificate cannot be downloaded."));

        mockMvc.perform(get(BASE_URL + "/602/download"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_REVOKED"));
    }

    @Test
    void downloadReturns503WhenRenderingFails() throws Exception {
        when(service.download(601L))
                .thenThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "CERTIFICATE_RENDER_UNAVAILABLE", "Certificate rendering is currently unavailable."));

        mockMvc.perform(get(BASE_URL + "/601/download"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("CERTIFICATE_RENDER_UNAVAILABLE"));
    }
}
