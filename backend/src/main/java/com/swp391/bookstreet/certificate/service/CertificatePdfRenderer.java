package com.swp391.bookstreet.certificate.service;

import com.swp391.bookstreet.activity.entity.Activity;
import com.swp391.bookstreet.certificate.entity.Certificate;
import com.swp391.bookstreet.common.exception.ApiException;
import com.swp391.bookstreet.event.entity.Event;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdfwriter.compress.CompressParameters;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class CertificatePdfRenderer {
    private static final PDRectangle PAGE_SIZE = new PDRectangle(842, 595);
    private static final float SIDEBAR_WIDTH = 276;
    private static final Color NAVY = new Color(10, 39, 78);
    private static final Color DEEP_NAVY = new Color(7, 29, 61);
    private static final Color ORANGE = new Color(247, 83, 23);
    private static final Color CREAM = new Color(250, 247, 237);
    private static final Color INK = new Color(11, 39, 78);
    private static final Color BLUE_RULE = new Color(100, 124, 151);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter
            .ofPattern("dd/MM/yyyy")
            .withZone(ZoneId.of("Asia/Ho_Chi_Minh"));

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
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            document.getDocument().setVersion(1.4f);
            document.getDocumentCatalog().setVersion("1.4");
            PDPage page = new PDPage(PAGE_SIZE);
            document.addPage(page);
            PDFont regular;
            PDFont bold;
            try (InputStream regularStream = new ClassPathResource("fonts/NotoSans-Regular.ttf").getInputStream();
                    InputStream boldStream = new ClassPathResource("fonts/NotoSans-Bold.ttf").getInputStream()) {
                regular = PDType0Font.load(document, regularStream, true);
                bold = PDType0Font.load(document, boldStream, true);
            }

            try (PDPageContentStream canvas = new PDPageContentStream(document, page)) {
                drawBackground(canvas);
                drawBookStreetArtwork(canvas);
                drawCertificateDetails(canvas, regular, bold, certificate, activity, event);
            }

            document.save(output, CompressParameters.NO_COMPRESSION);
            return output.toByteArray();
        }
    }

    private void drawBackground(PDPageContentStream canvas) throws Exception {
        canvas.setNonStrokingColor(CREAM);
        canvas.addRect(0, 0, PAGE_SIZE.getWidth(), PAGE_SIZE.getHeight());
        canvas.fill();

        canvas.setNonStrokingColor(NAVY);
        canvas.addRect(0, 0, SIDEBAR_WIDTH, PAGE_SIZE.getHeight());
        canvas.fill();

        canvas.setStrokingColor(new Color(227, 217, 192));
        canvas.setLineWidth(0.8f);
        canvas.moveTo(SIDEBAR_WIDTH + 26, 30);
        canvas.lineTo(816, 30);
        canvas.lineTo(816, 565);
        canvas.lineTo(SIDEBAR_WIDTH + 26, 565);
        canvas.closePath();
        canvas.stroke();
    }

    private void drawBookStreetArtwork(PDPageContentStream canvas) throws Exception {
        // Large orange sun and layered open-book shapes echo the supplied Book Street artwork.
        canvas.setNonStrokingColor(ORANGE);
        addEllipse(canvas, 181, 438, 124, 124);
        canvas.fill();

        canvas.setNonStrokingColor(CREAM);
        canvas.moveTo(154, 450);
        canvas.lineTo(245, 421);
        canvas.lineTo(267, 348);
        canvas.lineTo(174, 373);
        canvas.closePath();
        canvas.fill();
        canvas.moveTo(149, 444);
        canvas.lineTo(239, 411);
        canvas.lineTo(260, 334);
        canvas.lineTo(169, 363);
        canvas.closePath();
        canvas.fill();

        canvas.setNonStrokingColor(ORANGE);
        canvas.moveTo(28, 280);
        canvas.lineTo(158, 335);
        canvas.lineTo(268, 302);
        canvas.lineTo(268, 267);
        canvas.lineTo(152, 293);
        canvas.lineTo(28, 240);
        canvas.closePath();
        canvas.fill();

        canvas.setNonStrokingColor(CREAM);
        canvas.moveTo(35, 242);
        canvas.lineTo(153, 284);
        canvas.lineTo(238, 260);
        canvas.lineTo(153, 306);
        canvas.closePath();
        canvas.fill();
        canvas.setNonStrokingColor(new Color(243, 231, 201));
        canvas.moveTo(153, 284);
        canvas.lineTo(251, 257);
        canvas.lineTo(218, 224);
        canvas.lineTo(153, 250);
        canvas.closePath();
        canvas.fill();

        // Stylized street-front arches at the foot of the panel.
        canvas.setNonStrokingColor(new Color(244, 233, 207));
        canvas.addRect(0, 0, SIDEBAR_WIDTH, 112);
        canvas.fill();
        drawArch(canvas, 13, 22, 50, 83, NAVY);
        drawArch(canvas, 75, 22, 50, 83, NAVY);
        drawArch(canvas, 137, 22, 50, 83, ORANGE);
        drawArch(canvas, 199, 22, 50, 83, NAVY);

        canvas.setNonStrokingColor(ORANGE);
        canvas.moveTo(0, 0);
        canvas.lineTo(SIDEBAR_WIDTH, 0);
        canvas.lineTo(SIDEBAR_WIDTH, 19);
        canvas.lineTo(0, 54);
        canvas.closePath();
        canvas.fill();
    }

    private void drawArch(PDPageContentStream canvas, float x, float y, float width, float height, Color color)
            throws Exception {
        canvas.setNonStrokingColor(color);
        canvas.addRect(x, y, width, height - width / 2);
        canvas.fill();
        addEllipse(canvas, x, y + height - width, width, width);
        canvas.fill();
        canvas.setNonStrokingColor(new Color(244, 233, 207));
        canvas.addRect(x + 9, y, width - 18, height - width / 2);
        canvas.fill();
        addEllipse(canvas, x + 9, y + height - width + 9, width - 18, width - 18);
        canvas.fill();
    }

    private void addEllipse(PDPageContentStream canvas, float x, float y, float width, float height)
            throws Exception {
        float k = 0.55228475f;
        float cx = x + width / 2;
        float cy = y + height / 2;
        float rx = width / 2;
        float ry = height / 2;
        canvas.moveTo(cx + rx, cy);
        canvas.curveTo(cx + rx, cy + k * ry, cx + k * rx, cy + ry, cx, cy + ry);
        canvas.curveTo(cx - k * rx, cy + ry, cx - rx, cy + k * ry, cx - rx, cy);
        canvas.curveTo(cx - rx, cy - k * ry, cx - k * rx, cy - ry, cx, cy - ry);
        canvas.curveTo(cx + k * rx, cy - ry, cx + rx, cy - k * ry, cx + rx, cy);
        canvas.closePath();
    }

    private void drawCertificateDetails(PDPageContentStream canvas, PDFont regular, PDFont bold,
            Certificate certificate, Activity activity, Event event) throws Exception {
        float left = SIDEBAR_WIDTH + 27;
        float right = 814;

        drawText(canvas, bold, 10, 30, 544, "ĐƯỜNG SÁCH", CREAM);
        drawText(canvas, regular, 8.3f, 30, 529, "TP. HỒ CHÍ MINH", CREAM);
        canvas.setNonStrokingColor(new Color(15, 177, 224));
        canvas.addRect(30, 511, 29, 5);
        canvas.fill();
        drawText(canvas, regular, 8, 30, 493, "B O O K", CREAM);
        drawText(canvas, regular, 8, 30, 479, "S T R E E T", CREAM);
        drawText(canvas, regular, 8, 30, 465, "E V E N T", CREAM);
        drawText(canvas, regular, 7.2f, 30, 420, "SÁCH", CREAM);
        drawText(canvas, regular, 7.2f, 30, 406, "KẾT NỐI", CREAM);
        drawText(canvas, regular, 7.2f, 30, 392, "CON NGƯỜI", CREAM);
        drawText(canvas, regular, 7.2f, 30, 378, "KIẾN TẠO", CREAM);
        drawText(canvas, regular, 7.2f, 30, 364, "TƯƠNG LAI", CREAM);

        drawText(canvas, bold, 13, left, 534, "CHỨNG NHẬN THAM GIA", ORANGE);
        canvas.setStrokingColor(BLUE_RULE);
        canvas.setLineWidth(0.7f);
        canvas.moveTo(left + 205, 537);
        canvas.lineTo(right, 537);
        canvas.stroke();

        drawText(canvas, bold, 31, left, 478, "GIẤY CHỨNG NHẬN", INK);
        drawText(canvas, bold, 31, left, 440, "THAM GIA HOẠT ĐỘNG", INK);
        drawText(canvas, regular, 12, left + 2, 411, "C E R T I F I C A T E   O F   A T T E N D A N C E", INK);

        drawText(canvas, bold, 10.5f, left + 2, 365, "Chứng nhận được trao cho /", INK);
        drawText(canvas, regular, 9.6f, left + 178, 365, "This certificate is proudly presented to", INK);

        String recipient = safe(certificate.getRecipientNameSnapshot(), "Người tham dự").toUpperCase();
        float nameSize = fittedSize(bold, recipient, 35, 20, right - left - 5);
        List<String> recipientLines = wrap(bold, recipient, nameSize, right - left - 5, 2);
        if (recipientLines.size() > 1) {
            nameSize = fittedSize(bold, recipient, 25, 19, right - left - 5);
            recipientLines = wrap(bold, recipient, nameSize, right - left - 5, 2);
        }
        float nameY = 316;
        float nameLineHeight = nameSize + 3;
        drawLines(canvas, bold, nameSize, left + 2, nameY, recipientLines, INK, nameLineHeight);
        float nameBottomY = nameY - (recipientLines.size() - 1) * nameLineHeight;
        float nameRuleY = nameBottomY - 14;
        canvas.setNonStrokingColor(ORANGE);
        canvas.addRect(left + 2, nameRuleY, Math.min(textWidth(bold, nameSize, recipientLines.get(0)), 320), 4);
        canvas.fill();

        float activityLabelY = nameRuleY - 30;
        drawText(canvas, regular, 10.5f, left + 2, activityLabelY, "Đã tham gia và hoàn thành hoạt động", INK);
        List<String> activityLines = wrap(bold, safe(activity.getTitle(), "Hoạt động"), 15, right - left - 5, 2);
        float activityTitleY = activityLabelY - 23;
        drawLines(canvas, bold, 15, left + 2, activityTitleY, activityLines, INK, 19);

        float eventLabelY = activityTitleY - activityLines.size() * 19 - 7;
        drawText(canvas, regular, 10.3f, left + 2, eventLabelY, "Trong khuôn khổ sự kiện / As part of the event", INK);
        List<String> eventLines = wrap(bold, safe(event.getName(), "Sự kiện"), 13.5f, right - left - 5, 2);
        drawLines(canvas, bold, 13.5f, left + 2, eventLabelY - 25, eventLines, INK, 18);

        float dividerY = 126;
        canvas.setStrokingColor(BLUE_RULE);
        canvas.setLineWidth(0.65f);
        canvas.moveTo(left + 2, dividerY);
        canvas.lineTo(right, dividerY);
        canvas.stroke();

        drawText(canvas, regular, 8.2f, left + 6, 100, "Mã chứng nhận", INK);
        drawText(canvas, regular, 8.2f, left + 91, 100, ":", INK);
        drawText(canvas, bold, 9, left + 105, 100, safe(certificate.getCertificateCode(), "—"), INK);
        drawText(canvas, regular, 8.2f, left + 6, 81, "Ngày cấp", INK);
        drawText(canvas, regular, 8.2f, left + 91, 81, ":", INK);
        drawText(canvas, bold, 9, left + 105, 81, DATE_FORMATTER.format(certificate.getIssuedAt()), INK);
        drawText(canvas, regular, 8.2f, left + 6, 62, "Trạng thái", INK);
        drawText(canvas, regular, 8.2f, left + 91, 62, ":", INK);
        drawText(canvas, bold, 9, left + 105, 62, certificate.getStatus().name(), INK);

        float signatureX = left + 365;
        canvas.setStrokingColor(BLUE_RULE);
        canvas.moveTo(signatureX - 18, 55);
        canvas.lineTo(signatureX - 18, 110);
        canvas.stroke();
        drawText(canvas, bold, 8.7f, signatureX, 101, "XÁC NHẬN CỦA BAN TỔ CHỨC", INK);
        drawText(canvas, regular, 8.4f, signatureX, 81, "Book Street Event Management System", INK);
        drawText(canvas, regular, 8.4f, signatureX, 62, "Hệ thống xác thực điện tử", INK);
    }

    private void drawText(PDPageContentStream canvas, PDFont font, float size, float x, float y,
            String text, Color color) throws Exception {
        canvas.beginText();
        canvas.setFont(font, size);
        canvas.setNonStrokingColor(color);
        canvas.newLineAtOffset(x, y);
        canvas.showText(text);
        canvas.endText();
    }

    private void drawLines(PDPageContentStream canvas, PDFont font, float size, float x, float y,
            List<String> lines, Color color, float lineHeight) throws Exception {
        for (int i = 0; i < lines.size(); i++) {
            drawText(canvas, font, size, x, y - i * lineHeight, lines.get(i), color);
        }
    }

    private float fittedSize(PDFont font, String text, float preferred, float minimum, float maxWidth)
            throws Exception {
        float size = preferred;
        while (size > minimum && textWidth(font, size, text) > maxWidth) size -= 0.5f;
        return size;
    }

    private float textWidth(PDFont font, float size, String text) throws Exception {
        return font.getStringWidth(text) / 1000f * size;
    }

    private List<String> wrap(PDFont font, String text, float size, float maxWidth, int maxLines) throws Exception {
        List<String> lines = new ArrayList<>();
        StringBuilder line = new StringBuilder();
        for (String word : text.trim().split("\\s+")) {
            String candidate = line.isEmpty() ? word : line + " " + word;
            if (!line.isEmpty() && textWidth(font, size, candidate) > maxWidth) {
                lines.add(line.toString());
                line.setLength(0);
                line.append(word);
                if (lines.size() == maxLines) break;
            } else {
                line.setLength(0);
                line.append(candidate);
            }
        }
        if (lines.size() < maxLines && !line.isEmpty()) lines.add(line.toString());
        if (lines.size() == maxLines && textWidth(font, size, lines.get(maxLines - 1)) > maxWidth) {
            lines.set(maxLines - 1, fitEllipsis(font, text, size, maxWidth));
        }
        return lines;
    }

    private String fitEllipsis(PDFont font, String text, float size, float maxWidth) throws Exception {
        String value = text;
        while (!value.isEmpty() && textWidth(font, size, value + "…") > maxWidth) {
            value = value.substring(0, value.length() - 1).stripTrailing();
        }
        return value + "…";
    }

    private String safe(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
