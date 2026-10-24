package com.swp391.bookstreet.certificate.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.certificate.entity.Certificate;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.event.entity.Event;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class CertificatePdfRenderer {
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'UTC'")
            .withZone(ZoneOffset.UTC);

    private volatile boolean simulateFailure = false;

    public void setSimulateFailure(boolean simulateFailure) {
        this.simulateFailure = simulateFailure;
    }

    public byte[] render(Certificate certificate, Activity activity, Event event) {
        if (simulateFailure) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "CERTIFICATE_RENDER_UNAVAILABLE",
                    "Certificate rendering is currently unavailable.");
        }

        try {
            return generatePdf(certificate, activity, event);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "CERTIFICATE_RENDER_UNAVAILABLE",
                    "Certificate rendering failed: " + e.getMessage());
        }
    }

    private byte[] generatePdf(Certificate certificate, Activity activity, Event event) throws Exception {
        String recipient = sanitize(certificate.getRecipientNameSnapshot());
        String activityTitle = sanitize(activity.getTitle());
        String eventName = sanitize(event.getName());
        String code = sanitize(certificate.getCertificateCode());
        String issuedAt = DATE_FORMATTER.format(certificate.getIssuedAt());
        String status = certificate.getStatus().name();

        ByteArrayOutputStream contentStream = new ByteArrayOutputStream();
        StringBuilder cs = new StringBuilder();

        // Decorative borders (A4 Landscape: 842 x 595)
        cs.append("q\n");
        // Gold outer border
        cs.append("0.77 0.61 0.15 RG 3 w\n");
        cs.append("25 25 792 545 re S\n");
        // Inner thin border
        cs.append("0.77 0.61 0.15 RG 1 w\n");
        cs.append("31 31 780 533 re S\n");

        // Header
        appendCenteredText(cs, "DUONG SACH TP. HO CHI MINH - BOOK STREET EVENT", "/F1", 16, 515);
        appendCenteredText(cs, "GIAY CHUNG NHAN THAM GIA HOAT DONG", "/F1", 24, 465);
        appendCenteredText(cs, "CERTIFICATE OF ATTENDANCE", "/F2", 13, 442);

        // Recipient Introduction
        appendCenteredText(cs, "Chung nhan duoc trao cho / This certificate is proudly presented to:", "/F2", 12, 385);

        // Recipient Name
        appendCenteredText(cs, recipient.toUpperCase(), "/F1", 22, 345);

        // Body: Activity and Event
        appendCenteredText(cs, "Da tham gia hoan thanh hoat dong / For successfully completing the activity:", "/F2", 12, 295);
        appendCenteredText(cs, activityTitle, "/F1", 16, 268);
        appendCenteredText(cs, "Trong khuon kho su kien / As part of the event:", "/F2", 12, 230);
        appendCenteredText(cs, eventName, "/F1", 15, 205);

        // Divider
        cs.append("0.77 0.61 0.15 RG 0.75 w\n");
        cs.append("70 145 m 772 145 l S\n");

        // Footer details
        cs.append("BT\n/F2 10 Tf\n0.2 0.2 0.2 rg\n");
        cs.append("70 120 Td (Ma chung nhan / Certificate ID: ").append(escapePdf(code)).append(") Tj\n");
        cs.append("0 -18 Td (Ngay cap / Issued at: ").append(escapePdf(issuedAt)).append(") Tj\n");
        cs.append("0 -18 Td (Trang thai / Status: ").append(escapePdf(status)).append(") Tj\n");
        cs.append("ET\n");

        cs.append("BT\n/F1 10 Tf\n0.2 0.2 0.2 rg\n");
        cs.append("540 120 Td (XAC NHAN CUA BAN TO CHUC) Tj\n");
        cs.append("/F2 10 Tf\n");
        cs.append("0 -18 Td (Book Street Event Management System) Tj\n");
        cs.append("0 -18 Td (He thong xac thuc dien tu) Tj\n");
        cs.append("ET\n");

        cs.append("Q\n");

        byte[] streamBytes = cs.toString().getBytes(StandardCharsets.US_ASCII);

        // Assemble PDF 1.4 objects
        List<byte[]> objects = new ArrayList<>();

        // Obj 1: Catalog
        objects.add("<< /Type /Catalog /Pages 2 0 R >>".getBytes(StandardCharsets.US_ASCII));

        // Obj 2: Pages
        objects.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>".getBytes(StandardCharsets.US_ASCII));

        // Obj 3: Page (842 x 595 - A4 Landscape)
        objects.add(("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 6 0 R " +
                "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>").getBytes(StandardCharsets.US_ASCII));

        // Obj 4: Font Helvetica-Bold
        objects.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>".getBytes(StandardCharsets.US_ASCII));

        // Obj 5: Font Helvetica
        objects.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".getBytes(StandardCharsets.US_ASCII));

        // Obj 6: Contents stream
        ByteArrayOutputStream streamObj = new ByteArrayOutputStream();
        streamObj.write(("<< /Length " + streamBytes.length + " >>\nstream\n").getBytes(StandardCharsets.US_ASCII));
        streamObj.write(streamBytes);
        streamObj.write("\nendstream".getBytes(StandardCharsets.US_ASCII));
        objects.add(streamObj.toByteArray());

        // Write full PDF with exact XREF offsets
        ByteArrayOutputStream pdf = new ByteArrayOutputStream();
        pdf.write("%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n".getBytes(StandardCharsets.ISO_8859_1));

        List<Integer> offsets = new ArrayList<>();
        offsets.add(0); // obj 0 dummy

        for (int i = 0; i < objects.size(); i++) {
            offsets.add(pdf.size());
            int objNum = i + 1;
            pdf.write((objNum + " 0 obj\n").getBytes(StandardCharsets.US_ASCII));
            pdf.write(objects.get(i));
            pdf.write("\nendobj\n".getBytes(StandardCharsets.US_ASCII));
        }

        int xrefOffset = pdf.size();
        pdf.write(("xref\n0 " + (objects.size() + 1) + "\n").getBytes(StandardCharsets.US_ASCII));
        pdf.write("0000000000 65535 f \n".getBytes(StandardCharsets.US_ASCII));
        for (int i = 1; i <= objects.size(); i++) {
            pdf.write(String.format("%010d 00000 n \n", offsets.get(i)).getBytes(StandardCharsets.US_ASCII));
        }

        pdf.write(("trailer\n<< /Size " + (objects.size() + 1) + " /Root 1 0 R >>\n").getBytes(StandardCharsets.US_ASCII));
        pdf.write("startxref\n".getBytes(StandardCharsets.US_ASCII));
        pdf.write((xrefOffset + "\n%%EOF\n").getBytes(StandardCharsets.US_ASCII));

        return pdf.toByteArray();
    }

    private void appendCenteredText(StringBuilder cs, String text, String font, int fontSize, int y) {
        // Approximate width: average char width ~ 0.52 * fontSize for Helvetica
        double approxWidth = text.length() * (fontSize * 0.52);
        int x = Math.max(50, (int) Math.round((842 - approxWidth) / 2.0));

        cs.append("BT\n")
                .append(font).append(" ").append(fontSize).append(" Tf\n")
                .append("0.1 0.1 0.1 rg\n")
                .append(x).append(" ").append(y).append(" Td\n")
                .append("(").append(escapePdf(text)).append(") Tj\n")
                .append("ET\n");
    }

    private String sanitize(String input) {
        if (input == null) return "";
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        String ascii = normalized.replaceAll("\\p{M}", "");
        // Replace special Vietnamese characters like Đ/đ
        ascii = ascii.replace("\u0110", "D").replace("\u0111", "d");
        return ascii.trim();
    }

    private String escapePdf(String text) {
        if (text == null) return "";
        return text.replace("\\", "\\\\")
                .replace("(", "\\(")
                .replace(")", "\\)");
    }
}
